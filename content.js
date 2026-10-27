// content.js

// ============================================================================
// 1. VISUAL ALERT AND PANEL STYLES (CSS)
// ============================================================================
// Inject styles used by the floating indicator, alert states, and details panel.
const I18N = {
  en: {
    outdatedExtension: 'Your extension is outdated. Please update it. The download link is in the console.',
    indicatorConfigureLimit: 'WIP: {{current}} (configure limit in extension)',
    indicatorTotal: 'Total Board WIP: {{current}} / {{limit}}',
    indicatorColumnBottlenecks: 'Column bottlenecks:',
    indicatorMissingConfig: '⚙️ Configure board keyword and WIP columns in the extension popup.',
    alertTitle: 'Critical alert:',
    agingCritical: 'Aging is critical ({{days}} days)',
    agingHigh: 'Aging is high ({{days}} days)',
    agingWarning: 'Aging is warning ({{days}} days)',
    targetDate: 'Target date: {{status}}',
    targetOverdue: 'OVERDUE',
    targetDaysLeft: '{{days}} day(s) left',
    // Daily Snapshot Capture (roadmap T1.2).
    snapshotPanelTitle: 'Daily Snapshot',
    snapshotCapture: 'Capture snapshot',
    snapshotLatest: 'View last snapshot',
    snapshotHistory: 'View history',
    snapshotLocalOnly: 'Snapshots are stored only on this browser (not shared with the team).',
    snapshotCapturing: 'Capturing…',
    snapshotCaptured: 'Snapshot captured: {{items}} work items across {{columns}} columns.',
    snapshotCapturedIncomplete: 'Snapshot captured, but flagged incomplete ({{reasons}}).',
    snapshotNone: 'No snapshot captured yet for this board.',
    snapshotLatestInfo: 'Last capture: {{when}} — {{items}} work items.',
    snapshotIncompleteBadge: 'incomplete',
    snapshotCompleteBadge: 'complete',
    snapshotHistoryEmpty: 'No snapshots in history for this board.',
    snapshotHistoryItem: '{{when}} — {{items}} items ({{status}})',
    snapshotColumnCount: '{{name}}: {{count}}',
    snapshotError: 'Snapshot failed: {{message}}',
    snapshotScopeMissing: 'Cannot capture: board organization/project not detected on this page.',
    reasonEmptyBoard: 'empty board',
    reasonHiddenItems: 'hidden/filtered cards',
    reasonNoColumns: 'no columns',
    reasonDuplicateIds: 'duplicate ids',
    reasonMissingIds: 'cards without id',
    // Daily Commitment (roadmap T1.3): a delivery metric kept separate from WIP.
    commitmentSectionTitle: 'Daily commitment (plan vs actual)',
    commitmentHelp: 'Pick the work items you commit to move today and choose each destination column. Based on the last captured snapshot.',
    commitmentSave: 'Save commitment',
    commitmentCompare: 'Plan vs actual',
    commitmentSaving: 'Saving commitment…',
    commitmentSaved: 'Commitment saved: {{items}} item(s).',
    commitmentRevised: 'Commitment updated (revision {{revision}}): {{items}} item(s).',
    commitmentNoBase: 'Capture a snapshot first: a commitment is based on a captured state.',
    commitmentNoInput: 'Select at least one work item and choose its destination column.',
    commitmentUnknownIds: 'Ignored ids not on the base snapshot: {{ids}}.',
    commitmentNone: 'No commitment saved yet for this board.',
    commitmentError: 'Commitment failed: {{message}}',
    commitmentSummary: 'Reached {{reached}} · behind {{behind}} · beyond {{beyond}} · off-track {{offTrack}} · missing {{missing}} (of {{committed}}).',
    commitmentRow: '#{{id}}: expected {{expected}} → actual {{actual}} [{{status}}]',
    commitmentActualNone: '—',
    statusReached: 'reached',
    statusBehind: 'behind',
    statusBeyond: 'beyond',
    statusOffTrack: 'off-track',
    statusMissing: 'missing',
    // Daily Commitment Card Picker (roadmap T1.4): the visual selection UI.
    commitmentPickerLoad: 'Choose work items',
    commitmentSearchPlaceholder: 'Search by id or title…',
    commitmentPickEmpty: 'No work items in the base snapshot. Capture a snapshot first.',
    commitmentPickNoMatch: 'No work item matches the search.',
    commitmentColDestination: 'Destination',
    commitmentDestinationPlaceholder: 'Destination column…',
    commitmentCurrentColumn: 'Now: {{column}}',
    commitmentOffBoard: 'off board',
    commitmentNoAssignee: 'Unassigned',
    commitmentPlanSummary: 'Selected {{selected}} of {{total}} · {{withDestination}} with destination.',
    commitmentMissingDestination: '{{count}} selected item(s) still need a destination column.',
    commitmentUntitled: '(no title)',
    // Projected Board (roadmap T1.5): the simulated end-of-day board.
    projectedSectionTitle: 'Projected board (simulation)',
    projectedHelp: 'Simulates how the board should look at end of day if every commitment is honored. It does not change Azure DevOps.',
    projectedSimulationNote: 'Simulation only — no work item is moved in Azure DevOps.',
    projectedShow: 'Projected board',
    projectedViewInitial: 'Initial board',
    projectedViewProjected: 'Projected board',
    projectedNoBase: 'Capture a snapshot first: the projection is based on a captured state.',
    projectedNoCommitment: 'No commitment for this snapshot yet. Choose work items and save a commitment to project the board.',
    projectedError: 'Projection failed: {{message}}',
    projectedSummary: 'Snapshot {{items}} cards · {{committed}} commitments · {{moves}} planned change(s).',
    projectedColumnCount: '{{count}}',
    projectedColumnDelta: '{{sign}}{{delta}}',
    projectedMoveBadge: 'from {{from}}',
    projectedEmptyColumn: '—',
    projectedReliabilityWarning: 'Reliability warning: {{reasons}}.',
    projectedReasonIncomplete: 'baseline snapshot incomplete',
    projectedReasonUnknownIds: 'committed ids not on the snapshot',
    projectedReasonInvalidDest: 'invalid destination columns',
    // Daily Comparison (roadmap T1.6): plan vs. an observed later snapshot.
    comparisonSectionTitle: 'Daily Comparison',
    comparisonHelp: 'Compare what was planned in the daily against a later observed snapshot of the same board. It does not change Azure DevOps.',
    comparisonRun: 'Compare daily',
    comparisonLaterLabel: 'Later snapshot:',
    comparisonNoBase: 'Capture a snapshot first: the comparison is based on a captured plan.',
    comparisonNoCommitment: 'No commitment for this board yet. Save a commitment to compare the daily.',
    comparisonNoLater: 'No later snapshot available yet. Capture another snapshot after the planning one to compare.',
    comparisonError: 'Comparison failed: {{message}}',
    comparisonLoading: 'Comparing…',
    comparisonDailyDate: 'Daily: {{date}}',
    comparisonInitialInfo: 'Initial snapshot: {{when}}',
    comparisonLaterInfo: 'Later snapshot: {{when}}',
    comparisonCommitmentInfo: 'Commitment revision {{revision}} ({{when}})',
    comparisonArchivedNote: 'Comparing against the historical plan (revision {{revision}}), not a newer one.',
    comparisonSummary: 'Planned {{committed}} · reached {{reached}} · beyond {{beyond}} · behind {{behind}} · off-track {{offTrack}} · missing {{missing}}.',
    comparisonUndetermined: 'Undetermined (no proven failure): {{count}} — off-track {{offTrack}}, missing {{missing}}.',
    comparisonRate: 'Proven fulfillment rate: {{rate}}%',
    comparisonRateUnavailable: 'Proven fulfillment rate: unavailable (insufficient or unreliable data).',
    comparisonFilterAll: 'All',
    comparisonFilterReached: 'Reached',
    comparisonFilterBeyond: 'Beyond',
    comparisonFilterBehind: 'Behind',
    comparisonFilterOffTrack: 'Off-track',
    comparisonFilterMissing: 'Missing',
    comparisonRow: '#{{id}}: {{start}} → expected {{expected}} → observed {{actual}} [{{status}}]',
    comparisonColInitial: 'initial',
    comparisonColExpected: 'expected',
    comparisonColActual: 'observed',
    comparisonActualNone: '—',
    comparisonEmptyFilter: 'No work item in this result category.',
    comparisonReliabilityWarning: 'Reliability: {{reasons}}.',
    comparisonReasonNoLater: 'no later snapshot',
    comparisonReasonLaterIncomplete: 'later snapshot incomplete',
    comparisonReasonInitialIncomplete: 'initial snapshot incomplete',
    comparisonReasonOrder: 'unreliable column order',
    comparisonReasonNoCommitment: 'no commitment',
    comparisonExplainOffTrackOrder: 'Direction cannot be established: the board exposes no reliable column order.',
    comparisonExplainOffTrackIncompatible: 'Observed column is not on the expected flow; progress cannot be established.',
    comparisonExplainMissingCard: 'The work item is not present in the later snapshot; its result cannot be determined.',
    comparisonExplainMissingNoLater: 'No later snapshot to observe the work item in.',
    // Navigation across the four daily views (roadmap T1.6 §6).
    navSectionTitle: 'Daily views',
    navInitial: 'Initial board',
    navProjected: 'Projected board',
    navActual: 'Actual result',
    navComparison: 'Commitment comparison',
  },
  pt: {
    outdatedExtension: 'Sua extensão está desatualizada. Por favor, atualize. O link de download está no console.',
    indicatorConfigureLimit: 'WIP: {{current}} (configure o limite na extensão)',
    indicatorTotal: 'WIP Total do Board: {{current}} / {{limit}}',
    indicatorColumnBottlenecks: 'Gargalos por Coluna:',
    indicatorMissingConfig: '⚙️ Configure a palavra-chave do board e as colunas WIP no popup da extensão.',
    alertTitle: 'Alerta crítico:',
    agingCritical: 'Aging muito alto ({{days}} dias)',
    agingHigh: 'Aging alto ({{days}} dias)',
    agingWarning: 'Aging em atenção ({{days}} dias)',
    targetDate: 'Prazo: {{status}}',
    targetOverdue: 'ATRASADO',
    targetDaysLeft: 'Faltam {{days}} dia(s)',
    // Captura de Snapshot Diário (roadmap T1.2).
    snapshotPanelTitle: 'Snapshot Diário',
    snapshotCapture: 'Capturar snapshot',
    snapshotLatest: 'Ver último snapshot',
    snapshotHistory: 'Ver histórico',
    snapshotLocalOnly: 'Os snapshots ficam salvos apenas neste navegador (não são compartilhados com a equipe).',
    snapshotCapturing: 'Capturando…',
    snapshotCaptured: 'Snapshot capturado: {{items}} work items em {{columns}} colunas.',
    snapshotCapturedIncomplete: 'Snapshot capturado, mas marcado como incompleto ({{reasons}}).',
    snapshotNone: 'Nenhum snapshot capturado ainda para este board.',
    snapshotLatestInfo: 'Última captura: {{when}} — {{items}} work items.',
    snapshotIncompleteBadge: 'incompleto',
    snapshotCompleteBadge: 'completo',
    snapshotHistoryEmpty: 'Sem snapshots no histórico deste board.',
    snapshotHistoryItem: '{{when}} — {{items}} itens ({{status}})',
    snapshotColumnCount: '{{name}}: {{count}}',
    snapshotError: 'Falha no snapshot: {{message}}',
    snapshotScopeMissing: 'Não é possível capturar: organização/projeto do board não detectados nesta página.',
    reasonEmptyBoard: 'board vazio',
    reasonHiddenItems: 'cards ocultos/filtrados',
    reasonNoColumns: 'sem colunas',
    reasonDuplicateIds: 'ids duplicados',
    reasonMissingIds: 'cards sem id',
    // Compromisso diário (roadmap T1.3): métrica de entrega, separada do WIP.
    commitmentSectionTitle: 'Compromisso diário (planejado x realizado)',
    commitmentHelp: 'Selecione os work items que você se compromete a mover hoje e escolha a coluna de destino de cada um. Baseado no último snapshot capturado.',
    commitmentSave: 'Salvar compromisso',
    commitmentCompare: 'Planejado x realizado',
    commitmentSaving: 'Salvando compromisso…',
    commitmentSaved: 'Compromisso salvo: {{items}} item(ns).',
    commitmentRevised: 'Compromisso atualizado (revisão {{revision}}): {{items}} item(ns).',
    commitmentNoBase: 'Capture um snapshot primeiro: o compromisso é baseado em um estado capturado.',
    commitmentNoInput: 'Selecione ao menos um work item e escolha a coluna de destino.',
    commitmentUnknownIds: 'Ids ignorados (ausentes do snapshot base): {{ids}}.',
    commitmentNone: 'Nenhum compromisso salvo ainda para este board.',
    commitmentError: 'Falha no compromisso: {{message}}',
    commitmentSummary: 'Atingiu {{reached}} · aquém {{behind}} · além {{beyond}} · indefinido {{offTrack}} · sumiu {{missing}} (de {{committed}}).',
    commitmentRow: '#{{id}}: esperado {{expected}} → atual {{actual}} [{{status}}]',
    commitmentActualNone: '—',
    statusReached: 'atingiu',
    statusBehind: 'aquém',
    statusBeyond: 'além',
    statusOffTrack: 'indefinido',
    statusMissing: 'sumiu',
    // Seletor visual de cards do compromisso (roadmap T1.4).
    commitmentPickerLoad: 'Escolher work items',
    commitmentSearchPlaceholder: 'Buscar por id ou título…',
    commitmentPickEmpty: 'Nenhum work item no snapshot base. Capture um snapshot primeiro.',
    commitmentPickNoMatch: 'Nenhum work item corresponde à busca.',
    commitmentColDestination: 'Destino',
    commitmentDestinationPlaceholder: 'Coluna de destino…',
    commitmentCurrentColumn: 'Agora: {{column}}',
    commitmentOffBoard: 'fora do board',
    commitmentNoAssignee: 'Sem responsável',
    commitmentPlanSummary: 'Selecionados {{selected}} de {{total}} · {{withDestination}} com destino.',
    commitmentMissingDestination: '{{count}} item(ns) selecionado(s) ainda sem coluna de destino.',
    commitmentUntitled: '(sem título)',
    // Board projetado (roadmap T1.5): o board simulado de fim de dia.
    projectedSectionTitle: 'Board projetado (simulação)',
    projectedHelp: 'Simula como o board deveria estar ao final do dia se todos os compromissos forem cumpridos. Não altera o Azure DevOps.',
    projectedSimulationNote: 'Apenas simulação — nenhum work item é movido no Azure DevOps.',
    projectedShow: 'Board projetado',
    projectedViewInitial: 'Board inicial',
    projectedViewProjected: 'Board projetado',
    projectedNoBase: 'Capture um snapshot primeiro: a projeção é baseada em um estado capturado.',
    projectedNoCommitment: 'Ainda não há compromisso para este snapshot. Escolha work items e salve um compromisso para projetar o board.',
    projectedError: 'Falha na projeção: {{message}}',
    projectedSummary: 'Snapshot {{items}} cards · {{committed}} compromissos · {{moves}} mudança(s) planejada(s).',
    projectedColumnCount: '{{count}}',
    projectedColumnDelta: '{{sign}}{{delta}}',
    projectedMoveBadge: 'de {{from}}',
    projectedEmptyColumn: '—',
    projectedReliabilityWarning: 'Aviso de confiabilidade: {{reasons}}.',
    projectedReasonIncomplete: 'snapshot base incompleto',
    projectedReasonUnknownIds: 'ids com compromisso ausentes do snapshot',
    projectedReasonInvalidDest: 'colunas de destino inválidas',
    // Comparação da Daily (roadmap T1.6): planejado x snapshot posterior.
    comparisonSectionTitle: 'Comparação da Daily',
    comparisonHelp: 'Compara o que foi planejado na daily com um snapshot posterior observado do mesmo board. Não altera o Azure DevOps.',
    comparisonRun: 'Comparar daily',
    comparisonLaterLabel: 'Snapshot posterior:',
    comparisonNoBase: 'Capture um snapshot primeiro: a comparação é baseada em um plano capturado.',
    comparisonNoCommitment: 'Ainda não há compromisso para este board. Salve um compromisso para comparar a daily.',
    comparisonNoLater: 'Ainda não há snapshot posterior disponível. Capture outro snapshot após o de planejamento para comparar.',
    comparisonError: 'Falha na comparação: {{message}}',
    comparisonLoading: 'Comparando…',
    comparisonDailyDate: 'Daily: {{date}}',
    comparisonInitialInfo: 'Snapshot inicial: {{when}}',
    comparisonLaterInfo: 'Snapshot posterior: {{when}}',
    comparisonCommitmentInfo: 'Compromisso revisão {{revision}} ({{when}})',
    comparisonArchivedNote: 'Comparando com o plano histórico (revisão {{revision}}), não com um mais recente.',
    comparisonSummary: 'Planejado {{committed}} · atingiu {{reached}} · além {{beyond}} · aquém {{behind}} · indefinido {{offTrack}} · sumiu {{missing}}.',
    comparisonUndetermined: 'Não determinados (sem falha comprovada): {{count}} — indefinido {{offTrack}}, sumiu {{missing}}.',
    comparisonRate: 'Taxa de cumprimento comprovado: {{rate}}%',
    comparisonRateUnavailable: 'Taxa de cumprimento comprovado: indisponível (dados insuficientes ou não confiáveis).',
    comparisonFilterAll: 'Todos',
    comparisonFilterReached: 'Cumpridos',
    comparisonFilterBeyond: 'Além do planejado',
    comparisonFilterBehind: 'Pendentes',
    comparisonFilterOffTrack: 'Fora do esperado',
    comparisonFilterMissing: 'Sem evidência',
    comparisonRow: '#{{id}}: {{start}} → esperado {{expected}} → observado {{actual}} [{{status}}]',
    comparisonColInitial: 'inicial',
    comparisonColExpected: 'esperada',
    comparisonColActual: 'observada',
    comparisonActualNone: '—',
    comparisonEmptyFilter: 'Nenhum work item nesta categoria de resultado.',
    comparisonReliabilityWarning: 'Confiabilidade: {{reasons}}.',
    comparisonReasonNoLater: 'sem snapshot posterior',
    comparisonReasonLaterIncomplete: 'snapshot posterior incompleto',
    comparisonReasonInitialIncomplete: 'snapshot inicial incompleto',
    comparisonReasonOrder: 'ordem de colunas não confiável',
    comparisonReasonNoCommitment: 'sem compromisso',
    comparisonExplainOffTrackOrder: 'Não é possível estabelecer a direção: o board não expõe uma ordem de colunas confiável.',
    comparisonExplainOffTrackIncompatible: 'A coluna observada não está no fluxo esperado; o progresso não pode ser estabelecido.',
    comparisonExplainMissingCard: 'O work item não está presente no snapshot posterior; o resultado não pode ser determinado.',
    comparisonExplainMissingNoLater: 'Não há snapshot posterior para observar o work item.',
    // Navegação entre as quatro visões da daily (roadmap T1.6 §6).
    navSectionTitle: 'Visões da daily',
    navInitial: 'Board inicial',
    navProjected: 'Board projetado',
    navActual: 'Resultado real',
    navComparison: 'Comparação dos compromissos',
  },
};

