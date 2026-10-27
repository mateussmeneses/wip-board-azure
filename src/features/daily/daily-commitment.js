// src/data/daily-commitment.js
// Daily Commitment: the pure engine that turns a captured snapshot into a
// per-item delivery commitment and then compares the PLAN (where each work item
// was expected to move by the next daily) against what ACTUALLY happened
// (a later snapshot or the current board state). Roadmap T1.3.
//
// Purpose
// -------
// A snapshot (T1.2) says where every item SAT. A commitment says where the team
// SAID each item would move to by the next daily ceremony. This module:
//
//   1. buildCommitmentItems(baseSnapshot, expectations)
//        - derives, per work item, its startColumn (from the base snapshot) and
//          its expectedColumn (the planned destination the user declared).
//          Produces the exact { id, startColumn, expectedColumn, ... } shape the
//          WIPBoardSnapshotStore.saveCommitment / reviseCommitment APIs expect.
//          No new store is created: this only shapes the input for the existing
//          commitment persistence (versioned commitments already supported).
//
//   2. compareCommitment(commitment, realizedState, options)
//        - classifies every committed item against the realized state:
//            reached : the item is in its expected column
//            behind  : still short of the expected column (did not get there)
//            beyond  : moved past the expected column (over-delivered)
//            missing : the item is no longer on the board (never "done")
//          Items WITHOUT a commitment are ignored (never compared).
//          "behind" vs "beyond" uses the flow ORDER of columns, derived from the
//          realized state's column structure (or an explicit order). When order
//          cannot be resolved, the result is the conservative "off-track" so a
//          wrong direction is never asserted.
//
// This module is deliberately Chrome-free and DOM-free (same discipline as
// snapshot-capture.js and the store's diffStates): all classification is a pure
// function of its inputs, so it is fully unit-testable without a browser. It
// never mutates its inputs and never touches a work item in Azure DevOps.
//
// Isolation: comparison operates only on the two states handed to it. The caller
// resolves both states from the SAME board scope via WIPBoardSnapshotStore, so
// commitments and snapshots from different boards are never mixed here.
//
// WIP vs delivery: nothing in this file reads or produces a WIP number. The
// commitment hit-rate is a DELIVERY metric, kept separate from WIP by design.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardDailyCommitment.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardDailyCommitment = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Per-item comparison verdicts. Reported, never silently assumed.
  const Status = Object.freeze({
    REACHED: 'reached', // item is in the expected column
    BEHIND: 'behind', // short of the expected column (flow order known)
    BEYOND: 'beyond', // past the expected column (flow order known)
    OFF_TRACK: 'off-track', // not in expected column, direction unknown
    MISSING: 'missing', // item no longer present in the realized state
  });

  // ---------------------------------------------------------------------------
  // Column-name normalization. Matching a planned column to a realized column
  // must tolerate accents/casing/whitespace the same way the WIP core does,
  // without importing it (keeps this module standalone and testable with plain
  // objects). This is intentionally a local, conservative normalizer.
  // ---------------------------------------------------------------------------

  function normalizeColumnName(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function sameColumn(a, b) {
    const na = normalizeColumnName(a);
    const nb = normalizeColumnName(b);
    if (na === '' || nb === '') return false;
    return na === nb;
  }

  function isUnavailable(value) {
    return !!(value && typeof value === 'object' && value.__wipFieldState === 'unavailable');
  }

  function isUsable(value) {
    return value !== undefined && value !== null && !isUnavailable(value);
  }

  // ---------------------------------------------------------------------------
  // Column order resolution. "behind" vs "beyond" only has meaning along the flow
  // of the board. We build a name -> order index from, in priority:
  //   1. options.columnOrder: an explicit array of column names (or {name,order}).
  //   2. the realized state's `columns` array (snapshot store shape).
  // Returns a Map keyed by NORMALIZED name. When a column is absent from the
  // order, its position is unknown and the comparison falls back to off-track.
  // ---------------------------------------------------------------------------

  function buildColumnOrderIndex(realizedState, options) {
    const opts = options || {};
    const index = new Map();

    function addEntry(name, order) {
      const key = normalizeColumnName(name);
      if (key === '') return;
      if (!index.has(key)) index.set(key, order);
    }

    // 1. Explicit order wins.
    if (Array.isArray(opts.columnOrder) && opts.columnOrder.length > 0) {
      opts.columnOrder.forEach(function (entry, i) {
        if (entry && typeof entry === 'object') {
          addEntry(entry.name, typeof entry.order === 'number' ? entry.order : i);
        } else {
          addEntry(entry, i);
        }
      });
      return index;
    }

    // 2. Derive from the realized state's column structure.
    const columns = realizedState && Array.isArray(realizedState.columns) ? realizedState.columns : [];
    columns.forEach(function (col, i) {
      if (!col || typeof col !== 'object') return;
      addEntry(col.name, typeof col.order === 'number' ? col.order : i);
    });
    return index;
  }

  function orderOf(index, columnName) {
    const key = normalizeColumnName(columnName);
    return index.has(key) ? index.get(key) : null;
  }

  // ---------------------------------------------------------------------------
  // Build commitment items from a base snapshot + a map of expected columns.
  //
  //   baseSnapshot : a stored snapshot (or any { items: [{ id, column, ... }] }).
  //   expectations : either
  //                    - a plain object/Map keyed by item id -> expectedColumn,
  //                    - or an array of { id, expectedColumn }.
  //
  // For each item that both exists in the base snapshot AND has a non-empty
  // expected column, we emit { id, startColumn, expectedColumn, assignee? }.
  // Items in the expectations that are NOT in the base snapshot are reported
  // under `unknownIds` so the caller can surface them (a commitment on an item
  // not currently on the board is suspicious, never silently dropped).
  //
  // The returned `items` array is exactly what WIPBoardSnapshotStore.saveCommitment
  // / reviseCommitment expect (they filter by a present `expectedColumn`).
  // ---------------------------------------------------------------------------

  function buildCommitmentItems(baseSnapshot, expectations) {
    const base = baseSnapshot && typeof baseSnapshot === 'object' ? baseSnapshot : {};
    const baseItems = Array.isArray(base.items) ? base.items : [];

    const expMap = toExpectationMap(expectations);

    const byId = new Map();
    baseItems.forEach(function (item) {
      if (item && item.id != null && !byId.has(item.id)) byId.set(item.id, item);
    });

    const items = [];
    const unknownIds = [];

    expMap.forEach(function (expectedColumn, id) {
      if (expectedColumn == null || String(expectedColumn).trim() === '') return;
      const baseItem = byId.get(id);
      if (!baseItem) {
        unknownIds.push(id);
        return;
      }
      const entry = {
        id: id,
        expectedColumn: String(expectedColumn),
      };
      if (isUsable(baseItem.column)) entry.startColumn = String(baseItem.column);
      if (isUsable(baseItem.assignee)) entry.assignee = String(baseItem.assignee);
      items.push(entry);
    });

    return { items: items, unknownIds: unknownIds };
  }

  // Normalize the many allowed expectation inputs into a Map(id -> expectedColumn).
  function toExpectationMap(expectations) {
    const map = new Map();
    if (!expectations) return map;

    if (expectations instanceof Map) {
      expectations.forEach(function (value, key) {
        map.set(coerceId(key), value);
      });
      return map;
    }

    if (Array.isArray(expectations)) {
      expectations.forEach(function (entry) {
        if (!entry || typeof entry !== 'object' || entry.id == null) return;
        map.set(entry.id, entry.expectedColumn);
      });
      return map;
    }

    if (typeof expectations === 'object') {
      Object.keys(expectations).forEach(function (key) {
        map.set(coerceId(key), expectations[key]);
      });
    }
    return map;
  }

  // Object keys are strings; snapshot ids are commonly numbers. Coerce a purely
  // numeric key back to a number so it matches the snapshot item id type.
  function coerceId(key) {
    if (typeof key === 'number') return key;
    const str = String(key);
    if (/^-?\d+$/.test(str)) return Number(str);
    return str;
  }

  // ---------------------------------------------------------------------------
  // Compare a commitment against a realized state.
  //
  //   commitment    : a stored commitment (or { items: [{ id, startColumn,
  //                   expectedColumn, ... }] }).
  //   realizedState : a later snapshot or the current board capture
  //                   ({ items: [{ id, column, ... }], columns?: [...] }).
  //   options       : { columnOrder?: (string|{name,order})[] }
  //
  // Returns:
  //   {
  //     results: [{ id, startColumn, expectedColumn, actualColumn, status }],
  //     summary: { reached, behind, beyond, offTrack, missing, committed },
  //   }
  //
  // Items without an expected column are not part of the commitment and never
  // appear in the results (requirement: no commitment => not compared).
  // ---------------------------------------------------------------------------

  function compareCommitment(commitment, realizedState, options) {
    const commitmentItems = commitment && Array.isArray(commitment.items) ? commitment.items : [];
    const realized = realizedState && typeof realizedState === 'object' ? realizedState : {};
    const realizedItems = Array.isArray(realized.items) ? realized.items : [];

    const realizedById = new Map();
    realizedItems.forEach(function (item) {
      if (item && item.id != null && !realizedById.has(item.id)) realizedById.set(item.id, item);
    });

    const orderIndex = buildColumnOrderIndex(realized, options);

    const results = [];
    const summary = { reached: 0, behind: 0, beyond: 0, offTrack: 0, missing: 0, committed: 0 };

    commitmentItems.forEach(function (committed) {
      if (!committed || committed.id == null) return;
      const expected = committed.expectedColumn;
      if (expected == null || String(expected).trim() === '') return; // not committed

      summary.committed += 1;

      const realizedItem = realizedById.get(committed.id);
      const entry = {
        id: committed.id,
        startColumn: committed.startColumn != null ? committed.startColumn : null,
        expectedColumn: String(expected),
        actualColumn: null,
        status: Status.MISSING,
      };

      if (!realizedItem) {
        // The item vanished from the board. Reported as missing, never inferred
        // as delivered (reliability rule shared with the store's diffStates).
        summary.missing += 1;
        results.push(entry);
        return;
      }

      entry.actualColumn = isUsable(realizedItem.column) ? realizedItem.column : null;

      if (sameColumn(entry.actualColumn, expected)) {
        entry.status = Status.REACHED;
        summary.reached += 1;
        results.push(entry);
        return;
      }

      // Not in the expected column: decide behind vs beyond using flow order.
      const expectedOrder = orderOf(orderIndex, expected);
      const actualOrder = orderOf(orderIndex, entry.actualColumn);

      if (expectedOrder == null || actualOrder == null) {
        // Direction cannot be proven; stay conservative rather than guess.
        entry.status = Status.OFF_TRACK;
        summary.offTrack += 1;
      } else if (actualOrder < expectedOrder) {
        entry.status = Status.BEHIND;
        summary.behind += 1;
      } else {
        entry.status = Status.BEYOND;
        summary.beyond += 1;
      }
      results.push(entry);
    });

    return { results: results, summary: summary };
  }

  return {
    Status: Status,
    normalizeColumnName: normalizeColumnName,
    sameColumn: sameColumn,
    buildCommitmentItems: buildCommitmentItems,
    compareCommitment: compareCommitment,
  };
});
