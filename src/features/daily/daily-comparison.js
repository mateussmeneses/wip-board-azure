// src/data/daily-comparison.js
// Daily Comparison: the pure PRESENTATION view-model that answers, for a given
// daily plan, what was actually delivered. Roadmap T1.6.
//
// Purpose
// -------
// The classification engine (src/data/daily-commitment.js, T1.3) already turns a
// commitment + a realized state into per-item verdicts (reached / behind /
// beyond / off-track / missing). What it does NOT do is:
//   - pick which LATER snapshot is a valid comparison target for a plan,
//   - turn the per-item verdicts into daily METRICS (counts + a proven
//     fulfillment rate) with an honest reliability verdict, or
//   - shape rows + explanations for the UI and filter them by result category.
// That presentation logic lives here, kept as a pure function of its inputs so
// it is fully unit-testable without a browser (same discipline as the sibling
// data modules).
//
// REUSE, not duplication: the classification itself is delegated to
// WIPBoardDailyCommitment.compareCommitment. This module never reimplements the
// reached/behind/beyond/off-track/missing rules or a second comparison engine.
// It is injected with the commitment engine so the Node tests and the Chrome
// runtime share exactly one classifier.
//
// Data selection (requirement 2):
//   - The initial snapshot is the authoritative planning baseline.
//   - The commitment is the plan for that board; an explicit revision may be
//     supplied so a historic plan is never silently rewritten by a newer one.
//   - The LATER snapshot is the observed state; it must belong to the SAME board
//     scope and have a capture time STRICTLY AFTER the initial snapshot.
//   - A valid column order is required to tell behind from beyond; without it a
//     result stays the conservative off-track and the fulfillment rate is flagged
//     unreliable rather than shown as a misleading percentage.
//
// Reliability (requirement 4/7): missing and off-track are NEVER counted as
// proven failures. They are surfaced separately as "undetermined" results, and
// when the data is insufficient (no later snapshot, incomplete snapshot, or no
// trustworthy column order) the fulfillment rate is marked unreliable so the UI
// can suppress a misleading number.
//
// This module reads plain objects only. It never touches the DOM, never calls
// the extension storage APIs, never mutates a work item, and never mutates its
// inputs. The caller resolves every snapshot/commitment from the SAME board
// scope via WIPBoardSnapshotStore, so boards and days never mix here.
//
// WIP vs delivery: nothing in this file reads or produces a WIP number. The
// fulfillment rate is a DELIVERY metric, kept separate from WIP by design.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardDailyComparison.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  // The classification engine is a required collaborator. In Node it is required
  // directly; in the browser it is read from the global the manifest loaded
  // before this file. Either way we REUSE it, never reimplement it.
  const engine =
    (typeof module !== 'undefined' && module.exports && safeRequire('./daily-commitment.js')) ||
    (root && root.WIPBoardDailyCommitment) ||
    null;
  const api = factory(engine);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardDailyComparison = api;
  }

  function safeRequire(path) {
    try {
      // eslint-disable-next-line global-require
      return require(path);
    } catch (e) {
      return null;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (defaultEngine) {
  'use strict';

  // Result categories mirror the engine verdicts plus the UI "all" filter.
  const Result = Object.freeze({
    REACHED: 'reached',
    BEYOND: 'beyond',
    BEHIND: 'behind',
    OFF_TRACK: 'off-track',
    MISSING: 'missing',
  });

  const Filter = Object.freeze({
    ALL: 'all',
    REACHED: 'reached',
    BEYOND: 'beyond',
    BEHIND: 'behind',
    OFF_TRACK: 'off-track',
    MISSING: 'missing',
  });

  // Reasons the fulfillment rate cannot be trusted (surfaced, never hidden).
  const ReliabilityReason = Object.freeze({
    NO_LATER_SNAPSHOT: 'NO_LATER_SNAPSHOT',
    INCOMPLETE_LATER_SNAPSHOT: 'INCOMPLETE_LATER_SNAPSHOT',
    INCOMPLETE_INITIAL_SNAPSHOT: 'INCOMPLETE_INITIAL_SNAPSHOT',
    UNRELIABLE_COLUMN_ORDER: 'UNRELIABLE_COLUMN_ORDER',
    NO_COMMITMENT: 'NO_COMMITMENT',
  });

  function resolveEngine(injected) {
    const engine = injected || defaultEngine;
    if (!engine || typeof engine.compareCommitment !== 'function') {
      throw new Error(
        'WIPBoardDailyComparison requires the WIPBoardDailyCommitment engine (compareCommitment)'
      );
    }
    return engine;
  }

  function epochOf(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const at = snapshot.capturedAt;
    if (at && typeof at === 'object' && typeof at.epochMs === 'number') return at.epochMs;
    // Tolerate a bare numeric/ISO capturedAt for tests and non-store inputs.
    if (typeof at === 'number') return at;
    if (typeof at === 'string') {
      const t = Date.parse(at);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  }

  function sameScope(a, b) {
    if (!a || !b) return false;
    return (
      String(a.organization) === String(b.organization) &&
      String(a.project) === String(b.project) &&
      String(a.team) === String(b.team) &&
      String(a.board) === String(b.board)
    );
  }

  // ---------------------------------------------------------------------------
  // Select the snapshots that are valid LATER targets for a given initial
  // snapshot: same board scope, and captured STRICTLY AFTER the initial one. The
  // initial snapshot itself and any snapshot from another board/date earlier than
  // the baseline are excluded. Returned newest-first so the UI defaults sensibly.
  //
  //   candidates     : all snapshots for the board (store getSnapshots output).
  //   initialSnapshot : the chosen baseline snapshot.
  // ---------------------------------------------------------------------------

  function selectComparableSnapshots(candidates, initialSnapshot) {
    const list = Array.isArray(candidates) ? candidates : [];
    const baseEpoch = epochOf(initialSnapshot);
    const baseScope = initialSnapshot && initialSnapshot.scope;
    const baseId = initialSnapshot && initialSnapshot.id;

    const later = list.filter(function (snap) {
      if (!snap || typeof snap !== 'object') return false;
      if (snap.id != null && baseId != null && snap.id === baseId) return false; // not itself
      if (baseScope && snap.scope && !sameScope(baseScope, snap.scope)) return false; // other board
      const epoch = epochOf(snap);
      if (epoch == null || baseEpoch == null) return false;
      return epoch > baseEpoch; // strictly after the initial capture
    });

    later.sort(function (a, b) {
      return (epochOf(b) || 0) - (epochOf(a) || 0);
    });
    return later;
  }

  // ---------------------------------------------------------------------------
  // Resolve the plan items for a given commitment + an optional revision.
  //
  // A commitment record (store shape) carries the CURRENT plan in `items` and a
  // history of superseded plans in `revisions` (each { revision, items, ... }).
  // When `revision` is given and differs from the current revision, the archived
  // plan is used verbatim: a historic daily must be judged against the plan that
  // was actually declared that day, never silently against a newer revision
  // (requirement 2). Returns { items, revision, usedArchived } or null.
  // ---------------------------------------------------------------------------

  function resolvePlan(commitment, revision) {
    if (!commitment || typeof commitment !== 'object') return null;
    const currentRevision = typeof commitment.revision === 'number' ? commitment.revision : 0;

    if (revision == null || revision === currentRevision) {
      return {
        items: Array.isArray(commitment.items) ? commitment.items : [],
        revision: currentRevision,
        usedArchived: false,
      };
    }

    const archived = (Array.isArray(commitment.revisions) ? commitment.revisions : []).filter(
      function (r) {
        return r && r.revision === revision;
      }
    );
    if (archived.length) {
      return {
        items: Array.isArray(archived[0].items) ? archived[0].items : [],
        revision: revision,
        usedArchived: true,
      };
    }
    // Requested revision does not exist: do not guess. Fall back to the current
    // plan but report that the requested revision was unavailable.
    return {
      items: Array.isArray(commitment.items) ? commitment.items : [],
      revision: currentRevision,
      usedArchived: false,
      requestedRevisionMissing: revision,
    };
  }

  // ---------------------------------------------------------------------------
  // Does the realized (later) snapshot expose a trustworthy column order? behind
  // vs beyond is meaningless without one. We trust an explicit columnOrder or the
  // snapshot's own `columns` structure (with at least two named columns so an
  // order actually exists).
  // ---------------------------------------------------------------------------

  function hasReliableOrder(laterSnapshot, options) {
    const opts = options || {};
    if (Array.isArray(opts.columnOrder) && opts.columnOrder.length >= 2) return true;
    const columns = laterSnapshot && Array.isArray(laterSnapshot.columns) ? laterSnapshot.columns : [];
    const named = columns.filter(function (c) {
      return c && c.name != null && String(c.name).trim() !== '';
    });
    return named.length >= 2;
  }

  function startColumnOf(initialItemsById, id, fallback) {
    const item = initialItemsById.get(id);
    if (item && item.column != null && String(item.column).trim() !== '') return item.column;
    return fallback != null ? fallback : null;
  }

  function indexById(items) {
    const map = new Map();
    (items || []).forEach(function (item) {
      if (item && item.id != null && !map.has(item.id)) map.set(item.id, item);
    });
    return map;
  }

  // ---------------------------------------------------------------------------
  // Build the full comparison view-model.
  //
  //   input = {
  //     initialSnapshot : the baseline snapshot (store record or {items,columns,
  //                       capturedAt,scope}).
  //     commitment      : the commitment record for the board (or {items,...}).
  //     revision        : optional explicit commitment revision to compare.
  //     laterSnapshot   : the observed snapshot to compare against (same board,
  //                       captured after the initial). May be null.
  //     columnOrder     : optional explicit [{name,order}]|string[] flow order.
  //   }
  //   options = { engine } // inject the classifier (defaults to the module one)
  //
  // Returns a pure object:
  //   {
  //     ok,                       // true when a comparison could be produced
  //     error?,                   // a stable code when ok === false
  //     initial: { id, capturedAt, when, complete },
  //     later:   { id, capturedAt, when, complete } | null,
  //     commitment: { revision, usedArchived, createdAt } | null,
  //     dailyDate,                // the daily's local calendar day (initial)
  //     orderReliable,            // column order can tell behind vs beyond
  //     results: [{ id, startColumn, expectedColumn, actualColumn, status,
  //                 undetermined, explanation }],
  //     metrics: {
  //       committed, reached, beyond, behind, offTrack, missing,
  //       fulfilled,              // reached + beyond (proven delivered)
  //       undetermined,           // offTrack + missing (not proven failures)
  //       fulfillmentRate,        // ((reached+beyond)/committed)*100 or null
  //       rateReliable,           // false => UI must not show a percentage
  //     },
  //     reliability: { reliable, reasons: [ReliabilityReason...] },
  //   }
  // ---------------------------------------------------------------------------

  function buildComparison(input, options) {
    const engine = resolveEngine(options && options.engine);
    const data = input && typeof input === 'object' ? input : {};

    const initialSnapshot = data.initialSnapshot;
    if (!initialSnapshot || typeof initialSnapshot !== 'object') {
      return { ok: false, error: 'NO_INITIAL_SNAPSHOT' };
    }

    const plan = resolvePlan(data.commitment, data.revision);
    const planItems = plan ? plan.items : [];

    const laterSnapshot = data.laterSnapshot && typeof data.laterSnapshot === 'object'
      ? data.laterSnapshot
      : null;

    // Guard the LATER snapshot: when present it must be the same board and after
    // the initial capture. An incompatible later snapshot is refused outright so
    // the UI never silently compares across boards/time (requirement 2/7).
    if (laterSnapshot) {
      if (
        initialSnapshot.scope &&
        laterSnapshot.scope &&
        !sameScope(initialSnapshot.scope, laterSnapshot.scope)
      ) {
        return { ok: false, error: 'SNAPSHOT_SCOPE_MISMATCH' };
      }
      const initEpoch = epochOf(initialSnapshot);
      const laterEpoch = epochOf(laterSnapshot);
      if (initEpoch != null && laterEpoch != null && laterEpoch <= initEpoch) {
        return { ok: false, error: 'LATER_SNAPSHOT_NOT_AFTER_INITIAL' };
      }
    }

    const initialItemsById = indexById(initialSnapshot.items);

    // Delegate the per-item classification to the shared engine. The realized
    // state is the LATER snapshot; its own columns (or an explicit order) decide
    // behind vs beyond. With no later snapshot we pass an empty realized state so
    // every committed item is honestly classified as missing (never "done").
    const realizedState = laterSnapshot
      ? { items: laterSnapshot.items, columns: laterSnapshot.columns }
      : { items: [], columns: [] };

    const compareOptions = {};
    if (Array.isArray(data.columnOrder) && data.columnOrder.length) {
      compareOptions.columnOrder = data.columnOrder;
    }

    const comparison = engine.compareCommitment({ items: planItems }, realizedState, compareOptions);

    const orderReliable = !!laterSnapshot && hasReliableOrder(laterSnapshot, {
      columnOrder: data.columnOrder,
    });

    const results = comparison.results.map(function (r) {
      const undetermined = r.status === Result.MISSING || r.status === Result.OFF_TRACK;
      return {
        id: r.id,
        startColumn: startColumnOf(initialItemsById, r.id, r.startColumn),
        expectedColumn: r.expectedColumn,
        actualColumn: r.actualColumn,
        status: r.status,
        undetermined: undetermined,
        explanation: explainResult(r.status, { orderReliable: orderReliable, hasLater: !!laterSnapshot }),
      };
    });

    const metrics = buildMetrics(comparison.summary, orderReliable, !!laterSnapshot, planItems.length);

    const reliability = buildReliability({
      hasLater: !!laterSnapshot,
      orderReliable: orderReliable,
      initialComplete: isComplete(initialSnapshot),
      laterComplete: laterSnapshot ? isComplete(laterSnapshot) : false,
      hasCommitment: planItems.length > 0,
    });

    return {
      ok: true,
      initial: snapshotInfo(initialSnapshot),
      later: laterSnapshot ? snapshotInfo(laterSnapshot) : null,
      commitment: plan
        ? {
            revision: plan.revision,
            usedArchived: plan.usedArchived,
            requestedRevisionMissing: plan.requestedRevisionMissing != null ? plan.requestedRevisionMissing : null,
            createdAt: data.commitment && data.commitment.createdAt ? data.commitment.createdAt : null,
          }
        : null,
      dailyDate: initialSnapshot.capturedAt && initialSnapshot.capturedAt.localDay
        ? initialSnapshot.capturedAt.localDay
        : null,
      orderReliable: orderReliable,
      results: results,
      metrics: metrics,
      reliability: reliability,
    };
  }

  function snapshotInfo(snapshot) {
    return {
      id: snapshot.id != null ? snapshot.id : null,
      capturedAt: snapshot.capturedAt || null,
      complete: isComplete(snapshot),
    };
  }

  function isComplete(snapshot) {
    // Prefer the store's explicit source.complete flag; treat an unknown flag as
    // not-complete so reliability is never overstated (conservative).
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.source && typeof snapshot.source.complete === 'boolean') {
      return snapshot.source.complete;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Metrics. The proven fulfillment rate counts only reached + beyond, and ONLY
  // when the column order is reliable (so beyond is trustworthy) and a later
  // snapshot exists. Otherwise the rate is null and rateReliable is false, so the
  // UI shows counts but suppresses a misleading percentage (requirement 4).
  // ---------------------------------------------------------------------------

  function buildMetrics(summary, orderReliable, hasLater, committedCount) {
    const s = summary || {};
    const committed = typeof s.committed === 'number' ? s.committed : committedCount || 0;
    const reached = s.reached || 0;
    const beyond = s.beyond || 0;
    const behind = s.behind || 0;
    const offTrack = s.offTrack || 0;
    const missing = s.missing || 0;

    const fulfilled = reached + beyond;
    const undetermined = offTrack + missing;

    const rateReliable = hasLater && orderReliable && committed > 0;
    const fulfillmentRate = rateReliable
      ? Math.round((fulfilled / committed) * 1000) / 10 // one decimal place
      : null;

    return {
      committed: committed,
      reached: reached,
      beyond: beyond,
      behind: behind,
      offTrack: offTrack,
      missing: missing,
      fulfilled: fulfilled,
      undetermined: undetermined,
      fulfillmentRate: fulfillmentRate,
      rateReliable: rateReliable,
    };
  }

  function buildReliability(ctx) {
    const reasons = [];
    if (!ctx.hasCommitment) reasons.push(ReliabilityReason.NO_COMMITMENT);
    if (!ctx.hasLater) reasons.push(ReliabilityReason.NO_LATER_SNAPSHOT);
    if (ctx.hasLater && !ctx.orderReliable) reasons.push(ReliabilityReason.UNRELIABLE_COLUMN_ORDER);
    if (ctx.hasLater && !ctx.laterComplete) reasons.push(ReliabilityReason.INCOMPLETE_LATER_SNAPSHOT);
    if (!ctx.initialComplete) reasons.push(ReliabilityReason.INCOMPLETE_INITIAL_SNAPSHOT);
    return { reliable: reasons.length === 0, reasons: reasons };
  }

  // Short machine-readable explanation code per status, so the UI can localize an
  // honest reason for undetermined results (requirement 5). Never invents a
  // conclusion the data does not support.
  function explainResult(status, ctx) {
    switch (status) {
      case Result.REACHED:
        return null;
      case Result.BEYOND:
        return null;
      case Result.BEHIND:
        return null;
      case Result.OFF_TRACK:
        return ctx && ctx.orderReliable ? 'OFF_TRACK_INCOMPATIBLE' : 'OFF_TRACK_UNKNOWN_ORDER';
      case Result.MISSING:
        return ctx && ctx.hasLater ? 'MISSING_NO_CARD' : 'MISSING_NO_LATER';
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Filter the result rows by category for the UI's result filters. ALL returns a
  // shallow copy; every other filter keeps only the matching status. The input
  // array is never mutated.
  // ---------------------------------------------------------------------------

  function filterResults(results, filter) {
    const list = Array.isArray(results) ? results : [];
    const f = filter || Filter.ALL;
    if (f === Filter.ALL) return list.slice();
    return list.filter(function (row) {
      return row && row.status === f;
    });
  }

  return {
    Result: Result,
    Filter: Filter,
    ReliabilityReason: ReliabilityReason,
    selectComparableSnapshots: selectComparableSnapshots,
    resolvePlan: resolvePlan,
    buildComparison: buildComparison,
    filterResults: filterResults,
  };
});