// Pure helpers (i18n, text normalization, WIP math, alarm severity) are provided
// by the WIPBoardCore module (src/core/wip-logic.js), loaded before this file by
// the manifest content_scripts order. Binding them locally keeps call sites short
// and removes the previously duplicated inline implementations (roadmap T0.3).
//
// Module resilience (roadmap T0.5): WIPBoardCore and WIPBoardReader are REQUIRED
// dependencies. If the manifest load order is broken, a script fails to parse, or
// the page strips the namespace, the runtime must NOT silently degrade into
// "board empty / WIP = 0" (which would hide a real board behind a false zero).
// Detect the missing module explicitly and surface a diagnostic instead.
const MODULE_LOAD_ERROR_PREFIX = '[WIP-Board] Required module failed to load';

function assertRequiredModules() {
  // Returns the resolved modules, or an Error describing exactly what is missing
  // so the failure is diagnosable from the console rather than appearing as a
  // mysteriously empty board.
  const missing = [];
  if (typeof WIPBoardCore === 'undefined' || !WIPBoardCore) {
    missing.push('WIPBoardCore (src/core/wip-logic.js)');
  }
  if (typeof WIPBoardReader === 'undefined' || !WIPBoardReader) {
    missing.push('WIPBoardReader (src/data/board-dom-reader.js)');
  }
  if (missing.length > 0) {
    return new Error(
      `${MODULE_LOAD_ERROR_PREFIX}: ${missing.join(', ')}. ` +
        'Check manifest.json content_scripts load order.'
    );
  }
  return null;
}

const Core = (typeof WIPBoardCore !== 'undefined' && WIPBoardCore) || {};
const getLanguageCode = Core.getLanguageCode || ((value) => (value === 'pt' ? 'pt' : 'en'));
const formatMessage = Core.formatMessage;
const normalizeText = Core.normalizeText;
const normalizeColumnName = Core.normalizeColumnName;
const isConfiguredWipColumn = Core.isConfiguredWipColumn;
const getCardSeverityClass = Core.getCardSeverityClass;

function getLanguagePack(languageCode) {
  const lang = I18N[getLanguageCode(languageCode)] || I18N.en;
  return {
    t(key, tokens) {
      return formatMessage(lang[key] || I18N.en[key] || key, tokens);
    },
  };
}

function getStorageValues(keys) {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, values => resolve(values || {}));
  });
}

async function getVersion() {
  try {
    const languageData = await getStorageValues(['language']);
    const i18n = getLanguagePack(languageData.language);

    // Remote check is best-effort. If network fails, skip warning to avoid false positives.
    const webResponse = await fetch('https://raw.githubusercontent.com/mateussmeneses/wip-board-azure/refs/heads/master/version.json', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!webResponse.ok) {
      console.debug('[WIP-Board] Version check skipped (remote unavailable).', webResponse.status);
      return;
    }

    const web = await webResponse.json();
    const local = await fetch(chrome.runtime.getURL('version.json'), { cache: 'no-store' }).then(r => r.json());

    const webVersion = String(web?.version || '').trim();
    const localVersion = String(local?.version || '').trim();

    // Only notify when both versions are valid and explicitly different.
    if (!webVersion || !localVersion || webVersion === localVersion) return;

    alert(i18n.t('outdatedExtension'));
    console.clear();
    console.warn('https://codeload.github.com/mateussmeneses/wip-board-azure/zip/refs/heads/master');
  } catch (err) {
    // Silent fallback: version check should never break runtime flow.
    console.debug('[WIP-Board] Version check skipped (error).', err);
  }
}

getVersion()


