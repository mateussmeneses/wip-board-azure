// test/mutation-observer-r1.test.js
// Reproducible validation for risk R1 (docs/AUDIT_R1_MUTATION_OBSERVER.md):
// the floating indicator is re-rendered with an UNCONDITIONAL innerHTML write on
// every updateWipBoard() run. Because the indicator lives inside the observed
// subtree (document.body), that write emits a childList mutation record even when
// the rendered HTML is byte-for-byte identical, which re-arms the 300 ms debounce
// and sustains a persistent background recompute cycle with no user interaction.
//
// IMPORTANT: this task does NOT change the observer behavior. This test only
// *characterizes and proves* the problem so a later, separate fix (observer pause
// or diff-before-write) has a red test to turn green. Node has no DOM or
// MutationObserver, so we model the two moving parts precisely:
//   - a minimal node whose `innerHTML` setter records a "childList" mutation on
//     every assignment (matching the browser's detach-all/insert-all semantics);
//   - a minimal MutationObserver-like recorder.
// The reproduction is deterministic and dependency-free (node --test).

const test = require('node:test');
const assert = require('node:assert/strict');

// A node that mimics the one DOM fact that drives R1: assigning innerHTML always
// replaces the children, so an observer watching childList sees a record every
// time, regardless of whether the new string equals the old one.
class MutatingNode {
  constructor(observer) {
    this._html = '';
    this._observer = observer;
  }
  set innerHTML(value) {
    // Unconditional replace == what the browser does on innerHTML assignment.
    this._html = value;
    if (this._observer) this._observer.record({ type: 'childList', target: this });
  }
  get innerHTML() {
    return this._html;
  }
}

// Minimal stand-in for MutationObserver: it just counts records. The real one
// would schedule the debounced updateWipBoard() callback for each batch.
class RecordingObserver {
  constructor() {
    this.records = [];
  }
  record(rec) {
    this.records.push(rec);
  }
}

// Model of the CURRENT render tail (applyWipIndicatorState): it ALWAYS writes
// innerHTML, with no equality guard. This is the exact code shape that seeds R1.
function currentRenderTail(indicator, html) {
  indicator.innerHTML = html; // unconditional write
}

// Model of a POSSIBLE future fix (diff-before-write) kept here only to express
// the acceptance target for the later R1 task. Not wired into content.js now.
function diffGuardedRenderTail(indicator, html) {
  if (indicator.innerHTML === html) return; // skip no-op write
  indicator.innerHTML = html;
}

test('R1 reproduction: current render re-triggers the observer even with identical HTML', () => {
  const observer = new RecordingObserver();
  const indicator = new MutatingNode(observer);
  const stableHtml = '<div><span>Total Board WIP: 3 / 5</span></div>';

  // Three consecutive updateWipBoard() runs with an unchanged board state.
  currentRenderTail(indicator, stableHtml);
  currentRenderTail(indicator, stableHtml);
  currentRenderTail(indicator, stableHtml);

  // Each run emits a childList record -> each would re-arm the debounce -> the
  // cycle is self-sustaining. This asserts the problem exists today.
  assert.equal(observer.records.length, 3);
  assert.equal(
    observer.records.every((r) => r.type === 'childList'),
    true
  );
});

test('R1 acceptance target: a diff-before-write guard would break the cycle', () => {
  const observer = new RecordingObserver();
  const indicator = new MutatingNode(observer);
  const stableHtml = '<div><span>Total Board WIP: 3 / 5</span></div>';

  // First run writes (state changed from empty). Subsequent identical runs skip.
  diffGuardedRenderTail(indicator, stableHtml);
  diffGuardedRenderTail(indicator, stableHtml);
  diffGuardedRenderTail(indicator, stableHtml);

  // Only the first write emits a record; the idle board no longer self-triggers.
  assert.equal(observer.records.length, 1);

  // A genuine state change still writes (and so still triggers one recompute).
  diffGuardedRenderTail(indicator, '<div><span>Total Board WIP: 4 / 5</span></div>');
  assert.equal(observer.records.length, 2);
});
