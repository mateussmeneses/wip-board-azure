// test/daily-history.test.js
// Tests for Daily History (docs/PRODUCT_ROADMAP.md T1.7).
//
// The history AGGREGATION layer (src/features/daily/daily-history.js) is a pure,
// Chrome-free and DOM-free module. It REUSES the T1.6 comparison view-model
// (src/features/daily/daily-comparison.js), which itself reuses the T1.3 classification
// engine. This module adds: reconstruction of one daily record per commitment
// from persisted snapshots + commitments, deterministic selection of the
// evaluation snapshot from PERSISTED data only, date-range filtering,
// chronological ordering, and commitment-weighted aggregate indicators.
//
// Covers, 1:1 with the T1.7 task list (section 8):
//   - empty history
//   - one daily recorded
//   - multiple dailies
//   - days with different commitment counts
//   - overall weighted rate
//   - partially fulfilled commitments
//   - incomplete snapshots
//   - no later snapshot
//   - missing and off-track
//   - commitment revisions (revision in effect preserved)
//   - several dates for the same board
//   - multiple dailies on the same day (identities preserved, not merged)
//   - board isolation
//   - date-range filter
//   - chronological ordering (newest first)
//   - timezone / day boundary
//   - schema migration (v1 -> v2 additive evaluation field)
//   - retention and referential integrity (missing dependencies)
//   - persistence after reload (through the real store)
//   - no WIP / DOM / Chrome in the module source
//
// Zero dependencies: Node's built-in runner + the chrome storage mock.
//
// All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');

const history = require('../src/features/daily/daily-history.js');
const comparison = require('../src/features/daily/daily-comparison.js');
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

// A commitment record (store-like shape).
function commitmentOf(items, opts) {
  const o = opts || {};
  return {
    id: o.id || 'cmt_1',
    scope: o.scope || SCOPE_A,
    baseSnapshotId: o.baseSnapshotId != null ? o.baseSnapshotId : null,
    items,
    revision: o.revision != null ? o.revision : 0,
    revisions: o.revisions || [],
    evaluation: o.evaluation !== undefined ? o.evaluation : null,
    createdAt: { epochMs: o.epochMs || 1, iso: new Date(o.epochMs || 1).toISOString(), localDay: o.localDay || '2024-05-10' },
  };
}

function freshStore(extra) {
  const storage = createMockStorage();
  const cfg = Object.assign({ storage }, extra || {});
  return { api: store.createStore(cfg), storage };
}

function fixedClock(epochMs) {
  let t = epochMs;
  return function () { return new Date(t); };
}

// --- 1. empty history --------------------------------------------------------

test('empty history: no records, aggregate reports zero dailies and no rate', () => {
  const view = history.buildHistoryView({ snapshots: [], commitments: [] });
  assert.equal(view.records.length, 0);
  assert.equal(view.summary.dailies, 0);
  assert.equal(view.summary.committed, 0);
  assert.equal(view.summary.overallRate, null);
  assert.equal(view.summary.rateReliable, false);
  // Absence of data is NOT zero commitments and NOT a 0% rate.
  assert.equal(view.summary.unreliableDailies, 0);
  assert.deepEqual(view.summary.evolution, []);
});

// --- 2. one daily recorded ---------------------------------------------------

test('one daily: a single commitment + base + later snapshot yields one record', () => {
  const initial = snapshotOf(
    [{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }],
    { id: 'base', epochMs: 1000 }
  );
  const later = snapshotOf(
    [{ id: 1, column: 'Code Review' }, { id: 2, column: 'Code Review' }],
    { id: 'later', epochMs: 2000 }
  );
  const commitment = commitmentOf(
    [{ id: 1, expectedColumn: 'Code Review' }, { id: 2, expectedColumn: 'Code Review' }],
    { baseSnapshotId: 'base', epochMs: 1000 }
  );

  const view = history.buildHistoryView({ snapshots: [initial, later], commitments: [commitment] });
  assert.equal(view.records.length, 1);
  const rec = view.records[0];
  assert.equal(rec.initial.id, 'base');
  assert.equal(rec.later.id, 'later');
  assert.equal(rec.metrics.committed, 2);
  assert.equal(rec.metrics.reached, 2);
  assert.equal(rec.metrics.fulfillmentRate, 100);
  assert.equal(rec.reliability.reliable, true);
  assert.equal(view.summary.dailies, 1);
  assert.equal(view.summary.overallRate, 100);
  assert.equal(view.summary.rateReliable, true);
});

