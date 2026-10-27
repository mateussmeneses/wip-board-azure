// src/data/sprint-observation-store.js
// Sprint Observation persistence (PRODUCT_ROADMAP T2.4, "Histórico de
// observações da sprint").
//
// Purpose
// -------
// Persist, on chrome.storage.local, successive OBSERVATIONS of a sprint's state
// so the Sprint Trend engine (src/data/sprint-trends.js) can reason about change
// over time. An observation is an immutable, append-only record of what the
// board looked like at one capture instant. It is DISTINCT from:
//   - the baseline (the immutable initial scope, saved once in T2.2), and
//   - a daily snapshot (T1.1), which is board-wide and not sprint-tagged.
//
// This store deliberately creates the SMALLEST additional contract the goal
// asks for (goal section 2: "reuse the existing persistence layers, creating the
// smallest additional contract needed"). It mirrors the snapshot-store /
// sprint-goal-store design exactly: the same injectable storage adapter, the
// same scope+sprint key isolation, the same immutable/append-only discipline and
// the same STORAGE_FAILURE surfacing.
//
// An observation record contains (goal section 2):
//   - scope: organization / project / team identity,
//   - sprintId: the sprint identity,
//   - capturedAt: date/time of capture (ISO + epoch + tz offset + local day),
//   - source: where the data came from ('dom-reader' | 'api' | ...),
//   - baselineRef: which baseline this observation is measured against
//     (sprint id + baseline revision + capturedAt), so a re-baseline is visible,
//   - items: the observed work items (id + column/state) — the baseline is NOT
//     altered and the DOM is NOT used to reconstruct past states (goal section 2),
//   - complete + reliability: completeness / confidence indicators,
//   - metrics: optional derived metrics captured alongside (never required).
//
// Constraints honored:
//   - The baseline is never written or mutated here.
//   - Observations are append-only and immutable; a correction is a NEW
//     observation, never an in-place edit.
//   - Capture is an EXPLICIT user action in the runtime (no background schedule
//     that needs a permanently-open browser — goal section 2).
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script / popup: attaches to window.WIPBoardSprintObservationStore.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSprintObservationStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const OBSERVATION_PREFIX = 'wipx:obs:';

  // Default retention: keep at most this many observations per sprint scope,
  // pruning the oldest first. Bounded so storage.local never grows unbounded.
  const DEFAULT_RETENTION = Object.freeze({
    maxObservationsPerSprint: 120,
  });

  const ErrorCodes = Object.freeze({
    INVALID_SCOPE: 'INVALID_SCOPE',
    INVALID_SPRINT: 'INVALID_SPRINT',
    INVALID_OBSERVATION: 'INVALID_OBSERVATION',
    NOT_FOUND: 'NOT_FOUND',
    STORAGE_FAILURE: 'STORAGE_FAILURE',
  });

  class SprintObservationStoreError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'SprintObservationStoreError';
      this.code = code;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage adapter: identical promise wrapper the sibling stores use, fully
  // injectable so tests pass the shared mock.
  // ---------------------------------------------------------------------------

  function resolveChromeStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  function createAdapter(injected) {
    const storage = injected || resolveChromeStorage();
    if (!storage) {
      throw new SprintObservationStoreError(
        ErrorCodes.STORAGE_FAILURE,
        'chrome.storage.local is unavailable and no storage adapter was injected'
      );
    }

    function lastError() {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError
        ? chrome.runtime.lastError
        : null;
    }

    function wrap(op) {
      return new Promise(function (resolve, reject) {
        try {
          const maybePromise = op(function (result) {
            const err = lastError();
            if (err) {
              reject(new SprintObservationStoreError(ErrorCodes.STORAGE_FAILURE, err.message));
              return;
            }
            resolve(result || {});
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(function (result) { resolve(result || {}); },
              function (e) { reject(new SprintObservationStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message)); });
          }
        } catch (e) {
          reject(new SprintObservationStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
        }
      });
    }

    return {
      get: function (keys) { return wrap(function (cb) { return storage.get(keys, cb); }); },
      set: function (obj) { return wrap(function (cb) { return storage.set(obj, cb); }); },
      remove: function (keys) { return wrap(function (cb) { return storage.remove(keys, cb); }); },
    };
  }

  // ---------------------------------------------------------------------------
  // Scope + key helpers. Keys embed the scope AND the sprint id so two sprints in
  // the same board never collide (goal section 9: different orgs/sprints).
  // ---------------------------------------------------------------------------

  function normalizeScopePart(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/::/g, ':_:');
  }

  function assertScope(scope) {
    if (!scope || typeof scope !== 'object') {
      throw new SprintObservationStoreError(ErrorCodes.INVALID_SCOPE, 'scope is required');
    }
    ['organization', 'project', 'team', 'board'].forEach(function (field) {
      const value = scope[field];
      if (value == null || String(value).trim() === '') {
        throw new SprintObservationStoreError(ErrorCodes.INVALID_SCOPE, 'scope.' + field + ' is required');
      }
    });
    return scope;
  }

  function assertSprintId(sprintId) {
    if (sprintId == null || String(sprintId).trim() === '') {
      throw new SprintObservationStoreError(ErrorCodes.INVALID_SPRINT, 'sprintId is required');
    }
    return String(sprintId);
  }

  function scopeSprintKey(scope, sprintId) {
    assertScope(scope);
    const sid = assertSprintId(sprintId);
    return [
      normalizeScopePart(scope.organization),
      normalizeScopePart(scope.project),
      normalizeScopePart(scope.team),
      normalizeScopePart(scope.board),
      normalizeScopePart(sid),
    ].join('::');
  }

  function observationKey(scope, sprintId, id) {
    return OBSERVATION_PREFIX + scopeSprintKey(scope, sprintId) + '::' + id;
  }

  function observationScanPrefix(scope, sprintId) {
    return OBSERVATION_PREFIX + scopeSprintKey(scope, sprintId) + '::';
  }

  // ---------------------------------------------------------------------------
  // Time + normalization helpers. Timezone info is preserved so historic
  // comparison is unambiguous (goal section 9: fusos horários).
  // ---------------------------------------------------------------------------

  function buildCapturedAt(date) {
    const d = date instanceof Date ? date : new Date(date != null ? date : Date.now());
    const resolved = Number.isFinite(d.getTime()) ? d : new Date();
    return {
      iso: resolved.toISOString(),
      epochMs: resolved.getTime(),
      timezoneOffsetMinutes: -resolved.getTimezoneOffset(),
      localDay: toLocalDay(resolved),
    };
  }

  function toLocalDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function isUsable(value) {
    if (value === undefined) return false;
    if (value && typeof value === 'object' && value.__wipFieldState === 'unavailable') return false;
    return true;
  }

  // Only the whitelisted, non-sensitive item fields are persisted (security).
  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object' || raw.id == null) return null;
    const item = { id: raw.id };
    if (isUsable(raw.column)) item.column = raw.column;
    if (isUsable(raw.state)) item.state = raw.state;
    if (isUsable(raw.type)) item.type = raw.type;
    if (isUsable(raw.parentId)) item.parentId = raw.parentId;
    return item;
  }

  function normalizeItems(items) {
    const out = [];
    const seen = new Set();
    (Array.isArray(items) ? items : []).forEach(function (raw) {
      const item = normalizeItem(raw);
      if (!item) return;
      if (seen.has(item.id)) return; // collapse swimlane duplicates
      seen.add(item.id);
      out.push(item);
    });
    return out;
  }

  // The baseline REFERENCE only (id + revision + capturedAt). The baseline itself
  // is never copied or mutated here (goal section 2).
  function normalizeBaselineRef(ref) {
    if (!ref || typeof ref !== 'object') return null;
    return {
      sprintId: ref.sprintId != null ? ref.sprintId : null,
      revision: typeof ref.revision === 'number' ? ref.revision : null,
      capturedAt: ref.capturedAt && typeof ref.capturedAt === 'object'
        ? { iso: ref.capturedAt.iso || null, epochMs: ref.capturedAt.epochMs || null }
        : null,
    };
  }

  function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.keys(obj).forEach(function (key) { deepFreeze(obj[key]); });
      Object.freeze(obj);
    }
    return obj;
  }

  function mapOf(key, value) {
    const obj = {};
    obj[key] = value;
    return obj;
  }

  function randomSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  function newObservationId(capturedAt) {
    // Time-ordered id so a lexical sort matches chronology.
    return 'obs_' + capturedAt.epochMs + '_' + randomSuffix();
  }

  function byCapturedAsc(a, b) {
    const ea = a && a.capturedAt ? a.capturedAt.epochMs : 0;
    const eb = b && b.capturedAt ? b.capturedAt.epochMs : 0;
    return ea - eb;
  }

  function migrateRecord(record) {
    // v1 is the baseline schema; nothing to migrate yet. The hook keeps one
    // tested place to grow on a future bump.
    return record;
  }

  // ---------------------------------------------------------------------------
  // Store factory.
  // ---------------------------------------------------------------------------

  function createStore(config) {
    const cfg = config || {};
    const adapter = createAdapter(cfg.storage);
    const retention = Object.assign({}, DEFAULT_RETENTION, cfg.retention || {});
    const clock = typeof cfg.now === 'function' ? cfg.now : function () { return new Date(); };

    function listForSprint(scope, sprintId) {
      const prefix = observationScanPrefix(scope, sprintId);
      return adapter.get(null).then(function (all) {
        return Object.keys(all)
          .filter(function (key) { return key.indexOf(prefix) === 0; })
          .map(function (key) { return migrateRecord(all[key]); })
          .filter(function (r) { return r && r.kind === 'sprint-observation'; });
      });
    }

    // Append an immutable observation of the sprint state. `input.complete` MUST
    // be set truthfully by the caller: false when cards may be missing due to
    // filters/paging/partial load (reliability requirement, goal section 9).
    function appendObservation(input) {
      return Promise.resolve().then(function () {
        if (!input || typeof input !== 'object') {
          throw new SprintObservationStoreError(ErrorCodes.INVALID_OBSERVATION, 'observation input is required');
        }
        const scope = assertScope(input.scope);
        const sprintId = assertSprintId(input.sprintId);
        const capturedAt = buildCapturedAt(input.capturedAt || clock());
        const items = normalizeItems(input.items);

        const record = {
          kind: 'sprint-observation',
          schemaVersion: SCHEMA_VERSION,
          id: input.id || newObservationId(capturedAt),
          scope: {
            organization: scope.organization,
            project: scope.project,
            team: scope.team,
            board: scope.board,
          },
          sprintId: sprintId,
          capturedAt: capturedAt,
          source: input.source && input.source.origin ? String(input.source.origin) : 'dom-reader',
          // Which baseline this observation is measured against (reference only).
          baselineRef: normalizeBaselineRef(input.baselineRef),
          items: items,
          itemCount: items.length,
          // Completeness / confidence indicators (goal section 2 + 9).
          complete: input.complete === true,
          reliability: isUsable(input.reliability) ? String(input.reliability) : null,
          incompleteReasons: Array.isArray(input.incompleteReasons) ? input.incompleteReasons.slice() : [],
          // Optional derived metrics captured alongside; never required.
          metrics: input.metrics && typeof input.metrics === 'object' ? input.metrics : null,
        };

        const key = observationKey(scope, sprintId, record.id);
        const frozen = deepFreeze(record);
        return adapter
          .set(mapOf(key, frozen))
          .then(function () { return pruneObservations(scope, sprintId); })
          .then(function () { return frozen; });
      });
    }

    // All observations for a sprint, chronological (oldest first) — the natural
    // order for a time series. Out-of-order writes are sorted here (goal
    // section 9: observações fora de ordem cronológica).
    function getObservations(scope, sprintId) {
      return listForSprint(scope, sprintId).then(function (records) {
        return records.sort(byCapturedAsc);
      });
    }

    function getLatestObservation(scope, sprintId) {
      return getObservations(scope, sprintId).then(function (records) {
        return records.length ? records[records.length - 1] : null;
      });
    }

    function getObservationById(scope, sprintId, id) {
      const key = observationKey(scope, sprintId, id);
      return adapter.get(key).then(function (all) {
        const record = all[key];
        if (!record) {
          throw new SprintObservationStoreError(ErrorCodes.NOT_FOUND, 'observation not found: ' + id);
        }
        return migrateRecord(record);
      });
    }

    // Prune the oldest observations beyond the retention cap for this sprint
    // scope. Observations are immutable; pruning only bounds storage growth.
    function pruneObservations(scope, sprintId) {
      const max = retention.maxObservationsPerSprint;
      if (!max || max <= 0) return Promise.resolve();
      return getObservations(scope, sprintId).then(function (records) {
        if (records.length <= max) return;
        const excess = records.length - max;
        const toRemove = records.slice(0, excess).map(function (r) {
          return observationKey(scope, sprintId, r.id);
        });
        return adapter.remove(toRemove);
      });
    }

    return {
      appendObservation: appendObservation,
      getObservations: getObservations,
      getLatestObservation: getLatestObservation,
      getObservationById: getObservationById,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEFAULT_RETENTION: DEFAULT_RETENTION,
    ErrorCodes: ErrorCodes,
    SprintObservationStoreError: SprintObservationStoreError,
    createStore: createStore,
  };
});
