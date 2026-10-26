// src/data/snapshot-store.js
// Snapshot Store: the delivery-tracking persistence layer (PRODUCT_ROADMAP T1.1).
//
// Purpose
// -------
// This module persists two DISTINCT kinds of record on chrome.storage.local:
//
//   1. Snapshot   - an immutable, observed state of a board at a point in time
//                   (which work item sat in which column, who owned it, etc.).
//   2. Commitment - a declared intention from a daily ceremony (where an item is
//                   EXPECTED to move). Commitments are mutable but every change
//                   produces an identifiable revision; history is never lost.
//
// A snapshot is what the board WAS; a commitment is what the team SAID it would
// be. They are deliberately kept apart (see docs/ARCHITECTURE.md 2.1). This
// module only stores and queries data; it never scrapes the DOM and never
// computes WIP. The Daily Commitment UI (T1.2) is intentionally NOT built here.
//
// Design constraints honored:
// - chrome.storage.local via an injectable adapter, so tests use a mock and the
//   module carries zero dependencies.
// - Pure, Chrome-free comparison (`diffStates`) so planning-vs-observed logic is
//   unit-testable in isolation.
// - Isolation: every record key embeds org/project/team/board; data from
//   different scopes can never collide.
// - Immutability: snapshots are frozen; "corrections" are new revisions that
//   preserve the prior record.
// - Reliability: a card missing from a later snapshot is reported as `missing`,
//   never silently treated as "done".
// - Security: only ids, columns, states, assignee display names and timestamps
//   are stored. No tokens, cookies, credentials or raw HTML.
// - Schema versioning with a forward migration hook for future evolution.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script / popup: attaches to window.WIPBoardSnapshotStore.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSnapshotStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Versioning & constants.
  // ---------------------------------------------------------------------------

  // Bump SCHEMA_VERSION whenever the persisted record shape changes, and add a
  // step to MIGRATIONS so old data is upgraded on read.
  const SCHEMA_VERSION = 1;

  // Namespaced key prefixes keep snapshot and commitment records from colliding
  // and make scoped scans cheap with a single getAll + filter.
  const SNAPSHOT_PREFIX = 'wipx:snap:';
  const COMMITMENT_PREFIX = 'wipx:cmt:';

  // Default retention: keep at most this many snapshots per board, pruning the
  // oldest first. Commitments follow the same per-board cap. Configurable.
  const DEFAULT_RETENTION = Object.freeze({
    maxSnapshotsPerBoard: 60,
    maxCommitmentsPerBoard: 60,
    maxAgeDays: null, // null = no age-based pruning
  });

  // Error codes let callers branch on failure cause without string matching.
  const ErrorCodes = Object.freeze({
    INVALID_SCOPE: 'INVALID_SCOPE',
    INVALID_SNAPSHOT: 'INVALID_SNAPSHOT',
    INVALID_COMMITMENT: 'INVALID_COMMITMENT',
    DUPLICATE: 'DUPLICATE',
    NOT_FOUND: 'NOT_FOUND',
    STORAGE_FAILURE: 'STORAGE_FAILURE',
  });

  class SnapshotStoreError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'SnapshotStoreError';
      this.code = code;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage adapter. Wraps the callback-based chrome.storage.local API in
  // promises, and is fully injectable so tests pass a mock. A thrown error or a
  // chrome.runtime.lastError is surfaced as a STORAGE_FAILURE (requirement:
  // storage failures must be observable, never swallowed).
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
      throw new SnapshotStoreError(
        ErrorCodes.STORAGE_FAILURE,
        'chrome.storage.local is unavailable and no storage adapter was injected'
      );
    }

    function lastError() {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError
        ? chrome.runtime.lastError
        : null;
    }

    function get(keys) {
      return new Promise(function (resolve, reject) {
        try {
          const maybePromise = storage.get(keys, function (items) {
            const err = lastError();
            if (err) {
              reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, err.message));
              return;
            }
            resolve(items || {});
          });
          // Support adapters that return a promise instead of using a callback.
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(function (items) {
              resolve(items || {});
            }, function (e) {
              reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
            });
          }
        } catch (e) {
          reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
        }
      });
    }

    function set(obj) {
      return new Promise(function (resolve, reject) {
        try {
          const maybePromise = storage.set(obj, function () {
            const err = lastError();
            if (err) {
              reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, err.message));
              return;
            }
            resolve();
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(function () {
              resolve();
            }, function (e) {
              reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
            });
          }
        } catch (e) {
          reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
        }
      });
    }

    function remove(keys) {
      return new Promise(function (resolve, reject) {
        try {
          const maybePromise = storage.remove(keys, function () {
            const err = lastError();
            if (err) {
              reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, err.message));
              return;
            }
            resolve();
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(function () {
              resolve();
            }, function (e) {
              reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
            });
          }
        } catch (e) {
          reject(new SnapshotStoreError(ErrorCodes.STORAGE_FAILURE, e && e.message));
        }
      });
    }

    return { get: get, set: set, remove: remove };
  }

  // ---------------------------------------------------------------------------
  // Scope & key helpers. A scope isolates records by organization, project, team
  // and board; the derived key prefix guarantees no cross-scope collision.
  // ---------------------------------------------------------------------------

  function normalizeScopePart(value) {
    // Keep keys stable and collision-free: lowercase, trim, and escape the key
    // separator so a value containing "::" cannot forge another scope's key.
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/::/g, ':_:');
  }

  function assertScope(scope) {
    if (!scope || typeof scope !== 'object') {
      throw new SnapshotStoreError(ErrorCodes.INVALID_SCOPE, 'scope is required');
    }
    const required = ['organization', 'project', 'team', 'board'];
    required.forEach(function (field) {
      const value = scope[field];
      if (value == null || String(value).trim() === '') {
        throw new SnapshotStoreError(
          ErrorCodes.INVALID_SCOPE,
          'scope.' + field + ' is required'
        );
      }
    });
    return scope;
  }

  // A stable, opaque id for a scope. Used as the inner key segment.
  function scopeKey(scope) {
    assertScope(scope);
    return [
      normalizeScopePart(scope.organization),
      normalizeScopePart(scope.project),
      normalizeScopePart(scope.team),
      normalizeScopePart(scope.board),
    ].join('::');
  }

  function snapshotKey(scope, id) {
    return SNAPSHOT_PREFIX + scopeKey(scope) + '::' + id;
  }

  function commitmentKey(scope, id) {
    return COMMITMENT_PREFIX + scopeKey(scope) + '::' + id;
  }

  function scopeMatchesKey(key, prefix, scope) {
    return key.indexOf(prefix + scopeKey(scope) + '::') === 0;
  }

  // ---------------------------------------------------------------------------
  // Time helpers. Capture time preserves timezone info so historic comparison is
  // unambiguous (requirement 2). We store both an ISO instant (UTC) and the raw
  // offset minutes, plus a local calendar day used for per-day keys.
  // ---------------------------------------------------------------------------

  function buildCapturedAt(date) {
    const d = date instanceof Date ? date : new Date();
    const offsetMinutes = -d.getTimezoneOffset(); // east-of-UTC is positive
    return {
      iso: d.toISOString(), // instant in UTC
      epochMs: d.getTime(),
      timezoneOffsetMinutes: offsetMinutes,
      localDay: toLocalDay(d),
    };
  }

  function toLocalDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ---------------------------------------------------------------------------
  // Snapshot normalization. Only the whitelisted, non-sensitive item fields are
  // persisted (requirement: security). Unknown/UNAVAILABLE values are dropped so
  // a missing field is never confused with a real value.
  // ---------------------------------------------------------------------------

  function isUsable(value) {
    // Treat the reader's UNAVAILABLE sentinel (a frozen object) and undefined as
    // "not persisted". null is a deliberate "present but empty" and is kept.
    if (value === undefined) return false;
    if (value && typeof value === 'object' && value.__wipFieldState === 'unavailable') {
      return false;
    }
    return true;
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id;
    if (id == null) return null; // only items with a stable id are persisted
    const item = { id: id };
    // startColumn is the column observed at capture; keep it verbatim.
    if (isUsable(raw.column)) item.column = raw.column;
    if (isUsable(raw.columnId)) item.columnId = raw.columnId;
    if (isUsable(raw.state)) item.state = raw.state;
    if (isUsable(raw.assignee)) item.assignee = raw.assignee;
    if (isUsable(raw.type)) item.type = raw.type;
    return item;
  }

  function normalizeItems(items) {
    const out = [];
    const seen = new Set();
    (items || []).forEach(function (raw) {
      const item = normalizeItem(raw);
      if (!item) return;
      // Prevent duplicate ids inside a single snapshot (e.g. swimlane repeats).
      if (seen.has(item.id)) return;
      seen.add(item.id);
      out.push(item);
    });
    return out;
  }

  function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.keys(obj).forEach(function (key) {
        deepFreeze(obj[key]);
      });
      Object.freeze(obj);
    }
    return obj;
  }

  // ---------------------------------------------------------------------------
  // ID generation. Snapshot ids are time-ordered so lexical sort == chronology.
  // A short random suffix prevents collisions within the same millisecond.
  // ---------------------------------------------------------------------------

  function randomSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  function newSnapshotId(capturedAt) {
    return 'snap_' + capturedAt.epochMs + '_' + randomSuffix();
  }

  function newCommitmentId(capturedAt) {
    return 'cmt_' + capturedAt.epochMs + '_' + randomSuffix();
  }

  // ---------------------------------------------------------------------------
  // PURE comparison. No Chrome, no storage. Given two stored states (snapshots or
  // the item list of a commitment), classify every work item. This is the engine
  // behind "planned vs observed" and "observed vs observed" comparisons.
  //
  // Reliability rule (requirement): an item present in `base` but absent from
  // `target` is reported as `missing` — NOT as moved or done. The caller decides
  // whether an incomplete capture should suppress conclusions.
  // ---------------------------------------------------------------------------

  function indexItems(items) {
    const map = new Map();
    (items || []).forEach(function (item) {
      if (item && item.id != null) map.set(item.id, item);
    });
    return map;
  }

  // Compare two item lists. `options.expectedColumnOf(item)` may provide the
  // expected destination for an item (used for planned-vs-observed); when absent
  // the diff is a pure observed-vs-observed column comparison.
  function diffStates(baseItems, targetItems, options) {
    const opts = options || {};
    const base = indexItems(baseItems);
    const target = indexItems(targetItems);

    const added = []; // in target, not in base
    const removed = []; // in base, not in target (missing — never "done")
    const moved = []; // column changed between base and target
    const unchanged = []; // present in both, same column

    base.forEach(function (baseItem, id) {
      const targetItem = target.get(id);
      if (!targetItem) {
        removed.push({ id: id, from: baseItem.column, status: 'missing' });
        return;
      }
      if (columnIdentity(baseItem) !== columnIdentity(targetItem)) {
        moved.push({
          id: id,
          from: baseItem.column,
          to: targetItem.column,
          fromColumnId: baseItem.columnId,
          toColumnId: targetItem.columnId,
        });
      } else {
        unchanged.push({ id: id, column: targetItem.column });
      }
    });

    target.forEach(function (targetItem, id) {
      if (!base.has(id)) {
        added.push({ id: id, column: targetItem.column });
      }
    });

    const result = {
      added: added,
      removed: removed,
      moved: moved,
      unchanged: unchanged,
    };

    // Optional planning classification: compare each base item's observed target
    // column against its expected destination, if the caller supplies one.
    if (typeof opts.expectedColumnOf === 'function') {
      result.plan = classifyPlan(base, target, opts.expectedColumnOf);
    }

    return result;
  }

  // Prefer the stable columnId for identity; fall back to the display name so a
  // board that does not expose column ids still diffs correctly.
  function columnIdentity(item) {
    if (item.columnId != null && item.columnId !== '') return 'id:' + item.columnId;
    return 'name:' + String(item.column == null ? '' : item.column).toLowerCase();
  }

  function sameColumn(a, b) {
    if (a == null || b == null) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  // Planned-vs-observed classification for each committed item:
  //   on-track : observed column equals the expected destination
  //   behind   : still in a non-expected column and not missing
  //   missing  : item not present in the observed target (incomplete capture)
  function classifyPlan(baseMap, targetMap, expectedColumnOf) {
    const onTrack = [];
    const behind = [];
    const missing = [];

    baseMap.forEach(function (baseItem, id) {
      const expected = expectedColumnOf(baseItem);
      if (expected == null || expected === '') return; // no commitment for item
      const observed = targetMap.get(id);
      if (!observed) {
        missing.push({ id: id, expected: expected });
        return;
      }
      if (sameColumn(observed.column, expected)) {
        onTrack.push({ id: id, expected: expected, observed: observed.column });
      } else {
        behind.push({ id: id, expected: expected, observed: observed.column });
      }
    });

    return { onTrack: onTrack, behind: behind, missing: missing };
  }

  // ---------------------------------------------------------------------------
  // Migration. On every read of the meta record we upgrade persisted data from
  // its stored schemaVersion to SCHEMA_VERSION. Each migration is a pure function
  // (record) -> record. Version 1 is the baseline, so there is nothing to do yet;
  // the hook exists so future schema changes have a single, tested seam.
  // ---------------------------------------------------------------------------

  const MIGRATIONS = {
    // Example for the future:
    // 2: function (record) { return record_with_new_field; },
  };

  function migrateRecord(record) {
    if (!record || typeof record !== 'object') return record;
    let current = record;
    let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0;
    while (version < SCHEMA_VERSION) {
      const next = version + 1;
      const step = MIGRATIONS[next];
      current = step ? step(current) : current;
      current = Object.assign({}, current, { schemaVersion: next });
      version = next;
    }
    return current;
  }

  // ---------------------------------------------------------------------------
  // Store factory. Returns the public async API bound to a storage adapter.
  // ---------------------------------------------------------------------------

  function createStore(config) {
    const cfg = config || {};
    const adapter = createAdapter(cfg.storage);
    const retention = Object.assign({}, DEFAULT_RETENTION, cfg.retention || {});
    const clock = typeof cfg.now === 'function' ? cfg.now : function () { return new Date(); };

    // --- internal: list records for a scope by prefix --------------------------

    function listRecords(prefix, scope) {
      return adapter.get(null).then(function (all) {
        return Object.keys(all)
          .filter(function (key) {
            return scopeMatchesKey(key, prefix, scope);
          })
          .map(function (key) {
            return migrateRecord(all[key]);
          });
      });
    }

    // --- snapshots -------------------------------------------------------------

    // Create an immutable snapshot of the observed board state. `input.items` is
    // the board-dom-reader model's `items` array (or any {id, column, ...}[]).
    // `input.complete` MUST be set truthfully by the caller: false when cards may
    // be missing due to filters/paging/partial load (reliability requirement).
    function createSnapshot(input) {
      return Promise.resolve().then(function () {
        if (!input || typeof input !== 'object') {
          throw new SnapshotStoreError(ErrorCodes.INVALID_SNAPSHOT, 'snapshot input is required');
        }
        const scope = assertScope(input.scope);
        const capturedAt = buildCapturedAt(input.capturedAt || clock());
        const items = normalizeItems(input.items);

        const record = {
          kind: 'snapshot',
          schemaVersion: SCHEMA_VERSION,
          id: newSnapshotId(capturedAt),
          scope: {
            organization: scope.organization,
            project: scope.project,
            team: scope.team,
            board: scope.board,
          },
          sprint: input.sprint != null ? input.sprint : null,
          capturedAt: capturedAt,
          source: {
            // Where the data came from (e.g. 'dom-reader', 'api') and whether it
            // was a full capture. Defaults are conservative.
            origin: input.source && input.source.origin ? input.source.origin : 'dom-reader',
            complete: input.complete === true,
          },
          items: items,
          // itemCount is a convenience aggregate for retention/UX; not authority.
          itemCount: items.length,
        };

        const key = snapshotKey(scope, record.id);
        const frozen = deepFreeze(record);
        return adapter
          .set(mapOf(key, frozen))
          .then(function () {
            return pruneSnapshots(scope);
          })
          .then(function () {
            return frozen;
          });
      });
    }

    // All snapshots for a board, newest first.
    function getSnapshots(scope) {
      return listRecords(SNAPSHOT_PREFIX, scope).then(function (records) {
        return records
          .filter(function (r) {
            return r && r.kind === 'snapshot';
          })
          .sort(byCapturedDesc);
      });
    }

    // Snapshots captured on a given local calendar day (yyyy-mm-dd), newest first.
    function getSnapshotsByDate(scope, localDay) {
      return getSnapshots(scope).then(function (records) {
        return records.filter(function (r) {
          return r.capturedAt && r.capturedAt.localDay === localDay;
        });
      });
    }

    // The most recent snapshot for a board, or null when none exists.
    function getLatestSnapshot(scope) {
      return getSnapshots(scope).then(function (records) {
        return records.length ? records[0] : null;
      });
    }

    function getSnapshotById(scope, id) {
      const key = snapshotKey(scope, id);
      return adapter.get(key).then(function (all) {
        const record = all[key];
        if (!record) {
          throw new SnapshotStoreError(ErrorCodes.NOT_FOUND, 'snapshot not found: ' + id);
        }
        return migrateRecord(record);
      });
    }

    // --- commitments -----------------------------------------------------------

    // Persist a planned commitment (the declared daily intent). Distinct from a
    // snapshot: it carries expected destinations. Re-committing the same logical
    // commitment creates a revision rather than a duplicate when `id` is given.
    function saveCommitment(input) {
      return Promise.resolve().then(function () {
        if (!input || typeof input !== 'object') {
          throw new SnapshotStoreError(
            ErrorCodes.INVALID_COMMITMENT,
            'commitment input is required'
          );
        }
        const scope = assertScope(input.scope);
        const capturedAt = buildCapturedAt(input.createdAt || clock());
        const items = normalizeCommitmentItems(input.items);
        if (items.length === 0) {
          throw new SnapshotStoreError(
            ErrorCodes.INVALID_COMMITMENT,
            'commitment requires at least one item with an expected column'
          );
        }

        const record = {
          kind: 'commitment',
          schemaVersion: SCHEMA_VERSION,
          id: input.id || newCommitmentId(capturedAt),
          scope: {
            organization: scope.organization,
            project: scope.project,
            team: scope.team,
            board: scope.board,
          },
          sprint: input.sprint != null ? input.sprint : null,
          // Link to the snapshot the plan was based on, when known.
          baseSnapshotId: input.baseSnapshotId != null ? input.baseSnapshotId : null,
          createdAt: capturedAt,
          items: items,
          revision: 0,
          // Prior states of this commitment, newest kept at the end. Immutable
          // copies that preserve the full planning history (requirement).
          revisions: [],
        };

        const key = commitmentKey(scope, record.id);
        // Prevent accidental overwrite / duplication. A save is for creating a
        // new commitment; if the key already exists (only possible when the
        // caller supplied an explicit id), that is a duplicate and the caller
        // must use reviseCommitment to change an existing plan instead.
        return adapter.get(key).then(function (all) {
          if (all[key]) {
            throw new SnapshotStoreError(ErrorCodes.DUPLICATE, 'commitment id already exists');
          }
          const frozen = deepFreeze(record);
          return adapter
            .set(mapOf(key, frozen))
            .then(function () {
              return pruneCommitments(scope);
            })
            .then(function () {
              return frozen;
            });
        });
      });
    }

    function getCommitments(scope) {
      return listRecords(COMMITMENT_PREFIX, scope).then(function (records) {
        return records
          .filter(function (r) {
            return r && r.kind === 'commitment';
          })
          .sort(function (a, b) {
            return byCreatedDesc(a, b);
          });
      });
    }

    function getCommitmentById(scope, id) {
      const key = commitmentKey(scope, id);
      return adapter.get(key).then(function (all) {
        const record = all[key];
        if (!record) {
          throw new SnapshotStoreError(ErrorCodes.NOT_FOUND, 'commitment not found: ' + id);
        }
        return migrateRecord(record);
      });
    }

    // Record a revision: the current item plan is archived under `revisions` and
    // the new plan replaces `items`. The previous history is preserved so a plan
    // change is always auditable (integrity requirement).
    function reviseCommitment(scope, id, nextItems) {
      return getCommitmentById(scope, id).then(function (existing) {
        const items = normalizeCommitmentItems(nextItems);
        if (items.length === 0) {
          throw new SnapshotStoreError(
            ErrorCodes.INVALID_COMMITMENT,
            'revision requires at least one item with an expected column'
          );
        }
        const capturedAt = buildCapturedAt(clock());
        const archivedRevision = {
          revision: existing.revision,
          items: existing.items,
          supersededAt: capturedAt,
        };
        const next = {
          kind: 'commitment',
          schemaVersion: SCHEMA_VERSION,
          id: existing.id,
          scope: existing.scope,
          sprint: existing.sprint,
          baseSnapshotId: existing.baseSnapshotId,
          createdAt: existing.createdAt,
          updatedAt: capturedAt,
          items: items,
          revision: existing.revision + 1,
          revisions: (existing.revisions || []).concat([archivedRevision]),
        };
        const key = commitmentKey(scope, id);
        const frozen = deepFreeze(next);
        return adapter.set(mapOf(key, frozen)).then(function () {
          return frozen;
        });
      });
    }

    // --- comparison (storage-backed convenience over the pure diffStates) ------

    // Compare two stored states by id. Each ref is { type, id } where type is
    // 'snapshot' or 'commitment'. Returns the pure diff plus the resolved refs.
    function compareStored(scope, baseRef, targetRef, options) {
      return Promise.all([
        resolveStateItems(scope, baseRef),
        resolveStateItems(scope, targetRef),
      ]).then(function (pair) {
        return diffStates(pair[0], pair[1], options);
      });
    }

    function resolveStateItems(scope, ref) {
      if (!ref || typeof ref !== 'object') {
        return Promise.reject(
          new SnapshotStoreError(ErrorCodes.NOT_FOUND, 'a {type,id} ref is required')
        );
      }
      if (ref.type === 'commitment') {
        return getCommitmentById(scope, ref.id).then(function (c) {
          return c.items;
        });
      }
      return getSnapshotById(scope, ref.id).then(function (s) {
        return s.items;
      });
    }

    // --- retention -------------------------------------------------------------

    function pruneSnapshots(scope) {
      return prune(SNAPSHOT_PREFIX, scope, retention.maxSnapshotsPerBoard, byCapturedDesc, function (r) {
        return r.capturedAt && r.capturedAt.epochMs;
      });
    }

    function pruneCommitments(scope) {
      return prune(COMMITMENT_PREFIX, scope, retention.maxCommitmentsPerBoard, byCreatedDesc, function (r) {
        return r.createdAt && r.createdAt.epochMs;
      });
    }

    // Shared pruning: keep the newest `max` per board and drop records older than
    // maxAgeDays. Deleting a record only removes that scope's keys (isolation).
    function prune(prefix, scope, max, sorter, epochOf) {
      return adapter.get(null).then(function (all) {
        const entries = Object.keys(all)
          .filter(function (key) {
            return scopeMatchesKey(key, prefix, scope);
          })
          .map(function (key) {
            return { key: key, record: migrateRecord(all[key]) };
          });

        entries.sort(function (a, b) {
          return sorter(a.record, b.record);
        });

        const toRemove = [];

        // Age-based pruning.
        if (retention.maxAgeDays != null) {
          const cutoff = clock().getTime() - retention.maxAgeDays * 24 * 60 * 60 * 1000;
          entries.forEach(function (entry) {
            const epoch = epochOf(entry.record);
            if (typeof epoch === 'number' && epoch < cutoff) {
              toRemove.push(entry.key);
            }
          });
        }

        // Count-based pruning: keep the newest `max`.
        if (typeof max === 'number' && max >= 0 && entries.length > max) {
          entries.slice(max).forEach(function (entry) {
            if (toRemove.indexOf(entry.key) === -1) toRemove.push(entry.key);
          });
        }

        if (toRemove.length === 0) return { removed: 0 };
        return adapter.remove(toRemove).then(function () {
          return { removed: toRemove.length };
        });
      });
    }

    // Remove history per a caller-supplied policy. `policy.olderThanDay` removes
    // records captured before a yyyy-mm-dd local day; `policy.all` wipes a scope.
    function purge(scope, policy) {
      const p = policy || {};
      return adapter.get(null).then(function (all) {
        const keys = Object.keys(all).filter(function (key) {
          return (
            scopeMatchesKey(key, SNAPSHOT_PREFIX, scope) ||
            scopeMatchesKey(key, COMMITMENT_PREFIX, scope)
          );
        });
        const toRemove = keys.filter(function (key) {
          if (p.all === true) return true;
          if (p.olderThanDay) {
            const record = migrateRecord(all[key]);
            const day = recordLocalDay(record);
            return day != null && day < p.olderThanDay;
          }
          return false;
        });
        if (toRemove.length === 0) return { removed: 0 };
        return adapter.remove(toRemove).then(function () {
          return { removed: toRemove.length };
        });
      });
    }

    return {
      // snapshots
      createSnapshot: createSnapshot,
      getSnapshots: getSnapshots,
      getSnapshotsByDate: getSnapshotsByDate,
      getLatestSnapshot: getLatestSnapshot,
      getSnapshotById: getSnapshotById,
      // commitments
      saveCommitment: saveCommitment,
      getCommitments: getCommitments,
      getCommitmentById: getCommitmentById,
      reviseCommitment: reviseCommitment,
      // comparison
      compareStored: compareStored,
      // retention
      purge: purge,
      pruneSnapshots: pruneSnapshots,
      pruneCommitments: pruneCommitments,
      // config echo (useful for tests/diagnostics)
      retention: retention,
    };
  }

  // Each commitment item carries an expected destination column. startColumn is
  // optional context (where the item was when committed).
  function normalizeCommitmentItems(items) {
    const out = [];
    const seen = new Set();
    (items || []).forEach(function (raw) {
      if (!raw || typeof raw !== 'object' || raw.id == null) return;
      const expected = raw.expectedColumn;
      if (expected == null || String(expected).trim() === '') return;
      if (seen.has(raw.id)) return;
      seen.add(raw.id);
      const item = { id: raw.id, expectedColumn: String(expected) };
      if (raw.startColumn != null) item.startColumn = String(raw.startColumn);
      if (raw.assignee != null) item.assignee = String(raw.assignee);
      out.push(item);
    });
    return out;
  }

  function recordLocalDay(record) {
    if (!record) return null;
    if (record.capturedAt && record.capturedAt.localDay) return record.capturedAt.localDay;
    if (record.createdAt && record.createdAt.localDay) return record.createdAt.localDay;
    return null;
  }

  function byCapturedDesc(a, b) {
    const ea = a.capturedAt ? a.capturedAt.epochMs : 0;
    const eb = b.capturedAt ? b.capturedAt.epochMs : 0;
    return eb - ea;
  }

  function byCreatedDesc(a, b) {
    const ea = a.createdAt ? a.createdAt.epochMs : 0;
    const eb = b.createdAt ? b.createdAt.epochMs : 0;
    return eb - ea;
  }

  function mapOf(key, value) {
    const obj = {};
    obj[key] = value;
    return obj;
  }

  return {
    createStore: createStore,
    // Pure, Chrome-free comparison exposed for direct unit testing and reuse.
    diffStates: diffStates,
    // Helpers exposed for targeted tests / future modules.
    scopeKey: scopeKey,
    buildCapturedAt: buildCapturedAt,
    toLocalDay: toLocalDay,
    migrateRecord: migrateRecord,
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEFAULT_RETENTION: DEFAULT_RETENTION,
    ErrorCodes: ErrorCodes,
    SnapshotStoreError: SnapshotStoreError,
  };
});
