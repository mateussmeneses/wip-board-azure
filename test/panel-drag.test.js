// The drag engine is pure when supplied with a simulated viewport/storage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const drag = require('../src/ui/panel-drag.js');

test('drag positions cannot leave the viewport', () => {
  assert.deepEqual(drag.clampPosition(-10,-20,400,300,900,650), {x:8,y:8});
  assert.deepEqual(drag.clampPosition(999,999,400,300,900,650), {x:492,y:342});
  assert.deepEqual(drag.clampPosition(24,40,400,300,900,650), {x:24,y:40});
});
test('panel larger than viewport still keeps its top-left and close button reachable', () => {
  assert.deepEqual(drag.clampPosition(600,300,400,900,350,250), {x:8,y:8});
  assert.deepEqual(drag.clampPosition(NaN,NaN,180,100,500,400), {x:8,y:8});
});
test('drag handler is registered once, supports pointer capture and keyboard arrows', () => {
  const source = fs.readFileSync(path.join(__dirname,'..','src','ui','panel-drag.js'),'utf8');
  assert.match(source,/dataset\.dragInitialized === 'true'/);
  assert.match(source,/pointerdown/);
  assert.match(source,/pointermove/);
  assert.match(source,/pointerup/);
  assert.match(source,/pointercancel/);
  assert.match(source,/setPointerCapture/);
  assert.match(source,/ArrowLeft/);
  assert.match(source,/ArrowRight/);
  assert.match(source,/ArrowUp/);
  assert.match(source,/ArrowDown/);
  assert.match(source,/storage\.set/);
});
test('form controls and Azure DOM remain outside drag behavior', () => {
  const content = fs.readFileSync(path.join(__dirname,'..','content.js'),'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'..','manifest.json'),'utf8'));
  assert.match(content, /id="wip-snapshot-drag-handle"/);
  assert.match(content, /id="wip-snapshot-toggle"/);
  assert.match(content, /WIPBoardPanelDrag\.attach\(panel/);
  assert.ok(manifest.content_scripts[0].js.indexOf('src/ui/panel-drag.js') <
    manifest.content_scripts[0].js.indexOf('content.js'));
  assert.ok(manifest.content_scripts[0].css.includes('src/ui/panel-theme.css'));
});
