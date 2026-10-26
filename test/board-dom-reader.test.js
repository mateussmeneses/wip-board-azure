// test/board-dom-reader.test.js
// Fixture-based tests for the Board DOM Reader (docs/PRODUCT_ROADMAP.md T0.4).
//
// All fixtures are sanitized (no real Azure DevOps data). Parsing uses a tiny
// zero-dependency DOM shim (test/helpers/mini-dom.js) so the extension itself
// keeps no dependencies. Uses Node's built-in test runner.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const reader = require('../src/data/board-dom-reader.js');
const { parseHTML } = require('./helpers/mini-dom.js');

function loadFixture(name) {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return parseHTML(html);
}

// A deterministic visibility predicate for tests: a card is hidden when it (or
// an ancestor) carries aria-hidden="true" / .is-hidden / .hidden. This mirrors
// the browser isCardVisible() rule without needing a layout engine.
function testIsVisible(card) {
  return !card.closest('[aria-hidden="true"], .is-hidden, .hidden');
}

const options = { isVisible: testIsVisible };

// --- Columns -----------------------------------------------------------------

test('reads columns preserving names and order, including Approved/HO/Closed', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  assert.deepEqual(
    model.columns.map((c) => c.name),
    ['Approved', 'Desenvolvimento', 'Code Review', 'HO', 'Closed']
  );
  // Order is the array index and is explicit on the model.
  assert.deepEqual(
    model.columns.map((c) => c.order),
    [0, 1, 2, 3, 4]
  );
});

test('columns expose a stable id and the done flag', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  assert.equal(model.columns[0].id, 'col-approved-0001');
  assert.equal(model.columns[0].isDoneColumn, false);
  // Closed is a terminal/done column in the delivery flow.
  const closed = model.columns.find((c) => c.name === 'Closed');
  assert.equal(closed.isDoneColumn, true);
});

test('reported header count is parsed when present', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);
  assert.equal(model.columns[0].reportedCount, 2);
});

// --- Full board / ids --------------------------------------------------------

test('extracts stable integer ids for every card', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  const ids = model.items.map((i) => i.id);
  assert.deepEqual(ids, [1001, 1002, 1003, 1004, 1005, 1006, 1007]);
  ids.forEach((id) => assert.equal(Number.isInteger(id), true));
});

test('maps each item to its current column by name and stable column id', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  const byId = new Map(model.items.map((i) => [i.id, i]));
  assert.equal(byId.get(1001).column, 'Approved');
  assert.equal(byId.get(1001).columnId, 'col-approved-0001');
  assert.equal(byId.get(1006).column, 'HO');
  assert.equal(byId.get(1007).column, 'Closed');
});

test('extracts title, state, type and scope for a known id', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);
  const item = model.items.find((i) => i.id === 1001);

  assert.equal(item.title, 'Fix sample item one');
  assert.equal(item.state, 'Approved');
  assert.equal(item.type, 'Issue'); // from bowtie-symbol-defect icon
  assert.equal(item.organization, 'contoso-org');
  assert.equal(item.project, 'Sample.Project');
});

test('type comes from the icon, not the possibly-prefixed aria-label', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);
  const feature = model.items.find((i) => i.id === 1002);
  assert.equal(feature.type, 'Feature'); // bowtie-symbol-trophy
});

// --- Assignee discipline -----------------------------------------------------

test('"Unassigned" becomes null (present but empty), real names kept', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  assert.equal(model.items.find((i) => i.id === 1002).assignee, null);
  assert.equal(model.items.find((i) => i.id === 1001).assignee, 'Dev One');
});

// --- Optional fields: unavailable vs empty -----------------------------------

