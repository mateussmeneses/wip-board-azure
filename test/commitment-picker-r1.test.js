// test/commitment-picker-r1.test.js
// R1 regression guard for the NEW Daily Commitment Card Picker UI (roadmap T1.4).
//
// The task mandates: "Verificar especificamente se a nova UI preserva a correção
// R1 do MutationObserver." The picker list lives inside document.body, which the
// MutationObserver watches with { childList: true, subtree: true }. Unlike the
// old textarea (which did not write to the DOM as the user typed), the picker
// RE-RENDERS its list on every search keystroke and selection toggle. If that
// write happened outside the observer-paused phase it would emit childList
// records and re-arm the WIP recompute — reintroducing the exact R1 loop.
//
// This test has two layers:
//   1. A behavioral model (same technique as test/mutation-observer-r1.test.js):
//      a node whose innerHTML assignment always emits a record, an observer that
//      only counts records while connected, and the withObserverPaused wrapper
//      reproduced EXACTLY as content.js defines it. It proves that a sequence of
//      picker re-renders produces ZERO observed mutation records.
//   2. A static assertion over content.js: the picker render routes its DOM
//      writes through withObserverPaused and the summary through a diff-guard, so
//      the discipline cannot silently regress in a future edit.
//
// Dependency-free: node --test only.

const test = require('node:test');
const assert = require('node:assert/strict');

// --- Layer 1: behavioral model ----------------------------------------------

// innerHTML assignment always replaces children -> a childList watcher sees a
// record every time (matches the browser; mirrors the R1 base test).
class MutatingNode {
  constructor(observer) {
    this._html = '';
    this._observer = observer;
  }
  set innerHTML(value) {
    this._html = value;
    if (this._observer) this._observer.record({ type: 'childList', target: this });
  }
  get innerHTML() {
    return this._html;
  }
}

class FakeObserver {
  constructor() {
    this.records = [];
    this.connected = true;
  }
  record(rec) {
    if (this.connected) this.records.push(rec);
  }
  disconnect() {
    this.connected = false;
  }
  observe() {
    this.connected = true;
  }
}

// withObserverPaused reproduced EXACTLY as content.js defines it (disconnect ->
// write -> reconnect on the next microtask), parameterized on the observer.
function makeWithObserverPaused(observer) {
  return function withObserverPaused(write) {
    if (!observer) {
      write();
      return;
    }
    observer.disconnect();
    try {
      write();
    } finally {
      Promise.resolve().then(() => observer.observe());
    }
  };
}

test('picker re-renders routed through withObserverPaused produce no observed records', async () => {
  const observer = new FakeObserver();
  const list = new MutatingNode(observer);
  const withObserverPaused = makeWithObserverPaused(observer);

  // Simulate what renderPickerList does: open, then several search keystrokes,
  // each replacing the list innerHTML — all inside the paused phase.
  const renders = ['<open/>', '<q1/>', '<q12/>', '<q123/>', '<cleared/>'];
  renders.forEach((html) => {
    withObserverPaused(() => {
      list.innerHTML = html;
    });
  });

  // Let the reconnect microtasks flush.
  await Promise.resolve();
  await Promise.resolve();

  // Every write happened while disconnected -> zero records seen by the observer.
  assert.equal(observer.records.length, 0);
  // And the final content is what the last render wrote.
  assert.equal(list.innerHTML, '<cleared/>');

  // A LATER genuine external mutation (not ours) is still observed: the guard
  // only hides the extension's own writes, never real board changes.
  list.innerHTML = '<external-change/>';
  assert.equal(observer.records.length, 1);
});

// --- Layer 2: static assertion over content.js ------------------------------

test('content.js wraps the picker render in withObserverPaused and diff-guards the summary', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

  // The picker list render must happen inside the observer-paused phase.
  const renderIdx = src.indexOf('function renderPickerList');
  assert.ok(renderIdx !== -1, 'renderPickerList must exist');
  const renderBody = src.slice(renderIdx, src.indexOf('function renderPickerRow'));
  assert.ok(
    /withObserverPaused\(/.test(renderBody),
    'renderPickerList must route its DOM writes through withObserverPaused'
  );
  assert.ok(
    /list\.innerHTML/.test(renderBody),
    'renderPickerList must be the function that writes the list innerHTML'
  );

  // The plan summary must be diff-guarded (write only on change) and paused.
  const summaryIdx = src.indexOf('function updatePlanSummary');
  assert.ok(summaryIdx !== -1, 'updatePlanSummary must exist');
  const summaryBody = src.slice(summaryIdx, src.indexOf('function collectPickerSelection'));
  assert.ok(
    /plan\.textContent !== text/.test(summaryBody),
    'updatePlanSummary must diff before writing'
  );
  assert.ok(
    /withObserverPaused\(/.test(summaryBody),
    'updatePlanSummary must write inside withObserverPaused'
  );

  // The engine/comparison outputs must still flow through the diff-guard writer.
  assert.ok(
    /function setCommitmentOutput[\s\S]*setIndicatorHtml\(output/.test(src),
    'commitment output must still use the setIndicatorHtml diff-guard'
  );
});

test('content.js still defines the R1 primitives the picker depends on', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  assert.ok(/function withObserverPaused\(/.test(src), 'withObserverPaused must exist');
  assert.ok(/function setIndicatorHtml\(/.test(src), 'setIndicatorHtml must exist');
  // The observer must still watch the body subtree (the reason the guard matters).
  assert.ok(/childList: true, subtree: true/.test(src), 'observer config unchanged');
});
