// test/projected-board.test.js
// Tests for the Projected Board engine (docs/PRODUCT_ROADMAP.md T1.5).
//
// The engine (src/features/daily/projected-board.js) is PURE, Chrome-free and DOM-free: it
// turns a captured snapshot (the baseline) + a saved commitment (the declared
// destinations) into the EXPECTED end-of-day board, computing per-column counts,
// deltas and the planned-move list. It is a SIMULATION and never mutates its
// inputs nor touches Azure DevOps.
//
// Coverage, 1:1 with the task list:
//   - snapshot without commitments
//   - one and several commitments
//   - items with no planned change
//   - multiple columns
//   - destination equal to the origin column (no-op)
//   - invalid / non-existent destination
//   - duplicate ids
//   - absent / incomplete cards (missing from baseline / incomplete snapshot)
//   - capitalization and accent differences
//   - isolation between boards and dates (via the real store pipeline)
//   - immutability of the input data
//   - persistence and retrieval of the commitments used (via the store)
//   - correctness of the per-column counters
//   - absence of modifications in Azure DevOps (no API/DOM surface exists)
//
// Zero dependencies: Node's built-in runner + the chrome storage mock.
// All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');

const projected = require('../src/features/daily/projected-board.js');
const commitmentEngine = require('../src/features/daily/daily-commitment.js');
const store = require('../src/data/snapshot-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const FLOW = ['Approved', 'Desenvolvimento', 'Code Review', 'HO', 'Closed'];

function columnsOf(names) {
  return (names || FLOW).map((name, order) => ({ id: 'col-' + order, name: name, order: order }));
}

function snapshotOf(items, names) {
  return { items: items, columns: columnsOf(names) };
}

// Build a commitment-shaped object (store/engine shape) from id->destination.
function commitmentOf(baseSnapshot, expectations) {
  const built = commitmentEngine.buildCommitmentItems(baseSnapshot, expectations);
  return { items: built.items };
}

function columnByName(projection, name) {
  return projection.columns.find((c) => c.name === name) || null;
}

function freshStore() {
  const storage = createMockStorage();
  return { api: store.createStore({ storage: storage }), storage: storage };
}

// --- snapshot without commitments --------------------------------------------

test('no commitments: projected board equals the snapshot, zero moves', () => {
  const base = snapshotOf([
    { id: 100, column: 'HO' },
    { id: 101, column: 'HO' },
    { id: 102, column: 'HO' },
  ]);

  const p = projected.project(base, { items: [] });

  assert.equal(p.summary.plannedMoveCount, 0);
  assert.equal(p.summary.committedCount, 0);
  assert.equal(p.summary.snapshotItemCount, 3);

  const ho = columnByName(p, 'HO');
  assert.equal(ho.initialCount, 3);
  assert.equal(ho.projectedCount, 3);
  assert.equal(ho.delta, 0);
  assert.deepEqual(ho.projectedIds, [100, 101, 102]);

  // Every other column stays empty and unchanged.
  p.columns
    .filter((c) => c.name !== 'HO')
    .forEach((c) => assert.equal(c.projectedCount, 0));
});

// --- the canonical example from the task (several commitments) ---------------

test('example: #100,#101 HO->Closed and #102 stays; projected board matches', () => {
  const base = snapshotOf([
    { id: 100, column: 'HO' },
    { id: 101, column: 'HO' },
    { id: 102, column: 'HO' },
    { id: 90, column: 'Closed' }, // already done before the daily
  ]);

  const commitment = commitmentOf(base, { 100: 'Closed', 101: 'Closed' });
  const p = projected.project(base, commitment);

  const ho = columnByName(p, 'HO');
  const closed = columnByName(p, 'Closed');

  assert.deepEqual(ho.projectedIds, [102]);
  assert.equal(ho.initialCount, 3);
  assert.equal(ho.projectedCount, 1);
  assert.equal(ho.delta, -2);

  // Closed keeps the item that was already there plus the two moved in.
  assert.deepEqual(closed.projectedIds.sort((a, b) => a - b), [90, 100, 101]);
  assert.equal(closed.initialCount, 1);
  assert.equal(closed.projectedCount, 3);
  assert.equal(closed.delta, 2);

  assert.equal(p.summary.plannedMoveCount, 2);
  assert.deepEqual(
    p.moves.map((m) => m.id).sort((a, b) => a - b),
    [100, 101]
  );
  p.moves.forEach((m) => {
    assert.equal(m.fromColumn, 'HO');
    assert.equal(m.toColumn, 'Closed');
  });

  // The moved-in items in Closed are tagged with origin/destination metadata.
  const movedIn = closed.items.filter((i) => i.movedIn);
  assert.equal(movedIn.length, 2);
  movedIn.forEach((i) => {
    assert.equal(i.fromColumn, 'HO');
    assert.equal(i.toColumn, 'Closed');
  });
});

// --- one commitment -----------------------------------------------------------

test('single commitment moves exactly one item', () => {
  const base = snapshotOf([
    { id: 1, column: 'Desenvolvimento' },
    { id: 2, column: 'Desenvolvimento' },
  ]);
  const p = projected.project(base, commitmentOf(base, { 1: 'Code Review' }));
  assert.equal(p.summary.plannedMoveCount, 1);
  assert.deepEqual(columnByName(p, 'Desenvolvimento').projectedIds, [2]);
  assert.deepEqual(columnByName(p, 'Code Review').projectedIds, [1]);
});

// --- items with no planned change --------------------------------------------

test('uncommitted items keep their original column', () => {
  const base = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'HO' },
    { id: 3, column: 'Code Review' },
  ]);
  const p = projected.project(base, commitmentOf(base, { 2: 'Closed' }));
  assert.deepEqual(columnByName(p, 'Approved').projectedIds, [1]);
  assert.deepEqual(columnByName(p, 'Code Review').projectedIds, [3]);
  assert.deepEqual(columnByName(p, 'Closed').projectedIds, [2]);
  assert.deepEqual(columnByName(p, 'HO').projectedIds, []);
});

