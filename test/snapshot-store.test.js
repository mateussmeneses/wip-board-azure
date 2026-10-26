// test/snapshot-store.test.js
// Unit tests for the Snapshot Store (docs/PRODUCT_ROADMAP.md T1.1).
//
// Coverage required by the task:
//   - persistence and retrieval
//   - immutable snapshots
//   - duplicate ids
//   - different boards (isolation)
//   - column changes
//   - work items added / removed
//   - commitment revisions (changing the original plan)
//   - incomplete data
//   - storage failures
//   - schema migration
//   - capacity / retention policy
//   - planned-vs-observed comparison
//
// chrome.storage.local is mocked (test/helpers/mock-chrome-storage.js); no real
// browser and no extra dependencies. Uses Node's built-in test runner.

const test = require('node:test');
const assert = require('node:assert/strict');

const store = require('../src/data/snapshot-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const SCOPE_A = { organization: 'sda-iatec', project: 'Sda.Arms', team: 'Alpha', board: 'Stories' };
const SCOPE_B = { organization: 'sda-iatec', project: 'Sda.Arms', team: 'Beta', board: 'Stories' };

// A fixed clock factory so capturedAt/ids are deterministic in tests.
function fixedClock(epochMs) {
  let t = epochMs;
  return function () {
    return new Date(t);
  };
}

function freshStore(extra) {
  const storage = createMockStorage();
  const cfg = Object.assign({ storage: storage }, extra || {});
  return { api: store.createStore(cfg), storage: storage };
}

function itemsFixture() {
  return [
    { id: 101, column: 'Approved', columnId: 'c0', state: 'Approved', assignee: 'Alice' },
    { id: 102, column: 'Desenvolvimento', columnId: 'c1', state: 'Active', assignee: 'Bob' },
  ];
}

// --- persistence & retrieval -------------------------------------------------

test('createSnapshot persists and getLatestSnapshot retrieves it', async () => {
  const { api } = freshStore({ now: fixedClock(1000) });
  const created = await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), complete: true });

  assert.equal(created.kind, 'snapshot');
  assert.equal(created.itemCount, 2);
  assert.equal(created.source.complete, true);

  const latest = await api.getLatestSnapshot(SCOPE_A);
  assert.equal(latest.id, created.id);
  assert.equal(latest.items.length, 2);
  assert.equal(latest.schemaVersion, store.SCHEMA_VERSION);
});

test('capturedAt preserves timezone offset and a local day', async () => {
  const { api } = freshStore();
  const when = new Date('2024-03-15T12:00:00Z');
  const snap = await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), capturedAt: when, complete: true });
  assert.equal(snap.capturedAt.iso, when.toISOString());
  assert.equal(typeof snap.capturedAt.timezoneOffsetMinutes, 'number');
  assert.match(snap.capturedAt.localDay, /^\d{4}-\d{2}-\d{2}$/);
});

test('getSnapshotsByDate filters to the requested local day', async () => {
  const { api } = freshStore();
  const day1 = new Date(2024, 0, 10, 9, 0, 0);
  const day2 = new Date(2024, 0, 11, 9, 0, 0);
  await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), capturedAt: day1, complete: true });
  await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), capturedAt: day2, complete: true });

  const onDay1 = await api.getSnapshotsByDate(SCOPE_A, store.toLocalDay(day1));
  assert.equal(onDay1.length, 1);
  assert.equal(onDay1[0].capturedAt.localDay, store.toLocalDay(day1));
});

// --- immutability ------------------------------------------------------------

test('a returned snapshot is deeply frozen', async () => {
  const { api } = freshStore();
  const snap = await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), complete: true });
  assert.equal(Object.isFrozen(snap), true);
  assert.equal(Object.isFrozen(snap.items), true);
  assert.equal(Object.isFrozen(snap.items[0]), true);
  // Attempting to mutate a frozen record throws in strict mode.
  assert.throws(function () {
    'use strict';
    snap.items[0].column = 'Hacked';
  });
});

test('mutating a retrieved snapshot does not corrupt the persisted copy', async () => {
  const { api } = freshStore();
  await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), complete: true });
  const first = await api.getLatestSnapshot(SCOPE_A);
  // Even if a caller forces a mutation on a clone, re-reading returns the original.
  try {
    first.items[0].column = 'Tampered';
  } catch (e) {
    // frozen: expected
  }
  const second = await api.getLatestSnapshot(SCOPE_A);
  assert.equal(second.items[0].column, 'Approved');
});

