// src/data/sprint-trends.js
// Sprint Trend & Risk engine — the pure temporal-analysis layer for Sprint
// Intelligence (PRODUCT_ROADMAP T2.4, "Sprint Trends & Risk Analysis"). It
// answers, honestly and WITHOUT fabrication:
//   - How did baseline completion evolve across the recorded observations?
//   - How does observed progress compare to the elapsed-time reference line?
//   - How did the scope (added / removed / returned) change over time?
//   - How much work remains (burndown) and how much is done (burnup)?
//   - What are the delivery trends, and what risk signals do the data support?
//   - Where is the data insufficient to draw a conclusion?
//
// Design
// ------
// This module is PURE: no DOM, no Chrome, no network, no storage. It never
// mutates its inputs and never touches a work item in Azure DevOps. It is a thin
// layer ON TOP of the T2.3 Sprint Progress engine: for every persisted
// observation it REUSES `WIPBoardSprintProgress.computeProgress` to derive the
// per-observation completion/scope numbers, and it NEVER reimplements the T2.3
// classification rules (goal section 3). The baseline is read-only; this engine
// never recomputes or alters it (goal section 2).
//
// What it ADDS on top of T2.3
// ---------------------------
//   1. A time series: one point PER PERSISTED OBSERVATION (never a fabricated
//      daily point for a date with no capture — goal section 5). Each point
//      carries the observation date, proven baseline completion %, completed /
//      not-completed / unknown counts, current scope, added / removed counts and
//      the observation reliability.
//   2. Progress-vs-time: the elapsed-time percentage (calendar days, explicitly
//      distinguished from any future business-day metric) and a simple linear
//      reference line. The deviation is reported as INFORMATION, never as proof
//      of delay (goal section 4). When dates are not reliable, no time
//      percentage is invented.
//   3. Burnup and burndown series built ONLY from the real observation instants
//      (goal section 5). Series are NOT forced monotonic: a reopened item can
//      make the completed count fall (goal section 5). Unknown-state items are
//      tracked as their own series, never folded into "done".
//   4. A scope-change timeline between successive observations, classifying
//      added / removed / returned / still-planned ids, and labelling a change as
//      "detected in the interval" rather than claiming an exact instant (goal
//      section 6).
//   5. A heuristic risk verdict — On Track / Attention / At Risk /
//      Insufficient Data — from explicit, configurable, documented thresholds,
//      with the contributing signals listed (goal section 7). No AI, no
//      statistical forecast, no claim of certainty. Sparse / late / incomplete
//      data prefers Insufficient Data.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardSprintTrends.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const isNode = typeof require === 'function';
  const deps = {
    progress: isNode ? require('./sprint-progress.js') : (root && root.WIPBoardSprintProgress),
    baseline: isNode ? require('./sprint-baseline.js') : (root && root.WIPBoardSprintBaseline),
    scope: isNode ? require('./sprint-scope.js') : (root && root.WIPBoardSprintScope),
  };
  const api = factory(deps);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSprintTrends = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  const SprintProgress = deps.progress;
  const SprintBaseline = deps.baseline;
  const SprintScope = deps.scope;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // The heuristic risk verdicts (goal section 7). A verdict is a HEURISTIC over
  // the observed data, never a prediction. Insufficient Data is preferred
  // whenever the evidence is too thin to classify honestly.
  const Risk = Object.freeze({
    ON_TRACK: 'on-track',
    ATTENTION: 'attention',
    AT_RISK: 'at-risk',
    INSUFFICIENT_DATA: 'insufficient-data',
  });

  // The reliability of an observation, mirrored from the T2.3 verdict so the
  // trend layer never upgrades an observation's confidence.
  const Reliability = Object.freeze({
    SUFFICIENT: 'sufficient',
    PARTIAL: 'partial',
    UNAVAILABLE: 'unavailable',
  });

  // Explicit, documented, configurable risk thresholds (goal section 7). Every
  // threshold has a plain meaning so the verdict is auditable; callers may
  // override any subset.
  const DEFAULT_RISK_CONFIG = Object.freeze({
    // How many reliable observations are required before a verdict other than
    // Insufficient Data can be produced. Fewer than this => Insufficient Data.
    minReliableObservations: 2,
    // Fraction of the sprint elapsed beyond which a low completion is a strong
    // At-Risk signal (e.g. 0.8 = the last fifth of the sprint).
    lateSprintElapsedFraction: 0.8,
    // Completion below this fraction late in the sprint is an At-Risk signal.
    lateSprintMinCompletionFraction: 0.6,
    // How far observed completion may lag the linear time reference (in
    // percentage points) before it counts as a signal. Attention vs At-Risk use
    // the two bands below.
    behindReferenceAttentionPts: 10,
    behindReferenceAtRiskPts: 25,
    // Scope growth (added / baseline total) above this fraction is a signal.
    scopeGrowthAttentionFraction: 0.15,
    scopeGrowthAtRiskFraction: 0.3,
    // An item with no flow movement across at least this many reliable
    // observations is a stagnation signal.
    stagnationObservations: 3,
    stagnationCountAttention: 1,
    stagnationCountAtRisk: 3,
    // Unknown-state items as a fraction of the baseline total: a high share
    // undermines every other conclusion.
    unknownShareAttentionFraction: 0.15,
    unknownShareAtRiskFraction: 0.3,
    // Number of distinct signals that tips Attention into At Risk.
    atRiskSignalCount: 2,
  });

  function isUsable(value) {
    if (value === undefined || value === null) return false;
    if (value && typeof value === 'object' && value.__wipFieldState === 'unavailable') return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  }

  function resolveEpoch(value) {
    if (value == null) return null;
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value && typeof value === 'object') {
      if (Number.isFinite(value.epochMs)) return value.epochMs;
      if (isUsable(value.iso)) {
        const p = Date.parse(String(value.iso));
        return Number.isFinite(p) ? p : null;
      }
      return null;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clampFraction(value) {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.max(0, Math.min(1, value));
  }

  function round2(value) {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }

  // Extract the comparable scope-item list from a persisted observation. An
  // observation stores { id, column, state } per item (see the observation
  // store). We hand the raw list to the T2.3 engine, which normalizes it through
  // the shared scope builder, so no classification logic is duplicated here.
  function observationItems(observation) {
    if (!observation || typeof observation !== 'object') return [];
    const items = Array.isArray(observation.items) ? observation.items : [];
    return items.map(function (it) {
      return {
        id: it && it.id,
        type: it && it.type != null ? it.type : null,
        state: it && it.state != null ? it.state : null,
        column: it && it.column != null ? it.column : null,
        parentId: it && it.parentId != null ? it.parentId : null,
      };
    }).filter(function (it) { return it.id != null; });
  }

  // De-duplicate observations by capture instant and sort chronologically
  // (goal section 9: observations out of order, duplicate data). Two
  // observations with the same capturedAt epoch are treated as duplicates and
  // the first-seen one wins, so a double capture never doubles a point.
  function normalizeObservations(history) {
    const list = Array.isArray(history) ? history : [];
    const seenEpoch = new Set();
    const seenId = new Set();
    const out = [];
    list.forEach(function (obs) {
      if (!obs || typeof obs !== 'object') return;
      const epoch = resolveEpoch(obs.capturedAt);
      if (epoch == null) return; // an observation with no usable timestamp is unusable
      if (obs.id != null) {
        if (seenId.has(obs.id)) return;
        seenId.add(obs.id);
      }
      if (seenEpoch.has(epoch)) return;
      seenEpoch.add(epoch);
      out.push({ epoch: epoch, observation: obs });
    });
    out.sort(function (a, b) { return a.epoch - b.epoch; });
    return out;
  }

  // Build the full trend result from an immutable baseline + a persisted
  // observation history. This is the engine's single entry point.
  //
  //   input: {
  //     sprint       : { id, startDate, finishDate, ... } identity + period.
  //     baseline     : the frozen baseline record OR a stored baseline-record
  //                    wrapper { baseline, savedAt } (both accepted, mirroring
  //                    the T2.3 engine).
  //     history      : the persisted observations (sprint-observation records).
  //     flowConfig   : optional flow override; defaults to the baseline's flow.
  //     riskConfig   : optional override of DEFAULT_RISK_CONFIG.
  //     now          : Date | ISO | epoch; the anchor for elapsed-time math.
  //   }
  //
  // Returns a plain, never-frozen result object. When there is no usable
  // baseline or no observation, the result is honest about the limitation
  // (`hasBaseline` / `hasHistory` / `limitations`) and the risk verdict is
  // Insufficient Data — the goal forbids inventing a series or a verdict.
  function computeTrends(input) {
    const i = input || {};
    const riskConfig = Object.assign({}, DEFAULT_RISK_CONFIG, i.riskConfig || {});

    // Accept either a raw baseline or a stored baseline-record wrapper.
    const baseline = i.baseline && i.baseline.baseline && Array.isArray(i.baseline.baseline.plannedIds)
      ? i.baseline.baseline
      : (i.baseline && Array.isArray(i.baseline.plannedIds) ? i.baseline : null);

    const flow = SprintBaseline.resolveFlow(i.flowConfig || (baseline && baseline.flow));
    const flowView = {
      startColumn: flow.startColumn,
      endColumn: flow.endColumn,
      useState: flow.useState,
      countFeatures: flow.countFeatures,
    };

    const baselineTotal = baseline && Array.isArray(baseline.plannedIds)
      ? new Set(baseline.plannedIds).size
      : 0;

    const ordered = normalizeObservations(i.history);
    const limitations = [];

    // Period math (goal section 4), calendar days ONLY. We explicitly label the
    // basis as 'calendar-days' to distinguish it from any future business-day
    // metric. When dates are missing or inconsistent, no time percentage is
    // invented.
    const time = computeElapsedTime(i.sprint, i.now);
    if (!time.reliable) limitations.push('no-reliable-dates');

    if (!baseline) {
      limitations.push('no-baseline');
    }
    if (ordered.length === 0) {
      limitations.push('no-history');
    } else if (ordered.length === 1) {
      limitations.push('single-observation');
    }

    // Build the per-observation series by REUSING the T2.3 progress engine.
    const series = ordered.map(function (entry) {
      return buildSeriesPoint(entry, baseline, i.flowConfig || (baseline && baseline.flow), flow);
    });

    // Late baseline (goal section 2/9): the first observation predates the
    // baseline capture, or the baseline was captured well after the sprint
    // start. Surfaced, never silently corrected.
    const baselineCapturedMs = resolveEpoch(
      baseline && baseline.capturedAt != null
        ? baseline.capturedAt
        : (i.baseline && i.baseline.savedAt ? i.baseline.savedAt : null)
    );
    let lateBaseline = false;
    if (baselineCapturedMs != null && time.startMs != null && (baselineCapturedMs - time.startMs) > MS_PER_DAY) {
      lateBaseline = true;
      limitations.push('late-baseline');
    }

    const anyPartial = series.some(function (p) { return p.reliability !== Reliability.SUFFICIENT; });
    if (anyPartial) limitations.push('incomplete-observations');

    const burn = buildBurnSeries(series, baselineTotal);
    const scopeTimeline = buildScopeTimeline(ordered, baseline);
    const stagnation = computeStagnation(series, riskConfig);

    const latest = series.length ? series[series.length - 1] : null;

    const risk = assessRisk({
      series: series,
      latest: latest,
      baselineTotal: baselineTotal,
      time: time,
      scopeTimeline: scopeTimeline,
      stagnation: stagnation,
      config: riskConfig,
      hasBaseline: !!baseline,
    });

    return {
      hasBaseline: !!baseline,
      hasHistory: ordered.length > 0,
      observationCount: ordered.length,
      flow: flowView,
      baselineTotal: baselineTotal,
      lateBaseline: lateBaseline,

      // Period / elapsed-time reference (goal section 4).
      time: time,

      // The time series, one point per real observation (goal section 3/5).
      series: series,

      // Burnup / burndown built only from the real instants (goal section 5).
      burnup: burn.burnup,
      burndown: burn.burndown,

      // Scope-change timeline between observations (goal section 6).
      scopeTimeline: scopeTimeline,

      // Stagnation detail feeding the risk signals (goal section 7).
      stagnation: stagnation,

      // Heuristic risk verdict + the contributing signals (goal section 7).
      risk: risk,

      // The latest observation summary for the UI's "last observation" line.
      latest: latest,

      // Explicit limitations so the UI states them instead of guessing
      // (goal sections 2, 5, 9).
      limitations: limitations,
      riskConfig: riskConfig,
    };
  }

  // Build one time-series point from an observation by reusing the T2.3 engine.
  function buildSeriesPoint(entry, baseline, flowConfig, flow) {
    const obs = entry.observation;
    const items = observationItems(obs);

    // When there is no baseline we still emit a point describing the observed
    // scope, but completion against the baseline is null (nothing to measure).
    let progress = null;
    if (baseline) {
      progress = SprintProgress.computeProgress({
        baseline: baseline,
        currentItems: items,
        flowConfig: flowConfig,
        capturedAt: obs.capturedAt,
      });
    }

    const b = progress ? progress.baseline : null;
    const sc = progress ? progress.scopeChange : null;

    // Prefer the observation's own stored reliability when present (the capture
    // layer knows whether the board was fully loaded); otherwise fall back to
    // the T2.3 verdict derived from unknown items.
    let reliability = Reliability.SUFFICIENT;
    if (obs && isUsable(obs.reliability)) {
      reliability = obs.reliability;
    } else if (progress) {
      reliability = progress.reliability;
    } else {
      reliability = Reliability.UNAVAILABLE;
    }
    // A capture flagged incomplete can never be "sufficient".
    if (obs && obs.complete === false && reliability === Reliability.SUFFICIENT) {
      reliability = Reliability.PARTIAL;
    }

    const completed = b ? b.completed : 0;
    const unknown = b ? b.unknown : 0;
    const notCompleted = b ? (b.total - b.completed - b.unknown) : 0;

    return {
      epochMs: entry.epoch,
      iso: new Date(entry.epoch).toISOString(),
      observationId: obs && obs.id != null ? obs.id : null,
      // Proven baseline completion % (never optimistic; unknowns are not done).
      baselineCompletionPct: b ? b.completionPct : null,
      provenCompletionPct: b ? b.provenCompletionPct : null,
      completed: completed,
      // Items not yet completed (excludes unknown so the two never overlap).
      notCompleted: notCompleted < 0 ? 0 : notCompleted,
      unknown: unknown,
      baselineTotal: b ? b.total : 0,
      // Current scope and scope deltas at this instant.
      currentScope: progress ? progress.current.total : items.length,
      added: sc ? sc.added : 0,
      removed: sc ? sc.removed : 0,
      reliability: reliability,
      complete: !(obs && obs.complete === false),
      // The exact ids per state so stagnation + scope timeline can reuse them
      // without recomputing.
      states: progress ? progress.states : null,
    };
  }

  // Elapsed-time computation (goal section 4). Calendar days only; the basis is
  // labelled so a future business-day metric is a DIFFERENT field, never a silent
  // reinterpretation. The linear reference is a visualization aid, NOT a forecast.
  function computeElapsedTime(sprint, now) {
    const startMs = resolveEpoch(sprint && sprint.startDate);
    const finishMs = resolveEpoch(sprint && sprint.finishDate);
    const nowMs = resolveEpoch(now) != null ? resolveEpoch(now) : Date.now();

    if (startMs == null || finishMs == null || finishMs < startMs) {
      return {
        reliable: false,
        basis: 'calendar-days',
        startMs: startMs,
        finishMs: finishMs,
        totalDays: null,
        elapsedDays: null,
        remainingDays: null,
        elapsedFraction: null,
        elapsedPct: null,
        // The linear reference equals the elapsed fraction; null when unknown.
        linearReferencePct: null,
        state: 'unknown',
      };
    }

    const totalDays = Math.floor((finishMs - startMs) / MS_PER_DAY) + 1;
    let state = 'active';
    if (nowMs < startMs) state = 'before';
    else if (nowMs > finishMs) state = 'after';

    let elapsedDays;
    if (nowMs < startMs) elapsedDays = 0;
    else if (nowMs > finishMs) elapsedDays = totalDays;
    else elapsedDays = Math.min(totalDays, Math.floor((nowMs - startMs) / MS_PER_DAY) + 1);

    const remainingDays = Math.max(0, totalDays - elapsedDays);
    // Continuous elapsed fraction for the reference line (0..1), clamped.
    const span = finishMs - startMs;
    const frac = clampFraction(span <= 0 ? 1 : (nowMs - startMs) / span);
    const elapsedPct = frac == null ? null : round2(frac * 100);

    return {
      reliable: true,
      basis: 'calendar-days',
      startMs: startMs,
      finishMs: finishMs,
      totalDays: totalDays,
      elapsedDays: elapsedDays,
      remainingDays: remainingDays,
      elapsedFraction: frac,
      elapsedPct: elapsedPct,
      // The linear time reference line equals the elapsed percentage. It is a
      // visualization aid only; the goal forbids treating it as a prediction.
      linearReferencePct: elapsedPct,
      state: state,
    };
  }

  // Burnup + burndown from the real observation instants only (goal section 5).
  // Series are NOT forced monotonic; a reopened item lowers the completed count
  // and the series reflects that truthfully. Unknown items are a separate series.
  function buildBurnSeries(series, baselineTotal) {
    const burnup = series.map(function (p) {
      return {
        epochMs: p.epochMs,
        iso: p.iso,
        // Completed baseline items (the burnUP line).
        completed: p.completed,
        // The baseline total is the burnup target; reported alongside so the UI
        // can draw the target line. Current scope is presented SEPARATELY, never
        // merged into the baseline target (goal section 5).
        baselineTotal: p.baselineTotal || baselineTotal,
        currentScope: p.currentScope,
        reliability: p.reliability,
      };
    });

    const burndown = series.map(function (p) {
      const total = p.baselineTotal || baselineTotal;
      // Remaining = planned baseline items NOT yet completed and NOT unknown.
      // Unknown items are tracked separately so they are never counted as done
      // nor silently as remaining (goal section 5).
      const remaining = Math.max(0, total - p.completed - p.unknown);
      return {
        epochMs: p.epochMs,
        iso: p.iso,
        remaining: remaining,
        unknown: p.unknown,
        baselineTotal: total,
        reliability: p.reliability,
      };
    });

    return { burnup: burnup, burndown: burndown };
  }

  // Scope-change timeline (goal section 6). For each pair of successive
  // observations, classify the scope ids as added / removed / returned /
  // still-planned. A change is labelled as DETECTED IN THE INTERVAL between the
  // two capture instants; the engine never claims the exact moment of a change.
  function buildScopeTimeline(ordered, baseline) {
    if (ordered.length === 0) return [];
    const plannedSet = new Set(baseline && Array.isArray(baseline.plannedIds) ? baseline.plannedIds : []);

    // Track which baseline ids have been seen leaving and re-entering the scope
    // so a genuine "return" is distinguished from an id that simply stayed.
    const everRemovedBaseline = new Set();
    const intervals = [];

    function idSetOf(observation) {
      const set = new Set();
      observationItems(observation).forEach(function (it) { if (it.id != null) set.add(it.id); });
      return set;
    }

    let prevSet = null;
    let prevEpoch = null;
    ordered.forEach(function (entry, index) {
      const curSet = idSetOf(entry.observation);
      if (index === 0) {
        prevSet = curSet;
        prevEpoch = entry.epoch;
        // Seed removed-baseline tracking from the very first observation: a
        // planned id already absent at the first capture was removed before the
        // observation window; mark it so a later reappearance is a "return".
        plannedSet.forEach(function (id) { if (!curSet.has(id)) everRemovedBaseline.add(id); });
        return;
      }

      const added = [];
      const removed = [];
      const returned = [];
      const stillPlanned = [];

      curSet.forEach(function (id) {
        if (!prevSet.has(id)) {
          added.push(id);
          // A baseline id that had been removed and is now back is a RETURN.
          if (plannedSet.has(id) && everRemovedBaseline.has(id)) {
            returned.push(id);
            everRemovedBaseline.delete(id);
          }
        } else if (plannedSet.has(id)) {
          stillPlanned.push(id);
        }
      });

      prevSet.forEach(function (id) {
        if (!curSet.has(id)) {
          removed.push(id);
          if (plannedSet.has(id)) everRemovedBaseline.add(id);
        }
      });

      intervals.push({
        fromEpochMs: prevEpoch,
        toEpochMs: entry.epoch,
        fromIso: new Date(prevEpoch).toISOString(),
        toIso: new Date(entry.epoch).toISOString(),
        // The ids whose membership changed between the two captures. The label
        // is "detected in interval" (goal section 6): the exact instant is
        // unknown, only the window is.
        detection: 'in-interval',
        added: added.sort(numAsc),
        removed: removed.sort(numAsc),
        returned: returned.sort(numAsc),
        stillPlannedCount: stillPlanned.length,
      });

      prevSet = curSet;
      prevEpoch = entry.epoch;
    });

    return intervals;
  }

  function numAsc(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
  }

  // Detect items with NO flow movement across the last N reliable observations
  // (goal section 7). Movement is a change in the item's boundary state between
  // consecutive reliable observations. An item seen only in unreliable
  // observations is NOT counted as stagnant (we require reliable evidence).
  function computeStagnation(series, config) {
    const window = Math.max(2, config.stagnationObservations | 0);
    const reliable = series.filter(function (p) {
      return p.reliability === Reliability.SUFFICIENT && p.states;
    });
    if (reliable.length < window) {
      return { window: window, reliableObservations: reliable.length, stagnantIds: [], enoughData: false };
    }

    const slice = reliable.slice(-window);
    // Build a per-id signature of its state across the window. An id present in
    // the same non-completed state the whole window is stagnant; a completed id
    // is progress, not stagnation.
    const stateById = new Map();
    slice.forEach(function (p, idx) {
      const buckets = p.states;
      recordState(stateById, buckets.notStarted, 'not-started', idx);
      recordState(stateById, buckets.inProgress, 'in-progress', idx);
      recordState(stateById, buckets.completed, 'completed', idx);
      recordState(stateById, buckets.unknown, 'unknown', idx);
    });

    const stagnant = [];
    stateById.forEach(function (track, id) {
      // Must appear in every observation of the window.
      if (track.seen !== slice.length) return;
      // Never completed, and the state never changed across the window.
      if (track.distinct.size === 1 && !track.distinct.has('completed') && !track.distinct.has('unknown')) {
        stagnant.push(id);
      }
    });

    return {
      window: window,
      reliableObservations: reliable.length,
      stagnantIds: stagnant.sort(numAsc),
      enoughData: true,
    };
  }

  function recordState(map, ids, label, idx) {
    (ids || []).forEach(function (id) {
      let track = map.get(id);
      if (!track) {
        track = { seen: 0, lastIdx: -1, distinct: new Set() };
        map.set(id, track);
      }
      // Count one appearance per observation index.
      if (track.lastIdx !== idx) {
        track.seen += 1;
        track.lastIdx = idx;
      }
      track.distinct.add(label);
    });
  }

  // Heuristic risk assessment (goal section 7). Explicit, documented thresholds;
  // no AI, no statistical forecast. The output lists the contributing signals so
  // the UI can EXPLAIN the verdict (goal section 8). Thin / late / incomplete
  // data yields Insufficient Data.
  function assessRisk(ctx) {
    const cfg = ctx.config;
    const signals = [];

    const reliableCount = ctx.series.filter(function (p) {
      return p.reliability === Reliability.SUFFICIENT;
    }).length;

    // Hard gate: no baseline, no history, or too few reliable observations =>
    // Insufficient Data (goal section 7 preference).
    if (!ctx.hasBaseline || ctx.baselineTotal === 0 || !ctx.latest || reliableCount < cfg.minReliableObservations) {
      return {
        level: Risk.INSUFFICIENT_DATA,
        signals: signals,
        reliableObservations: reliableCount,
        reason: 'not-enough-reliable-data',
      };
    }

    const latest = ctx.latest;
    const completionFraction = ctx.baselineTotal > 0
      ? latest.completed / ctx.baselineTotal
      : null;

    // Signal: unknown share undermines confidence. A very high unknown share can
    // itself force Insufficient Data.
    const unknownShare = ctx.baselineTotal > 0 ? latest.unknown / ctx.baselineTotal : 0;
    if (unknownShare >= cfg.unknownShareAtRiskFraction) {
      return {
        level: Risk.INSUFFICIENT_DATA,
        signals: [{ code: 'unknown-share-high', weight: 'blocking', value: round2(unknownShare * 100) }],
        reliableObservations: reliableCount,
        reason: 'too-many-unknown-items',
      };
    }
    if (unknownShare >= cfg.unknownShareAttentionFraction) {
      signals.push({ code: 'unknown-share', weight: 'attention', value: round2(unknownShare * 100) });
    }

    // Signal: late sprint with low completion (goal section 7).
    if (ctx.time.reliable && ctx.time.elapsedFraction != null &&
        ctx.time.elapsedFraction >= cfg.lateSprintElapsedFraction &&
        completionFraction != null && completionFraction < cfg.lateSprintMinCompletionFraction) {
      signals.push({
        code: 'late-sprint-low-completion',
        weight: 'at-risk',
        value: round2(completionFraction * 100),
      });
    }

    // Signal: observed completion lags the linear time reference (goal section
    // 7). Reported as a deviation, not as proof of delay.
    if (ctx.time.reliable && ctx.time.linearReferencePct != null && latest.baselineCompletionPct != null) {
      const behindPts = ctx.time.linearReferencePct - latest.baselineCompletionPct;
      if (behindPts >= cfg.behindReferenceAtRiskPts) {
        signals.push({ code: 'behind-reference', weight: 'at-risk', value: round2(behindPts) });
      } else if (behindPts >= cfg.behindReferenceAttentionPts) {
        signals.push({ code: 'behind-reference', weight: 'attention', value: round2(behindPts) });
      }
    }

    // Signal: high scope growth (goal section 7).
    if (ctx.baselineTotal > 0) {
      const growth = latest.added / ctx.baselineTotal;
      if (growth >= cfg.scopeGrowthAtRiskFraction) {
        signals.push({ code: 'scope-growth', weight: 'at-risk', value: round2(growth * 100) });
      } else if (growth >= cfg.scopeGrowthAttentionFraction) {
        signals.push({ code: 'scope-growth', weight: 'attention', value: round2(growth * 100) });
      }
    }

    // Signal: stagnant items across multiple reliable observations (goal
    // section 7).
    if (ctx.stagnation && ctx.stagnation.enoughData) {
      const n = ctx.stagnation.stagnantIds.length;
      if (n >= cfg.stagnationCountAtRisk) {
        signals.push({ code: 'stagnation', weight: 'at-risk', value: n });
      } else if (n >= cfg.stagnationCountAttention) {
        signals.push({ code: 'stagnation', weight: 'attention', value: n });
      }
    }

    // Aggregate the weighted signals into a verdict. An at-risk weight, or enough
    // attention signals, tips the verdict up. No signal => On Track.
    const atRiskSignals = signals.filter(function (s) { return s.weight === 'at-risk'; });
    const attentionSignals = signals.filter(function (s) { return s.weight === 'attention'; });

    let level = Risk.ON_TRACK;
    if (atRiskSignals.length >= 1 && (atRiskSignals.length + attentionSignals.length) >= cfg.atRiskSignalCount) {
      level = Risk.AT_RISK;
    } else if (atRiskSignals.length >= 1 || attentionSignals.length >= 1) {
      level = Risk.ATTENTION;
    }

    return {
      level: level,
      signals: signals,
      reliableObservations: reliableCount,
      reason: level === Risk.ON_TRACK ? 'no-adverse-signals' : 'heuristic-signals',
    };
  }

  return {
    Risk: Risk,
    Reliability: Reliability,
    DEFAULT_RISK_CONFIG: DEFAULT_RISK_CONFIG,
    computeTrends: computeTrends,
    // Exposed for targeted unit tests of the sub-computations.
    computeElapsedTime: computeElapsedTime,
    normalizeObservations: normalizeObservations,
  };
});
