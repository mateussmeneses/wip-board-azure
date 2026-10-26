// test/mutation-observer-r1.test.js
// Validation for risk R1 (docs/AUDIT_R1_MUTATION_OBSERVER.md) and its fix
// (roadmap T0.5).
//
// BEFORE (problem): updateWipBoard() rewrote the floating indicator's innerHTML
// UNCONDITIONALLY on every run. The indicator lives inside the observed subtree
// (document.body with { childList: true, subtree: true }), so that write emits a
// childList mutation record even when the rendered HTML is byte-for-byte
// identical. The record re-arms the 300 ms debounce and seeds the next run — a
// persistent background recompute cycle with no user interaction.
//
// AFTER (fix): content.js now (1) pauses the observer around the DOM write phase
// (withObserverPaused: disconnect -> write -> reconnect on the next microtask),
// and (2) diffs before writing the indicator (setIndicatorHtml skips a no-op
// rewrite). Either guard alone breaks the self-retrigger; together they are
// robust.
//
// Node has no DOM / MutationObserver, so the two moving parts are modeled
// precisely and the fix functions are reproduced EXACTLY as content.js defines
// them (same pattern as test/wip-runtime-integration.test.js, which reimplements
// the runtime algorithm for a dependency-free comparison):
//   - MutatingNode: assigning innerHTML always replaces children -> the observer
//     watching childList sees a record every time (matches the browser).
//   - FakeObserver: disconnect()/observe() toggle a "connected" flag; records are
//     only counted while connected, mirroring a real MutationObserver.
//
// The reproduction is deterministic and dependency-free (node --test).

const test = require('node:test');
const assert = require('node:assert/strict');

// --- Models -----------------------------------------------------------------

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

// Minimal stand-in for MutationObserver. A real observer only delivers records
// while connected; disconnect() stops delivery until observe() is called again.
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

// --- Fix functions: reproduced EXACTLY as defined in content.js (T0.5) -------

// Diff-before-write guard (content.js setIndicatorHtml).
function setIndicatorHtml(indicator, html) {
  if (indicator.innerHTML === html) return false;
  indicator.innerHTML = html;
  return true;
}

// Observer pause wrapper (content.js withObserverPaused). In content.js the
// reconnect happens on the next microtask; the test drains microtasks with an
// await so reconnection is observable deterministically.
function withObserverPaused(observer, write) {
  if (!observer) {
    write();
    return;
  }
  observer.disconnect();
  try {
    write();
  } finally {
    Promise.resolve().then(() => {
      observer.observe();
    });
  }
}

// Model of the OLD render tail: unconditional innerHTML write, observer always
// connected. This is the exact code shape that seeded R1.
function legacyRenderTail(indicator, html) {
  indicator.innerHTML = html; // unconditional write, no guard, no pause
}

// ============================================================================
// BEFORE: the problem, proven to exist in the pre-fix shape
// ============================================================================

test('BEFORE: unconditional render re-triggers the observer even with identical HTML', () => {
  const observer = new FakeObserver();
  const indicator = new MutatingNode(observer);
  const stableHtml = '<div><span>Total Board WIP: 3 / 5</span></div>';

  // Three consecutive updateWipBoard() runs with an unchanged board state.
  legacyRenderTail(indicator, stableHtml);
  legacyRenderTail(indicator, stableHtml);
  legacyRenderTail(indicator, stableHtml);

  // Each run emits a childList record -> each would re-arm the debounce -> the
  // cycle is self-sustaining. This is the broken baseline.
  assert.equal(observer.records.length, 3);
  assert.equal(
    observer.records.every((r) => r.type === 'childList'),
    true
  );
});

// ============================================================================
// AFTER: the fix, proven to break the self-retrigger cycle
// ============================================================================

