// test/daily-comparison.test.js
// Tests for Daily Comparison (docs/PRODUCT_ROADMAP.md T1.6).
//
// The comparison VIEW-MODEL (src/features/daily/daily-comparison.js) is a pure, Chrome-free
// and DOM-free module. It REUSES the classification engine
// (src/features/daily/daily-commitment.js, compareCommitment) and adds snapshot selection,
// daily metrics (counts + a proven fulfillment rate), reliability flags and the
// per-result filters the UI needs.
//
// Covers, 1:1 with the T1.6 task list (section 8):
//   - commitment fully fulfilled
//   - commitment partially fulfilled
//   - all commitments behind (pending)
//   - movement beyond the plan
//   - vanished cards (missing)
//   - normalized column names (accent/case tolerant)
//   - unknown column order -> off-track / unreliable rate
//   - incomplete snapshot flagged
//   - incompatible snapshots refused
//   - commitment revisions (historic plan not rewritten)
//   - org/project/board isolation in snapshot selection
//   - persistence and retrieval (through the real store)
//   - metric correctness (fulfillment rate formula)
//   - result filters
//   - reuse of compareCommitment (no second engine)
//   - WIP isolation (engine reads/writes no WIP number)
//
// Zero dependencies: Node's built-in runner + the chrome storage mock.
//
// All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');

const comparison = require('../src/features/daily/daily-comparison.js');
const commitmentEngine = require('../src/features/daily/daily-commitment.js');
const store = require('../src/data/snapshot-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const SCOPE_A = { organization: 'contoso-org', project: 'Sample.Project', team: 'Alpha', board: 'Stories' };
const SCOPE_B = { organization: 'contoso-org', project: 'Sample.Project', team: 'Beta', board: 'Stories' };

const FLOW = ['Approved', 'Desenvolvimento', 'Code Review', 'HO', 'Closed'];

function columnsOf(names) {
  return (names || FLOW).map((name, order) => ({ id: 'col-' + order, name, order }));
}

// Build a snapshot-like record. `epochMs` drives capture-time ordering.
function snapshotOf(items, opts) {
  const o = opts || {};
  const epochMs = o.epochMs != null ? o.epochMs : Date.now();
  return {
    id: o.id || 'snap_' + epochMs,
    scope: o.scope || SCOPE_A,
    items,
    columns: o.columns === null ? undefined : columnsOf(o.columns),
    capturedAt: { epochMs, iso: new Date(epochMs).toISOString(), localDay: o.localDay || '2024-05-10' },
    source: { origin: 'dom-reader', complete: o.complete !== false },
  };
}

// A commitment record (store-like shape) with an explicit items list.
function commitmentOf(items, opts) {
  const o = opts || {};
  return {
    id: o.id || 'cmt_1',
    scope: o.scope || SCOPE_A,
    items,
    revision: o.revision != null ? o.revision : 0,
    revisions: o.revisions || [],
    createdAt: { epochMs: o.epochMs || 1, localDay: o.localDay || '2024-05-10' },
  };
}

function freshStore() {
  const storage = createMockStorage();
  return { api: store.createStore({ storage }), storage };
}

// --- 1. commitment fully fulfilled -------------------------------------------

test('fully fulfilled: every committed item reached its expected column', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Desenvolvimento' },
  ]);
  const commitment = commitmentOf([
    { id: 1, startColumn: 'Approved', expectedColumn: 'Code Review' },
    { id: 2, startColumn: 'Desenvolvimento', expectedColumn: 'HO' },
  ]);
  const later = snapshotOf(
    [
      { id: 1, column: 'Code Review' },
      { id: 2, column: 'HO' },
    ],
    { epochMs: Date.now() + 10000 }
  );

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });

  assert.equal(vm.ok, true);
  assert.equal(vm.metrics.committed, 2);
  assert.equal(vm.metrics.reached, 2);
  assert.equal(vm.metrics.fulfilled, 2);
  assert.equal(vm.metrics.fulfillmentRate, 100);
  assert.equal(vm.metrics.rateReliable, true);
  assert.equal(vm.reliability.reliable, true);
});

// --- 2. commitment partially fulfilled ---------------------------------------

