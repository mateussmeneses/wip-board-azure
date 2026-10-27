// src/data/sprint-intelligence.js
// Sprint Intelligence view-model — the pure composition layer (PRODUCT_ROADMAP
// T2.2). It assembles the sprint identity, period, goal, baseline and
// scope-change signals into ONE honest view model for the UI, WITHOUT touching
// the DOM, Chrome or the network itself. The caller supplies already-resolved
// inputs (an API iteration or manual sprint, the current scope items, a stored
// goal, a stored baseline); this module only reasons about them.
//
// Why a separate layer
// --------------------
// The goal demands that, when the API is disabled or unauthenticated, the UI
// shows an "unavailable" state or an explicit manual configuration — and NEVER
// presents simulated data as real. That decision is pure logic over the inputs'
// availability, so it lives here, fully unit-testable, and the DOM layer just
// renders the result.
//
// Availability states (the single source of truth for the UI):
//   DISABLED      : the API feature flag is off (default). No request was made.
//   UNAUTHENTICATED: the flag is on but no auth is available / a 401/403 occurred.
//   UNAVAILABLE   : the API was tried but returned nothing usable (network/empty).
//   MANUAL        : a manually configured sprint is in use (no official source).
//   API           : a sprint was resolved from the read-only API.
//   NO_SPRINT     : the source responded but the team has no current sprint.
//
// Only API and MANUAL (and NO_SPRINT, which is itself real information) represent
// real data. The three unavailable states carry NO fabricated sprint.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardSprintIntelligence.
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
    root.WIPBoardSprintIntelligence = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  const SprintScope = deps.scope;
  const SprintBaseline = deps.baseline;

  const Availability = Object.freeze({
    DISABLED: 'disabled',
    UNAUTHENTICATED: 'unauthenticated',
    UNAVAILABLE: 'unavailable',
    MANUAL: 'manual',
    API: 'api',
    NO_SPRINT: 'no-sprint',
  });

  // Decide the availability state from the resolution outcome the caller passes.
  //
  //   input: {
  //     featureFlagEnabled : boolean,
  //     authAvailable      : boolean,
  //     apiError           : { category } | null   (ado-errors projection),
  //     apiIteration       : normalized iteration | null,
  //     manualSprint       : manual sprint config | null,
  //   }
  //
  // Priority: a resolved API sprint wins; otherwise a manual sprint; otherwise an
  // explicit unavailable reason. The flag-off case is DISABLED even if a manual
  // sprint exists ONLY when no manual sprint is configured — a manual sprint is
  // always honored because it is explicit user data, never simulated.
  function resolveAvailability(input) {
    const i = input || {};

    // 1. An explicit manual sprint is real user-provided data; honor it first so
    //    the user can always plan without the API. (The API, when later enabled,
    //    can supersede it via a fresh resolution the caller performs.)
    const manual = normalizeManual(i.manualSprint);
    const api = i.apiIteration && i.apiIteration.id != null
      ? SprintScope.normalizeSprint(Object.assign({}, i.apiIteration, { source: SprintScope.Source.API }))
      : null;

    // 2. API result present -> API state (or NO_SPRINT handled by the caller when
    //    the API responded with no current iteration).
    if (api && api.available) {
      return { state: Availability.API, sprint: api };
    }

    // 3. Manual sprint present -> MANUAL state.
    if (manual && manual.available) {
      return { state: Availability.MANUAL, sprint: manual };
    }

    // 4. No sprint resolved: report WHY, carrying no fabricated sprint.
    if (i.featureFlagEnabled !== true) {
      return { state: Availability.DISABLED, sprint: null };
    }
    if (i.authAvailable !== true) {
      return { state: Availability.UNAUTHENTICATED, sprint: null };
    }
    if (i.apiError && (i.apiError.category === 'unauthorized' || i.apiError.category === 'forbidden')) {
      return { state: Availability.UNAUTHENTICATED, sprint: null };
    }
    if (i.apiResponded === true && !api) {
      // The API answered but there is no current iteration for the team.
      return { state: Availability.NO_SPRINT, sprint: null };
    }
    // Flag on, auth present, but nothing usable came back (network/empty/other).
    return { state: Availability.UNAVAILABLE, sprint: null };
  }

  function normalizeManual(manualSprint) {
    if (!manualSprint || typeof manualSprint !== 'object' || manualSprint.id == null) {
      return null;
    }
    return SprintScope.normalizeSprint(
      Object.assign({}, manualSprint, { source: SprintScope.Source.MANUAL })
    );
  }

  // Build the full Sprint Intelligence view model from already-resolved inputs.
  //
  //   input: {
  //     availability   : the resolveAvailability(...) result,
  //     currentItems   : scope items (WIPBoardSprintScope.buildScopeItems output
  //                      or raw work items) for the current sprint scope,
  //     goalRecord     : the stored sprint-goal record | null,
  //     baselineRecord : the stored sprint-baseline-record | null,
  //     flowConfig     : flow overrides for the change detector | null,
  //     now            : Date | epoch ms (period math anchor),
  //   }
  //
  // The model never fabricates: when the sprint is unavailable, `sprint` is null,
  // `days` is the unknown shape, and `changes` is null. When a baseline exists,
  // `changes` classifies the current scope against it; when it does not, the UI
  // offers to record one but reports nothing as planned/added yet.
  function buildViewModel(input) {
    const i = input || {};
    const availability = i.availability && typeof i.availability === 'object'
      ? i.availability
      : resolveAvailability(i);

    const sprint = availability.sprint || null;
    const dataReal = availability.state === Availability.API ||
      availability.state === Availability.MANUAL;

    const days = sprint
      ? SprintScope.computeSprintDays(sprint, i.now)
      : { totalDays: null, elapsedDays: null, remainingDays: null, state: SprintScope.PeriodState.UNKNOWN };

    // Current scope items, normalized through the scope builder so Feature flags
    // and column/state separation are consistent with the baseline engine.
    const currentItems = SprintScope.buildScopeItems(i.currentItems, {
      featureTypes: i.flowConfig && i.flowConfig.featureTypes,
    });

    const baselineRecord = i.baselineRecord && typeof i.baselineRecord === 'object'
      ? i.baselineRecord
      : null;
    const baseline = baselineRecord && baselineRecord.baseline ? baselineRecord.baseline : null;

    const currentScopeComplete = i.currentComplete !== false;
    let changes = null;
    // Presence in a partial DOM is observable; absence is not proof that
    // work left the sprint. Hide authoritative scope-change totals until a
    // complete read can establish membership.
    if (baseline && currentScopeComplete) {
      changes = SprintBaseline.detectScopeChanges(baseline, currentItems, i.flowConfig);
    }

    const goal = normalizeGoalView(i.goalRecord);

    return {
      availability: availability.state,
      // Whether the displayed sprint data is real (API/manual) vs absent. The UI
      // must label an unavailable state and never dress it up as live data.
      dataReal: dataReal,
      sprint: sprint,
      days: days,
      // The current, live scope size (informational). Distinct from the baseline.
      currentScopeCount: currentItems.length,
      currentScopeComplete: currentScopeComplete,
      baseline: baseline,
      baselineSavedAt: baselineRecord && baselineRecord.savedAt ? baselineRecord.savedAt : null,
      hasBaseline: !!baseline,
      changes: changes,
      goal: goal,
      hasGoal: !!goal,
    };
  }

  // Project a stored goal record into the small view shape the UI needs, exposing
  // the current content plus how many prior revisions exist (history indicator).
  function normalizeGoalView(goalRecord) {
    if (!goalRecord || typeof goalRecord !== 'object' || !goalRecord.goal) return null;
    const g = goalRecord.goal;
    return {
      objective: typeof g.objective === 'string' ? g.objective : '',
      description: typeof g.description === 'string' ? g.description : '',
      successCriteria: Array.isArray(g.successCriteria) ? g.successCriteria.slice() : [],
      priorities: Array.isArray(g.priorities) ? g.priorities.slice() : [],
      revision: typeof goalRecord.revision === 'number' ? goalRecord.revision : 0,
      revisionCount: Array.isArray(goalRecord.revisions) ? goalRecord.revisions.length : 0,
      updatedAt: goalRecord.updatedAt || null,
    };
  }

  return {
    Availability: Availability,
    resolveAvailability: resolveAvailability,
    buildViewModel: buildViewModel,
    normalizeGoalView: normalizeGoalView,
  };
});
