const test = require('node:test');
const assert = require('node:assert/strict');
const Identity = require('../src/core/board-identity.js');
const Store = require('../src/data/snapshot-store.js');
const { createMockStorage } = require('./helpers/mock-chrome-storage.js');

const root = 'https://dev.azure.com/contoso/Sample.Project/_boards/board/t/MyTeam/';
test('two roadmaps and maintenance have three independent persisted histories', async () => {
  const urls = [
    root + 'Roadmap%20Platform',
    root + 'Roadmap%20Mobile',
    root + 'Maintenance',
  ];
  const scopes = urls.map(Identity.resolveBoardScope);
  assert.equal(new Set(scopes.map(Store.scopeKey)).size, 3);
  const db = Store.createStore({storage: createMockStorage()});
  for (let index=0; index < scopes.length; index += 1) {
    await db.createSnapshot({ scope: scopes[index], items: [{id: 101, column: 'Column '+index}], complete:true });
  }
  for (let index=0; index < scopes.length; index += 1) {
    const snapshots = await db.getSnapshots(scopes[index]);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].items[0].column, 'Column '+index);
  }
});
test('display filters and transient query parameters do not create a new board history', () => {
  const a=Identity.resolveBoardScope(root+'Roadmap%20Platform?selectedFilter=mine');
  const b=Identity.resolveBoardScope(root+'Roadmap%20Platform?selectedFilter=all');
  assert.deepEqual(a,b);
});
test('different teams and legacy visualstudio routes are isolated', () => {
  const a=Identity.resolveBoardScope(root+'Maintenance');
  const b=Identity.resolveBoardScope('https://dev.azure.com/contoso/Sample.Project/_boards/board/t/OtherTeam/Maintenance');
  const c=Identity.resolveBoardScope('https://contoso.visualstudio.com/Sample.Project/_boards/board/t/MyTeam/Maintenance');
  assert.notEqual(Store.scopeKey(a),Store.scopeKey(b));
  assert.deepEqual(a,c);
});
test('non-boards and untrusted domains have no storage scope', () => {
  assert.equal(Identity.resolveBoardScope('https://evil.example/contoso/p/_boards/board/t/t/a'),null);
  assert.equal(Identity.resolveBoardScope('https://dev.azure.com/org/project/_workitems'),null);
  assert.equal(Identity.resolveBoardScope('http://dev.azure.com/org/project/_boards/board/t/x/y'),null);
});

test('Snapshot panel is not gated by configured WIP target or URL keyword', () => {
  const fs=require('node:fs');
  const path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','content.js'),'utf8');
  assert.match(source, /function mountSnapshotPanelForBoard\(context, i18n\)/);
  const matches=source.match(/mountSnapshotPanelForBoard\(snapshotContext, i18n\);/g)||[];
  assert.equal(matches.length,2, 'both no-WIP-config and non-target WIP paths must mount Snapshot');
  assert.match(source, /panel\.style\.display === 'none'\) panel\.style\.display = ''/);
});