// --- 3. multiple dailies + 4. different commitment counts + 5. weighted rate --

test('multiple dailies: overall rate is weighted by commitment count, not a simple average', () => {
  // Daily 1 (day 1): 4 commitments, 1 fulfilled -> 25%.
  const base1 = snapshotOf([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }, { id: 3, column: 'Approved' }, { id: 4, column: 'Approved' }], { id: 'b1', epochMs: 1000, localDay: '2024-05-10' });
  const later1 = snapshotOf([{ id: 1, column: 'Code Review' }, { id: 2, column: 'Approved' }, { id: 3, column: 'Approved' }, { id: 4, column: 'Approved' }], { id: 'l1', epochMs: 2000, localDay: '2024-05-10' });
  const cmt1 = commitmentOf([{ id: 1, expectedColumn: 'Code Review' }, { id: 2, expectedColumn: 'Code Review' }, { id: 3, expectedColumn: 'Code Review' }, { id: 4, expectedColumn: 'Code Review' }], { id: 'c1', baseSnapshotId: 'b1', epochMs: 1000, localDay: '2024-05-10' });

  // Daily 2 (day 2): 1 commitment, 1 fulfilled -> 100%.
  const base2 = snapshotOf([{ id: 9, column: 'Approved' }], { id: 'b2', epochMs: 10000, localDay: '2024-05-11' });
  const later2 = snapshotOf([{ id: 9, column: 'Closed' }], { id: 'l2', epochMs: 20000, localDay: '2024-05-11' });
  const cmt2 = commitmentOf([{ id: 9, expectedColumn: 'Closed' }], { id: 'c2', baseSnapshotId: 'b2', epochMs: 10000, localDay: '2024-05-11' });

  const view = history.buildHistoryView({
    snapshots: [base1, later1, base2, later2],
    commitments: [cmt1, cmt2],
  });

  assert.equal(view.records.length, 2);
  // Simple average would be (25 + 100) / 2 = 62.5. Weighted is
  // (1 + 1) fulfilled / (4 + 1) committed = 2/5 = 40%.
  assert.equal(view.summary.committed, 5);
  assert.equal(view.summary.fulfilled, 2);
  assert.equal(view.summary.overallRate, 40);
  assert.equal(view.summary.rateReliable, true);
  assert.equal(view.summary.dailies, 2);
  assert.equal(view.summary.reliableDailies, 2);
});

// --- 6. partially fulfilled --------------------------------------------------

test('partially fulfilled: reached + beyond counted as fulfilled, behind is not', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }, { id: 3, column: 'Approved' }], { id: 'b', epochMs: 1000 });
  const later = snapshotOf([{ id: 1, column: 'Code Review' }, { id: 2, column: 'Closed' }, { id: 3, column: 'Approved' }], { id: 'l', epochMs: 2000 });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'Code Review' }, { id: 2, expectedColumn: 'Code Review' }, { id: 3, expectedColumn: 'Code Review' }], { baseSnapshotId: 'b', epochMs: 1000 });

  const view = history.buildHistoryView({ snapshots: [base, later], commitments: [cmt] });
  const m = view.records[0].metrics;
  assert.equal(m.reached, 1);
  assert.equal(m.beyond, 1);
  assert.equal(m.behind, 1);
  assert.equal(m.fulfilled, 2);
  assert.equal(m.fulfillmentRate, 66.7);
});

