// test/i18n-parity.test.js
// Bilingual (EN/PT) parity guard for the content-script I18N pack.
//
// The project is required to stay bilingual (English + Portuguese). Every runtime
// string added to one language MUST exist in the other, or a user on the missing
// language sees a raw key. This test enforces that invariant for the whole I18N
// object in content.js, including the Projected Board keys added in T1.5.
//
// content.js is a browser content script (not a CommonJS module), so we extract
// the I18N object text and evaluate just that literal in a sandbox-free Function.
// This keeps the test dependency-free (Node built-ins only) and avoids importing
// the DOM/Chrome globals the rest of content.js touches.
//
// All comments in English per project guidelines.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadI18N() {
  const file = path.join(__dirname, '..', 'content.js');
  const src = fs.readFileSync(file, 'utf8');

  const start = src.indexOf('const I18N = {');
  assert.notEqual(start, -1, 'I18N object not found in content.js');

  // Walk braces from the first "{" to find the matching close brace.
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.notEqual(end, -1, 'could not match the I18N closing brace');

  const literal = src.slice(braceStart, end + 1);
  // eslint-disable-next-line no-new-func
  const factory = new Function('return (' + literal + ');');
  return factory();
}

test('I18N exposes exactly the en and pt language packs', () => {
  const i18n = loadI18N();
  assert.deepEqual(Object.keys(i18n).sort(), ['en', 'pt']);
});

test('every EN key exists in PT and vice versa (no missing translations)', () => {
  const i18n = loadI18N();
  const enKeys = Object.keys(i18n.en).sort();
  const ptKeys = Object.keys(i18n.pt).sort();

  const missingInPt = enKeys.filter((k) => !(k in i18n.pt));
  const missingInEn = ptKeys.filter((k) => !(k in i18n.en));

  assert.deepEqual(missingInPt, [], 'keys present in EN but missing in PT');
  assert.deepEqual(missingInEn, [], 'keys present in PT but missing in EN');
});

test('no translation string is empty in either language', () => {
  const i18n = loadI18N();
  ['en', 'pt'].forEach((lang) => {
    Object.keys(i18n[lang]).forEach((key) => {
      const value = i18n[lang][key];
      assert.equal(typeof value, 'string', `${lang}.${key} must be a string`);
      assert.notEqual(value.trim(), '', `${lang}.${key} must not be empty`);
    });
  });
});

