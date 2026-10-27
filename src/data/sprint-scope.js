// src/data/sprint-scope.js
// Sprint Scope model — the pure engine for Sprint Intelligence (PRODUCT_ROADMAP
// T2.2, "Sprint atual" + "Escopo inicial").
//
// Purpose
// -------
// This module turns raw sprint inputs (an iteration from the read-only ADO API,
// or a manually configured sprint) into a stable, honest scope model and the
// day-count math the UI needs. It is PURE: no DOM, no Chrome, no network. Every
// value is computed from the inputs handed to it so each edge case is testable
// with plain objects.
//
// What it produces
// ----------------
//   1. normalizeSprint(input)        -> a stable sprint identity:
//        { id, name, iterationPath, startDate, finishDate, source, available }
//      Missing dates/fields are kept as UNAVAILABLE (never invented), mirroring
//      the API contracts' sentinel so an incomplete sprint degrades honestly.
//
//   2. computeSprintDays(sprint, now) -> period math:
//        { totalDays, elapsedDays, remainingDays, state } with state one of
//        'before' | 'active' | 'after' | 'unknown'. When dates are unavailable
//        the math is null and state is 'unknown' — never a fabricated 0.
//
//   3. buildScopeItems(workItems)     -> the scope item list keyed by STABLE id,
//      de-duplicated, with the fields the baseline/diff need (id, type, state,
//      column kept DISTINCT from state, parentId). Feature parents are flagged so
//      the counting rule (goal section 4) can treat them explicitly.
//
// Correctness rules the goal calls out:
//   - System.State is NEVER conflated with the visual board column; both are
//     stored separately on each item.
//   - Unavailable data is surfaced as UNAVAILABLE, never as a real value.
//   - Stable work item ids are the only identity; duplicates collapse.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardSprintScope.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSprintScope = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // A frozen sentinel meaning "this value was not provided". Shape-compatible
  // with the API contracts' UNAVAILABLE and the snapshot store's usability check
  // so a sprint sourced from the API or from manual config degrades identically.
  const UNAVAILABLE = Object.freeze({ __wipFieldState: 'unavailable' });

  function isUnavailable(value) {
    return value === UNAVAILABLE ||
      !!(value && typeof value === 'object' && value.__wipFieldState === 'unavailable');
  }

  function isUsable(value) {
    return value !== undefined && value !== null && !isUnavailable(value);
  }

  // Where a sprint came from. 'api' = read-only ADO iteration; 'manual' = user
  // configured locally; 'none' = no sprint identified (team with no active one).
  const Source = Object.freeze({
    API: 'api',
    MANUAL: 'manual',
    NONE: 'none',
  });

  // Day-count lifecycle relative to `now`. 'unknown' when dates are missing.
  const PeriodState = Object.freeze({
    BEFORE: 'before',
    ACTIVE: 'active',
    AFTER: 'after',
    UNKNOWN: 'unknown',
  });

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function keep(value) {
    return isUsable(value) && String(value).trim() !== '' ? value : UNAVAILABLE;
  }

  // Parse a date-ish input to epoch ms, or null when it cannot be parsed. Accepts
  // ISO strings (the API shape) and Date instances; rejects everything else so a
  // garbage value never becomes a real boundary.
  function toEpoch(value) {
    if (!isUsable(value)) return null;
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Normalize a sprint identity from either an API iteration (ado-contracts
  // normalizeIteration shape) or a manual config object. Both share the field
  // names used here; the caller tags the source.
  //
  //   input: {
  //     id, name,
  //     path | iterationPath,
  //     startDate, finishDate,
  //     source?  ('api' | 'manual')
  //   }
  //
  // Returns a frozen sprint. `available` is true only when an id is present; a
  // sprint with no id (e.g. selectCurrentIteration returned null) normalizes to
  // an explicit "no sprint" model rather than a half-built one.
  function normalizeSprint(input) {
    if (!input || typeof input !== 'object' || !isUsable(input.id)) {
      return Object.freeze({
        id: null,
        name: UNAVAILABLE,
        iterationPath: UNAVAILABLE,
        startDate: UNAVAILABLE,
        finishDate: UNAVAILABLE,
        source: Source.NONE,
        available: false,
      });
    }
    const source = input.source === Source.MANUAL
      ? Source.MANUAL
      : (input.source === Source.API ? Source.API : Source.API);
    return Object.freeze({
      id: input.id,
      name: keep(input.name),
      // Accept either `iterationPath` (manual) or `path` (API contract).
      iterationPath: keep(isUsable(input.iterationPath) ? input.iterationPath : input.path),
      startDate: keep(input.startDate),
      finishDate: keep(input.finishDate),
      source: source,
      available: true,
    });
  }

  // Compute period math for a sprint relative to `now` (Date or epoch ms).
  // Inclusive day counting: a sprint whose start and finish fall on the same day
  // has totalDays === 1. elapsed/remaining are clamped to [0, totalDays].
  //
  // Returns { totalDays, elapsedDays, remainingDays, state }. All numbers are
  // null and state is 'unknown' when either boundary is missing — the goal
  // forbids inventing unavailable information.
  function computeSprintDays(sprint, now) {
    const start = toEpoch(sprint && sprint.startDate);
    const finish = toEpoch(sprint && sprint.finishDate);
    const current = now instanceof Date ? now.getTime()
      : (typeof now === 'number' && Number.isFinite(now) ? now : Date.now());

    if (start == null || finish == null || finish < start) {
      return { totalDays: null, elapsedDays: null, remainingDays: null, state: PeriodState.UNKNOWN };
    }

    // Count whole days inclusive of both boundaries.
    const totalDays = Math.floor((finish - start) / MS_PER_DAY) + 1;

    let state = PeriodState.ACTIVE;
    if (current < start) state = PeriodState.BEFORE;
    else if (current > finish) state = PeriodState.AFTER;

    // elapsed: whole days since start, clamped; a sprint not yet started is 0.
    let elapsedDays;
    if (current < start) {
      elapsedDays = 0;
    } else if (current > finish) {
      elapsedDays = totalDays;
    } else {
      elapsedDays = Math.min(totalDays, Math.floor((current - start) / MS_PER_DAY) + 1);
    }

    const remainingDays = Math.max(0, totalDays - elapsedDays);

    return {
      totalDays: totalDays,
      elapsedDays: elapsedDays,
      remainingDays: remainingDays,
      state: state,
    };
  }

  // Build the scope item list from normalized work items (ado-contracts
  // WorkItem[] or any { id, type, state, boardColumn, parentId }[]). The result
  // is de-duplicated by stable id (first occurrence wins) and carries only the
  // fields the baseline and change detector need.
  //
  // Each item keeps `state` (System.State) and `column` (the visual board
  // column) SEPARATELY. `isFeature` flags a parent container type so the
  // counting rule can exclude it from independent-delivery counts unless an
  // explicit rule says otherwise (goal section 4).
  function buildScopeItems(workItems, options) {
    const opts = options || {};
    // Types that represent a container/parent rather than a deliverable leaf.
    // Configurable so other process templates (Agile/Scrum/CMMI) work.
    const featureTypes = normalizeTypeSet(
      Array.isArray(opts.featureTypes) && opts.featureTypes.length
        ? opts.featureTypes
        : ['Feature', 'Epic']
    );

    const list = Array.isArray(workItems) ? workItems : [];
    const seen = new Set();
    const items = [];

    list.forEach(function (raw) {
      if (!raw || typeof raw !== 'object' || !isUsable(raw.id)) return;
      if (seen.has(raw.id)) return;
      seen.add(raw.id);

      const type = isUsable(raw.type) ? String(raw.type) : null;
      const item = {
        id: raw.id,
        type: type,
        // System.State kept distinct from the board column.
        state: isUsable(raw.state) ? String(raw.state) : null,
        // The visual board column, when present. Accept `boardColumn` (API) or
        // `column` (DOM reader / snapshot item).
        column: isUsable(raw.boardColumn) ? String(raw.boardColumn)
          : (isUsable(raw.column) ? String(raw.column) : null),
        parentId: isUsable(raw.parentId) ? raw.parentId : null,
        isFeature: type ? featureTypes.has(normalizeType(type)) : false,
      };
      items.push(item);
    });

    return items;
  }

  function normalizeType(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function normalizeTypeSet(types) {
    const set = new Set();
    (types || []).forEach(function (t) {
      const n = normalizeType(t);
      if (n) set.add(n);
    });
    return set;
  }

  return {
    UNAVAILABLE: UNAVAILABLE,
    isUnavailable: isUnavailable,
    isUsable: isUsable,
    Source: Source,
    PeriodState: PeriodState,
    normalizeSprint: normalizeSprint,
    computeSprintDays: computeSprintDays,
    buildScopeItems: buildScopeItems,
  };
});