// --- 7. incomplete snapshots -------------------------------------------------

test('incomplete snapshot: record is flagged unreliable and excluded from the overall rate', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b', epochMs: 1000, complete: false });
  const later = snapshotOf([{ id: 1, column: 'HO' }], { id: 'l', epochMs: 2000 });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { baseSnapshotId: 'b', epochMs: 1000 });

  const view = history.buildHistoryView({ snapshots: [base, later], commitments: [cmt] });
  const rec = view.records[0];
  assert.equal(rec.reliability.reliable, false);
  assert.ok(rec.reliability.reasons.includes('INCOMPLETE_SNAPSHOT'));
  // The item still classifies, but the daily does not feed the overall rate.
  assert.equal(view.summary.overallRate, null);
  assert.equal(view.summary.rateReliable, false);
  assert.equal(view.summary.unreliableDailies, 1);
  assert.equal(view.summary.reliableDailies, 0);
});

// --- 8. no later snapshot ----------------------------------------------------

test('no later snapshot: record kept, flagged NO_LATER_SNAPSHOT, no invented rate', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b', epochMs: 1000 });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { baseSnapshotId: 'b', epochMs: 1000 });

  const view = history.buildHistoryView({ snapshots: [base], commitments: [cmt] });
  const rec = view.records[0];
  assert.equal(rec.later, null);
  assert.equal(rec.metrics.missing, 1);
  assert.equal(rec.metrics.fulfillmentRate, null);
  assert.ok(rec.reliability.reasons.includes('NO_LATER_SNAPSHOT'));
  assert.equal(view.summary.overallRate, null);
  assert.equal(view.summary.unreliableDailies, 1);
});

// --- 9. missing and off-track are undetermined, never proven failures --------

test('missing and off-track are reported as undetermined, not failures', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }], { id: 'b', epochMs: 1000 });
  // id 1 off-track (unknown order), id 2 missing from later.
  const later = snapshotOf([{ id: 1, column: 'Desenvolvimento' }], { id: 'l', epochMs: 2000, columns: null });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }, { id: 2, expectedColumn: 'HO' }], { baseSnapshotId: 'b', epochMs: 1000 });

  const view = history.buildHistoryView({ snapshots: [base, later], commitments: [cmt] });
  const m = view.records[0].metrics;
  assert.equal(m.offTrack, 1);
  assert.equal(m.missing, 1);
  assert.equal(m.undetermined, 2);
  // No column order + undetermined -> rate suppressed, not a 0% failure.
  assert.equal(m.fulfillmentRate, null);
  assert.equal(view.summary.undetermined, 2);
});

// --- 10. commitment revisions: revision in effect is preserved ----------------

test('revision in effect: the persisted evaluation revision is compared, not the current plan', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b', epochMs: 1000 });
  const later = snapshotOf([{ id: 1, column: 'HO' }], { id: 'l', epochMs: 2000 });
  // Current revision 1 plans Closed; archived revision 0 planned HO. The daily
  // was evaluated under revision 0 (persisted).
  const cmt = commitmentOf(
    [{ id: 1, expectedColumn: 'Closed' }],
    {
      baseSnapshotId: 'b',
      epochMs: 1000,
      revision: 1,
      revisions: [{ revision: 0, items: [{ id: 1, expectedColumn: 'HO' }] }],
      evaluation: { laterSnapshotId: 'l', revision: 0, evaluatedAt: { epochMs: 2000 } },
    }
  );

  const view = history.buildHistoryView({ snapshots: [base, later], commitments: [cmt] });
  const rec = view.records[0];
  assert.equal(rec.revisionInEffect, 0);
  assert.equal(rec.usedPersistedEvaluation, true);
  assert.equal(rec.vm.commitment.usedArchived, true);
  // Against revision 0 (HO), the item reached HO.
  assert.equal(rec.metrics.reached, 1);
  assert.equal(rec.metrics.fulfillmentRate, 100);
});

