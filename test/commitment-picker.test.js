// test/commitment-picker.test.js
// Tests for the Daily Commitment Card Picker (docs/PRODUCT_ROADMAP.md T1.4).
//
// The picker is the PURE view-model behind the visual work-item selection UI that
// replaces the manual "id: column" textarea. It merges the base snapshot
// (authoritative committable ids + startColumn), the live board model (title,
// current column, assignee for display) and an existing commitment (pre-selection
// for consult/edit), then converts the user's selection back into the exact
// expectations map the T1.3 engine consumes.
//
// Covers, 1:1 with the task list:
//   - show available work items from the base snapshot
//   - multiple selection -> expectations map
//   - show id, title, current column and assignee when available
//   - choose an explicit destination column per card
//   - load the board's REAL columns dynamically for the dropdown
//   - search cards by id or title
//   - selection summary
//   - consult + edit an existing plan (pre-selection / pre-fill)
//   - reuse of the T1.3 engine (no reimplementation): expectations feed
//     buildCommitmentItems unchanged; persistence/revisions via the real store
//   - different boards / different days do not mix
//   - missing / incomplete snapshot handled without assuming done
//   - no duplicate work item in one commitment
//
// Pure module: driven here with plain objects plus the real snapshot pipeline.
// Zero dependencies: Node's built-in runner + the chrome storage mock.
//
// All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');

const picker = require('../src/data/commitment-picker.js');
const commitment = require('../src/data/daily-commitment.js');
const store = require('../src/data/snapshot-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const SCOPE_A = { organization: 'contoso-org', project: 'Sample.Project', team: 'Alpha', board: 'Stories' };
const SCOPE_B = { organization: 'contoso-org', project: 'Sample.Project', team: 'Beta', board: 'Stories' };

const FLOW = ['Approved', 'Desenvolvimento', 'Code Review', 'HO', 'Closed'];

function columnsOf(names) {
  return (names || FLOW).map((name, order) => ({
    id: 'col-' + order,
    name: name,
    order: order,
    isDoneColumn: name === 'Closed',
  }));
}

function snapshotOf(items, names) {
  return { items: items, columns: columnsOf(names) };
}

function liveOf(items, names) {
  return { items: items, columns: columnsOf(names) };
}

function freshStore() {
  const storage = createMockStorage();
  return { api: store.createStore({ storage: storage }), storage: storage };
}

// --- destination column options (dynamic, real board columns) ----------------

test('buildColumnOptions reflects the live board columns in flow order', () => {
  const live = liveOf([], ['Approved', 'Code Review', 'Closed']);
  const options = picker.buildColumnOptions(live, null);
  assert.deepEqual(options.map((o) => o.name), ['Approved', 'Code Review', 'Closed']);
  assert.equal(options[2].isDoneColumn, true);
});

test('buildColumnOptions de-duplicates by name and sorts by order', () => {
  const live = {
    columns: [
      { name: 'Closed', order: 4 },
      { name: 'Approved', order: 0 },
      { name: 'approved', order: 9 }, // duplicate by normalized name -> dropped
    ],
  };
  const options = picker.buildColumnOptions(live, null);
  assert.deepEqual(options.map((o) => o.name), ['Approved', 'Closed']);
});

test('buildColumnOptions falls back to the base snapshot columns when live has none', () => {
  const base = snapshotOf([], ['Approved', 'HO', 'Closed']);
  const options = picker.buildColumnOptions({ columns: [] }, base);
  assert.deepEqual(options.map((o) => o.name), ['Approved', 'HO', 'Closed']);
});

// --- picker rows: available items from the base snapshot ---------------------

test('buildPickerRows offers one row per base-snapshot item with display fields', () => {
  const base = snapshotOf([
    { id: 1001, column: 'Approved', assignee: 'Ana' },
    { id: 1002, column: 'Desenvolvimento' },
  ]);
  const live = liveOf([
    { id: 1001, column: 'Desenvolvimento', title: 'Login page', assignee: 'Ana' },
    { id: 1002, column: 'Code Review', title: 'Logout', assignee: 'Bruno' },
  ]);

  const rows = picker.buildPickerRows(base, live, null);
  const byId = new Map(rows.map((r) => [r.id, r]));

  assert.equal(rows.length, 2);
  // startColumn is the planning-time column (base snapshot), not the live one.
  assert.equal(byId.get(1001).startColumn, 'Approved');
  assert.equal(byId.get(1001).currentColumn, 'Desenvolvimento');
  assert.equal(byId.get(1001).title, 'Login page');
  assert.equal(byId.get(1001).assignee, 'Ana');
  assert.equal(byId.get(1001).onBoard, true);
  // assignee falls back to the live board when the base snapshot lacks it.
  assert.equal(byId.get(1002).assignee, 'Bruno');
});

test('rows are sorted along the board flow (current column order, then id)', () => {
  const base = snapshotOf([
    { id: 3, column: 'Closed' },
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const live = liveOf([
    { id: 3, column: 'Closed' },
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const rows = picker.buildPickerRows(base, live, null);
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3]);
});

// --- missing / incomplete snapshot: never assume done ------------------------

test('an item in the base snapshot but gone from the live board is still offered, flagged off-board', () => {
  const base = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Desenvolvimento' },
  ]);
  const live = liveOf([{ id: 1, column: 'Code Review', title: 'Still here' }]);

  const rows = picker.buildPickerRows(base, live, null);
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.equal(byId.has(2), true);
  assert.equal(byId.get(2).onBoard, false);
  assert.equal(byId.get(2).currentColumn, null); // not inferred as delivered
});

test('live board items not present on the base snapshot are never injected', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }]);
  const live = liveOf([
    { id: 1, column: 'Approved', title: 'A' },
    { id: 999, column: 'Closed', title: 'Appeared later' },
  ]);
  const rows = picker.buildPickerRows(base, live, null);
  assert.deepEqual(rows.map((r) => r.id), [1]);
});

