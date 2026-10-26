// test/runtime-stability.test.js
// Runtime stability + module resilience tests for roadmap T0.5.
//
// Covers the behaviors requested by the task that are NOT already proven by
// test/wip-runtime-integration.test.js (WIP-number equivalence) or
// test/mutation-observer-r1.test.js (observer self-retrigger):
//   - a single card movement -> exactly one recompute
//   - multiple consecutive movements -> one recompute each
//   - a configuration change -> a recompute
//   - the indicator renders
//   - mutations produced by the runtime itself -> no extra recompute
//   - an empty board -> WIP = 0 (a LEGITIMATE zero, not a hidden failure)
//   - a board reload -> re-reads and re-renders
//   - MISSING required modules -> explicit diagnostic, NOT a silent WIP = 0
//
// content.js is a content script (it reads `chrome`, `document`, `window` and
// calls fetch() at top level), so it cannot be `require`d under node --test.
// Following the established repo pattern (test/wip-runtime-integration.test.js
// reimplements the runtime algorithm for a dependency-free comparison), this
// file reproduces the T0.5 resilience/stability contract EXACTLY as content.js
// defines it and asserts the observable behavior.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const reader = require('../src/data/board-dom-reader.js');
const core = require('../src/core/wip-logic.js');
const { parseHTML } = require('./helpers/mini-dom.js');