test('without a persisted evaluation, the current plan is compared but never claimed as the original', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b', epochMs: 1000 });
  const later = snapshotOf([{ id: 1, column: 'HO' }], { id: 'l', epochMs: 2000 });
  const cmt = commitmentOf(
    [{ id: 1, expectedColumn: 'Closed' }],
    {
      baseSnapshotId: 'b',
      epochMs: 1000,
      revision: 1,
      revisions: [{ revision: 0, items: [{ id: 1, expectedColumn: 'HO' }] }],
      evaluation: null,
    }
  );

  const view = history.buildHistoryView({ snapshots: [base, later], commitments: [cmt] });
  const rec = view.records[0];
  assert.equal(rec.revisionInEffect, null);
  assert.equal(rec.usedPersistedEvaluation, false);
  // Current revision 1 plans Closed; item is at HO -> behind, not reached.
  assert.equal(rec.metrics.behind, 1);
  assert.equal(rec.vm.commitment.revision, 1);
});

// --- 11. several dates for the same board ------------------------------------

test('several dates for one board: evolution has one point per day, oldest first', () => {
  const b1 = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b1', epochMs: 1000, localDay: '2024-05-10' });
  const l1 = snapshotOf([{ id: 1, column: 'Closed' }], { id: 'l1', epochMs: 2000, localDay: '2024-05-10' });
  const c1 = commitmentOf([{ id: 1, expectedColumn: 'Closed' }], { id: 'c1', baseSnapshotId: 'b1', epochMs: 1000, localDay: '2024-05-10' });

  const b2 = snapshotOf([{ id: 2, column: 'Approved' }], { id: 'b2', epochMs: 100000, localDay: '2024-05-12' });
  const l2 = snapshotOf([{ id: 2, column: 'Approved' }], { id: 'l2', epochMs: 200000, localDay: '2024-05-12' });
  const c2 = commitmentOf([{ id: 2, expectedColumn: 'Closed' }], { id: 'c2', baseSnapshotId: 'b2', epochMs: 100000, localDay: '2024-05-12' });

  const view = history.buildHistoryView({ snapshots: [b1, l1, b2, l2], commitments: [c1, c2] });
  assert.deepEqual(view.summary.evolution.map(p => p.date), ['2024-05-10', '2024-05-12']);
  assert.equal(view.summary.evolution[0].rate, 100);
  assert.equal(view.summary.evolution[1].rate, 0);
});

// --- 12. multiple dailies on the same day: identities preserved, not merged ---

test('two dailies on the same day stay distinct records (not merged)', () => {
  const b1 = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b1', epochMs: 1000, localDay: '2024-05-10' });
  const l1 = snapshotOf([{ id: 1, column: 'HO' }], { id: 'l1', epochMs: 2000, localDay: '2024-05-10' });
  const c1 = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { id: 'cA', baseSnapshotId: 'b1', epochMs: 1000, localDay: '2024-05-10', evaluation: { laterSnapshotId: 'l1' } });

  const b2 = snapshotOf([{ id: 2, column: 'Approved' }], { id: 'b2', epochMs: 3000, localDay: '2024-05-10' });
  const l2 = snapshotOf([{ id: 2, column: 'HO' }], { id: 'l2', epochMs: 4000, localDay: '2024-05-10' });
  const c2 = commitmentOf([{ id: 2, expectedColumn: 'HO' }], { id: 'cB', baseSnapshotId: 'b2', epochMs: 3000, localDay: '2024-05-10', evaluation: { laterSnapshotId: 'l2' } });

  const view = history.buildHistoryView({ snapshots: [b1, l1, b2, l2], commitments: [c1, c2] });
  assert.equal(view.records.length, 2);
  const ids = view.records.map(r => r.commitmentId).sort();
  assert.deepEqual(ids, ['cA', 'cB']);
  // One evolution bucket for the day, but it reports two dailies.
  assert.equal(view.summary.evolution.length, 1);
  assert.equal(view.summary.evolution[0].dailies, 2);
  assert.equal(view.summary.dailies, 2);
});