test('duplicate ids in the base snapshot collapse to a single row', () => {
  const base = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 1, column: 'Approved' }, // swimlane repeat
  ]);
  const rows = picker.buildPickerRows(base, liveOf([]), null);
  assert.equal(rows.length, 1);
});

// --- search by id or title ---------------------------------------------------

test('filterRows matches by id substring', () => {
  const base = snapshotOf([
    { id: 620906, column: 'Approved' },
    { id: 111222, column: 'Approved' },
  ]);
  const rows = picker.buildPickerRows(base, liveOf([]), null);
  const filtered = picker.filterRows(rows, '6209');
  assert.deepEqual(filtered.map((r) => r.id), [620906]);
});

test('filterRows matches by title, accent- and case-insensitive', () => {
  const base = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const live = liveOf([
    { id: 1, column: 'Approved', title: 'Página de Relatório' },
    { id: 2, column: 'Approved', title: 'Dashboard' },
  ]);
  const rows = picker.buildPickerRows(base, live, null);
  const filtered = picker.filterRows(rows, 'relatorio');
  assert.deepEqual(filtered.map((r) => r.id), [1]);
});

test('an empty query returns a copy of all rows (input not mutated)', () => {
  const base = snapshotOf([{ id: 1, column: 'Approved' }]);
  const rows = picker.buildPickerRows(base, liveOf([]), null);
  const filtered = picker.filterRows(rows, '   ');
  assert.equal(filtered.length, 1);
  assert.notEqual(filtered, rows);
});

// --- consult + edit an existing plan (pre-selection / pre-fill) --------------

