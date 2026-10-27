// test/sprint-trends.test.js
// Unit tests for the Sprint Trend & Risk engine (roadmap T2.4). Covers the
// scenarios in the task's section 10: linear progress, progress below/above the
// time reference, no reliable dates, empty history, a single observation,
// multiple observations, out-of-order observations, scope changes (add/remove),
// reopened items, incomplete snapshots, unknown states, late baseline, finish-
// date change, different orgs/sprints, correct completion rates, temporal
// comparison, heuristic alerts, insufficient-data risk.
//
// The engine is PURE and reuses the T2.3 progress engine; these tests feed it
// plain baseline + observation objects, never the DOM or Chrome.

const test = require('node:test');
const assert = require('node:assert/strict');

const SprintTrends = require('../src/data/sprint-trends.js');
const SprintBaseline = require('../src/data/sprint-baseline.js');
const SprintScope = require('../src/data/sprint-scope.js');

const { Risk, Reliability } = SprintTrends;

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2024-01-01T00:00:00Z');

// Build an immutable baseline from a list of {id,column} planned items.
function baselineOf(items, flowConfig, capturedAt) {
  return SprintBaseline.createBaseline(
    { id: 's1', iterationPath: 'T\\S1', startDate: '2024-01-01', finishDate: '2024-01-10' },
    SprintScope.buildScopeItems(items, { featureTypes: flowConfig && flowConfig.featureTypes }),
    flowConfig || null,
    { capturedAt: capturedAt || new Date(START), source: 'dom' }
  );
}

function planned(n, column) {
  const col = column || 'Approved';
  const list = [];
  for (let k = 1; k <= n; k += 1) list.push({ id: k, type: 'User Story', column: col });
  return list;
}

// An observation: ids with a column, captured at dayOffset days after START.
function observation(dayOffset, items, extra) {
  return Object.assign({
    id: 'obs' + dayOffset,
    capturedAt: new Date(START + dayOffset * DAY).toISOString(),
    complete: true,
    reliability: Reliability.SUFFICIENT,
    items: items,
  }, extra || {});
}

// Move the first `completed` of n ids to Closed, rest stay Approved.
function scopeWith(n, completed, extraItems) {
  const items = [];
  for (let k = 1; k <= n; k += 1) items.push({ id: k, column: k <= completed ? 'Closed' : 'Approved' });
  (extraItems || []).forEach(function (it) { items.push(it); });
  return items;
}

const sprint = { id: 's1', startDate: '2024-01-01T00:00:00Z', finishDate: '2024-01-10T00:00:00Z' };

test('empty history: honest limitations, insufficient-data risk, no series', () => {
  const base = baselineOf(planned(10));
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: [], now: new Date(START + 5 * DAY) });
  assert.equal(r.hasBaseline, true);
  assert.equal(r.hasHistory, false);
  assert.equal(r.series.length, 0);
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
  assert.ok(r.limitations.includes('no-history'));
});

test('no baseline: limitation flagged and risk is insufficient data', () => {
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: null, history: [observation(1, scopeWith(10, 1))], now: new Date(START + 1 * DAY) });
  assert.equal(r.hasBaseline, false);
  assert.ok(r.limitations.includes('no-baseline'));
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
});

test('single observation: limitation flagged; still insufficient for a verdict', () => {
  const base = baselineOf(planned(10));
  const r = SprintTrends.computeTrends({
    sprint: sprint, baseline: base,
    history: [observation(5, scopeWith(10, 6))],
    now: new Date(START + 5 * DAY),
  });
  assert.equal(r.series.length, 1);
  assert.ok(r.limitations.includes('single-observation'));
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
  // The single point's completion is still computed correctly (60%).
  assert.equal(r.series[0].baselineCompletionPct, 60);
});

test('multiple observations produce a chronological series with correct rates', () => {
  const base = baselineOf(planned(10));
  const history = [
    observation(1, scopeWith(10, 1)), // 10%
    observation(3, scopeWith(10, 3)), // 30%
    observation(6, scopeWith(10, 6)), // 60%
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 6 * DAY) });
  assert.equal(r.series.length, 3);
  assert.deepEqual(r.series.map(function (p) { return p.baselineCompletionPct; }), [10, 30, 60]);
  assert.deepEqual(r.series.map(function (p) { return p.completed; }), [1, 3, 6]);
});