test('partially fulfilled: mix of reached and behind yields a correct rate', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
    { id: 3, column: 'Approved' },
    { id: 4, column: 'Approved' },
  ]);
  const commitment = commitmentOf([
    { id: 1, expectedColumn: 'Code Review' },
    { id: 2, expectedColumn: 'Code Review' },
    { id: 3, expectedColumn: 'Code Review' },
    { id: 4, expectedColumn: 'Code Review' },
  ]);
  const later = snapshotOf(
    [
      { id: 1, column: 'Code Review' }, // reached
      { id: 2, column: 'Code Review' }, // reached
      { id: 3, column: 'Desenvolvimento' }, // behind
      { id: 4, column: 'Desenvolvimento' }, // behind
    ],
    { epochMs: Date.now() + 10000 }
  );

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.metrics.reached, 2);
  assert.equal(vm.metrics.behind, 2);
  assert.equal(vm.metrics.fulfilled, 2);
  // (2 / 4) * 100 = 50
  assert.equal(vm.metrics.fulfillmentRate, 50);
  assert.equal(vm.metrics.rateReliable, true);
});

// --- 3. all commitments behind (pending) -------------------------------------

test('all behind: nothing moved, rate is 0 but computable', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const commitment = commitmentOf([
    { id: 1, expectedColumn: 'HO' },
    { id: 2, expectedColumn: 'HO' },
  ]);
  const later = snapshotOf(
    [
      { id: 1, column: 'Approved' },
      { id: 2, column: 'Approved' },
    ],
    { epochMs: Date.now() + 10000 }
  );

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.metrics.behind, 2);
  assert.equal(vm.metrics.fulfilled, 0);
  assert.equal(vm.metrics.fulfillmentRate, 0);
  assert.equal(vm.metrics.rateReliable, true);
});

// --- 4. movement beyond the plan ---------------------------------------------

test('beyond: an item past its expected column counts as fulfilled', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'Code Review' }]);
  const later = snapshotOf([{ id: 1, column: 'Closed' }], { epochMs: Date.now() + 10000 });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.metrics.beyond, 1);
  assert.equal(vm.metrics.fulfilled, 1);
  assert.equal(vm.metrics.fulfillmentRate, 100);
  assert.equal(vm.results[0].status, 'beyond');
});

// --- 5. vanished cards (missing) ---------------------------------------------

test('missing: a committed item absent from the later snapshot is undetermined, not a failure', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const commitment = commitmentOf([
    { id: 1, expectedColumn: 'HO' },
    { id: 2, expectedColumn: 'HO' },
  ]);
  const later = snapshotOf([{ id: 1, column: 'HO' }], { epochMs: Date.now() + 10000 });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.metrics.reached, 1);
  assert.equal(vm.metrics.missing, 1);
  assert.equal(vm.metrics.undetermined, 1);
  // (1 reached / 2 committed) * 100 = 50; missing is NOT a failure in the rate.
  assert.equal(vm.metrics.fulfillmentRate, 50);
  const missingRow = vm.results.find((r) => r.id === 2);
  assert.equal(missingRow.status, 'missing');
  assert.equal(missingRow.undetermined, true);
  assert.equal(missingRow.explanation, 'MISSING_NO_CARD');
});

// --- 6. normalized column names ----------------------------------------------

test('normalized columns: accent/case differences still match as reached', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'Desenvolvimento' }]);
  const later = snapshotOf([{ id: 1, column: '  DESENVOLVIMENTO ' }], { epochMs: Date.now() + 10000 });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.results[0].status, 'reached');
  assert.equal(vm.metrics.fulfillmentRate, 100);
});

// --- 7. unknown column order -> off-track + unreliable rate -------------------

test('unknown order: no columns structure -> off-track and the rate is suppressed', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  // Later snapshot has items but NO columns structure and we pass no columnOrder.
  const later = snapshotOf([{ id: 1, column: 'Desenvolvimento' }], {
    epochMs: Date.now() + 10000,
    columns: null,
  });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.results[0].status, 'off-track');
  assert.equal(vm.results[0].undetermined, true);
  assert.equal(vm.results[0].explanation, 'OFF_TRACK_UNKNOWN_ORDER');
  assert.equal(vm.orderReliable, false);
  assert.equal(vm.metrics.fulfillmentRate, null);
  assert.equal(vm.metrics.rateReliable, false);
  assert.ok(vm.reliability.reasons.includes('UNRELIABLE_COLUMN_ORDER'));
});