test('an existing commitment pre-selects rows and pre-fills the destination', () => {
  const base = snapshotOf([
    { id: 1, column: 'Approved' },
    { id: 2, column: 'Approved' },
  ]);
  const existing = { items: [{ id: 1, expectedColumn: 'Code Review' }] };
  const rows = picker.buildPickerRows(base, liveOf([]), existing);
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.equal(byId.get(1).selected, true);
  assert.equal(byId.get(1).expectedColumn, 'Code Review');
  assert.equal(byId.get(2).selected, false);
  assert.equal(byId.get(2).expectedColumn, null);
});

// --- selection summary -------------------------------------------------------

test('summarizeSelection counts selected, with/without destination and off-board', () => {
  const rows = [
    { id: 1, selected: true, expectedColumn: 'HO', onBoard: true },
    { id: 2, selected: true, expectedColumn: '', onBoard: true }, // no destination
    { id: 3, selected: true, expectedColumn: 'Closed', onBoard: false }, // off board
    { id: 4, selected: false, expectedColumn: null, onBoard: true },
  ];
  const s = picker.summarizeSelection(rows);
  assert.equal(s.total, 4);
  assert.equal(s.selected, 3);
  assert.equal(s.withDestination, 2);
  assert.equal(s.missingDestination, 1);
  assert.equal(s.offBoard, 1);
});

// --- build expectations from the selection -----------------------------------

test('buildExpectationsFromSelection converts an array selection into the engine map', () => {
  const result = picker.buildExpectationsFromSelection([
    { id: 1, expectedColumn: 'Code Review' },
    { id: 2, expectedColumn: 'Closed' },
  ]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.expectations, { 1: 'Code Review', 2: 'Closed' });
  assert.deepEqual(result.invalid, []);
});

test('a selection without a destination is invalid, never silently committed', () => {
  const result = picker.buildExpectationsFromSelection([
    { id: 1, expectedColumn: 'Code Review' },
    { id: 2, expectedColumn: '' },
    { id: 3, expectedColumn: null },
  ]);
  assert.equal(result.count, 1);
  assert.deepEqual(result.expectations, { 1: 'Code Review' });
  assert.equal(result.invalid.length, 2);
  assert.ok(result.invalid.every((i) => i.reason === 'no-destination'));
});

test('a duplicate id in the selection is collapsed and reported', () => {
  const result = picker.buildExpectationsFromSelection([
    { id: 1, expectedColumn: 'Code Review' },
    { id: 1, expectedColumn: 'Closed' }, // duplicate
  ]);
  assert.equal(result.count, 1);
  assert.deepEqual(result.expectations, { 1: 'Code Review' });
  assert.deepEqual(result.invalid, [{ id: 1, reason: 'duplicate' }]);
});

// --- integration with the T1.3 engine (no reimplementation) ------------------

test('picker output feeds buildCommitmentItems unchanged (multiple selection)', () => {
  const base = snapshotOf([
    { id: 1001, column: 'Approved', assignee: 'Ana' },
    { id: 1002, column: 'Desenvolvimento' },
    { id: 1003, column: 'Approved' },
  ]);

  // The user ticks 1001 and 1002 and chooses destinations.
  const { expectations, count } = picker.buildExpectationsFromSelection([
    { id: 1001, expectedColumn: 'Desenvolvimento' },
    { id: 1002, expectedColumn: 'Code Review' },
  ]);
  assert.equal(count, 2);

  const built = commitment.buildCommitmentItems(base, expectations);
  const byId = new Map(built.items.map((i) => [i.id, i]));
  assert.equal(built.items.length, 2);
  assert.equal(byId.get(1001).startColumn, 'Approved');
  assert.equal(byId.get(1001).expectedColumn, 'Desenvolvimento');
  assert.equal(byId.get(1002).expectedColumn, 'Code Review');
  // 1003 was not selected -> not committed.
  assert.equal(byId.has(1003), false);
});

// --- end-to-end through the real store: persist, consult, edit, compare ------