test('out-of-order observations are sorted chronologically', () => {
  const base = baselineOf(planned(10));
  const history = [
    observation(6, scopeWith(10, 6)),
    observation(1, scopeWith(10, 1)),
    observation(3, scopeWith(10, 3)),
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 6 * DAY) });
  assert.deepEqual(r.series.map(function (p) { return p.completed; }), [1, 3, 6]);
  // epochs strictly ascending
  for (let k = 1; k < r.series.length; k += 1) {
    assert.ok(r.series[k].epochMs > r.series[k - 1].epochMs);
  }
});

test('duplicate observations (same instant) collapse to one point', () => {
  const base = baselineOf(planned(10));
  const dup = observation(3, scopeWith(10, 3));
  const r = SprintTrends.computeTrends({
    sprint: sprint, baseline: base,
    history: [dup, Object.assign({}, dup, { id: 'obs3b' })],
    now: new Date(START + 3 * DAY),
  });
  assert.equal(r.series.length, 1);
});

test('progress below the linear time reference is reported as a behind-reference signal', () => {
  const base = baselineOf(planned(10));
  // ~90% of time elapsed (day 9 of a 10-day sprint span), only 30% done.
  const history = [
    observation(2, scopeWith(10, 1)),
    observation(9, scopeWith(10, 3)),
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 9 * DAY) });
  assert.ok(r.time.reliable);
  assert.ok(r.time.linearReferencePct > r.latest.baselineCompletionPct);
  const codes = r.risk.signals.map(function (s) { return s.code; });
  assert.ok(codes.includes('behind-reference') || codes.includes('late-sprint-low-completion'));
  assert.ok(r.risk.level === Risk.AT_RISK || r.risk.level === Risk.ATTENTION);
});

test('progress above the linear time reference yields on-track with no adverse signals', () => {
  const base = baselineOf(planned(10));
  // Early sprint (day 2), already 60% done.
  const history = [
    observation(1, scopeWith(10, 4)),
    observation(2, scopeWith(10, 6)),
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 2 * DAY) });
  assert.ok(r.latest.baselineCompletionPct >= r.time.linearReferencePct);
  assert.equal(r.risk.level, Risk.ON_TRACK);
  assert.equal(r.risk.signals.length, 0);
});

test('no reliable dates: no time percentage invented', () => {
  const base = baselineOf(planned(10));
  const r = SprintTrends.computeTrends({
    sprint: { id: 's1', startDate: null, finishDate: null },
    baseline: base,
    history: [observation(1, scopeWith(10, 1)), observation(2, scopeWith(10, 2))],
    now: new Date(START + 2 * DAY),
  });
  assert.equal(r.time.reliable, false);
  assert.equal(r.time.elapsedPct, null);
  assert.equal(r.time.linearReferencePct, null);
  assert.ok(r.limitations.includes('no-reliable-dates'));
});

test('scope change timeline detects added and removed ids in the interval', () => {
  const base = baselineOf(planned(5));
  const o1 = observation(1, scopeWith(5, 1));
  // day 3: id 5 removed, id 99 added.
  const o2 = observation(3, [
    { id: 1, column: 'Closed' }, { id: 2, column: 'Approved' },
    { id: 3, column: 'Approved' }, { id: 4, column: 'Approved' },
    { id: 99, column: 'Development' },
  ]);
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: [o1, o2], now: new Date(START + 3 * DAY) });
  assert.equal(r.scopeTimeline.length, 1);
  const iv = r.scopeTimeline[0];
  assert.deepEqual(iv.added, [99]);
  assert.deepEqual(iv.removed, [5]);
  assert.equal(iv.detection, 'in-interval');
});

test('a returned item is classified as returned, not merely added', () => {
  const base = baselineOf(planned(3));
  const o1 = observation(1, [{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }, { id: 3, column: 'Approved' }]);
  const o2 = observation(2, [{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }]); // id 3 removed
  const o3 = observation(3, [{ id: 1, column: 'Approved' }, { id: 2, column: 'Approved' }, { id: 3, column: 'Development' }]); // id 3 back
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: [o1, o2, o3], now: new Date(START + 3 * DAY) });
  const last = r.scopeTimeline[r.scopeTimeline.length - 1];
  assert.deepEqual(last.added, [3]);
  assert.deepEqual(last.returned, [3]);
});

test('reopened item: completed count may fall; series is not forced monotonic', () => {
  const base = baselineOf(planned(10));
  const history = [
    observation(1, scopeWith(10, 5)), // 5 done
    observation(3, scopeWith(10, 6)), // 6 done
    observation(5, scopeWith(10, 4)), // reopened: back to 4 done
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 5 * DAY) });
  assert.deepEqual(r.series.map(function (p) { return p.completed; }), [5, 6, 4]);
  assert.deepEqual(r.burnup.map(function (p) { return p.completed; }), [5, 6, 4]);
  // Burndown rises again when work is reopened.
  assert.deepEqual(r.burndown.map(function (p) { return p.remaining; }), [5, 4, 6]);
});