test('explicit columnOrder restores a reliable behind/beyond even without columns', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf([{ id: 1, column: 'Desenvolvimento' }], {
    epochMs: Date.now() + 10000,
    columns: null,
  });

  const vm = comparison.buildComparison({
    initialSnapshot: initial,
    commitment,
    laterSnapshot: later,
    columnOrder: FLOW,
  });
  assert.equal(vm.results[0].status, 'behind');
  assert.equal(vm.orderReliable, true);
  assert.equal(vm.metrics.rateReliable, true);
  assert.equal(vm.metrics.fulfillmentRate, 0);
});

// --- 8. incomplete snapshot flagged ------------------------------------------

test('incomplete later snapshot is flagged in reliability', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf([{ id: 1, column: 'HO' }], { epochMs: Date.now() + 10000, complete: false });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.reliability.reliable, false);
  assert.ok(vm.reliability.reasons.includes('INCOMPLETE_LATER_SNAPSHOT'));
  // The item still classifies, but the daily is flagged not fully reliable.
  assert.equal(vm.results[0].status, 'reached');
});

test('incomplete initial snapshot is flagged in reliability', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }], { complete: false });
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf([{ id: 1, column: 'HO' }], { epochMs: Date.now() + 10000 });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.ok(vm.reliability.reasons.includes('INCOMPLETE_INITIAL_SNAPSHOT'));
});

// --- 9. no later snapshot: honest "no later snapshot" state ------------------

test('no later snapshot: every item is missing, rate suppressed, reason reported', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const commitment = commitmentOf([
    { id: 1, expectedColumn: 'HO' },
    { id: 2, expectedColumn: 'HO' },
  ]);

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: null });
  assert.equal(vm.ok, true);
  assert.equal(vm.later, null);
  assert.equal(vm.metrics.missing, 2);
  assert.equal(vm.metrics.fulfillmentRate, null);
  assert.equal(vm.metrics.rateReliable, false);
  assert.ok(vm.reliability.reasons.includes('NO_LATER_SNAPSHOT'));
  assert.equal(vm.results[0].explanation, 'MISSING_NO_LATER');
});

// --- 10. incompatible snapshots refused --------------------------------------

test('later snapshot from a different board scope is refused', () => {
  const initial = snapshotOf([{ id: 1, column: 'Approved' }], { scope: SCOPE_A });
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { scope: SCOPE_A });
  const later = snapshotOf([{ id: 1, column: 'HO' }], {
    epochMs: Date.now() + 10000,
    scope: SCOPE_B,
  });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.ok, false);
  assert.equal(vm.error, 'SNAPSHOT_SCOPE_MISMATCH');
});

test('later snapshot not strictly after the initial is refused', () => {
  const t = Date.now();
  const initial = snapshotOf([{ id: 1, column: 'Approved' }], { epochMs: t });
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf([{ id: 1, column: 'HO' }], { epochMs: t }); // same instant

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.ok, false);
  assert.equal(vm.error, 'LATER_SNAPSHOT_NOT_AFTER_INITIAL');
});

// --- 11. snapshot selection: same board, strictly after -----------------------

test('selectComparableSnapshots returns only same-board snapshots captured after the initial, newest first', () => {
  const base = snapshotOf([], { id: 'base', epochMs: 1000, scope: SCOPE_A });
  const candidates = [
    base,
    snapshotOf([], { id: 'earlier', epochMs: 500, scope: SCOPE_A }), // before -> excluded
    snapshotOf([], { id: 'later1', epochMs: 2000, scope: SCOPE_A }),
    snapshotOf([], { id: 'later2', epochMs: 3000, scope: SCOPE_A }),
    snapshotOf([], { id: 'otherBoard', epochMs: 4000, scope: SCOPE_B }), // other board -> excluded
  ];

  const result = comparison.selectComparableSnapshots(candidates, base);
  assert.deepEqual(result.map((s) => s.id), ['later2', 'later1']);
});

// --- 12. commitment revisions: historic plan not rewritten -------------------