test('end to end: pick -> save -> consult (pre-filled) -> edit (revision) -> compare', async () => {
  const { api } = freshStore();

  const baseState = snapshotOf([
    { id: 10, column: 'Approved' },
    { id: 11, column: 'Desenvolvimento' },
  ]);
  const baseSnap = await api.createSnapshot({
    scope: SCOPE_A,
    items: baseState.items,
    columns: baseState.columns,
    complete: true,
  });

  const live = liveOf([
    { id: 10, column: 'Approved', title: 'Feature A' },
    { id: 11, column: 'Desenvolvimento', title: 'Feature B' },
  ]);

  // First plan: pick both.
  const first = picker.buildExpectationsFromSelection([
    { id: 10, expectedColumn: 'Code Review' },
    { id: 11, expectedColumn: 'Closed' },
  ]);
  const built1 = commitment.buildCommitmentItems(baseSnap, first.expectations);
  const saved = await api.saveCommitment({ scope: SCOPE_A, items: built1.items, baseSnapshotId: baseSnap.id });
  assert.equal(saved.revision, 0);

  // Consult: the picker pre-selects and pre-fills from the saved commitment.
  const consult = (await api.getCommitments(SCOPE_A))[0];
  const rows = picker.buildPickerRows(baseSnap, live, consult);
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.equal(byId.get(10).selected, true);
  assert.equal(byId.get(10).expectedColumn, 'Code Review');
  assert.equal(byId.get(10).title, 'Feature A');

  // Edit: change 10's destination; save becomes a revision (history preserved).
  const second = picker.buildExpectationsFromSelection([
    { id: 10, expectedColumn: 'HO' },
    { id: 11, expectedColumn: 'Closed' },
  ]);
  const built2 = commitment.buildCommitmentItems(baseSnap, second.expectations);
  const revised = await api.reviseCommitment(SCOPE_A, saved.id, built2.items);
  assert.equal(revised.revision, 1);
  assert.equal(revised.revisions.length, 1);
  // Original plan preserved in history.
  const archived = new Map(revised.revisions[0].items.map((i) => [i.id, i]));
  assert.equal(archived.get(10).expectedColumn, 'Code Review');

  // Compare against a later realized board.
  const realized = liveOf([
    { id: 10, column: 'HO' }, // reached the revised destination
    { id: 11, column: 'Code Review' }, // behind Closed
  ]);
  const comparison = commitment.compareCommitment(revised, { items: realized.items, columns: realized.columns });
  const cmpById = new Map(comparison.results.map((r) => [r.id, r]));
  assert.equal(cmpById.get(10).status, commitment.Status.REACHED);
  assert.equal(cmpById.get(11).status, commitment.Status.BEHIND);
});

// --- isolation: different boards / different days ----------------------------

test('a commitment picked on board A does not pre-select rows on board B', async () => {
  const { api } = freshStore();
  const baseState = snapshotOf([{ id: 1, column: 'Approved' }]);
  const snapA = await api.createSnapshot({ scope: SCOPE_A, items: baseState.items, columns: baseState.columns, complete: true });

  const built = commitment.buildCommitmentItems(snapA, { 1: 'HO' });
  await api.saveCommitment({ scope: SCOPE_A, items: built.items });

  // Board B has the same base items but no commitment of its own.
  const commitmentsB = await api.getCommitments(SCOPE_B);
  assert.equal(commitmentsB.length, 0);
  const rowsB = picker.buildPickerRows(snapA, liveOf([{ id: 1, column: 'Approved' }]), commitmentsB[0] || null);
  assert.equal(rowsB[0].selected, false);
});

// --- module hygiene: pure, Chrome-free, DOM-free -----------------------------

test('commitment-picker module is DOM-free and Chrome-free by design', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'commitment-picker.js'), 'utf8');
  assert.equal(/\bdocument\b/.test(src), false);
  assert.equal(/MutationObserver/.test(src), false);
  assert.equal(/\bchrome\./.test(src), false);
  assert.equal(/\.innerHTML\b/.test(src), false);
});
