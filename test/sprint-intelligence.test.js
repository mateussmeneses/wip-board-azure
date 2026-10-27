// test/sprint-intelligence.test.js
// Unit + integration tests for the Sprint Intelligence view-model (roadmap T2.2).
// Covers availability resolution (disabled / unauthenticated / unavailable /
// manual / api / no-sprint), the "never present simulated data as real" rule,
// and the composed view model (period, scope changes, goal).

const test = require('node:test');
const assert = require('node:assert/strict');

const SI = require('../src/data/sprint-intelligence.js');
const SprintScope = require('../src/data/sprint-scope.js');
const SprintBaseline = require('../src/data/sprint-baseline.js');

const { Availability } = SI;

function apiIteration() {
  return {
    id: 'it-1',
    name: 'Sprint 42',
    path: 'Team\\Sprint 42',
    startDate: '2024-01-01T00:00:00Z',
    finishDate: '2024-01-14T00:00:00Z',
  };
}

test('flag off with no manual sprint resolves to DISABLED and carries no sprint', () => {
  const r = SI.resolveAvailability({ featureFlagEnabled: false, authAvailable: false });
  assert.equal(r.state, Availability.DISABLED);
  assert.equal(r.sprint, null);
});

test('flag on but no auth resolves to UNAUTHENTICATED with no sprint', () => {
  const r = SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: false });
  assert.equal(r.state, Availability.UNAUTHENTICATED);
  assert.equal(r.sprint, null);
});

test('a 401/403 api error resolves to UNAUTHENTICATED', () => {
  const r = SI.resolveAvailability({
    featureFlagEnabled: true, authAvailable: true,
    apiError: { category: 'forbidden' },
  });
  assert.equal(r.state, Availability.UNAUTHENTICATED);
  assert.equal(r.sprint, null);
});

test('flag on, auth present, API responded with no iteration resolves to NO_SPRINT', () => {
  const r = SI.resolveAvailability({
    featureFlagEnabled: true, authAvailable: true,
    apiResponded: true, apiIteration: null,
  });
  assert.equal(r.state, Availability.NO_SPRINT);
  assert.equal(r.sprint, null);
});

test('flag on, auth present, nothing usable returned resolves to UNAVAILABLE', () => {
  const r = SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: true });
  assert.equal(r.state, Availability.UNAVAILABLE);
  assert.equal(r.sprint, null);
});

test('a resolved API iteration yields state API with a real sprint', () => {
  const r = SI.resolveAvailability({
    featureFlagEnabled: true, authAvailable: true, apiIteration: apiIteration(),
  });
  assert.equal(r.state, Availability.API);
  assert.equal(r.sprint.id, 'it-1');
  assert.equal(r.sprint.source, SprintScope.Source.API);
});

test('a manual sprint is honored even when the flag is off (explicit user data)', () => {
  const r = SI.resolveAvailability({
    featureFlagEnabled: false,
    manualSprint: { id: 'm-1', name: 'Manual', startDate: '2024-01-01', finishDate: '2024-01-10' },
  });
  assert.equal(r.state, Availability.MANUAL);
  assert.equal(r.sprint.source, SprintScope.Source.MANUAL);
});

test('buildViewModel marks dataReal false for every unavailable state and carries no sprint', () => {
  [
    SI.resolveAvailability({ featureFlagEnabled: false }),
    SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: false }),
    SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: true }),
  ].forEach((availability) => {
    const vm = SI.buildViewModel({ availability, currentItems: [] });
    assert.equal(vm.dataReal, false);
    assert.equal(vm.sprint, null);
    assert.equal(vm.days.state, SprintScope.PeriodState.UNKNOWN);
    assert.equal(vm.changes, null);
  });
});

test('buildViewModel for an API sprint computes real period math and marks dataReal', () => {
  const vm = SI.buildViewModel({
    availability: SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: true, apiIteration: apiIteration() }),
    currentItems: [{ id: 1, column: 'Approved' }],
    now: new Date('2024-01-07T00:00:00Z'),
  });
  assert.equal(vm.dataReal, true);
  assert.equal(vm.sprint.name, 'Sprint 42');
  assert.equal(vm.days.totalDays, 14);
  assert.equal(vm.days.elapsedDays, 7);
  assert.equal(vm.currentScopeCount, 1);
});

test('buildViewModel composes scope changes when a baseline record is present', () => {
  const baseline = SprintBaseline.createBaseline(
    { id: 'it-1' },
    SprintScope.buildScopeItems([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }]),
    null,
    {}
  );
  const vm = SI.buildViewModel({
    availability: SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: true, apiIteration: apiIteration() }),
    baselineRecord: { baseline, savedAt: { iso: '2024-01-01T00:00:00Z' } },
    currentItems: [
      { id: 1, column: 'Closed' }, // completed
      { id: 3, column: 'Approved' }, // added
    ],
    now: new Date('2024-01-07T00:00:00Z'),
  });
  assert.equal(vm.hasBaseline, true);
  assert.deepEqual(vm.changes.completed, [1]);
  assert.deepEqual(vm.changes.added, [3]);
  assert.deepEqual(vm.changes.removed, [2]);
});

test('buildViewModel surfaces a stored goal with its revision count', () => {
  const vm = SI.buildViewModel({
    availability: SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: true, apiIteration: apiIteration() }),
    currentItems: [],
    goalRecord: {
      goal: { objective: 'Deliver', description: '', successCriteria: ['a'], priorities: [] },
      revision: 2,
      revisions: [{}, {}],
      updatedAt: { iso: '2024-01-05T00:00:00Z' },
    },
  });
  assert.equal(vm.hasGoal, true);
  assert.equal(vm.goal.objective, 'Deliver');
  assert.equal(vm.goal.revision, 2);
  assert.equal(vm.goal.revisionCount, 2);
});

test('buildViewModel without a baseline reports hasBaseline false and null changes', () => {
  const vm = SI.buildViewModel({
    availability: SI.resolveAvailability({ featureFlagEnabled: true, authAvailable: true, apiIteration: apiIteration() }),
    currentItems: [{ id: 1, column: 'Approved' }],
  });
  assert.equal(vm.hasBaseline, false);
  assert.equal(vm.changes, null);
});

test('view model does not claim scope removals when current capture is incomplete', () => {
  const base = SprintBaseline.createBaseline(
    { id: 'it-1' }, SprintScope.buildScopeItems([{id:1,column:'Approved'},{id:2,column:'Approved'}]),
    null, {}
  );
  const vm = SI.buildViewModel({ baselineRecord: { baseline: base },
    currentItems: [{id:1,column:'Closed'}], currentComplete: false });
  assert.equal(vm.hasBaseline, true);
  assert.equal(vm.currentScopeComplete, false);
  assert.equal(vm.changes, null);
});
