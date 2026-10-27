// src/data/daily-history.js
// Daily History: the pure aggregation layer that reconstructs, organizes and
// summarizes the dailies recorded for ONE board scope over time. Roadmap T1.7.
//
// Purpose
// -------
// T1.6 (daily-comparison.js) answers "for THIS daily, what was planned vs. what
// was delivered?". T1.7 answers the HISTORICAL questions across many dailies:
//
//   - Which dailies were recorded (one row per daily), newest first?
//   - For each: the date, scope, the initial (planning) snapshot and time, the
//     commitment id + revision in effect, the later (evaluation) snapshot and
//     time, the counts (committed / reached / beyond / behind / off-track /
//     missing) and the proven fulfillment rate?
//   - Across the filtered range: how many dailies, how many commitments, how
//     many proven-fulfilled, the OVERALL proven rate (weighted by commitment
//     count, not an average of daily percentages), the daily evolution, and how
//     many records lack a trustworthy evaluation?
//
// REUSE, not duplication (requirement 2/7): the per-item classification and the
// per-daily metrics are produced by WIPBoardDailyComparison.buildComparison,
// which itself delegates to WIPBoardDailyCommitment.compareCommitment. This
// module never reimplements the reached/behind/beyond/off-track/missing rules
// nor a second comparison or metrics engine. It is injected with the comparison
// view-model so the Node tests and the Chrome runtime share exactly one path.
//
// RELIABILITY (requirement 3 — the most important rule):
//   - The history is reconstructed EXCLUSIVELY from persisted, identified
//     records (snapshots + commitments for the same board scope). The live Azure
//     DevOps state is never read here and never fills a historical gap.
//   - The revision in effect at evaluation time is preserved: when a commitment
//     carries a persisted `evaluation.revision`, that archived plan is compared;
//     the current revision is NEVER silently substituted for the original plan.
//   - Records from different organization / project / team / board are never
//     mixed: the caller passes records for a single scope, and this module
//     additionally asserts same-scope on every snapshot it links.
//   - Multiple dailies on the same calendar day keep distinct identities (one
//     record per commitment); they are never merged.
//   - A commitment whose base/evaluation snapshot is missing is NOT dropped: it
//     is surfaced as a record with a reliability verdict so the integrity gap is
//     visible instead of hidden.
//
// AGGREGATION (requirement 4):
//   - overallRate = (sum reached + sum beyond) / (sum committed of RELIABLE
//     records) * 100. It is weighted by commitment count, not an average of the
//     daily rates. Only records with a reliable rate contribute, so an
//     unevaluated daily can never inflate or deflate the overall number.
//   - missing/off-track are reported as "undetermined", never as proven
//     failures. "no reliable evaluation" is counted separately from "zero
//     commitments": absence of data is never shown as 0%.
//
// This module reads plain objects only. It never touches the DOM, never calls
// the extension storage APIs, never mutates a work item, never reads or writes a
// WIP number, and never mutates its inputs.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardDailyHistory.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  // The comparison view-model is a required collaborator. In Node it is required
  // directly; in the browser it is read from the global the manifest loaded
  // before this file. Either way we REUSE it, never reimplement it.
  const comparison =
    (typeof module !== 'undefined' && module.exports && safeRequire('./daily-comparison.js')) ||
    (root && root.WIPBoardDailyComparison) ||
    null;
  const api = factory(comparison);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardDailyHistory = api;
  }

  function safeRequire(path) {
    try {
      // eslint-disable-next-line global-require
      return require(path);
    } catch (e) {
      return null;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (defaultComparison) {
  'use strict';

  // Why a daily record could not be judged reliably. Surfaced, never hidden.
  const RecordReliabilityReason = Object.freeze({
    NO_BASE_SNAPSHOT: 'NO_BASE_SNAPSHOT',
    NO_LATER_SNAPSHOT: 'NO_LATER_SNAPSHOT',
    INCOMPLETE_SNAPSHOT: 'INCOMPLETE_SNAPSHOT',
    UNRELIABLE_COLUMN_ORDER: 'UNRELIABLE_COLUMN_ORDER',
    NO_COMMITMENT: 'NO_COMMITMENT',
    COMPARISON_FAILED: 'COMPARISON_FAILED',
  });

  function resolveComparison(injected) {
    const c = injected || defaultComparison;
    if (!c || typeof c.buildComparison !== 'function' || typeof c.selectComparableSnapshots !== 'function') {
      throw new Error(
        'WIPBoardDailyHistory requires the WIPBoardDailyComparison view-model (buildComparison, selectComparableSnapshots)'
      );
    }
    return c;
  }

  // --- small helpers ---------------------------------------------------------

  function epochOf(record) {
    if (!record || typeof record !== 'object') return null;
    const at = record.capturedAt || record.createdAt;
    if (at && typeof at === 'object' && typeof at.epochMs === 'number') return at.epochMs;
    if (typeof at === 'number') return at;
    if (typeof at === 'string') {
      const t = Date.parse(at);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  }

  function localDayOf(record) {
    if (!record || typeof record !== 'object') return null;
    const at = record.capturedAt || record.createdAt;
    if (at && typeof at === 'object' && at.localDay) return at.localDay;
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

  function indexSnapshotsById(snapshots) {
    const map = new Map();
    (snapshots || []).forEach(function (snap) {
      if (snap && snap.id != null && !map.has(snap.id)) map.set(snap.id, snap);
    });
    return map;
  }

  // The revision in effect at evaluation time, taken ONLY from a persisted
  // evaluation record. Returns null when none was persisted (the caller then
  // flags the record and compares the current plan WITHOUT claiming it is the
  // original — the reliability verdict carries the caveat).
  function persistedRevision(commitment) {
    if (!commitment || typeof commitment !== 'object') return null;
    const ev = commitment.evaluation;
    if (ev && typeof ev === 'object' && typeof ev.revision === 'number') return ev.revision;
    return null;
  }

  function persistedLaterSnapshotId(commitment) {
    if (!commitment || typeof commitment !== 'object') return null;
    const ev = commitment.evaluation;
    if (ev && typeof ev === 'object' && ev.laterSnapshotId != null) return ev.laterSnapshotId;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Select the evaluation (later) snapshot for a commitment, from persisted data
  // ONLY. Priority:
  //   1. The commitment's persisted evaluation.laterSnapshotId, when that
  //      snapshot still exists and is same-scope and strictly after the base.
  //      This is the authoritative choice recorded when the daily was evaluated.
  //   2. Otherwise a DETERMINISTIC fallback: the EARLIEST same-board snapshot
  //      captured strictly after the base snapshot but BEFORE the next daily's
  //      planning (so one daily's evaluation never borrows a later daily's
  //      snapshot). When there is no next daily, the latest such snapshot is used.
  //
  // Never reads the live board. Returns { snapshot, source } or { snapshot:null }.
  //   source: 'persisted' | 'inferred' | null
  // ---------------------------------------------------------------------------

  function selectEvaluationSnapshot(cmpApi, commitment, baseSnapshot, candidates, nextPlanningEpoch) {
    const baseEpoch = epochOf(baseSnapshot);
    if (!baseSnapshot || baseEpoch == null) return { snapshot: null, source: null };

    const byId = indexSnapshotsById(candidates);

    // 1. Authoritative persisted choice.
    const pinnedId = persistedLaterSnapshotId(commitment);
    if (pinnedId != null && byId.has(pinnedId)) {
      const pinned = byId.get(pinnedId);
      const okScope = !baseSnapshot.scope || !pinned.scope || sameScope(baseSnapshot.scope, pinned.scope);
      const pinnedEpoch = epochOf(pinned);
      if (okScope && pinnedEpoch != null && pinnedEpoch > baseEpoch) {
        return { snapshot: pinned, source: 'persisted' };
      }
    }

    // 2. Deterministic fallback within this daily's window.
    const later = cmpApi.selectComparableSnapshots(candidates, baseSnapshot); // newest first
    if (!later.length) return { snapshot: null, source: null };

    const windowed = later.filter(function (snap) {
      if (nextPlanningEpoch == null) return true;
      const e = epochOf(snap);
      return e != null && e < nextPlanningEpoch;
    });

    const pool = windowed.length ? windowed : (nextPlanningEpoch == null ? later : []);
    if (!pool.length) return { snapshot: null, source: null };

    // Earliest in the window best represents "the evaluation of THIS daily"; the
    // list is newest-first, so take the last element.
    const chosen = pool[pool.length - 1];
    return { snapshot: chosen, source: 'inferred' };
  }

  // ---------------------------------------------------------------------------
  // Build the list of historical daily records for a single board scope.
  //
  //   input = {
  //     snapshots   : all snapshots for the board (store.getSnapshots output).
  //     commitments : all commitments for the board (store.getCommitments output).
  //   }
  //   options = { comparison } // inject the view-model (defaults to module one)
  //
  // Each commitment becomes exactly one daily record (identities preserved; same
  // day never merged). Returns records newest-first (by planning time).
  //
  // A record:
  //   {
  //     commitmentId, revision, revisionInEffect, usedPersistedEvaluation,
  //     scope, dailyDate, planningAt, evaluationAt,
  //     initial: { id, when } | null,
  //     later:   { id, when } | null,
  //     metrics: { committed, reached, beyond, behind, offTrack, missing,
  //                fulfilled, undetermined, fulfillmentRate, rateReliable },
  //     reliability: { reliable, reasons: [...] },
  //     vm,            // the full T1.6 comparison view-model (or null)
  //   }
  // ---------------------------------------------------------------------------

  function buildHistory(input, options) {
    const cmpApi = resolveComparison(options && options.comparison);
    const data = input && typeof input === 'object' ? input : {};
    const snapshots = Array.isArray(data.snapshots) ? data.snapshots.slice() : [];
    const commitments = Array.isArray(data.commitments) ? data.commitments.slice() : [];

    const byId = indexSnapshotsById(snapshots);

    // Planning epochs, oldest-first, so each daily's evaluation window ends at the
    // NEXT daily's planning time (same day or later). This keeps one daily from
    // stealing a later daily's snapshot (requirement 3).
    const planningEpochs = commitments
      .map(epochOf)
      .filter(function (e) { return e != null; })
      .sort(function (a, b) { return a - b; });

    function nextPlanningAfter(epoch) {
      if (epoch == null) return null;
      for (let i = 0; i < planningEpochs.length; i += 1) {
        if (planningEpochs[i] > epoch) return planningEpochs[i];
      }
      return null;
    }

    const records = commitments.map(function (commitment) {
      return buildRecord(cmpApi, commitment, byId, snapshots, nextPlanningAfter(epochOf(commitment)));
    });

    // Newest-first by planning time; a null planning time sorts last.
    records.sort(function (a, b) {
      return (b.planningAtEpoch || 0) - (a.planningAtEpoch || 0);
    });

    return records;
  }

  function buildRecord(cmpApi, commitment, byId, allSnapshots, nextPlanningEpoch) {
    const scope = commitment && commitment.scope ? commitment.scope : null;
    const planningEpoch = epochOf(commitment);
    const dailyDate = localDayOf(commitment);

    const baseSnapshot =
      commitment && commitment.baseSnapshotId != null && byId.has(commitment.baseSnapshotId)
        ? byId.get(commitment.baseSnapshotId)
        : null;

    const revisionInEffect = persistedRevision(commitment);
    const usedPersistedEvaluation = persistedLaterSnapshotId(commitment) != null;

    const base = {
      commitmentId: commitment ? commitment.id : null,
      revision: commitment && typeof commitment.revision === 'number' ? commitment.revision : null,
      revisionInEffect: revisionInEffect,
      usedPersistedEvaluation: usedPersistedEvaluation,
      scope: scope,
      dailyDate: dailyDate,
      planningAt: commitment && commitment.createdAt ? commitment.createdAt : null,
      planningAtEpoch: planningEpoch,
      evaluationAt: null,
      initial: null,
      later: null,
      metrics: emptyMetrics(),
      reliability: { reliable: false, reasons: [] },
      vm: null,
    };

    // No base snapshot: the planning baseline cannot be trusted. Report the gap
    // instead of inventing a baseline from the live board (integrity rule).
    if (!baseSnapshot) {
      base.reliability = { reliable: false, reasons: [RecordReliabilityReason.NO_BASE_SNAPSHOT] };
      base.metrics = metricsFromCommitment(commitment);
      return base;
    }

    base.initial = { id: baseSnapshot.id != null ? baseSnapshot.id : null, when: baseSnapshot.capturedAt || null };

    // Same-scope candidates only (defense in depth on top of the caller's scope).
    const candidates = allSnapshots.filter(function (snap) {
      if (!snap) return false;
      if (baseSnapshot.scope && snap.scope && !sameScope(baseSnapshot.scope, snap.scope)) return false;
      return true;
    });

    const picked = selectEvaluationSnapshot(cmpApi, commitment, baseSnapshot, candidates, nextPlanningEpoch);
    const laterSnapshot = picked.snapshot;

    // Compare via the REUSED T1.6 view-model, honoring the revision in effect.
    let vm;
    try {
      vm = cmpApi.buildComparison({
        initialSnapshot: baseSnapshot,
        commitment: commitment,
        revision: revisionInEffect != null ? revisionInEffect : undefined,
        laterSnapshot: laterSnapshot,
      });
    } catch (e) {
      base.reliability = { reliable: false, reasons: [RecordReliabilityReason.COMPARISON_FAILED] };
      return base;
    }

    base.vm = vm;

    if (!vm || !vm.ok) {
      base.reliability = { reliable: false, reasons: [RecordReliabilityReason.COMPARISON_FAILED] };
      return base;
    }

    base.later = laterSnapshot
      ? { id: laterSnapshot.id != null ? laterSnapshot.id : null, when: laterSnapshot.capturedAt || null }
      : null;
    base.evaluationAt = laterSnapshot && laterSnapshot.capturedAt ? laterSnapshot.capturedAt : null;
    base.metrics = normalizeMetrics(vm.metrics);
    base.reliability = mapReliability(vm.reliability, !!laterSnapshot);

    // If we fell back to an inferred later snapshot (no persisted evaluation),
    // the record is still only as reliable as the comparison says; the inferred
    // flag is exposed so the UI can caveat it.
    base.evaluationSource = picked.source; // 'persisted' | 'inferred' | null

    return base;
  }

  // Translate the T1.6 reliability reasons into history-level reasons so the UI
  // has a single reason vocabulary. A record is "reliable" only when its rate is
  // reliable (a later snapshot exists, the order is known, a commitment exists).
  function mapReliability(vmReliability, hasLater) {
    const reasons = [];
    const vmReasons = vmReliability && Array.isArray(vmReliability.reasons) ? vmReliability.reasons : [];
    vmReasons.forEach(function (code) {
      switch (code) {
        case 'NO_LATER_SNAPSHOT':
          reasons.push(RecordReliabilityReason.NO_LATER_SNAPSHOT);
          break;
        case 'INCOMPLETE_LATER_SNAPSHOT':
        case 'INCOMPLETE_INITIAL_SNAPSHOT':
          if (reasons.indexOf(RecordReliabilityReason.INCOMPLETE_SNAPSHOT) === -1) {
            reasons.push(RecordReliabilityReason.INCOMPLETE_SNAPSHOT);
          }
          break;
        case 'UNRELIABLE_COLUMN_ORDER':
          reasons.push(RecordReliabilityReason.UNRELIABLE_COLUMN_ORDER);
          break;
        case 'NO_COMMITMENT':
          reasons.push(RecordReliabilityReason.NO_COMMITMENT);
          break;
        default:
          break;
      }
    });
    return { reliable: reasons.length === 0, reasons: reasons };
  }

  function emptyMetrics() {
    return {
      committed: 0,
      reached: 0,
      beyond: 0,
      behind: 0,
      offTrack: 0,
      missing: 0,
      fulfilled: 0,
      undetermined: 0,
      fulfillmentRate: null,
      rateReliable: false,
    };
  }

  function normalizeMetrics(m) {
    const s = m || {};
    return {
      committed: s.committed || 0,
      reached: s.reached || 0,
      beyond: s.beyond || 0,
      behind: s.behind || 0,
      offTrack: s.offTrack || 0,
      missing: s.missing || 0,
      fulfilled: s.fulfilled || 0,
      undetermined: s.undetermined || 0,
      fulfillmentRate: s.fulfillmentRate != null ? s.fulfillmentRate : null,
      rateReliable: s.rateReliable === true,
    };
  }

  // When there is no base snapshot we still want to show how many items were
  // committed, so the "planned" total is not silently zero. Count the current
  // plan's items (no reliability is claimed; the record is already flagged).
  function metricsFromCommitment(commitment) {
    const metrics = emptyMetrics();
    const items = commitment && Array.isArray(commitment.items) ? commitment.items : [];
    const seen = new Set();
    items.forEach(function (it) {
      if (it && it.id != null && it.expectedColumn != null && !seen.has(it.id)) {
        seen.add(it.id);
      }
    });
    metrics.committed = seen.size;
    return metrics;
  }

  // ---------------------------------------------------------------------------
  // Filter records by an inclusive [from, to] local-day range (yyyy-mm-dd). A
  // record with no dailyDate is excluded when a bound is set (cannot be placed in
  // the range honestly). Open bounds (null) mean unbounded on that side. Never
  // mutates the input.
  // ---------------------------------------------------------------------------

  function filterByDateRange(records, range) {
    const list = Array.isArray(records) ? records : [];
    const r = range || {};
    const from = r.from || null;
    const to = r.to || null;
    if (!from && !to) return list.slice();
    return list.filter(function (rec) {
      const day = rec && rec.dailyDate;
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Aggregate indicators over a set of records (requirement 4). The overall rate
  // is weighted by commitment count and uses ONLY records whose rate is reliable,
  // so an unevaluated daily never inflates/deflates the number. missing/off-track
  // are reported apart from proven results; "no reliable evaluation" is counted
  // distinctly from "zero commitments".
  //
  // Returns:
  //   {
  //     dailies,                 // number of records in scope
  //     reliableDailies,         // records that contributed to the overall rate
  //     unreliableDailies,       // records WITHOUT a trustworthy evaluation
  //     committed,               // total planned commitments (all records)
  //     reliableCommitted,       // committed within reliable records (rate base)
  //     fulfilled,               // proven reached+beyond within reliable records
  //     reached, beyond, behind, offTrack, missing, // totals across all records
  //     undetermined,            // offTrack + missing across all records
  //     overallRate,             // (fulfilled / reliableCommitted) * 100 | null
  //     rateReliable,            // false => UI must not show a percentage
  //     evolution: [{ date, committed, fulfilled, rate, reliable, dailies }],
  //   }
  // ---------------------------------------------------------------------------

  function aggregate(records) {
    const list = Array.isArray(records) ? records : [];

    let committed = 0;
    let reliableCommitted = 0;
    let fulfilled = 0;
    let reached = 0;
    let beyond = 0;
    let behind = 0;
    let offTrack = 0;
    let missing = 0;
    let reliableDailies = 0;
    let unreliableDailies = 0;

    const byDay = new Map(); // date -> { committed, fulfilled, reliableCommitted, reliableFulfilled, dailies, reliableDailies }

    list.forEach(function (rec) {
      const m = rec && rec.metrics ? rec.metrics : emptyMetrics();
      committed += m.committed || 0;
      reached += m.reached || 0;
      beyond += m.beyond || 0;
      behind += m.behind || 0;
      offTrack += m.offTrack || 0;
      missing += m.missing || 0;

      const isReliable = !!(rec && rec.reliability && rec.reliability.reliable && m.rateReliable);
      if (isReliable) {
        reliableDailies += 1;
        reliableCommitted += m.committed || 0;
        fulfilled += m.fulfilled || 0;
      } else {
        unreliableDailies += 1;
      }

      const day = rec && rec.dailyDate ? rec.dailyDate : '__undated__';
      if (!byDay.has(day)) {
        byDay.set(day, {
          committed: 0,
          fulfilled: 0,
          reliableCommitted: 0,
          reliableFulfilled: 0,
          dailies: 0,
          reliableDailies: 0,
        });
      }
      const bucket = byDay.get(day);
      bucket.committed += m.committed || 0;
      bucket.dailies += 1;
      if (isReliable) {
        bucket.reliableDailies += 1;
        bucket.reliableCommitted += m.committed || 0;
        bucket.reliableFulfilled += m.fulfilled || 0;
      }
    });

    const rateReliable = reliableCommitted > 0;
    const overallRate = rateReliable
      ? Math.round((fulfilled / reliableCommitted) * 1000) / 10
      : null;

    // Daily evolution, oldest-first for a left-to-right chart. An undated bucket
    // is placed last. Each point's rate is weighted within that day and only
    // reliable when the day has reliable commitments.
    const evolution = Array.from(byDay.keys())
      .filter(function (d) { return d !== '__undated__'; })
      .sort()
      .map(function (date) {
        const b = byDay.get(date);
        const dayReliable = b.reliableCommitted > 0;
        return {
          date: date,
          committed: b.committed,
          fulfilled: b.reliableFulfilled,
          rate: dayReliable ? Math.round((b.reliableFulfilled / b.reliableCommitted) * 1000) / 10 : null,
          reliable: dayReliable,
          dailies: b.dailies,
        };
      });

    return {
      dailies: list.length,
      reliableDailies: reliableDailies,
      unreliableDailies: unreliableDailies,
      committed: committed,
      reliableCommitted: reliableCommitted,
      fulfilled: fulfilled,
      reached: reached,
      beyond: beyond,
      behind: behind,
      offTrack: offTrack,
      missing: missing,
      undetermined: offTrack + missing,
      overallRate: overallRate,
      rateReliable: rateReliable,
      evolution: evolution,
    };
  }

  // ---------------------------------------------------------------------------
  // Convenience: produce a complete view-model for the UI in one call. The UI
  // layer only renders this; it computes nothing. Applies the optional date
  // range to BOTH the list and the aggregate so the summary matches the rows.
  //
  //   input   = { snapshots, commitments }
  //   options = { comparison?, range?: { from, to } }
  // ---------------------------------------------------------------------------

  function buildHistoryView(input, options) {
    const opts = options || {};
    const all = buildHistory(input, opts);
    const filtered = filterByDateRange(all, opts.range);
    return {
      range: opts.range || { from: null, to: null },
      totalRecords: all.length,
      records: filtered,
      summary: aggregate(filtered),
    };
  }

  return {
    RecordReliabilityReason: RecordReliabilityReason,
    selectEvaluationSnapshot: selectEvaluationSnapshot,
    buildHistory: buildHistory,
    filterByDateRange: filterByDateRange,
    aggregate: aggregate,
    buildHistoryView: buildHistoryView,
  };
});
