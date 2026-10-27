// test/sprint-goal-store.test.js
// Unit + persistence tests for the Sprint Goal + Baseline store (roadmap T2.2).
// Covers goal persistence with revision history, scope/sprint isolation, the
// once-only baseline rule, explicit re-baseline, incomplete-data handling, and
// the storage-failure path.

const test = require('node:test');
const assert = require('node:assert/strict');

const Store = require('../src/data/sprint-goal-store.js');
const SprintBaseline = require('../src/data/sprint-baseline.js');
const SprintScope = require('../src/data/sprint-scope.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const SCOPE = { organization: 'sda-iatec', project: 'Sda.Arms', team: 'Squad A', board: 'Board' };
const OTHER_SCOPE = { organization: 'sda-iatec', project: 'Sda.Arms', team: 'Squad B', board: 'Board' };

function makeStore(now) {
  return Store.createStore({ storage: createMockStorage(), now });
}

test('saveGoal creates revision 0 and getGoal reads it back', async () => {
  const store = makeStore();
  const rec = await store.saveGoal(SCOPE, 'sprint-1', {
    objective: 'Ship Sprint Intelligence',
    description: 'Deliver the base functional layer',
    successCriteria: ['tests green', 'docs updated'],
    priorities: ['sprint summary'],
  });
  assert.equal(rec.revision, 0);
  assert.equal(rec.goal.objective, 'Ship Sprint Intelligence');
  const read = await store.getGoal(SCOPE, 'sprint-1');
  assert.equal(read.goal.objective, 'Ship Sprint Intelligence');
  assert.deepEqual(read.goal.successCriteria, ['tests green', 'docs updated']);
});

test('saveGoal preserves the change history across edits (revisions archived)', async () => {
  const store = makeStore();
  await store.saveGoal(SCOPE, 'sprint-1', { objective: 'v1' });
  const r1 = await store.saveGoal(SCOPE, 'sprint-1', { objective: 'v2' });
  const r2 = await store.saveGoal(SCOPE, 'sprint-1', { objective: 'v3' });
  assert.equal(r2.revision, 2);
  assert.equal(r2.revisions.length, 2);
  assert.equal(r2.revisions[0].goal.objective, 'v1');
  assert.equal(r2.revisions[1].goal.objective, 'v2');
  assert.equal(r1.goal.objective, 'v2');
});

test('saveGoal with identical content is a no-op (no empty revision churn)', async () => {
  const store = makeStore();
  await store.saveGoal(SCOPE, 'sprint-1', { objective: 'same' });
  const again = await store.saveGoal(SCOPE, 'sprint-1', { objective: 'same' });
  assert.equal(again.revision, 0);
  assert.equal(again.revisions.length, 0);
});

test('saveGoal rejects an entirely empty goal', async () => {
  const store = makeStore();
  await assert.rejects(
    () => store.saveGoal(SCOPE, 'sprint-1', { objective: '', description: '', successCriteria: [], priorities: [] }),
    (e) => e.code === Store.ErrorCodes.INVALID_GOAL
  );
});

test('goals are isolated by scope and by sprint id', async () => {
  const store = makeStore();
  await store.saveGoal(SCOPE, 'sprint-1', { objective: 'A1' });
  await store.saveGoal(OTHER_SCOPE, 'sprint-1', { objective: 'B1' });
  await store.saveGoal(SCOPE, 'sprint-2', { objective: 'A2' });
  assert.equal((await store.getGoal(SCOPE, 'sprint-1')).goal.objective, 'A1');
  assert.equal((await store.getGoal(OTHER_SCOPE, 'sprint-1')).goal.objective, 'B1');
  assert.equal((await store.getGoal(SCOPE, 'sprint-2')).goal.objective, 'A2');
});

test('normalizeGoal accepts a newline/semicolon string for lists', () => {
  const g = Store.normalizeGoal({ objective: 'x', successCriteria: 'a\nb; c' });
  assert.deepEqual(g.successCriteria, ['a', 'b', 'c']);
});

test('saveBaseline persists once and refuses a silent second save (DUPLICATE)', async () => {
  const store = makeStore();
  const baseline = SprintBaseline.createBaseline(
    { id: 'sprint-1' },
    SprintScope.buildScopeItems([{ id: 1, column: 'Approved' }]),
    null,
    {}
  );
  const saved = await store.saveBaseline(SCOPE, 'sprint-1', baseline);
  assert.equal(saved.revision, 0);
  assert.deepEqual(saved.baseline.plannedIds, [1]);
  await assert.rejects(
    () => store.saveBaseline(SCOPE, 'sprint-1', baseline),
    (e) => e.code === Store.ErrorCodes.DUPLICATE
  );
});

test('replaceBaseline archives the prior baseline under previous[] (explicit re-baseline)', async () => {
  const store = makeStore();
  const b1 = SprintBaseline.createBaseline({ id: 'sprint-1' },
    SprintScope.buildScopeItems([{ id: 1, column: 'Approved' }]), null, {});
  const b2 = SprintBaseline.createBaseline({ id: 'sprint-1' },
    SprintScope.buildScopeItems([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }]), null, {});
  await store.saveBaseline(SCOPE, 'sprint-1', b1);
  const replaced = await store.replaceBaseline(SCOPE, 'sprint-1', b2);
  assert.equal(replaced.revision, 1);
  assert.equal(replaced.previous.length, 1);
  assert.deepEqual(replaced.previous[0].baseline.plannedIds, [1]);
  assert.deepEqual(replaced.baseline.plannedIds, [1, 2]);
});

test('replaceBaseline with no prior baseline behaves like a first save', async () => {
  const store = makeStore();
  const b = SprintBaseline.createBaseline({ id: 'sprint-1' },
    SprintScope.buildScopeItems([{ id: 1, column: 'Approved' }]), null, {});
  const rec = await store.replaceBaseline(SCOPE, 'sprint-1', b);
  assert.equal(rec.revision, 0);
});

test('getGoal / getBaseline return null when absent', async () => {
  const store = makeStore();
  assert.equal(await store.getGoal(SCOPE, 'sprint-x'), null);
  assert.equal(await store.getBaseline(SCOPE, 'sprint-x'), null);
});

test('store surfaces a storage failure rather than swallowing it', async () => {
  const failing = Store.createStore({ storage: createMockStorage({ failOn: ['set'] }) });
  await assert.rejects(
    () => failing.saveGoal(SCOPE, 'sprint-1', { objective: 'x' }),
    (e) => e.code === Store.ErrorCodes.STORAGE_FAILURE
  );
});

test('missing scope / sprint id are rejected explicitly', async () => {
  const store = makeStore();
  await assert.rejects(() => store.saveGoal(null, 'sprint-1', { objective: 'x' }),
    (e) => e.code === Store.ErrorCodes.INVALID_SCOPE);
  await assert.rejects(() => store.saveGoal(SCOPE, '', { objective: 'x' }),
    (e) => e.code === Store.ErrorCodes.INVALID_SPRINT);
});
