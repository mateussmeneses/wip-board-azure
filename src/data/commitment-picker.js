// src/data/commitment-picker.js
// Daily Commitment Card Picker: the pure view-model behind the VISUAL work-item
// selection UI that replaces the manual "id: column" textarea. Roadmap T1.4.
//
// Purpose
// -------
// The commitment engine (src/data/daily-commitment.js, T1.3) already turns a set
// of { id -> expectedColumn } expectations into persistable commitment items and
// compares plan vs actual. What it does NOT do is decide WHICH work items the
// user can pick, what to show for each (title, current column, assignee), which
// destination columns are selectable, or how a free-text search narrows the list.
// That presentation logic lives here, kept as a pure function of its inputs so it
// is fully unit-testable without a browser (same discipline as snapshot-capture
// and daily-commitment).
//
// This module does NOT reimplement the snapshot store, the commitment engine, or
// the comparison rules. It only SHAPES data for the picker UI and then converts
// the user's selection back into the exact expectations map
// (WIPBoardDailyCommitment.buildCommitmentItems consumes it unchanged).
//
// Data sources merged per work item (by stable id):
//   - baseSnapshot : the authoritative set of items available to commit and the
//                    startColumn (the column AT PLANNING TIME). Items absent from
//                    the base snapshot are never offered (a commitment is based on
//                    a captured state). This honors the "snapshot base" rule.
//   - liveModel    : the CURRENT board model (WIPBoardReader output). Supplies the
//                    human-facing title and the current column/assignee for
//                    display only. Never used to invent new committable ids.
//   - existingCommitment : an already-saved commitment (latest revision). Used to
//                    pre-select rows and pre-fill the chosen destination so the
//                    user can CONSULT and EDIT an existing plan.
//
// Reliability: an item present in the base snapshot but absent from the live
// board is still offered (so a planned-but-vanished item can be reviewed), and it
// is flagged `onBoard: false` rather than dropped. Nothing here assumes a missing
// item was completed (shared reliability rule with the store's diffStates).
//
// Isolation / safety: this module reads plain objects only. It never touches the
// DOM, never calls the extension storage APIs, never mutates a work item, and
// never mutates its inputs. The caller resolves base/live/commitment from the
// SAME board scope, so boards and days never mix here.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardCommitmentPicker.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardCommitmentPicker = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The reader marks unreadable fields with this frozen sentinel. Mirror the
  // check locally so this module stays standalone and testable with plain objects.
  function isUnavailable(value) {
    return !!(value && typeof value === 'object' && value.__wipFieldState === 'unavailable');
  }

  function isUsable(value) {
    return value !== undefined && value !== null && !isUnavailable(value);
  }

  function asText(value) {
    return isUsable(value) ? String(value) : null;
  }

  function normalizeSearch(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Destination column options. The dropdown must reflect the board's REAL
  // columns (requirement: load columns dynamically), in flow order, de-duplicated
  // by display name. Source priority: the live board model's columns, then the
  // base snapshot's columns (so the picker still works offline from a capture).
  // Returns [{ id, name, order, isDoneColumn }] sorted by order.
  // ---------------------------------------------------------------------------

  function buildColumnOptions(liveModel, baseSnapshot) {
    const fromLive = columnsOf(liveModel);
    const source = fromLive.length ? fromLive : columnsOf(baseSnapshot);

    const out = [];
    const seen = new Set();
    source.forEach(function (col, index) {
      if (!col || typeof col !== 'object') return;
      const name = asText(col.name);
      if (name == null || name.trim() === '') return;
      const key = normalizeSearch(name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        id: isUsable(col.id) ? col.id : null,
        name: name,
        order: typeof col.order === 'number' ? col.order : index,
        isDoneColumn: col.isDoneColumn === true,
      });
    });
    out.sort(function (a, b) {
      return a.order - b.order;
    });
    return out;
  }

  function columnsOf(source) {
    return source && Array.isArray(source.columns) ? source.columns : [];
  }

  function itemsOf(source) {
    return source && Array.isArray(source.items) ? source.items : [];
  }

  // ---------------------------------------------------------------------------
  // Build the picker rows. One row per committable work item (ids come from the
  // base snapshot — the authoritative committable set). Each row carries:
  //   {
  //     id,
  //     title,            // from the live board, null when unknown
  //     startColumn,      // column at planning time (base snapshot)
  //     currentColumn,    // column on the live board now, null when off board
  //     assignee,         // from base snapshot, else live board, else null
  //     onBoard,          // present on the live board right now
  //     selected,         // pre-selected because an existing commitment has it
  //     expectedColumn,   // pre-filled destination from the existing commitment
  //   }
  // Rows are stable-sorted by current/started column order then by id so the list
  // reads top-to-bottom along the flow, matching the board.
  // ---------------------------------------------------------------------------

  function buildPickerRows(baseSnapshot, liveModel, existingCommitment) {
    const baseItems = itemsOf(baseSnapshot);

    const liveById = indexById(itemsOf(liveModel));
    const committedById = indexById(itemsOf(existingCommitment));

    // Column order index (by normalized name) for sorting rows along the flow.
    const options = buildColumnOptions(liveModel, baseSnapshot);
    const orderByName = new Map();
    options.forEach(function (opt) {
      orderByName.set(normalizeSearch(opt.name), opt.order);
    });

    const rows = [];
    const seen = new Set();

    baseItems.forEach(function (baseItem) {
      if (!baseItem || baseItem.id == null) return;
      if (seen.has(baseItem.id)) return; // de-duplicate (swimlane repeats)
      seen.add(baseItem.id);

      const live = liveById.get(baseItem.id) || null;
      const committed = committedById.get(baseItem.id) || null;

      const startColumn = asText(baseItem.column);
      const currentColumn = live ? asText(live.column) : null;

      rows.push({
        id: baseItem.id,
        title: live ? asText(live.title) : null,
        startColumn: startColumn,
        currentColumn: currentColumn,
        assignee: asText(baseItem.assignee) || (live ? asText(live.assignee) : null),
        onBoard: !!live,
        selected: !!committed,
        expectedColumn: committed ? asText(committed.expectedColumn) : null,
      });
    });

    rows.sort(function (a, b) {
      const oa = columnOrderOf(orderByName, a);
      const ob = columnOrderOf(orderByName, b);
      if (oa !== ob) return oa - ob;
      return compareIds(a.id, b.id);
    });

    return rows;
  }

  function columnOrderOf(orderByName, row) {
    // Sort by where the item sits now, falling back to where it started. Unknown
    // columns go last so the known flow reads first.
    const name = row.currentColumn != null ? row.currentColumn : row.startColumn;
    const key = normalizeSearch(name);
    return orderByName.has(key) ? orderByName.get(key) : Number.MAX_SAFE_INTEGER;
  }

  function compareIds(a, b) {
    const na = typeof a === 'number' ? a : Number(a);
    const nb = typeof b === 'number' ? b : Number(b);
    const aNum = !Number.isNaN(na);
    const bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    return String(a).localeCompare(String(b));
  }

  function indexById(items) {
    const map = new Map();
    (items || []).forEach(function (item) {
      if (item && item.id != null && !map.has(item.id)) map.set(item.id, item);
    });
    return map;
  }

  // ---------------------------------------------------------------------------
  // Search filter. Narrows the rows by a free-text query matched against the id
  // or the title (accent/case-insensitive). An empty query returns all rows. The
  // input array is never mutated.
  // ---------------------------------------------------------------------------

  function filterRows(rows, query) {
    const list = Array.isArray(rows) ? rows : [];
    const q = normalizeSearch(query);
    if (q === '') return list.slice();
    return list.filter(function (row) {
      if (!row) return false;
      const idText = normalizeSearch(row.id);
      const titleText = normalizeSearch(row.title);
      return idText.indexOf(q) !== -1 || titleText.indexOf(q) !== -1;
    });
  }

  // ---------------------------------------------------------------------------
  // Build the expectations map from the user's selection. `selections` is an
  // array (or Map/object) describing the per-card choice:
  //   array  : [{ id, expectedColumn }]
  //   object : { id: expectedColumn }
  //   Map    : Map(id -> expectedColumn)
  //
  // Returns:
  //   {
  //     expectations : { id -> expectedColumn }  (for buildCommitmentItems)
  //     count        : number of valid selections
  //     invalid      : [{ id, reason }]          (selected without a destination,
  //                                                or duplicate id)
  //   }
  //
  // A selection WITHOUT a chosen destination column is reported as invalid rather
  // than silently committed (the destination must be chosen explicitly — business
  // rule). Duplicate ids are collapsed to the first and reported, so the same work
  // item can never appear twice in one commitment.
  // ---------------------------------------------------------------------------

  function buildExpectationsFromSelection(selections) {
    const entries = toSelectionEntries(selections);
    const expectations = {};
    const invalid = [];
    const seen = new Set();
    let count = 0;

    entries.forEach(function (entry) {
      if (!entry || entry.id == null) return;
      const expected = asText(entry.expectedColumn);
      if (expected == null || expected.trim() === '') {
        invalid.push({ id: entry.id, reason: 'no-destination' });
        return;
      }
      if (seen.has(entry.id)) {
        invalid.push({ id: entry.id, reason: 'duplicate' });
        return;
      }
      seen.add(entry.id);
      expectations[entry.id] = expected;
      count += 1;
    });

    return { expectations: expectations, count: count, invalid: invalid };
  }

  function toSelectionEntries(selections) {
    if (!selections) return [];
    if (selections instanceof Map) {
      const out = [];
      selections.forEach(function (value, key) {
        out.push({ id: key, expectedColumn: value });
      });
      return out;
    }
    if (Array.isArray(selections)) {
      return selections.filter(function (e) {
        return e && typeof e === 'object';
      });
    }
    if (typeof selections === 'object') {
      return Object.keys(selections).map(function (key) {
        return { id: key, expectedColumn: selections[key] };
      });
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // Selection summary for the "resumo do planejamento" line. Pure count over the
  // picker rows (or an explicit selection), kept here so the UI and the tests
  // share one source of truth.
  // ---------------------------------------------------------------------------

  function summarizeSelection(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let selected = 0;
    let withDestination = 0;
    let offBoard = 0;
    list.forEach(function (row) {
      if (!row || !row.selected) return;
      selected += 1;
      if (isUsable(row.expectedColumn) && String(row.expectedColumn).trim() !== '') {
        withDestination += 1;
      }
      if (row.onBoard === false) offBoard += 1;
    });
    return {
      total: list.length,
      selected: selected,
      withDestination: withDestination,
      missingDestination: selected - withDestination,
      offBoard: offBoard,
    };
  }

  return {
    buildColumnOptions: buildColumnOptions,
    buildPickerRows: buildPickerRows,
    filterRows: filterRows,
    buildExpectationsFromSelection: buildExpectationsFromSelection,
    summarizeSelection: summarizeSelection,
    normalizeSearch: normalizeSearch,
  };
});
