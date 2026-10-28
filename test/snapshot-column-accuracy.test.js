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
test('missing swimlane cards remain incomplete even with reliable GUID mapping', () => {
  const bad=lanes.replace('<div class="kanban-board-column" data-column="b"><div class="wit-card" data-itemid="22"></div></div>','');
  const m=modelFrom(bad);
  // Known GUIDs still identify all remaining columns; the board's header count
  // proves the absent work item was not fully observed.
  assert.equal(m.diagnostics.columnAlignmentReliable,true);
  const snap=capture.buildCapture(m,scope);
  assert.equal(snap.complete,false);
  assert.ok(snap.incompleteReasons.includes(capture.IncompleteReasons.HEADER_COUNT_MISMATCH));
});
test('same numeric id is counted once even when repeated in a swimlane', () => {
  const m = modelFrom(lanes.replace('data-itemid="12"','data-itemid="11"'));
  const snap=capture.buildCapture(m,scope);
  assert.equal(snap.items.length,3);
  assert.equal(snap.complete,false);
  assert.ok(snap.incompleteReasons.includes(capture.IncompleteReasons.DUPLICATE_IDS));
});

test('columns without a header counter use unique visible DOM cards', () => {
  const noTotals=lanes.replace(/<span class="board-column-item-count">2<\/span>/g, '');
  const observed=modelFrom(noTotals);
  const result=capture.buildCapture(observed,scope);
  assert.equal(result.complete,true);
  assert.equal(result.columns[0].reportedCount,null);
  assert.equal(result.columns[1].reportedCount,null);
  assert.deepEqual(result.columns.map(c => c.count),[2,2]);
  assert.equal(result.items.length,4);
  assert.ok(!result.incompleteReasons.includes(capture.IncompleteReasons.HEADER_COUNT_UNAVAILABLE));
});

test('ragged swimlane maps Closed cards by GUID even when final row omits middle column', () => {
  const ragged = [
    '<div class="kanban-board">',
    '<span class="kanban-board-column-header" aria-label="Approved"><span class="board-column-item-count">1</span></span>',
    '<span class="kanban-board-column-header" aria-label="HO"><span class="board-column-item-count">1</span></span>',
    '<span class="kanban-board-column-header" aria-label="Closed"><span class="board-column-item-count">2</span></span>',
    '<div class="kanban-board-column" data-column="a"><div class="wit-card" data-itemid="1"></div></div>',
    '<div class="kanban-board-column" data-column="h"><div class="wit-card" data-itemid="2"></div></div>',
    '<div class="kanban-board-column" data-column="c" data-done="true"><div class="wit-card" data-itemid="3"></div></div>',
    '<div class="kanban-board-column" data-column="c" data-done="true"><div class="wit-card" data-itemid="4"></div></div>',
    '</div>'
  ].join('');
  const model = modelFrom(ragged);
  assert.equal(model.diagnostics.columnAlignmentReliable, true);
  const result = capture.buildCapture(model, scope);
  assert.equal(result.complete, true);
  assert.deepEqual(result.columns.map(c => [c.name, c.count]), [
    ['Approved', 1], ['HO', 1], ['Closed', 2]
  ]);
  assert.equal(result.items.find(x => x.id === 4).column, 'Closed');
});

test('unknown column layout reports uncertainty, never silently marks complete', () => {
  const layout = [
    '<div class="kanban-board">',
    '<span class="kanban-board-column-header" aria-label="Approved"></span>',
    '<span class="kanban-board-column-header" aria-label="Closed"></span>',
    '<div class="kanban-board-column" data-column="a"><div class="wit-card" data-itemid="1"></div></div>',
    '<div class="kanban-board-column" data-column="b"><div class="wit-card" data-itemid="2"></div></div>',
    '<div class="kanban-board-column" data-column="unknown"><div class="wit-card" data-itemid="3"></div></div>',
    '</div>'
  ].join('');
  const model = modelFrom(layout);
  assert.equal(model.diagnostics.columnAlignmentReliable, false);
  assert.equal(model.diagnostics.unmappedBodyCount, 1);
  const result = capture.buildCapture(model, scope);
  assert.equal(result.complete, false);
  assert.ok(result.incompleteReasons.includes(capture.IncompleteReasons.COLUMN_ALIGNMENT_UNKNOWN));
});

test('Closed without a numeric counter is retained alongside counted columns', async () => {
  const html=lanes.replace(
    '<div class="kanban-board-column-header" aria-label="Closed"><span class="board-column-item-count">2</span></div>',
    '<div class="kanban-board-column-header" aria-label="Closed"></div>'
  );
  const model=modelFrom(html);
  const result=capture.buildCapture(model,scope);
  assert.deepEqual(result.columns.map(c=>({name:c.name,count:c.count,header:c.reportedCount})),[
    {name:'Approved',count:2,header:2},
    {name:'Closed',count:2,header:null}
  ]);
  assert.equal(result.complete,true);
  assert.deepEqual(result.items.filter(i=>i.column==='Closed').map(i=>i.id).sort((a,b)=>a-b),[21,22]);
  const db=Store.createStore({storage:createMockStorage()});
  await db.createSnapshot(result.storeInput);
  const saved=await db.getLatestSnapshot(scope);
  assert.equal(saved.columns.find(c=>c.name==='Closed').count,2);
  assert.equal(saved.columns.find(c=>c.name==='Closed').reportedCount,null);
  assert.equal(saved.items.filter(i=>i.column==='Closed').length,2);
});

test('empty Closed without a counter reports 0 cards without marking the whole capture incomplete', () => {
  const html=lanes
    .replace(
      '<div class="kanban-board-column-header" aria-label="Closed"><span class="board-column-item-count">2</span></div>',
      '<div class="kanban-board-column-header" aria-label="Closed"></div>'
    )
    .replace(/<div class="wit-card" data-itemid="2[12]"><\/div>/g,'');
  const result=capture.buildCapture(modelFrom(html),scope);
  assert.equal(result.columns[1].count,0);
  assert.equal(result.columns[1].reportedCount,null);
  assert.equal(result.complete,true);
});

test('no counter does not hide independent structural or visibility problems', () => {
  const html=lanes
    .replace(
      '<div class="kanban-board-column-header" aria-label="Closed"><span class="board-column-item-count">2</span></div>',
      '<div class="kanban-board-column-header" aria-label="Closed"></div>'
    )
    .replace('data-itemid="22"','data-itemid="21"');
  const result=capture.buildCapture(modelFrom(html),scope);
  assert.equal(result.complete,false);
  assert.ok(result.incompleteReasons.includes(capture.IncompleteReasons.DUPLICATE_IDS));
});
