// test/sprint-baseline.test.js
// Unit tests for the Sprint Baseline + scope-change detector (roadmap T2.2).
// Covers immutable baseline creation, configurable flow boundaries, Feature
// counting rule, and the planned/added/removed/completed/inProgress classification.

const test = require('node:test');
const assert = require('node:assert/strict');

const SprintBaseline = require('../src/features/sprint/sprint-baseline.js');
const SprintScope = require('../src/features/sprint/sprint-scope.js');

function scope(items) {
  return SprintScope.buildScopeItems(items);
}

test('createBaseline freezes planned ids + start columns and is immutable', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1', iterationPath: 'T\\S1' },
    scope([
      { id: 1, type: 'Bug', column: 'Approved', state: 'New' },
      { id: 2, type: 'Task', column: 'Doing', state: 'Active' },
    ]),
    null,
    { capturedAt: new Date('2024-01-01T00:00:00Z'), source: 'api' }
  );
  assert.deepEqual(base.plannedIds.slice().sort(), [1, 2]);
  assert.equal(base.sprintId, 's1');
  assert.equal(base.source, 'api');
  assert.ok(Object.isFrozen(base));
  assert.throws(() => { base.plannedIds.push(99); });
  const one = base.plannedItems.find((p) => p.id === 1);
  assert.equal(one.startColumn, 'Approved');
  assert.equal(one.startState, 'New');
});

test('createBaseline excludes Feature/Epic parents by default and reports them', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([
      { id: 1, type: 'Feature', column: 'Approved' },
      { id: 2, type: 'User Story', column: 'Approved' },
    ]),
    null,
    {}
  );
  assert.deepEqual(base.plannedIds, [2]);
  assert.deepEqual(base.featuresExcluded, [1]);
});

test('createBaseline counts Features when flow.countFeatures is explicitly true', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, type: 'Feature', column: 'Approved' }]),
    { countFeatures: true },
    {}
  );
  assert.deepEqual(base.plannedIds, [1]);
  assert.deepEqual(base.featuresExcluded, []);
});

test('detectScopeChanges classifies planned / added / removed against the baseline', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([
      { id: 1, column: 'Approved' },
      { id: 2, column: 'Approved' },
      { id: 3, column: 'Approved' },
    ]),
    null,
    {}
  );
  // Current scope: 1 moved, 2 present, 3 removed, 9 is new (scope growth).
  const changes = SprintBaseline.detectScopeChanges(base, scope([
    { id: 1, column: 'Doing' },
    { id: 2, column: 'Approved' },
    { id: 9, column: 'Approved' },
  ]));
  assert.deepEqual(changes.planned.sort(), [1, 2]);
  assert.deepEqual(changes.added, [9]);
  assert.deepEqual(changes.removed, [3]);
  assert.equal(changes.summary.scopeDelta, 0); // 3 current - 3 baseline
  assert.equal(changes.summary.addedCount, 1);
  assert.equal(changes.summary.removedCount, 1);
});

test('detectScopeChanges marks items in the END column as completed (default Closed)', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }]),
    null,
    {}
  );
  const changes = SprintBaseline.detectScopeChanges(base, scope([
    { id: 1, column: 'Closed' },
    { id: 2, column: 'Doing' },
  ]));
  assert.deepEqual(changes.completed, [1]);
  assert.deepEqual(changes.inProgress, [2]);
});

test('detectScopeChanges honors configurable end column for other boards', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, column: 'Backlog' }]),
    { startColumn: 'Backlog', endColumn: 'Done' },
    {}
  );
  const changes = SprintBaseline.detectScopeChanges(base, scope([{ id: 1, column: 'Done' }]));
  assert.deepEqual(changes.completed, [1]);
  assert.equal(changes.flow.endColumn, 'Done');
});

test('detectScopeChanges does NOT confuse System.State with the board column by default', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, column: 'Doing', state: 'Closed' }]),
    null,
    {}
  );
  // State is "Closed" but the board column is "Doing": NOT completed by default.
  const changes = SprintBaseline.detectScopeChanges(base, scope([
    { id: 1, column: 'Doing', state: 'Closed' },
  ]));
  assert.deepEqual(changes.completed, []);
  assert.deepEqual(changes.inProgress, [1]);
});

test('detectScopeChanges can opt into matching the END boundary against System.State', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, column: 'Doing', state: 'Active' }]),
    { useState: true, endColumn: 'Closed' },
    {}
  );
  const changes = SprintBaseline.detectScopeChanges(base, scope([
    { id: 1, column: 'Doing', state: 'Closed' },
  ]), { useState: true, endColumn: 'Closed' });
  assert.deepEqual(changes.completed, [1]);
});

test('detectScopeChanges never mutates the baseline when cards move', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, column: 'Approved' }]),
    null,
    {}
  );
  const before = JSON.stringify(base);
  SprintBaseline.detectScopeChanges(base, scope([{ id: 1, column: 'Closed' }]));
  SprintBaseline.detectScopeChanges(base, scope([{ id: 1, column: 'Doing' }]));
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(base.plannedIds, [1]); // baseline unchanged
});

test('detectScopeChanges excludes Features from current scope by default too', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, type: 'User Story', column: 'Approved' }]),
    null,
    {}
  );
  const changes = SprintBaseline.detectScopeChanges(base, scope([
    { id: 1, type: 'User Story', column: 'Doing' },
    { id: 5, type: 'Feature', column: 'Approved' }, // excluded, not counted as added
  ]));
  assert.deepEqual(changes.added, []);
  assert.deepEqual(changes.featuresExcluded, [5]);
});

test('detectScopeChanges treats unavailable boundary value as in progress, not completed', () => {
  const base = SprintBaseline.createBaseline(
    { id: 's1' },
    scope([{ id: 1, column: 'Approved' }]),
    null,
    {}
  );
  const changes = SprintBaseline.detectScopeChanges(base, scope([
    { id: 1, column: SprintScope.UNAVAILABLE },
  ]));
  assert.deepEqual(changes.completed, []);
  assert.deepEqual(changes.inProgress, [1]);
});
