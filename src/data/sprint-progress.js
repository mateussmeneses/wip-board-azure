// src/data/sprint-progress.js
// Sprint Progress engine — the pure calculation layer for Sprint Intelligence
// (PRODUCT_ROADMAP T2.3, "Sprint Progress"). It answers, honestly and without
// fabrication:
//   - How many items were PLANNED (the immutable baseline size)?
//   - How many of the baseline items are COMPLETED (reached the END column)?
//   - What is the BASELINE COMPLETION percentage (the primary metric)?
//   - How many are IN PROGRESS / NOT STARTED / UNKNOWN?
//   - How many were ADDED after the baseline / REMOVED from scope?
//   - What is the CURRENT-SCOPE progress (a separate, secondary metric)?
//   - Which data is INSUFFICIENT for a confident evaluation?
//
// Design
// ------
// This module is PURE: no DOM, no Chrome, no network. It never mutates its
// inputs and never touches a work item in Azure DevOps. It is a thin, testable
// layer ON TOP of the T2.2 engines — it REUSES
// `WIPBoardSprintBaseline.detectScopeChanges` (scope classification +
// configurable flow boundaries + Feature exclusion) and
// `WIPBoardSprintScope.buildScopeItems` (id dedupe, state-vs-column separation),
// and it NEVER reimplements the scope/persistence algorithms (goal section 1).
//
// What it ADDS on top of T2.2
// ---------------------------
//   1. The six-state classification the goal mandates (section 4):
//        Not Started / In Progress / Completed / Added After Baseline /
//        Removed From Scope / Unknown (Insufficient Evidence).
//      The T2.2 detector only produces planned/added/removed/completed/
//      inProgress and treats an unresolvable boundary as inProgress; here an
//      item whose column/state cannot be determined is UNKNOWN, never assumed
//      complete or even "in progress" (goal section 4 + 8).
//   2. The Baseline Completion metric (the PRIMARY one) and a SEPARATE
//      current-scope metric, plus the scope delta and the completions of
//      added items — kept distinct, never mixed (goal sections 2 & 3).
//   3. A reliability verdict: sufficient / partial / unavailable, so the UI can
//      avoid presenting a percentage as a complete evaluation when evidence is
//      missing (goal section 8).
//   4. Late-baseline detection (goal section 6): when the baseline was captured
//      after the sprint started, the result is flagged `lateBaseline` so the UI
//      labels it instead of pretending it is a start-of-sprint snapshot.
//
// Hierarchy / counting policy (goal section 5)
// --------------------------------------------
// Delivery counting is done at a SINGLE backlog level. Feature/Epic PARENTS are
// excluded from the counts by default (reusing the T2.2 `countFeatures` flow
// flag) and the exclusion is reported, never silent. A parent and its children
// are therefore NOT counted as independent deliveries unless the board is
// explicitly configured to count the parent level. The counting level is thus
// determined by the flow configuration, not assumed uniform across types.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardSprintProgress.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const isNode = typeof require === 'function';
  const deps = {
    scope: isNode ? require('./sprint-scope.js') : (root && root.WIPBoardSprintScope),
    baseline: isNode ? require('./sprint-baseline.js') : (root && root.WIPBoardSprintBaseline),
  };
  const api = factory(deps);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSprintProgress = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  const SprintScope = deps.scope;
  const SprintBaseline = deps.baseline;

  // The exhaustive per-item classification (goal section 4). An item is in
  // exactly one of these states.
  const ItemState = Object.freeze({
    NOT_STARTED: 'not-started',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    ADDED: 'added-after-baseline',
    REMOVED: 'removed-from-scope',
    UNKNOWN: 'unknown',
  });

  // The confidence verdict for the whole progress result (goal section 8).
  const Reliability = Object.freeze({
    // Every baseline item has a resolvable position: the baseline % is a
    // complete, trustworthy evaluation.
    SUFFICIENT: 'sufficient',
    // Some baseline items are UNKNOWN: a proven-completed share can still be
    // shown, but the percentage is not a complete evaluation.
    PARTIAL: 'partial',
    // No baseline exists (or nothing can be evaluated): no percentage at all.
    UNAVAILABLE: 'unavailable',
  });

  function isUsable(value) {
    if (value === undefined || value === null) return false;
    if (value && typeof value === 'object' && value.__wipFieldState === 'unavailable') return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  }

  // Resolve the boundary field (board column by default, System.State only on an
  // explicit opt-in) for a scope item, mirroring the baseline engine exactly so
  // completion is decided identically here (goal section 4: never confuse
  // System.State with the board column).
  function boundaryValueOf(item, flow) {
    if (!item) return null;
    if (flow.useState) return isUsable(item.state) ? item.state : null;
    return isUsable(item.column) ? item.column : null;
  }

  function resolveEpoch(value) {
    if (value == null) return null;
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value && typeof value === 'object') {
      if (Number.isFinite(value.epochMs)) return value.epochMs;
      if (isUsable(value.iso)) {
        const p = Date.parse(String(value.iso));
        return Number.isFinite(p) ? p : null;
      }
      return null;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function percent(numerator, denominator) {
    if (!denominator || denominator <= 0) return null;
    return Math.round((numerator / denominator) * 10000) / 100; // 2 decimals
  }

  // Index the current scope items by stable id through the SAME scope builder the
  // baseline uses, so dedupe, Feature exclusion and column/state separation are
  // identical. Returns a Map keyed by id plus the resolved flow.
  function indexCurrent(scopeItems, flow) {
    const byId = new Map();
    (Array.isArray(scopeItems) ? scopeItems : []).forEach(function (item) {
      if (!item || item.id == null) return;
      // Mirror detectScopeChanges exactly: a Feature/Epic parent is NOT a
      // delivery unless the flow explicitly counts it, so it must not land in the
      // measured scope (otherwise it would be mis-counted as an added delivery).
      if (item.isFeature === true && !flow.countFeatures) return;
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return byId;
  }

  // Compute the full sprint progress result from an immutable baseline + the
  // current scope. This is the engine's single entry point.
  //
  //   input: {
  //     baseline     : the frozen baseline record (createBaseline output) OR a
  //                    stored baseline-record { baseline, savedAt } — both are
  //                    accepted so the caller can pass the store record directly.
  //     currentItems : the current scope items (raw work items or scope items).
  //     flowConfig   : optional flow override; defaults to the baseline's flow.
  //     sprintStart  : the sprint start date (Date | ISO | epoch), used ONLY to
  //                    detect a late baseline; never used to invent history.
  //     capturedAt   : baseline capture time; defaults to the baseline record's
  //                    own capturedAt/savedAt.
  //   }
  //
  // Returns a plain, never-frozen result object (see the shape below). When no
  // usable baseline is present, `hasBaseline` is false and every percentage is
  // null with reliability UNAVAILABLE — the goal forbids using the filtered WIP
  // or the current scope as a stand-in denominator (section 6).
  function computeProgress(input) {
    const i = input || {};

    // Accept either a raw baseline or a stored baseline-record wrapper.
    const baseline = i.baseline && i.baseline.baseline && Array.isArray(i.baseline.baseline.plannedIds)
      ? i.baseline.baseline
      : (i.baseline && Array.isArray(i.baseline.plannedIds) ? i.baseline : null);

    const flow = SprintBaseline.resolveFlow(i.flowConfig || (baseline && baseline.flow));

    if (!baseline) {
      return emptyResult(flow);
    }

    // Normalize the raw current items ONCE through the scope builder so the
    // `isFeature` flag, id dedupe and state/column separation are set before the
    // T2.2 detector sees them (detectScopeChanges keys Feature exclusion off the
    // built `isFeature` flag, not the raw type). This keeps the Feature-exclusion
    // report accurate without reimplementing the scope algorithm.
    const scopeItems = SprintScope.buildScopeItems(i.currentItems, {
      featureTypes: flow && flow.featureTypes,
    });

    // Reuse the T2.2 classifier for planned/added/removed/completed/inProgress
    // and the Feature-exclusion report. We re-derive the six-state model on top,
    // because the detector folds "unknown position" into inProgress.
    const changes = SprintBaseline.detectScopeChanges(baseline, scopeItems, i.flowConfig || baseline.flow);

    const currentById = indexCurrent(scopeItems, flow);
    const plannedIds = Array.isArray(baseline.plannedIds) ? baseline.plannedIds : [];
    const plannedSet = new Set(plannedIds);
    const startColumn = flow.startColumn;
    const endColumn = flow.endColumn;

    // Per-id state classification. We walk the BASELINE ids first (so the
    // immutable commitment drives the primary metric), then the current scope
    // for additions.
    const perItem = [];
    const baselineBuckets = {
      notStarted: [], inProgress: [], completed: [], removed: [], unknown: [],
    };

    plannedSet.forEach(function (id) {
      const current = currentById.get(id);
      if (!current) {
        // In the baseline but gone from the current scope: REMOVED. Its
        // commitment still counts in the denominator (goal section 2) but it is
        // explicitly identified, never silently dropped.
        baselineBuckets.removed.push(id);
        perItem.push({ id: id, state: ItemState.REMOVED, inBaseline: true, boundary: null });
        return;
      }
      const boundary = boundaryValueOf(current, flow);
      if (boundary == null) {
        // Present but position cannot be determined: UNKNOWN, never assumed
        // complete or even started (goal sections 4 & 8).
        baselineBuckets.unknown.push(id);
        perItem.push({ id: id, state: ItemState.UNKNOWN, inBaseline: true, boundary: null });
        return;
      }
      if (SprintBaseline.sameColumn(boundary, endColumn)) {
        baselineBuckets.completed.push(id);
        perItem.push({ id: id, state: ItemState.COMPLETED, inBaseline: true, boundary: boundary });
        return;
      }
      if (SprintBaseline.sameColumn(boundary, startColumn)) {
        // Sitting at the START column: Not Started (past planning but no flow
        // progress yet). The START column is configurable per board.
        baselineBuckets.notStarted.push(id);
        perItem.push({ id: id, state: ItemState.NOT_STARTED, inBaseline: true, boundary: boundary });
        return;
      }
      // Resolvable, not END, not START: somewhere in the middle of the flow.
      baselineBuckets.inProgress.push(id);
      perItem.push({ id: id, state: ItemState.IN_PROGRESS, inBaseline: true, boundary: boundary });
    });

    // Additions: present now but NOT in the baseline (scope growth). Their
    // completion is tracked SEPARATELY so it never inflates the baseline metric
    // (goal section 3).
    const added = [];
    const addedCompleted = [];
    currentById.forEach(function (current, id) {
      if (plannedSet.has(id)) return;
      added.push(id);
      const boundary = boundaryValueOf(current, flow);
      const isDone = boundary != null && SprintBaseline.sameColumn(boundary, endColumn);
      if (isDone) addedCompleted.push(id);
      perItem.push({
        id: id,
        state: ItemState.ADDED,
        inBaseline: false,
        boundary: boundary,
        completed: isDone,
      });
    });

    const baselineTotal = plannedSet.size;
    const completedCount = baselineBuckets.completed.length;
    const unknownCount = baselineBuckets.unknown.length;
    const removedCount = baselineBuckets.removed.length;
    const inProgressCount = baselineBuckets.inProgress.length;
    const notStartedCount = baselineBuckets.notStarted.length;

    // PRIMARY metric (goal section 2): Baseline Completion %.
    //   = completed baseline items / total baseline items * 100
    // Removed and added items do NOT change this number; a removed item simply
    // is not completed, and the baseline total never shrinks.
    const baselineCompletionPct = percent(completedCount, baselineTotal);

    // Current-scope size and its completion (goal section 3), a SEPARATE metric.
    const currentTotal = currentById.size;
    let currentCompleted = 0;
    currentById.forEach(function (current) {
      const boundary = boundaryValueOf(current, flow);
      if (boundary != null && SprintBaseline.sameColumn(boundary, endColumn)) currentCompleted += 1;
    });
    const currentScopeCompletionPct = percent(currentCompleted, currentTotal);

    // Reliability verdict (goal section 8): a baseline item with no resolvable
    // position makes the baseline percentage an INCOMPLETE evaluation.
    let reliability = Reliability.SUFFICIENT;
    if (baselineTotal === 0) {
      reliability = Reliability.UNAVAILABLE;
    } else if (unknownCount > 0) {
      reliability = Reliability.PARTIAL;
    }

    // The proven-completed share: how much of the baseline is PROVABLY done,
    // alongside how many items remain unevaluable. This lets the UI show an
    // honest partial figure instead of a single optimistic/pessimistic number
    // (goal section 8).
    const evaluableCount = baselineTotal - unknownCount;
    const provenCompletionPct = baselineCompletionPct; // completed/total, always proven-only

    // Late baseline detection (goal section 6). If the baseline was captured
    // after the sprint start, say so; never recompute history from the current
    // state.
    const capturedAtMs = resolveEpoch(
      isUsable(i.capturedAt) ? i.capturedAt
        : (baseline.capturedAt != null ? baseline.capturedAt
          : (i.baseline && i.baseline.savedAt ? i.baseline.savedAt : null))
    );
    const sprintStartMs = resolveEpoch(i.sprintStart);
    let lateBaseline = false;
    if (capturedAtMs != null && sprintStartMs != null && capturedAtMs > sprintStartMs) {
      // Allow a one-day grace so a same-day capture is not flagged.
      lateBaseline = (capturedAtMs - sprintStartMs) > 24 * 60 * 60 * 1000;
    }

    return {
      hasBaseline: true,
      flow: { startColumn: startColumn, endColumn: endColumn, useState: flow.useState, countFeatures: flow.countFeatures },

      // PRIMARY metric block (baseline).
      baseline: {
        total: baselineTotal,
        completed: completedCount,
        notStarted: notStartedCount,
        inProgress: inProgressCount,
        removed: removedCount,
        unknown: unknownCount,
        evaluable: evaluableCount,
        completionPct: baselineCompletionPct,
        provenCompletionPct: provenCompletionPct,
      },

      // SECONDARY metric block (current scope), kept SEPARATE (goal section 3).
      current: {
        total: currentTotal,
        completed: currentCompleted,
        completionPct: currentScopeCompletionPct,
      },

      // Scope variation, reported on its own (goal sections 2 & 3).
      scopeChange: {
        added: added.length,
        removed: removedCount,
        addedCompleted: addedCompleted.length,
        delta: currentTotal - baselineTotal,
      },

      // Per-column distribution across the CURRENT scope (goal section 7).
      columns: countByColumn(currentById, flow),

      // Confidence (goal section 8).
      reliability: reliability,
      lateBaseline: lateBaseline,
      baselineCapturedAt: capturedAtMs != null ? { epochMs: capturedAtMs } : null,

      // Id arrays per state so the UI can list / drill in without recomputing.
      states: {
        notStarted: baselineBuckets.notStarted,
        inProgress: baselineBuckets.inProgress,
        completed: baselineBuckets.completed,
        added: added,
        addedCompleted: addedCompleted,
        removed: baselineBuckets.removed,
        unknown: baselineBuckets.unknown,
      },

      perItem: perItem,
      featuresExcluded: changes.featuresExcluded,
    };
  }

  // Count the current scope items per board column (or per System.State when the
  // flow opts in). Items with no resolvable boundary are grouped under a stable
  // `__unknown__` bucket so the UI can show "insufficient data" per stage.
  function countByColumn(currentById, flow) {
    const counts = new Map();
    let unknown = 0;
    currentById.forEach(function (item) {
      const boundary = boundaryValueOf(item, flow);
      if (boundary == null) {
        unknown += 1;
        return;
      }
      const key = String(boundary);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const list = [];
    counts.forEach(function (count, name) {
      list.push({ column: name, count: count });
    });
    // Stable, deterministic order: by descending count then name.
    list.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.column < b.column ? -1 : (a.column > b.column ? 1 : 0);
    });
    return { byColumn: list, unknown: unknown };
  }

  function emptyResult(flow) {
    return {
      hasBaseline: false,
      flow: { startColumn: flow.startColumn, endColumn: flow.endColumn, useState: flow.useState, countFeatures: flow.countFeatures },
      baseline: {
        total: 0, completed: 0, notStarted: 0, inProgress: 0, removed: 0, unknown: 0,
        evaluable: 0, completionPct: null, provenCompletionPct: null,
      },
      current: { total: 0, completed: 0, completionPct: null },
      scopeChange: { added: 0, removed: 0, addedCompleted: 0, delta: 0 },
      columns: { byColumn: [], unknown: 0 },
      reliability: Reliability.UNAVAILABLE,
      lateBaseline: false,
      baselineCapturedAt: null,
      states: {
        notStarted: [], inProgress: [], completed: [], added: [], addedCompleted: [], removed: [], unknown: [],
      },
      perItem: [],
      featuresExcluded: [],
    };
  }

  return {
    ItemState: ItemState,
    Reliability: Reliability,
    computeProgress: computeProgress,
  };
});
