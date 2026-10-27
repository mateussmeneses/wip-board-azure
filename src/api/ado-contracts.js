// src/api/ado-contracts.js
// Normalized data contracts for the Azure DevOps client (T2.1).
//
// Purpose
// -------
// Convert the raw, verbose Azure DevOps REST payloads into small, stable,
// documented shapes the feature layer can depend on without knowing the REST
// JSON. All normalization is PURE (no network, no Chrome) so every edge case is
// unit-testable with fixtures.
//
// Contracts defined here:
//   - Scope          : { organization, project, team, board, organizationUrl? }
//   - Iteration      : { id, name, path, startDate, finishDate, timeframe, ... }
//   - BoardColumn    : { id, name, order, columnType, stateMappings, isDone... }
//   - WorkItem       : { id, title, type, state, iterationPath, areaPath,
//                        boardColumn, storyPoints, parentId, ... }
//   - ApiCapability  : what the client can/cannot do right now (proven vs mock)
//
// Critical correctness rules the goal calls out:
//   1. `System.State` (the work item state) is DISTINCT from the visual board
//      column (`System.BoardColumn`/`WEF_*`). They are stored in SEPARATE fields;
//      a state named "Closed" is NEVER assumed to be the board's "Closed" column.
//   2. Fields that the API did not return are preserved as UNAVAILABLE (a frozen
//      sentinel), never as null/0/"" which would masquerade as a real value.
//
// Dual environment support:
// - Node test runner: module.exports (CommonJS).
// - Chrome runtime: attaches to window.WIPBoardAdoContracts.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoContracts = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // A frozen sentinel meaning "the API did not provide this field". Distinct
  // from null (present-but-empty) and from a real value. The snapshot store
  // already recognizes this exact shape (`__wipFieldState === 'unavailable'`),
  // so an API-sourced item degrades identically to a DOM-sourced one.
  const UNAVAILABLE = Object.freeze({ __wipFieldState: 'unavailable' });

  function isUnavailable(value) {
    return value === UNAVAILABLE ||
      (value && typeof value === 'object' && value.__wipFieldState === 'unavailable');
  }

  // Well-known ADO field reference names. Centralized so a typo is caught once.
  const Fields = Object.freeze({
    TITLE: 'System.Title',
    TYPE: 'System.WorkItemType',
    STATE: 'System.State',
    ITERATION_PATH: 'System.IterationPath',
    AREA_PATH: 'System.AreaPath',
    TAGS: 'System.Tags',
    PARENT: 'System.Parent',
    // Story points vary by process template; the common ones are tried in order.
    STORY_POINTS: 'Microsoft.VSTS.Scheduling.StoryPoints',
    EFFORT: 'Microsoft.VSTS.Scheduling.Effort',
  });

  // The minimal field set a board view needs. BoardColumn is a WEF_* dynamic
  // field (resolved per board), so it is not listed by a fixed name here; it is
  // extracted by pattern in normalizeWorkItem.
  const DEFAULT_WORKITEM_FIELDS = Object.freeze([
    Fields.TITLE,
    Fields.TYPE,
    Fields.STATE,
    Fields.ITERATION_PATH,
    Fields.AREA_PATH,
    Fields.TAGS,
    Fields.PARENT,
    Fields.STORY_POINTS,
    Fields.EFFORT,
  ]);

  function pick(fields, name) {
    if (!fields || typeof fields !== 'object') return UNAVAILABLE;
    if (!(name in fields)) return UNAVAILABLE;
    const value = fields[name];
    return value === undefined ? UNAVAILABLE : value;
  }

  // Extract the board column from the dynamic WEF_* field group. ADO stores the
  // current board column under a field whose name matches
  //   System.BoardColumn   (classic) OR
  //   WEF_<guid>_Kanban.Column (per-board dynamic field).
  // We return BOTH the value and whether it was actually present, so the caller
  // never confuses "no board column data" with an empty string. Crucially, this
  // is kept SEPARATE from System.State.
  function extractBoardColumn(fields) {
    if (!fields || typeof fields !== 'object') {
      return { boardColumn: UNAVAILABLE, boardColumnDone: UNAVAILABLE };
    }
    if (typeof fields['System.BoardColumn'] === 'string') {
      return {
        boardColumn: fields['System.BoardColumn'],
        boardColumnDone: typeof fields['System.BoardColumnDone'] === 'boolean'
          ? fields['System.BoardColumnDone']
          : UNAVAILABLE,
      };
    }
    let columnValue = UNAVAILABLE;
    let doneValue = UNAVAILABLE;
    Object.keys(fields).forEach(function (key) {
      // WEF_<guid>_Kanban.Column and WEF_<guid>_Kanban.Column.Done
      if (/_Kanban\.Column$/.test(key) && typeof fields[key] === 'string') {
        columnValue = fields[key];
      } else if (/_Kanban\.Column\.Done$/.test(key) && typeof fields[key] === 'boolean') {
        doneValue = fields[key];
      }
    });
    return { boardColumn: columnValue, boardColumnDone: doneValue };
  }

  // Normalize a single work item from the REST `workitems`/`workitemsbatch`
  // response. `raw` is { id, fields, relations?, url }.
  function normalizeWorkItem(raw) {
    if (!raw || typeof raw !== 'object' || raw.id == null) return null;
    const fields = raw.fields || {};
    const boardInfo = extractBoardColumn(fields);
    // Story points: prefer StoryPoints, fall back to Effort; keep UNAVAILABLE
    // when neither is present (never coerce to 0).
    let estimate = pick(fields, Fields.STORY_POINTS);
    if (isUnavailable(estimate)) estimate = pick(fields, Fields.EFFORT);

    const parentFromField = pick(fields, Fields.PARENT);
    const parentFromRelations = extractParentId(raw.relations);
    const parentId = !isUnavailable(parentFromField)
      ? parentFromField
      : parentFromRelations;

    return {
      id: raw.id,
      title: pick(fields, Fields.TITLE),
      type: pick(fields, Fields.TYPE),
      // System.State is the lifecycle state. It is deliberately NOT the board
      // column; the two are separate fields (correctness rule 1).
      state: pick(fields, Fields.STATE),
      iterationPath: pick(fields, Fields.ITERATION_PATH),
      areaPath: pick(fields, Fields.AREA_PATH),
      // The visual board column, when the board exposed it. May be UNAVAILABLE.
      boardColumn: boardInfo.boardColumn,
      boardColumnDone: boardInfo.boardColumnDone,
      tags: normalizeTags(pick(fields, Fields.TAGS)),
      storyPoints: estimate,
      parentId: parentId,
      // Hierarchy data is preserved only when present.
      relations: normalizeRelations(raw.relations),
    };
  }

  function normalizeTags(rawTags) {
    if (isUnavailable(rawTags)) return UNAVAILABLE;
    if (typeof rawTags !== 'string' || rawTags.trim() === '') return [];
    // ADO serializes tags as "a; b; c".
    return rawTags.split(';').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  // Keep only the hierarchy-relevant relations (parent/child links), as
  // {{ rel, id }}. Other relation kinds are dropped to avoid storing noise.
  function normalizeRelations(relations) {
    if (!Array.isArray(relations)) return UNAVAILABLE;
    const out = [];
    relations.forEach(function (rel) {
      if (!rel || typeof rel !== 'object' || typeof rel.url !== 'string') return;
      const idMatch = rel.url.match(/workItems\/(\d+)(?:$|\/)/i);
      if (!idMatch) return;
      out.push({ rel: rel.rel || null, id: Number(idMatch[1]) });
    });
    return out;
  }

  function extractParentId(relations) {
    if (!Array.isArray(relations)) return UNAVAILABLE;
    for (let i = 0; i < relations.length; i += 1) {
      const rel = relations[i];
      if (rel && rel.rel === 'System.LinkTypes.Hierarchy-Reverse' && typeof rel.url === 'string') {
        const m = rel.url.match(/workItems\/(\d+)(?:$|\/)/i);
        if (m) return Number(m[1]);
      }
    }
    return UNAVAILABLE;
  }

  // Normalize an iteration from the teamsettings/iterations response. Dates may
  // be absent for a future/undefined sprint; preserve them as UNAVAILABLE rather
  // than inventing a range.
  function normalizeIteration(raw) {
    if (!raw || typeof raw !== 'object' || raw.id == null) return null;
    const attrs = raw.attributes || {};
    return {
      id: raw.id,
      name: typeof raw.name === 'string' ? raw.name : UNAVAILABLE,
      path: typeof raw.path === 'string' ? raw.path : UNAVAILABLE,
      startDate: attrs.startDate != null ? attrs.startDate : UNAVAILABLE,
      finishDate: attrs.finishDate != null ? attrs.finishDate : UNAVAILABLE,
      // timeFrame is 'past' | 'current' | 'future' when provided.
      timeframe: typeof attrs.timeFrame === 'string' ? attrs.timeFrame : UNAVAILABLE,
    };
  }

  function normalizeIterations(payload) {
    const list = payload && Array.isArray(payload.value) ? payload.value : [];
    return list.map(normalizeIteration).filter(Boolean);
  }

  // Select the "current" iteration. Prefer the server's timeframe === 'current';
  // when no iteration is flagged current (team with no active sprint), return
  // null — never guess by date (goal resilience: "time sem sprint atual").
  function selectCurrentIteration(iterations) {
    const list = Array.isArray(iterations) ? iterations : [];
    const current = list.filter(function (it) { return it.timeframe === 'current'; });
    return current.length ? current[0] : null;
  }

  // Normalize the iteration work items response. The payload nests ids under
  // `workItemRelations[].target.id`; relations may repeat ids. We DEDUPE by id
  // and preserve order of first appearance (correctness: duplicate references).
  function normalizeIterationWorkItemIds(payload) {
    const relations = payload && Array.isArray(payload.workItemRelations)
      ? payload.workItemRelations
      : [];
    const seen = new Set();
    const ids = [];
    relations.forEach(function (rel) {
      const target = rel && rel.target;
      if (!target || target.id == null) return;
      const id = target.id;
      if (seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });
    return ids;
  }

  // Normalize board columns. Preserve order, name and the state->column mappings
  // when present. `columnType` ('incoming'|'inProgress'|'outgoing') flags the
  // terminal (done/outgoing) column WITHOUT assuming a name.
  function normalizeBoardColumns(payload) {
    const list = payload && Array.isArray(payload.value) ? payload.value : [];
    return list.map(function (raw, index) {
      if (!raw || typeof raw !== 'object') return null;
      return {
        id: raw.id != null ? raw.id : UNAVAILABLE,
        name: typeof raw.name === 'string' ? raw.name : UNAVAILABLE,
        order: index, // response order is the flow order
        columnType: typeof raw.columnType === 'string' ? raw.columnType : UNAVAILABLE,
        isDoneColumn: raw.columnType === 'outgoing',
        // stateMappings maps a work item type to the System.State that this
        // COLUMN represents — the explicit bridge the goal wants kept distinct
        // from the state itself. Preserved verbatim when present.
        stateMappings: raw.stateMappings && typeof raw.stateMappings === 'object'
          ? Object.assign({}, raw.stateMappings)
          : UNAVAILABLE,
        itemLimit: typeof raw.itemLimit === 'number' ? raw.itemLimit : UNAVAILABLE,
      };
    }).filter(Boolean);
  }

  // Describe what the client has actually proven vs what is only mocked. Used by
  // the docs/diagnostics so we never claim a capability we have not exercised
  // against a live tenant (goal section 9).
  function buildCapability(input) {
    const i = input || {};
    return Object.freeze({
      featureFlagEnabled: i.featureFlagEnabled === true,
      authStrategy: i.authStrategy || null,
      authAvailable: i.authAvailable === true,
      // "proven" means verified against a real tenant; default false until a
      // signed-in spike is recorded. Tests only prove the OFFLINE/mocked path.
      liveAccessProven: i.liveAccessProven === true,
      endpointsImplemented: Array.isArray(i.endpointsImplemented) ? i.endpointsImplemented.slice() : [],
      notes: typeof i.notes === 'string' ? i.notes : '',
    });
  }

  return {
    UNAVAILABLE: UNAVAILABLE,
    isUnavailable: isUnavailable,
    Fields: Fields,
    DEFAULT_WORKITEM_FIELDS: DEFAULT_WORKITEM_FIELDS,
    // work items
    normalizeWorkItem: normalizeWorkItem,
    extractBoardColumn: extractBoardColumn,
    normalizeTags: normalizeTags,
    normalizeRelations: normalizeRelations,
    extractParentId: extractParentId,
    // iterations
    normalizeIteration: normalizeIteration,
    normalizeIterations: normalizeIterations,
    selectCurrentIteration: selectCurrentIteration,
    normalizeIterationWorkItemIds: normalizeIterationWorkItemIds,
    // columns
    normalizeBoardColumns: normalizeBoardColumns,
    // capability
    buildCapability: buildCapability,
  };
});
