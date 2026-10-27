// src/data/projected-board.js
// Projected Board: the pure engine that simulates the EXPECTED end-of-day board
// state from a captured snapshot (the baseline) plus a saved commitment (the
// declared destinations). Roadmap T1.5.
//
// Purpose
// -------
// A snapshot (T1.2) says where every work item SAT when it was captured. A
// commitment (T1.3/T1.4) says where the team SAID each committed item would move
// by the next daily. This module answers a single question, visually:
//
//   "If every commitment is honored, how should the board look at end of day?"
//
// It takes the snapshot as the authoritative baseline, applies ONLY the explicit,
// valid destination moves from the commitment, and returns a projected board:
// every column with the items it should hold, the initial vs projected count per
// column, the per-column variation, and the exact list of planned moves (with
// their origin column). Uncommitted items stay where the snapshot put them.
//
// It is a SIMULATION. It never mutates its inputs, never touches the DOM, never
// talks to Chrome, and never changes a work item in Azure DevOps. The caller owns
// presentation; this module owns the math.
//
// Hard rules honored (from the task):
//   - Baseline is the SELECTED snapshot; destinations come from the matching
//     commitment. The current live board is NOT used to invent items.
//   - Only items with an explicit, valid destination column move. A destination
//     that does not exist among the board columns is reported as invalid and the
//     item stays in its original column (never dropped, never guessed).
//   - A destination equal to the origin column is a no-op (not counted as a move).
//   - Stable ids are preserved; an item can never appear in two columns at once.
//   - Columns come from the REAL board data (snapshot/commitment/explicit order),
//     never hardcoded (no "Approved"/"HO"/"Closed" literals here).
//   - A committed id that is absent from the baseline snapshot is reported under
//     `unknownCommittedIds` (reliability: never silently materialized).
//   - An incomplete baseline snapshot is surfaced via `reliability`, never hidden.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardProjectedBoard.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardProjectedBoard = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The reader marks unreadable fields with this frozen sentinel. Mirror the
  // check locally so this module stays standalone and testable with plain objects.
  function isUnavailable(value) {
    return !!(value && typeof value === 'object' && value.__wipFieldState === 'unavailable');
  }

  function isUsable(value) {
    return value !== undefined && value !== null && !isUnavailable(value);
  }

  function asText(value) {
    return isUsable(value) ? String(value) : null;
  }

  // Column-name normalization. Matching a planned destination to a real column
  // must tolerate accents/casing/whitespace the same way the sibling modules do,
  // without importing them (keeps this engine standalone). Conservative on empty.
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

  function itemsOf(source) {
    return source && Array.isArray(source.items) ? source.items : [];
  }

  function columnsOf(source) {
    return source && Array.isArray(source.columns) ? source.columns : [];
  }

  // ---------------------------------------------------------------------------
  // Resolve the ordered list of board columns. Source priority:
  //   1. options.columns : explicit array of names or { name, order, ... }.
  //   2. the baseSnapshot's columns structure (store shape).
  //   3. the commitment's columns structure, if it carries one.
  // Columns are de-duplicated by normalized name and sorted by order. Returns
  // [{ id, name, order, isDoneColumn }]. When no column structure is available
  // the engine later falls back to deriving columns from the item columns.
  // ---------------------------------------------------------------------------

  function resolveColumns(baseSnapshot, commitment, options) {
    const opts = options || {};
    let source = [];
    if (Array.isArray(opts.columns) && opts.columns.length) {
      source = opts.columns;
    } else if (columnsOf(baseSnapshot).length) {
      source = columnsOf(baseSnapshot);
    } else if (columnsOf(commitment).length) {
      source = columnsOf(commitment);
    }

    const out = [];
    const seen = new Set();
    source.forEach(function (col, index) {
      let name;
      let id = null;
      let order = index;
      let isDone = false;
      if (col && typeof col === 'object') {
        name = asText(col.name);
        id = isUsable(col.id) ? col.id : null;
        order = typeof col.order === 'number' ? col.order : index;
        isDone = col.isDoneColumn === true;
      } else {
        name = asText(col);
      }
      if (name == null || name.trim() === '') return;
      const key = normalizeColumnName(name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ id: id, name: name, order: order, isDoneColumn: isDone });
    });
    out.sort(function (a, b) {
      return a.order - b.order;
    });
    return out;
  }

  // When no column structure is supplied, derive the column list from the columns
  // the snapshot items actually sit in, preserving first-seen order. This keeps
  // the engine usable for minimal inputs while still never hardcoding names.
  function deriveColumnsFromItems(baseItems) {
    const out = [];
    const seen = new Set();
    baseItems.forEach(function (item) {
      const name = asText(item && item.column);
      if (name == null || name.trim() === '') return;
      const key = normalizeColumnName(name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ id: null, name: name, order: out.length, isDoneColumn: false });
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Index a commitment's items by stable id -> { expectedColumn, startColumn }.
  // Only the FIRST occurrence of an id wins (duplicate commitment ids collapse);
  // an item without a usable expectedColumn carries a null destination so it is
  // treated as "no explicit destination" downstream.
  // ---------------------------------------------------------------------------

  function indexCommitment(commitment) {
    const map = new Map();
    itemsOf(commitment).forEach(function (entry) {
      if (!entry || entry.id == null) return;
      if (map.has(entry.id)) return; // collapse duplicate committed ids
      map.set(entry.id, {
        expectedColumn: asText(entry.expectedColumn),
        startColumn: asText(entry.startColumn),
      });
    });
    return map;
  }

  // ---------------------------------------------------------------------------
  // project(baseSnapshot, commitment, options) -> projection
  //
  // Returns a frozen-free, newly-allocated object (inputs are never mutated):
  //   {
  //     columns: [{
  //       id, name, order, isDoneColumn,
  //       initialCount, projectedCount, delta,
  //       initialIds: [id...],      // snapshot occupants
  //       projectedIds: [id...],    // occupants after the simulation
  //       items: [{ id, movedIn, movedOut, fromColumn, toColumn }]
  //     }],
  //     moves: [{ id, fromColumn, toColumn }],       // valid, effective moves
  //     noOps: [{ id, column }],                     // destination == origin
  //     invalidDestinations: [{ id, fromColumn, requested }], // unknown column
  //     unknownCommittedIds: [id...],                // committed, not in baseline
  //     summary: {
  //       snapshotItemCount, committedCount, plannedMoveCount,
  //       noOpCount, invalidDestinationCount, unknownCommittedCount
  //     },
  //     reliability: { complete, reasons: [...] },
  //   }
  //
  // Placement rules:
  //   - Every baseline item starts in its snapshot column.
  //   - A committed item with a VALID destination (a real board column) that
  //     DIFFERS from its origin is moved there (one move, origin tracked).
  //   - A committed item whose destination equals its origin is a no-op.
  //   - A committed item whose destination is not a real column is left in place
  //     and recorded under invalidDestinations.
  //   - An item whose origin column is not among the resolved columns is placed
  //     into an appended "origin" column so it is never lost from the totals.
  // ---------------------------------------------------------------------------

  function project(baseSnapshot, commitment, options) {
    const opts = options || {};
    const baseItems = itemsOf(baseSnapshot);
    const committedById = indexCommitment(commitment);

    // Resolve the ordered column list; fall back to item-derived columns.
    let columns = resolveColumns(baseSnapshot, commitment, opts);
    if (!columns.length) {
      columns = deriveColumnsFromItems(baseItems);
    }

    // Lookup: normalized column name -> working column bucket.
    const bucketByName = new Map();
    const buckets = columns.map(function (col) {
      const bucket = {
        id: col.id,
        name: col.name,
        order: col.order,
        isDoneColumn: col.isDoneColumn,
        initialIds: [],
        projectedIds: [],
        moveMeta: new Map(), // id -> { movedIn, movedOut, fromColumn, toColumn }
      };
      bucketByName.set(normalizeColumnName(col.name), bucket);
      return bucket;
    });

    // A bucket for items whose snapshot column is not among the resolved columns.
    // This can happen with a partial column structure; we never drop the item.
    let orphanBucket = null;
    function ensureOrphanBucket(name) {
      if (orphanBucket) return orphanBucket;
      orphanBucket = {
        id: null,
        name: name || '(unknown column)',
        order: buckets.length,
        isDoneColumn: false,
        initialIds: [],
        projectedIds: [],
        moveMeta: new Map(),
        isOrphan: true,
      };
      buckets.push(orphanBucket);
      return orphanBucket;
    }

    const moves = [];
    const noOps = [];
    const invalidDestinations = [];
    const seenIds = new Set();

    // 1. Place every baseline item (snapshot is authoritative), de-duplicating ids.
    baseItems.forEach(function (raw) {
      if (!raw || raw.id == null) return;
      if (seenIds.has(raw.id)) return; // never place the same id twice
      seenIds.add(raw.id);

      const id = raw.id;
      const originName = asText(raw.column);
      const originKey = normalizeColumnName(originName);
      let originBucket = originKey !== '' ? bucketByName.get(originKey) : null;
      if (!originBucket) {
        originBucket = ensureOrphanBucket(originName);
      }
      originBucket.initialIds.push(id);

      // Decide the projected placement for this item.
      const plan = committedById.get(id);
      const destName = plan ? plan.expectedColumn : null;

      if (destName == null || destName.trim() === '') {
        // No explicit destination: the item stays in its origin column.
        originBucket.projectedIds.push(id);
        return;
      }

      if (sameColumn(destName, originName)) {
        // Destination equals origin: a no-op, not a planned move.
        noOps.push({ id: id, column: originBucket.name });
        originBucket.projectedIds.push(id);
        return;
      }

      const destBucket = bucketByName.get(normalizeColumnName(destName));
      if (!destBucket) {
        // Destination is not a real board column: invalid, keep the item in place.
        invalidDestinations.push({
          id: id,
          fromColumn: originBucket.name,
          requested: destName,
        });
        originBucket.projectedIds.push(id);
        return;
      }

      // Valid, effective move: remove from origin's projected set, add to dest.
      destBucket.projectedIds.push(id);
      moves.push({ id: id, fromColumn: originBucket.name, toColumn: destBucket.name });
      originBucket.moveMeta.set(id, {
        movedIn: false,
        movedOut: true,
        fromColumn: originBucket.name,
        toColumn: destBucket.name,
      });
      destBucket.moveMeta.set(id, {
        movedIn: true,
        movedOut: false,
        fromColumn: originBucket.name,
        toColumn: destBucket.name,
      });
    });

    // 2. Report committed ids that are not present on the baseline snapshot. They
    //    are never materialized into a column (reliability rule).
    const unknownCommittedIds = [];
    committedById.forEach(function (_plan, id) {
      if (!seenIds.has(id)) unknownCommittedIds.push(id);
    });

    // 3. Shape the public columns with counts, deltas and per-item move metadata.
    const outColumns = buckets.map(function (bucket) {
      const initialCount = bucket.initialIds.length;
      const projectedCount = bucket.projectedIds.length;
      const items = bucket.projectedIds.map(function (id) {
        const meta = bucket.moveMeta.get(id) || null;
        return {
          id: id,
          movedIn: meta ? meta.movedIn === true : false,
          movedOut: false, // an occupant of this column did not move OUT of it
          fromColumn: meta && meta.movedIn ? meta.fromColumn : null,
          toColumn: meta && meta.movedIn ? meta.toColumn : null,
        };
      });
      const column = {
        name: bucket.name,
        order: bucket.order,
        isDoneColumn: bucket.isDoneColumn === true,
        initialCount: initialCount,
        projectedCount: projectedCount,
        delta: projectedCount - initialCount,
        initialIds: bucket.initialIds.slice(),
        projectedIds: bucket.projectedIds.slice(),
        items: items,
      };
      if (bucket.id != null) column.id = bucket.id;
      if (bucket.isOrphan) column.isOrphan = true;
      return column;
    });

    const summary = {
      snapshotItemCount: seenIds.size,
      committedCount: committedById.size,
      plannedMoveCount: moves.length,
      noOpCount: noOps.length,
      invalidDestinationCount: invalidDestinations.length,
      unknownCommittedCount: unknownCommittedIds.length,
    };

    return {
      columns: outColumns,
      moves: moves,
      noOps: noOps,
      invalidDestinations: invalidDestinations,
      unknownCommittedIds: unknownCommittedIds,
      summary: summary,
      reliability: assessReliability(baseSnapshot, unknownCommittedIds, invalidDestinations),
    };
  }

  // ---------------------------------------------------------------------------
  // Reliability verdict. A projection built on an incomplete snapshot, or that
  // could not honor some committed items, is flagged so the UI can warn instead
  // of presenting a false "end of day" certainty. Never throws; conservative.
  // ---------------------------------------------------------------------------

  function assessReliability(baseSnapshot, unknownCommittedIds, invalidDestinations) {
    const reasons = [];
    const source = baseSnapshot && baseSnapshot.source;
    // The snapshot store records source.complete truthfully at capture time.
    if (source && source.complete === false) reasons.push('INCOMPLETE_SNAPSHOT');
    if (unknownCommittedIds && unknownCommittedIds.length) reasons.push('UNKNOWN_COMMITTED_IDS');
    if (invalidDestinations && invalidDestinations.length) reasons.push('INVALID_DESTINATIONS');
    return { complete: reasons.length === 0, reasons: reasons };
  }

  return {
    project: project,
    resolveColumns: resolveColumns,
    normalizeColumnName: normalizeColumnName,
    sameColumn: sameColumn,
  };
});
