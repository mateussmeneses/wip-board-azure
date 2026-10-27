// src/data/sprint-baseline.js
// Sprint Baseline + scope-change detection — pure engine (PRODUCT_ROADMAP T2.2,
// "Escopo inicial" + "Configuração do fluxo").
//
// Purpose
// -------
// The baseline is the set of work items PLANNED at the START of the sprint. Once
// recorded it must NOT change silently when cards move; it is the fixed
// reference the whole cycle is measured against. This module:
//
//   1. createBaseline(sprint, scopeItems, flowConfig, meta)
//        - freezes the planned ids + their start column/state into an immutable
//          baseline record (versioned, scope-tagged) ready for persistence.
//
//   2. detectScopeChanges(baseline, currentItems, flowConfig)
//        - classifies the CURRENT scope against the baseline:
//            planned      : in baseline AND still present
//            added        : present now but NOT in the baseline (scope growth)
//            removed       : in baseline but gone from current scope
//            completed     : present and currently in the configured END column
//            inProgress    : present, not in END, and past the configured START
//          Items are keyed by STABLE id; duplicates collapse; nothing is inferred
//          from card position.
//
// Flow configuration (goal section 4)
// ------------------------------------
// The team's flow is Approved -> intermediate columns -> Closed, but the start
// and end columns are CONFIGURABLE for other boards. Completion is decided by the
// configured END column (a visual board column), and the module NEVER confuses
// `System.State` with the board column: when `flowConfig.useState` is set it
// matches against the state field instead, but that is an explicit opt-in, not a
// silent fallback. A Feature/Epic parent is counted as a single scope item and
// is never treated as an independent delivery alongside its children unless
// `flowConfig.countFeatures` is explicitly true (goal section 4).
//
// This module is PURE: no DOM, no Chrome, no network. It never mutates inputs and
// never touches a work item in Azure DevOps.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardSprintBaseline.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSprintBaseline = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Bump when the baseline record shape changes; mirrors the snapshot store's
  // versioning discipline so persisted baselines can be migrated on read.
  const BASELINE_SCHEMA_VERSION = 1;

  // Default flow boundaries for the team's main board (goal section 4). Both are
  // overridable per board via flowConfig.
  const DEFAULT_FLOW = Object.freeze({
    startColumn: 'Approved',
    endColumn: 'Closed',
    // When true, match the END/START boundary against System.State instead of
    // the visual board column. Explicit opt-in; the goal forbids silently
    // treating a state named "Closed" as the board's Closed column.
    useState: false,
    // When true, Feature/Epic parents count as independent deliveries alongside
    // their children. Default false (goal section 4).
    countFeatures: false,
  });

  function normalizeColumnName(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function sameColumn(a, b) {
    const na = normalizeColumnName(a);
    const nb = normalizeColumnName(b);
    if (na === '' || nb === '') return false;
    return na === nb;
  }

  function isUsable(value) {
    if (value === undefined || value === null) return false;
    if (value && typeof value === 'object' && value.__wipFieldState === 'unavailable') return false;
    return true;
  }

  function resolveFlow(flowConfig) {
    const f = flowConfig && typeof flowConfig === 'object' ? flowConfig : {};
    return {
      startColumn: isUsable(f.startColumn) ? String(f.startColumn) : DEFAULT_FLOW.startColumn,
      endColumn: isUsable(f.endColumn) ? String(f.endColumn) : DEFAULT_FLOW.endColumn,
      useState: f.useState === true,
      countFeatures: f.countFeatures === true,
    };
  }

  // The field a flow boundary is matched against: the board column by default,
  // or System.State when the flow explicitly opts in.
  function boundaryValueOf(item, flow) {
    if (!item) return null;
    if (flow.useState) return isUsable(item.state) ? item.state : null;
    return isUsable(item.column) ? item.column : null;
  }

  // De-duplicate scope items by stable id (first occurrence wins) and keep only
  // the fields the baseline needs. Feature parents are excluded from the scope
  // unless the flow explicitly counts them (goal section 4), but they are always
  // reported under `featuresExcluded` so the exclusion is visible, never silent.
  function indexScopeItems(scopeItems, flow) {
    const seen = new Set();
    const byId = new Map();
    const featuresExcluded = [];

    (Array.isArray(scopeItems) ? scopeItems : []).forEach(function (raw) {
      if (!raw || raw.id == null) return;
      if (seen.has(raw.id)) return;
      seen.add(raw.id);
      if (raw.isFeature === true && !flow.countFeatures) {
        featuresExcluded.push(raw.id);
        return;
      }
      byId.set(raw.id, raw);
    });

    return { byId: byId, featuresExcluded: featuresExcluded };
  }

  // Create an immutable baseline record from the sprint + the planned scope. The
  // record stores, per planned id, the start column/state observed at planning
  // time, so later detection compares against a FIXED reference rather than the
  // moving board. `meta.capturedAt` (epoch ms or Date) stamps when the baseline
  // was frozen.
  function createBaseline(sprint, scopeItems, flowConfig, meta) {
    const flow = resolveFlow(flowConfig);
    const indexed = indexScopeItems(scopeItems, flow);
    const m = meta && typeof meta === 'object' ? meta : {};

    const plannedItems = [];
    indexed.byId.forEach(function (item, id) {
      plannedItems.push({
        id: id,
        type: isUsable(item.type) ? String(item.type) : null,
        startColumn: isUsable(item.column) ? String(item.column) : null,
        startState: isUsable(item.state) ? String(item.state) : null,
        parentId: isUsable(item.parentId) ? item.parentId : null,
        isFeature: item.isFeature === true,
      });
    });

    const capturedAtMs = resolveEpoch(m.capturedAt);

    const record = {
      schemaVersion: BASELINE_SCHEMA_VERSION,
      kind: 'sprint-baseline',
      sprintId: sprint && sprint.id != null ? sprint.id : null,
      iterationPath: sprint && isUsable(sprint.iterationPath) ? String(sprint.iterationPath) : null,
      flow: { startColumn: flow.startColumn, endColumn: flow.endColumn, useState: flow.useState, countFeatures: flow.countFeatures },
      capturedAt: capturedAtMs != null ? { epochMs: capturedAtMs, iso: new Date(capturedAtMs).toISOString() } : null,
      plannedIds: plannedItems.map(function (p) { return p.id; }),
      plannedItems: plannedItems,
      featuresExcluded: indexed.featuresExcluded,
      // source of the planning data ('api' | 'dom' | 'manual'), when known.
      source: isUsable(m.source) ? String(m.source) : null,
    };

    return deepFreeze(record);
  }

  // Classify the CURRENT scope against a frozen baseline. The baseline's own flow
  // is used by default (so the measurement is consistent for the sprint); an
  // explicit flowConfig override is honored when supplied (e.g. the user changed
  // the end column mid-sprint).
  //
  // Returns id arrays per category plus a counts summary. Categories are derived
  // only from stable ids and the configured boundaries; card movement changes the
  // classification but NEVER the baseline (goal: "a linha de base não pode mudar
  // silenciosamente").
  function detectScopeChanges(baseline, currentItems, flowConfig) {
    const base = baseline && typeof baseline === 'object' ? baseline : {};
    const flow = resolveFlow(flowConfig || base.flow);

    const plannedSet = new Set(Array.isArray(base.plannedIds) ? base.plannedIds : []);

    const indexed = indexScopeItems(currentItems, flow);
    const currentById = indexed.byId;

    const planned = []; // in baseline AND still present
    const added = []; // present now, not in baseline
    const removed = []; // in baseline, absent now
    const completed = []; // present AND in END boundary
    const inProgress = []; // present, not END, at/after START boundary

    // Walk the current scope.
    currentById.forEach(function (item, id) {
      const inBaseline = plannedSet.has(id);
      if (inBaseline) {
        planned.push(id);
      } else {
        added.push(id);
      }

      const boundary = boundaryValueOf(item, flow);
      if (sameColumn(boundary, flow.endColumn)) {
        completed.push(id);
      } else if (boundary != null) {
        // Anything present and not completed is in progress (it is at least at
        // the start boundary by virtue of being in the sprint scope). We do not
        // guess a position beyond "not yet in the end column".
        inProgress.push(id);
      } else {
        // No resolvable boundary value: still in progress but flagged indirectly
        // (it is present but its column/state was unavailable).
        inProgress.push(id);
      }
    });

    // Removed: in baseline but no longer in the current scope.
    plannedSet.forEach(function (id) {
      if (!currentById.has(id)) removed.push(id);
    });

    const summary = {
      plannedBaselineCount: plannedSet.size,
      plannedCount: planned.length,
      addedCount: added.length,
      removedCount: removed.length,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      currentCount: currentById.size,
      // scope growth is the signed delta between current and baseline sizes.
      scopeDelta: currentById.size - plannedSet.size,
    };

    return {
      flow: flow,
      planned: planned,
      added: added,
      removed: removed,
      completed: completed,
      inProgress: inProgress,
      featuresExcluded: indexed.featuresExcluded,
      summary: summary,
    };
  }

  function resolveEpoch(value) {
    if (value == null) return null;
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.keys(obj).forEach(function (key) {
        deepFreeze(obj[key]);
      });
      Object.freeze(obj);
    }
    return obj;
  }

  return {
    BASELINE_SCHEMA_VERSION: BASELINE_SCHEMA_VERSION,
    DEFAULT_FLOW: DEFAULT_FLOW,
    normalizeColumnName: normalizeColumnName,
    sameColumn: sameColumn,
    resolveFlow: resolveFlow,
    createBaseline: createBaseline,
    detectScopeChanges: detectScopeChanges,
  };
});
