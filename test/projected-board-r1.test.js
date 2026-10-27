// test/projected-board-r1.test.js
// R1 regression guard for the Projected Board UI (roadmap T1.5).
//
// The Projected Board renders a column-oriented simulation into a node under
// document.body, which the MutationObserver watches with
// { childList: true, subtree: true }. To preserve the R1 fix, the view must:
//   - write its output ONLY through setProjectedOutput -> setIndicatorHtml (the
//     diff-before-write guard), so an unchanged render never emits a record;
//   - never recompute on a DOM mutation (the projection is built only on an
//     explicit click, and the Initial/Projected toggle re-renders from memory).
//
// This test asserts those properties statically over content.js so the
// discipline cannot silently regress, plus a behavioral diff-guard model that
// proves repeated identical renders produce zero observed records.
//
// Dependency-free: node --test only. All comments in English.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function content() {
  return fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
}

// --- Behavioral model: diff-before-write kills repeated identical renders -----

// Mirror setIndicatorHtml's guard: write (and emit a record) only when the html
// actually changes. This is exactly what the projected output relies on.
class DiffGuardedNode {
  constructor(observer) {
    this._html = '';
    this._observer = observer;
  }
  setHtml(value) {
    if (this._html === value) return; // diff-before-write
    this._html = value;
    if (this._observer) this._observer.records.push({ type: 'childList' });
  }
}

test('re-rendering the same projection writes nothing (diff-guard)', () => {
  const observer = { records: [] };
  const node = new DiffGuardedNode(observer);

  // Simulate: show projected, toggle to initial and back to projected several
  // times with identical content. Only genuine content changes emit records.
  node.setHtml('<projected/>'); // 1 record
  node.setHtml('<projected/>'); // no-op
  node.setHtml('<initial/>'); // 1 record
  node.setHtml('<initial/>'); // no-op
  node.setHtml('<projected/>'); // 1 record
  node.setHtml('<projected/>'); // no-op

  assert.equal(observer.records.length, 3);
});

// --- Static assertions over content.js ---------------------------------------

test('setProjectedOutput routes writes through the setIndicatorHtml diff-guard', () => {
  const src = content();
  assert.ok(
    /function setProjectedOutput[\s\S]*setIndicatorHtml\(output/.test(src),
    'projected output must use the setIndicatorHtml diff-guard'
  );
});

test('the projection is computed only on an explicit action, not on mutation', () => {
  const src = content();
  // handleShowProjectedBoard is the only place that builds a projection, and it
  // is bound to the explicit "Projected board" button, not to the observer.
  assert.ok(/function handleShowProjectedBoard\(/.test(src), 'handler must exist');
  assert.ok(
    /ProjectedBoard\.project\(/.test(src),
    'the engine must be invoked to build the projection'
  );
  assert.ok(
    /bindSnapshotButton\('wip-projected-show', \(\) => handleShowProjectedBoard/.test(src),
    'projection must be wired to an explicit button click'
  );

  // The view toggle re-renders from the in-memory projection; it must NOT call
  // the engine again (no recompute cycle on toggle).
  const toggleIdx = src.indexOf('function setProjectedView');
  assert.ok(toggleIdx !== -1, 'setProjectedView must exist');
  const toggleBody = src.slice(toggleIdx, src.indexOf('function setProjectedStatus'));
  assert.ok(
    !/ProjectedBoard\.project\(/.test(toggleBody),
    'toggling the view must not recompute the projection'
  );
  assert.ok(
    /renderProjectedBoard\(/.test(toggleBody),
    'toggling the view must re-render from memory'
  );
});

test('content.js still defines the R1 primitives and keeps the observer config', () => {
  const src = content();
  assert.ok(/function withObserverPaused\(/.test(src), 'withObserverPaused must exist');
  assert.ok(/function setIndicatorHtml\(/.test(src), 'setIndicatorHtml must exist');
  assert.ok(/childList: true, subtree: true/.test(src), 'observer config unchanged');
});