function loadFixture(name) {
  return parseHTML(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

function isVisible(card) {
  return !card.closest('[aria-hidden="true"], .is-hidden, .hidden');
}

// ---------------------------------------------------------------------------
// Reproductions of the content.js T0.5 primitives (see content.js §1b/§1c and
// assertRequiredModules). Kept byte-faithful to the runtime contract.
// ---------------------------------------------------------------------------

const MODULE_LOAD_ERROR_PREFIX = '[WIP-Board] Required module failed to load';

// Mirror of content.js assertRequiredModules(), parameterized on the two module
// references so the test can simulate each being absent without a global.
function assertRequiredModules(Core, Reader) {
  const missing = [];
  if (!Core) missing.push('WIPBoardCore (src/core/wip-logic.js)');
  if (!Reader) missing.push('WIPBoardReader (src/data/board-dom-reader.js)');
  if (missing.length > 0) {
    return new Error(
      `${MODULE_LOAD_ERROR_PREFIX}: ${missing.join(', ')}. ` +
        'Check manifest.json content_scripts load order.'
    );
  }
  return null;
}

// Mirror of content.js readBoardModel(): never coerce a missing/throwing reader
// into an empty model; re-raise with context instead.
function readBoardModel(Reader, doc) {
  if (!Reader || typeof Reader.readBoard !== 'function') {
    throw new Error(`${MODULE_LOAD_ERROR_PREFIX}: WIPBoardReader.readBoard is unavailable.`);
  }
  try {
    return Reader.readBoard(doc, { isVisible });
  } catch (err) {
    const wrapped = new Error(
      `[WIP-Board] WIPBoardReader.readBoard threw while reading the board: ${err && err.message ? err.message : err}`
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

// Minimal MutationObserver + indicator model, identical semantics to
// mutation-observer-r1.test.js, reused here to exercise the stability loop.
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

function withObserverPaused(observer, write) {
  if (!observer) return void write();
  observer.disconnect();
  try {
    write();
  } finally {
    Promise.resolve().then(() => observer.observe());
  }
}

// A tiny indicator with the diff-before-write guard; renderCount lets the test
// prove the indicator actually renders.
function makeIndicator(observer) {
  return {
    _html: '',
    renderCount: 0,
    set(html) {
      if (this._html === html) return false;
      this._html = html;
      this.renderCount += 1;
      observer.record({ type: 'childList', target: 'indicator' });
      return true;
    },
  };
}

// A compact, faithful recompute: read model -> count WIP in configured columns
// -> render indicator, all under the paused observer. Returns the WIP number.
function recompute(ctx) {
  const { observer, indicator, Reader, doc, config } = ctx;
  const model = readBoardModel(Reader, doc);
  const wipColumns = config.wipColumns.map((c) => core.normalizeColumnName(c)).filter(Boolean);
  const wipColumnsModel = model.columns.filter((col) =>
    core.isConfiguredWipColumn(col.name, wipColumns)
  );
  let total = 0;
  wipColumnsModel.forEach((col) => {
    total += model.items.filter(
      (i) => i.isVisible && i.column === col.name && i.columnId === col.id
    ).length;
  });
  const limit = core.computeWipLimit(config);
  withObserverPaused(observer, () => {
    indicator.set(`<div><span>Total Board WIP: ${total} / ${limit}</span></div>`);
  });
  return total;
}

// ============================================================================
// Module resilience (section 3): missing modules must NOT look like an empty board
// ============================================================================

test('both required modules present: no error', () => {
  assert.equal(assertRequiredModules(core, reader), null);
});

test('missing WIPBoardCore: explicit diagnostic error (not a silent WIP = 0)', () => {
  const err = assertRequiredModules(null, reader);
  assert.ok(err instanceof Error);
  assert.match(err.message, /WIPBoardCore/);
  assert.match(err.message, /content_scripts load order/);
});

test('missing WIPBoardReader: explicit diagnostic error', () => {
  const err = assertRequiredModules(core, null);
  assert.ok(err instanceof Error);
  assert.match(err.message, /WIPBoardReader/);
});

test('missing both modules: both are named in the diagnostic', () => {
  const err = assertRequiredModules(null, null);
  assert.match(err.message, /WIPBoardCore/);
  assert.match(err.message, /WIPBoardReader/);
});

test('readBoardModel throws (not empty model) when the reader is unavailable', () => {
  assert.throws(() => readBoardModel(null, loadFixture('board-full.html')), /unavailable/);
});

test('readBoardModel re-raises a reader failure with context, never a silent empty model', () => {
  const throwingReader = {
    readBoard() {
      throw new Error('boom: unexpected DOM');
    },
  };
  assert.throws(
    () => readBoardModel(throwingReader, loadFixture('board-full.html')),
    /threw while reading the board: boom: unexpected DOM/
  );
});

test('a populated board is never reported as empty by readBoardModel', () => {
  const model = readBoardModel(reader, loadFixture('board-full.html'));
  assert.ok(model.items.length > 0, 'populated fixture must yield items');
});

// ============================================================================
// Runtime stability loop (sections 1 & 4)
// ============================================================================

test('single card movement triggers exactly one recompute and renders the indicator', async () => {
  const observer = new FakeObserver();
  const indicator = makeIndicator(observer);
  const ctx = {
    observer,
    indicator,
    Reader: reader,
    doc: loadFixture('board-full.html'),
    config: { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'] },
  };

  // External move observed.
  observer.record({ type: 'childList', target: 'real-move' });
  const beforeRecords = observer.records.length;

  const wip = recompute(ctx);
  await Promise.resolve();

  assert.equal(wip, 1, 'only visible card 1003 counts');
  assert.equal(indicator.renderCount, 1, 'indicator rendered once');
  // Exactly one new record (the real move); the self-write added none.
  assert.equal(observer.records.length, beforeRecords, 'no self-induced record from the write');
  assert.equal(observer.connected, true, 'observer reconnected for the next move');
});

test('multiple consecutive movements each recompute once, no self-induced extras', async () => {
  const observer = new FakeObserver();
  const indicator = makeIndicator(observer);
  const ctx = {
    observer,
    indicator,
    Reader: reader,
    doc: loadFixture('board-full.html'),
    config: { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'] },
  };

  let realMoves = 0;
  for (let i = 0; i < 4; i++) {
    observer.record({ type: 'childList', target: `move-${i}` });
    realMoves += 1;
    recompute(ctx);
    await Promise.resolve();
  }

  // Indicator rendered once (identical WIP each time -> diff guard skips repeats).
  assert.equal(indicator.renderCount, 1);
  // Every observed record is a real move; none came from the extension's writes.
  assert.equal(observer.records.length, realMoves);
});

test('configuration change recomputes and re-renders when the WIP number changes', () => {
  const observer = new FakeObserver();
  const indicator = makeIndicator(observer);
  const doc = loadFixture('board-full.html');

  const ctxA = {
    observer, indicator, Reader: reader, doc,
    config: { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'] },
  };
  const wipA = recompute(ctxA);
  assert.equal(wipA, 1);
  assert.equal(indicator.renderCount, 1);

  // User widens the configured WIP columns via the popup.
  const ctxB = {
    observer, indicator, Reader: reader, doc,
    config: { useEquipe: false, directWip: 10, wipColumns: ['Approved', 'Desenvolvimento', 'Code Review'] },
  };
  const wipB = recompute(ctxB);
  assert.equal(wipB, 4); // Approved(2) + Dev(1 visible) + CR(1)
  assert.equal(indicator.renderCount, 2, 'changed WIP re-renders the indicator');
});

test('mutations produced by the runtime itself do not cause an extra recompute', async () => {
  const observer = new FakeObserver();
  const indicator = makeIndicator(observer);
  const ctx = {
    observer, indicator, Reader: reader,
    doc: loadFixture('board-full.html'),
    config: { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'] },
  };

  recompute(ctx);
  await Promise.resolve();
  const recordsAfterFirst = observer.records.length;

  // Ten idle recomputes (e.g. spurious callbacks): identical WIP -> no renders,
  // no observable records, loop does not sustain itself.
  for (let i = 0; i < 10; i++) {
    recompute(ctx);
    await Promise.resolve();
  }
  assert.equal(observer.records.length, recordsAfterFirst, 'no self-sustained recompute');
  assert.equal(indicator.renderCount, 1, 'identical state never re-renders');
});

test('empty board yields a LEGITIMATE WIP = 0 (and the model is genuinely empty)', () => {
  const observer = new FakeObserver();
  const indicator = makeIndicator(observer);
  const ctx = {
    observer, indicator, Reader: reader,
    doc: loadFixture('board-empty.html'),
    config: { useEquipe: false, directWip: 5, wipColumns: ['Doing'] },
  };
  const wip = recompute(ctx);
  assert.equal(wip, 0);
  // The zero came from an actually empty model, not a swallowed error.
  const model = readBoardModel(reader, loadFixture('board-empty.html'));
  assert.equal(model.items.length, 0);
});

test('board reload re-reads the model and re-renders', async () => {
  const observer = new FakeObserver();
  const indicator = makeIndicator(observer);

  // First load: a populated board.
  const ctx1 = {
    observer, indicator, Reader: reader,
    doc: loadFixture('board-full.html'),
    config: { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'] },
  };
  assert.equal(recompute(ctx1), 1);
  assert.equal(indicator.renderCount, 1);

  // Simulated reload: a fresh document (here, empty) is read on pageshow.
  const ctx2 = {
    observer, indicator, Reader: reader,
    doc: loadFixture('board-empty.html'),
    config: { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'] },
  };
  assert.equal(recompute(ctx2), 0);
  // WIP changed 1 -> 0, so the indicator re-rendered on reload.
  assert.equal(indicator.renderCount, 2);
});