test('the Projected Board (T1.5) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'projectedSectionTitle',
    'projectedHelp',
    'projectedSimulationNote',
    'projectedShow',
    'projectedViewInitial',
    'projectedViewProjected',
    'projectedNoBase',
    'projectedNoCommitment',
    'projectedError',
    'projectedSummary',
    'projectedColumnCount',
    'projectedColumnDelta',
    'projectedMoveBadge',
    'projectedEmptyColumn',
    'projectedReliabilityWarning',
    'projectedReasonIncomplete',
    'projectedReasonUnknownIds',
    'projectedReasonInvalidDest',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('the Daily Comparison (T1.6) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'comparisonSectionTitle',
    'comparisonHelp',
    'comparisonRun',
    'comparisonLaterLabel',
    'comparisonNoBase',
    'comparisonNoCommitment',
    'comparisonNoLater',
    'comparisonError',
    'comparisonLoading',
    'comparisonDailyDate',
    'comparisonInitialInfo',
    'comparisonLaterInfo',
    'comparisonCommitmentInfo',
    'comparisonArchivedNote',
    'comparisonSummary',
    'comparisonUndetermined',
    'comparisonRate',
    'comparisonRateUnavailable',
    'comparisonFilterAll',
    'comparisonFilterReached',
    'comparisonFilterBeyond',
    'comparisonFilterBehind',
    'comparisonFilterOffTrack',
    'comparisonFilterMissing',
    'comparisonRow',
    'comparisonColInitial',
    'comparisonColExpected',
    'comparisonColActual',
    'comparisonActualNone',
    'comparisonEmptyFilter',
    'comparisonReliabilityWarning',
    'comparisonReasonNoLater',
    'comparisonReasonLaterIncomplete',
    'comparisonReasonInitialIncomplete',
    'comparisonReasonOrder',
    'comparisonReasonNoCommitment',
    'comparisonExplainOffTrackOrder',
    'comparisonExplainOffTrackIncompatible',
    'comparisonExplainMissingCard',
    'comparisonExplainMissingNoLater',
    'navSectionTitle',
    'navInitial',
    'navProjected',
    'navActual',
    'navComparison',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('the Daily History (T1.7) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'historySectionTitle',
    'historyHelp',
    'historyRefresh',
    'historyFromLabel',
    'historyToLabel',
    'historyApplyFilter',
    'historyClearFilter',
    'historyLoading',
    'historyError',
    'historyEmpty',
    'historyEmptyRange',
    'historySummary',
    'historyOverallRate',
    'historyOverallRateUnavailable',
    'historyUnreliableCount',
    'historyEvolutionTitle',
    'historyEvolutionPoint',
    'historyEvolutionPointUnavailable',
    'historyRecordDate',
    'historyRecordNoDate',
    'historyRecordPlanning',
    'historyRecordEvaluation',
    'historyRecordNoEvaluation',
    'historyRecordCommitment',
    'historyRecordRevisionInEffect',
    'historyRecordInferredEvaluation',
    'historyRecordMetrics',
    'historyRecordRate',
    'historyRecordRateUnavailable',
    'historyRecordUnreliable',
    'historyRecordOpen',
    'historyReasonNoBase',
    'historyReasonNoLater',
    'historyReasonIncomplete',
    'historyReasonOrder',
    'historyReasonNoCommitment',
    'historyReasonFailed',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('the Daily History (T1.7) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'historySectionTitle',
    'historyHelp',
    'historyRefresh',
    'historyFromLabel',
    'historyToLabel',
    'historyApplyFilter',
    'historyClearFilter',
    'historyLoading',
    'historyError',
    'historyEmpty',
    'historyEmptyRange',
    'historySummary',
    'historyOverallRate',
    'historyOverallRateUnavailable',
    'historyUnreliableCount',
    'historyEvolutionTitle',
    'historyEvolutionPoint',
    'historyEvolutionPointUnavailable',
    'historyRecordDate',
    'historyRecordNoDate',
    'historyRecordCommitment',
    'historyRecordRevisionInEffect',
    'historyRecordPlanning',
    'historyRecordEvaluation',
    'historyRecordNoEvaluation',
    'historyRecordInferredEvaluation',
    'historyRecordMetrics',
    'historyRecordRate',
    'historyRecordRateUnavailable',
    'historyRecordUnreliable',
    'historyRecordOpen',
    'historyReasonNoBase',
    'historyReasonNoLater',
    'historyReasonIncomplete',
    'historyReasonOrder',
    'historyReasonNoCommitment',
    'historyReasonFailed',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('the Sprint Intelligence (T2.2) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'sprintSectionTitle',
    'sprintHelp',
    'sprintRefresh',
    'sprintLoading',
    'sprintError',
    'sprintScopeMissing',
    'sprintStateApi',
    'sprintStateManual',
    'sprintStateDisabled',
    'sprintStateUnauthenticated',
    'sprintStateUnavailable',
    'sprintStateNoSprint',
    'sprintStateNone',
    'sprintUnavailableBadge',
    'sprintRealBadge',
    'sprintManualBadge',
    'sprintIdLabel',
    'sprintPathLabel',
    'sprintPeriodLabel',
    'sprintPeriodUnknown',
    'sprintDaysElapsed',
    'sprintDaysRemaining',
    'sprintDaysUnknown',
    'sprintPlannedCount',
    'sprintAddedCount',
    'sprintRemovedCount',
    'sprintCompletedCount',
    'sprintInProgressCount',
    'sprintCurrentCount',
    'sprintNoBaseline',
    'sprintRecordBaseline',
    'sprintReplaceBaseline',
    'sprintBaselineSaved',
    'sprintBaselineExists',
    'sprintBaselineNeedsSprint',
    'sprintGoalTitle',
    'sprintGoalObjective',
    'sprintGoalDescription',
    'sprintGoalCriteria',
    'sprintGoalPriorities',
    'sprintGoalSave',
    'sprintGoalSaved',
    'sprintGoalHistory',
    'sprintGoalEmpty',
    'sprintGoalNeedsSprint',
    'sprintManualTitle',
    'sprintManualId',
    'sprintManualStart',
    'sprintManualFinish',
    'sprintManualSave',
    'sprintManualSaved',
    'sprintManualNeedsId',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('the Sprint Progress (T2.3) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'progressSectionTitle',
    'progressHelp',
    'progressNoBaseline',
    'progressPrimaryTitle',
    'progressBaselinePct',
    'progressBaselinePctPartial',
    'progressBaselineCounts',
    'progressNotStarted',
    'progressInProgress',
    'progressCompleted',
    'progressUnknown',
    'progressRemoved',
    'progressSecondaryTitle',
    'progressCurrentPct',
    'progressCurrentCounts',
    'progressAdded',
    'progressAddedCompleted',
    'progressScopeDelta',
    'progressColumnsTitle',
    'progressColumnRow',
    'progressColumnUnknown',
    'progressReliabilityTitle',
    'progressReliabilitySufficient',
    'progressReliabilityPartial',
    'progressReliabilityUnavailable',
    'progressLateBaseline',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('the Sprint Trends & Risk (T2.4) keys are present in both languages', () => {
  const i18n = loadI18N();
  const required = [
    'trendsSectionTitle',
    'trendsHelp',
    'trendsRecordObservation',
    'trendsRefresh',
    'trendsObservationSaved',
    'trendsObservationNeedsSprint',
    'trendsNoBaseline',
    'trendsNoHistory',
    'trendsSingleObservation',
    'trendsObservationCount',
    'trendsLastObservation',
    'trendsViewProgress',
    'trendsViewScope',
    'trendsViewTrends',
    'trendsTimeTitle',
    'trendsElapsed',
    'trendsElapsedUnknown',
    'trendsReference',
    'trendsObservedCompletion',
    'trendsDeviation',
    'trendsSeriesTitle',
    'trendsSeriesPoint',
    'trendsSeriesPointPartial',
    'trendsBurnTitle',
    'trendsBurnupPoint',
    'trendsBurndownPoint',
    'trendsBurnNote',
    'trendsScopeTitle',
    'trendsScopeInterval',
    'trendsScopeAdded',
    'trendsScopeRemoved',
    'trendsScopeReturned',
    'trendsScopeNone',
    'trendsRiskTitle',
    'trendsRiskOnTrack',
    'trendsRiskAttention',
    'trendsRiskAtRisk',
    'trendsRiskInsufficient',
    'trendsRiskSignalsTitle',
    'trendsRiskNoSignals',
    'trendsSignalBehindReference',
    'trendsSignalLateLowCompletion',
    'trendsSignalScopeGrowth',
    'trendsSignalStagnation',
    'trendsSignalUnknownShare',
    'trendsRiskInsufficientReason',
    'trendsRiskDisclaimer',
  ];
  required.forEach((key) => {
    assert.ok(key in i18n.en, `EN missing ${key}`);
    assert.ok(key in i18n.pt, `PT missing ${key}`);
  });
});

test('placeholder tokens match between EN and PT for shared keys', () => {
  const i18n = loadI18N();
  const tokenRe = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  function tokensOf(str) {
    const set = new Set();
    let m;
    while ((m = tokenRe.exec(str)) !== null) set.add(m[1]);
    return [...set].sort();
  }
  Object.keys(i18n.en).forEach((key) => {
    if (!(key in i18n.pt)) return;
    assert.deepEqual(
      tokensOf(i18n.en[key]),
      tokensOf(i18n.pt[key]),
      `placeholder tokens differ for key "${key}"`
    );
  });
});