// --- duplicate ids -----------------------------------------------------------

test('duplicate item ids within one snapshot are collapsed to the first', async () => {
  const { api } = freshStore();
  const snap = await api.createSnapshot({
    scope: SCOPE_A,
    complete: true,
    items: [
      { id: 101, column: 'Approved' },
      { id: 101, column: 'Desenvolvimento' }, // duplicate id (e.g. swimlane repeat)
      { id: 102, column: 'Closed' },
    ],
  });
  assert.equal(snap.items.length, 2);
  assert.equal(snap.items.find((i) => i.id === 101).column, 'Approved');
});

test('saving a commitment with an already-used id is a duplicate', async () => {
  const { api } = freshStore();
  const first = await api.saveCommitment({
    scope: SCOPE_A,
    items: [{ id: 101, expectedColumn: 'Closed' }],
  });
  // Re-saving with the same explicit id must not overwrite silently; callers
  // change an existing plan through reviseCommitment instead.
  await assert.rejects(
    () => api.saveCommitment({ scope: SCOPE_A, id: first.id, items: [{ id: 101, expectedColumn: 'HO' }] }),
    { code: store.ErrorCodes.DUPLICATE }
  );
});

// --- isolation / different boards -------------------------------------------

test('different teams/boards are fully isolated', async () => {
  const { api } = freshStore();
  await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), complete: true });
  await api.createSnapshot({ scope: SCOPE_B, items: [{ id: 999, column: 'HO' }], complete: true });

  const a = await api.getSnapshots(SCOPE_A);
  const b = await api.getSnapshots(SCOPE_B);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].items[0].id, 101);
  assert.equal(b[0].items[0].id, 999);
});

test('scope requires all four identity fields', () => {
  const { api } = freshStore();
  return assert.rejects(
    () => api.createSnapshot({ scope: { organization: 'o', project: 'p', team: 't' }, items: [] }),
    { code: store.ErrorCodes.INVALID_SCOPE }
  );
});

// --- column changes / added / removed (pure diff) ----------------------------

test('diffStates classifies moved, added, removed(missing) and unchanged', () => {
  const base = [
    { id: 1, column: 'Approved', columnId: 'c0' },
    { id: 2, column: 'Desenvolvimento', columnId: 'c1' },
    { id: 3, column: 'Code Review', columnId: 'c2' },
  ];
  const target = [
    { id: 1, column: 'Approved', columnId: 'c0' }, // unchanged
    { id: 2, column: 'Code Review', columnId: 'c2' }, // moved
    // id 3 removed (missing)
    { id: 4, column: 'Approved', columnId: 'c0' }, // added
  ];
  const diff = store.diffStates(base, target);
  assert.deepEqual(diff.moved.map((m) => m.id), [2]);
  assert.deepEqual(diff.added.map((a) => a.id), [4]);
  assert.deepEqual(diff.removed.map((r) => r.id), [3]);
  assert.equal(diff.removed[0].status, 'missing'); // never "done"
  assert.deepEqual(diff.unchanged.map((u) => u.id), [1]);
});

test('diffStates falls back to column name when no columnId is present', () => {
  const base = [{ id: 1, column: 'In Progress' }];
  const target = [{ id: 1, column: 'in progress' }]; // same column, different case
  const diff = store.diffStates(base, target);
  assert.equal(diff.moved.length, 0);
  assert.equal(diff.unchanged.length, 1);
});

// --- incomplete data ---------------------------------------------------------

test('incomplete capture is recorded as such and never implies completion', async () => {
  const { api } = freshStore();
  const snap = await api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), complete: false });
  assert.equal(snap.source.complete, false);
  // A card absent from a partial later snapshot is "missing", not "done".
  const diff = store.diffStates(itemsFixture(), [{ id: 101, column: 'Approved' }]);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].id, 102);
  assert.equal(diff.removed[0].status, 'missing');
});

