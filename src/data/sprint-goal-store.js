// src/data/sprint-goal-store.js
// Sprint Goal + Baseline persistence (PRODUCT_ROADMAP T2.2, "Objetivo da sprint"
// + "Escopo inicial").
//
// Purpose
// -------
// Persist, on chrome.storage.local, two local records per sprint scope while no
// official source exists:
//
//   1. Goal      - the sprint's main objective, description, success criteria and
//                  priorities, configured MANUALLY by the user. Every change is
//                  archived as a revision so the planning history is preserved
//                  (goal: "Preserve o histórico de alterações desse planejamento").
//
//   2. Baseline  - the immutable initial-scope record produced by
//                  WIPBoardSprintBaseline.createBaseline. Saved ONCE per sprint;
//                  a second save is refused (DUPLICATE) so the baseline cannot
//                  change silently. A deliberate re-baseline is an explicit,
//                  separate operation (replaceBaseline) that archives the prior.
//
// Isolation: every key embeds organization/project/team/board AND the sprint id,
// so goals/baselines from different teams, boards or sprints never collide.
//
// Security: only planning text and ids are stored. No tokens, cookies or
// credentials. (The read-only API never persists a credential; see ado-auth.js.)
//
// This module mirrors the snapshot-store's injectable-adapter design so tests use
// the same mock-chrome-storage helper and the module carries zero dependencies.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script / popup: attaches to window.WIPBoardSprintGoalStore.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSprintGoalStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;

  const GOAL_PREFIX = 'wipx:goal:';
  const BASELINE_PREFIX = 'wipx:base:';

  const ErrorCodes = Object.freeze({
    INVALID_SCOPE: 'INVALID_SCOPE',
    INVALID_SPRINT: 'INVALID_SPRINT',
    INVALID_GOAL: 'INVALID_GOAL',
    INVALID_BASELINE: 'INVALID_BASELINE',
    DUPLICATE: 'DUPLICATE',
    NOT_FOUND: 'NOT_FOUND',
    STORAGE_FAILURE: 'STORAGE_FAILURE',
  });

  class SprintGoalStoreError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'SprintGoalStoreError';
      this.code = code;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage adapter: the same promise wrapper the snapshot store uses, fully
  // injectable so tests pass the shared mock. Failures surface as STORAGE_FAILURE
  // (never swallowed).
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
      throw new SprintGoalStoreError(
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
              reject(new SprintGoalStoreError(ErrorCodes.STORAGE_FAILURE, err.message));
              return;
            }
            resolve(result || {});
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(function (result) { resolve(result || {}); },
              function (e) { reject(new SprintGoalStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message)); });
          }
        } catch (e) {
          reject(new SprintGoalStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
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
  // the same board are isolated.
  // ---------------------------------------------------------------------------

  function normalizeScopePart(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/::/g, ':_:');
  }

  function assertScope(scope) {
    if (!scope || typeof scope !== 'object') {
      throw new SprintGoalStoreError(ErrorCodes.INVALID_SCOPE, 'scope is required');
    }
    ['organization', 'project', 'team', 'board'].forEach(function (field) {
      const value = scope[field];
      if (value == null || String(value).trim() === '') {
        throw new SprintGoalStoreError(ErrorCodes.INVALID_SCOPE, 'scope.' + field + ' is required');
      }
    });
    return scope;
  }

  function assertSprintId(sprintId) {
    if (sprintId == null || String(sprintId).trim() === '') {
      throw new SprintGoalStoreError(ErrorCodes.INVALID_SPRINT, 'sprintId is required');
    }
    return String(sprintId);
  }

  function scopeKey(scope, sprintId) {
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

  function goalKey(scope, sprintId) { return GOAL_PREFIX + scopeKey(scope, sprintId); }
  function baselineKey(scope, sprintId) { return BASELINE_PREFIX + scopeKey(scope, sprintId); }

  // ---------------------------------------------------------------------------
  // Time + normalization helpers.
  // ---------------------------------------------------------------------------

  function buildStamp(date) {
    const d = date instanceof Date ? date : new Date();
    return { iso: d.toISOString(), epochMs: d.getTime() };
  }

  function cleanString(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function cleanList(value) {
    if (Array.isArray(value)) {
      return value.map(cleanString).filter(function (s) { return s !== ''; });
    }
    if (value == null) return [];
    // Accept a newline- or semicolon-separated string too (textarea input).
    return String(value)
      .split(/[\n;]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });
  }

  // Normalize a goal payload into the stored shape. All fields are optional
  // except that at least the objective must be non-empty (a goal with nothing in
  // it is rejected so the user cannot persist an empty planning record).
  function normalizeGoal(input) {
    const i = input && typeof input === 'object' ? input : {};
    const objective = cleanString(i.objective);
    const description = cleanString(i.description);
    const successCriteria = cleanList(i.successCriteria);
    const priorities = cleanList(i.priorities);
    if (objective === '' && description === '' && successCriteria.length === 0 && priorities.length === 0) {
      throw new SprintGoalStoreError(
        ErrorCodes.INVALID_GOAL,
        'a goal requires at least an objective, description, criteria or priorities'
      );
    }
    return {
      objective: objective,
      description: description,
      successCriteria: successCriteria,
      priorities: priorities,
    };
  }

  function goalsEqual(a, b) {
    if (!a || !b) return false;
    return a.objective === b.objective &&
      a.description === b.description &&
      JSON.stringify(a.successCriteria) === JSON.stringify(b.successCriteria) &&
      JSON.stringify(a.priorities) === JSON.stringify(b.priorities);
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

  // ---------------------------------------------------------------------------
  // Migration hook (single seam for future schema changes).
  // ---------------------------------------------------------------------------

  function migrateRecord(record) {
    // v1 is the baseline; nothing to migrate yet. The hook keeps the contract so
    // a future bump has one tested place to grow.
    return record;
  }

  // ---------------------------------------------------------------------------
  // Store factory.
  // ---------------------------------------------------------------------------

  function createStore(config) {
    const cfg = config || {};
    const adapter = createAdapter(cfg.storage);
    const clock = typeof cfg.now === 'function' ? cfg.now : function () { return new Date(); };

    // --- goals ---------------------------------------------------------------

    // Save or UPDATE the goal for a sprint scope. The first save creates
    // revision 0. A subsequent save that actually changes the content archives
    // the prior content under `revisions` and bumps the revision, preserving the
    // full planning history. A save identical to the current content is a no-op
    // that returns the existing record (no empty revision is created).
    function saveGoal(scope, sprintId, goalInput, meta) {
      return Promise.resolve().then(function () {
        assertScope(scope);
        assertSprintId(sprintId);
        const goal = normalizeGoal(goalInput);
        const key = goalKey(scope, sprintId);
        const m = meta && typeof meta === 'object' ? meta : {};

        return adapter.get(key).then(function (all) {
          const existing = all[key] ? migrateRecord(all[key]) : null;
          const stamp = buildStamp(clock());

          if (existing && goalsEqual(existing.goal, goal)) {
            return existing; // identical content; do not churn history
          }

          if (!existing) {
            const record = {
              kind: 'sprint-goal',
              schemaVersion: SCHEMA_VERSION,
              scope: pickScope(scope),
              sprintId: String(sprintId),
              goal: goal,
              revision: 0,
              revisions: [],
              createdAt: stamp,
              updatedAt: stamp,
              author: cleanString(m.author) || null,
            };
            const frozen = deepFreeze(record);
            return adapter.set(mapOf(key, frozen)).then(function () { return frozen; });
          }

          // Archive the previous content and bump the revision.
          const archived = {
            revision: existing.revision,
            goal: existing.goal,
            supersededAt: stamp,
            author: existing.author || null,
          };
          const next = {
            kind: 'sprint-goal',
            schemaVersion: SCHEMA_VERSION,
            scope: existing.scope,
            sprintId: existing.sprintId,
            goal: goal,
            revision: existing.revision + 1,
            revisions: (existing.revisions || []).concat([archived]),
            createdAt: existing.createdAt,
            updatedAt: stamp,
            author: cleanString(m.author) || existing.author || null,
          };
          const frozen = deepFreeze(next);
          return adapter.set(mapOf(key, frozen)).then(function () { return frozen; });
        });
      });
    }

    function getGoal(scope, sprintId) {
      return Promise.resolve().then(function () {
        const key = goalKey(scope, sprintId);
        return adapter.get(key).then(function (all) {
          return all[key] ? migrateRecord(all[key]) : null;
        });
      });
    }

    // --- baseline ------------------------------------------------------------

    // Persist the initial-scope baseline ONCE per sprint scope. A second save is
    // refused with DUPLICATE so the baseline cannot change silently with card
    // movement (goal requirement). `baseline` is the frozen record produced by
    // WIPBoardSprintBaseline.createBaseline.
    function saveBaseline(scope, sprintId, baseline) {
      return Promise.resolve().then(function () {
        assertScope(scope);
        assertSprintId(sprintId);
        if (!baseline || typeof baseline !== 'object' || !Array.isArray(baseline.plannedIds)) {
          throw new SprintGoalStoreError(ErrorCodes.INVALID_BASELINE, 'a baseline record is required');
        }
        const key = baselineKey(scope, sprintId);
        return adapter.get(key).then(function (all) {
          if (all[key]) {
            throw new SprintGoalStoreError(
              ErrorCodes.DUPLICATE,
              'a baseline already exists for this sprint; use replaceBaseline to re-baseline explicitly'
            );
          }
          const stamp = buildStamp(clock());
          const record = {
            kind: 'sprint-baseline-record',
            schemaVersion: SCHEMA_VERSION,
            scope: pickScope(scope),
            sprintId: String(sprintId),
            baseline: baseline,
            revision: 0,
            previous: [],
            savedAt: stamp,
          };
          const frozen = deepFreeze(record);
          return adapter.set(mapOf(key, frozen)).then(function () { return frozen; });
        });
      });
    }

    function getBaseline(scope, sprintId) {
      return Promise.resolve().then(function () {
        const key = baselineKey(scope, sprintId);
        return adapter.get(key).then(function (all) {
          return all[key] ? migrateRecord(all[key]) : null;
        });
      });
    }

    // Explicit, deliberate re-baseline. The CURRENT baseline is archived under
    // `previous` and the new one becomes authoritative. This is the ONLY way the
    // baseline changes, and it is never triggered by card movement.
    function replaceBaseline(scope, sprintId, baseline) {
      return Promise.resolve().then(function () {
        assertScope(scope);
        assertSprintId(sprintId);
        if (!baseline || typeof baseline !== 'object' || !Array.isArray(baseline.plannedIds)) {
          throw new SprintGoalStoreError(ErrorCodes.INVALID_BASELINE, 'a baseline record is required');
        }
        const key = baselineKey(scope, sprintId);
        return adapter.get(key).then(function (all) {
          const existing = all[key] ? migrateRecord(all[key]) : null;
          const stamp = buildStamp(clock());
          if (!existing) {
            // No prior baseline: behave like a first save.
            return saveBaseline(scope, sprintId, baseline);
          }
          const archived = {
            revision: existing.revision,
            baseline: existing.baseline,
            supersededAt: stamp,
          };
          const record = {
            kind: 'sprint-baseline-record',
            schemaVersion: SCHEMA_VERSION,
            scope: existing.scope,
            sprintId: existing.sprintId,
            baseline: baseline,
            revision: existing.revision + 1,
            previous: (existing.previous || []).concat([archived]),
            savedAt: stamp,
          };
          const frozen = deepFreeze(record);
          return adapter.set(mapOf(key, frozen)).then(function () { return frozen; });
        });
      });
    }

    return {
      saveGoal: saveGoal,
      getGoal: getGoal,
      saveBaseline: saveBaseline,
      getBaseline: getBaseline,
      replaceBaseline: replaceBaseline,
    };
  }

  function pickScope(scope) {
    return {
      organization: scope.organization,
      project: scope.project,
      team: scope.team,
      board: scope.board,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    ErrorCodes: ErrorCodes,
    SprintGoalStoreError: SprintGoalStoreError,
    normalizeGoal: normalizeGoal,
    goalsEqual: goalsEqual,
    createStore: createStore,
  };
});