test('inferred evaluation does not steal a later daily snapshot within the same day', () => {
  // Two commitments on the same day; neither carries a persisted evaluation.
  // Daily A planned at 1000, Daily B planned at 3000. The snapshot at 2000 must
  // evaluate A (before B's planning), and the snapshot at 4000 must evaluate B.
  const b1 = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b1', epochMs: 1000, localDay: '2024-05-10' });
  const sA = snapshotOf([{ id: 1, column: 'HO' }], { id: 'sA', epochMs: 2000, localDay: '2024-05-10' });
  const b2 = snapshotOf([{ id: 2, column: 'Approved' }], { id: 'b2', epochMs: 3000, localDay: '2024-05-10' });
  const sB = snapshotOf([{ id: 2, column: 'HO' }], { id: 'sB', epochMs: 4000, localDay: '2024-05-10' });
  const cA = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { id: 'cA', baseSnapshotId: 'b1', epochMs: 1000, localDay: '2024-05-10' });
  const cB = commitmentOf([{ id: 2, expectedColumn: 'HO' }], { id: 'cB', baseSnapshotId: 'b2', epochMs: 3000, localDay: '2024-05-10' });

  const view = history.buildHistoryView({ snapshots: [b1, sA, b2, sB], commitments: [cA, cB] });
  const recA = view.records.find(r => r.commitmentId === 'cA');
  const recB = view.records.find(r => r.commitmentId === 'cB');
  // A's window ends at B's planning (3000), so A can only use sA (2000).
  assert.equal(recA.later.id, 'sA');
  assert.equal(recB.later.id, 'sB');
});

// --- 13. board isolation -----------------------------------------------------

test('board isolation: a foreign-scope snapshot never becomes a later snapshot', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b', epochMs: 1000, scope: SCOPE_A });
  const foreign = snapshotOf([{ id: 1, column: 'Closed' }], { id: 'f', epochMs: 2000, scope: SCOPE_B });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { baseSnapshotId: 'b', epochMs: 1000, scope: SCOPE_A });

  const view = history.buildHistoryView({ snapshots: [base, foreign], commitments: [cmt] });
  const rec = view.records[0];
  // No same-scope later snapshot -> missing, not evaluated against SCOPE_B.
  assert.equal(rec.later, null);
  assert.ok(rec.reliability.reasons.includes('NO_LATER_SNAPSHOT'));
});

// --- 14. date-range filter ---------------------------------------------------

test('date-range filter narrows both the list and the aggregate', () => {
  const recs = [
    { commitmentId: 'a', dailyDate: '2024-05-09', metrics: metrics(2, 2, true), reliability: ok() },
    { commitmentId: 'b', dailyDate: '2024-05-10', metrics: metrics(2, 1, true), reliability: ok() },
    { commitmentId: 'c', dailyDate: '2024-05-11', metrics: metrics(2, 0, true), reliability: ok() },
  ];
  const filtered = history.filterByDateRange(recs, { from: '2024-05-10', to: '2024-05-11' });
  assert.deepEqual(filtered.map(r => r.commitmentId), ['b', 'c']);

  const agg = history.aggregate(filtered);
  // (1 + 0) fulfilled / (2 + 2) committed = 25%.
  assert.equal(agg.committed, 4);
  assert.equal(agg.fulfilled, 1);
  assert.equal(agg.overallRate, 25);
});

test('a record without a dailyDate is excluded when a range bound is set', () => {
  const recs = [
    { commitmentId: 'a', dailyDate: null, metrics: metrics(2, 2, true), reliability: ok() },
    { commitmentId: 'b', dailyDate: '2024-05-10', metrics: metrics(2, 1, true), reliability: ok() },
  ];
  const filtered = history.filterByDateRange(recs, { from: '2024-05-01', to: null });
  assert.deepEqual(filtered.map(r => r.commitmentId), ['b']);
  // No range -> everything, including undated, returned (copy).
  const all = history.filterByDateRange(recs, null);
  assert.equal(all.length, 2);
  assert.notEqual(all, recs);
});