// --- destination equal to the origin column (no-op) --------------------------

test('destination equal to origin is a no-op, not a move', () => {
  const base = snapshotOf([{ id: 5, column: 'HO' }]);
  // Force an explicit same-column destination (buildCommitmentItems keeps it).
  const commitment = { items: [{ id: 5, startColumn: 'HO', expectedColumn: 'HO' }] };
  const p = projected.project(base, commitment);
  assert.equal(p.summary.plannedMoveCount, 0);
  assert.equal(p.summary.noOpCount, 1);
  assert.deepEqual(p.noOps, [{ id: 5, column: 'HO' }]);
  assert.deepEqual(columnByName(p, 'HO').projectedIds, [5]);
});

// --- invalid / non-existent destination --------------------------------------

test('invalid destination keeps the item in place and is reported', () => {
  const base = snapshotOf([{ id: 7, column: 'HO' }]);
  const commitment = { items: [{ id: 7, startColumn: 'HO', expectedColumn: 'Nonexistent' }] };
  const p = projected.project(base, commitment);

  assert.equal(p.summary.plannedMoveCount, 0);
  assert.equal(p.summary.invalidDestinationCount, 1);
  assert.deepEqual(p.invalidDestinations, [{ id: 7, fromColumn: 'HO', requested: 'Nonexistent' }]);
  assert.deepEqual(columnByName(p, 'HO').projectedIds, [7]);
  assert.equal(p.reliability.complete, false);
  assert.ok(p.reliability.reasons.includes('INVALID_DESTINATIONS'));
});

// --- duplicate ids ------------------------------------------------------------

test('duplicate snapshot ids are collapsed to a single placement', () => {
  const base = snapshotOf([
    { id: 9, column: 'HO' },
    { id: 9, column: 'HO' }, // swimlane repeat
  ]);
  const p = projected.project(base, commitmentOf(base, { 9: 'Closed' }));
  assert.equal(p.summary.snapshotItemCount, 1);
  assert.equal(p.summary.plannedMoveCount, 1);
  assert.deepEqual(columnByName(p, 'Closed').projectedIds, [9]);
  assert.deepEqual(columnByName(p, 'HO').projectedIds, []);
});

test('duplicate committed ids collapse to the first destination', () => {
  const base = snapshotOf([{ id: 11, column: 'HO' }]);
  const commitment = {
    items: [
      { id: 11, startColumn: 'HO', expectedColumn: 'Closed' },
      { id: 11, startColumn: 'HO', expectedColumn: 'Code Review' },
    ],
  };
  const p = projected.project(base, commitment);
  assert.equal(p.summary.plannedMoveCount, 1);
  assert.deepEqual(columnByName(p, 'Closed').projectedIds, [11]);
});

