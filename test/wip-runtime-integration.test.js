// test/wip-runtime-integration.test.js
// Regression + integration tests for wiring WIPBoardReader + WIPBoardCore into
// the content.js runtime (roadmap T0.3 / T0.4).
//
// Approach (per docs/TEST_STRATEGY.md §1 "characterize before you change"):
//   1. `legacyWipScan` reimplements the PRE-integration inline algorithm from
//      content.js exactly as it behaved before this task (index-paired
//      header/body scan, inline special-person math, inline limit math).
//   2. `integratedWipScan` reimplements the POST-integration algorithm exactly
//      as content.js now does it: WIPBoardReader for the board model +
//      WIPBoardCore for the pure math, with a live-node index for per-card rules.
//   3. Every scenario asserts the two produce identical WIP numbers, column
//      breakdowns and special-person reductions, proving behavior equivalence.
//
// Both paths share one injected visibility predicate so the comparison is about
// the integration logic, not about a DOM layout engine (none is available under
// node --test). Zero dependencies: Node's built-in runner + the mini-dom shim.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../src/core/wip-logic.js');
const reader = require('../src/data/board-dom-reader.js');
const { parseHTML } = require('./helpers/mini-dom.js');

function loadFixture(name) {
  return parseHTML(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

// Deterministic visibility predicate (mirrors the browser isCardVisible rule:
// a card is hidden when it or an ancestor carries aria-hidden/.is-hidden/.hidden).
function isVisible(card) {
  return !card.closest('[aria-hidden="true"], .is-hidden, .hidden');
}

// --- shared helpers used by both scan paths ---------------------------------

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCardAssignees(card) {
  return Array.from(card.querySelectorAll('.identity-display-name span'))
    .map((span) => core.normalizeText(span.textContent))
    .filter(Boolean);
}

function cardHasSpecialTag(card, specialTagPrefix) {
  const tagsText = Array.from(card.querySelectorAll('.field-container'))
    .filter((field) => {
      const labelEl = field.querySelector('.label');
      return labelEl && core.normalizeText(labelEl.textContent) === 'tags';
    })
    .map((field) => core.normalizeText(field.textContent))
    .join(' ');

  const normalizedPrefix = core.normalizeText(specialTagPrefix).replace(/^#/, '');
  const tagRoot = normalizedPrefix.split(/[._-]/)[0] || 'spa';
  const tagRegex = new RegExp(
    `(^|[\\s,;])#?${escapeRegex(tagRoot)}(?:[._-]?[a-z0-9]+)*($|[\\s,;])`,
    'i'
  );
  return tagRegex.test(tagsText);
}

function getHeaderColumnDisplayName(header) {
  const ariaLabel = header.getAttribute('aria-label') || '';
  const editableLabel = header.querySelector('.click-edit-field');
  const editableText = editableLabel ? editableLabel.textContent.trim() : '';
  if (editableText) return editableText;
  if (ariaLabel.trim()) return ariaLabel.trim();
  return (header.textContent || '').trim();
}

// --- LEGACY path: pre-integration inline algorithm --------------------------

function legacyWipScan(doc, config) {
  const wipColumns = config.wipColumns.map((c) => core.normalizeColumnName(c)).filter(Boolean);
  const specialPeople = (config.specialPeople || []).map((p) => core.normalizeText(p)).filter(Boolean);
  const specialTagPrefix = core.normalizeText(config.specialTagPrefix || '#spa').replace(/^#?/, '#');
  const isSpecialRuleActive = config.specialRuleEnabled === true;

  const limit = core.computeWipLimit(config);

  const headers = doc.querySelectorAll('.kanban-board-column-header');
  const columnBodies = doc.querySelectorAll('.kanban-board-column');

  const wipColumnsMeta = [];
  headers.forEach((header, index) => {
    const displayName = getHeaderColumnDisplayName(header);
    if (core.isConfiguredWipColumn(displayName, wipColumns)) {
      wipColumnsMeta.push({ index, displayName });
    }
  });

  let totalCards = 0;
  const specialStatsByPerson = new Map();
  const columnsBreakdown = [];

  wipColumnsMeta.forEach(({ index, displayName }) => {
    const columnContainer = columnBodies[index];
    const cardsInColumn = columnContainer
      ? Array.from(columnContainer.querySelectorAll('.wit-card')).filter(isVisible)
      : [];

    totalCards += cardsInColumn.length;
    columnsBreakdown.push({ name: displayName, count: cardsInColumn.length });

    if (!isSpecialRuleActive) return;

    cardsInColumn.forEach((card) => {
      const assignees = getCardAssignees(card);
      const matchedPerson = specialPeople.find((person) =>
        assignees.some((name) => name.includes(person))
      );
      if (!matchedPerson) return;

      const stats = specialStatsByPerson.get(matchedPerson) || { tagged: 0, untagged: 0 };
      if (cardHasSpecialTag(card, specialTagPrefix)) stats.tagged += 1;
      else stats.untagged += 1;
      specialStatsByPerson.set(matchedPerson, stats);
    });
  });

  let finalWip = totalCards;
  if (isSpecialRuleActive && specialStatsByPerson.size > 0) {
    let specialOriginalTotal = 0;
    let specialAdjustedTotal = 0;
    specialStatsByPerson.forEach(({ tagged, untagged }) => {
      specialOriginalTotal += tagged + untagged;
      specialAdjustedTotal += untagged + (tagged > 0 ? 1 : 0);
    });
    finalWip = totalCards - specialOriginalTotal + specialAdjustedTotal;
  }

  return { finalWip, limit, totalCards, columnsBreakdown };
}

// --- INTEGRATED path: WIPBoardReader + WIPBoardCore (mirrors content.js) -----

function buildLiveCardIndex(doc) {
  const byId = new Map();
  doc.querySelectorAll('.kanban-board-column .wit-card').forEach((card) => {
    const id = card.getAttribute('data-itemid');
    if (!id) return;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(card);
  });
  return byId;
}

function resolveLiveCard(liveCardsById, item) {
  const key =
    item.rawId != null && typeof item.rawId === 'string'
      ? item.rawId
      : item.id != null
        ? String(item.id)
        : null;
  if (key == null) return null;
  const queue = liveCardsById.get(key);
  if (!queue || queue.length === 0) return null;
  return queue.shift();
}

function integratedWipScan(doc, config) {
  const wipColumns = config.wipColumns.map((c) => core.normalizeColumnName(c)).filter(Boolean);
  const specialPeople = (config.specialPeople || []).map((p) => core.normalizeText(p)).filter(Boolean);
  const specialTagPrefix = core.normalizeText(config.specialTagPrefix || '#spa').replace(/^#?/, '#');
  const isSpecialRuleActive = config.specialRuleEnabled === true;

  const limit = core.computeWipLimit(config);

  const boardModel = reader.readBoard(doc, { isVisible });
  const liveCardsById = buildLiveCardIndex(doc);

  const wipColumnsModel = boardModel.columns.filter((column) =>
    core.isConfiguredWipColumn(column.name, wipColumns)
  );

  let totalCards = 0;
  const specialStatsByPerson = new Map();
  const columnsBreakdown = [];

  wipColumnsModel.forEach((column) => {
    const columnItems = boardModel.items.filter(
      (item) => item.isVisible && item.column === column.name && item.columnId === column.id
    );

    totalCards += columnItems.length;
    columnsBreakdown.push({ name: column.name, count: columnItems.length });

    columnItems.forEach((item) => {
      const card = resolveLiveCard(liveCardsById, item);
      if (!card) return;

      if (!isSpecialRuleActive) return;

      const assignees = getCardAssignees(card);
      const matchedPerson = specialPeople.find((person) =>
        assignees.some((name) => name.includes(person))
      );
      if (!matchedPerson) return;

      const stats = specialStatsByPerson.get(matchedPerson) || { tagged: 0, untagged: 0 };
      if (cardHasSpecialTag(card, specialTagPrefix)) stats.tagged += 1;
      else stats.untagged += 1;
      specialStatsByPerson.set(matchedPerson, stats);
    });
  });

  let finalWip = totalCards;
  if (isSpecialRuleActive && specialStatsByPerson.size > 0) {
    finalWip = core.applySpecialPersonReduction(totalCards, specialStatsByPerson.values());
  }

  return { finalWip, limit, totalCards, columnsBreakdown };
}

// Run both paths and assert they are equivalent, returning the shared result.
function assertEquivalent(doc, config, label) {
  const legacy = legacyWipScan(doc, config);
  const integrated = integratedWipScan(doc, config);
  assert.deepEqual(integrated, legacy, `integrated != legacy for: ${label}`);
  return integrated;
}

// ============================================================================
// Scenarios
// ============================================================================

test('WIP normal: under limit, no special rule (direct limit)', () => {
  const doc = loadFixture('board-full.html');
  // WIP columns = Desenvolvimento + Code Review. Visible cards: 1003 (dev, 1004 hidden)
  // + 1005 (cr) = 2 cards. Direct limit 5 -> normal.
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 5, wipColumns: ['Desenvolvimento', 'Code Review'], specialRuleEnabled: false },
    'WIP normal direct'
  );
  assert.equal(result.totalCards, 2);
  assert.equal(result.finalWip, 2);
  assert.equal(result.limit, 5);
  assert.ok(result.finalWip <= result.limit, 'should be within limit');
});

test('WIP exceeded: over limit (direct limit)', () => {
  const doc = loadFixture('board-full.html');
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 1, wipColumns: ['Desenvolvimento', 'Code Review'], specialRuleEnabled: false },
    'WIP exceeded direct'
  );
  assert.equal(result.finalWip, 2);
  assert.equal(result.limit, 1);
  assert.ok(result.finalWip > result.limit, 'should exceed limit');
});

test('team-size limit mode: 2*team+1', () => {
  const doc = loadFixture('board-full.html');
  const result = assertEquivalent(
    doc,
    { useEquipe: true, equipeSize: 3, wipColumns: ['Desenvolvimento', 'Code Review'], specialRuleEnabled: false },
    'team-size limit'
  );
  assert.equal(result.limit, 7); // 2*3+1
});

test('hidden/filtered cards are excluded from the WIP count', () => {
  const doc = loadFixture('board-full.html');
  // 1004 is hidden inside Desenvolvimento; must not be counted.
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'], specialRuleEnabled: false },
    'hidden excluded'
  );
  assert.equal(result.totalCards, 1); // only 1003 visible
});