test('an explicit revision compares against the archived plan, not the latest', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  // Current (revision 1) plan: both to Closed. Archived (revision 0): both to HO.
  const commitment = commitmentOf(
    [
      { id: 1, expectedColumn: 'Closed' },
      { id: 2, expectedColumn: 'Closed' },
    ],
    {
      revision: 1,
      revisions: [
        {
          revision: 0,
          items: [
            { id: 1, expectedColumn: 'HO' },
            { id: 2, expectedColumn: 'HO' },
          ],
        },
      ],
    }
  );
  const later = snapshotOf(
    [
      { id: 1, column: 'HO' },
      { id: 2, column: 'HO' },
    ],
    { epochMs: Date.now() + 10000 }
  );

  // Against the HISTORIC revision 0, both reached (HO).
  const historic = comparison.buildComparison({
    initialSnapshot: initial,
    commitment,
    revision: 0,
    laterSnapshot: later,
  });
  assert.equal(historic.commitment.revision, 0);
  assert.equal(historic.commitment.usedArchived, true);
  assert.equal(historic.metrics.reached, 2);
  assert.equal(historic.metrics.fulfillmentRate, 100);

  // Against the CURRENT revision 1 (to Closed), both are behind (still at HO).
  const current = comparison.buildComparison({
    initialSnapshot: initial,
    commitment,
    laterSnapshot: later,
  });
  assert.equal(current.commitment.revision, 1);
  assert.equal(current.metrics.behind, 2);
  assert.equal(current.metrics.fulfillmentRate, 0);
});

// --- 13. org/project/board isolation + persistence through the real store ----

test('end to end through the store: isolation + retrieval of snapshots and commitments', async () => {
  const { api } = freshStore();

  const t0 = Date.parse('2024-05-10T09:00:00Z');
  const t1 = Date.parse('2024-05-10T17:00:00Z');

  // Board A: morning snapshot, a commitment, an afternoon snapshot.
  const initialA = await api.createSnapshot({
    scope: SCOPE_A,
    capturedAt: new Date(t0),
    complete: true,
    columns: columnsOf(),
    items: [
      { id: 1, column: 'Approved' },
      { id: 2, column: 'Desenvolvimento' },
    ],
  });
  await api.saveCommitment({
    scope: SCOPE_A,
    baseSnapshotId: initialA.id,
    items: [
      { id: 1, startColumn: 'Approved', expectedColumn: 'Code Review' },
      { id: 2, startColumn: 'Desenvolvimento', expectedColumn: 'HO' },
    ],
  });
  const laterA = await api.createSnapshot({
    scope: SCOPE_A,
    capturedAt: new Date(t1),
    complete: true,
    columns: columnsOf(),
    items: [
      { id: 1, column: 'Code Review' },
      { id: 2, column: 'HO' },
    ],
  });

  // Board B: its own snapshot, must not leak into A's comparison.
  await api.createSnapshot({
    scope: SCOPE_B,
    capturedAt: new Date(t1 + 1000),
    complete: true,
    columns: columnsOf(),
    items: [{ id: 99, column: 'Closed' }],
  });

  // Retrieve A's data and build the comparison.
  const snapshotsA = await api.getSnapshots(SCOPE_A);
  const commitmentsA = await api.getCommitments(SCOPE_A);
  const baseline = snapshotsA.find((s) => s.id === initialA.id);
  const laterCandidates = comparison.selectComparableSnapshots(snapshotsA, baseline);

  // Only A's afternoon snapshot is a valid later target; B's is excluded.
  assert.equal(laterCandidates.length, 1);
  assert.equal(laterCandidates[0].id, laterA.id);

  const vm = comparison.buildComparison({
    initialSnapshot: baseline,
    commitment: commitmentsA[0],
    laterSnapshot: laterCandidates[0],
  });
  assert.equal(vm.ok, true);
  assert.equal(vm.metrics.reached, 2);
  assert.equal(vm.metrics.fulfillmentRate, 100);
  assert.equal(vm.dailyDate, '2024-05-10');
});

// --- 14. metric correctness (formula) ----------------------------------------

test('fulfillment rate uses ((reached + beyond) / committed) * 100', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
    { id: 3, column: 'Approved' },
  ]);
  const commitment = commitmentOf([
    { id: 1, expectedColumn: 'Code Review' },
    { id: 2, expectedColumn: 'Code Review' },
    { id: 3, expectedColumn: 'Code Review' },
  ]);
  const later = snapshotOf(
    [
      { id: 1, column: 'Code Review' }, // reached
      { id: 2, column: 'Closed' }, // beyond
      { id: 3, column: 'Approved' }, // behind
    ],
    { epochMs: Date.now() + 10000 }
  );

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.metrics.reached, 1);
  assert.equal(vm.metrics.beyond, 1);
  assert.equal(vm.metrics.behind, 1);
  assert.equal(vm.metrics.fulfilled, 2);
  // (2 / 3) * 100 = 66.666..., rounded to one decimal = 66.7
  assert.equal(vm.metrics.fulfillmentRate, 66.7);
});

