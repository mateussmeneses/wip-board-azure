// test/daily-commitment.test.js
// Tests for Daily Commitment (docs/PRODUCT_ROADMAP.md T1.3).
//
// Covers, 1:1 with the task list:
//   1. recording a commitment per item (startColumn + expectedColumn shaping)
//   2. persistence and retrieval of commitments (via the existing store)
//   3. planned-vs-realized comparison (reached / behind / beyond)
//   4. isolation between different boards (no cross-scope mixing)
//   5. an item WITHOUT a commitment is not part of the comparison
//   6. a commitment on an item that vanished from the board -> missing
//   7. commitment versioning (revision) preserved by the store
//
// The comparison lives in a PURE, Chrome-free + DOM-free module
// (src/features/daily/daily-commitment.js) and is driven here with plain objects and with
// the real snapshot pipeline (reader -> capture -> store). Zero dependencies:
// Node's built-in runner + the chrome storage mock.
//
// All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');

const commitment = require('../src/features/daily/daily-commitment.js');
const store = require('../src/data/snapshot-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const SCOPE_A = { organization: 'contoso-org', project: 'Sample.Project', team: 'Alpha', board: 'Stories' };
const SCOPE_B = { organization: 'contoso-org', project: 'Sample.Project', team: 'Beta', board: 'Stories' };

// A fixed flow order used across the comparison tests. Lower index = earlier.
const FLOW = ['Approved', 'Desenvolvimento', 'Code Review', 'HO', 'Closed'];

// Build a minimal snapshot-like state with a columns structure (store shape).
function stateOf(items, columnNames) {
  const names = columnNames || FLOW;
  return {
    items: items,
    columns: names.map((name, order) => ({ id: 'col-' + order, name: name, order: order })),
  };
}

function freshStore(extra) {
  const storage = createMockStorage((extra && extra.storageOptions) || undefined);
  return { api: store.createStore({ storage: storage }), storage: storage };
}

// --- 1. recording a commitment per item --------------------------------------

test('buildCommitmentItems derives startColumn from the base snapshot per item', () => {
  const base = stateOf([
    { id: 1001, column: 'Approved', assignee: 'Ana' },
    { id: 1002, column: 'Desenvolvimento', assignee: 'Bruno' },
    { id: 1003, column: 'Code Review' },
  ]);

  const { items } = commitment.buildCommitmentItems(base, {
    1001: 'Desenvolvimento',
    1002: 'Code Review',
  });

  const byId = new Map(items.map((i) => [i.id, i]));
  assert.equal(byId.get(1001).startColumn, 'Approved');
  assert.equal(byId.get(1001).expectedColumn, 'Desenvolvimento');
  assert.equal(byId.get(1001).assignee, 'Ana');
  assert.equal(byId.get(1002).startColumn, 'Desenvolvimento');
  assert.equal(byId.get(1002).expectedColumn, 'Code Review');
  // 1003 had no expectation -> not committed.
  assert.equal(byId.has(1003), false);
});

test('buildCommitmentItems accepts an array of {id, expectedColumn} and a Map', () => {
  const base = stateOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);

  const fromArray = commitment.buildCommitmentItems(base, [
    { id: 1, expectedColumn: 'HO' },
    { id: 2, expectedColumn: '' }, // empty expected is ignored
  ]);
  assert.equal(fromArray.items.length, 1);
  assert.equal(fromArray.items[0].id, 1);
  assert.equal(fromArray.items[0].expectedColumn, 'HO');

  const fromMap = commitment.buildCommitmentItems(base, new Map([[2, 'Closed']]));
  assert.equal(fromMap.items.length, 1);
  assert.equal(fromMap.items[0].id, 2);
  assert.equal(fromMap.items[0].expectedColumn, 'Closed');
});

test('an expectation for an id not on the base snapshot is reported, not dropped silently', () => {
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items, unknownIds } = commitment.buildCommitmentItems(base, { 1: 'HO', 999: 'Closed' });
  assert.equal(items.length, 1);
  assert.deepEqual(unknownIds, [999]);
});

test('buildCommitmentItems does not mutate the base snapshot', () => {
  const base = stateOf([{ id: 1, column: 'Approved', assignee: 'Ana' }]);
  const before = JSON.stringify(base);
  commitment.buildCommitmentItems(base, { 1: 'HO' });
  assert.equal(JSON.stringify(base), before);
});

// --- 2. persistence and retrieval (existing store, versioned commitments) -----

test('a commitment persists and is retrievable via the existing store', async () => {
  const { api } = freshStore();
  const base = stateOf([
    { id: 1001, column: 'Approved' },
    { id: 1002, column: 'Desenvolvimento' },
  ]);
  const { items } = commitment.buildCommitmentItems(base, {
    1001: 'Desenvolvimento',
    1002: 'Code Review',
  });

  const saved = await api.saveCommitment({ scope: SCOPE_A, items: items });
  const all = await api.getCommitments(SCOPE_A);
  assert.equal(all.length, 1);
  assert.equal(all[0].id, saved.id);

  const loaded = await api.getCommitmentById(SCOPE_A, saved.id);
  const byId = new Map(loaded.items.map((i) => [i.id, i]));
  assert.equal(byId.get(1001).expectedColumn, 'Desenvolvimento');
  assert.equal(byId.get(1001).startColumn, 'Approved');
  assert.equal(byId.get(1002).expectedColumn, 'Code Review');
});