test('columns outside the configured WIP set are ignored (Closed/HO/Approved)', () => {
  const doc = loadFixture('board-full.html');
  // Only Code Review is configured; Approved/HO/Closed must not count.
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 10, wipColumns: ['Code Review'], specialRuleEnabled: false },
    'non-WIP columns ignored'
  );
  assert.equal(result.totalCards, 1);
  assert.deepEqual(result.columnsBreakdown, [{ name: 'Code Review', count: 1 }]);
});

test('different column counts yield matching per-column breakdown', () => {
  const doc = loadFixture('board-full.html');
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 10, wipColumns: ['Approved', 'Desenvolvimento', 'Code Review'], specialRuleEnabled: false },
    'multi-column breakdown'
  );
  assert.deepEqual(result.columnsBreakdown, [
    { name: 'Approved', count: 2 },
    { name: 'Desenvolvimento', count: 1 }, // 1004 hidden
    { name: 'Code Review', count: 1 },
  ]);
  assert.equal(result.totalCards, 4);
});

test('special rule: per person, tagged cards collapse into one WIP block', () => {
  const doc = loadFixture('board-special-rule.html');
  // Alice: 3001(#spa) + 3002(#spa.ui) + 3006(#spaapi) tagged, 3003 untagged -> 3 tagged + 1 untagged.
  // Bob: 3004 untagged (blocked tag is not the special tag). Carol: 3005 untagged.
  // Raw WIP columns (Dev + CR): 3001,3002,3003,3004,3005,3006 = 6 cards.
  // Alice reduction: original 4 -> adjusted (1 untagged + 1 block) = 2. finalWip = 6 - 4 + 2 = 4.
  const result = assertEquivalent(
    doc,
    {
      useEquipe: false,
      directWip: 5,
      wipColumns: ['Desenvolvimento', 'Code Review'],
      specialRuleEnabled: true,
      specialPeople: ['Alice Dev'],
      specialTagPrefix: '#spa',
    },
    'special rule reduction'
  );
  assert.equal(result.totalCards, 6);
  assert.equal(result.finalWip, 4);
});

