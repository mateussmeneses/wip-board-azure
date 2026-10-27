// test/sprint-progress.test.js
// Unit tests for the Sprint Progress engine (roadmap T2.3). Covers the scenarios
// in the task's section 9: empty sprint, a 20/12 baseline, additions, removals,
// completion of an added item, a removed item before completion, all/none
// completed, unknown data, configurable + renamed start/end columns, State vs
// Board column, duplicate ids, parent/children in the same sprint, different
// org/team/project (scope isolation of the inputs), late baseline, incomplete
// snapshot, API disabled, scope changes preserving the baseline.

const test = require('node:test');
const assert = require('node:assert/strict');

const SprintProgress = require('../src/data/sprint-progress.js');
const SprintBaseline = require('../src/data/sprint-baseline.js');
const SprintScope = require('../src/data/sprint-scope.js');

const { ItemState, Reliability } = SprintProgress;

// Helper: build an immutable baseline from a list of {id,column,...} items.
function baselineOf(items, flowConfig, meta) {
  return SprintBaseline.createBaseline(
    { id: 's1', iterationPath: 'T\\S1' },
    SprintScope.buildScopeItems(items, { featureTypes: flowConfig && flowConfig.featureTypes }),
    flowConfig || null,
    meta || { capturedAt: new Date('2024-01-01T00:00:00Z'), source: 'api' }
  );
}

// Helper: generate N ids 1..N all in the START column (Approved by default).
function plannedItems(n, column) {
  const col = column || 'Approved';
  const list = [];
  for (let k = 1; k <= n; k += 1) list.push({ id: k, type: 'User Story', column: col });
  return list;
}

test('empty sprint: no baseline, no percentage, reliability unavailable', () => {
  const r = SprintProgress.computeProgress({ baseline: null, currentItems: [] });
  assert.equal(r.hasBaseline, false);
  assert.equal(r.baseline.total, 0);
  assert.equal(r.baseline.completionPct, null);
  assert.equal(r.current.completionPct, null);
  assert.equal(r.reliability, Reliability.UNAVAILABLE);
});

test('baseline of 20 with 12 completed yields 60% primary completion', () => {
  const base = baselineOf(plannedItems(20));
  // Move 12 of the 20 baseline ids to the END column (Closed); rest stay Approved.
  const current = [];
  for (let k = 1; k <= 20; k += 1) {
    current.push({ id: k, type: 'User Story', column: k <= 12 ? 'Closed' : 'Approved' });
  }
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.total, 20);
  assert.equal(r.baseline.completed, 12);
  assert.equal(r.baseline.completionPct, 60);
  assert.equal(r.reliability, Reliability.SUFFICIENT);
});

test('additions are counted separately and never inflate baseline completion', () => {
  const base = baselineOf(plannedItems(20));
  const current = [];
  for (let k = 1; k <= 20; k += 1) current.push({ id: k, column: k <= 12 ? 'Closed' : 'Approved' });
  // Add 5 new ids (21..25), two already in Closed.
  for (let k = 21; k <= 25; k += 1) current.push({ id: k, column: k <= 22 ? 'Closed' : 'Development' });
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completionPct, 60); // unchanged by additions
  assert.equal(r.scopeChange.added, 5);
  assert.equal(r.scopeChange.addedCompleted, 2);
  assert.equal(r.scopeChange.delta, 5);
});

test('removals keep the baseline denominator and are identified explicitly', () => {
  const base = baselineOf(plannedItems(20));
  const current = [];
  // 12 completed; remove ids 19 and 20 from the current scope entirely.
  for (let k = 1; k <= 18; k += 1) current.push({ id: k, column: k <= 12 ? 'Closed' : 'Approved' });
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.total, 20); // denominator unchanged
  assert.equal(r.baseline.completed, 12);
  assert.equal(r.baseline.completionPct, 60); // stays 60% (goal example)
  assert.equal(r.scopeChange.removed, 2);
  assert.deepEqual(r.states.removed.sort((a, b) => a - b), [19, 20]);
});

test('completing an added item counts only toward the current scope / additions', () => {
  const base = baselineOf(plannedItems(2));
  const current = [
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
    { id: 99, column: 'Closed' }, // added AND completed
  ];
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completed, 0);
  assert.equal(r.baseline.completionPct, 0);
  assert.equal(r.scopeChange.added, 1);
  assert.equal(r.scopeChange.addedCompleted, 1);
  assert.equal(r.current.completed, 1); // one of the three current items is done
});

test('an item removed before completion is Removed, not Completed', () => {
  const base = baselineOf([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }]);
  const current = [{ id: 1, column: 'Development' }]; // id 2 removed mid-flight
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.removed, 1);
  assert.equal(r.baseline.completed, 0);
  assert.deepEqual(r.states.removed, [2]);
});

test('all baseline items completed yields 100%', () => {
  const base = baselineOf(plannedItems(4));
  const current = plannedItems(4).map((it) => ({ id: it.id, column: 'Closed' }));
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completionPct, 100);
  assert.equal(r.reliability, Reliability.SUFFICIENT);
});