// --- absent / incomplete cards ------------------------------------------------

test('committed id absent from the baseline is reported, never materialized', () => {
  const base = snapshotOf([{ id: 1, column: 'HO' }]);
  const commitment = { items: [{ id: 999, startColumn: 'HO', expectedColumn: 'Closed' }] };
  const p = projected.project(base, commitment);

  assert.deepEqual(p.unknownCommittedIds, [999]);
  assert.equal(p.summary.plannedMoveCount, 0);
  // 999 never appears in any column.
  const all = p.columns.reduce((acc, c) => acc.concat(c.projectedIds), []);
  assert.ok(!all.includes(999));
  assert.equal(p.reliability.complete, false);
  assert.ok(p.reliability.reasons.includes('UNKNOWN_COMMITTED_IDS'));
});

test('an incomplete snapshot flags the projection reliability', () => {
  const base = {
    items: [{ id: 1, column: 'HO' }],
    columns: columnsOf(),
    source: { complete: false },
  };
  const p = projected.project(base, { items: [] });
  assert.equal(p.reliability.complete, false);
  assert.ok(p.reliability.reasons.includes('INCOMPLETE_SNAPSHOT'));
});

// --- capitalization and accent differences -----------------------------------

test('destination matches a column by case/accent-insensitive name', () => {
  const base = snapshotOf(
    [{ id: 1, column: 'desenvolvimento' }],
    ['Aprovação', 'Desenvolvimento', 'Concluído']
  );
  // Destination differs in case and accents from the real column "Concluído".
  const commitment = { items: [{ id: 1, startColumn: 'desenvolvimento', expectedColumn: 'concluido' }] };
  const p = projected.project(base, commitment);
  assert.equal(p.summary.plannedMoveCount, 1);
  assert.deepEqual(columnByName(p, 'Concluído').projectedIds, [1]);
  assert.deepEqual(columnByName(p, 'Desenvolvimento').projectedIds, []);
});

// --- multiple columns / counters correctness ----------------------------------

test('per-column counters and deltas are correct across many columns', () => {
  const base = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
    { id: 3, column: 'Desenvolvimento' },
    { id: 4, column: 'Code Review' },
    { id: 5, column: 'HO' },
    { id: 6, column: 'Closed' },
  ]);
  const commitment = commitmentOf(base, {
    1: 'Desenvolvimento',
    3: 'Code Review',
    5: 'Closed',
  });
  const p = projected.project(base, commitment);

  const counts = {};
  p.columns.forEach((c) => {
    counts[c.name] = { i: c.initialCount, pj: c.projectedCount, d: c.delta };
  });
  assert.deepEqual(counts.Approved, { i: 2, pj: 1, d: -1 });
  assert.deepEqual(counts.Desenvolvimento, { i: 1, pj: 1, d: 0 });
  assert.deepEqual(counts['Code Review'], { i: 1, pj: 2, d: 1 });
  assert.deepEqual(counts.HO, { i: 1, pj: 0, d: -1 });
  assert.deepEqual(counts.Closed, { i: 1, pj: 2, d: 1 });

  // Conservation: the sum of items never changes under a simulation.
  const totalInitial = p.columns.reduce((a, c) => a + c.initialCount, 0);
  const totalProjected = p.columns.reduce((a, c) => a + c.projectedCount, 0);
  assert.equal(totalInitial, 6);
  assert.equal(totalProjected, 6);
});

test('projected columns preserve the real board flow order', () => {
  const base = snapshotOf([{ id: 1, column: 'HO' }]);
  const p = projected.project(base, { items: [] });
  assert.deepEqual(
    p.columns.map((c) => c.name),
    FLOW
  );
});

// --- immutability of inputs ---------------------------------------------------

test('the engine never mutates its inputs', () => {
  const base = snapshotOf([
    { id: 1, column: 'HO' },
    { id: 2, column: 'HO' },
  ]);
  const commitment = commitmentOf(base, { 1: 'Closed' });
  const baseBefore = JSON.stringify(base);
  const commitmentBefore = JSON.stringify(commitment);

  projected.project(base, commitment);

  assert.equal(JSON.stringify(base), baseBefore);
  assert.equal(JSON.stringify(commitment), commitmentBefore);
});