test('special rule off: tagged cards each count individually', () => {
  const doc = loadFixture('board-special-rule.html');
  const result = assertEquivalent(
    doc,
    {
      useEquipe: false,
      directWip: 5,
      wipColumns: ['Desenvolvimento', 'Code Review'],
      specialRuleEnabled: false,
      specialPeople: ['Alice Dev'],
      specialTagPrefix: '#spa',
    },
    'special rule off'
  );
  assert.equal(result.finalWip, 6);
});

test('blocked card still counts in total WIP', () => {
  const doc = loadFixture('board-special-rule.html');
  // 3004 carries #blck; it must still be counted in WIP (only its alarm is suppressed).
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 10, wipColumns: ['Desenvolvimento'], specialRuleEnabled: false },
    'blocked counts in WIP'
  );
  assert.equal(result.totalCards, 4); // 3001..3004 all count
});

test('cards without assignee do not break the special rule', () => {
  const doc = loadFixture('board-full.html');
  // 1002 is Unassigned in Approved; enabling the special rule for Dev One must not throw.
  const result = assertEquivalent(
    doc,
    {
      useEquipe: false,
      directWip: 10,
      wipColumns: ['Approved', 'Code Review'],
      specialRuleEnabled: true,
      specialPeople: ['Dev One'],
      specialTagPrefix: '#spa',
    },
    'no-assignee special rule'
  );
  // Dev One has 1001 (Approved, no special tag) + 1005 (CR, #spa tag).
  // original 2 -> adjusted (1 untagged + 1 block) = 2 => finalWip = 3 - 2 + 2 = 3.
  assert.equal(result.totalCards, 3); // 1001,1002,1005
  assert.equal(result.finalWip, 3);
});

