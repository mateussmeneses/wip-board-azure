const test = require('node:test');
const assert = require('node:assert/strict');
const reader = require('../src/data/board-dom-reader.js');
const capture = require('../src/data/snapshot-capture.js');
const Store = require('../src/data/snapshot-store.js');
const { parseHTML } = require('./helpers/mini-dom.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');
const scope = {organization:'sample',project:'p',team:'t',board:'t/t/maintenance'};

function modelFrom(html) {
  return reader.readBoard(parseHTML(html), {isVisible:()=>true});
}
const lanes = [
'<div class="kanban-board">',
' <div class="kanban-board-column-header" aria-label="Approved"><span class="board-column-item-count">2</span></div>',
' <div class="kanban-board-column-header" aria-label="Closed"><span class="board-column-item-count">2</span></div>',
' <div class="kanban-board-column" data-column="a"><div class="wit-card" data-itemid="11"></div></div>',
' <div class="kanban-board-column" data-column="b"><div class="wit-card" data-itemid="21"></div></div>',
' <div class="kanban-board-column" data-column="a"><div class="wit-card" data-itemid="12"></div></div>',
' <div class="kanban-board-column" data-column="b"><div class="wit-card" data-itemid="22"></div></div>',
'</div>'
].join('\n');
test('reads all swimlane bodies, not only the first column row', () => {
  const model = modelFrom(lanes);
  assert.equal(model.diagnostics.headerCount, 2);
  assert.equal(model.diagnostics.bodyCount, 4);
  assert.equal(model.diagnostics.columnAlignmentReliable, true);
  const snap = capture.buildCapture(model,scope);
  assert.deepEqual(snap.columns.map(c=>c.count),[2,2]);
  assert.equal(snap.complete,true);
  assert.equal(snap.items.length,4);
});
test('header and DOM mismatch is flagged and both values are persisted', async () => {
  const m = modelFrom(lanes.replace('>2</span>','>7</span>'));
  const snap = capture.buildCapture(m,scope);
  assert.equal(snap.columns[0].count,2);
  assert.equal(snap.columns[0].reportedCount,7);
  assert.equal(snap.complete,false);
  assert.ok(snap.incompleteReasons.includes(capture.IncompleteReasons.HEADER_COUNT_MISMATCH));
  const db = Store.createStore({storage:createMockStorage()});
  await db.createSnapshot(snap.storeInput);
  const saved=await db.getLatestSnapshot(scope);
  assert.equal(saved.columns[0].count,2);
  assert.equal(saved.columns[0].reportedCount,7);
  assert.equal(saved.source.complete,false);
});
test('ambiguous column-body mapping is never declared complete', () => {
  const bad=lanes.replace('<div class="kanban-board-column" data-column="b"><div class="wit-card" data-itemid="22"></div></div>','');
  const m=modelFrom(bad);
  assert.equal(m.diagnostics.columnAlignmentReliable,false);
  const snap=capture.buildCapture(m,scope);
  assert.equal(snap.complete,false);
  assert.ok(snap.incompleteReasons.includes(capture.IncompleteReasons.COLUMN_ALIGNMENT_UNKNOWN));
});
test('same numeric id is counted once even when repeated in a swimlane', () => {
  const m = modelFrom(lanes.replace('data-itemid="12"','data-itemid="11"'));
  const snap=capture.buildCapture(m,scope);
  assert.equal(snap.items.length,3);
  assert.equal(snap.complete,false);
  assert.ok(snap.incompleteReasons.includes(capture.IncompleteReasons.DUPLICATE_IDS));
});
