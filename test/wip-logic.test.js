// test/wip-logic.test.js
// Characterization tests: lock the current behavior of the pure WIP helpers
// before any refactor wires them into content.js. Uses Node's built-in test
// runner (node:test) and assertions (node:assert) — zero external dependencies.

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core/wip-logic.js');

test('getLanguageCode defaults to en and recognizes pt', () => {
  assert.equal(core.getLanguageCode('pt'), 'pt');
  assert.equal(core.getLanguageCode('en'), 'en');
  assert.equal(core.getLanguageCode(undefined), 'en');
  assert.equal(core.getLanguageCode('zz'), 'en');
});

test('formatMessage substitutes tokens and empties missing ones', () => {
  assert.equal(
    core.formatMessage('WIP: {{current}} / {{limit}}', { current: 3, limit: 5 }),
    'WIP: 3 / 5'
  );
  assert.equal(core.formatMessage('Hello {{name}}', {}), 'Hello ');
  assert.equal(core.formatMessage('No tokens here', { x: 1 }), 'No tokens here');
});

test('normalizeColumnName strips accents, pipes and collapses whitespace', () => {
  assert.equal(core.normalizeColumnName('  Em   Andamento '), 'em andamento');
  assert.equal(core.normalizeColumnName('Revisão|Código'), 'revisao codigo');
  assert.equal(core.normalizeColumnName(''), '');
});

test('isConfiguredWipColumn matches exactly and inclusively', () => {
  const configured = ['In Progress', 'Code Review'];
  assert.equal(core.isConfiguredWipColumn('In Progress', configured), true);
  // Inclusive match tolerates Azure suffixes in either direction.
  assert.equal(core.isConfiguredWipColumn('In Progress (Doing)', configured), true);
  assert.equal(core.isConfiguredWipColumn('Code', configured), true);
  assert.equal(core.isConfiguredWipColumn('Done', configured), false);
  assert.equal(core.isConfiguredWipColumn('', configured), false);
});

test('getCardSeverityClass respects threshold boundaries', () => {
  const cfg = { agingWarningDays: 10, agingHighDays: 15, agingCriticalDays: 20 };
  assert.equal(core.getCardSeverityClass(20, cfg), 'card-alerta-critico');
  assert.equal(core.getCardSeverityClass(19, cfg), 'card-alerta-alto');
  assert.equal(core.getCardSeverityClass(15, cfg), 'card-alerta-alto');
  assert.equal(core.getCardSeverityClass(10, cfg), 'card-alerta-medio');
  assert.equal(core.getCardSeverityClass(9, cfg), 'card-alerta-baixo');
  assert.equal(core.getCardSeverityClass(null, cfg), 'card-alerta-baixo');
});

test('applySpecialPersonReduction collapses tagged cards per person', () => {
  // No special people: WIP unchanged.
  assert.equal(core.applySpecialPersonReduction(10, []), 10);

  // One person with 3 tagged + 2 untagged: 3 tagged collapse to 1 block.
  // original = 5, adjusted = 2 + 1 = 3, final = 10 - 5 + 3 = 8.
  const oneMap = new Map([['alice', { tagged: 3, untagged: 2 }]]);
  assert.equal(core.applySpecialPersonReduction(10, oneMap.values()), 8);

  // Person with only untagged cards: no reduction for that person.
  const untaggedOnly = new Map([['bob', { tagged: 0, untagged: 4 }]]);
  assert.equal(core.applySpecialPersonReduction(10, untaggedOnly.values()), 10);

  // Two people both with tagged cards.
  // alice: 2 tagged + 1 untagged -> orig 3, adj 2; bob: 2 tagged -> orig 2, adj 1.
  // total 12, orig 5, adj 3 => 12 - 5 + 3 = 10.
  const twoMap = new Map([
    ['alice', { tagged: 2, untagged: 1 }],
    ['bob', { tagged: 2, untagged: 0 }],
  ]);
  assert.equal(core.applySpecialPersonReduction(12, twoMap.values()), 10);
});

test('computeWipLimit matches the two configured modes', () => {
  assert.equal(core.computeWipLimit({ useEquipe: true, equipeSize: 4 }), 9); // 2*4+1
  assert.equal(core.computeWipLimit({ useEquipe: false, directWip: 7 }), 7);
  assert.equal(core.computeWipLimit({ useEquipe: true, equipeSize: 0 }), null);
  assert.equal(core.computeWipLimit({ useEquipe: null }), null);
});

test('targetDateDaysRemaining parses dd/mm/yyyy relative to a fixed today', () => {
  const today = new Date(2024, 0, 10); // 10 Jan 2024
  assert.equal(core.targetDateDaysRemaining('13/01/2024', today), 3);
  assert.equal(core.targetDateDaysRemaining('10/01/2024', today), 0);
  assert.equal(core.targetDateDaysRemaining('05/01/2024', today), -5); // overdue
  assert.equal(core.targetDateDaysRemaining('not-a-date', today), null);
  assert.equal(core.targetDateDaysRemaining('', today), null);
});