test('duplicate ids across columns are each counted (swimlane rendering)', () => {
  const doc = loadFixture('board-variations.html');
  // id 2001 appears in both "To Do" and "Doing"; both occurrences must count.
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 10, wipColumns: ['To Do', 'Doing'], specialRuleEnabled: false },
    'duplicate ids counted'
  );
  // To Do: 2001, 2002 (2). Doing: 2001, 2003 (2). Total 4.
  assert.equal(result.totalCards, 4);
  assert.deepEqual(result.columnsBreakdown, [
    { name: 'To Do', count: 2 },
    { name: 'Doing', count: 2 },
  ]);
});

test('empty board yields zero WIP', () => {
  const doc = loadFixture('board-empty.html');
  const result = assertEquivalent(
    doc,
    { useEquipe: false, directWip: 5, wipColumns: ['Doing'], specialRuleEnabled: false },
    'empty board'
  );
  assert.equal(result.totalCards, 0);
  assert.equal(result.finalWip, 0);
});

test('dynamic card change: moving a card updates the WIP count equivalently', () => {
  const doc = loadFixture('board-full.html');
  const config = {
    useEquipe: false,
    directWip: 10,
    wipColumns: ['Desenvolvimento'],
    specialRuleEnabled: false,
  };
  const before = assertEquivalent(doc, config, 'dynamic before');
  assert.equal(before.totalCards, 1); // only 1003 visible

  // Simulate Azure un-hiding the filtered card 1004 (removing the hidden wrapper's flags).
  const devBody = doc
    .querySelectorAll('.kanban-board-column')
    [1]; // Desenvolvimento
  const hiddenWrapper = devBody.querySelector('.is-hidden');
  // Clear the visibility-blocking attributes/classes so isVisible() now returns true.
  hiddenWrapper.attributes['class'] = '';
  delete hiddenWrapper.attributes['aria-hidden'];

  const after = assertEquivalent(doc, config, 'dynamic after');
  assert.equal(after.totalCards, 2); // 1003 + now-visible 1004
});

// --- Aging / Target Date alarm equivalence ----------------------------------

// Legacy inline target-date math (pre-integration, from analyzeCard).
function legacyTargetDateDays(val, today) {
  const parts = String(val || '').split('/');
  if (parts.length !== 3) return null;
  const targetDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  const start = new Date(today.getTime());
  start.setHours(0, 0, 0, 0);
  const diffTime = targetDate - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Legacy inline severity classification (pre-integration getCardSeverityClass).
function legacySeverity(agingValue, cfg) {
  if (agingValue !== null && agingValue >= cfg.agingCriticalDays) return 'card-alerta-critico';
  if (agingValue !== null && agingValue >= cfg.agingHighDays) return 'card-alerta-alto';
  if (agingValue !== null && agingValue >= cfg.agingWarningDays) return 'card-alerta-medio';
  return 'card-alerta-baixo';
}

test('aging severity: core helper matches the legacy inline thresholds', () => {
  const cfg = { agingWarningDays: 10, agingHighDays: 15, agingCriticalDays: 20 };
  const doc = loadFixture('board-special-rule.html');
  const model = reader.readBoard(doc, { isVisible });

  model.items.forEach((item) => {
    const aging = reader.isUnavailable(item.aging) ? null : item.aging;
    assert.equal(
      core.getCardSeverityClass(aging, cfg),
      legacySeverity(aging, cfg),
      `severity mismatch for id ${item.id}`
    );
  });
});

test('target date: core helper matches legacy day math for known values', () => {
  const today = new Date(2026, 11, 20); // 20 Dec 2026
  ['31/12/2026', '20/12/2026', '01/12/2026', '', 'n/a', '15/06/2027'].forEach((val) => {
    assert.equal(
      core.targetDateDaysRemaining(val, today),
      legacyTargetDateDays(val, today),
      `target-date mismatch for "${val}"`
    );
  });
});

test('config change: switching limit mode is reflected equivalently', () => {
  const doc = loadFixture('board-full.html');
  const base = { wipColumns: ['Desenvolvimento', 'Code Review'], specialRuleEnabled: false };

  const direct = assertEquivalent(doc, { ...base, useEquipe: false, directWip: 4 }, 'config direct');
  assert.equal(direct.limit, 4);

  const team = assertEquivalent(doc, { ...base, useEquipe: true, equipeSize: 2 }, 'config team');
  assert.equal(team.limit, 5); // 2*2+1

  // WIP count is independent of the limit mode.
  assert.equal(direct.finalWip, team.finalWip);
});