test('UNAVAILABLE sentinel fields from the reader are dropped, null is kept', async () => {
  const { api } = freshStore();
  const UNAVAILABLE = require('../src/data/board-dom-reader.js').UNAVAILABLE;
  const snap = await api.createSnapshot({
    scope: SCOPE_A,
    complete: true,
    items: [{ id: 1, column: 'Approved', assignee: null, state: UNAVAILABLE, type: UNAVAILABLE }],
  });
  const item = snap.items[0];
  assert.equal(item.assignee, null); // present-but-empty retained
  assert.equal('state' in item, false); // unavailable dropped
  assert.equal('type' in item, false);
});

// --- commitments & revisions -------------------------------------------------

test('commitment is distinct from snapshot and keeps expected columns', async () => {
  const { api } = freshStore();
  const commitment = await api.saveCommitment({
    scope: SCOPE_A,
    items: [
      { id: 101, startColumn: 'Approved', expectedColumn: 'Closed', assignee: 'Alice' },
      { id: 102, expectedColumn: 'Code Review' },
    ],
  });
  assert.equal(commitment.kind, 'commitment');
  assert.equal(commitment.revision, 0);
  assert.equal(commitment.items[0].expectedColumn, 'Closed');
  // An item without an expected column is not a valid commitment item.
  await assert.rejects(
    () => api.saveCommitment({ scope: SCOPE_A, items: [{ id: 5 }] }),
    { code: store.ErrorCodes.INVALID_COMMITMENT }
  );
});

test('reviseCommitment archives the prior plan and preserves history', async () => {
  const { api } = freshStore();
  const created = await api.saveCommitment({
    scope: SCOPE_A,
    items: [{ id: 101, expectedColumn: 'Code Review' }],
  });
  const revised = await api.reviseCommitment(SCOPE_A, created.id, [
    { id: 101, expectedColumn: 'Closed' },
  ]);
  assert.equal(revised.revision, 1);
  assert.equal(revised.items[0].expectedColumn, 'Closed');
  assert.equal(revised.revisions.length, 1);
  assert.equal(revised.revisions[0].revision, 0);
  assert.equal(revised.revisions[0].items[0].expectedColumn, 'Code Review');

  // The persisted record reflects the revision, old plan still in history.
  const reloaded = await api.getCommitmentById(SCOPE_A, created.id);
  assert.equal(reloaded.revision, 1);
  assert.equal(reloaded.revisions[0].items[0].expectedColumn, 'Code Review');
});

// --- planned vs observed -----------------------------------------------------

test('compareStored classifies on-track / behind / missing against a snapshot', async () => {
  const { api } = freshStore();
  // Commitment: 101 -> Closed, 102 -> Code Review, 103 -> Closed.
  const commitment = await api.saveCommitment({
    scope: SCOPE_A,
    items: [
      { id: 101, expectedColumn: 'Closed' },
      { id: 102, expectedColumn: 'Code Review' },
      { id: 103, expectedColumn: 'Closed' },
    ],
  });
  // Observed snapshot: 101 reached Closed, 102 still in Desenvolvimento, 103 absent.
  const snapshot = await api.createSnapshot({
    scope: SCOPE_A,
    complete: true,
    items: [
      { id: 101, column: 'Closed' },
      { id: 102, column: 'Desenvolvimento' },
    ],
  });

  const diff = await api.compareStored(
    SCOPE_A,
    { type: 'commitment', id: commitment.id },
    { type: 'snapshot', id: snapshot.id },
    { expectedColumnOf: (item) => item.expectedColumn }
  );

  assert.deepEqual(diff.plan.onTrack.map((x) => x.id), [101]);
  assert.deepEqual(diff.plan.behind.map((x) => x.id), [102]);
  assert.deepEqual(diff.plan.missing.map((x) => x.id), [103]); // not "done"
});

// --- storage failures --------------------------------------------------------

test('a storage.set failure surfaces as STORAGE_FAILURE', async () => {
  const storage = createMockStorage({ failOn: ['set'] });
  const api = store.createStore({ storage: storage });
  await assert.rejects(
    () => api.createSnapshot({ scope: SCOPE_A, items: itemsFixture(), complete: true }),
    { code: store.ErrorCodes.STORAGE_FAILURE }
  );
});

test('a storage.get failure surfaces as STORAGE_FAILURE', async () => {
  const storage = createMockStorage({ failOn: ['get'] });
  const api = store.createStore({ storage: storage });
  await assert.rejects(() => api.getSnapshots(SCOPE_A), { code: store.ErrorCodes.STORAGE_FAILURE });
});