test('a commitment survives a reload (a new store over the same storage reads it)', async () => {
  const storage = createMockStorage();
  const before = store.createStore({ storage: storage });
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'HO' });
  const saved = await before.saveCommitment({ scope: SCOPE_A, items: items });

  const after = store.createStore({ storage: storage });
  const loaded = await after.getCommitmentById(SCOPE_A, saved.id);
  assert.equal(loaded.items[0].expectedColumn, 'HO');
});

// --- 3. planned-vs-realized comparison (reached / behind / beyond) ------------

test('comparison classifies reached, behind and beyond using flow order', () => {
  const base = stateOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
    { id: 3, column: 'Approved' },
  ]);
  const { items } = commitment.buildCommitmentItems(base, {
    1: 'Code Review', // plan: reach Code Review
    2: 'Code Review',
    3: 'Code Review',
  });

  const realized = stateOf([
    { id: 1, column: 'Code Review' }, // exactly expected -> reached
    { id: 2, column: 'Desenvolvimento' }, // short of expected -> behind
    { id: 3, column: 'Closed' }, // past expected -> beyond
  ]);

  const { results, summary } = commitment.compareCommitment({ items: items }, realized);
  const byId = new Map(results.map((r) => [r.id, r]));
  assert.equal(byId.get(1).status, commitment.Status.REACHED);
  assert.equal(byId.get(2).status, commitment.Status.BEHIND);
  assert.equal(byId.get(3).status, commitment.Status.BEYOND);
  assert.deepEqual(summary, { reached: 1, behind: 1, beyond: 1, offTrack: 0, missing: 0, committed: 3 });
});

test('comparison carries expected, actual and start columns per result row', () => {
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'HO' });
  const realized = stateOf([{ id: 1, column: 'Code Review' }]);

  const { results } = commitment.compareCommitment({ items: items }, realized);
  assert.equal(results[0].startColumn, 'Approved');
  assert.equal(results[0].expectedColumn, 'HO');
  assert.equal(results[0].actualColumn, 'Code Review');
  assert.equal(results[0].status, commitment.Status.BEHIND);
});

test('column matching tolerates accents and casing', () => {
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'Desenvolvimento' });
  // Realized column differs only by accent/casing.
  const realized = stateOf(
    [{ id: 1, column: 'desenvolvimento' }],
    ['Approved', 'desenvolvimento', 'Closed']
  );
  const { results } = commitment.compareCommitment({ items: items }, realized);
  assert.equal(results[0].status, commitment.Status.REACHED);
});

test('unknown flow order yields off-track, never a guessed direction', () => {
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'HO' });
  // Realized state has no columns structure and no explicit order provided.
  const realized = { items: [{ id: 1, column: 'Some Unordered Column' }] };
  const { results, summary } = commitment.compareCommitment({ items: items }, realized);
  assert.equal(results[0].status, commitment.Status.OFF_TRACK);
  assert.equal(summary.offTrack, 1);
});

test('an explicit columnOrder option overrides the realized columns', () => {
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'B' });
  const realized = { items: [{ id: 1, column: 'A' }] }; // no columns array
  const { results } = commitment.compareCommitment({ items: items }, realized, {
    columnOrder: ['A', 'B', 'C'],
  });
  // A is before B -> behind.
  assert.equal(results[0].status, commitment.Status.BEHIND);
});

// --- 4. isolation between different boards ------------------------------------

test('commitments for different boards do not mix', async () => {
  const { api } = freshStore();
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'HO' });

  await api.saveCommitment({ scope: SCOPE_A, items: items });
  await api.saveCommitment({ scope: SCOPE_B, items: items });

  const a = await api.getCommitments(SCOPE_A);
  const b = await api.getCommitments(SCOPE_B);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].scope.team, 'Alpha');
  assert.equal(b[0].scope.team, 'Beta');
  assert.notEqual(a[0].id, b[0].id);
});

// --- 5. an item without a commitment is not compared --------------------------

test('items without a commitment never appear in the comparison', () => {
  const base = stateOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' }, // committed
  ]);
  const { items } = commitment.buildCommitmentItems(base, { 2: 'HO' });

  // Realized board has BOTH items, but only id 2 was committed.
  const realized = stateOf([
    { id: 1, column: 'Closed' },
    { id: 2, column: 'HO' },
  ]);

  const { results, summary } = commitment.compareCommitment({ items: items }, realized);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 2);
  assert.equal(summary.committed, 1);
  assert.equal(results.some((r) => r.id === 1), false);
});

test('an empty commitment yields an empty comparison (no items committed)', () => {
  const realized = stateOf([{ id: 1, column: 'Closed' }]);
  const { results, summary } = commitment.compareCommitment({ items: [] }, realized);
  assert.deepEqual(results, []);
  assert.equal(summary.committed, 0);
});