// --- 15. result filters -------------------------------------------------------

test('filterResults keeps only rows of the requested category; ALL returns a copy', () => {
  const results = [
    { id: 1, status: 'reached' },
    { id: 2, status: 'behind' },
    { id: 3, status: 'beyond' },
    { id: 4, status: 'off-track' },
    { id: 5, status: 'missing' },
  ];

  assert.deepEqual(comparison.filterResults(results, 'all').map((r) => r.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(comparison.filterResults(results, 'reached').map((r) => r.id), [1]);
  assert.deepEqual(comparison.filterResults(results, 'behind').map((r) => r.id), [2]);
  assert.deepEqual(comparison.filterResults(results, 'beyond').map((r) => r.id), [3]);
  assert.deepEqual(comparison.filterResults(results, 'off-track').map((r) => r.id), [4]);
  assert.deepEqual(comparison.filterResults(results, 'missing').map((r) => r.id), [5]);

  // ALL returns a shallow copy (not the same reference).
  const copy = comparison.filterResults(results, 'all');
  assert.notEqual(copy, results);
});

// --- 16. reuse of compareCommitment (no second engine) -----------------------

test('the view-model delegates classification to the injected engine (reuse, not duplication)', () => {
  let called = 0;
  const spyEngine = {
    compareCommitment(commitmentArg, realized, options) {
      called += 1;
      // Delegate to the real engine so behavior is identical.
      return commitmentEngine.compareCommitment(commitmentArg, realized, options);
    },
  };

  const initial = snapshotOf([{ id: 1, column: 'Approved' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf([{ id: 1, column: 'HO' }], { epochMs: Date.now() + 10000 });

  const vm = comparison.buildComparison(
    { initialSnapshot: initial, commitment, laterSnapshot: later },
    { engine: spyEngine }
  );
  assert.equal(called, 1);
  assert.equal(vm.results[0].status, 'reached');
});

// --- 17. WIP isolation + module hygiene --------------------------------------

test('the comparison module source references no WIP number, DOM, Chrome or storage', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'features', 'daily', 'daily-comparison.js'), 'utf8');
  assert.equal(/\bdocument\b/.test(src), false, 'must not touch the DOM');
  assert.equal(/\bMutationObserver\b/.test(src), false, 'must not use MutationObserver');
  assert.equal(/chrome\.(storage|runtime)/.test(src), false, 'must not call chrome APIs');
  assert.equal(/\binnerHTML\b/.test(src), false, 'must not write innerHTML');
  assert.equal(/\bwipColumns\b|computeWipLimit|finalWip/.test(src), false, 'must not read/write a WIP number');
});

// --- 18. an item without a commitment never enters the comparison ------------

test('items present on the board but not committed are never compared', () => {
  const initial = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  // Only item 1 is committed.
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf(
    [
      { id: 1, column: 'HO' },
      { id: 2, column: 'Closed' },
    ],
    { epochMs: Date.now() + 10000 }
  );

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.metrics.committed, 1);
  assert.equal(vm.results.length, 1);
  assert.equal(vm.results[0].id, 1);
});

// --- 19. startColumn is sourced from the initial snapshot ---------------------

test('each result row reports the start column from the initial snapshot', () => {
  const initial = snapshotOf([{ id: 1, column: 'Desenvolvimento' }]);
  const commitment = commitmentOf([{ id: 1, expectedColumn: 'HO' }]);
  const later = snapshotOf([{ id: 1, column: 'HO' }], { epochMs: Date.now() + 10000 });

  const vm = comparison.buildComparison({ initialSnapshot: initial, commitment, laterSnapshot: later });
  assert.equal(vm.results[0].startColumn, 'Desenvolvimento');
  assert.equal(vm.results[0].expectedColumn, 'HO');
  assert.equal(vm.results[0].actualColumn, 'HO');
});