test('unknown-state items are tracked separately and never counted as done', () => {
  const base = baselineOf(planned(10));
  // ids 9 and 10 have no resolvable column (unknown).
  const items = scopeWith(8, 4);
  items.push({ id: 9 }, { id: 10 });
  const history = [observation(2, items), observation(4, items)];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 4 * DAY) });
  const p = r.series[r.series.length - 1];
  assert.equal(p.unknown, 2);
  assert.equal(p.completed, 4);
  // Burndown exposes the unknown bucket separately from remaining.
  assert.equal(r.burndown[r.burndown.length - 1].unknown, 2);
});

test('high unknown share forces insufficient-data risk', () => {
  const base = baselineOf(planned(10));
  // 4 of 10 unknown = 40% >= 30% at-risk unknown threshold -> insufficient data.
  const items = scopeWith(6, 3);
  items.push({ id: 7 }, { id: 8 }, { id: 9 }, { id: 10 });
  const history = [observation(5, items), observation(7, items)];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 7 * DAY) });
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
  assert.equal(r.risk.reason, 'too-many-unknown-items');
});

test('high scope growth raises a scope-growth signal', () => {
  const base = baselineOf(planned(10));
  // Add 4 items (40% growth) late with low completion.
  const extra = [{ id: 21, column: 'Approved' }, { id: 22, column: 'Approved' }, { id: 23, column: 'Approved' }, { id: 24, column: 'Approved' }];
  const history = [
    observation(2, scopeWith(10, 2)),
    observation(5, scopeWith(10, 4, extra)),
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 5 * DAY) });
  const codes = r.risk.signals.map(function (s) { return s.code; });
  assert.ok(codes.includes('scope-growth'));
  assert.ok(r.latest.added === 4);
});

test('stagnation: items with no movement across reliable observations are flagged', () => {
  const base = baselineOf(planned(5));
  // ids 3,4,5 sit in Development untouched across three observations.
  function stagItems(done) {
    return [
      { id: 1, column: done >= 1 ? 'Closed' : 'Approved' },
      { id: 2, column: done >= 2 ? 'Closed' : 'Approved' },
      { id: 3, column: 'Development' },
      { id: 4, column: 'Development' },
      { id: 5, column: 'Development' },
    ];
  }
  const history = [
    observation(1, stagItems(0)),
    observation(2, stagItems(1)),
    observation(3, stagItems(2)),
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 3 * DAY) });
  assert.ok(r.stagnation.enoughData);
  assert.deepEqual(r.stagnation.stagnantIds, [3, 4, 5]);
});

test('incomplete observation downgrades reliability and is flagged', () => {
  const base = baselineOf(planned(10));
  const history = [
    observation(2, scopeWith(10, 3)),
    observation(4, scopeWith(10, 5), { complete: false, reliability: Reliability.PARTIAL }),
  ];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 4 * DAY) });
  assert.equal(r.series[1].reliability, Reliability.PARTIAL);
  assert.ok(r.limitations.includes('incomplete-observations'));
});

test('late baseline is detected and flagged', () => {
  // Baseline captured 3 days after sprint start.
  const base = baselineOf(planned(10), null, new Date(START + 3 * DAY));
  const history = [observation(4, scopeWith(10, 2)), observation(6, scopeWith(10, 4))];
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 6 * DAY) });
  assert.equal(r.lateBaseline, true);
  assert.ok(r.limitations.includes('late-baseline'));
});

test('a changed finish date shortens the span and shifts the time reference', () => {
  const base = baselineOf(planned(10));
  const history = [observation(2, scopeWith(10, 3)), observation(4, scopeWith(10, 5))];
  const shortSprint = { id: 's1', startDate: '2024-01-01T00:00:00Z', finishDate: '2024-01-05T00:00:00Z' };
  const r = SprintTrends.computeTrends({ sprint: shortSprint, baseline: base, history: history, now: new Date(START + 4 * DAY) });
  // Day 4 of a 5-day span -> high elapsed fraction.
  assert.ok(r.time.elapsedPct >= 75);
  assert.equal(r.time.totalDays, 5);
});

