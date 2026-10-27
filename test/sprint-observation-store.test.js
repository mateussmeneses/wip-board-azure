// test/sprint-observation-store.test.js
// Unit tests for the Sprint Observation store (roadmap T2.4). Covers append +
// immutability, chronological ordering, out-of-order writes, scope/sprint
// isolation, timezone preservation, completeness/reliability indicators, the
// baseline-reference (never mutating the baseline), persistence after reload,
// pruning and the STORAGE_FAILURE path — all with the shared mock-chrome-storage
// helper, no live browser.

const test = require('node:test');
const assert = require('node:assert/strict');

const Store = require('../src/data/sprint-observation-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const scope = { organization: 'Org', project: 'Proj', team: 'TeamA', board: 'BoardA' };

function makeStore(now) {
  const storage = createMockStorage();
  const store = Store.createStore({ storage: storage, now: now });
  return { store: store, storage: storage };
}

function obsInput(extra) {
  return Object.assign({
    scope: scope,
    sprintId: 's1',
    items: [{ id: 1, column: 'Approved', state: 'New' }, { id: 2, column: 'Closed', state: 'Done' }],
    complete: true,
    reliability: 'sufficient',
  }, extra || {});
}

test('appendObservation stores an immutable, chronologically-retrievable record', async () => {
  const { store } = makeStore();
  const rec = await store.appendObservation(obsInput({ capturedAt: '2024-01-02T10:00:00Z' }));
  assert.equal(rec.kind, 'sprint-observation');
  assert.equal(rec.sprintId, 's1');
  assert.equal(rec.itemCount, 2);
  assert.ok(Object.isFrozen(rec));
  const all = await store.getObservations(scope, 's1');
  assert.equal(all.length, 1);
  assert.equal(all[0].id, rec.id);
});

test('observations are returned oldest-first even when written out of order', async () => {
  const { store } = makeStore();
  await store.appendObservation(obsInput({ capturedAt: '2024-01-05T00:00:00Z', items: [{ id: 1, column: 'Closed' }] }));
  await store.appendObservation(obsInput({ capturedAt: '2024-01-01T00:00:00Z', items: [{ id: 1, column: 'Approved' }] }));
  await store.appendObservation(obsInput({ capturedAt: '2024-01-03T00:00:00Z', items: [{ id: 1, column: 'Development' }] }));
  const all = await store.getObservations(scope, 's1');
  assert.deepEqual(all.map(function (o) { return o.capturedAt.iso; }), [
    '2024-01-01T00:00:00.000Z',
    '2024-01-03T00:00:00.000Z',
    '2024-01-05T00:00:00.000Z',
  ]);
});

test('getLatestObservation returns the newest capture', async () => {
  const { store } = makeStore();
  await store.appendObservation(obsInput({ capturedAt: '2024-01-01T00:00:00Z' }));
  const latest = await store.appendObservation(obsInput({ capturedAt: '2024-01-09T00:00:00Z' }));
  const got = await store.getLatestObservation(scope, 's1');
  assert.equal(got.id, latest.id);
});

test('scope + sprint isolation: different sprints and boards never collide', async () => {
  const { store } = makeStore();
  await store.appendObservation(obsInput({ sprintId: 's1' }));
  await store.appendObservation(obsInput({ sprintId: 's2' }));
  await store.appendObservation(obsInput({ scope: Object.assign({}, scope, { board: 'BoardB' }), sprintId: 's1' }));
  assert.equal((await store.getObservations(scope, 's1')).length, 1);
  assert.equal((await store.getObservations(scope, 's2')).length, 1);
  assert.equal((await store.getObservations(Object.assign({}, scope, { board: 'BoardB' }), 's1')).length, 1);
});

test('timezone offset and local day are preserved on capture', async () => {
  const { store } = makeStore();
  const rec = await store.appendObservation(obsInput({ capturedAt: '2024-01-02T10:00:00Z' }));
  assert.equal(typeof rec.capturedAt.timezoneOffsetMinutes, 'number');
  assert.equal(typeof rec.capturedAt.localDay, 'string');
  assert.equal(rec.capturedAt.epochMs, Date.parse('2024-01-02T10:00:00Z'));
});

test('completeness and reliability indicators are stored truthfully', async () => {
  const { store } = makeStore();
  const rec = await store.appendObservation(obsInput({
    complete: false,
    reliability: 'partial',
    incompleteReasons: ['HIDDEN_ITEMS'],
  }));
  assert.equal(rec.complete, false);
  assert.equal(rec.reliability, 'partial');
  assert.deepEqual(rec.incompleteReasons, ['HIDDEN_ITEMS']);
});

test('baselineRef is a reference only; the baseline itself is never persisted here', async () => {
  const { store } = makeStore();
  const rec = await store.appendObservation(obsInput({
    baselineRef: { sprintId: 's1', revision: 0, capturedAt: { iso: '2024-01-01T00:00:00Z', epochMs: Date.parse('2024-01-01T00:00:00Z') } },
  }));
  assert.equal(rec.baselineRef.revision, 0);
  assert.equal(rec.baselineRef.sprintId, 's1');
  // No plannedIds / baseline payload leaked into the observation.
  assert.equal(rec.baseline, undefined);
  assert.equal(rec.plannedIds, undefined);
});

test('duplicate item ids in one observation collapse (swimlane repeats)', async () => {
  const { store } = makeStore();
  const rec = await store.appendObservation(obsInput({
    items: [{ id: 1, column: 'Approved' }, { id: 1, column: 'Approved' }, { id: 2, column: 'Closed' }],
  }));
  assert.equal(rec.itemCount, 2);
});

test('observations survive a reload (new store instance over the same storage)', async () => {
  const storage = createMockStorage();
  const s1 = Store.createStore({ storage: storage });
  await s1.appendObservation(obsInput({ capturedAt: '2024-01-01T00:00:00Z' }));
  await s1.appendObservation(obsInput({ capturedAt: '2024-01-02T00:00:00Z' }));
  // Simulate a reload: a brand-new store instance over the same backing storage.
  const s2 = Store.createStore({ storage: storage });
  const all = await s2.getObservations(scope, 's1');
  assert.equal(all.length, 2);
});

test('retention prunes the oldest observations beyond the cap', async () => {
  const storage = createMockStorage();
  const store = Store.createStore({ storage: storage, retention: { maxObservationsPerSprint: 3 } });
  for (let d = 1; d <= 5; d += 1) {
    await store.appendObservation(obsInput({ capturedAt: '2024-01-0' + d + 'T00:00:00Z' }));
  }
  const all = await store.getObservations(scope, 's1');
  assert.equal(all.length, 3);
  // The three newest remain (days 3,4,5).
  assert.deepEqual(all.map(function (o) { return o.capturedAt.iso; }), [
    '2024-01-03T00:00:00.000Z',
    '2024-01-04T00:00:00.000Z',
    '2024-01-05T00:00:00.000Z',
  ]);
});

test('invalid scope and sprint id are rejected', async () => {
  const { store } = makeStore();
  await assert.rejects(() => store.appendObservation({ sprintId: 's1', items: [] }), /INVALID_SCOPE|scope/);
  await assert.rejects(() => store.appendObservation({ scope: scope, items: [] }), /INVALID_SPRINT|sprintId/);
});

test('a storage failure surfaces as STORAGE_FAILURE, never swallowed', async () => {
  const storage = createMockStorage({ failOn: ['set'] });
  const store = Store.createStore({ storage: storage });
  await assert.rejects(() => store.appendObservation(obsInput()), function (err) {
    return err && err.code === 'STORAGE_FAILURE';
  });
});

test('getObservationById returns the exact record or throws NOT_FOUND', async () => {
  const { store } = makeStore();
  const rec = await store.appendObservation(obsInput());
  const got = await store.getObservationById(scope, 's1', rec.id);
  assert.equal(got.id, rec.id);
  await assert.rejects(() => store.getObservationById(scope, 's1', 'missing'), function (err) {
    return err && err.code === 'NOT_FOUND';
  });
});
