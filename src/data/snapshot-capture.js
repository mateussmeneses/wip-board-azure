// src/data/snapshot-capture.js
// Daily Snapshot Capture: the pure bridge between the board reader's normalized
// model (src/data/board-dom-reader.js) and the persistence layer
// (src/data/snapshot-store.js). Roadmap T1.2.
//
// Purpose
// -------
// Given a board model (the output of WIPBoardReader.readBoard) plus the board
// scope and a capture timestamp, this module produces a snapshot-store-ready
// input and a completeness verdict. It is deliberately Chrome-free and DOM-free:
// the caller reads the DOM and persists; this module only transforms and judges.
// That keeps every capture rule unit-testable without a browser (same discipline
// as diffStates in snapshot-store.js).
//
// What it guarantees for T1.2:
// - Captures ALL relevant columns, not only the WIP-configured ones. The WIP
//   configuration is a presentation concern and is not applied here.
// - Identifies Approved / Closed (and any terminal/done column) WITHOUT
//   hardcoded names: the done flag comes from the reader's `isDoneColumn`
//   (Azure's own `data-done` attribute) and an optional configurable keyword
//   list the caller may pass for the "start of flow" (Approved-like) role.
// - Preserves stable ids, columns and available metadata; UNAVAILABLE reader
//   sentinels are dropped so a missing field is never confused with a value.
// - Treats cards that are present-but-hidden (filters/paging) or an empty board
//   as a potentially INCOMPLETE capture rather than a definitive "all items".
//   The verdict is surfaced to the caller; nothing is silently dropped.
// - Never mutates the board model or any work item. It is read-only.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardSnapshotCapture.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardSnapshotCapture = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The reader marks fields it cannot read with this frozen sentinel. We mirror
  // the check here (without importing the reader) so this module stays standalone
  // and testable with plain objects.
  function isUnavailable(value) {
    return !!(value && typeof value === 'object' && value.__wipFieldState === 'unavailable');
  }

  function isUsable(value) {
    return value !== undefined && !isUnavailable(value);
  }

  // Reasons a capture may be incomplete. Reported, never acted on silently.
  const IncompleteReasons = Object.freeze({
    EMPTY_BOARD: 'EMPTY_BOARD',
    HIDDEN_ITEMS: 'HIDDEN_ITEMS',
    NO_COLUMNS: 'NO_COLUMNS',
    DUPLICATE_IDS: 'DUPLICATE_IDS',
    MISSING_IDS: 'MISSING_IDS',
    HEADER_COUNT_MISMATCH: 'HEADER_COUNT_MISMATCH',
    COLUMN_ALIGNMENT_UNKNOWN: 'COLUMN_ALIGNMENT_UNKNOWN',
    HEADER_COUNT_UNAVAILABLE: 'HEADER_COUNT_UNAVAILABLE',
  });

  // ---------------------------------------------------------------------------
  // Column role classification. Done/terminal columns come from the board itself
  // (reader.isDoneColumn === Azure data-done), never from a hardcoded name list.
  // The "approved" (start-of-flow) role is optional and driven by a caller-
  // supplied keyword list, defaulting to none so there is no built-in English
  // assumption baked in.
  // ---------------------------------------------------------------------------

  function normalizeKeyword(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function classifyColumnRole(column, options) {
    const opts = options || {};
    const approvedKeywords = (opts.approvedColumnKeywords || []).map(normalizeKeyword).filter(Boolean);
    const name = normalizeKeyword(column && column.name);

    // Terminal/done comes straight from the board's own flag.
    if (column && column.isDoneColumn === true) return 'closed';

    // Start-of-flow ("approved"-like) is only assigned when the caller opted in
    // with keywords, keeping the default behavior free of hardcoded names.
    if (name && approvedKeywords.some(function (k) { return name.indexOf(k) !== -1; })) {
      return 'approved';
    }

    return 'flow';
  }

  // ---------------------------------------------------------------------------
  // Item normalization. Only stable, non-sensitive fields pass through; the
  // persistence layer normalizes again, but doing it here keeps the capture
  // payload honest and the per-column counts accurate.
  // ---------------------------------------------------------------------------

  function normalizeItem(rawItem) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    if (rawItem.id == null) return null; // only stable ids are captured
    const item = { id: rawItem.id };
    if (isUsable(rawItem.column)) item.column = rawItem.column;
    if (isUsable(rawItem.columnId)) item.columnId = rawItem.columnId;
    if (isUsable(rawItem.state)) item.state = rawItem.state;
    if (isUsable(rawItem.assignee)) item.assignee = rawItem.assignee;
    if (isUsable(rawItem.type)) item.type = rawItem.type;
    return item;
  }

  // ---------------------------------------------------------------------------
  // Build the capture. Returns:
  //   {
  //     scope, capturedAt (Date passthrough), sprint,
  //     columns: [{ id, name, order, role, isDoneColumn, count }],
  //     items: [{ id, column, columnId, state, assignee, type }],
  //     counts: { columns, items, visible, hidden, duplicates },
  //     complete: boolean,
  //     incompleteReasons: string[],
  //     storeInput: { ...ready for WIPBoardSnapshotStore.createSnapshot }
  //   }
  //
  // `model` is the WIPBoardReader.readBoard() output. `scope` is
  // { organization, project, team, board }. Options:
  //   - approvedColumnKeywords?: string[]  (role hints, no hardcoded default)
  //   - capturedAt?: Date
  //   - sprint?: string | null
  //   - source?: { origin?: string }
  // ---------------------------------------------------------------------------

  function buildCapture(model, scope, options) {
    const opts = options || {};
    const safeModel = model && typeof model === 'object' ? model : { columns: [], items: [] };
    const rawColumns = Array.isArray(safeModel.columns) ? safeModel.columns : [];
    const rawItems = Array.isArray(safeModel.items) ? safeModel.items : [];

    // Only VISIBLE items are part of the observed state. Hidden items (filters,
    // paging) are counted separately and feed the completeness verdict; they are
    // NOT persisted as present so a filtered-out card is never recorded as if it
    // were on the board right now.
    const visibleRaw = rawItems.filter(function (i) { return i && i.isVisible === true; });
    const hiddenCount = rawItems.length - visibleRaw.length;

    // De-duplicate by id within the capture (swimlane repeats). Duplicates are
    // tallied for the verdict; only the first occurrence is persisted.
    const items = [];
    const seen = new Set();
    let duplicateCount = 0;
    let missingIdCount = 0;

    visibleRaw.forEach(function (raw) {
      const normalized = normalizeItem(raw);
      if (!normalized) {
        missingIdCount += 1;
        return;
      }
      if (seen.has(normalized.id)) {
        duplicateCount += 1;
        return;
      }
      seen.add(normalized.id);
      items.push(normalized);
    });

    // Per-column view across ALL columns (not just WIP-configured ones), with a
    // role label and a visible-item count keyed by stable column id when present.
    const columns = rawColumns.map(function (column, index) {
      const colId = isUsable(column.id) ? column.id : null;
      const colName = isUsable(column.name) ? column.name : null;
      const count = items.filter(function (it) {
        if (colId != null && it.columnId != null) return it.columnId === colId;
        return colName != null && it.column === colName;
      }).length;

      return {
        id: colId,
        name: colName,
        order: typeof column.order === 'number' ? column.order : index,
        role: classifyColumnRole(column, opts),
        isDoneColumn: column.isDoneColumn === true,
        count: count,
        reportedCount: typeof column.reportedCount === 'number' &&
          Number.isFinite(column.reportedCount) ? column.reportedCount : null,
      };
    });

    // Completeness verdict. Any of these makes the capture "incomplete"; the
    // caller decides whether to warn / require confirmation, but the capture is
    // never silently marked complete when evidence says otherwise.
    const incompleteReasons = [];
    if (columns.length === 0) incompleteReasons.push(IncompleteReasons.NO_COLUMNS);
    if (items.length === 0) incompleteReasons.push(IncompleteReasons.EMPTY_BOARD);
    if (hiddenCount > 0) incompleteReasons.push(IncompleteReasons.HIDDEN_ITEMS);
    if (duplicateCount > 0) incompleteReasons.push(IncompleteReasons.DUPLICATE_IDS);
    if (missingIdCount > 0) incompleteReasons.push(IncompleteReasons.MISSING_IDS);
    // Azure's header count can exceed DOM-present cards because of filtering,
    // virtualization or paging. Never silently present a smaller observed count
    // as the complete board total.
    if (columns.some(function (c) {
      return c.reportedCount != null && c.reportedCount !== c.count;
    })) incompleteReasons.push(IncompleteReasons.HEADER_COUNT_MISMATCH);
    if (safeModel.diagnostics && columns.some(function (c) {
      return c.reportedCount == null;
    })) incompleteReasons.push(IncompleteReasons.HEADER_COUNT_UNAVAILABLE);
    if (safeModel.diagnostics &&
        safeModel.diagnostics.columnAlignmentReliable === false) {
      incompleteReasons.push(IncompleteReasons.COLUMN_ALIGNMENT_UNKNOWN);
    }

    const complete = incompleteReasons.length === 0;

    const capturedAt = opts.capturedAt instanceof Date ? opts.capturedAt : new Date();
    const sprint = opts.sprint != null ? opts.sprint : null;
    const origin = opts.source && opts.source.origin ? opts.source.origin : 'dom-reader';

    const capture = {
      scope: scope,
      capturedAt: capturedAt,
      sprint: sprint,
      columns: columns,
      items: items,
      counts: {
        columns: columns.length,
        items: items.length,
        visible: visibleRaw.length,
        hidden: hiddenCount,
        duplicates: duplicateCount,
      },
      complete: complete,
      incompleteReasons: incompleteReasons,
    };

    // storeInput is exactly what WIPBoardSnapshotStore.createSnapshot expects.
    // `complete` carries the honest verdict so an incomplete capture is stored as
    // such (never silently as complete), satisfying the reliability requirement.
    capture.storeInput = {
      scope: scope,
      items: items,
      capturedAt: capturedAt,
      sprint: sprint,
      complete: complete,
      source: { origin: origin },
      // Column structure travels alongside so history can show counts per column
      // without re-deriving from the item list.
      columns: columns,
    };

    return capture;
  }

  return {
    buildCapture: buildCapture,
    classifyColumnRole: classifyColumnRole,
    IncompleteReasons: IncompleteReasons,
  };
});