test('AFTER (diff guard): identical renders no longer emit records', () => {
  const observer = new FakeObserver();
  const indicator = new MutatingNode(observer);
  const stableHtml = '<div><span>Total Board WIP: 3 / 5</span></div>';

  // First run writes (state changed from empty). Subsequent identical runs skip.
  const wrote1 = setIndicatorHtml(indicator, stableHtml);
  const wrote2 = setIndicatorHtml(indicator, stableHtml);
  const wrote3 = setIndicatorHtml(indicator, stableHtml);

  assert.equal(wrote1, true);
  assert.equal(wrote2, false);
  assert.equal(wrote3, false);
  // Only the first write emits a record; the idle board no longer self-triggers.
  assert.equal(observer.records.length, 1);
});

test('AFTER (diff guard): a genuine state change still writes exactly once', () => {
  const observer = new FakeObserver();
  const indicator = new MutatingNode(observer);

  setIndicatorHtml(indicator, '<div><span>Total Board WIP: 3 / 5</span></div>');
  setIndicatorHtml(indicator, '<div><span>Total Board WIP: 3 / 5</span></div>'); // no-op
  setIndicatorHtml(indicator, '<div><span>Total Board WIP: 4 / 5</span></div>'); // change

  // One record for the initial render + one for the real change = 2. The
  // redundant middle render contributes nothing. Real moves are never lost.
  assert.equal(observer.records.length, 2);
});

test('AFTER (observer pause): a single card movement triggers exactly one recompute', async () => {
  // Models a single external board change followed by the extension's write
  // phase. The write happens while the observer is paused, so the write does not
  // feed back as a second recompute trigger.
  const observer = new FakeObserver();
  const indicator = new MutatingNode(observer);

  // 1) External mutation (Azure moves a card) while the observer is connected.
  observer.record({ type: 'childList', target: 'external-card-move' });
  assert.equal(observer.records.length, 1, 'the real move is observed');

  // 2) The extension recomputes and writes the indicator with the observer
  //    paused. Even if the HTML differs (new count), the write emits no record
  //    the observer would see.
  withObserverPaused(observer, () => {
    indicator.innerHTML = '<div><span>Total Board WIP: 4 / 5</span></div>';
  });

  // Still exactly one record: the extension's own write did not self-trigger.
  assert.equal(observer.records.length, 1, 'the self-write is not observed');

  // 3) Observer reconnects on the next microtask and is ready for the next real
  //    change — dynamic Azure updates are not lost.
  await Promise.resolve();
  assert.equal(observer.connected, true, 'observer reconnected after the write');

  const after = observer.records.length;
  observer.record({ type: 'childList', target: 'another-real-move' });
  assert.equal(observer.records.length, after + 1, 'subsequent real moves are observed');
});

test('AFTER (observer pause): multiple consecutive movements each recompute once, with no self-induced extra', async () => {
  const observer = new FakeObserver();
  const indicator = new MutatingNode(observer);

  for (let i = 1; i <= 5; i++) {
    // Each iteration = one real external move, then one paused write phase.
    observer.record({ type: 'childList', target: `real-move-${i}` });
    withObserverPaused(observer, () => {
      indicator.innerHTML = `<div><span>Total Board WIP: ${i} / 10</span></div>`;
    });
    await Promise.resolve(); // let the observer reconnect
    assert.equal(observer.connected, true);
  }

  // Exactly five records: one per real move, zero from the extension's writes.
  assert.equal(observer.records.length, 5);
});

test('AFTER (combined): idle board produces no recompute even if updateWipBoard runs repeatedly', async () => {
  // Combined guards: the write phase is paused AND diff-guarded. Repeatedly
  // rendering an unchanged board produces zero observable records.
  const observer = new FakeObserver();
  const indicator = new MutatingNode(observer);
  const stableHtml = '<div><span>Total Board WIP: 2 / 5</span></div>';

  // Prime once (first real render).
  withObserverPaused(observer, () => setIndicatorHtml(indicator, stableHtml));
  await Promise.resolve();
  const primed = observer.records.length;

  // Ten idle recomputes (e.g. spurious callbacks): no new records at all.
  for (let i = 0; i < 10; i++) {
    withObserverPaused(observer, () => setIndicatorHtml(indicator, stableHtml));
    await Promise.resolve();
  }

  assert.equal(observer.records.length, primed, 'idle recomputes add no records');
});
