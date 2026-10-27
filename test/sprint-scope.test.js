// test/sprint-scope.test.js
// Unit tests for the Sprint Scope pure engine (roadmap T2.2).
// Covers sprint identity normalization, period/day math (including unavailable
// dates), and scope-item building (dedupe, state/column separation, Feature flag).

const test = require('node:test');
const assert = require('node:assert/strict');

const SprintScope = require('../src/data/sprint-scope.js');

const { UNAVAILABLE, Source, PeriodState } = SprintScope;

test('normalizeSprint maps an API iteration (path -> iterationPath), tags source api', () => {
  const sprint = SprintScope.normalizeSprint({
    id: 'it-1',
    name: 'Sprint 42',
    path: 'Sda.Arms\\Sprint 42',
    startDate: '2024-01-01T00:00:00Z',
    finishDate: '2024-01-14T00:00:00Z',
    source: Source.API,
  });
  assert.equal(sprint.id, 'it-1');
  assert.equal(sprint.name, 'Sprint 42');
  assert.equal(sprint.iterationPath, 'Sda.Arms\\Sprint 42');
  assert.equal(sprint.source, Source.API);
  assert.equal(sprint.available, true);
});

test('normalizeSprint honors a manual source and iterationPath field', () => {
  const sprint = SprintScope.normalizeSprint({
    id: 'manual-1',
    name: 'Manual Sprint',
    iterationPath: 'Team\\Iter 1',
    startDate: '2024-02-01',
    finishDate: '2024-02-10',
    source: Source.MANUAL,
  });
  assert.equal(sprint.source, Source.MANUAL);
  assert.equal(sprint.iterationPath, 'Team\\Iter 1');
});

test('normalizeSprint with no id yields an explicit unavailable sprint, never a half-built one', () => {
  const sprint = SprintScope.normalizeSprint({ name: 'nameless' });
  assert.equal(sprint.id, null);
  assert.equal(sprint.available, false);
  assert.equal(sprint.source, Source.NONE);
  assert.equal(sprint.name, UNAVAILABLE);
});

test('normalizeSprint preserves missing dates as UNAVAILABLE (never invented)', () => {
  const sprint = SprintScope.normalizeSprint({ id: 'x', name: 'S' });
  assert.ok(SprintScope.isUnavailable(sprint.startDate));
  assert.ok(SprintScope.isUnavailable(sprint.finishDate));
});

test('computeSprintDays counts inclusive days and marks active within range', () => {
  const sprint = SprintScope.normalizeSprint({
    id: 's', name: 'S',
    startDate: '2024-01-01T00:00:00Z',
    finishDate: '2024-01-10T00:00:00Z',
  });
  const days = SprintScope.computeSprintDays(sprint, new Date('2024-01-04T12:00:00Z'));
  assert.equal(days.totalDays, 10); // 1..10 inclusive
  assert.equal(days.state, PeriodState.ACTIVE);
  assert.equal(days.elapsedDays, 4); // days 1,2,3,4
  assert.equal(days.remainingDays, 6);
});

test('computeSprintDays clamps before start to elapsed 0 / state before', () => {
  const sprint = SprintScope.normalizeSprint({
    id: 's', name: 'S',
    startDate: '2024-06-01T00:00:00Z',
    finishDate: '2024-06-10T00:00:00Z',
  });
  const days = SprintScope.computeSprintDays(sprint, new Date('2024-05-20T00:00:00Z'));
  assert.equal(days.state, PeriodState.BEFORE);
  assert.equal(days.elapsedDays, 0);
  assert.equal(days.remainingDays, 10);
});

test('computeSprintDays clamps after finish to elapsed == total / state after', () => {
  const sprint = SprintScope.normalizeSprint({
    id: 's', name: 'S',
    startDate: '2024-06-01T00:00:00Z',
    finishDate: '2024-06-10T00:00:00Z',
  });
  const days = SprintScope.computeSprintDays(sprint, new Date('2024-07-01T00:00:00Z'));
  assert.equal(days.state, PeriodState.AFTER);
  assert.equal(days.elapsedDays, 10);
  assert.equal(days.remainingDays, 0);
});

test('computeSprintDays returns unknown math when a boundary is missing', () => {
  const sprint = SprintScope.normalizeSprint({ id: 's', name: 'S', startDate: '2024-06-01' });
  const days = SprintScope.computeSprintDays(sprint, new Date('2024-06-02'));
  assert.equal(days.state, PeriodState.UNKNOWN);
  assert.equal(days.totalDays, null);
  assert.equal(days.elapsedDays, null);
  assert.equal(days.remainingDays, null);
});

test('computeSprintDays returns unknown when finish precedes start (garbage range)', () => {
  const sprint = SprintScope.normalizeSprint({
    id: 's', name: 'S',
    startDate: '2024-06-10T00:00:00Z',
    finishDate: '2024-06-01T00:00:00Z',
  });
  const days = SprintScope.computeSprintDays(sprint, new Date('2024-06-05'));
  assert.equal(days.state, PeriodState.UNKNOWN);
  assert.equal(days.totalDays, null);
});

test('buildScopeItems dedupes by stable id and keeps state separate from column', () => {
  const items = SprintScope.buildScopeItems([
    { id: 1, type: 'Bug', state: 'Closed', boardColumn: 'Doing' },
    { id: 1, type: 'Bug', state: 'Closed', boardColumn: 'Doing' }, // dup collapses
    { id: 2, type: 'Task', state: 'Active', column: 'Approved' },
  ]);
  assert.equal(items.length, 2);
  const one = items.find((i) => i.id === 1);
  // State is "Closed" but the board column is "Doing" — never conflated.
  assert.equal(one.state, 'Closed');
  assert.equal(one.column, 'Doing');
  const two = items.find((i) => i.id === 2);
  assert.equal(two.column, 'Approved'); // accepts DOM `column` field too
});

test('buildScopeItems flags Feature/Epic parents and respects custom featureTypes', () => {
  const defaults = SprintScope.buildScopeItems([
    { id: 10, type: 'Feature' },
    { id: 11, type: 'Epic' },
    { id: 12, type: 'User Story' },
  ]);
  assert.equal(defaults.find((i) => i.id === 10).isFeature, true);
  assert.equal(defaults.find((i) => i.id === 11).isFeature, true);
  assert.equal(defaults.find((i) => i.id === 12).isFeature, false);

  const custom = SprintScope.buildScopeItems(
    [{ id: 20, type: 'Initiative' }, { id: 21, type: 'Feature' }],
    { featureTypes: ['Initiative'] }
  );
  assert.equal(custom.find((i) => i.id === 20).isFeature, true);
  assert.equal(custom.find((i) => i.id === 21).isFeature, false);
});

test('buildScopeItems drops items without a stable id and tolerates UNAVAILABLE fields', () => {
  const items = SprintScope.buildScopeItems([
    { type: 'Task' }, // no id -> dropped
    { id: 5, type: UNAVAILABLE, state: UNAVAILABLE, boardColumn: UNAVAILABLE },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 5);
  assert.equal(items[0].type, null);
  assert.equal(items[0].state, null);
  assert.equal(items[0].column, null);
});