// --- 6. a committed item that vanished from the board -> missing --------------

test('a committed item absent from the realized state is missing, not delivered', () => {
  const base = stateOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const { items } = commitment.buildCommitmentItems(base, { 1: 'Closed', 2: 'Closed' });

  // id 2 is gone from the board entirely.
  const realized = stateOf([{ id: 1, column: 'Closed' }]);

  const { results, summary } = commitment.compareCommitment({ items: items }, realized);
  const byId = new Map(results.map((r) => [r.id, r]));
  assert.equal(byId.get(1).status, commitment.Status.REACHED);
  assert.equal(byId.get(2).status, commitment.Status.MISSING);
  assert.equal(byId.get(2).actualColumn, null);
  assert.equal(summary.missing, 1);
  assert.equal(summary.reached, 1);
});

// --- 7. commitment versioning (revision) --------------------------------------

test('revising a commitment preserves prior history and bumps the revision', async () => {
  const { api } = freshStore();
  const base = stateOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const first = commitment.buildCommitmentItems(base, { 1: 'Desenvolvimento', 2: 'Desenvolvimento' });
  const saved = await api.saveCommitment({ scope: SCOPE_A, items: first.items });
  assert.equal(saved.revision, 0);

  // The plan changes at a later daily: id 1 now expected further along.
  const second = commitment.buildCommitmentItems(base, { 1: 'Code Review', 2: 'Desenvolvimento' });
  const revised = await api.reviseCommitment(SCOPE_A, saved.id, second.items);

  assert.equal(revised.revision, 1);
  assert.equal(revised.revisions.length, 1);
  // The archived revision keeps the ORIGINAL plan.
  const archived = revised.revisions[0];
  const archivedById = new Map(archived.items.map((i) => [i.id, i]));
  assert.equal(archivedById.get(1).expectedColumn, 'Desenvolvimento');
  // The current plan reflects the new expectation.
  const currentById = new Map(revised.items.map((i) => [i.id, i]));
  assert.equal(currentById.get(1).expectedColumn, 'Code Review');
});

test('comparing the latest revision reflects the updated plan', async () => {
  const { api } = freshStore();
  const base = stateOf([{ id: 1, column: 'Approved' }]);
  const saved = await api.saveCommitment({
    scope: SCOPE_A,
    items: commitment.buildCommitmentItems(base, { 1: 'Desenvolvimento' }).items,
  });
  await api.reviseCommitment(SCOPE_A, saved.id, commitment.buildCommitmentItems(base, { 1: 'Closed' }).items);

  const loaded = await api.getCommitmentById(SCOPE_A, saved.id);
  const realized = stateOf([{ id: 1, column: 'Closed' }]);
  const { results } = commitment.compareCommitment(loaded, realized);
  // Against the REVISED plan (expected Closed), the item reached it.
  assert.equal(results[0].status, commitment.Status.REACHED);
});

// --- end-to-end: snapshot base -> commitment -> later snapshot comparison -----

test('end to end: commit against a base snapshot, compare to a later snapshot', async () => {
  const { api } = freshStore();

  // Base snapshot captured at the daily.
  const baseState = stateOf([
    { id: 10, column: 'Approved', columnId: 'col-0' },
    { id: 11, column: 'Desenvolvimento', columnId: 'col-1' },
  ]);
  const baseSnap = await api.createSnapshot({
    scope: SCOPE_A,
    items: baseState.items,
    columns: baseState.columns,
    complete: true,
  });

  // The user commits: 10 -> Code Review, 11 -> Closed.
  const built = commitment.buildCommitmentItems(baseSnap, { 10: 'Code Review', 11: 'Closed' });
  await api.saveCommitment({ scope: SCOPE_A, items: built.items, baseSnapshotId: baseSnap.id });

  // Next daily: a new snapshot captures the realized state.
  const laterState = stateOf([
    { id: 10, column: 'Code Review', columnId: 'col-2' }, // reached
    { id: 11, column: 'HO', columnId: 'col-3' }, // behind (expected Closed)
  ]);
  const laterSnap = await api.createSnapshot({
    scope: SCOPE_A,
    items: laterState.items,
    columns: laterState.columns,
    complete: true,
  });

  const loadedCommitment = (await api.getCommitments(SCOPE_A))[0];
  const { summary, results } = commitment.compareCommitment(loadedCommitment, laterSnap);
  const byId = new Map(results.map((r) => [r.id, r]));
  assert.equal(byId.get(10).status, commitment.Status.REACHED);
  assert.equal(byId.get(11).status, commitment.Status.BEHIND);
  assert.equal(summary.reached, 1);
  assert.equal(summary.behind, 1);
});

// --- module hygiene: pure, Chrome-free, DOM-free -----------------------------

test('daily-commitment module is DOM-free and Chrome-free by design', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'features', 'daily', 'daily-commitment.js'), 'utf8');
  assert.equal(/\bdocument\b/.test(src), false);
  assert.equal(/MutationObserver/.test(src), false);
  assert.equal(/\bchrome\./.test(src), false);
  assert.equal(/\.innerHTML\b/.test(src), false);
});