test('no baseline items completed yields 0% (not null)', () => {
  const base = baselineOf(plannedItems(4));
  const current = plannedItems(4).map((it) => ({ id: it.id, column: 'Approved' }));
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completionPct, 0);
  assert.equal(r.baseline.notStarted, 4);
});

test('unknown data: unresolvable position is Unknown, reliability partial', () => {
  const base = baselineOf(plannedItems(4));
  const current = [
    { id: 1, column: 'Closed' },
    { id: 2, column: 'Development' },
    { id: 3, column: SprintScope.UNAVAILABLE }, // unknown
    { id: 4, column: null }, // unknown
  ];
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.unknown, 2);
  assert.equal(r.baseline.completed, 1);
  assert.equal(r.baseline.evaluable, 2);
  assert.equal(r.reliability, Reliability.PARTIAL);
  // The percentage is the proven-only share (1 of 4), never inflated.
  assert.equal(r.baseline.completionPct, 25);
  assert.deepEqual(r.states.unknown.sort((a, b) => a - b), [3, 4]);
});

test('configurable start/end columns drive classification', () => {
  const flow = { startColumn: 'Backlog', endColumn: 'Done' };
  const base = baselineOf(plannedItems(3, 'Backlog'), flow);
  const current = [
    { id: 1, column: 'Done' },
    { id: 2, column: 'Backlog' },
    { id: 3, column: 'InDev' },
  ];
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current, flowConfig: flow });
  assert.equal(r.flow.endColumn, 'Done');
  assert.equal(r.baseline.completed, 1);
  assert.equal(r.baseline.notStarted, 1); // id 2 at Backlog (start)
  assert.equal(r.baseline.inProgress, 1); // id 3 in the middle
});

test('renamed columns are matched by normalization (accents/case/spacing)', () => {
  const flow = { startColumn: 'Em Análise', endColumn: 'Concluído' };
  const base = baselineOf([{ id: 1, column: 'Em Análise' }], flow);
  const r = SprintProgress.computeProgress({
    baseline: base,
    currentItems: [{ id: 1, column: '  concluido ' }], // same column, different form
    flowConfig: flow,
  });
  assert.equal(r.baseline.completed, 1);
  assert.equal(r.baseline.completionPct, 100);
});

test('System.State is NOT treated as the board column by default', () => {
  const base = baselineOf([{ id: 1, column: 'Development', state: 'New' }]);
  const r = SprintProgress.computeProgress({
    baseline: base,
    // State says Closed, but the board column is Development: NOT completed.
    currentItems: [{ id: 1, column: 'Development', state: 'Closed' }],
  });
  assert.equal(r.baseline.completed, 0);
  assert.equal(r.baseline.inProgress, 1);
});

test('useState opt-in matches the END boundary against System.State', () => {
  const flow = { useState: true, endColumn: 'Closed', startColumn: 'New' };
  const base = baselineOf([{ id: 1, column: 'Development', state: 'New' }], flow);
  const r = SprintProgress.computeProgress({
    baseline: base,
    currentItems: [{ id: 1, column: 'Development', state: 'Closed' }],
    flowConfig: flow,
  });
  assert.equal(r.baseline.completed, 1);
});

test('duplicate ids collapse and are not double-counted', () => {
  const base = baselineOf([{ id: 1, column: 'Approved' }, { id: 1, column: 'Approved' }]);
  assert.deepEqual(base.plannedIds, [1]);
  const r = SprintProgress.computeProgress({
    baseline: base,
    currentItems: [{ id: 1, column: 'Closed' }, { id: 1, column: 'Approved' }],
  });
  assert.equal(r.baseline.total, 1);
  assert.equal(r.baseline.completed, 1); // first occurrence wins
  assert.equal(r.current.total, 1);
});

test('parent Features are excluded; only child deliveries are counted by default', () => {
  const base = baselineOf([
    { id: 10, type: 'Feature', column: 'Approved' },
    { id: 11, type: 'User Story', parentId: 10, column: 'Approved' },
    { id: 12, type: 'User Story', parentId: 10, column: 'Approved' },
  ]);
  // Only the two stories are in the baseline; the Feature is reported excluded.
  assert.deepEqual(base.plannedIds.slice().sort((a, b) => a - b), [11, 12]);
  assert.deepEqual(base.featuresExcluded, [10]);
  const r = SprintProgress.computeProgress({
    baseline: base,
    currentItems: [
      { id: 10, type: 'Feature', column: 'Closed' }, // parent "done" must not count
      { id: 11, type: 'User Story', column: 'Closed' },
      { id: 12, type: 'User Story', column: 'Development' },
    ],
  });
  assert.equal(r.baseline.total, 2);
  assert.equal(r.baseline.completed, 1);
  assert.deepEqual(r.featuresExcluded, [10]);
});

test('Features counted as deliveries only when countFeatures is explicit', () => {
  const flow = { countFeatures: true };
  const base = baselineOf([
    { id: 10, type: 'Feature', column: 'Approved' },
    { id: 11, type: 'User Story', column: 'Approved' },
  ], flow);
  assert.deepEqual(base.plannedIds.slice().sort((a, b) => a - b), [10, 11]);
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: [
    { id: 10, type: 'Feature', column: 'Closed' },
    { id: 11, type: 'User Story', column: 'Approved' },
  ], flowConfig: flow });
  assert.equal(r.baseline.total, 2);
  assert.equal(r.baseline.completed, 1);
});