if (!document.getElementById('wip-alarm-style')) {
  const style = document.createElement('style');
  style.id = 'wip-alarm-style';
  style.innerHTML = `
    /* Floating indicator animation when WIP exceeds limit */
    @keyframes pulse-critical {
      0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.8); }
      70% { box-shadow: 0 0 0 15px rgba(220, 53, 69, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
    }
    .wip-alerta-critico {
      animation: pulse-critical 1.5s infinite !important;
      background-color: #dc3545 !important;
      color: white !important;
      border: 3px solid #721c24 !important;
      text-transform: uppercase;
    }
    @keyframes pulse-wip-warning {
      0% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.7); transform: translateX(-50%) scale(1); }
      70% { box-shadow: 0 0 0 18px rgba(234, 88, 12, 0); transform: translateX(-50%) scale(1.02); }
      100% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0); transform: translateX(-50%) scale(1); }
    }
    .wip-alerta-atenção {
      animation: pulse-wip-warning 1.7s infinite !important;
      background: linear-gradient(135deg, #fff7ed, #fed7aa) !important;
      color: #9a3412 !important;
      border: 3px solid #ea580c !important;
      text-transform: uppercase;
    }

    /* Orange animation for cards with critical aging/target-date conditions */
    @keyframes pulse-card {
      0% { box-shadow: 0 0 0 0 rgba(245, 139, 31, 0.6); }
      70% { box-shadow: 0 0 0 8px rgba(245, 139, 31, 0); }
      100% { box-shadow: 0 0 0 0 rgba(245, 139, 31, 0); }
    }
    .card-alerta-critico {

      box-shadow: 0 0 0 3px #c2410c !important;
      
      background: linear-gradient(90deg, rgba(194, 65, 12, 0.24), rgba(255, 255, 255, 0)) !important;
      animation: pulse-card 1.4s infinite !important;
    }
    .card-alerta-alto {
      box-shadow: 0 0 0 3px #ea580c !important;
      background: linear-gradient(90deg, rgba(234, 88, 12, 0.18), rgba(255, 255, 255, 0)) !important;
    }
    .card-alerta-medio {
      box-shadow: 0 0 0 3px #f97316 !important;
      background: linear-gradient(90deg, rgba(249, 115, 22, 0.14), rgba(255, 255, 255, 0)) !important;
    }
    .card-alerta-baixo {
      box-shadow: 0 0 0 3px #fb923c !important;
      border: 3px solid #fb923c !important;
      background: linear-gradient(90deg, rgba(251, 146, 60, 0.1), rgba(255, 255, 255, 0)) !important;
    }
    
    /* Layout for the details panel toggled from the indicator */
    #wip-details-panel {
      display: none; /* Hidden by default */
      margin-top: 10px;
      padding: 10px;
      border-top: 1px solid rgba(0,0,0,0.1); /* Subtle separator under panel header */
      font-size: 13px;
      font-weight: normal;
      text-transform: none;
      text-align: left;
      border-radius: 10px;
      background: rgba(255,255,255,0.95);
      color: #1f2937;
    }
    .wip-alerta-critico #wip-details-panel {
      background: #fff5f5;
      color: #111827;
      border: 1px solid #fecaca;
    }
    .wip-alerta-atenção #wip-details-panel {
      background: #fff7ed;
      color: #111827;
      border: 1px solid #fed7aa;
    }
    /* Per-row layout: column name on left, count on right */
    .wip-detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .wip-detail-name { color: inherit; }
    .wip-detail-count { font-weight: bold; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px; }

    /* Daily Snapshot panel (roadmap T1.2): a discrete, collapsible side panel
       anchored bottom-right so it never overlaps the board content. */
    #wip-snapshot-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999998;
      width: 280px;
      font-family: inherit;
      font-size: 13px;
      color: #1f2937;
    }
    #wip-snapshot-toggle {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      background: #0078d4;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    #wip-snapshot-toggle:hover { background: #005a9e; }
    #wip-snapshot-body {
      display: none;
      margin-top: 8px;
      padding: 12px;
      background: #ffffff;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    #wip-snapshot-panel.open #wip-snapshot-body { display: block; }
    #wip-snapshot-panel .wip-snap-note {
      font-size: 11px;
      color: #666;
      margin: 0 0 10px 0;
    }
    #wip-snapshot-panel .wip-snap-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    #wip-snapshot-panel .wip-snap-btn {
      width: 100%;
      box-sizing: border-box;
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid #0078d4;
      background: #f0f9ff;
      color: #0369a1;
      font-weight: bold;
      cursor: pointer;
      margin: 0;
    }
    #wip-snapshot-panel .wip-snap-btn:hover { background: #e0f2fe; }
    #wip-snapshot-panel .wip-snap-btn:disabled { opacity: 0.6; cursor: default; }
    #wip-snapshot-panel .wip-snap-status {
      font-size: 12px;
      margin: 8px 0 0 0;
      min-height: 16px;
    }
    #wip-snapshot-panel .wip-snap-status.ok { color: #1e8e3e; }
    #wip-snapshot-panel .wip-snap-status.err { color: #cc292b; }
    #wip-snapshot-panel .wip-snap-output {
      margin-top: 8px;
      max-height: 180px;
      overflow-y: auto;
      font-size: 12px;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
    #wip-snapshot-panel .wip-snap-output:empty { display: none; }
    #wip-snapshot-panel .wip-snap-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 2px 0;
    }
    #wip-snapshot-panel .wip-snap-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      padding: 1px 6px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    #wip-snapshot-panel .wip-snap-badge.complete { background: #e6f4ea; color: #1e8e3e; }
    #wip-snapshot-panel .wip-snap-badge.incomplete { background: #fff3cd; color: #856404; }

    /* Daily Commitment section (roadmap T1.3): a discrete sub-section inside the
       same snapshot panel. It is a DELIVERY projection, visually distinct from
       the WIP indicator and never altering the WIP number. */
    #wip-snapshot-panel .wip-commit-section {
      margin-top: 10px;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }
    #wip-snapshot-panel .wip-commit-section h4 {
      margin: 0 0 6px 0;
      font-size: 12px;
      color: #1f2937;
    }
    #wip-snapshot-panel .wip-commit-help {
      font-size: 11px;
      color: #666;
      margin: 0 0 6px 0;
    }
    /* Daily Commitment Card Picker (roadmap T1.4): a compact, searchable list of
       work items with a checkbox and a destination dropdown per card. Replaces
       the former free-text "id: column" textarea with a visual selection. */
    #wip-snapshot-panel .wip-commit-search {
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 12px;
      padding: 6px;
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 6px;
    }
    #wip-snapshot-panel .wip-commit-list {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid #eee;
      border-radius: 6px;
    }
    #wip-snapshot-panel .wip-commit-list:empty { display: none; }
    #wip-snapshot-panel .wip-commit-pick {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 6px;
      border-bottom: 1px solid #f1f1f1;
    }
    #wip-snapshot-panel .wip-commit-pick:last-child { border-bottom: none; }
    #wip-snapshot-panel .wip-commit-pick.off-board { opacity: 0.75; }
    #wip-snapshot-panel .wip-commit-pick input[type="checkbox"] {
      margin-top: 2px;
      flex: 0 0 auto;
    }
    #wip-snapshot-panel .wip-commit-pick-main {
      flex: 1 1 auto;
      min-width: 0;
    }
    #wip-snapshot-panel .wip-commit-pick-title {
      font-size: 12px;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #wip-snapshot-panel .wip-commit-pick-meta {
      font-size: 10px;
      color: #6b7280;
      margin-top: 1px;
    }
    #wip-snapshot-panel .wip-commit-pick-off {
      color: #cc292b;
      font-weight: bold;
    }
    #wip-snapshot-panel .wip-commit-dest {
      margin-top: 4px;
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 11px;
      padding: 3px 4px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    #wip-snapshot-panel .wip-commit-empty {
      font-size: 11px;
      color: #6b7280;
      padding: 8px 4px;
    }
    #wip-snapshot-panel .wip-commit-plan {
      font-size: 11px;
      color: #374151;
      margin: 6px 0;
    }
    #wip-snapshot-panel .wip-commit-plan .wip-commit-missing { color: #cc292b; }
    #wip-snapshot-panel .wip-commit-output {
      margin-top: 8px;
      max-height: 160px;
      overflow-y: auto;
      font-size: 12px;
    }
    #wip-snapshot-panel .wip-commit-output:empty { display: none; }
    #wip-snapshot-panel .wip-commit-summary {
      font-size: 11px;
      color: #374151;
      margin: 6px 0;
    }
    #wip-snapshot-panel .wip-commit-row {
      padding: 2px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #wip-snapshot-panel .wip-commit-status {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      padding: 1px 6px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    #wip-snapshot-panel .wip-commit-status.reached { background: #e6f4ea; color: #1e8e3e; }
    #wip-snapshot-panel .wip-commit-status.beyond { background: #e8f0fe; color: #1a56db; }
    #wip-snapshot-panel .wip-commit-status.behind { background: #fff3cd; color: #856404; }
    #wip-snapshot-panel .wip-commit-status.off-track { background: #f3f4f6; color: #4b5563; }
    #wip-snapshot-panel .wip-commit-status.missing { background: #fde8e8; color: #cc292b; }
    /* Projected Board (roadmap T1.5). A light, column-oriented simulation view. */
    #wip-snapshot-panel .wip-projected-section {
      border-top: 1px dashed #d0d7de;
      margin-top: 10px;
      padding-top: 8px;
    }
    #wip-snapshot-panel .wip-projected-section h4 {
      margin: 0 0 4px 0;
      font-size: 12px;
      color: #1f2937;
    }
    #wip-snapshot-panel .wip-projected-help {
      font-size: 10px;
      color: #6b7280;
      margin: 0 0 6px 0;
    }
    #wip-snapshot-panel .wip-projected-toggle {
      display: inline-flex;
      gap: 4px;
      margin: 4px 0;
    }
    #wip-snapshot-panel .wip-projected-tab {
      font-size: 11px;
      padding: 3px 8px;
      border: 1px solid #c2c8d0;
      border-radius: 4px;
      background: #f8fafc;
      color: #1f2937;
      cursor: pointer;
    }
    #wip-snapshot-panel .wip-projected-tab.active {
      background: #0b5fff;
      border-color: #0b5fff;
      color: #fff;
    }
    #wip-snapshot-panel .wip-projected-sim-note {
      font-size: 10px;
      color: #856404;
      background: #fff8e1;
      border-radius: 4px;
      padding: 2px 6px;
      margin: 4px 0;
      display: inline-block;
    }
    #wip-snapshot-panel .wip-projected-summary {
      font-size: 11px;
      color: #374151;
      margin: 6px 0;
    }
    #wip-snapshot-panel .wip-projected-reliability {
      font-size: 10px;
      color: #cc292b;
      margin: 2px 0 6px 0;
    }
    #wip-snapshot-panel .wip-projected-board {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }
    #wip-snapshot-panel .wip-projected-col {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 4px 6px;
      background: #fcfcfd;
    }
    #wip-snapshot-panel .wip-projected-col-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 11px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 3px;
    }
    #wip-snapshot-panel .wip-projected-col-count { color: #4b5563; font-weight: 500; }
    #wip-snapshot-panel .wip-projected-col-delta { font-size: 10px; margin-left: 4px; }
    #wip-snapshot-panel .wip-projected-col-delta.up { color: #1e8e3e; }
    #wip-snapshot-panel .wip-projected-col-delta.down { color: #cc292b; }
    #wip-snapshot-panel .wip-projected-cards {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }
    #wip-snapshot-panel .wip-projected-card {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      background: #eef2f7;
      color: #1f2937;
    }
    #wip-snapshot-panel .wip-projected-card.moved {
      background: #e8f0fe;
      border: 1px solid #1a56db;
      color: #1a56db;
    }
    #wip-snapshot-panel .wip-projected-empty { font-size: 10px; color: #9ca3af; }

    /* Daily views navigation (roadmap T1.6 §6): switch between the four views. */
    #wip-snapshot-panel .wip-nav-section {
      border-top: 1px solid #eee;
      margin-top: 10px;
      padding-top: 10px;
    }
    #wip-snapshot-panel .wip-nav-section h4 {
      margin: 0 0 6px 0;
      font-size: 12px;
      color: #1f2937;
    }
    #wip-snapshot-panel .wip-nav-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    #wip-snapshot-panel .wip-nav-tab {
      font-size: 11px;
      padding: 3px 8px;
      border: 1px solid #c9d4e3;
      border-radius: 12px;
      background: #f4f7fb;
      color: #1f2937;
      cursor: pointer;
    }
    #wip-snapshot-panel .wip-nav-tab.active {
      background: #0b5fff;
      border-color: #0b5fff;
      color: #fff;
    }

    /* Daily Comparison (roadmap T1.6). Compact comparison cards, result filters. */
    #wip-snapshot-panel .wip-comparison-section {
      border-top: 1px dashed #d0d7de;
      margin-top: 10px;
      padding-top: 8px;
    }
    #wip-snapshot-panel .wip-comparison-section h4 {
      margin: 0 0 4px 0;
      font-size: 12px;
      color: #1f2937;
    }
    #wip-snapshot-panel .wip-comparison-help {
      font-size: 10px;
      color: #6b7280;
      margin: 0 0 6px 0;
    }
    #wip-snapshot-panel .wip-comparison-later {
      width: 100%;
      box-sizing: border-box;
      font-size: 11px;
      padding: 4px 6px;
      border: 1px solid #c9d4e3;
      border-radius: 4px;
      margin: 4px 0 6px 0;
    }
    #wip-snapshot-panel .wip-comparison-meta {
      font-size: 10px;
      color: #4b5563;
      margin: 2px 0;
    }
    #wip-snapshot-panel .wip-comparison-archived {
      font-size: 10px;
      color: #856404;
      background: #fff8e1;
      border-radius: 3px;
      padding: 1px 4px;
      margin: 2px 0;
      display: inline-block;
    }
    #wip-snapshot-panel .wip-comparison-summary {
      font-size: 11px;
      color: #374151;
      margin: 6px 0 2px 0;
    }
    #wip-snapshot-panel .wip-comparison-undetermined {
      font-size: 10px;
      color: #6b7280;
      margin: 2px 0;
    }
    #wip-snapshot-panel .wip-comparison-rate {
      font-size: 13px;
      font-weight: bold;
      margin: 4px 0;
    }
    #wip-snapshot-panel .wip-comparison-rate .wip-rate-bar {
      display: block;
      height: 6px;
      border-radius: 3px;
      background: #e5e7eb;
      margin-top: 3px;
      overflow: hidden;
    }
    #wip-snapshot-panel .wip-comparison-rate .wip-rate-fill {
      display: block;
      height: 100%;
      background: #1e8e3e;
    }
    #wip-snapshot-panel .wip-comparison-rate.unavailable { color: #6b7280; font-weight: normal; font-size: 11px; }
    #wip-snapshot-panel .wip-comparison-reliability {
      font-size: 10px;
      color: #cc292b;
      margin: 2px 0 6px 0;
    }
    #wip-snapshot-panel .wip-comparison-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      margin: 6px 0;
    }
    #wip-snapshot-panel .wip-comparison-filter {
      font-size: 10px;
      padding: 2px 6px;
      border: 1px solid #c9d4e3;
      border-radius: 10px;
      background: #f4f7fb;
      color: #374151;
      cursor: pointer;
    }
    #wip-snapshot-panel .wip-comparison-filter.active {
      background: #0b5fff;
      border-color: #0b5fff;
      color: #fff;
    }
    #wip-snapshot-panel .wip-comparison-cards {
      max-height: 200px;
      overflow-y: auto;
    }
    #wip-snapshot-panel .wip-comparison-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 5px 6px;
      margin-bottom: 4px;
      background: #fcfcfd;
    }
    #wip-snapshot-panel .wip-comparison-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    #wip-snapshot-panel .wip-comparison-card-id { font-size: 11px; font-weight: 600; color: #1f2937; }
    #wip-snapshot-panel .wip-comparison-flow {
      font-size: 10px;
      color: #4b5563;
      margin-top: 2px;
    }
    #wip-snapshot-panel .wip-comparison-flow .wip-flow-expected { color: #1a56db; }
    #wip-snapshot-panel .wip-comparison-flow .wip-flow-actual { color: #1f2937; font-weight: 500; }
    #wip-snapshot-panel .wip-comparison-explain {
      font-size: 10px;
      color: #856404;
      margin-top: 2px;
    }
    #wip-snapshot-panel .wip-comparison-status {
      display: inline-block;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    #wip-snapshot-panel .wip-comparison-status.reached { background: #e6f4ea; color: #1e8e3e; }
    #wip-snapshot-panel .wip-comparison-status.beyond { background: #e8f0fe; color: #1a56db; }
    #wip-snapshot-panel .wip-comparison-status.behind { background: #fff3cd; color: #856404; }
    #wip-snapshot-panel .wip-comparison-status.off-track { background: #f3f4f6; color: #4b5563; }
    #wip-snapshot-panel .wip-comparison-status.missing { background: #fde8e8; color: #cc292b; }
    #wip-snapshot-panel .wip-comparison-empty { font-size: 11px; color: #6b7280; padding: 6px 2px; }

    /* View visibility toggling for the daily-views navigation. */
    #wip-snapshot-panel.nav-initial #wip-projected-section,
    #wip-snapshot-panel.nav-initial #wip-comparison-section,
    #wip-snapshot-panel.nav-projected #wip-comparison-section,
    #wip-snapshot-panel.nav-actual #wip-comparison-section,
    #wip-snapshot-panel.nav-comparison #wip-projected-section { display: none !important; }
  `;
  document.head.appendChild(style);
}


// Column name resolution and card visibility are now owned by WIPBoardReader
// (src/data/board-dom-reader.js). The runtime consumes the normalized model, so
// the former inline getHeaderColumnDisplayName() and isCardVisible() helpers were
// removed as proven-equivalent duplicates (roadmap T0.4).