// --- 15. chronological ordering (newest first) -------------------------------

test('records are ordered newest-first by planning time', () => {
  const b1 = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b1', epochMs: 1000, localDay: '2024-05-10' });
  const b2 = snapshotOf([{ id: 2, column: 'Approved' }], { id: 'b2', epochMs: 5000, localDay: '2024-05-11' });
  const b3 = snapshotOf([{ id: 3, column: 'Approved' }], { id: 'b3', epochMs: 3000, localDay: '2024-05-10' });
  const c1 = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { id: 'c1', baseSnapshotId: 'b1', epochMs: 1000 });
  const c2 = commitmentOf([{ id: 2, expectedColumn: 'HO' }], { id: 'c2', baseSnapshotId: 'b2', epochMs: 5000 });
  const c3 = commitmentOf([{ id: 3, expectedColumn: 'HO' }], { id: 'c3', baseSnapshotId: 'b3', epochMs: 3000 });

  const recs = history.buildHistory({ snapshots: [b1, b2, b3], commitments: [c1, c2, c3] });
  assert.deepEqual(recs.map(r => r.commitmentId), ['c2', 'c3', 'c1']);
});

// --- 16. timezone / day boundary ---------------------------------------------

test('day boundary: localDay drives the record date independent of UTC instant', () => {
  // Captured just before local midnight but the UTC iso is the next day.
  const base = snapshotOf([{ id: 1, column: 'Approved' }], {
    id: 'b', epochMs: Date.parse('2024-05-11T02:30:00Z'), localDay: '2024-05-10',
  });
  const later = snapshotOf([{ id: 1, column: 'HO' }], {
    id: 'l', epochMs: Date.parse('2024-05-11T03:30:00Z'), localDay: '2024-05-10',
  });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }], {
    baseSnapshotId: 'b', epochMs: Date.parse('2024-05-11T02:30:00Z'), localDay: '2024-05-10',
  });

  const view = history.buildHistoryView({ snapshots: [base, later], commitments: [cmt] });
  assert.equal(view.records[0].dailyDate, '2024-05-10');
  assert.equal(view.summary.evolution[0].date, '2024-05-10');
});

// --- 17. referential integrity: a commitment whose base is gone is surfaced ---

test('missing base snapshot: the record is kept and flagged NO_BASE_SNAPSHOT, not dropped', () => {
  // Base snapshot was pruned by retention; the commitment remains.
  const later = snapshotOf([{ id: 1, column: 'HO' }], { id: 'l', epochMs: 2000 });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { baseSnapshotId: 'gone', epochMs: 1000 });

  const view = history.buildHistoryView({ snapshots: [later], commitments: [cmt] });
  assert.equal(view.records.length, 1);
  const rec = view.records[0];
  assert.equal(rec.initial, null);
  assert.ok(rec.reliability.reasons.includes('NO_BASE_SNAPSHOT'));
  // The planned total is still visible, from the commitment's own items.
  assert.equal(rec.metrics.committed, 1);
  assert.equal(view.summary.unreliableDailies, 1);
});

// --- 18. schema migration (v1 -> v2 additive evaluation) ---------------------

test('store schema is v2 and migrateRecord adds evaluation:null to a v1 commitment', () => {
  assert.equal(store.SCHEMA_VERSION, 2);
  const v1Commitment = {
    kind: 'commitment',
    schemaVersion: 1,
    id: 'cmt_old',
    scope: SCOPE_A,
    items: [{ id: 1, expectedColumn: 'HO' }],
    revision: 0,
    revisions: [],
    createdAt: { epochMs: 1, localDay: '2024-05-10' },
  };
  const migrated = store.migrateRecord(v1Commitment);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.evaluation, null);

  // A v1 snapshot just advances its version; it gains no evaluation field.
  const v1Snapshot = { kind: 'snapshot', schemaVersion: 1, id: 's', scope: SCOPE_A, items: [], capturedAt: { epochMs: 1 } };
  const migratedSnap = store.migrateRecord(v1Snapshot);
  assert.equal(migratedSnap.schemaVersion, 2);
  assert.equal('evaluation' in migratedSnap, false);
});

