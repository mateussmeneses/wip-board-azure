// src/data/board-dom-reader.js
// Board DOM Reader: extract a structured, presentation-free model of the Azure
// DevOps board from the rendered DOM.
//
// This module is the single place that knows Azure board selectors (addresses
// risk R2 in docs/ARCHITECTURE.md: selector fragility concentrated in one file).
// It produces a normalized work-item model that future features (Daily Snapshot,
// Sprint Intelligence, Roadmap Intelligence, History) can consume without ever
// scraping the DOM themselves, and without any WIP-specific presentation logic.
//
// Design constraints honored here:
// - No runtime behavior change to the extension: content.js is NOT modified and
//   does not import this module yet (see docs/PRODUCT_ROADMAP.md T0.4).
// - No new dependencies: the reader works against a standard DOM interface. In a
//   Chrome content script that is the live `document`. In tests a zero-dependency
//   DOM shim provides the same minimal surface.
// - Manifest V3 safe: no eval, no remote code, attaches to a single namespace.
//
// Dual environment support (same pattern as src/core/wip-logic.js):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardReader when loaded.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardReader = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Sentinels: distinguish "information not available in this DOM" (UNAVAILABLE)
  // from a field that is present but genuinely empty (empty string / null value
  // that the board itself rendered as blank). Requirement 7.
  // ---------------------------------------------------------------------------

  // A field the current DOM layout does not expose at all.
  const UNAVAILABLE = Object.freeze({ __wipFieldState: 'unavailable' });

  function isUnavailable(value) {
    return value === UNAVAILABLE;
  }

  // ---------------------------------------------------------------------------
  // Selectors: every Azure-coupled selector lives here so markup changes have a
  // single maintenance point (R2).
  // ---------------------------------------------------------------------------

  const SELECTORS = {
    board: '.kanban-board',
    columnHeader: '.kanban-board-column-header',
    columnBody: '.kanban-board-column',
    card: '.wit-card',
    cardId: '[data-itemid]',
    columnHeaderEditable: '.click-edit-field',
    columnItemCount: '.board-column-item-count',
    stateName: '.work-item-state-name span',
    assigneeName: '.identity-display-name span',
    typeIcon: '.work-item-type-icon',
    fieldContainer: '.field-container',
    fieldLabel: '.label',
    fieldValue: '.value .text-ellipsis',
  };

  // Map an Azure bowtie work-item-type icon class to a stable type keyword. The
  // icon class is far more stable than the localized aria-label text, which can
  // be prefixed by swimlane/row names (e.g. "Row Maintenance FT Feature").
  const TYPE_ICON_MAP = {
    'bowtie-symbol-defect': 'Issue',
    'bowtie-symbol-trophy': 'Feature',
    'bowtie-symbol-ask': 'Epic',
    'bowtie-symbol-book': 'UserStory',
  };

  // ---------------------------------------------------------------------------
  // Small DOM helpers (null-safe). These keep the extraction code readable and
  // tolerant of partial/variant layouts (requirement 5).
  // ---------------------------------------------------------------------------

  function text(node) {
    return node && typeof node.textContent === 'string' ? node.textContent.trim() : '';
  }

  function attr(node, name) {
    return node && typeof node.getAttribute === 'function' ? node.getAttribute(name) : null;
  }

  function queryAll(node, selector) {
    if (!node || typeof node.querySelectorAll !== 'function') return [];
    return Array.from(node.querySelectorAll(selector));
  }

  function queryOne(node, selector) {
    if (!node || typeof node.querySelector !== 'function') return null;
    return node.querySelector(selector);
  }

  // ---------------------------------------------------------------------------
  // Visibility. The live extension uses getComputedStyle + getClientRects to tell
  // DOM-present-but-filtered cards apart from on-screen ones. That API surface is
  // browser-only, so it is injectable: tests pass a deterministic predicate; the
  // browser default mirrors the current content.js isCardVisible() behavior.
  // Requirement 4 (visible vs hidden) without relying on fragile indices.
  // ---------------------------------------------------------------------------

  function defaultIsVisible(card) {
    if (!card) return false;
    const view =
      (card.ownerDocument && card.ownerDocument.defaultView) ||
      (typeof window !== 'undefined' ? window : null);
    if (!view || typeof view.getComputedStyle !== 'function') {
      // No rendering context (e.g. detached node): cannot assert hidden.
      return true;
    }
    const style = view.getComputedStyle(card);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (
      typeof card.closest === 'function' &&
      card.closest('[aria-hidden="true"], .is-hidden, .hidden')
    ) {
      return false;
    }
    return typeof card.getClientRects === 'function' ? card.getClientRects().length > 0 : true;
  }

  // ---------------------------------------------------------------------------
  // Column extraction. Columns are read from the header spans in order, then
  // paired with their body container by index within the same board root. The
  // body carries a stable `data-column` GUID and `data-done` flag, so downstream
  // code can key off that identifier instead of the ordinal index (requirement 1
  // keeps order; stable id removes index fragility for identity — requirement 4).
  // ---------------------------------------------------------------------------

  function columnLayout(boardRoot) {
    const headers = queryAll(boardRoot, SELECTORS.columnHeader);
    const bodies = queryAll(boardRoot, SELECTORS.columnBody);
    const groups = headers.map(function () { return []; });
    if (headers.length === 0) {
      return { headers: headers, groups: groups, bodyCount: bodies.length, reliable: false };
    }

    // Prefer the stable header ID if Azure exposes it.
    const ids = headers.map(function (h) { return attr(h, 'data-column'); });
    const hasHeaderIds = ids.every(function (id) { return !!id; }) &&
      new Set(ids).size === ids.length;

    if (hasHeaderIds && bodies.every(function (b) {
      return ids.indexOf(attr(b, 'data-column')) !== -1;
    })) {
      bodies.forEach(function (b) {
        groups[ids.indexOf(attr(b, 'data-column'))].push(b);
      });
      return {
        headers: headers, groups: groups, bodyCount: bodies.length,
        reliable: groups.every(function (g) { return g.length > 0; }),
      };
    }

    // Azure boards with swimlanes repeat the SAME column bodies once per lane:
    // [A,B,C] [A,B,C] ... . Pair by column slot across every row, not only the
    // first row. If repeated GUIDs disagree, mark the mapping unreliable.
    const fullRows = bodies.length >= headers.length &&
      bodies.length % headers.length === 0;
    bodies.forEach(function (body, i) {
      if (i < headers.length || fullRows) groups[i % headers.length].push(body);
    });
    const consistentIds = groups.every(function (group) {
      const ids = group.map(function (b) { return attr(b, 'data-column'); }).filter(Boolean);
      return ids.length < 2 || new Set(ids).size === 1;
    });
    return {
      headers: headers,
      groups: groups,
      bodyCount: bodies.length,
      reliable: fullRows && consistentIds,
    };
  }

  function parseReportedCount(value) {
    const raw = String(value || '').trim().replace(/\s/g, '');
    if (/^\d+$/.test(raw)) return Number(raw);
    // Common thousands grouping in Azure locales: 1,234 or 1.234.
    if (/^\d{1,3}([,.]\d{3})+$/.test(raw)) {
      return Number(raw.replace(/[,.]/g, ''));
    }
    return UNAVAILABLE;
  }

  function readColumns(boardRoot, providedLayout) {
    const layout = providedLayout || columnLayout(boardRoot);
    return layout.headers.map(function (header, index) {
      const editable = queryOne(header, SELECTORS.columnHeaderEditable);
      const ariaLabel = attr(header, 'aria-label');
      const name = text(editable) || (ariaLabel ? ariaLabel.trim() : '') || text(header);
      const bodyGroup = layout.groups[index] || [];
      const body = bodyGroup[0] || null;
      const countNode = queryOne(header, SELECTORS.columnItemCount);
      const reportedCount = countNode
        ? parseReportedCount(text(countNode)) : UNAVAILABLE;
      return {
        id: attr(header, 'data-column') || (body ? attr(body, 'data-column') : null),
        name: name,
        order: index,
        isDoneColumn: body ? attr(body, 'data-done') === 'true' : UNAVAILABLE,
        reportedCount: reportedCount,
        _bodies: bodyGroup,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Card field extraction. Fields are read by their label rather than by
  // position, so reordered/added fields do not corrupt values (requirement 4).
  // ---------------------------------------------------------------------------

  function readCardFields(card) {
    const fields = {};
    queryAll(card, SELECTORS.fieldContainer).forEach(function (field) {
      const label = text(queryOne(field, SELECTORS.fieldLabel)).toLowerCase();
      if (!label) return;
      const valueNode = queryOne(field, SELECTORS.fieldValue);
      // Field is present in the layout: its value is the (possibly empty) text,
      // never UNAVAILABLE. Absence of the whole container is what makes a field
      // unavailable (handled by the caller defaulting to UNAVAILABLE).
      fields[label] = valueNode ? text(valueNode) : '';
    });
    return fields;
  }

  function readCardType(card) {
    const icon = queryOne(card, SELECTORS.typeIcon);
    if (!icon) return UNAVAILABLE;
    const className = (attr(icon, 'class') || '').toLowerCase();
    const matched = Object.keys(TYPE_ICON_MAP).find(function (key) {
      return className.indexOf(key) !== -1;
    });
    return matched ? TYPE_ICON_MAP[matched] : UNAVAILABLE;
  }

  function readCardAssignee(card) {
    const node = queryOne(card, SELECTORS.assigneeName);
    if (!node) return UNAVAILABLE;
    const name = text(node);
    // Azure renders "Unassigned" for an empty assignee. Normalize that to a real
    // null (present but empty) rather than treating it as a person's name.
    if (!name || name.toLowerCase() === 'unassigned') return null;
    return name;
  }

  function readCardState(card) {
    const node = queryOne(card, SELECTORS.stateName);
    if (!node) return UNAVAILABLE;
    return text(node);
  }

  function readCardTitle(card) {
    // Title lives in the card anchor; fall back to the aria-label when the
    // anchor text is not rendered.
    const titleText = queryOne(card, '.title-text') || queryOne(card, 'a.title');
    const fromAnchor = text(titleText);
    if (fromAnchor) return fromAnchor;
    return UNAVAILABLE;
  }

  // Resolve organization/project from the card's work-item edit href, so every
  // downstream indicator can be scoped by org/project (ARCHITECTURE 2.1) using a
  // stable source rather than parsing the page URL.
  function readCardScope(card) {
    const anchor = queryOne(card, 'a.title') || queryOne(card, 'a[href*="/_workitems/edit/"]');
    const href = attr(anchor, 'href') || '';
    const match = href.match(/^\/([^/]+)\/([^/]+)\/_workitems\/edit\/(\d+)/);
    if (!match) {
      return { organization: UNAVAILABLE, project: UNAVAILABLE };
    }
    return { organization: match[1], project: match[2] };
  }

  // ---------------------------------------------------------------------------
  // Read a single card into the normalized model. The id is the stable
  // `data-itemid` integer (requirement 2); everything else is best-effort with
  // UNAVAILABLE / null discipline (requirements 3 and 7).
  // ---------------------------------------------------------------------------

  function readCard(card, columnName, columnId, isVisible) {
    const rawId = attr(card, 'data-itemid');
    const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;

    const fields = readCardFields(card);
    const scope = readCardScope(card);

    // Field-derived values: present-but-empty => '' / null; absent => UNAVAILABLE.
    const hasAging = Object.prototype.hasOwnProperty.call(fields, 'aging');
    const hasTargetDate = Object.prototype.hasOwnProperty.call(fields, 'target date');
    const hasTags = Object.prototype.hasOwnProperty.call(fields, 'tags');
    const hasIteration = Object.prototype.hasOwnProperty.call(fields, 'iteration path');
    const hasArea = Object.prototype.hasOwnProperty.call(fields, 'area path');

    return {
      // Core identity.
      id: id,
      rawId: rawId == null ? UNAVAILABLE : rawId,
      type: readCardType(card),
      title: readCardTitle(card),
      state: readCardState(card),
      // Current column by stable id + display name; never by index.
      column: columnName == null ? UNAVAILABLE : columnName,
      columnId: columnId == null ? UNAVAILABLE : columnId,
      assignee: readCardAssignee(card),
      // Optional metadata: absent field => UNAVAILABLE; present empty => '' / null.
      aging: hasAging ? parseAging(fields['aging']) : UNAVAILABLE,
      targetDate: hasTargetDate ? (fields['target date'] || null) : UNAVAILABLE,
      tags: hasTags ? parseTags(fields['tags']) : UNAVAILABLE,
      iterationPath: hasIteration ? (fields['iteration path'] || null) : UNAVAILABLE,
      areaPath: hasArea ? (fields['area path'] || null) : UNAVAILABLE,
      organization: scope.organization,
      project: scope.project,
      // Visibility + duplication are computed by the caller/aggregator.
      isVisible: isVisible,
    };
  }

  function parseAging(value) {
    const trimmed = String(value == null ? '' : value).trim();
    if (trimmed === '') return null; // present but empty
    const parsed = parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseTags(value) {
    const trimmed = String(value == null ? '' : value).trim();
    if (trimmed === '') return [];
    return trimmed
      .split(/[;,]/)
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // Top-level reader. Returns a snapshot-ready, presentation-free model
  // (requirement 6) suitable for persistence and future comparison
  // (requirement 8). Duplicate ids (same card rendered in more than one node,
  // e.g. swimlanes) are reported explicitly instead of being silently merged.
  // ---------------------------------------------------------------------------

  function readBoard(documentOrRoot, options) {
    const opts = options || {};
    const isVisible = typeof opts.isVisible === 'function' ? opts.isVisible : defaultIsVisible;

    const boardRoot = resolveBoardRoot(documentOrRoot);
    if (!boardRoot) {
      return emptyModel();
    }

    const layout = columnLayout(boardRoot);
    const columns = readColumns(boardRoot, layout);
    const headerCount = layout.headers.length;
    const bodyCount = layout.bodyCount;
    const items = [];
    const seenIds = new Map(); // id -> first index in items

    columns.forEach(function (column) {
      const cardNodes = (column._bodies || []).flatMap(function (body) {
        return queryAll(body, SELECTORS.card);
      });
      cardNodes.forEach(function (cardNode) {
        const visible = isVisible(cardNode);
        const item = readCard(cardNode, column.name, column.id, visible);

        if (item.id != null && seenIds.has(item.id)) {
          // Mark both the original and this occurrence as duplicates so callers
          // can decide how to de-duplicate without re-scanning.
          item.isDuplicate = true;
          const firstIndex = seenIds.get(item.id);
          items[firstIndex].isDuplicate = true;
        } else {
          item.isDuplicate = false;
          if (item.id != null) seenIds.set(item.id, items.length);
        }

        items.push(item);
      });
    });

    // Public column view: drop the internal `_body` handle.
    const publicColumns = columns.map(function (c) {
      return {
        id: c.id,
        name: c.name,
        order: c.order,
        isDoneColumn: c.isDoneColumn,
        reportedCount: c.reportedCount,
      };
    });

    return {
      columns: publicColumns,
      items: items,
      // Convenience aggregates for snapshots/diffing; still presentation-free.
      counts: buildCounts(items),
      diagnostics: {
        headerCount: headerCount,
        bodyCount: bodyCount,
        columnAlignmentReliable: layout.reliable,
      },
    };
  }

  function buildCounts(items) {
    const visible = items.filter(function (i) {
      return i.isVisible;
    });
    const uniqueVisibleIds = new Set(
      visible
        .filter(function (i) {
          return i.id != null;
        })
        .map(function (i) {
          return i.id;
        })
    );
    return {
      total: items.length,
      visible: visible.length,
      hidden: items.length - visible.length,
      uniqueVisibleIds: uniqueVisibleIds.size,
      duplicates: items.filter(function (i) {
        return i.isDuplicate;
      }).length,
    };
  }

  function emptyModel() {
    return {
      columns: [],
      items: [],
      counts: { total: 0, visible: 0, hidden: 0, uniqueVisibleIds: 0, duplicates: 0 },
      diagnostics: { headerCount: 0, bodyCount: 0, columnAlignmentReliable: false },
    };
  }

  // Accept either a document-like root or an explicit board element. Falls back
  // to the document itself when the `.kanban-board` wrapper is not found, so the
  // reader still works on layout variants that omit it (requirement 5).
  function resolveBoardRoot(documentOrRoot) {
    if (!documentOrRoot) return null;
    const board = queryOne(documentOrRoot, SELECTORS.board);
    if (board) return board;
    // The passed node might itself be the board, or a layout without the wrapper.
    if (typeof documentOrRoot.querySelectorAll === 'function') return documentOrRoot;
    return null;
  }

  return {
    readBoard: readBoard,
    readColumns: readColumns,
    // Exposed for targeted unit tests and reuse by future modules.
    UNAVAILABLE: UNAVAILABLE,
    isUnavailable: isUnavailable,
    SELECTORS: SELECTORS,
    TYPE_ICON_MAP: TYPE_ICON_MAP,
  };
});