function getCardAssignees(card) {
  return Array.from(card.querySelectorAll('.identity-display-name span'))
    .map(span => normalizeText(span.textContent))
    .filter(Boolean);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const spaTagCache = {
  builtAt: 0,
  byItemId: new Map(),
};

function buildSpaTagIndexFromPageSource(specialTagPrefix) {
  // Fallback: some boards hide Tags in card fields but keep data in serialized HTML.
  const now = Date.now();
  if (now - spaTagCache.builtAt < 5000 && spaTagCache.byItemId.size > 0) {
    return spaTagCache.byItemId;
  }

  const html = (document.documentElement?.innerHTML || '').toLowerCase();
  const map = new Map();

  const normalizedPrefix = normalizeText(specialTagPrefix).replace(/^#/, '');
  const tagRoot = normalizedPrefix.split(/[._-]/)[0] || 'spa';
  const spaRegex = new RegExp(`#?${escapeRegex(tagRoot)}(?:[._-]?[a-z0-9]+)*`, 'i');
  const cardChunkRegex = /\[(\d{5,}),([\s\S]{0,2600}?)\],/g;

  let match;
  while ((match = cardChunkRegex.exec(html)) !== null) {
    const itemId = match[1];
    const chunk = match[2];
    if (spaRegex.test(chunk)) {
      map.set(itemId, true);
    }
  }

  spaTagCache.byItemId = map;
  spaTagCache.builtAt = now;
  return map;
}

function cardHasSpaTagFromSource(card, specialTagPrefix) {
  const itemId = card?.getAttribute('data-itemid');
  if (!itemId) return false;

  const map = buildSpaTagIndexFromPageSource(specialTagPrefix);
  return map.has(itemId);
}

function getBoardContext(data) {
  // Normalize popup settings in one place so runtime logic stays consistent.
  const normalizedSpecialPeople = Array.isArray(data.specialPeople) && data.specialPeople.length
    ? data.specialPeople.map(person => normalizeText(person)).filter(Boolean)
    : [];

  const normalizedColumns = (Array.isArray(data.wipColumns) && data.wipColumns.length
    ? data.wipColumns
    : []).map(column => normalizeColumnName(column)).filter(Boolean);

  const currentBoardName = normalizeText(data.boardName || '');
  const boardPathFilter = normalizeText(data.boardPathFilter || '');
  const specialTagPrefix = normalizeText(data.specialTagPrefix || '#spa').replace(/^#?/, '#');
  const blockTag = normalizeText(data.blockTag || '#blck').replace(/^#?/, '#');

  const agingWarningDays = Number.isFinite(Number(data.agingWarningDays)) ? Number(data.agingWarningDays) : 10;
  const agingHighDays = Number.isFinite(Number(data.agingHighDays)) ? Number(data.agingHighDays) : 15;
  const agingCriticalDays = Number.isFinite(Number(data.agingCriticalDays)) ? Number(data.agingCriticalDays) : 20;
  const targetDateWarningDays = Number.isFinite(Number(data.targetDateWarningDays)) ? Number(data.targetDateWarningDays) : 3;
  const language = getLanguageCode(data.language);

  // WIP requires board URL keyword and at least one configured WIP column.
  const isConfigured = Boolean(currentBoardName) && normalizedColumns.length > 0;

  return {
    isConfigured,
    isHighlightActive: data.highlightCards === true,
    isDetailsActive: data.showDetails === true,
    currentBoardName,
    boardPathFilter,
    wipColumns: normalizedColumns,
    isSpecialRuleActive: data.specialRuleEnabled === true,
    specialPeople: normalizedSpecialPeople,
    specialTagPrefix,
    blockTag,
    alarmConfig: {
      agingWarningDays,
      agingHighDays,
      agingCriticalDays,
      targetDateWarningDays,
    },
    language,
  };
}

function isAllowedBoard(currentBoardName, boardPathFilter) {
  // Render only when URL matches configured board keyword and optional route keyword.
  const currentUrl = window.location.href.toLowerCase();
  if (!currentBoardName || !currentUrl.includes(currentBoardName)) return false;
  if (boardPathFilter && !currentUrl.includes(boardPathFilter)) return false;
  return true;
}

function applyWipIndicatorState(indicator, current, limit, isDetailsActive, breakdown, i18n) {
  // Build indicator visual state without requiring page reload.
  let titleHTML = '';
  let panelHTML = '';
  const isCriticalState = limit !== null && current > limit;

  if (limit === null) {
    titleHTML = `<span>${i18n.t('indicatorConfigureLimit', { current })}</span>`;
    indicator.className = '';
    indicator.style.backgroundColor = '#fff3cd';
    indicator.style.color = '#856404';
    indicator.style.border = '2px solid #ffeeba';
  } else {
    titleHTML = `<span>${i18n.t('indicatorTotal', { current, limit })}</span>`;

    if (isDetailsActive) {
      titleHTML += ` <span style="font-size: 10px; opacity: 0.8;">▼</span>`;
    }

    if (current > limit) {
      indicator.className = 'wip-alerta-critico';
    } else if (current === limit) {
      indicator.className = 'wip-alerta-atenção';
    } else {
      indicator.className = '';
      indicator.style.backgroundColor = '#e6f4ea';
      indicator.style.color = '#1e8e3e';
      indicator.style.border = '2px solid #1e8e3e';
    }
  }

  if (isDetailsActive && breakdown.length > 0) {
    panelHTML = `<div id="wip-details-panel">
      <div style="font-size: 11px; margin-bottom: 5px; opacity: 0.8;">${i18n.t('indicatorColumnBottlenecks')}</div>
    `;

    breakdown.forEach(col => {
      const colorStyle = col.count >= 5
        ? (isCriticalState ? 'color: #7f1d1d;' : 'color: #cc292b;')
        : 'color: inherit;';
      panelHTML += `
        <div class="wip-detail-row" style="${colorStyle}">
          <span class="wip-detail-name">${col.name}</span>
          <span class="wip-detail-count">${col.count}</span>
        </div>
      `;
    });

    panelHTML += `</div>`;
  }

  const wasOpen = document.getElementById('wip-details-panel')?.style.display === 'block';
  // Diff-before-write (R1): only rewrite the indicator when its markup changed.
  setIndicatorHtml(indicator, `<div>${titleHTML}</div>${panelHTML}`);

  if (wasOpen && isDetailsActive) {
    const panel = document.getElementById('wip-details-panel');
    if (panel) panel.style.display = 'block';
  }
}

function analyzeCard(card, blockTag) {
  // Read card fields used by visual alarms.
  let agingValue = null;
  let targetDateDays = null;
  let hasBlockTag = false;

  const fields = card.querySelectorAll('.field-container');
  fields.forEach(field => {
    const labelEl = field.querySelector('.label');
    const valueEl = field.querySelector('.value .text-ellipsis');

    if (!labelEl || !valueEl) return;

    const label = labelEl.textContent.trim().toLowerCase();
    const val = valueEl.textContent.trim();

    if (label === 'aging' && val) {
      agingValue = parseInt(val, 10);
    }

    if (label === 'target date' && val) {
      // Delegate dd/mm/yyyy parsing + day math to the pure core helper.
      targetDateDays = Core.targetDateDaysRemaining(val);
    }

    if (label === 'tags' && val.toLowerCase().includes(blockTag)) {
      hasBlockTag = true;
    }
  });

  return { agingValue, targetDateDays, hasBlockTag };
}

function analyzeSpecialRule(card, specialTagPrefix) {
  // Accept variations for the configured tag prefix (ex: #spa, #spa.ui, #spaapi).
  const tagsText = Array.from(card.querySelectorAll('.field-container'))
    .filter(field => {
      const labelEl = field.querySelector('.label');
      return labelEl && normalizeText(labelEl.textContent) === 'tags';
    })
    .map(field => normalizeText(field.textContent))
    .join(' ');

  const normalizedPrefix = normalizeText(specialTagPrefix).replace(/^#/, '');
  const tagRoot = normalizedPrefix.split(/[._-]/)[0] || 'spa';
  const tagRegex = new RegExp(`(^|[\\s,;])#?${escapeRegex(tagRoot)}(?:[._-]?[a-z0-9]+)*($|[\\s,;])`, 'i');
  // First try visible tag field. If unavailable, use serialized HTML fallback by item id.
  const hasSpecialTag = tagRegex.test(tagsText) || cardHasSpaTagFromSource(card, specialTagPrefix);

  return { hasSpecialTag };
}

function applyCardAlarm(card, isHighlightActive, alarmConfig, blockTag, i18n) {
  // Apply or remove card-level alarm style using configured thresholds.
  if (!isHighlightActive) {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.removeAttribute('title');
    return;
  }

  const { agingValue, targetDateDays, hasBlockTag } = analyzeCard(card, blockTag);

  if (hasBlockTag) {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.removeAttribute('title');
    return;
  }

  let isCritical = false;
  const criticalReasons = [];

  if (agingValue !== null) {
    if (agingValue >= alarmConfig.agingCriticalDays) {
      isCritical = true;
      criticalReasons.push(i18n.t('agingCritical', { days: agingValue }));
    } else if (agingValue >= alarmConfig.agingHighDays) {
      isCritical = true;
      criticalReasons.push(i18n.t('agingHigh', { days: agingValue }));
    } else if (agingValue >= alarmConfig.agingWarningDays) {
      isCritical = true;
      criticalReasons.push(i18n.t('agingWarning', { days: agingValue }));
    }
  }

  if (targetDateDays !== null && targetDateDays <= alarmConfig.targetDateWarningDays) {
    isCritical = true;
    const targetStatus = targetDateDays < 0
      ? i18n.t('targetOverdue')
      : i18n.t('targetDaysLeft', { days: targetDateDays });
    criticalReasons.push(i18n.t('targetDate', { status: targetStatus }));
  }

  if (isCritical) {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.classList.add(getCardSeverityClass(agingValue, alarmConfig));
    card.setAttribute('title', i18n.t('alertTitle') + '\n' + criticalReasons.join('\n'));
  } else {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.removeAttribute('title');
  }
}

// ============================================================================
// 1b. BOARD MODEL BRIDGE (WIPBoardReader integration)
// ============================================================================
// The runtime consumes the normalized board model from the WIPBoardReader module
// (src/data/board-dom-reader.js, loaded before this file by the manifest order).
// These thin bridges keep the model as the source of truth for column structure,
// visibility and identity, while per-card rule analysis still runs on the live
// DOM node (needed to mutate alarm classes and to use the serialized-HTML tag
// fallback that the reader intentionally does not cover).

const Reader = (typeof WIPBoardReader !== 'undefined' && WIPBoardReader) || null;

function readBoardModel() {
  // Read the live document into the normalized model. The reader's default
  // visibility predicate mirrors the legacy isCardVisible() behavior.
  //
  // Resilience (roadmap T0.5): do NOT swallow a missing/broken reader into an
  // empty model. An empty model is indistinguishable from a genuinely empty
  // board and would silently report WIP = 0 for a populated board. The caller
  // guards against the module being absent; here we only guard against the
  // reader THROWING at read time (e.g. unexpected DOM), re-raising with context
  // so the failure is diagnosable instead of masked as "board empty".
  if (!Reader || typeof Reader.readBoard !== 'function') {
    throw new Error(
      `${MODULE_LOAD_ERROR_PREFIX}: WIPBoardReader.readBoard is unavailable.`
    );
  }
  try {
    return Reader.readBoard(document);
  } catch (err) {
    const wrapped = new Error(
      `[WIP-Board] WIPBoardReader.readBoard threw while reading the board: ${err && err.message ? err.message : err}`
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

function buildLiveCardIndex() {
  // Group live card nodes by stable work-item id, in document order, so duplicate
  // renders (e.g. swimlanes) each resolve to their own distinct DOM node.
  const byId = new Map();
  document.querySelectorAll('.kanban-board-column .wit-card').forEach(card => {
    const id = card.getAttribute('data-itemid');
    if (!id) return;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(card);
  });
  return byId;
}

function resolveLiveCard(liveCardsById, item) {
  // Consume one live node per model item id, preserving duplicate handling.
  const key = item.rawId != null && typeof item.rawId === 'string'
    ? item.rawId
    : (item.id != null ? String(item.id) : null);
  if (key == null) return null;
  const queue = liveCardsById.get(key);
  if (!queue || queue.length === 0) return null;
  return queue.shift();
}

// ============================================================================
// 1c. OBSERVER STABILITY (R1 fix)
// ============================================================================
// Root cause (docs/AUDIT_R1_MUTATION_OBSERVER.md): updateWipBoard() rewrites the
// floating indicator's innerHTML unconditionally on every run. The indicator
// lives inside document.body, which the MutationObserver watches with
// { childList: true, subtree: true }, so each rewrite emits a childList record,
// re-arms the 300 ms debounce and seeds the next run — a persistent ~3 Hz
// background recompute even on an idle board.
//
// Fix — two complementary, minimal guards; WIP semantics are untouched:
//   1. withObserverPaused(): disconnect the observer around the DOM write phase
//      and reconnect on the next microtask, so the extension's own writes are
//      never observed. Real external board changes still trigger recomputation.
//   2. setIndicatorHtml(): diff-before-write guard so an unchanged indicator is
//      not rewritten at all. This removes the no-op churn even in the brief
//      windows where the observer is connected (initial run, error indicator).

function withObserverPaused(write) {
  // `observer` is declared in section 4; this function only runs at runtime,
  // well after module evaluation, so the reference is always resolved.
  if (typeof observer === 'undefined' || !observer) {
    write();
    return;
  }
  observer.disconnect();
  try {
    write();
  } finally {
    // Reconnect on the next microtask so the just-written nodes are not
    // re-observed as "new" when observation resumes.
    Promise.resolve().then(() => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
}

function setIndicatorHtml(indicator, html) {
  // Diff-before-write: skip the DOM mutation when the rendered markup is
  // identical. Returns true when a write actually happened.
  if (indicator.innerHTML === html) return false;
  indicator.innerHTML = html;
  return true;
}

// ============================================================================
// 1d. DAILY SNAPSHOT CAPTURE (roadmap T1.2)
// ============================================================================
// A discrete, collapsible side panel that lets the user EXPLICITLY capture the
// current board state, review the last capture and browse a short history.
//
// Hard constraints honored here:
//   - Capture happens ONLY on an explicit button click. It is never triggered by
//     a DOM mutation and adds no work to the MutationObserver path.
//   - The capture is strictly read-only: it reads the already-available board
//     model and persists locally. It never edits a work item in Azure DevOps.
//   - Persistence is local (chrome.storage.local) and is labeled as such — it is
//     never presented as shared across the team.
//   - Incomplete captures (hidden/filtered cards, empty board, duplicates) are
//     surfaced honestly, never silently saved as complete.

const SnapshotStore =
  (typeof WIPBoardSnapshotStore !== 'undefined' && WIPBoardSnapshotStore) || null;
const SnapshotCapture =
  (typeof WIPBoardSnapshotCapture !== 'undefined' && WIPBoardSnapshotCapture) || null;
// Daily Commitment (roadmap T1.3): the pure plan-vs-actual engine. Optional, so a
// missing module degrades to "commitment section unavailable", never a crash.
const DailyCommitment =
  (typeof WIPBoardDailyCommitment !== 'undefined' && WIPBoardDailyCommitment) || null;
// Daily Commitment Card Picker (roadmap T1.4): the pure view-model that shapes
// the visual selection UI. Optional, so a missing module degrades to "commitment
// section unavailable", never a crash.
const CommitmentPicker =
  (typeof WIPBoardCommitmentPicker !== 'undefined' && WIPBoardCommitmentPicker) || null;
// Projected Board (roadmap T1.5): the pure engine that simulates the expected
// end-of-day board from the base snapshot + the saved commitment. Optional, so a
// missing module degrades to "projected section unavailable", never a crash.
const ProjectedBoard =
  (typeof WIPBoardProjectedBoard !== 'undefined' && WIPBoardProjectedBoard) || null;

// A single store instance per page, created lazily so a missing module (older
// manifest) degrades to "panel unavailable" instead of throwing at load.
let snapshotStoreInstance = null;
function getSnapshotStore() {
  if (snapshotStoreInstance) return snapshotStoreInstance;
  if (!SnapshotStore || typeof SnapshotStore.createStore !== 'function') return null;
  try {
    snapshotStoreInstance = SnapshotStore.createStore();
  } catch (err) {
    console.debug('[WIP-Board] Snapshot store unavailable.', err);
    snapshotStoreInstance = null;
  }
  return snapshotStoreInstance;
}

function resolveSnapshotScope(boardModel, context) {
  // Organization/project come from the reader model (parsed from card hrefs);
  // team/board come from the configured board keyword + optional route filter so
  // different teams/boards never collide in storage. Returns null when the
  // mandatory org/project cannot be detected, so capture refuses rather than
  // writing an ambiguous record.
  const firstScoped = (boardModel.items || []).find(
    item =>
      item &&
      typeof item.organization === 'string' &&
      item.organization &&
      typeof item.project === 'string' &&
      item.project
  );
  if (!firstScoped) return null;

  const board = context.currentBoardName || firstScoped.project;
  const team = context.boardPathFilter || context.currentBoardName || 'default';

  return {
    organization: firstScoped.organization,
    project: firstScoped.project,
    team: team,
    board: board,
  };
}

function formatSnapshotWhen(capturedAt) {
  // capturedAt is the store's { iso, localDay, ... }. Render a short local string.
  if (!capturedAt) return '';
  try {
    const d = new Date(capturedAt.iso || capturedAt.epochMs);
    return d.toLocaleString();
  } catch (e) {
    return capturedAt.localDay || '';
  }
}

function describeIncompleteReasons(reasons, i18n) {
  const map = {
    EMPTY_BOARD: 'reasonEmptyBoard',
    HIDDEN_ITEMS: 'reasonHiddenItems',
    NO_COLUMNS: 'reasonNoColumns',
    DUPLICATE_IDS: 'reasonDuplicateIds',
    MISSING_IDS: 'reasonMissingIds',
  };
  return (reasons || [])
    .map(code => (map[code] ? i18n.t(map[code]) : code))
    .join(', ');
}

function setSnapshotStatus(message, kind) {
  const status = document.getElementById('wip-snapshot-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function setSnapshotOutput(html) {
  const output = document.getElementById('wip-snapshot-output');
  if (!output) return;
  // Diff-before-write mirrors the indicator guard so repeated renders of the
  // same content do not churn the observed subtree.
  setIndicatorHtml(output, html || '');
}

function renderSnapshotColumns(columns, i18n) {
  if (!Array.isArray(columns) || columns.length === 0) return '';
  return columns
    .map(col => {
      const name = String(col.name == null ? '' : col.name).replace(/[<>]/g, '');
      return `<div class="wip-snap-row"><span>${name}</span><span class="wip-detail-count">${col.count || 0}</span></div>`;
    })
    .join('');
}

async function handleCaptureSnapshot(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !SnapshotCapture) {
    setSnapshotStatus(i18n.t('snapshotError', { message: 'module unavailable' }), 'err');
    return;
  }

  setSnapshotStatus(i18n.t('snapshotCapturing'), null);

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setSnapshotStatus(i18n.t('snapshotError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setSnapshotStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  const capture = SnapshotCapture.buildCapture(boardModel, scope, {
    source: { origin: 'dom-reader' },
  });

  try {
    await store.createSnapshot(capture.storeInput);
  } catch (err) {
    setSnapshotStatus(i18n.t('snapshotError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  if (capture.complete) {
    setSnapshotStatus(
      i18n.t('snapshotCaptured', { items: capture.counts.items, columns: capture.counts.columns }),
      'ok'
    );
  } else {
    setSnapshotStatus(
      i18n.t('snapshotCapturedIncomplete', {
        reasons: describeIncompleteReasons(capture.incompleteReasons, i18n),
      }),
      'ok'
    );
  }

  setSnapshotOutput(renderSnapshotColumns(capture.columns, i18n));
}

async function handleViewLatestSnapshot(context, i18n) {
  const store = getSnapshotStore();
  if (!store) return;

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setSnapshotStatus(i18n.t('snapshotError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setSnapshotStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  let latest;
  try {
    latest = await store.getLatestSnapshot(scope);
  } catch (err) {
    setSnapshotStatus(i18n.t('snapshotError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  if (!latest) {
    setSnapshotStatus(i18n.t('snapshotNone'), null);
    setSnapshotOutput('');
    return;
  }

  const badgeKey = latest.source && latest.source.complete ? 'complete' : 'incomplete';
  const badgeText = latest.source && latest.source.complete
    ? i18n.t('snapshotCompleteBadge')
    : i18n.t('snapshotIncompleteBadge');
  setSnapshotStatus(
    i18n.t('snapshotLatestInfo', { when: formatSnapshotWhen(latest.capturedAt), items: latest.itemCount }),
    'ok'
  );
  const badge = `<div class="wip-snap-row"><span class="wip-snap-badge ${badgeKey}">${badgeText}</span></div>`;
  setSnapshotOutput(badge + renderSnapshotColumns(latest.columns, i18n));
}

async function handleViewHistory(context, i18n) {
  const store = getSnapshotStore();
  if (!store) return;

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setSnapshotStatus(i18n.t('snapshotError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setSnapshotStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  let snapshots;
  try {
    snapshots = await store.getSnapshots(scope);
  } catch (err) {
    setSnapshotStatus(i18n.t('snapshotError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  if (!snapshots.length) {
    setSnapshotStatus(i18n.t('snapshotHistoryEmpty'), null);
    setSnapshotOutput('');
    return;
  }

  setSnapshotStatus('', null);
  const rows = snapshots
    .map(snap => {
      const status = snap.source && snap.source.complete
        ? i18n.t('snapshotCompleteBadge')
        : i18n.t('snapshotIncompleteBadge');
      const text = i18n.t('snapshotHistoryItem', {
        when: formatSnapshotWhen(snap.capturedAt),
        items: snap.itemCount,
        status: status,
      }).replace(/[<>]/g, '');
      return `<div class="wip-snap-row"><span>${text}</span></div>`;
    })
    .join('');
  setSnapshotOutput(rows);
}

// --- Daily Commitment (roadmap T1.3) ---------------------------------------
// Delivery projection kept strictly separate from the WIP indicator. It reads
// the last captured snapshot as the base, lets the user declare an expected
// destination column per work item, persists the plan as a versioned commitment
// (reusing WIPBoardSnapshotStore — no new store), and projects plan vs actual
// against the CURRENT board state. All actions run only on explicit clicks.

// Picker in-memory state. Holds the base snapshot, the destination column
// options and the current rows so a search keystroke or a checkbox toggle
// re-renders from memory without re-reading the board (keeps the picker light
// and avoids any extra MutationObserver churn — R1 discipline). `selection` maps
// stable id -> { selected, expectedColumn } so a filtered-out row keeps its
// choice while the user searches.
const commitmentPickerState = {
  base: null,
  options: [],
  rows: [],
  selection: new Map(),
};

function resetCommitmentPicker() {
  commitmentPickerState.base = null;
  commitmentPickerState.options = [];
  commitmentPickerState.rows = [];
  commitmentPickerState.selection = new Map();
  const search = document.getElementById('wip-commit-search');
  if (search) search.value = '';
  const list = document.getElementById('wip-commit-list');
  if (list) setIndicatorHtml(list, '');
  const plan = document.getElementById('wip-commit-plan');
  if (plan) plan.textContent = '';
}

// Open (or refresh) the visual picker: read the base snapshot and the current
// board, merge them through the pure picker view-model, pre-select from any saved
// commitment, and render the searchable list. Runs ONLY on an explicit click.
async function handleOpenPicker(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !DailyCommitment || !CommitmentPicker || !SnapshotCapture) {
    setCommitmentStatus(i18n.t('commitmentError', { message: 'module unavailable' }), 'err');
    return;
  }

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setCommitmentStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  let base;
  let existing;
  try {
    base = await store.getLatestSnapshot(scope);
    const commitments = await store.getCommitments(scope);
    existing = commitments && commitments.length ? commitments[0] : null;
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  if (!base) {
    setCommitmentStatus(i18n.t('commitmentNoBase'), 'err');
    resetCommitmentPicker();
    return;
  }

  // Live board (titles/current column/assignee) + base snapshot (committable ids
  // + startColumn) + saved commitment (pre-selection). Read-only; no persistence.
  const liveModel = { items: boardModel.items, columns: boardModel.columns };
  const rows = CommitmentPicker.buildPickerRows(base, liveModel, existing);
  const options = CommitmentPicker.buildColumnOptions(liveModel, base);

  commitmentPickerState.base = base;
  commitmentPickerState.options = options;
  commitmentPickerState.rows = rows;
  // Seed the selection map from the pre-selection the view-model computed.
  commitmentPickerState.selection = new Map();
  rows.forEach(row => {
    commitmentPickerState.selection.set(row.id, {
      selected: !!row.selected,
      expectedColumn: row.expectedColumn || '',
    });
  });

  setCommitmentStatus('', null);
  setCommitmentOutput('');
  renderPickerList(i18n);
}

// Render the (optionally filtered) picker rows. Reads the in-memory rows and the
// current selection; never re-reads the board. Each row carries a checkbox, the
// id/title/assignee, the current column and a destination dropdown.
function renderPickerList(i18n) {
  const list = document.getElementById('wip-commit-list');
  if (!list) return;

  // The picker list lives inside document.body, which the MutationObserver
  // watches. Writing it outside the paused phase would emit childList records and
  // re-arm the WIP recompute on every keystroke/toggle — the exact R1 loop. So
  // every DOM write here runs inside withObserverPaused(), the same guard the WIP
  // write phase uses, keeping the R1 fix intact.
  withObserverPaused(() => {
    const rows = commitmentPickerState.rows;
    if (!rows.length) {
      list.innerHTML = `<p class="wip-commit-empty">${escapeText(i18n.t('commitmentPickEmpty'))}</p>`;
      return;
    }

    const search = document.getElementById('wip-commit-search');
    const query = search ? search.value : '';
    const visible = CommitmentPicker.filterRows(rows, query);

    if (!visible.length) {
      list.innerHTML = `<p class="wip-commit-empty">${escapeText(i18n.t('commitmentPickNoMatch'))}</p>`;
      return;
    }

    const options = commitmentPickerState.options;
    list.innerHTML = visible.map(row => renderPickerRow(row, options, i18n)).join('');

    // Bind the per-row controls after each render (innerHTML replaced the nodes).
    // Iterate the rendered nodes directly to avoid building attribute selectors
    // from board-derived ids.
    list.querySelectorAll('.wip-commit-pick').forEach(node => {
      const rawId = node.getAttribute('data-pick-id');
      bindPickerRow(node, idFromDom(rawId), i18n);
    });
  });

  updatePlanSummary(i18n);
}

function renderPickerRow(row, options, i18n) {
  const sel = commitmentPickerState.selection.get(row.id) || { selected: false, expectedColumn: '' };
  const title = row.title ? escapeText(row.title) : escapeText(i18n.t('commitmentUntitled'));
  const assignee = row.assignee ? escapeText(row.assignee) : escapeText(i18n.t('commitmentNoAssignee'));

  const columnText = row.onBoard
    ? i18n.t('commitmentCurrentColumn', { column: row.currentColumn || '—' })
    : `<span class="wip-commit-pick-off">${escapeText(i18n.t('commitmentOffBoard'))}</span>`;

  const optionsHtml =
    `<option value="">${escapeText(i18n.t('commitmentDestinationPlaceholder'))}</option>` +
    options
      .map(opt => {
        const value = escapeAttr(opt.name);
        const selected = sameColumnName(opt.name, sel.expectedColumn) ? ' selected' : '';
        return `<option value="${value}"${selected}>${escapeText(opt.name)}</option>`;
      })
      .join('');

  const checked = sel.selected ? ' checked' : '';
  const offClass = row.onBoard ? '' : ' off-board';
  const idAttr = escapeAttr(String(row.id));

  return (
    `<div class="wip-commit-pick${offClass}" data-pick-id="${idAttr}">` +
    `<input type="checkbox" data-pick-check="${idAttr}"${checked} />` +
    `<div class="wip-commit-pick-main">` +
    `<div class="wip-commit-pick-title">#${escapeText(String(row.id))} — ${title}</div>` +
    `<div class="wip-commit-pick-meta">${assignee} · ${columnText}</div>` +
    `<select class="wip-commit-dest" data-pick-dest="${idAttr}">${optionsHtml}</select>` +
    `</div>` +
    `</div>`
  );
}

function bindPickerRow(node, key, i18n) {
  const check = node.querySelector('input[type="checkbox"]');
  const dest = node.querySelector('select.wip-commit-dest');
  if (check) {
    check.onchange = () => {
      const entry = commitmentPickerState.selection.get(key) || { selected: false, expectedColumn: '' };
      entry.selected = check.checked;
      commitmentPickerState.selection.set(key, entry);
      updatePlanSummary(i18n);
    };
  }
  if (dest) {
    dest.onchange = () => {
      const entry = commitmentPickerState.selection.get(key) || { selected: false, expectedColumn: '' };
      entry.expectedColumn = dest.value;
      // Choosing a destination implies selecting the item (explicit intent).
      if (dest.value) {
        entry.selected = true;
        if (check) check.checked = true;
      }
      commitmentPickerState.selection.set(key, entry);
      updatePlanSummary(i18n);
    };
  }
}

// The data attribute stores the id as a string; map it back to the row id type.
function idFromDom(id) {
  return /^-?\d+$/.test(String(id)) ? Number(id) : id;
}

function updatePlanSummary(i18n) {
  const plan = document.getElementById('wip-commit-plan');
  if (!plan) return;
  // Reflect the live selection (not just the rendered/filtered subset) so the
  // summary is honest while the user searches.
  const rows = commitmentPickerState.rows.map(row => {
    const sel = commitmentPickerState.selection.get(row.id) || {};
    return { selected: !!sel.selected, expectedColumn: sel.expectedColumn || '', onBoard: row.onBoard };
  });
  const s = CommitmentPicker.summarizeSelection(rows);
  let text = i18n.t('commitmentPlanSummary', {
    selected: s.selected,
    total: s.total,
    withDestination: s.withDestination,
  });
  if (s.missingDestination > 0) {
    text += ' ' + i18n.t('commitmentMissingDestination', { count: s.missingDestination });
  }
  // Diff-before-write + observer pause: the summary node is under the observed
  // body, so only write on change and never let the write re-arm the recompute.
  if (plan.textContent !== text) {
    withObserverPaused(() => {
      plan.textContent = text;
    });
  }
}

// Collect the current selection into the array shape the picker view-model and
// the engine consume: [{ id, expectedColumn }] for every ticked row.
function collectPickerSelection() {
  const out = [];
  commitmentPickerState.selection.forEach((entry, id) => {
    if (!entry || !entry.selected) return;
    out.push({ id: id, expectedColumn: entry.expectedColumn || '' });
  });
  return out;
}

async function handleSaveCommitment(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !DailyCommitment || !CommitmentPicker) {
    setCommitmentStatus(i18n.t('commitmentError', { message: 'module unavailable' }), 'err');
    return;
  }

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setCommitmentStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  // Convert the visual selection into the engine expectations map. A selection
  // without a destination is rejected (destination must be chosen explicitly).
  const selection = CommitmentPicker.buildExpectationsFromSelection(collectPickerSelection());
  if (selection.count === 0) {
    setCommitmentStatus(i18n.t('commitmentNoInput'), 'err');
    return;
  }

  setCommitmentStatus(i18n.t('commitmentSaving'), null);

  let base;
  try {
    base = await store.getLatestSnapshot(scope);
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  if (!base) {
    setCommitmentStatus(i18n.t('commitmentNoBase'), 'err');
    return;
  }

  const built = DailyCommitment.buildCommitmentItems(base, selection.expectations);
  if (!built.items.length) {
    setCommitmentStatus(i18n.t('commitmentNoInput'), 'err');
    return;
  }

  try {
    // Reuse an existing commitment for this board when present: a new daily plan
    // is a REVISION (versioned history preserved), not a duplicate record.
    const existing = await store.getCommitments(scope);
    let saved;
    if (existing && existing.length) {
      saved = await store.reviseCommitment(scope, existing[0].id, built.items);
      setCommitmentStatus(
        i18n.t('commitmentRevised', { revision: saved.revision, items: built.items.length }),
        'ok'
      );
    } else {
      saved = await store.saveCommitment({ scope: scope, items: built.items, baseSnapshotId: base.id });
      setCommitmentStatus(i18n.t('commitmentSaved', { items: built.items.length }), 'ok');
    }
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  if (built.unknownIds.length) {
    appendCommitmentNote(i18n.t('commitmentUnknownIds', { ids: built.unknownIds.join(', ') }));
  }
}

async function handleCompareCommitment(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !DailyCommitment || !SnapshotCapture) {
    setCommitmentStatus(i18n.t('commitmentError', { message: 'module unavailable' }), 'err');
    return;
  }

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setCommitmentStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  let commitmentRecord;
  try {
    const existing = await store.getCommitments(scope);
    commitmentRecord = existing && existing.length ? existing[0] : null;
  } catch (err) {
    setCommitmentStatus(i18n.t('commitmentError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  if (!commitmentRecord) {
    setCommitmentStatus(i18n.t('commitmentNone'), null);
    setCommitmentOutput('');
    return;
  }

  // Realized state = the CURRENT board, read through the same capture pipeline so
  // ids/columns match the stored commitment. Read-only; no persistence here.
  const realized = SnapshotCapture.buildCapture(boardModel, scope, { source: { origin: 'dom-reader' } });
  const comparison = DailyCommitment.compareCommitment(commitmentRecord, {
    items: realized.items,
    columns: realized.columns,
  });

  renderCommitmentComparison(comparison, i18n);
}

function renderCommitmentComparison(comparison, i18n) {
  const statusLabelKey = {
    reached: 'statusReached',
    behind: 'statusBehind',
    beyond: 'statusBeyond',
    'off-track': 'statusOffTrack',
    missing: 'statusMissing',
  };
  const s = comparison.summary;
  setCommitmentStatus('', null);

  const summaryHtml =
    `<div class="wip-commit-summary">` +
    i18n.t('commitmentSummary', {
      reached: s.reached,
      behind: s.behind,
      beyond: s.beyond,
      offTrack: s.offTrack,
      missing: s.missing,
      committed: s.committed,
    }).replace(/[<>]/g, '') +
    `</div>`;

  const rows = comparison.results
    .map(r => {
      const statusText = i18n.t(statusLabelKey[r.status] || 'statusOffTrack');
      const actual = r.actualColumn == null ? i18n.t('commitmentActualNone') : r.actualColumn;
      const text = i18n
        .t('commitmentRow', {
          id: r.id,
          expected: r.expectedColumn,
          actual: actual,
          status: statusText,
        })
        .replace(/[<>]/g, '');
      return (
        `<div class="wip-commit-row">` +
        `<span class="wip-commit-status ${r.status}">${statusText.replace(/[<>]/g, '')}</span>` +
        `<span>${text}</span>` +
        `</div>`
      );
    })
    .join('');

  setCommitmentOutput(summaryHtml + rows);
}

function setCommitmentStatus(message, kind) {
  const status = document.getElementById('wip-commit-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function appendCommitmentNote(message) {
  const status = document.getElementById('wip-commit-status');
  if (!status) return;
  const existing = status.textContent ? status.textContent + ' ' : '';
  status.textContent = existing + message;
}

function setCommitmentOutput(html) {
  const output = document.getElementById('wip-commit-output');
  if (!output) return;
  // Diff-before-write mirrors the indicator/snapshot guard (R1 fix discipline).
  setIndicatorHtml(output, html || '');
}

// --- Projected Board (roadmap T1.5) ----------------------------------------
// A read-only SIMULATION of the expected end-of-day board. It takes the last
// captured snapshot as the baseline and the saved commitment as the declared
// destinations, then renders either the INITIAL board (snapshot) or the
// PROJECTED board (after the planned moves) per column. It never reads the live
// board to invent items and never moves a work item in Azure DevOps.
//
// In-memory state holds the last computed projection and the active view so the
// Initial/Projected toggle re-renders from memory without recomputing — keeping
// the view light and adding no MutationObserver churn (R1 discipline).
const projectedBoardState = {
  projection: null,
  view: 'projected', // 'initial' | 'projected'
};

async function handleShowProjectedBoard(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !ProjectedBoard || !DailyCommitment) {
    setProjectedStatus(i18n.t('projectedError', { message: 'module unavailable' }), 'err');
    return;
  }

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setProjectedStatus(i18n.t('projectedError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setProjectedStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  // Resolve the SAME-board baseline snapshot and its active commitment only. The
  // live board is not used to substitute missing snapshot data (integrity rule).
  let base;
  let commitmentRecord;
  try {
    base = await store.getLatestSnapshot(scope);
    const commitments = await store.getCommitments(scope);
    commitmentRecord = commitments && commitments.length ? commitments[0] : null;
  } catch (err) {
    setProjectedStatus(i18n.t('projectedError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  if (!base) {
    setProjectedStatus(i18n.t('projectedNoBase'), 'err');
    setProjectedOutput('');
    projectedBoardState.projection = null;
    return;
  }

  // No valid commitment for this snapshot: show an informative empty state rather
  // than reusing an old/foreign plan (integrity rule). An empty commitment still
  // lets the user see the initial board, so compute with an empty plan.
  const commitmentForProjection = commitmentRecord || { items: [] };

  let projection;
  try {
    projection = ProjectedBoard.project(base, commitmentForProjection);
  } catch (err) {
    setProjectedStatus(i18n.t('projectedError', { message: err && err.message ? err.message : String(err) }), 'err');
    return;
  }

  projectedBoardState.projection = projection;
  // Default to the projected view; if there is no commitment, the projected and
  // initial boards are identical and a clarifying note is shown.
  setProjectedStatus('', null);
  if (!commitmentRecord) {
    setProjectedStatus(i18n.t('projectedNoCommitment'), null);
  }
  renderProjectedBoard(i18n);
}

function renderProjectedBoard(i18n) {
  const output = document.getElementById('wip-projected-output');
  if (!output) return;
  const projection = projectedBoardState.projection;
  if (!projection) {
    setProjectedOutput('');
    return;
  }

  const useProjected = projectedBoardState.view !== 'initial';

  const summary =
    `<div class="wip-projected-summary">` +
    escapeText(
      i18n.t('projectedSummary', {
        items: projection.summary.snapshotItemCount,
        committed: projection.summary.committedCount,
        moves: projection.summary.plannedMoveCount,
      })
    ) +
    `</div>`;

  let reliability = '';
  if (!projection.reliability.complete) {
    const reasonMap = {
      INCOMPLETE_SNAPSHOT: 'projectedReasonIncomplete',
      UNKNOWN_COMMITTED_IDS: 'projectedReasonUnknownIds',
      INVALID_DESTINATIONS: 'projectedReasonInvalidDest',
    };
    const reasons = projection.reliability.reasons
      .map(code => (reasonMap[code] ? i18n.t(reasonMap[code]) : code))
      .join(', ');
    reliability =
      `<div class="wip-projected-reliability">` +
      escapeText(i18n.t('projectedReliabilityWarning', { reasons: reasons })) +
      `</div>`;
  }

  const columnsHtml = projection.columns
    .map(col => renderProjectedColumn(col, useProjected, i18n))
    .join('');

  setProjectedOutput(
    summary + reliability + `<div class="wip-projected-board">${columnsHtml}</div>`
  );
}

function renderProjectedColumn(col, useProjected, i18n) {
  const count = useProjected ? col.projectedCount : col.initialCount;
  const ids = useProjected ? col.projectedIds : col.initialIds;

  // Delta badge is only meaningful on the projected view.
  let deltaHtml = '';
  if (useProjected && col.delta !== 0) {
    const sign = col.delta > 0 ? '+' : '';
    const dir = col.delta > 0 ? 'up' : 'down';
    deltaHtml =
      `<span class="wip-projected-col-delta ${dir}">` +
      escapeText(i18n.t('projectedColumnDelta', { sign: sign, delta: col.delta })) +
      `</span>`;
  }

  const moveById = new Map();
  if (useProjected && Array.isArray(col.items)) {
    col.items.forEach(it => moveById.set(it.id, it));
  }

  const cardsHtml = ids.length
    ? ids
        .map(id => {
          const meta = moveById.get(id);
          const moved = !!(meta && meta.movedIn);
          const badge =
            moved && meta.fromColumn
              ? ` <span class="wip-projected-move">(${escapeText(i18n.t('projectedMoveBadge', { from: meta.fromColumn }))})</span>`
              : '';
          return `<span class="wip-projected-card${moved ? ' moved' : ''}">#${escapeText(String(id))}${badge}</span>`;
        })
        .join('')
    : `<span class="wip-projected-empty">${escapeText(i18n.t('projectedEmptyColumn'))}</span>`;

  return (
    `<div class="wip-projected-col">` +
    `<div class="wip-projected-col-head">` +
    `<span>${escapeText(col.name)}</span>` +
    `<span class="wip-projected-col-count">${escapeText(i18n.t('projectedColumnCount', { count: count }))}${deltaHtml}</span>` +
    `</div>` +
    `<div class="wip-projected-cards">${cardsHtml}</div>` +
    `</div>`
  );
}

function setProjectedView(view, i18n) {
  projectedBoardState.view = view === 'initial' ? 'initial' : 'projected';
  const panel = document.getElementById('wip-snapshot-panel');
  if (panel) {
    const initialTab = panel.querySelector('#wip-projected-tab-initial');
    const projectedTab = panel.querySelector('#wip-projected-tab-projected');
    if (initialTab) initialTab.classList.toggle('active', projectedBoardState.view === 'initial');
    if (projectedTab) projectedTab.classList.toggle('active', projectedBoardState.view === 'projected');
  }
  renderProjectedBoard(i18n);
}

function setProjectedStatus(message, kind) {
  const status = document.getElementById('wip-projected-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function setProjectedOutput(html) {
  const output = document.getElementById('wip-projected-output');
  if (!output) return;
  // Diff-before-write mirrors the indicator/snapshot guard (R1 fix discipline).
  setIndicatorHtml(output, html || '');
}

// --- Daily Comparison (roadmap T1.6) ---------------------------------------
// A read-only comparison between the daily PLAN (a commitment tied to an initial
// snapshot) and a LATER observed snapshot of the SAME board. The classification
// is delegated to WIPBoardDailyCommitment.compareCommitment (reused, not
// reimplemented); the daily metrics, the proven fulfillment rate, reliability
// and the result filters come from the pure WIPBoardDailyComparison view-model.
// It never reads the live board to invent items and never moves a work item in
// Azure DevOps. All DOM writes go through withObserverPaused()/setIndicatorHtml
// so the R1 MutationObserver fix is preserved.
//
// In-memory state holds the last computed view-model, the chosen later snapshot
// id and the active result filter so re-rendering (filter change, language
// switch) never recomputes and never re-reads the board.
const comparisonState = {
  vm: null,
  laterSnapshots: [], // valid later-snapshot candidates for the picker
  selectedLaterId: null,
  initial: null,
  commitment: null,
  filter: 'all',
};

const DailyComparison =
  (typeof WIPBoardDailyComparison !== 'undefined' && WIPBoardDailyComparison) || null;

async function handleRunComparison(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !DailyComparison || !DailyCommitment) {
    setComparisonStatus(i18n.t('comparisonError', { message: 'module unavailable' }), 'err');
    return;
  }

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setComparisonStatus(i18n.t('comparisonError', { message: errText(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setComparisonStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  setComparisonStatus(i18n.t('comparisonLoading'), null);

  // Resolve the SAME-board initial snapshot (latest capture), its active
  // commitment, and the valid later snapshots. The live board is never used to
  // substitute snapshot data (integrity rule).
  let initial;
  let commitmentRecord;
  let snapshots;
  try {
    snapshots = await store.getSnapshots(scope);
    initial = snapshots && snapshots.length ? snapshots[snapshots.length - 1] : null;
    const commitments = await store.getCommitments(scope);
    commitmentRecord = commitments && commitments.length ? commitments[0] : null;
  } catch (err) {
    setComparisonStatus(i18n.t('comparisonError', { message: errText(err) }), 'err');
    return;
  }

  if (!initial) {
    setComparisonStatus(i18n.t('comparisonNoBase'), 'err');
    setComparisonOutput('');
    comparisonState.vm = null;
    return;
  }
  if (!commitmentRecord) {
    setComparisonStatus(i18n.t('comparisonNoCommitment'), null);
    setComparisonOutput('');
    comparisonState.vm = null;
    return;
  }

  // Valid later snapshots: same board, captured strictly after the initial one.
  const laterSnapshots = DailyComparison.selectComparableSnapshots(snapshots, initial);

  comparisonState.initial = initial;
  comparisonState.commitment = commitmentRecord;
  comparisonState.laterSnapshots = laterSnapshots;
  // Keep a previously chosen later snapshot if still valid, else default to the
  // newest valid one. Never auto-select an incompatible/other-board snapshot.
  const stillValid = laterSnapshots.some(s => s.id === comparisonState.selectedLaterId);
  comparisonState.selectedLaterId = stillValid
    ? comparisonState.selectedLaterId
    : (laterSnapshots.length ? laterSnapshots[0].id : null);

  recomputeComparison(i18n);
}

// Build the view-model from the selected later snapshot. Pure; no board read.
function recomputeComparison(i18n) {
  const initial = comparisonState.initial;
  const commitment = comparisonState.commitment;
  if (!initial || !commitment || !DailyComparison) return;

  const later =
    comparisonState.laterSnapshots.find(s => s.id === comparisonState.selectedLaterId) || null;

  const vm = DailyComparison.buildComparison({
    initialSnapshot: initial,
    commitment: commitment,
    laterSnapshot: later,
  });

  comparisonState.vm = vm;
  setComparisonStatus('', null);
  renderComparison(i18n);
}

function comparisonStatusClass(status) {
  return ['reached', 'beyond', 'behind', 'off-track', 'missing'].indexOf(status) !== -1
    ? status
    : 'off-track';
}

function renderComparison(i18n) {
  const output = document.getElementById('wip-comparison-output');
  if (!output) return;
  const vm = comparisonState.vm;
  if (!vm) {
    setComparisonOutput('');
    return;
  }
  if (!vm.ok) {
    setComparisonOutput(
      `<div class="wip-comparison-reliability">` +
        escapeText(i18n.t('comparisonError', { message: vm.error || 'unknown' })) +
        `</div>`
    );
    return;
  }

  const statusLabelKey = {
    reached: 'statusReached',
    behind: 'statusBehind',
    beyond: 'statusBeyond',
    'off-track': 'statusOffTrack',
    missing: 'statusMissing',
  };
  const explainKey = {
    OFF_TRACK_UNKNOWN_ORDER: 'comparisonExplainOffTrackOrder',
    OFF_TRACK_INCOMPATIBLE: 'comparisonExplainOffTrackIncompatible',
    MISSING_NO_CARD: 'comparisonExplainMissingCard',
    MISSING_NO_LATER: 'comparisonExplainMissingNoLater',
  };

  const m = vm.metrics;

  // Later-snapshot picker (same board, after the initial). Rebuilt here so a
  // language change relabels without a board read.
  const laterPicker = renderLaterPicker(i18n);

  // Header meta: daily date, initial/later snapshot times, commitment revision.
  let meta = '';
  if (vm.dailyDate) {
    meta += `<div class="wip-comparison-meta">${escapeText(i18n.t('comparisonDailyDate', { date: vm.dailyDate }))}</div>`;
  }
  meta += `<div class="wip-comparison-meta">${escapeText(i18n.t('comparisonInitialInfo', { when: formatSnapshotWhen(vm.initial.capturedAt) }))}</div>`;
  if (vm.later) {
    meta += `<div class="wip-comparison-meta">${escapeText(i18n.t('comparisonLaterInfo', { when: formatSnapshotWhen(vm.later.capturedAt) }))}</div>`;
  } else {
    meta += `<div class="wip-comparison-meta">${escapeText(i18n.t('comparisonNoLater'))}</div>`;
  }
  if (vm.commitment) {
    meta += `<div class="wip-comparison-meta">${escapeText(i18n.t('comparisonCommitmentInfo', { revision: vm.commitment.revision, when: formatSnapshotWhen(vm.commitment.createdAt) }))}</div>`;
    if (vm.commitment.usedArchived) {
      meta += `<div class="wip-comparison-archived">${escapeText(i18n.t('comparisonArchivedNote', { revision: vm.commitment.revision }))}</div>`;
    }
  }

  // Summary + undetermined (missing/off-track reported separately, never a proven
  // failure) + proven fulfillment rate (suppressed when unreliable).
  const summary =
    `<div class="wip-comparison-summary">` +
    escapeText(
      i18n.t('comparisonSummary', {
        committed: m.committed,
        reached: m.reached,
        beyond: m.beyond,
        behind: m.behind,
        offTrack: m.offTrack,
        missing: m.missing,
      })
    ) +
    `</div>`;

  const undetermined =
    `<div class="wip-comparison-undetermined">` +
    escapeText(
      i18n.t('comparisonUndetermined', {
        count: m.undetermined,
        offTrack: m.offTrack,
        missing: m.missing,
      })
    ) +
    `</div>`;

  let rate;
  if (m.rateReliable && m.fulfillmentRate != null) {
    const pct = Math.max(0, Math.min(100, m.fulfillmentRate));
    rate =
      `<div class="wip-comparison-rate">` +
      escapeText(i18n.t('comparisonRate', { rate: m.fulfillmentRate })) +
      `<span class="wip-rate-bar"><span class="wip-rate-fill" style="width:${pct}%"></span></span>` +
      `</div>`;
  } else {
    rate =
      `<div class="wip-comparison-rate unavailable">` +
      escapeText(i18n.t('comparisonRateUnavailable')) +
      `</div>`;
  }

  // Reliability line (honest limitations), when not fully reliable.
  let reliability = '';
  if (!vm.reliability.reliable) {
    const reasonMap = {
      NO_LATER_SNAPSHOT: 'comparisonReasonNoLater',
      INCOMPLETE_LATER_SNAPSHOT: 'comparisonReasonLaterIncomplete',
      INCOMPLETE_INITIAL_SNAPSHOT: 'comparisonReasonInitialIncomplete',
      UNRELIABLE_COLUMN_ORDER: 'comparisonReasonOrder',
      NO_COMMITMENT: 'comparisonReasonNoCommitment',
    };
    const reasons = vm.reliability.reasons
      .map(code => (reasonMap[code] ? i18n.t(reasonMap[code]) : code))
      .join(', ');
    reliability =
      `<div class="wip-comparison-reliability">` +
      escapeText(i18n.t('comparisonReliabilityWarning', { reasons: reasons })) +
      `</div>`;
  }

  // Result filters.
  const filters = renderComparisonFilters(i18n);

  // Compact comparison cards for the active filter.
  const rows = DailyComparison.filterResults(vm.results, comparisonState.filter);
  let cards;
  if (!rows.length) {
    cards = `<div class="wip-comparison-empty">${escapeText(i18n.t('comparisonEmptyFilter'))}</div>`;
  } else {
    cards = rows
      .map(r => {
        const statusText = i18n.t(statusLabelKey[r.status] || 'statusOffTrack');
        const actual = r.actualColumn == null ? i18n.t('comparisonActualNone') : r.actualColumn;
        const start = r.startColumn == null ? i18n.t('comparisonActualNone') : r.startColumn;
        const explain =
          r.explanation && explainKey[r.explanation]
            ? `<div class="wip-comparison-explain">${escapeText(i18n.t(explainKey[r.explanation]))}</div>`
            : '';
        return (
          `<div class="wip-comparison-card">` +
          `<div class="wip-comparison-card-head">` +
          `<span class="wip-comparison-card-id">#${escapeText(String(r.id))}</span>` +
          `<span class="wip-comparison-status ${comparisonStatusClass(r.status)}">${escapeText(statusText)}</span>` +
          `</div>` +
          `<div class="wip-comparison-flow">` +
          `${escapeText(i18n.t('comparisonColInitial'))} ${escapeText(start)} → ` +
          `<span class="wip-flow-expected">${escapeText(i18n.t('comparisonColExpected'))} ${escapeText(r.expectedColumn)}</span> → ` +
          `<span class="wip-flow-actual">${escapeText(i18n.t('comparisonColActual'))} ${escapeText(actual)}</span>` +
          `</div>` +
          explain +
          `</div>`
        );
      })
      .join('');
  }

  setComparisonOutput(
    laterPicker +
      meta +
      summary +
      undetermined +
      rate +
      reliability +
      filters +
      `<div class="wip-comparison-cards">${cards}</div>`
  );

  bindComparisonInteractions(i18n);
}

function renderLaterPicker(i18n) {
  const options = comparisonState.laterSnapshots
    .map(s => {
      const label = formatSnapshotWhen(s.capturedAt);
      const selected = s.id === comparisonState.selectedLaterId ? ' selected' : '';
      return `<option value="${escapeAttr(String(s.id))}"${selected}>${escapeText(label)}</option>`;
    })
    .join('');
  if (!options) return '';
  return (
    `<label class="wip-comparison-meta">${escapeText(i18n.t('comparisonLaterLabel'))}</label>` +
    `<select class="wip-comparison-later" id="wip-comparison-later">${options}</select>`
  );
}

function renderComparisonFilters(i18n) {
  const defs = [
    { key: 'all', label: 'comparisonFilterAll' },
    { key: 'reached', label: 'comparisonFilterReached' },
    { key: 'beyond', label: 'comparisonFilterBeyond' },
    { key: 'behind', label: 'comparisonFilterBehind' },
    { key: 'off-track', label: 'comparisonFilterOffTrack' },
    { key: 'missing', label: 'comparisonFilterMissing' },
  ];
  const buttons = defs
    .map(d => {
      const active = comparisonState.filter === d.key ? ' active' : '';
      return `<button type="button" class="wip-comparison-filter${active}" data-filter="${escapeAttr(d.key)}">${escapeText(i18n.t(d.label))}</button>`;
    })
    .join('');
  return `<div class="wip-comparison-filters">${buttons}</div>`;
}

// Bind the later-snapshot select and the result-filter buttons. Interaction
// re-renders from memory only (no recompute, no board read): R1-safe.
function bindComparisonInteractions(i18n) {
  const select = document.getElementById('wip-comparison-later');
  if (select) {
    select.onchange = () => {
      comparisonState.selectedLaterId = idFromDom(select.value);
      recomputeComparison(i18n);
    };
  }
  const output = document.getElementById('wip-comparison-output');
  if (output) {
    output.querySelectorAll('.wip-comparison-filter').forEach(btn => {
      btn.onclick = () => {
        comparisonState.filter = btn.getAttribute('data-filter') || 'all';
        renderComparison(i18n);
      };
    });
  }
}

function setComparisonStatus(message, kind) {
  const status = document.getElementById('wip-comparison-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function setComparisonOutput(html) {
  const output = document.getElementById('wip-comparison-output');
  if (!output) return;
  // Diff-before-write mirrors the indicator/snapshot guard (R1 fix discipline).
  setIndicatorHtml(output, html || '');
}

function errText(err) {
  return err && err.message ? err.message : String(err);
}

// --- Daily views navigation (roadmap T1.6 §6) ------------------------------
// Switches the panel between the four daily views (Initial board, Projected
// board, Actual result, Commitment comparison) while preserving the selected
// snapshot/commitment identity. The navigation only toggles which sub-sections
// are visible via a panel class; it never recomputes or re-reads the board, and
// never mutates the Projected Board or Azure DevOps.
const dailyViewState = { view: 'comparison' };

function setDailyView(view, i18n) {
  const allowed = ['initial', 'projected', 'actual', 'comparison'];
  dailyViewState.view = allowed.indexOf(view) !== -1 ? view : 'comparison';
  const panel = document.getElementById('wip-snapshot-panel');
  if (panel) {
    allowed.forEach(v => panel.classList.remove('nav-' + v));
    panel.classList.add('nav-' + dailyViewState.view);
    const tabs = panel.querySelectorAll('.wip-nav-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-view') === dailyViewState.view);
    });
  }
  // The Initial and Actual result views are projected-board-driven states; map
  // them onto the projected engine's Initial/Projected toggle so each view
  // preserves the selected snapshot identity without recomputation.
  if (dailyViewState.view === 'initial' && typeof setProjectedView === 'function') {
    setProjectedView('initial', i18n);
  } else if (dailyViewState.view === 'projected' && typeof setProjectedView === 'function') {
    setProjectedView('projected', i18n);
  }
}

// --- Picker HTML-safety helpers --------------------------------------------
// The picker renders work-item titles, ids and column names into innerHTML.
// Those values come from the board (untrusted), so every interpolated value is
// escaped before it reaches the DOM. Text and attribute contexts are escaped
// separately so a title or column name can never break out of its node.

function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Case/accent-tolerant column name match used to pre-select a destination option.
// Reuses the pure picker normalizer so UI and engine agree on equality.
function sameColumnName(a, b) {
  if (!CommitmentPicker || typeof CommitmentPicker.normalizeSearch !== 'function') {
    return String(a == null ? '' : a) === String(b == null ? '' : b);
  }
  const na = CommitmentPicker.normalizeSearch(a);
  const nb = CommitmentPicker.normalizeSearch(b);
  return na !== '' && na === nb;
}

function ensureSnapshotPanel(context, i18n) {
  // Build the panel once; refresh its labels on every call so a language change
  // is reflected without a reload. Returns early when the modules are missing so
  // the core WIP indicator keeps working regardless.
  if (!SnapshotStore || !SnapshotCapture || !document.body) return;

  let panel = document.getElementById('wip-snapshot-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'wip-snapshot-panel';
    panel.innerHTML = `
      <button id="wip-snapshot-toggle" type="button">
        <span id="wip-snapshot-title"></span>
        <span id="wip-snapshot-caret">▴</span>
      </button>
      <div id="wip-snapshot-body">
        <p class="wip-snap-note" id="wip-snapshot-note"></p>
        <div class="wip-snap-actions">
          <button class="wip-snap-btn" id="wip-snapshot-capture" type="button"></button>
          <button class="wip-snap-btn" id="wip-snapshot-latest" type="button"></button>
          <button class="wip-snap-btn" id="wip-snapshot-history" type="button"></button>
        </div>
        <p class="wip-snap-status" id="wip-snapshot-status"></p>
        <div class="wip-snap-output" id="wip-snapshot-output"></div>
        <div class="wip-commit-section" id="wip-commit-section">
          <h4 id="wip-commit-title"></h4>
          <p class="wip-commit-help" id="wip-commit-help"></p>
          <div class="wip-snap-actions">
            <button class="wip-snap-btn" id="wip-commit-pick" type="button"></button>
            <button class="wip-snap-btn" id="wip-commit-compare" type="button"></button>
          </div>
          <input class="wip-commit-search" id="wip-commit-search" type="text" autocomplete="off" />
          <div class="wip-commit-list" id="wip-commit-list"></div>
          <p class="wip-commit-plan" id="wip-commit-plan"></p>
          <div class="wip-snap-actions">
            <button class="wip-snap-btn" id="wip-commit-save" type="button"></button>
          </div>
          <p class="wip-snap-status" id="wip-commit-status"></p>
          <div class="wip-commit-output" id="wip-commit-output"></div>
        </div>
        <div class="wip-projected-section" id="wip-projected-section">
          <h4 id="wip-projected-title"></h4>
          <p class="wip-projected-help" id="wip-projected-help"></p>
          <span class="wip-projected-sim-note" id="wip-projected-sim-note"></span>
          <div class="wip-snap-actions">
            <button class="wip-snap-btn" id="wip-projected-show" type="button"></button>
          </div>
          <div class="wip-projected-toggle">
            <button class="wip-projected-tab" id="wip-projected-tab-initial" type="button"></button>
            <button class="wip-projected-tab active" id="wip-projected-tab-projected" type="button"></button>
          </div>
          <p class="wip-snap-status" id="wip-projected-status"></p>
          <div class="wip-commit-output" id="wip-projected-output"></div>
        </div>
        <div class="wip-comparison-section" id="wip-comparison-section">
          <h4 id="wip-comparison-title"></h4>
          <p class="wip-comparison-help" id="wip-comparison-help"></p>
          <div class="wip-snap-actions">
            <button class="wip-snap-btn" id="wip-comparison-run" type="button"></button>
          </div>
          <p class="wip-snap-status" id="wip-comparison-status"></p>
          <div class="wip-commit-output" id="wip-comparison-output"></div>
        </div>
        <div class="wip-nav-section" id="wip-nav-section">
          <h4 id="wip-nav-title"></h4>
          <div class="wip-nav-tabs">
            <button class="wip-nav-tab" id="wip-nav-initial" data-view="initial" type="button"></button>
            <button class="wip-nav-tab" id="wip-nav-projected" data-view="projected" type="button"></button>
            <button class="wip-nav-tab" id="wip-nav-actual" data-view="actual" type="button"></button>
            <button class="wip-nav-tab active" id="wip-nav-comparison" data-view="comparison" type="button"></button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#wip-snapshot-toggle').addEventListener('click', () => {
      panel.classList.toggle('open');
      const caret = panel.querySelector('#wip-snapshot-caret');
      if (caret) caret.textContent = panel.classList.contains('open') ? '▾' : '▴';
    });
  }

  // Bind actions against the CURRENT context/i18n every refresh so config and
  // language changes take effect. Replacing the handler avoids stacking listeners.
  bindSnapshotButton('wip-snapshot-capture', () => handleCaptureSnapshot(context, i18n));
  bindSnapshotButton('wip-snapshot-latest', () => handleViewLatestSnapshot(context, i18n));
  bindSnapshotButton('wip-snapshot-history', () => handleViewHistory(context, i18n));

  // Localized, static labels.
  setTextById('wip-snapshot-title', i18n.t('snapshotPanelTitle'));
  setTextById('wip-snapshot-note', i18n.t('snapshotLocalOnly'));
  setTextById('wip-snapshot-capture', i18n.t('snapshotCapture'));
  setTextById('wip-snapshot-latest', i18n.t('snapshotLatest'));
  setTextById('wip-snapshot-history', i18n.t('snapshotHistory'));

  // Daily Commitment sub-section (roadmap T1.3). Shown only when the pure engine
  // module is present; bound against the current context/i18n every refresh.
  const commitSection = document.getElementById('wip-commit-section');
  if (commitSection) {
    // The visual picker (roadmap T1.4) needs both the engine and the pure picker
    // view-model. If either is missing, the whole sub-section is hidden so the
    // core WIP indicator and the snapshot panel keep working.
    if (DailyCommitment && CommitmentPicker) {
      commitSection.style.display = 'block';
      bindSnapshotButton('wip-commit-pick', () => handleOpenPicker(context, i18n));
      bindSnapshotButton('wip-commit-save', () => handleSaveCommitment(context, i18n));
      bindSnapshotButton('wip-commit-compare', () => handleCompareCommitment(context, i18n));
      setTextById('wip-commit-title', i18n.t('commitmentSectionTitle'));
      setTextById('wip-commit-help', i18n.t('commitmentHelp'));
      setTextById('wip-commit-pick', i18n.t('commitmentPickerLoad'));
      setTextById('wip-commit-save', i18n.t('commitmentSave'));
      setTextById('wip-commit-compare', i18n.t('commitmentCompare'));

      const search = document.getElementById('wip-commit-search');
      if (search) {
        search.placeholder = i18n.t('commitmentSearchPlaceholder');
        // Bind the live filter once; re-rendering reuses the in-memory rows so a
        // keystroke never re-reads the board (no extra observer churn, R1-safe).
        search.oninput = () => renderPickerList(i18n);
      }

      // Re-render the list if it is already populated so a language switch
      // relabels destinations/meta without losing the current selection.
      if (commitmentPickerState.rows.length) renderPickerList(i18n);
    } else {
      commitSection.style.display = 'none';
    }
  }

  // Projected Board sub-section (roadmap T1.5). Shown only when the pure engine
  // and the commitment engine are present; bound against the current context.
  const projectedSection = document.getElementById('wip-projected-section');
  if (projectedSection) {
    if (ProjectedBoard && DailyCommitment) {
      projectedSection.style.display = 'block';
      bindSnapshotButton('wip-projected-show', () => handleShowProjectedBoard(context, i18n));
      bindSnapshotButton('wip-projected-tab-initial', () => setProjectedView('initial', i18n));
      bindSnapshotButton('wip-projected-tab-projected', () => setProjectedView('projected', i18n));
      setTextById('wip-projected-title', i18n.t('projectedSectionTitle'));
      setTextById('wip-projected-help', i18n.t('projectedHelp'));
      setTextById('wip-projected-sim-note', i18n.t('projectedSimulationNote'));
      setTextById('wip-projected-show', i18n.t('projectedShow'));
      setTextById('wip-projected-tab-initial', i18n.t('projectedViewInitial'));
      setTextById('wip-projected-tab-projected', i18n.t('projectedViewProjected'));

      // Reflect the active view on the tabs and re-render if a projection is
      // already loaded so a language switch relabels without recomputing.
      const initialTab = projectedSection.querySelector('#wip-projected-tab-initial');
      const projectedTab = projectedSection.querySelector('#wip-projected-tab-projected');
      if (initialTab) initialTab.classList.toggle('active', projectedBoardState.view === 'initial');
      if (projectedTab) projectedTab.classList.toggle('active', projectedBoardState.view !== 'initial');
      if (projectedBoardState.projection) renderProjectedBoard(i18n);
    } else {
      projectedSection.style.display = 'none';
    }
  }

  // Daily Comparison sub-section (roadmap T1.6). Shown only when the pure
  // view-model and the commitment engine are present; bound against the current
  // context/i18n every refresh so config and language changes take effect.
  const comparisonSection = document.getElementById('wip-comparison-section');
  if (comparisonSection) {
    if (DailyComparison && DailyCommitment) {
      comparisonSection.style.display = 'block';
      bindSnapshotButton('wip-comparison-run', () => handleRunComparison(context, i18n));
      setTextById('wip-comparison-title', i18n.t('comparisonSectionTitle'));
      setTextById('wip-comparison-help', i18n.t('comparisonHelp'));
      setTextById('wip-comparison-run', i18n.t('comparisonRun'));
      // Relabel an already-rendered comparison without recomputing or re-reading
      // the board, so a language switch keeps the current selection and metrics.
      if (comparisonState.vm) renderComparison(i18n);
    } else {
      comparisonSection.style.display = 'none';
    }
  }

  // Daily views navigation (roadmap T1.6 §6). Shown only when the projected and
  // comparison views are both available, so the four-way switch is meaningful.
  const navSection = document.getElementById('wip-nav-section');
  if (navSection) {
    if (ProjectedBoard && DailyComparison && DailyCommitment) {
      navSection.style.display = 'block';
      bindSnapshotButton('wip-nav-initial', () => setDailyView('initial', i18n));
      bindSnapshotButton('wip-nav-projected', () => setDailyView('projected', i18n));
      bindSnapshotButton('wip-nav-actual', () => setDailyView('actual', i18n));
      bindSnapshotButton('wip-nav-comparison', () => setDailyView('comparison', i18n));
      setTextById('wip-nav-title', i18n.t('navSectionTitle'));
      setTextById('wip-nav-initial', i18n.t('navInitial'));
      setTextById('wip-nav-projected', i18n.t('navProjected'));
      setTextById('wip-nav-actual', i18n.t('navActual'));
      setTextById('wip-nav-comparison', i18n.t('navComparison'));
      // Reflect the active view on the tabs and the panel class.
      const panelEl = document.getElementById('wip-snapshot-panel');
      if (panelEl) {
        ['initial', 'projected', 'actual', 'comparison'].forEach(v =>
          panelEl.classList.remove('nav-' + v)
        );
        panelEl.classList.add('nav-' + dailyViewState.view);
        navSection.querySelectorAll('.wip-nav-tab').forEach(tab => {
          tab.classList.toggle('active', tab.getAttribute('data-view') === dailyViewState.view);
        });
      }
    } else {
      navSection.style.display = 'none';
    }
  }
}

function bindSnapshotButton(id, handler) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.onclick = handler;
}

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

function hideSnapshotPanel() {
  const panel = document.getElementById('wip-snapshot-panel');
  if (panel) panel.style.display = 'none';
}

// ============================================================================
// 2. MAIN WIP CALCULATION AND ANALYSIS
// ============================================================================
// Main runtime flow: scan board, count cards, apply rules, render indicator.
function updateWipBoard() {

  // Guard clause: extension can be reloaded while tab is still open.
  if (!chrome.runtime?.id) return;

  // Resilience (roadmap T0.5): fail loud, not silent. If a required module did
  // not load, show a diagnostic indicator and stop. This prevents the runtime
  // from presenting a real board as empty (WIP = 0) just because a dependency
  // is missing.
  const moduleError = assertRequiredModules();
  if (moduleError) {
    console.error(moduleError.message);
    showRuntimeErrorIndicator(moduleError.message);
    return;
  }

  // Read all user settings from extension storage.
  chrome.storage.sync.get([
    'useEquipe',
    'equipeSize',
    'directWip',
    'showDetails',
    'highlightCards',
    'specialRuleEnabled',
    'boardName',
    'boardPathFilter',
    'specialPeople',
    'wipColumns',
    'specialTagPrefix',
    'blockTag',
    'agingWarningDays',
    'agingHighDays',
    'agingCriticalDays',
    'targetDateWarningDays',
    'language',
  ], (data) => {
    
    // Calculate limit based on selected mode (pure core helper, same two modes).
    const limit = Core.computeWipLimit({
      useEquipe: data.useEquipe,
      equipeSize: data.equipeSize,
      directWip: data.directWip,
    });

    const {
      isConfigured,
      isHighlightActive,
      isDetailsActive,
      currentBoardName,
      boardPathFilter,
      wipColumns,
      isSpecialRuleActive,
      specialPeople,
      specialTagPrefix,
      blockTag,
      alarmConfig,
      language,
    } = getBoardContext(data);
    const i18n = getLanguagePack(language);

    if (!isConfigured) {
      let indicator = document.getElementById('custom-wip-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'custom-wip-indicator';
        indicator.style.cssText = 'position:fixed;top:15px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:20px;font-size:13px;font-weight:bold;z-index:999999;background:#fff3cd;color:#856404;border:2px solid #ffc107;box-shadow:0 4px 12px rgba(0,0,0,.15);font-family:inherit;cursor:default;';
        document.body.appendChild(indicator);
      }
      indicator.style.display = 'block';
      setIndicatorHtml(indicator, `<div>${i18n.t('indicatorMissingConfig')}</div>`);
      // Snapshot capture needs a configured board scope; keep the panel hidden.
      hideSnapshotPanel();
      return;
    }
    
    // Hide indicator when current URL does not match configured board/route filters.
    if (!isAllowedBoard(currentBoardName, boardPathFilter)) {
      const indicator = document.getElementById('custom-wip-indicator');
      if (indicator) indicator.style.display = 'none';
      hideSnapshotPanel();
      return;
    }

    let totalCards = 0; // Raw sum based on visible cards in WIP columns.
    const specialStatsByPerson = new Map(); // Per-person counters used by the special WIP reduction rule.
    const allWipCards = [];
    let columnsBreakdown = []; // Per-column subtotal shown in the details panel.

    let boardModel;
    try {
      // Read a normalized, presentation-free model of the board once (data layer).
      // The reader centralizes selector handling and visibility detection, so the
      // runtime no longer pairs header/body nodes by fragile ordinal index.
      boardModel = readBoardModel();
    } catch (err) {
      // A reader failure must be visible, never silently coerced to WIP = 0.
      console.error(err && err.message ? err.message : err);
      showRuntimeErrorIndicator(err && err.message ? err.message : String(err));
      return;
    }

    // Map each stable work-item id to its live DOM card node, so per-card rule
    // analysis and alarm styling keep operating on the real element while the
    // counting/column structure comes from the normalized model.
    const liveCardsById = buildLiveCardIndex();

    // Keep only configured WIP columns, preserving the model's column order.
    const wipColumnsModel = boardModel.columns.filter(column =>
      isConfiguredWipColumn(column.name, wipColumns)
    );

    wipColumnsModel.forEach(column => {
      // Visible items of this column, matched by stable column id + name. All
      // occurrences are kept (including swimlane duplicates), mirroring the legacy
      // per-DOM-node count exactly.
      const columnItems = boardModel.items.filter(item =>
        item.isVisible &&
        item.column === column.name &&
        item.columnId === column.id
      );

      const colTotal = columnItems.length;
      totalCards += colTotal;
      columnsBreakdown.push({ name: column.name, count: colTotal });

      columnItems.forEach(item => {
        // Resolve the live DOM node for rule analysis and alarm styling.
        const card = resolveLiveCard(liveCardsById, item);
        if (!card) return;
        allWipCards.push(card);

        if (!isSpecialRuleActive) return;

        const assignees = getCardAssignees(card);
        const matchedPerson = specialPeople.find(person => assignees.some(name => name.includes(person)));
        if (!matchedPerson) return;

        const currentStats = specialStatsByPerson.get(matchedPerson) || { tagged: 0, untagged: 0 };
        const { hasSpecialTag } = analyzeSpecialRule(card, specialTagPrefix);

        if (hasSpecialTag) {
          currentStats.tagged += 1;
        } else {
          currentStats.untagged += 1;
        }

        specialStatsByPerson.set(matchedPerson, currentStats);
      });
    });

    // Final WIP business rule: per special person, all matching special-tag cards
    // count as 1 block. Delegated to the pure core helper (identical math).
    let finalWip = totalCards;
    if (isSpecialRuleActive && specialStatsByPerson.size > 0) {
      finalWip = Core.applySpecialPersonReduction(totalCards, specialStatsByPerson.values());
    }

    // R1 fix: perform all DOM writes with the observer paused, so the
    // extension's own mutations (card alarm classes/title + indicator rewrite)
    // do not retrigger the observer and seed a recompute cycle. Real external
    // board changes still arrive once the observer reconnects on the next
    // microtask. The WIP math above is complete and unchanged; only the write
    // phase is wrapped.
    const snapshotContext = { currentBoardName, boardPathFilter };

    withObserverPaused(() => {
      // Evaluate card-level alarms only in WIP columns.
      allWipCards.forEach(card => {
        applyCardAlarm(card, isHighlightActive, alarmConfig, blockTag, i18n);
      });

      // Render final indicator state.
      displayWip(finalWip, limit, columnsBreakdown, isDetailsActive, i18n);

      // Mount/refresh the Daily Snapshot panel (roadmap T1.2). Built inside the
      // paused write phase so its one-time creation + diff-guarded label refresh
      // never re-arm the observer (keeps the R1 fix intact). Capture itself only
      // ever runs on an explicit button click, never from this recompute path.
      ensureSnapshotPanel(snapshotContext, i18n);
    });
  });
}

// ============================================================================
// 3. INDICATOR RENDERING AND DETAILS PANEL
// ============================================================================

function showRuntimeErrorIndicator(message) {
  // Diagnostic indicator used when a required module is missing or the reader
  // throws. It is intentionally distinct from the WIP indicator states so a
  // real failure is never mistaken for a legitimately empty board (WIP = 0).
  if (!document.body) return;
  let indicator = document.getElementById('custom-wip-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'custom-wip-indicator';
    indicator.style.cssText = 'position:fixed;top:15px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:20px;font-size:13px;font-weight:bold;z-index:999999;background:#fde8e8;color:#9b1c1c;border:2px solid #f98080;box-shadow:0 4px 12px rgba(0,0,0,.15);font-family:inherit;cursor:default;';
    document.body.appendChild(indicator);
  }
  indicator.className = '';
  indicator.style.backgroundColor = '#fde8e8';
  indicator.style.color = '#9b1c1c';
  indicator.style.border = '2px solid #f98080';
  indicator.style.display = 'block';
  // Short, actionable message; full detail is in the console.
  const safeMessage = String(message || 'WIP Board runtime error').replace(/[<>]/g, '');
  setIndicatorHtml(indicator, `<div>⚠️ ${safeMessage}</div>`);
}

// Render floating indicator with optional click-to-open details panel.
function displayWip(current, limit, breakdown, isDetailsActive, i18n) {
  let indicator = document.getElementById('custom-wip-indicator');
  
  // Create floating indicator once, then reuse.
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'custom-wip-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 24px;
      border-radius: 20px;
      font-size: 15px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: background-color 0.3s, color 0.3s, border-color 0.3s;
      font-family: inherit;
    `;
    
    // --- MOUSE BEHAVIOR (DRAG vs CLICK) ---
    // Distinguish between click-to-toggle panel and drag-to-reposition.
    let isDragging = false;
    let startX = 0, startY = 0, offsetX = 0, offsetY = 0;

    // Pointer down starts possible drag flow.
    indicator.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = false; // Presumimos inicialmente que é um clique simples
      startX = e.clientX;
      startY = e.clientY;
      const rect = indicator.getBoundingClientRect();
      offsetX = rect.left;
      offsetY = rect.top;

      // Track pointer move and release.
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // During pointer move, switch to drag mode after a small threshold.
    function onMouseMove(e) {
      // Ignore tiny jitter and only drag after threshold.
      if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
        isDragging = true;
      }
      
      // Keep indicator inside viewport bounds.
      let newLeft = offsetX + (e.clientX - startX);
      let newTop = offsetY + (e.clientY - startY);
      const maxLeft = window.innerWidth - indicator.offsetWidth;
      const maxTop = window.innerHeight - indicator.offsetHeight;
      
      indicator.style.left = Math.min(Math.max(newLeft, 0), maxLeft) + 'px';
      indicator.style.top = Math.min(Math.max(newTop, 0), maxTop) + 'px';
      indicator.style.transform = 'scale(1)'; 
    }

    // On pointer up, complete drag or toggle details panel.
    function onMouseUp(e) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Toggle details only on click behavior and when details feature is enabled.
      if (!isDragging && indicator.dataset.clickable === "true") {
        const panel = document.getElementById('wip-details-panel');
        if (panel) {
          // Toggle panel display state.
          panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        }
      }
    }

    document.body.appendChild(indicator);
  }

  // Cursor reflects current interaction mode.
  indicator.dataset.clickable = isDetailsActive;
  indicator.style.cursor = isDetailsActive ? 'pointer' : 'move';

  // Always ensure indicator is visible when current page is eligible.
  indicator.style.display = 'block';

  applyWipIndicatorState(indicator, current, limit, isDetailsActive, breakdown, i18n);
}

function startBoardObservation() {
  // Start observer only after body exists to avoid first-load race conditions.
  if (!document.body) {
    window.addEventListener('load', startBoardObservation, { once: true });
    return;
  }

  observer.observe(document.body, { childList: true, subtree: true });
  bootstrapBoardRender();
}

function bootstrapBoardRender(attempt = 0) {
  // Retry briefly while Azure is still mounting board DOM.
  updateWipBoard();

  const hasBoardHeaders = document.querySelectorAll('.kanban-board-column-header').length > 0;
  if (hasBoardHeaders || attempt >= 10) {
    // Board is ready.
    return;
  }

  setTimeout(() => bootstrapBoardRender(attempt + 1), 500);
}

function ensureBoardMounted() {
  // Azure mounts board asynchronously, so retry until column headers are present.
  const hasBoardHeaders = document.querySelectorAll('.kanban-board-column-header').length > 0;
  if (hasBoardHeaders) {
    updateWipBoard();
    return;
  }

  let attempt = 0;
  const retry = () => {
    updateWipBoard();
    if (document.querySelectorAll('.kanban-board-column-header').length > 0 || attempt >= 12) {
      return;
    }

    attempt += 1;
    setTimeout(retry, 500);
  };

  retry();
}






// ============================================================================
// 4. OBSERVERS AND INITIAL TRIGGERS
// ============================================================================

// MutationObserver watches board mutations (moves, edits, dynamic updates).
let observerTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(observerTimeout);
  // Debounce to avoid expensive recalculation bursts during continuous DOM changes.
  observerTimeout = setTimeout(updateWipBoard, 300);
});

// Sync runtime behavior when user updates popup settings.
chrome.storage.onChanged.addListener(() => {
  updateWipBoard();
});

// Main init entrypoint.
function init() {
  startBoardObservation();
}

// Run init immediately when ready, or wait for DOM content event.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('pageshow', () => {
  ensureBoardMounted();
});