// --- 19. retention cannot silently break a referenced snapshot ----------------

test('retention integrity: referenced planning snapshots survive pruning', async () => {
  // A store that keeps only 1 ordinary snapshot per board. Once referenced by
  // a commitment, a planning baseline is protected from automatic retention.
  const { api } = freshStore({ retention: { maxSnapshotsPerBoard: 1 }, now: fixedClock(1000) });

  const base = await api.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(1000), complete: true, columns: columnsOf(),
    items: [{ id: 1, column: 'Approved' }],
  });
  await api.saveCommitment({
    scope: SCOPE_A, baseSnapshotId: base.id, createdAt: new Date(1000),
    items: [{ id: 1, startColumn: 'Approved', expectedColumn: 'HO' }],
  });
  // Second capture must NOT prune the referenced baseline (retention = 1).
  await api.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(5000), complete: true, columns: columnsOf(),
    items: [{ id: 1, column: 'HO' }],
  });

  const snapshots = await api.getSnapshots(SCOPE_A);
  const commitments = await api.getCommitments(SCOPE_A);
  assert.equal(snapshots.length, 2); // newest + referenced planning baseline
  assert.ok(snapshots.some(s => s.id === base.id));

  const view = history.buildHistoryView({ snapshots, commitments });
  assert.equal(view.records.length, 1);
  assert.ok(!view.records[0].reliability.reasons.includes('NO_BASE_SNAPSHOT'));
});

// --- 20. persistence after reload + recordCommitmentEvaluation ----------------

test('end to end through the store: evaluation persists and drives history after reload', async () => {
  const storage = createMockStorage();

  // First "session": capture, commit, evaluate.
  const t0 = Date.parse('2024-05-10T09:00:00Z');
  const t1 = Date.parse('2024-05-10T17:00:00Z');
  const api1 = store.createStore({ storage });

  const base = await api1.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(t0), complete: true, columns: columnsOf(),
    items: [{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }],
  });
  const commitment = await api1.saveCommitment({
    scope: SCOPE_A, baseSnapshotId: base.id, createdAt: new Date(t0),
    items: [
      { id: 1, startColumn: 'Approved', expectedColumn: 'Code Review' },
      { id: 2, startColumn: 'Approved', expectedColumn: 'Code Review' },
    ],
  });
  const later = await api1.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(t1), complete: true, columns: columnsOf(),
    items: [{ id: 1, column: 'Code Review' }, { id: 2, column: 'Code Review' }],
  });
  await api1.recordCommitmentEvaluation(SCOPE_A, commitment.id, {
    laterSnapshotId: later.id, revision: commitment.revision, evaluatedAt: new Date(t1),
  });

  // Second "session": a brand-new store over the SAME storage (reload).
  const api2 = store.createStore({ storage });
  const snapshots = await api2.getSnapshots(SCOPE_A);
  const commitments = await api2.getCommitments(SCOPE_A);

  // The persisted evaluation survived the reload and is migrated to v2.
  assert.equal(commitments[0].schemaVersion, 2);
  assert.equal(commitments[0].evaluation.laterSnapshotId, later.id);

  const view = history.buildHistoryView({ snapshots, commitments });
  assert.equal(view.records.length, 1);
  const rec = view.records[0];
  assert.equal(rec.usedPersistedEvaluation, true);
  assert.equal(rec.later.id, later.id);
  assert.equal(rec.metrics.reached, 2);
  assert.equal(rec.metrics.fulfillmentRate, 100);
  assert.equal(view.summary.overallRate, 100);
  assert.equal(rec.dailyDate, '2024-05-10'); // the record carries the daily date
});