test('a deep-frozen snapshot (store shape) can be projected without throwing', () => {
  const base = Object.freeze({
    items: Object.freeze([Object.freeze({ id: 1, column: 'HO' })]),
    columns: Object.freeze(columnsOf().map((c) => Object.freeze(c))),
  });
  const p = projected.project(base, commitmentOf({ items: base.items.slice() }, { 1: 'Closed' }));
  assert.equal(p.summary.plannedMoveCount, 1);
});

// --- isolation + persistence through the real store ---------------------------

test('projection uses the persisted snapshot + commitment of the SAME board', async () => {
  const { api } = freshStore();
  const scopeA = { organization: 'org', project: 'Proj', team: 'Alpha', board: 'Stories' };
  const scopeB = { organization: 'org', project: 'Proj', team: 'Beta', board: 'Stories' };

  // Board A: three items in HO, commit two to Closed.
  const snapA = await api.createSnapshot({
    scope: scopeA,
    complete: true,
    items: [
      { id: 100, column: 'HO' },
      { id: 101, column: 'HO' },
      { id: 102, column: 'HO' },
    ],
    columns: columnsOf(),
  });
  const builtA = commitmentEngine.buildCommitmentItems(snapA, { 100: 'Closed', 101: 'Closed' });
  await api.saveCommitment({ scope: scopeA, items: builtA.items, baseSnapshotId: snapA.id });

  // Board B: a different, unrelated state and commitment.
  const snapB = await api.createSnapshot({
    scope: scopeB,
    complete: true,
    items: [{ id: 200, column: 'Approved' }],
    columns: columnsOf(),
  });
  const builtB = commitmentEngine.buildCommitmentItems(snapB, { 200: 'Desenvolvimento' });
  await api.saveCommitment({ scope: scopeB, items: builtB.items, baseSnapshotId: snapB.id });

  // Project board A from its OWN persisted records only.
  const baseA = await api.getLatestSnapshot(scopeA);
  const cmtA = (await api.getCommitments(scopeA))[0];
  const pA = projected.project(baseA, cmtA);

  assert.deepEqual(columnByName(pA, 'HO').projectedIds, [102]);
  assert.deepEqual(
    columnByName(pA, 'Closed').projectedIds.sort((a, b) => a - b),
    [100, 101]
  );
  // Board B's item never leaks into board A's projection.
  const allA = pA.columns.reduce((acc, c) => acc.concat(c.projectedIds), []);
  assert.ok(!allA.includes(200));
});

test('commitments from a different day are not mixed (store keeps revisions)', async () => {
  const { api } = freshStore();
  const scope = { organization: 'org', project: 'Proj', team: 'Alpha', board: 'Stories' };

  const snap = await api.createSnapshot({
    scope: scope,
    complete: true,
    items: [
      { id: 1, column: 'HO' },
      { id: 2, column: 'HO' },
    ],
    columns: columnsOf(),
  });

  // Day 1 plan: move #1 to Closed.
  const day1 = commitmentEngine.buildCommitmentItems(snap, { 1: 'Closed' });
  const saved = await api.saveCommitment({ scope: scope, items: day1.items, baseSnapshotId: snap.id });

  // Day 2 revision: instead move #2 to Closed (replaces the active plan).
  const day2 = commitmentEngine.buildCommitmentItems(snap, { 2: 'Closed' });
  const revised = await api.reviseCommitment(scope, saved.id, day2.items);

  // The ACTIVE commitment (latest revision) drives the projection, not day 1.
  const latest = (await api.getCommitments(scope))[0];
  assert.equal(latest.revision, 1);
  const p = projected.project(snap, latest);
  assert.deepEqual(columnByName(p, 'Closed').projectedIds, [2]);
  assert.deepEqual(columnByName(p, 'HO').projectedIds, [1]);

  // Day 1 is preserved in history, never silently applied.
  assert.equal(revised.revisions.length, 1);
});

// --- derived columns fallback -------------------------------------------------

test('without a column structure, columns are derived from item columns', () => {
  const base = { items: [{ id: 1, column: 'HO' }, { id: 2, column: 'Closed' }] };
  const commitment = { items: [{ id: 1, startColumn: 'HO', expectedColumn: 'Closed' }] };
  const p = projected.project(base, commitment);
  assert.deepEqual(
    p.columns.map((c) => c.name).sort(),
    ['Closed', 'HO']
  );
  assert.deepEqual(columnByName(p, 'Closed').projectedIds.sort((a, b) => a - b), [1, 2]);
});
