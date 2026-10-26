// src/core/wip-logic.js
// Pure, DOM-free logic extracted as the single source of truth for WIP math,
// text normalization, i18n message formatting, and alarm severity.
//
// These implementations are behavior-identical copies of the pure helpers that
// currently live inline in content.js. They are isolated here so they can be
// unit-tested without a DOM and reused by future modules. Wiring content.js to
// consume this file is a later, separately tested step (see docs/PRODUCT_ROADMAP.md
// T0.3); extracting the logic here introduces no runtime change on its own.
//
// Dual environment support:
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script: attaches to window.WIPBoardCore when loaded in a page.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    // Node / test environment.
    module.exports = api;
  }
  if (root) {
    // Browser / content-script environment: expose a single namespace.
    root.WIPBoardCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- i18n -----------------------------------------------------------------

  function getLanguageCode(value) {
    return value === 'pt' ? 'pt' : 'en';
  }

  function formatMessage(template, tokens = {}) {
    return String(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, token) =>
      String(tokens[token] ?? '')
    );
  }

  // --- text normalization ---------------------------------------------------

  function normalizeText(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function normalizeColumnName(value) {
    // Normalize column names to handle Azure rendering variations.
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[|]/g, ' ')
      .trim();
  }

  function isConfiguredWipColumn(columnName, configuredColumns) {
    const normalizedColumn = normalizeColumnName(columnName);
    if (!normalizedColumn) return false;

    return (configuredColumns || []).some((configured) => {
      const normalizedConfigured = normalizeColumnName(configured);
      if (!normalizedConfigured) return false;

      // Accept exact and inclusive matching to tolerate Azure suffixes.
      return (
        normalizedConfigured === normalizedColumn ||
        normalizedConfigured.includes(normalizedColumn) ||
        normalizedColumn.includes(normalizedConfigured)
      );
    });
  }

  // --- alarm severity -------------------------------------------------------

  function getCardSeverityClass(agingValue, alarmConfig) {
    if (agingValue !== null && agingValue >= alarmConfig.agingCriticalDays)
      return 'card-alerta-critico';
    if (agingValue !== null && agingValue >= alarmConfig.agingHighDays)
      return 'card-alerta-alto';
    if (agingValue !== null && agingValue >= alarmConfig.agingWarningDays)
      return 'card-alerta-medio';
    return 'card-alerta-baixo';
  }

  // --- WIP math -------------------------------------------------------------

  // Special-person block reduction: for each configured special person, all of
  // their special-tagged cards collapse into a single WIP block. Untagged cards
  // of that person still count individually. This mirrors the live rule exactly:
  //   finalWip = totalCards - specialOriginalTotal + specialAdjustedTotal
  // where, per person, adjusted = untagged + (tagged > 0 ? 1 : 0).
  //
  // statsByPerson: iterable of { tagged, untagged } objects (e.g. Map values).
  function applySpecialPersonReduction(totalCards, statsByPerson) {
    const entries = Array.from(statsByPerson || []);
    if (entries.length === 0) return totalCards;

    let specialOriginalTotal = 0;
    let specialAdjustedTotal = 0;

    entries.forEach(({ tagged, untagged }) => {
      specialOriginalTotal += tagged + untagged;
      specialAdjustedTotal += untagged + (tagged > 0 ? 1 : 0);
    });

    return totalCards - specialOriginalTotal + specialAdjustedTotal;
  }

  // Compute the WIP limit from the two configured modes, preserving current logic.
  function computeWipLimit({ useEquipe, equipeSize, directWip }) {
    if (useEquipe === true && equipeSize) {
      return 2 * equipeSize + 1;
    }
    if (useEquipe === false && directWip) {
      return directWip;
    }
    return null;
  }

  // Parse a dd/mm/yyyy target date into remaining whole days relative to `today`.
  // Returns null when the value is not a dd/mm/yyyy triple. Mirrors analyzeCard.
  function targetDateDaysRemaining(value, today = new Date()) {
    const parts = String(value || '').split('/');
    if (parts.length !== 3) return null;
    const targetDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const start = new Date(today.getTime());
    start.setHours(0, 0, 0, 0);
    const diffTime = targetDate - start;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return {
    getLanguageCode,
    formatMessage,
    normalizeText,
    normalizeColumnName,
    isConfiguredWipColumn,
    getCardSeverityClass,
    applySpecialPersonReduction,
    computeWipLimit,
    targetDateDaysRemaining,
  };
});
