// test/snapshot-capture.test.js
// Tests for Daily Snapshot Capture (docs/PRODUCT_ROADMAP.md T1.2).
//
// This covers the T1.2-mandatory scenarios end to end by driving the real
// pipeline the runtime uses:
//   WIPBoardReader.readBoard(fixture) -> WIPBoardSnapshotCapture.buildCapture
//   -> WIPBoardSnapshotStore.createSnapshot (chrome.storage.local mocked).
//
// Required scenarios (task list):
//   1. full-board capture
//   2. persistence and retrieval
//   3. separation between different boards
//   4. captures taken at different times
//   5. absence of mandatory data
//   6. hidden cards / incomplete load
//   7. storage failures
//   8. page reload (data survives a new store instance over the same storage)
//   9. compatibility with the existing runtime model
//  10. no additional MutationObserver cycles (capture is explicit, read-only)
//
// Zero dependencies: Node's built-in runner + the mini-dom shim + the chrome
// storage mock. All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const reader = require('../src/data/board-dom-reader.js');
const capture = require('../src/data/snapshot-capture.js');
const store = require('../src/data/snapshot-store.js');
const { parseHTML } = require('./helpers/mini-dom.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

function loadFixture(name) {
  return parseHTML(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

// Mirrors the browser isCardVisible rule used across the suite.
function isVisible(card) {
  return !card.closest('[aria-hidden="true"], .is-hidden, .hidden');
}

const readerOptions = { isVisible: isVisible };

const SCOPE_A = { organization: 'contoso-org', project: 'Sample.Project', team: 'Alpha', board: 'Stories' };
const SCOPE_B = { organization: 'contoso-org', project: 'Sample.Project', team: 'Beta', board: 'Stories' };

function readModel(fixture) {
  return reader.readBoard(loadFixture(fixture), readerOptions);
}

function freshStore(extra) {
  const storage = createMockStorage((extra && extra.storageOptions) || undefined);
  const cfg = Object.assign({ storage: storage }, extra && extra.cfg ? extra.cfg : {});
  return { api: store.createStore(cfg), storage: storage };
}

// --- 1. full-board capture ---------------------------------------------------

test('captures all relevant columns, not only WIP-configured ones', () => {
  const model = readModel('board-full.html');
  const result = capture.buildCapture(model, SCOPE_A);

  // The full delivery flow is captured: Approved, Desenvolvimento, Code Review,
  // HO, Closed — regardless of any WIP configuration (not applied here).
  assert.deepEqual(
    result.columns.map((c) => c.name),
    ['Approved', 'Desenvolvimento', 'Code Review', 'HO', 'Closed']
  );
});

test('identifies Closed (terminal) via the board done flag, not a hardcoded name', () => {
  const model = readModel('board-full.html');
  const result = capture.buildCapture(model, SCOPE_A);

  const closed = result.columns.find((c) => c.name === 'Closed');
  assert.equal(closed.isDoneColumn, true);
  assert.equal(closed.role, 'closed');

  // Non-terminal columns are not misclassified as closed.
  const dev = result.columns.find((c) => c.name === 'Desenvolvimento');
  assert.equal(dev.isDoneColumn, false);
  assert.equal(dev.role, 'flow');
});

test('identifies Approved start-of-flow role via configurable keywords (no default)', () => {
  const model = readModel('board-full.html');

  // Without keywords: no column is tagged "approved" (no hardcoded English).
  const defaultResult = capture.buildCapture(model, SCOPE_A);
  assert.equal(defaultResult.columns.some((c) => c.role === 'approved'), false);

  // With an opt-in keyword the start-of-flow column is recognized.
  const tagged = capture.buildCapture(model, SCOPE_A, { approvedColumnKeywords: ['approved'] });
  const approved = tagged.columns.find((c) => c.name === 'Approved');
  assert.equal(approved.role, 'approved');
});

test('full-board capture records per-column counts for all columns', () => {
  const model = readModel('board-full.html');
  const result = capture.buildCapture(model, SCOPE_A);

  const counts = {};
  result.columns.forEach((c) => (counts[c.name] = c.count));
  // Visible items only: 1004 is filtered/hidden so Desenvolvimento holds 1.
  assert.deepEqual(counts, {
    Approved: 2,
    Desenvolvimento: 1,
    'Code Review': 1,
    HO: 1,
    Closed: 1,
  });
  assert.equal(result.counts.items, 6); // 7 ids minus the hidden one
});

test('preserves stable ids and available metadata, drops UNAVAILABLE', () => {
  const model = readModel('board-full.html');
  const result = capture.buildCapture(model, SCOPE_A);

  const byId = new Map(result.items.map((i) => [i.id, i]));
  const item = byId.get(1001);
  assert.equal(item.column, 'Approved');
  assert.equal(item.columnId, 'col-approved-0001');
  assert.equal(item.state, 'Approved');
  assert.equal(item.type, 'Issue');
  // Hidden id never enters the observed item set.
  assert.equal(byId.has(1004), false);
});

// --- 2. persistence and retrieval --------------------------------------------

test('persists a capture and retrieves it with columns + counts', async () => {
  const { api } = freshStore();
  const model = readModel('board-full.html');
  const result = capture.buildCapture(model, SCOPE_A, { approvedColumnKeywords: ['approved'] });

  const created = await api.createSnapshot(result.storeInput);
  const latest = await api.getLatestSnapshot(SCOPE_A);

  assert.equal(latest.id, created.id);
  assert.equal(latest.itemCount, 6);
  assert.equal(latest.columns.length, 5);
  const closed = latest.columns.find((c) => c.name === 'Closed');
  assert.equal(closed.isDoneColumn, true);
  assert.equal(closed.count, 1);
  // Work-item count per column is queryable from the stored record.
  const dev = latest.columns.find((c) => c.name === 'Desenvolvimento');
  assert.equal(dev.count, 1);
});

test('stored capture lets you recover the recorded state (columns of each id)', async () => {
  const { api } = freshStore();
  const result = capture.buildCapture(readModel('board-full.html'), SCOPE_A);
  await api.createSnapshot(result.storeInput);

  const latest = await api.getLatestSnapshot(SCOPE_A);
  const columnById = new Map(latest.items.map((i) => [i.id, i.column]));
  assert.equal(columnById.get(1001), 'Approved');
  assert.equal(columnById.get(1003), 'Desenvolvimento');
  assert.equal(columnById.get(1007), 'Closed');
});

// --- 3. separation between different boards ----------------------------------

test('captures for different teams/boards do not mix', async () => {
  const { api } = freshStore();
  const model = readModel('board-full.html');

  await api.createSnapshot(capture.buildCapture(model, SCOPE_A).storeInput);
  await api.createSnapshot(capture.buildCapture(model, SCOPE_B).storeInput);

  const a = await api.getSnapshots(SCOPE_A);
  const b = await api.getSnapshots(SCOPE_B);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].scope.team, 'Alpha');
  assert.equal(b[0].scope.team, 'Beta');
  assert.notEqual(a[0].id, b[0].id);
});

// --- 4. captures taken at different times ------------------------------------

test('two captures at different times are both kept, newest first', async () => {
  const { api } = freshStore();
  const model = readModel('board-full.html');

  const morning = new Date(2024, 2, 15, 9, 0, 0);
  const afternoon = new Date(2024, 2, 15, 15, 30, 0);

  await api.createSnapshot(capture.buildCapture(model, SCOPE_A, { capturedAt: morning }).storeInput);
  await api.createSnapshot(capture.buildCapture(model, SCOPE_A, { capturedAt: afternoon }).storeInput);

  const all = await api.getSnapshots(SCOPE_A);
  assert.equal(all.length, 2);
  assert.ok(all[0].capturedAt.epochMs > all[1].capturedAt.epochMs);
  assert.equal(all[0].capturedAt.iso, afternoon.toISOString());
  // Both carry a readable local day + time source.
  assert.match(all[0].capturedAt.localDay, /^\d{4}-\d{2}-\d{2}$/);
});

// --- 5. absence of mandatory data --------------------------------------------

test('capture without a valid scope is rejected by the store (not saved silently)', async () => {
  const { api } = freshStore();
  const result = capture.buildCapture(readModel('board-full.html'), { organization: 'o', project: 'p' });
  await assert.rejects(
    () => api.createSnapshot(result.storeInput),
    (err) => err.code === store.ErrorCodes.INVALID_SCOPE
  );
});

test('an empty board is flagged incomplete and never marked complete', () => {
  const model = readModel('board-empty.html');
  const result = capture.buildCapture(model, SCOPE_A);
  assert.equal(result.complete, false);
  assert.ok(result.incompleteReasons.includes(capture.IncompleteReasons.EMPTY_BOARD));
  // storeInput carries the honest verdict.
  assert.equal(result.storeInput.complete, false);
});

// --- 6. hidden cards / incomplete load ---------------------------------------

test('hidden/filtered cards mark the capture incomplete, are not counted present', () => {
  const model = readModel('board-full.html');
  const result = capture.buildCapture(model, SCOPE_A);

  // 1004 is hidden in the fixture.
  assert.equal(result.counts.hidden, 1);
  assert.equal(result.complete, false);
  assert.ok(result.incompleteReasons.includes(capture.IncompleteReasons.HIDDEN_ITEMS));
  // The hidden card is NOT recorded as if present (never a definitive absence
  // either — it simply is not part of the observed present set).
  assert.equal(result.items.some((i) => i.id === 1004), false);
});

test('an incomplete capture persists with complete=false (not silently complete)', async () => {
  const { api } = freshStore();
  const result = capture.buildCapture(readModel('board-full.html'), SCOPE_A);
  const created = await api.createSnapshot(result.storeInput);
  assert.equal(created.source.complete, false);

  const latest = await api.getLatestSnapshot(SCOPE_A);
  assert.equal(latest.source.complete, false);
});

test('a complete capture (all visible, no duplicates) reports complete=true', () => {
  // board-variations has no hidden/aria-hidden wrappers in its visible columns;
  // build a minimal synthetic model to prove the positive path deterministically.
  const model = {
    columns: [
      { id: 'c0', name: 'To Do', order: 0, isDoneColumn: false },
      { id: 'c1', name: 'Done', order: 1, isDoneColumn: true },
    ],
    items: [
      { id: 1, column: 'To Do', columnId: 'c0', state: 'New', isVisible: true },
      { id: 2, column: 'Done', columnId: 'c1', state: 'Closed', isVisible: true },
    ],
  };
  const result = capture.buildCapture(model, SCOPE_A);
  assert.equal(result.complete, true);
  assert.deepEqual(result.incompleteReasons, []);
  assert.equal(result.storeInput.complete, true);
});

test('duplicate visible ids are collapsed and flagged, counted once', () => {
  const model = {
    columns: [{ id: 'c0', name: 'Doing', order: 0, isDoneColumn: false }],
    items: [
      { id: 7, column: 'Doing', columnId: 'c0', isVisible: true },
      { id: 7, column: 'Doing', columnId: 'c0', isVisible: true }, // swimlane repeat
    ],
  };
  const result = capture.buildCapture(model, SCOPE_A);
  assert.equal(result.items.length, 1);
  assert.equal(result.counts.duplicates, 1);
  assert.ok(result.incompleteReasons.includes(capture.IncompleteReasons.DUPLICATE_IDS));
});

// --- 7. storage failures -----------------------------------------------------

test('a storage set failure surfaces as STORAGE_FAILURE (capture not lost silently)', async () => {
  const { api } = freshStore({ storageOptions: { failOn: ['set'] } });
  const result = capture.buildCapture(readModel('board-full.html'), SCOPE_A);
  await assert.rejects(
    () => api.createSnapshot(result.storeInput),
    (err) => err.code === store.ErrorCodes.STORAGE_FAILURE
  );
});

test('a storage get failure surfaces as STORAGE_FAILURE on retrieval', async () => {
  const { api } = freshStore({ storageOptions: { failOn: ['get'] } });
  await assert.rejects(
    () => api.getLatestSnapshot(SCOPE_A),
    (err) => err.code === store.ErrorCodes.STORAGE_FAILURE
  );
});

// --- 8. page reload (persistence across store instances) ---------------------

test('a capture survives a reload: a new store over the same storage still reads it', async () => {
  const storage = createMockStorage();
  const before = store.createStore({ storage: storage });
  const result = capture.buildCapture(readModel('board-full.html'), SCOPE_A);
  const created = await before.createSnapshot(result.storeInput);

  // Simulate reload: a brand new store instance bound to the same backing data.
  const after = store.createStore({ storage: storage });
  const latest = await after.getLatestSnapshot(SCOPE_A);
  assert.equal(latest.id, created.id);
  assert.equal(latest.itemCount, 6);
});

// --- 9. compatibility with the existing runtime model ------------------------

test('buildCapture consumes the unmodified WIPBoardReader model shape', () => {
  const model = readModel('board-full.html');
  // The reader output is exactly what the live runtime reads; capture must not
  // require any extra fields beyond columns/items as produced today.
  assert.ok(Array.isArray(model.columns));
  assert.ok(Array.isArray(model.items));
  const result = capture.buildCapture(model, SCOPE_A);
  // Item shape persisted matches the store's whitelist (id/column/columnId/...),
  // the same fields diffStates compares — so captures feed comparison directly.
  const sample = result.items[0];
  assert.deepEqual(Object.keys(sample).sort(), ['assignee', 'column', 'columnId', 'id', 'state', 'type'].sort());
});

test('buildCapture is read-only: it never mutates the input model', () => {
  const model = readModel('board-full.html');
  const columnsSnapshot = JSON.stringify(model.columns.map((c) => ({ id: c.id, name: c.name })));
  const itemIds = model.items.map((i) => i.id).join(',');
  capture.buildCapture(model, SCOPE_A, { approvedColumnKeywords: ['approved'] });
  assert.equal(JSON.stringify(model.columns.map((c) => ({ id: c.id, name: c.name }))), columnsSnapshot);
  assert.equal(model.items.map((i) => i.id).join(','), itemIds);
});

// --- 10. no additional MutationObserver cycles -------------------------------

test('capture does not read or write the DOM (explicit, observer-free by design)', () => {
  // buildCapture only touches the already-read model + the store. It references
  // no `document`, no observer, and performs no DOM writes, so it cannot seed a
  // MutationObserver recompute cycle. We assert the contract structurally: the
  // module source contains no DOM/observer access.
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'snapshot-capture.js'), 'utf8');
  assert.equal(/\bdocument\b/.test(src), false);
  assert.equal(/MutationObserver/.test(src), false);
  assert.equal(/\.innerHTML\b/.test(src), false);
});