test('absent optional field is UNAVAILABLE, present-but-empty is null/empty', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  // 1006 (HO) has no field containers at all -> aging/targetDate UNAVAILABLE.
  const ho = model.items.find((i) => i.id === 1006);
  assert.equal(reader.isUnavailable(ho.aging), true);
  assert.equal(reader.isUnavailable(ho.targetDate), true);
  assert.equal(reader.isUnavailable(ho.tags), true);

  // 1003 renders an empty Target Date field -> present but empty (null), not UNAVAILABLE.
  const dev = model.items.find((i) => i.id === 1003);
  assert.equal(reader.isUnavailable(dev.targetDate), false);
  assert.equal(dev.targetDate, null);
  assert.equal(dev.aging, 12);
});

test('tags are parsed into an array when the field is present', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);
  const tagged = model.items.find((i) => i.id === 1001);
  assert.deepEqual(tagged.tags, ['#blck', 'frontend']);
});

// --- Hidden cards ------------------------------------------------------------

test('hidden (filtered) cards are detected, not dropped', () => {
  const doc = loadFixture('board-full.html');
  const model = reader.readBoard(doc, options);

  const hidden = model.items.find((i) => i.id === 1004);
  assert.equal(hidden.isVisible, false);
  assert.equal(model.counts.hidden, 1);
  assert.equal(model.counts.visible, model.items.length - 1);
});

// --- Empty board -------------------------------------------------------------

test('empty board yields columns but zero items', () => {
  const doc = loadFixture('board-empty.html');
  const model = reader.readBoard(doc, options);

  assert.equal(model.items.length, 0);
  assert.equal(model.columns.length, 2);
  assert.deepEqual(model.counts, {
    total: 0,
    visible: 0,
    hidden: 0,
    uniqueVisibleIds: 0,
    duplicates: 0,
  });
});

// --- DOM variations ----------------------------------------------------------

test('works without the .kanban-board wrapper (root passed directly)', () => {
  const doc = loadFixture('board-variations.html');
  const model = reader.readBoard(doc, options);
  assert.deepEqual(model.columns.map((c) => c.name), ['To Do', 'Doing']);
});

test('header name falls back to aria-label when no editable label span', () => {
  const doc = loadFixture('board-variations.html');
  const model = reader.readBoard(doc, options);
  assert.equal(model.columns[0].name, 'To Do');
});

test('duplicate ids across columns are flagged on every occurrence', () => {
  const doc = loadFixture('board-variations.html');
  const model = reader.readBoard(doc, options);

  const dups = model.items.filter((i) => i.id === 2001);
  assert.equal(dups.length, 2);
  dups.forEach((d) => assert.equal(d.isDuplicate, true));
  // The two occurrences carry their own (different) column.
  assert.deepEqual(dups.map((d) => d.column).sort(), ['Doing', 'To Do']);
  assert.equal(model.counts.duplicates, 2);
  // Unique visible ids counts 2001 once: 2001, 2002, 2003 -> 3.
  assert.equal(model.counts.uniqueVisibleIds, 3);
});

test('card without type icon / assignee / fields is all UNAVAILABLE, not crashing', () => {
  const doc = loadFixture('board-variations.html');
  const model = reader.readBoard(doc, options);

  const minimal = model.items.find((i) => i.id === 2002);
  assert.equal(reader.isUnavailable(minimal.type), true);
  assert.equal(reader.isUnavailable(minimal.assignee), true);
  assert.equal(reader.isUnavailable(minimal.aging), true);
  assert.equal(reader.isUnavailable(minimal.tags), true);
  // Title/state are still present.
  assert.equal(minimal.title, 'Minimal card');
  assert.equal(minimal.state, 'New');
});

test('non-duplicate card is flagged isDuplicate=false', () => {
  const doc = loadFixture('board-variations.html');
  const model = reader.readBoard(doc, options);
  assert.equal(model.items.find((i) => i.id === 2003).isDuplicate, false);
});

// --- Robustness --------------------------------------------------------------

test('readBoard on null/empty root returns a safe empty model', () => {
  const model = reader.readBoard(null, options);
  assert.deepEqual(model.items, []);
  assert.deepEqual(model.columns, []);
});