test('recordCommitmentEvaluation refuses a call without a laterSnapshotId', async () => {
  const { api } = freshStore({ now: fixedClock(1000) });
  const base = await api.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(1000), complete: true, items: [{ id: 1, column: 'Approved' }],
  });
  const cmt = await api.saveCommitment({
    scope: SCOPE_A, baseSnapshotId: base.id, items: [{ id: 1, expectedColumn: 'HO' }],
  });
  await assert.rejects(
    () => api.recordCommitmentEvaluation(SCOPE_A, cmt.id, {}),
    err => err && err.code === 'INVALID_COMMITMENT'
  );
});

test('recording an evaluation never alters the commitment plan or revision', async () => {
  const { api } = freshStore({ now: fixedClock(1000) });
  const base = await api.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(1000), complete: true, items: [{ id: 1, column: 'Approved' }],
  });
  const cmt = await api.saveCommitment({
    scope: SCOPE_A, baseSnapshotId: base.id,
    items: [{ id: 1, startColumn: 'Approved', expectedColumn: 'HO' }],
  });
  const later = await api.createSnapshot({
    scope: SCOPE_A, capturedAt: new Date(5000), complete: true, items: [{ id: 1, column: 'HO' }],
  });
  const updated = await api.recordCommitmentEvaluation(SCOPE_A, cmt.id, { laterSnapshotId: later.id });
  assert.deepEqual(updated.items, cmt.items); // plan untouched
  assert.equal(updated.revision, cmt.revision); // revision untouched
  assert.equal(updated.evaluation.laterSnapshotId, later.id);
});

// --- 21. reuse of the comparison view-model (no second engine) ----------------

test('the history delegates classification to the injected comparison view-model', () => {
  let buildCalls = 0;
  const spy = {
    selectComparableSnapshots: comparison.selectComparableSnapshots,
    buildComparison(input, options) {
      buildCalls += 1;
      return comparison.buildComparison(input, options);
    },
  };
  const base = snapshotOf([{ id: 1, column: 'Approved' }], { id: 'b', epochMs: 1000 });
  const later = snapshotOf([{ id: 1, column: 'HO' }], { id: 'l', epochMs: 2000 });
  const cmt = commitmentOf([{ id: 1, expectedColumn: 'HO' }], { baseSnapshotId: 'b', epochMs: 1000 });

  const recs = history.buildHistory({ snapshots: [base, later], commitments: [cmt] }, { comparison: spy });
  assert.equal(buildCalls, 1);
  assert.equal(recs[0].metrics.reached, 1);
});

// --- 22. module hygiene: no WIP / DOM / Chrome / innerHTML --------------------

test('the daily-history module source references no WIP number, DOM, Chrome or storage', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'features', 'daily', 'daily-history.js'), 'utf8');
  assert.equal(/\bdocument\b/.test(src), false, 'must not touch the DOM');
  assert.equal(/\bMutationObserver\b/.test(src), false, 'must not use MutationObserver');
  assert.equal(/chrome\.(storage|runtime)/.test(src), false, 'must not call chrome APIs');
  assert.equal(/\binnerHTML\b/.test(src), false, 'must not write innerHTML');
  assert.equal(/\bwipColumns\b|computeWipLimit|finalWip/.test(src), false, 'must not read/write a WIP number');
});

// --- helpers -----------------------------------------------------------------

function metrics(committed, fulfilled, rateReliable) {
  return {
    committed: committed,
    reached: fulfilled,
    beyond: 0,
    behind: committed - fulfilled,
    offTrack: 0,
    missing: 0,
    fulfilled: fulfilled,
    undetermined: 0,
    fulfillmentRate: rateReliable && committed > 0 ? Math.round((fulfilled / committed) * 1000) / 10 : null,
    rateReliable: !!rateReliable,
  };
}

function ok() {
  return { reliable: true, reasons: [] };
}