test('creating a store without chrome and without an adapter throws', () => {
  assert.throws(() => store.createStore({}), { code: store.ErrorCodes.STORAGE_FAILURE });
});

// --- schema migration --------------------------------------------------------

test('migrateRecord upgrades an older record to the current schema version', () => {
  const legacy = { kind: 'snapshot', schemaVersion: 0, items: [] };
  const migrated = store.migrateRecord(legacy);
  assert.equal(migrated.schemaVersion, store.SCHEMA_VERSION);
});

test('migrateRecord leaves a current-version record unchanged in version', () => {
  const current = { kind: 'snapshot', schemaVersion: store.SCHEMA_VERSION, items: [] };
  const migrated = store.migrateRecord(current);
  assert.equal(migrated.schemaVersion, store.SCHEMA_VERSION);
});

// --- retention / capacity ----------------------------------------------------

test('count-based retention keeps only the newest N snapshots per board', async () => {
  const storage = createMockStorage();
  const api = store.createStore({ storage: storage, retention: { maxSnapshotsPerBoard: 2 } });
  for (let i = 0; i < 5; i++) {
    await api.createSnapshot({
      scope: SCOPE_A,
      complete: true,
      capturedAt: new Date(2024, 0, 1 + i, 9, 0, 0),
      items: [{ id: 1, column: 'Approved' }],
    });
  }
  const kept = await api.getSnapshots(SCOPE_A);
  assert.equal(kept.length, 2);
  // Newest first: Jan 5 and Jan 4 survive.
  assert.equal(kept[0].capturedAt.localDay, '2024-01-05');
  assert.equal(kept[1].capturedAt.localDay, '2024-01-04');
});

test('retention does not delete another board\'s snapshots', async () => {
  const storage = createMockStorage();
  const api = store.createStore({ storage: storage, retention: { maxSnapshotsPerBoard: 1 } });
  await api.createSnapshot({ scope: SCOPE_A, items: [{ id: 1, column: 'A' }], complete: true, capturedAt: new Date(2024, 0, 1) });
  await api.createSnapshot({ scope: SCOPE_A, items: [{ id: 1, column: 'B' }], complete: true, capturedAt: new Date(2024, 0, 2) });
  await api.createSnapshot({ scope: SCOPE_B, items: [{ id: 2, column: 'C' }], complete: true, capturedAt: new Date(2024, 0, 1) });

  assert.equal((await api.getSnapshots(SCOPE_A)).length, 1);
  assert.equal((await api.getSnapshots(SCOPE_B)).length, 1);
});

test('purge removes records older than a day and can wipe a scope', async () => {
  const { api } = freshStore();
  await api.createSnapshot({ scope: SCOPE_A, items: [{ id: 1, column: 'A' }], complete: true, capturedAt: new Date(2024, 0, 1) });
  await api.createSnapshot({ scope: SCOPE_A, items: [{ id: 1, column: 'B' }], complete: true, capturedAt: new Date(2024, 0, 10) });

  const pruned = await api.purge(SCOPE_A, { olderThanDay: '2024-01-05' });
  assert.equal(pruned.removed, 1);
  assert.equal((await api.getSnapshots(SCOPE_A)).length, 1);

  const wiped = await api.purge(SCOPE_A, { all: true });
  assert.equal(wiped.removed, 1);
  assert.equal((await api.getSnapshots(SCOPE_A)).length, 0);
});

test('age-based retention prunes snapshots older than maxAgeDays', async () => {
  const storage = createMockStorage();
  const api = store.createStore({
    storage: storage,
    retention: { maxSnapshotsPerBoard: null, maxAgeDays: 7 },
    now: fixedClock(new Date(2024, 0, 20, 9, 0, 0).getTime()),
  });
  // Old (Jan 1) should be pruned on the next write; recent (Jan 18) should stay.
  await api.createSnapshot({ scope: SCOPE_A, items: [{ id: 1, column: 'A' }], complete: true, capturedAt: new Date(2024, 0, 1, 9, 0, 0) });
  await api.createSnapshot({ scope: SCOPE_A, items: [{ id: 1, column: 'B' }], complete: true, capturedAt: new Date(2024, 0, 18, 9, 0, 0) });

  const kept = await api.getSnapshots(SCOPE_A);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].capturedAt.localDay, '2024-01-18');
});