test('inputs from different org/team/project are not mixed by the engine', () => {
  // The engine measures ONE baseline against ONE current scope; ids from another
  // team simply are not in the baseline and never leak into the baseline metric.
  const base = baselineOf(plannedItems(2));
  const current = [
    { id: 1, column: 'Closed' },
    { id: 2, column: 'Approved' },
    { id: 777, column: 'Closed' }, // an item from a different team's scope
  ];
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.total, 2);
  assert.equal(r.baseline.completed, 1);
  assert.equal(r.scopeChange.added, 1); // 777 is "added" relative to THIS baseline
});

test('late baseline is flagged when captured after the sprint start', () => {
  const base = baselineOf(plannedItems(2), null, {
    capturedAt: new Date('2024-01-10T00:00:00Z'), // 9 days after start
    source: 'manual',
  });
  const r = SprintProgress.computeProgress({
    baseline: base,
    currentItems: plannedItems(2),
    sprintStart: '2024-01-01T00:00:00Z',
  });
  assert.equal(r.lateBaseline, true);
});

test('a same-day capture is NOT flagged as a late baseline', () => {
  const base = baselineOf(plannedItems(2), null, {
    capturedAt: new Date('2024-01-01T06:00:00Z'),
    source: 'manual',
  });
  const r = SprintProgress.computeProgress({
    baseline: base,
    currentItems: plannedItems(2),
    sprintStart: '2024-01-01T00:00:00Z',
  });
  assert.equal(r.lateBaseline, false);
});

test('incomplete snapshot: missing items surface as removed/unknown, never done', () => {
  const base = baselineOf(plannedItems(3));
  // A partial snapshot only observed id 1; ids 2,3 absent and id 1 has no column.
  const current = [{ id: 1, column: SprintScope.UNAVAILABLE }];
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completed, 0);
  assert.equal(r.baseline.unknown, 1); // id 1 present, position unknown
  assert.equal(r.baseline.removed, 2); // ids 2,3 absent
  assert.equal(r.reliability, Reliability.PARTIAL);
});

test('API disabled: progress still computed from the local baseline + DOM scope', () => {
  // The engine is transport-agnostic: it only needs a baseline + current items,
  // so an API-off runtime (DOM scope + manual sprint) computes progress fine.
  const base = baselineOf(plannedItems(5));
  const current = plannedItems(5).map((it, idx) => ({ id: it.id, column: idx < 3 ? 'Closed' : 'Approved' }));
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completionPct, 60);
});

test('scope changes never mutate the baseline', () => {
  const base = baselineOf(plannedItems(3));
  const before = JSON.stringify(base);
  SprintProgress.computeProgress({ baseline: base, currentItems: [{ id: 1, column: 'Closed' }, { id: 9, column: 'Closed' }] });
  SprintProgress.computeProgress({ baseline: base, currentItems: [{ id: 1, column: 'Approved' }] });
  assert.equal(JSON.stringify(base), before);
});

test('current-scope progress is a separate metric from baseline completion', () => {
  const base = baselineOf(plannedItems(10));
  const current = [];
  // 5 baseline done, 5 baseline approved, plus 4 added (3 done).
  for (let k = 1; k <= 10; k += 1) current.push({ id: k, column: k <= 5 ? 'Closed' : 'Approved' });
  for (let k = 11; k <= 14; k += 1) current.push({ id: k, column: k <= 13 ? 'Closed' : 'Development' });
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  assert.equal(r.baseline.completionPct, 50); // 5/10
  // current: 14 items, 8 done (5 baseline + 3 added) => ~57.14%
  assert.equal(r.current.total, 14);
  assert.equal(r.current.completed, 8);
  assert.equal(r.current.completionPct, 57.14);
  assert.notEqual(r.baseline.completionPct, r.current.completionPct); // kept distinct
});

test('per-column distribution reports counts and an unknown bucket', () => {
  const base = baselineOf(plannedItems(4));
  const current = [
    { id: 1, column: 'Closed' },
    { id: 2, column: 'Closed' },
    { id: 3, column: 'Development' },
    { id: 4, column: SprintScope.UNAVAILABLE },
  ];
  const r = SprintProgress.computeProgress({ baseline: base, currentItems: current });
  const closed = r.columns.byColumn.find((c) => c.column === 'Closed');
  assert.equal(closed.count, 2);
  assert.equal(r.columns.unknown, 1);
});

test('accepts a stored baseline-record wrapper { baseline, savedAt }', () => {
  const base = baselineOf(plannedItems(2));
  const record = { baseline: base, savedAt: { epochMs: Date.parse('2024-01-01T00:00:00Z') } };
  const r = SprintProgress.computeProgress({
    baseline: record,
    currentItems: [{ id: 1, column: 'Closed' }, { id: 2, column: 'Approved' }],
  });
  assert.equal(r.hasBaseline, true);
  assert.equal(r.baseline.completed, 1);
});