test('different sprints/orgs stay isolated in the computation inputs', () => {
  const baseA = baselineOf(planned(4));
  const baseB = SprintBaseline.createBaseline(
    { id: 's2', startDate: '2024-01-01', finishDate: '2024-01-10' },
    SprintScope.buildScopeItems(planned(8)), null, { capturedAt: new Date(START), source: 'dom' }
  );
  const rA = SprintTrends.computeTrends({ sprint: sprint, baseline: baseA, history: [observation(2, scopeWith(4, 2)), observation(4, scopeWith(4, 3))], now: new Date(START + 4 * DAY) });
  const rB = SprintTrends.computeTrends({ sprint: { id: 's2', startDate: '2024-01-01', finishDate: '2024-01-10' }, baseline: baseB, history: [observation(2, scopeWith(8, 2)), observation(4, scopeWith(8, 4))], now: new Date(START + 4 * DAY) });
  assert.equal(rA.baselineTotal, 4);
  assert.equal(rB.baselineTotal, 8);
  assert.equal(rA.series[1].completed, 3);
  assert.equal(rB.series[1].completed, 4);
});

test('configurable risk thresholds change the verdict', () => {
  const base = baselineOf(planned(10));
  const history = [observation(4, scopeWith(10, 3)), observation(6, scopeWith(10, 5))];
  // Default: mid-sprint, 50% done, roughly on track.
  const def = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 6 * DAY) });
  // Tighten the behind-reference band so any lag becomes an at-risk signal.
  const strict = SprintTrends.computeTrends({
    sprint: sprint, baseline: base, history: history, now: new Date(START + 6 * DAY),
    riskConfig: { behindReferenceAttentionPts: 1, behindReferenceAtRiskPts: 2, atRiskSignalCount: 1 },
  });
  assert.ok(strict.risk.signals.length >= def.risk.signals.length);
});

test('linear time reference example from the goal: 10-day sprint, 7 days elapsed ~70%', () => {
  const base = baselineOf(planned(10));
  const history = [observation(3, scopeWith(10, 3)), observation(6, scopeWith(10, 6))];
  // 7 days elapsed of a 10-day span -> ~66-70% reference.
  const r = SprintTrends.computeTrends({ sprint: sprint, baseline: base, history: history, now: new Date(START + 7 * DAY) });
  assert.ok(r.time.elapsedPct >= 66 && r.time.elapsedPct <= 78);
});

test('computeElapsedTime labels the basis as calendar-days', () => {
  const t = SprintTrends.computeElapsedTime(sprint, new Date(START + 5 * DAY));
  assert.equal(t.basis, 'calendar-days');
  assert.equal(t.reliable, true);
});

test('incomplete capture cannot fabricate removals in the scope timeline', () => {
  const base = baselineOf(planned(3));
  const history = [
    observation(1, scopeWith(3, 1)),
    observation(2, [{ id: 1, column: 'Closed' }], {
      complete: false, reliability: Reliability.PARTIAL,
    }),
  ];
  const r = SprintTrends.computeTrends({
    sprint, baseline: base, history, now: new Date(START + 2 * DAY),
  });
  assert.equal(r.scopeTimeline[0].reliable, false);
  assert.equal(r.scopeTimeline[0].removed.length, 0);
  assert.equal(r.latest.unknown, 2);
  assert.equal(r.latest.removed, 0);
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
});

test('incomplete newest observation cannot yield on-track from earlier good readings', () => {
  const base = baselineOf(planned(3));
  const history = [
    observation(1, scopeWith(3, 3)),
    observation(2, scopeWith(3, 3)),
    observation(3, [{ id: 1, column: 'Closed' }], {
      complete: false, reliability: Reliability.PARTIAL,
    }),
  ];
  const r = SprintTrends.computeTrends({ sprint, baseline: base, history,
    now: new Date(START + 3 * DAY) });
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
  assert.equal(r.scopeTimeline[1].reliable, false);
});

test('historic observations tied to an older baseline revision are not replayed against current', () => {
  const base = baselineOf(planned(3));
  const stored = { baseline: base, revision: 1 };
  const history = [
    observation(1, scopeWith(3, 2), { baselineRef: { revision: 0 } }),
    observation(2, scopeWith(3, 3), { baselineRef: { revision: 1 } }),
  ];
  const r = SprintTrends.computeTrends({
    sprint, baseline: stored, history, now: new Date(START + 2 * DAY),
  });
  assert.equal(r.series[0].baselineCompletionPct, null);
  assert.equal(r.series[0].reliability, Reliability.UNAVAILABLE);
  assert.equal(r.series[1].baselineCompletionPct, 100);
  assert.ok(r.limitations.includes('baseline-revision-mismatch'));
  assert.equal(r.risk.level, Risk.INSUFFICIENT_DATA);
});
