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
    reasonHeaderCountMismatch: 'Azure header totals differ from visible cards',
    reasonColumnAlignmentUnknown: 'column headers and card bodies cannot be matched safely',
    reasonHeaderCountUnavailable: 'Azure does not expose a verifiable column total',
    snapshotObservedCount: '{{count}} visible',
    snapshotHeaderCount: '{{count}} on board',
    snapshotHeaderCountUnknown: 'board total not exposed',
    snapshotBoardId: 'Board: {{board}}',
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
    // Daily History (roadmap T1.7): historical analysis of past dailies.
    historySectionTitle: 'Daily History',
    historyHelp: 'Review the dailies recorded for this board. Each record keeps its original plan, snapshots and result. Nothing is recomputed from the current board state.',
    historyRefresh: 'Load history',
    historyFromLabel: 'From:',
    historyToLabel: 'To:',
    historyApplyFilter: 'Apply period',
    historyClearFilter: 'Clear period',
    historyLoading: 'Loading history…',
    historyError: 'History failed: {{message}}',
    historyEmpty: 'No dailies recorded for this board yet.',
    historyEmptyRange: 'No dailies in the selected period.',
    historySummary: 'Dailies {{dailies}} · planned {{committed}} · proven fulfilled {{fulfilled}} · undetermined {{undetermined}}.',
    historyOverallRate: 'Overall proven fulfillment rate: {{rate}}% (weighted by commitments).',
    historyOverallRateUnavailable: 'Overall proven fulfillment rate: unavailable (no reliably evaluated daily).',
    historyUnreliableCount: 'Records without a reliable evaluation: {{count}}.',
    historyEvolutionTitle: 'Daily evolution',
    historyEvolutionPoint: '{{date}}: {{rate}}% ({{committed}} planned)',
    historyEvolutionPointUnavailable: '{{date}}: n/a ({{committed}} planned)',
    historyRecordDate: 'Daily: {{date}}',
    historyRecordNoDate: 'Daily: date unavailable',
    historyRecordPlanning: 'Planning: {{when}}',
    historyRecordEvaluation: 'Evaluation: {{when}}',
    historyRecordNoEvaluation: 'Evaluation: none recorded',
    historyRecordCommitment: 'Commitment {{id}} · revision {{revision}}',
    historyRecordRevisionInEffect: 'Revision in effect at evaluation: {{revision}}',
    historyRecordInferredEvaluation: 'Evaluation snapshot inferred (not explicitly recorded).',
    historyRecordMetrics: 'Planned {{committed}} · reached {{reached}} · beyond {{beyond}} · behind {{behind}} · off-track {{offTrack}} · missing {{missing}}.',
    historyRecordRate: 'Proven: {{rate}}%',
    historyRecordRateUnavailable: 'Proven: unavailable',
    historyRecordUnreliable: 'Not reliably evaluated: {{reasons}}.',
    historyRecordOpen: 'Open comparison',
    historyReasonNoBase: 'no base snapshot',
    historyReasonNoLater: 'no later snapshot',
    historyReasonIncomplete: 'incomplete snapshot',
    historyReasonOrder: 'unreliable column order',
    historyReasonNoCommitment: 'no commitment',
    historyReasonFailed: 'comparison failed',
    // Sprint Intelligence (roadmap T2.2): sprint identity, goal, scope baseline.
    sprintSectionTitle: 'Sprint Intelligence',
    sprintBaselineAlreadyExists: 'A baseline already exists for this sprint. It was not overwritten.',
    trendsObservedUnavailable: 'Observed completion is unavailable for this baseline revision.',
    trendsSeriesUnavailable: '{{when}} — completion unavailable (baseline mismatch).',
    trendsScopeUnreliable: 'Incomplete observation: scope changes cannot be established.',
    sprintIncompleteScope: 'Current board data is incomplete; scope removals cannot be confirmed.',
    sprintHelp: 'Identify the sprint, its period and goal, and record the initially planned scope. Delivery data, kept separate from WIP. Uses the read-only API when enabled; otherwise a manual configuration, never simulated data.',
    sprintRefresh: 'Load sprint',
    sprintLoading: 'Loading sprint…',
    sprintError: 'Sprint failed: {{message}}',
    sprintScopeMissing: 'Could not resolve the board scope (organization/project).',
    sprintStateApi: 'Source: Azure DevOps API (read-only)',
    sprintStateManual: 'Source: manual configuration (local)',
    sprintStateDisabled: 'API disabled. Enable the feature flag or configure the sprint manually.',
    sprintStateUnauthenticated: 'API enabled but not authenticated. Sign in or configure the sprint manually.',
    sprintStateUnavailable: 'Sprint data unavailable right now. Configure the sprint manually if needed.',
    sprintStateNoSprint: 'The team has no current sprint.',
    sprintStateNone: 'No sprint identified.',
    sprintUnavailableBadge: 'Unavailable',
    sprintRealBadge: 'Live',
    sprintManualBadge: 'Manual',
    sprintIdLabel: 'Sprint',
    sprintPathLabel: 'Iteration path',
    sprintPeriodLabel: 'Period',
    sprintPeriodUnknown: 'Period unavailable',
    sprintDaysElapsed: '{{elapsed}} of {{total}} days elapsed',
    sprintDaysRemaining: '{{remaining}} days remaining',
    sprintDaysUnknown: 'Day count unavailable',
    sprintPlannedCount: 'Planned at baseline: {{count}}',
    sprintAddedCount: 'Added after planning: {{count}}',
    sprintRemovedCount: 'Removed from scope: {{count}}',
    sprintCompletedCount: 'Completed: {{count}}',
    sprintInProgressCount: 'In progress: {{count}}',
    sprintCurrentCount: 'Current scope: {{count}}',
    sprintNoBaseline: 'No baseline recorded yet. Record the initial scope to track scope changes.',
    sprintRecordBaseline: 'Record initial scope',
    sprintReplaceBaseline: 'Re-baseline (explicit)',
    sprintBaselineSaved: 'Initial scope recorded ({{count}} items).',
    sprintBaselineExists: 'A baseline already exists. Re-baselining archives the current one.',
    sprintBaselineNeedsSprint: 'A sprint must be identified before recording the baseline.',
    sprintGoalTitle: 'Sprint goal',
    sprintGoalObjective: 'Main objective',
    sprintGoalDescription: 'What we intend to deliver',
    sprintGoalCriteria: 'Success criteria (one per line)',
    sprintGoalPriorities: 'Priorities (one per line)',
    sprintGoalSave: 'Save goal',
    sprintGoalSaved: 'Goal saved (revision {{revision}}).',
    sprintGoalHistory: '{{count}} prior revision(s) kept',
    sprintGoalEmpty: 'No goal configured for this sprint yet.',
    sprintGoalNeedsSprint: 'A sprint must be identified before saving a goal.',
    sprintManualTitle: 'Manual sprint (local)',
    sprintManualId: 'Sprint id/name',
    sprintManualStart: 'Start date',
    sprintManualFinish: 'Finish date',
    sprintManualSave: 'Use manual sprint',
    sprintManualSaved: 'Manual sprint configured.',
    sprintManualNeedsId: 'A sprint id or name is required.',
    // Sprint Progress (roadmap T2.3): baseline completion as the primary metric,
    // current-scope progress as a secondary one, kept separate and honest.
    progressSectionTitle: 'Sprint progress',
    progressHelp: 'Delivery progress measured against the immutable baseline. Baseline completion is the primary metric; current-scope progress is shown separately. Unknown items are never counted as done.',
    progressNoBaseline: 'Record the initial scope to compute sprint progress.',
    progressPrimaryTitle: 'Baseline completion (primary)',
    progressBaselinePct: '{{pct}}% of the baseline completed',
    progressBaselinePctPartial: '{{pct}}% proven completed ({{evaluable}} of {{total}} evaluable)',
    progressBaselineCounts: '{{completed}} of {{planned}} planned items completed',
    progressNotStarted: 'Not started: {{count}}',
    progressInProgress: 'In progress: {{count}}',
    progressCompleted: 'Completed: {{count}}',
    progressUnknown: 'Insufficient evidence: {{count}}',
    progressRemoved: 'Removed from scope: {{count}}',
    progressSecondaryTitle: 'Current scope (secondary)',
    progressCurrentPct: '{{pct}}% of the current scope completed',
    progressCurrentCounts: '{{completed}} of {{total}} current items completed',
    progressAdded: 'Added after baseline: {{count}}',
    progressAddedCompleted: 'Added items completed: {{count}}',
    progressScopeDelta: 'Scope variation: {{delta}}',
    progressColumnsTitle: 'By column/stage',
    progressColumnRow: '{{column}}: {{count}}',
    progressColumnUnknown: 'Unknown column: {{count}}',
    progressReliabilityTitle: 'Reliability',
    progressReliabilitySufficient: 'Sufficient evidence: every baseline item has a known position.',
    progressReliabilityPartial: 'Partial evidence: {{count}} baseline item(s) lack a known position. The percentage reflects only what is proven.',
    progressReliabilityUnavailable: 'Progress unavailable: no baseline to measure against.',
    progressLateBaseline: 'Late baseline: the initial scope was captured after the sprint started. It is not a true start-of-sprint snapshot.',
    // Sprint Trends & Risk (roadmap T2.4): temporal analysis over persisted
    // observations. Trends and risk are heuristics over real data, never a
    // statistical forecast.
    trendsSectionTitle: 'Sprint trends & risk',
    trendsHelp: 'Temporal analysis over successive observations of the sprint. Progress over time, scope changes and heuristic risk signals from real, persisted data. The reference line is not a forecast.',
    trendsRecordObservation: 'Record observation',
    trendsRefresh: 'Load trends',
    trendsObservationSaved: 'Observation recorded ({{count}} items).',
    trendsObservationNeedsSprint: 'A sprint and a baseline must exist before recording an observation.',
    trendsNoBaseline: 'Record the initial scope (baseline) to analyze trends.',
    trendsNoHistory: 'No observations recorded yet. Record an observation to start the trend history.',
    trendsSingleObservation: 'Only one observation recorded. Record more over time to see a trend.',
    trendsObservationCount: 'Observations: {{count}}',
    trendsLastObservation: 'Last observation: {{when}}',
    trendsViewProgress: 'Progress',
    trendsViewScope: 'Scope',
    trendsViewTrends: 'Trends',
    trendsTimeTitle: 'Progress vs time',
    trendsElapsed: 'Time elapsed (calendar): {{pct}}%',
    trendsElapsedUnknown: 'Elapsed time unavailable (no reliable dates).',
    trendsReference: 'Linear reference: {{pct}}% (visual aid, not a forecast)',
    trendsObservedCompletion: 'Observed baseline completion: {{pct}}%',
    trendsDeviation: 'Deviation vs reference: {{pts}} pts (information, not proof of delay)',
    trendsSeriesTitle: 'Completion over time',
    trendsSeriesPoint: '{{when}}: {{pct}}% ({{completed}}/{{total}})',
    trendsSeriesPointPartial: '{{when}}: {{pct}}% ({{completed}}/{{total}}, partial)',
    trendsBurnTitle: 'Burnup / burndown',
    trendsBurnupPoint: '{{when}}: {{completed}} of {{total}} done',
    trendsBurndownPoint: '{{when}}: {{remaining}} remaining, {{unknown}} unknown',
    trendsBurnNote: 'Only real observation instants are shown; no daily points are fabricated.',
    trendsScopeTitle: 'Scope changes over time',
    trendsScopeInterval: 'Between {{from}} and {{to}} (detected in interval):',
    trendsScopeAdded: 'Added: {{ids}}',
    trendsScopeRemoved: 'Removed: {{ids}}',
    trendsScopeReturned: 'Returned: {{ids}}',
    trendsScopeNone: 'No scope changes detected between observations.',
    trendsRiskTitle: 'Risk indicator',
    trendsRiskOnTrack: 'On Track',
    trendsRiskAttention: 'Attention',
    trendsRiskAtRisk: 'At Risk',
    trendsRiskInsufficient: 'Insufficient Data',
    trendsRiskSignalsTitle: 'Signals behind the verdict:',
    trendsRiskNoSignals: 'No adverse signals in the observed data.',
    trendsSignalBehindReference: 'Behind the time reference by {{value}} pts',
    trendsSignalLateLowCompletion: 'Late sprint with low completion ({{value}}%)',
    trendsSignalScopeGrowth: 'Scope growth of {{value}}% over the baseline',
    trendsSignalStagnation: '{{value}} item(s) with no movement across observations',
    trendsSignalUnknownShare: 'High share of unknown-state items ({{value}}%)',
    trendsRiskInsufficientReason: 'Too few reliable observations or too many unknown items to judge risk.',
    trendsRiskDisclaimer: 'Heuristic over observed data. Not a statistical forecast; the sprint is not certain to finish or to be late.',
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
    reasonHeaderCountMismatch: 'totais do cabeçalho do Azure diferem dos cards visíveis',
    reasonColumnAlignmentUnknown: 'não foi possível associar cabeçalhos e corpos de coluna com segurança',
    reasonHeaderCountUnavailable: 'o Azure não disponibiliza um total verificável para a coluna',
    snapshotObservedCount: '{{count}} visíveis',
    snapshotHeaderCount: '{{count}} no board',
    snapshotHeaderCountUnknown: 'total do board indisponível',
    snapshotBoardId: 'Board: {{board}}',
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
    // Histórico da Daily (roadmap T1.7): análise histórica das dailies.
    historySectionTitle: 'Histórico da Daily',
    historyHelp: 'Reveja as dailies registradas deste board. Cada registro mantém o plano original, os snapshots e o resultado. Nada é recalculado com o estado atual do board.',
    historyRefresh: 'Carregar histórico',
    historyFromLabel: 'De:',
    historyToLabel: 'Até:',
    historyApplyFilter: 'Aplicar período',
    historyClearFilter: 'Limpar período',
    historyLoading: 'Carregando histórico…',
    historyError: 'Falha no histórico: {{message}}',
    historyEmpty: 'Ainda não há dailies registradas para este board.',
    historyEmptyRange: 'Nenhuma daily no período selecionado.',
    historySummary: 'Dailies {{dailies}} · planejados {{committed}} · cumpridos comprovados {{fulfilled}} · indeterminados {{undetermined}}.',
    historyOverallRate: 'Taxa geral de cumprimento comprovado: {{rate}}% (ponderada pelos compromissos).',
    historyOverallRateUnavailable: 'Taxa geral de cumprimento comprovado: indisponível (nenhuma daily avaliada com confiança).',
    historyUnreliableCount: 'Registros sem avaliação confiável: {{count}}.',
    historyEvolutionTitle: 'Evolução diária',
    historyEvolutionPoint: '{{date}}: {{rate}}% ({{committed}} planejados)',
    historyEvolutionPointUnavailable: '{{date}}: n/d ({{committed}} planejados)',
    historyRecordDate: 'Daily: {{date}}',
    historyRecordNoDate: 'Daily: data indisponível',
    historyRecordPlanning: 'Planejamento: {{when}}',
    historyRecordEvaluation: 'Avaliação: {{when}}',
    historyRecordNoEvaluation: 'Avaliação: nenhuma registrada',
    historyRecordCommitment: 'Compromisso {{id}} · revisão {{revision}}',
    historyRecordRevisionInEffect: 'Revisão vigente na avaliação: {{revision}}',
    historyRecordInferredEvaluation: 'Snapshot de avaliação inferido (não registrado explicitamente).',
    historyRecordMetrics: 'Planejados {{committed}} · atingiu {{reached}} · além {{beyond}} · aquém {{behind}} · indefinido {{offTrack}} · sumiu {{missing}}.',
    historyRecordRate: 'Comprovado: {{rate}}%',
    historyRecordRateUnavailable: 'Comprovado: indisponível',
    historyRecordUnreliable: 'Sem avaliação confiável: {{reasons}}.',
    historyRecordOpen: 'Abrir comparação',
    historyReasonNoBase: 'sem snapshot inicial',
    historyReasonNoLater: 'sem snapshot posterior',
    historyReasonIncomplete: 'snapshot incompleto',
    historyReasonOrder: 'ordem de colunas não confiável',
    historyReasonNoCommitment: 'sem compromisso',
    historyReasonFailed: 'falha na comparação',
    // Sprint Intelligence (roadmap T2.2): identidade da sprint, objetivo, linha de base do escopo.
    sprintBaselineAlreadyExists: 'Já existe uma linha de base para esta sprint. Ela não foi sobrescrita.',
    trendsObservedUnavailable: 'A conclusão observada não está disponível para esta revisão da linha de base.',
    trendsSeriesUnavailable: '{{when}} — conclusão indisponível (linha de base incompatível).',
    trendsScopeUnreliable: 'Observação incompleta: não é possível determinar as alterações de escopo.',
    sprintIncompleteScope: 'Os dados atuais do board estão incompletos; não é possível confirmar remoções do escopo.',
    sprintSectionTitle: 'Sprint Intelligence',
    sprintHelp: 'Identifique a sprint, seu período e objetivo, e registre o escopo inicialmente planejado. Dados de entrega, separados do WIP. Usa a API somente leitura quando habilitada; caso contrário, configuração manual, nunca dados simulados.',
    sprintRefresh: 'Carregar sprint',
    sprintLoading: 'Carregando sprint…',
    sprintError: 'Falha na sprint: {{message}}',
    sprintScopeMissing: 'Não foi possível resolver o escopo do board (organização/projeto).',
    sprintStateApi: 'Fonte: API do Azure DevOps (somente leitura)',
    sprintStateManual: 'Fonte: configuração manual (local)',
    sprintStateDisabled: 'API desabilitada. Habilite a feature flag ou configure a sprint manualmente.',
    sprintStateUnauthenticated: 'API habilitada, mas sem autenticação. Autentique-se ou configure a sprint manualmente.',
    sprintStateUnavailable: 'Dados da sprint indisponíveis no momento. Configure a sprint manualmente se necessário.',
    sprintStateNoSprint: 'O time não possui sprint atual.',
    sprintStateNone: 'Nenhuma sprint identificada.',
    sprintUnavailableBadge: 'Indisponível',
    sprintRealBadge: 'Ao vivo',
    sprintManualBadge: 'Manual',
    sprintIdLabel: 'Sprint',
    sprintPathLabel: 'Iteration Path',
    sprintPeriodLabel: 'Período',
    sprintPeriodUnknown: 'Período indisponível',
    sprintDaysElapsed: '{{elapsed}} de {{total}} dias decorridos',
    sprintDaysRemaining: '{{remaining}} dias restantes',
    sprintDaysUnknown: 'Contagem de dias indisponível',
    sprintPlannedCount: 'Planejados na linha de base: {{count}}',
    sprintAddedCount: 'Adicionados após o planejamento: {{count}}',
    sprintRemovedCount: 'Removidos do escopo: {{count}}',
    sprintCompletedCount: 'Concluídos: {{count}}',
    sprintInProgressCount: 'Em andamento: {{count}}',
    sprintCurrentCount: 'Escopo atual: {{count}}',
    sprintNoBaseline: 'Nenhuma linha de base registrada. Registre o escopo inicial para acompanhar mudanças.',
    sprintRecordBaseline: 'Registrar escopo inicial',
    sprintReplaceBaseline: 'Refazer linha de base (explícito)',
    sprintBaselineSaved: 'Escopo inicial registrado ({{count}} itens).',
    sprintBaselineExists: 'Já existe uma linha de base. Refazê-la arquiva a atual.',
    sprintBaselineNeedsSprint: 'Uma sprint precisa estar identificada antes de registrar a linha de base.',
    sprintGoalTitle: 'Objetivo da sprint',
    sprintGoalObjective: 'Objetivo principal',
    sprintGoalDescription: 'O que pretendemos entregar',
    sprintGoalCriteria: 'Critérios de sucesso (um por linha)',
    sprintGoalPriorities: 'Prioridades (uma por linha)',
    sprintGoalSave: 'Salvar objetivo',
    sprintGoalSaved: 'Objetivo salvo (revisão {{revision}}).',
    sprintGoalHistory: '{{count}} revisão(ões) anterior(es) preservada(s)',
    sprintGoalEmpty: 'Nenhum objetivo configurado para esta sprint ainda.',
    sprintGoalNeedsSprint: 'Uma sprint precisa estar identificada antes de salvar o objetivo.',
    sprintManualTitle: 'Sprint manual (local)',
    sprintManualId: 'Id/nome da sprint',
    sprintManualStart: 'Data de início',
    sprintManualFinish: 'Data de término',
    sprintManualSave: 'Usar sprint manual',
    sprintManualSaved: 'Sprint manual configurada.',
    sprintManualNeedsId: 'É necessário um id ou nome da sprint.',
    // Sprint Progress (roadmap T2.3): conclusão da linha de base como métrica
    // principal e progresso do escopo atual como secundária, separadas e honestas.
    progressSectionTitle: 'Progresso da sprint',
    progressHelp: 'Progresso de entrega medido contra a linha de base imutável. A conclusão da linha de base é a métrica principal; o progresso do escopo atual é mostrado à parte. Itens desconhecidos nunca são contados como concluídos.',
    progressNoBaseline: 'Registre o escopo inicial para calcular o progresso da sprint.',
    progressPrimaryTitle: 'Conclusão da linha de base (principal)',
    progressBaselinePct: '{{pct}}% da linha de base concluída',
    progressBaselinePctPartial: '{{pct}}% comprovadamente concluído ({{evaluable}} de {{total}} avaliáveis)',
    progressBaselineCounts: '{{completed}} de {{planned}} itens planejados concluídos',
    progressNotStarted: 'Não iniciados: {{count}}',
    progressInProgress: 'Em andamento: {{count}}',
    progressCompleted: 'Concluídos: {{count}}',
    progressUnknown: 'Evidência insuficiente: {{count}}',
    progressRemoved: 'Removidos do escopo: {{count}}',
    progressSecondaryTitle: 'Escopo atual (secundário)',
    progressCurrentPct: '{{pct}}% do escopo atual concluído',
    progressCurrentCounts: '{{completed}} de {{total}} itens atuais concluídos',
    progressAdded: 'Adicionados após a linha de base: {{count}}',
    progressAddedCompleted: 'Itens adicionados concluídos: {{count}}',
    progressScopeDelta: 'Variação de escopo: {{delta}}',
    progressColumnsTitle: 'Por coluna/etapa',
    progressColumnRow: '{{column}}: {{count}}',
    progressColumnUnknown: 'Coluna desconhecida: {{count}}',
    progressReliabilityTitle: 'Confiabilidade',
    progressReliabilitySufficient: 'Evidência suficiente: todos os itens da linha de base têm posição conhecida.',
    progressReliabilityPartial: 'Evidência parcial: {{count}} item(ns) da linha de base sem posição conhecida. O percentual reflete apenas o que está comprovado.',
    progressReliabilityUnavailable: 'Progresso indisponível: não há linha de base para medir.',
    progressLateBaseline: 'Linha de base tardia: o escopo inicial foi capturado após o início da sprint. Não é um retrato real do começo da sprint.',
    // Sprint Trends & Risk (roadmap T2.4): análise temporal sobre observações
    // persistidas. Tendências e risco são heurísticas sobre dados reais, nunca
    // previsão estatística.
    trendsSectionTitle: 'Tendências e risco da sprint',
    trendsHelp: 'Análise temporal sobre observações sucessivas da sprint. Progresso ao longo do tempo, alterações de escopo e sinais heurísticos de risco a partir de dados reais persistidos. A linha de referência não é uma previsão.',
    trendsRecordObservation: 'Registrar observação',
    trendsRefresh: 'Carregar tendências',
    trendsObservationSaved: 'Observação registrada ({{count}} itens).',
    trendsObservationNeedsSprint: 'É preciso ter uma sprint e uma linha de base antes de registrar uma observação.',
    trendsNoBaseline: 'Registre o escopo inicial (linha de base) para analisar tendências.',
    trendsNoHistory: 'Nenhuma observação registrada ainda. Registre uma observação para iniciar o histórico de tendências.',
    trendsSingleObservation: 'Apenas uma observação registrada. Registre mais ao longo do tempo para ver uma tendência.',
    trendsObservationCount: 'Observações: {{count}}',
    trendsLastObservation: 'Última observação: {{when}}',
    trendsViewProgress: 'Progresso',
    trendsViewScope: 'Escopo',
    trendsViewTrends: 'Tendências',
    trendsTimeTitle: 'Progresso vs tempo',
    trendsElapsed: 'Tempo decorrido (corrido): {{pct}}%',
    trendsElapsedUnknown: 'Tempo decorrido indisponível (sem datas confiáveis).',
    trendsReference: 'Referência linear: {{pct}}% (apoio visual, não é previsão)',
    trendsObservedCompletion: 'Conclusão observada do baseline: {{pct}}%',
    trendsDeviation: 'Desvio vs referência: {{pts}} pts (informação, não prova de atraso)',
    trendsSeriesTitle: 'Conclusão ao longo do tempo',
    trendsSeriesPoint: '{{when}}: {{pct}}% ({{completed}}/{{total}})',
    trendsSeriesPointPartial: '{{when}}: {{pct}}% ({{completed}}/{{total}}, parcial)',
    trendsBurnTitle: 'Burnup / burndown',
    trendsBurnupPoint: '{{when}}: {{completed}} de {{total}} concluídos',
    trendsBurndownPoint: '{{when}}: {{remaining}} restantes, {{unknown}} desconhecidos',
    trendsBurnNote: 'Somente os instantes reais de observação são mostrados; nenhum ponto diário é fabricado.',
    trendsScopeTitle: 'Alterações de escopo ao longo do tempo',
    trendsScopeInterval: 'Entre {{from}} e {{to}} (detectado no intervalo):',
    trendsScopeAdded: 'Adicionados: {{ids}}',
    trendsScopeRemoved: 'Removidos: {{ids}}',
    trendsScopeReturned: 'Retornaram: {{ids}}',
    trendsScopeNone: 'Nenhuma alteração de escopo detectada entre observações.',
    trendsRiskTitle: 'Indicador de risco',
    trendsRiskOnTrack: 'No caminho',
    trendsRiskAttention: 'Atenção',
    trendsRiskAtRisk: 'Em risco',
    trendsRiskInsufficient: 'Dados insuficientes',
    trendsRiskSignalsTitle: 'Sinais que originaram o veredito:',
    trendsRiskNoSignals: 'Nenhum sinal adverso nos dados observados.',
    trendsSignalBehindReference: 'Abaixo da referência de tempo em {{value}} pts',
    trendsSignalLateLowCompletion: 'Sprint no fim com baixa conclusão ({{value}}%)',
    trendsSignalScopeGrowth: 'Crescimento de escopo de {{value}}% sobre a linha de base',
    trendsSignalStagnation: '{{value}} item(ns) sem avanço entre observações',
    trendsSignalUnknownShare: 'Alta proporção de itens em estado desconhecido ({{value}}%)',
    trendsRiskInsufficientReason: 'Poucas observações confiáveis ou itens desconhecidos demais para avaliar o risco.',
    trendsRiskDisclaimer: 'Heurística sobre dados observados. Não é previsão estatística; a sprint não terminará nem atrasará com certeza.',
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


// Extension-owned panel and card styles are declared in src/ui/board.css.



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
const BoardIdentity = (typeof WIPBoardIdentity !== 'undefined' && WIPBoardIdentity) || null;

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
// Daily History (roadmap T1.7): the pure aggregation view-model that
// reconstructs and summarizes past dailies from persisted records only. Optional,
// so a missing module degrades to "history section unavailable", never a crash.
const DailyHistory =
  (typeof WIPBoardDailyHistory !== 'undefined' && WIPBoardDailyHistory) || null;
const DailySession =
  (typeof WIPBoardDailySession !== 'undefined' && WIPBoardDailySession) || null;
// Sprint Intelligence (roadmap T2.2): pure modules for sprint identity, scope
// baseline, goal persistence and the composed view-model. Optional, so a missing
// module degrades to "sprint section unavailable", never a crash. The read-only
// API client stays OFF/unwired per T2.1 + goal section 8 (live access unproven),
// so this runtime resolves the current scope from the DOM reader and accepts a
// MANUAL sprint; it never presents simulated data as real.
const SprintScope =
  (typeof WIPBoardSprintScope !== 'undefined' && WIPBoardSprintScope) || null;
const SprintBaseline =
  (typeof WIPBoardSprintBaseline !== 'undefined' && WIPBoardSprintBaseline) || null;
const SprintGoalStore =
  (typeof WIPBoardSprintGoalStore !== 'undefined' && WIPBoardSprintGoalStore) || null;
const SprintIntelligence =
  (typeof WIPBoardSprintIntelligence !== 'undefined' && WIPBoardSprintIntelligence) || null;
const SprintProgress =
  (typeof WIPBoardSprintProgress !== 'undefined' && WIPBoardSprintProgress) || null;
const SprintObservationStore =
  (typeof WIPBoardSprintObservationStore !== 'undefined' && WIPBoardSprintObservationStore) || null;
const SprintTrends =
  (typeof WIPBoardSprintTrends !== 'undefined' && WIPBoardSprintTrends) || null;

// A single sprint-goal store instance per page, created lazily so a missing
// module degrades to "panel unavailable" instead of throwing at load.
let sprintGoalStoreInstance = null;
function getSprintGoalStore() {
  if (sprintGoalStoreInstance) return sprintGoalStoreInstance;
  if (!SprintGoalStore || typeof SprintGoalStore.createStore !== 'function') return null;
  try {
    sprintGoalStoreInstance = SprintGoalStore.createStore();
  } catch (err) {
    console.debug('[WIP-Board] Sprint goal store unavailable.', err);
    sprintGoalStoreInstance = null;
  }
  return sprintGoalStoreInstance;
}

// Local-only manual sprint + last resolved sprint id, kept in memory for the
// panel session. The manual sprint is persisted via chrome.storage.local too so
// it survives a reload; see loadManualSprint/saveManualSprint below.
const sprintState = {
  view: null, // the last WIPBoardSprintIntelligence.buildViewModel result
  sprintId: null,
  manualSprint: null,
  progress: null, // the last WIPBoardSprintProgress.computeProgress result (T2.3)
  trends: null, // the last WIPBoardSprintTrends.computeTrends result (T2.4)
  baselineRecord: null, // the stored baseline record (for the observation ref)
  trendsView: 'trends', // active Sprint Trends view: progress | scope | trends
};

// A single sprint-observation store instance per page, created lazily so a
// missing module degrades to "panel unavailable" instead of throwing at load.
let sprintObservationStoreInstance = null;
function getSprintObservationStore() {
  if (sprintObservationStoreInstance) return sprintObservationStoreInstance;
  if (!SprintObservationStore || typeof SprintObservationStore.createStore !== 'function') return null;
  try {
    sprintObservationStoreInstance = SprintObservationStore.createStore();
  } catch (err) {
    console.debug('[WIP-Board] Sprint observation store unavailable.', err);
    sprintObservationStoreInstance = null;
  }
  return sprintObservationStoreInstance;
}

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
  // One scope per ACTUAL board route, regardless of the user's WIP keyword.
  // This isolates both roadmap boards and maintenance even within one project.
  // Legacy keyword-scoped snapshots are not migrated automatically because
  // their originating board cannot be proven after the fact.
  if (!BoardIdentity || typeof BoardIdentity.resolveBoardScope !== 'function') {
    return null;
  }
  return BoardIdentity.resolveBoardScope(window.location.href);
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
    HEADER_COUNT_MISMATCH: 'reasonHeaderCountMismatch',
    COLUMN_ALIGNMENT_UNKNOWN: 'reasonColumnAlignmentUnknown',
    HEADER_COUNT_UNAVAILABLE: 'reasonHeaderCountUnavailable',
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

function renderSnapshotColumns(columns, i18n, scope) {
  if (!Array.isArray(columns) || columns.length === 0) return '';
  const title = scope && scope.board
    ? `<div class="wip-snap-note">${escapeText(i18n.t('snapshotBoardId', { board: scope.board }))}</div>`
    : '';
  return title + columns.map(col => {
    const name = escapeText(String(col.name == null ? '' : col.name));
    const observed = typeof col.count === 'number' ? col.count : 0;
    const reported = typeof col.reportedCount === 'number' ? col.reportedCount : null;
    const mismatch = reported != null && reported !== observed;
    const observedText = escapeText(i18n.t('snapshotObservedCount', { count: observed }));
    const headerText = escapeText(reported == null
      ? i18n.t('snapshotHeaderCountUnknown')
      : i18n.t('snapshotHeaderCount', { count: reported }));
    return `<div class="wip-snap-row"><span>${name}</span>` +
      `<span class="wip-snap-counts${mismatch ? ' mismatch' : ''}">${observedText} / ${headerText}</span></div>`;
  }).join('');
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
      'warn'
    );
  }

  setSnapshotOutput(renderSnapshotColumns(capture.columns, i18n, scope));
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
  setSnapshotOutput(badge + renderSnapshotColumns(latest.columns, i18n, scope));
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
  if (!store || !DailyCommitment || !CommitmentPicker || !SnapshotCapture || !DailySession) {
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
    existing = DailySession && base ? DailySession.matchingCommitment(commitments, base) : null;
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
  if (!store || !DailyCommitment || !CommitmentPicker || !DailySession) {
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
    // The plan must use the exact baseline shown when the picker was opened.
    // Captures made in another tab after opening the picker cannot change it.
    base = commitmentPickerState.base
      ? await store.getSnapshotById(scope, commitmentPickerState.base.id)
      : null;
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
    // Edit only an existing commitment from THIS planning snapshot. A new
    // snapshot represents a new daily and must create a distinct commitment,
    // otherwise old plans are overwritten and Daily History cannot work.
    const commitments = await store.getCommitments(scope);
    const existing = DailySession ? DailySession.matchingCommitment(commitments, base) : null;
    let saved;
    if (existing) {
      saved = await store.reviseCommitment(scope, existing.id, built.items);
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
  if (!store || !ProjectedBoard || !DailyCommitment || !DailySession) {
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
    const snapshots = await store.getSnapshots(scope);
    const commitments = await store.getCommitments(scope);
    const session = DailySession ? DailySession.activeSession(commitments, snapshots) : null;
    // A saved plan must ALWAYS use its own immutable baseline.
    // Without a plan, the newest snapshot can be displayed alone.
    commitmentRecord = session ? session.commitment : null;
    base = session ? session.base : (snapshots.length ? snapshots[0] : null);
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
  revision: null, // historical evaluation may pin an earlier plan revision
  isHistorical: false,
  filter: 'all',
};

const DailyComparison =
  (typeof WIPBoardDailyComparison !== 'undefined' && WIPBoardDailyComparison) || null;

async function handleRunComparison(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !DailyComparison || !DailyCommitment || !DailySession) {
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
    const commitments = await store.getCommitments(scope);
    const session = DailySession ? DailySession.activeSession(commitments, snapshots) : null;
    initial = session ? session.base : null;
    commitmentRecord = session ? session.commitment : null;
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
  comparisonState.revision = null; // latest plan by default; history pins a revision explicitly
  comparisonState.isHistorical = false;
  comparisonState.laterSnapshots = laterSnapshots;
  // Keep a previously chosen later snapshot if still valid, else default to the
  // newest valid one. Never auto-select an incompatible/other-board snapshot.
  const stillValid = laterSnapshots.some(s => s.id === comparisonState.selectedLaterId);
  comparisonState.selectedLaterId = stillValid
    ? comparisonState.selectedLaterId
    : (laterSnapshots.length ? laterSnapshots[0].id : null);

  recomputeComparison(i18n);
  // This is an explicit evaluation action: archive which observed snapshot and
  // which plan revision were used. Historical views never overwrite this pin.
  await persistCurrentEvaluation(i18n);
}

// Explicitly persist the evaluation identity; it is NOT stored on filter/render.
async function persistCurrentEvaluation(i18n) {
  if (comparisonState.isHistorical || !comparisonState.commitment ||
      !comparisonState.selectedLaterId) return;
  const store = getSnapshotStore();
  if (!store) return;
  try {
    await store.recordCommitmentEvaluation(
      comparisonState.commitment.scope,
      comparisonState.commitment.id,
      {
        laterSnapshotId: comparisonState.selectedLaterId,
        revision: comparisonState.commitment.revision,
      }
    );
  } catch (err) {
    setComparisonStatus(i18n.t('comparisonError', { message: errText(err) }), 'err');
  }
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
    revision: comparisonState.revision,
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
      void persistCurrentEvaluation(i18n);
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

// --- Daily History (roadmap T1.7) ------------------------------------------
// A read-only historical view of the dailies recorded for the current board.
// Every number comes from the pure WIPBoardDailyHistory aggregation layer, which
// reuses the T1.6 comparison view-model (and the T1.3 engine) and reconstructs
// records from PERSISTED snapshots + commitments only. The live board is never
// read to fill a historical gap. All DOM writes go through
// withObserverPaused()/setIndicatorHtml so the R1 MutationObserver fix holds.
//
// In-memory state holds the full view-model and the chosen date range so a
// language switch or a filter change re-renders from memory without recomputing
// or re-reading the board.
const historyState = {
  view: null, // the last WIPBoardDailyHistory.buildHistoryView result
  snapshots: [],
  commitments: [],
  range: { from: null, to: null },
};

async function handleLoadHistory(context, i18n) {
  const store = getSnapshotStore();
  if (!store || !DailyHistory || !DailyComparison) {
    setHistoryStatus(i18n.t('historyError', { message: 'module unavailable' }), 'err');
    return;
  }

  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setHistoryStatus(i18n.t('historyError', { message: errText(err) }), 'err');
    return;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setHistoryStatus(i18n.t('snapshotScopeMissing'), 'err');
    return;
  }

  setHistoryStatus(i18n.t('historyLoading'), null);

  // Read ALL persisted snapshots and commitments for the SAME board scope. The
  // store already isolates by org/project/team/board, so other boards never leak.
  let snapshots;
  let commitments;
  try {
    snapshots = await store.getSnapshots(scope);
    commitments = await store.getCommitments(scope);
  } catch (err) {
    setHistoryStatus(i18n.t('historyError', { message: errText(err) }), 'err');
    return;
  }

  historyState.snapshots = snapshots || [];
  historyState.commitments = commitments || [];
  recomputeHistory(i18n);
}

// Build the view-model from the loaded records + the current range. Pure; no
// board read. Re-run whenever the range changes.
function recomputeHistory(i18n) {
  if (!DailyHistory) return;
  historyState.view = DailyHistory.buildHistoryView(
    { snapshots: historyState.snapshots, commitments: historyState.commitments },
    { range: historyState.range }
  );
  setHistoryStatus('', null);
  renderHistory(i18n);
}

function handleApplyHistoryRange(i18n) {
  const from = document.getElementById('wip-history-from');
  const to = document.getElementById('wip-history-to');
  historyState.range = {
    from: from && from.value ? from.value : null,
    to: to && to.value ? to.value : null,
  };
  if (historyState.view) recomputeHistory(i18n);
}

function handleClearHistoryRange(i18n) {
  historyState.range = { from: null, to: null };
  const from = document.getElementById('wip-history-from');
  const to = document.getElementById('wip-history-to');
  if (from) from.value = '';
  if (to) to.value = '';
  if (historyState.view) recomputeHistory(i18n);
}

// Map a history-level reliability reason code to a localized label.
function historyReasonText(code, i18n) {
  const map = {
    NO_BASE_SNAPSHOT: 'historyReasonNoBase',
    NO_LATER_SNAPSHOT: 'historyReasonNoLater',
    INCOMPLETE_SNAPSHOT: 'historyReasonIncomplete',
    UNRELIABLE_COLUMN_ORDER: 'historyReasonOrder',
    NO_COMMITMENT: 'historyReasonNoCommitment',
    COMPARISON_FAILED: 'historyReasonFailed',
  };
  return map[code] ? i18n.t(map[code]) : code;
}

function renderHistory(i18n) {
  const output = document.getElementById('wip-history-output');
  if (!output) return;
  const view = historyState.view;
  if (!view) {
    setHistoryOutput('');
    return;
  }

  // Empty states: distinguish "no dailies at all" from "none in this period".
  if (!view.records.length) {
    const key = view.totalRecords > 0 ? 'historyEmptyRange' : 'historyEmpty';
    setHistoryOutput(`<div class="wip-history-empty">${escapeText(i18n.t(key))}</div>`);
    return;
  }

  const s = view.summary;

  // Historical summary + overall weighted rate (suppressed when unreliable) +
  // the separate count of records without a reliable evaluation.
  const summary =
    `<div class="wip-comparison-summary">` +
    escapeText(
      i18n.t('historySummary', {
        dailies: s.dailies,
        committed: s.committed,
        fulfilled: s.fulfilled,
        undetermined: s.undetermined,
      })
    ) +
    `</div>`;

  let rate;
  if (s.rateReliable && s.overallRate != null) {
    const pct = Math.max(0, Math.min(100, s.overallRate));
    rate =
      `<div class="wip-comparison-rate">` +
      escapeText(i18n.t('historyOverallRate', { rate: s.overallRate })) +
      `<span class="wip-rate-bar"><span class="wip-rate-fill" style="width:${pct}%"></span></span>` +
      `</div>`;
  } else {
    rate =
      `<div class="wip-comparison-rate unavailable">` +
      escapeText(i18n.t('historyOverallRateUnavailable')) +
      `</div>`;
  }

  const unreliable =
    `<div class="wip-comparison-undetermined">` +
    escapeText(i18n.t('historyUnreliableCount', { count: s.unreliableDailies })) +
    `</div>`;

  // Simple evolution chart (no chart library): a labeled bar per day.
  const evolution = renderHistoryEvolution(s.evolution, i18n);

  // One card per daily record, newest first.
  const cards = view.records.map(rec => renderHistoryRecord(rec, i18n)).join('');

  setHistoryOutput(
    summary +
      rate +
      unreliable +
      evolution +
      `<div class="wip-history-records">${cards}</div>`
  );

  bindHistoryRecordButtons(i18n);
}

function renderHistoryEvolution(evolution, i18n) {
  const points = Array.isArray(evolution) ? evolution : [];
  if (!points.length) return '';
  const bars = points
    .map(p => {
      const reliable = p.reliable && p.rate != null;
      const pct = reliable ? Math.max(0, Math.min(100, p.rate)) : 0;
      const label = reliable
        ? i18n.t('historyEvolutionPoint', { date: p.date, rate: p.rate, committed: p.committed })
        : i18n.t('historyEvolutionPointUnavailable', { date: p.date, committed: p.committed });
      return (
        `<div class="wip-history-evo-row" title="${escapeAttr(label)}">` +
        `<span class="wip-history-evo-date">${escapeText(p.date)}</span>` +
        `<span class="wip-history-evo-track"><span class="wip-history-evo-fill${reliable ? '' : ' unavailable'}" style="width:${pct}%"></span></span>` +
        `<span class="wip-history-evo-val">${escapeText(reliable ? p.rate + '%' : 'n/a')}</span>` +
        `</div>`
      );
    })
    .join('');
  return (
    `<div class="wip-history-evolution">` +
    `<div class="wip-history-evo-title">${escapeText(i18n.t('historyEvolutionTitle'))}</div>` +
    bars +
    `</div>`
  );
}

function renderHistoryRecord(rec, i18n) {
  const m = rec.metrics || {};
  const dateLine = rec.dailyDate
    ? i18n.t('historyRecordDate', { date: rec.dailyDate })
    : i18n.t('historyRecordNoDate');

  const planning = rec.planningAt
    ? `<div class="wip-comparison-meta">${escapeText(i18n.t('historyRecordPlanning', { when: formatSnapshotWhen(rec.planningAt) }))}</div>`
    : '';
  const evaluation = rec.evaluationAt
    ? `<div class="wip-comparison-meta">${escapeText(i18n.t('historyRecordEvaluation', { when: formatSnapshotWhen(rec.evaluationAt) }))}</div>`
    : `<div class="wip-comparison-meta">${escapeText(i18n.t('historyRecordNoEvaluation'))}</div>`;

  const commitmentLine = `<div class="wip-comparison-meta">${escapeText(
    i18n.t('historyRecordCommitment', { id: rec.commitmentId == null ? '—' : rec.commitmentId, revision: rec.revision == null ? '—' : rec.revision })
  )}</div>`;

  let revisionInEffect = '';
  if (rec.revisionInEffect != null) {
    revisionInEffect = `<div class="wip-comparison-meta">${escapeText(i18n.t('historyRecordRevisionInEffect', { revision: rec.revisionInEffect }))}</div>`;
  }

  let inferredNote = '';
  if (rec.evaluationSource === 'inferred' && rec.later) {
    inferredNote = `<div class="wip-comparison-archived">${escapeText(i18n.t('historyRecordInferredEvaluation'))}</div>`;
  }

  const metricsLine = `<div class="wip-comparison-summary">${escapeText(
    i18n.t('historyRecordMetrics', {
      committed: m.committed || 0,
      reached: m.reached || 0,
      beyond: m.beyond || 0,
      behind: m.behind || 0,
      offTrack: m.offTrack || 0,
      missing: m.missing || 0,
    })
  )}</div>`;

  let rateLine;
  if (m.rateReliable && m.fulfillmentRate != null) {
    rateLine = `<span class="wip-history-rate">${escapeText(i18n.t('historyRecordRate', { rate: m.fulfillmentRate }))}</span>`;
  } else {
    rateLine = `<span class="wip-history-rate unavailable">${escapeText(i18n.t('historyRecordRateUnavailable'))}</span>`;
  }

  let reliabilityLine = '';
  if (rec.reliability && !rec.reliability.reliable) {
    const reasons = (rec.reliability.reasons || []).map(c => historyReasonText(c, i18n)).join(', ');
    reliabilityLine = `<div class="wip-comparison-reliability">${escapeText(i18n.t('historyRecordUnreliable', { reasons: reasons }))}</div>`;
  }

  // "Open comparison" navigates to the existing comparison view for this exact
  // record (same commitment + later snapshot identity), reusing T1.6. Disabled
  // when there is no base snapshot (nothing to open honestly).
  const openBtn = rec.initial
    ? `<button type="button" class="wip-comparison-filter wip-history-open" ` +
      `data-commitment="${escapeAttr(String(rec.commitmentId == null ? '' : rec.commitmentId))}" ` +
      `data-later="${escapeAttr(String(rec.later && rec.later.id != null ? rec.later.id : ''))}">` +
      `${escapeText(i18n.t('historyRecordOpen'))}</button>`
    : '';

  return (
    `<div class="wip-history-card">` +
    `<div class="wip-history-card-head">` +
    `<span class="wip-history-card-date">${escapeText(dateLine)}</span>` +
    rateLine +
    `</div>` +
    commitmentLine +
    revisionInEffect +
    planning +
    evaluation +
    inferredNote +
    metricsLine +
    reliabilityLine +
    (openBtn ? `<div class="wip-snap-actions">${openBtn}</div>` : '') +
    `</div>`
  );
}

// Bind the per-record "Open comparison" buttons. Clicking loads the SAME record
// into the existing comparison view (T1.6) and switches to it, preserving the
// selected snapshot/commitment identity. No recompute of history and no board
// read beyond what the comparison already does.
function bindHistoryRecordButtons(i18n) {
  const output = document.getElementById('wip-history-output');
  if (!output) return;
  output.querySelectorAll('.wip-history-open').forEach(btn => {
    btn.onclick = () => openHistoryRecordInComparison(btn, i18n);
  });
}

function openHistoryRecordInComparison(btn, i18n) {
  const commitmentId = btn.getAttribute('data-commitment');
  const laterId = btn.getAttribute('data-later');
  const view = historyState.view;
  if (!view) return;
  const rec = view.records.find(r => String(r.commitmentId) === String(commitmentId));
  if (!rec) return;

  const initial = historyState.snapshots.find(s => rec.initial && String(s.id) === String(rec.initial.id)) || null;
  const commitment = historyState.commitments.find(c => String(c.id) === String(commitmentId)) || null;
  if (!initial || !commitment) return;

  // Seed the comparison in-memory state with this historic record's identity so
  // the existing comparison view renders exactly this daily. Reuses T1.6; no new
  // comparison algorithm is introduced here.
  comparisonState.initial = initial;
  comparisonState.commitment = commitment;
  comparisonState.revision = rec.revisionInEffect != null ? rec.revisionInEffect : null;
  comparisonState.isHistorical = true;
  comparisonState.laterSnapshots = DailyComparison.selectComparableSnapshots(historyState.snapshots, initial);
  // Do not substitute an unrelated later snapshot for an unevaluated daily.
  comparisonState.selectedLaterId =
    laterId && comparisonState.laterSnapshots.some(s => String(s.id) === String(laterId))
      ? laterId : null;
  comparisonState.filter = 'all';
  recomputeComparison(i18n);

  if (typeof setDailyView === 'function') setDailyView('comparison', i18n);
}

function setHistoryStatus(message, kind) {
  const status = document.getElementById('wip-history-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function setHistoryOutput(html) {
  const output = document.getElementById('wip-history-output');
  if (!output) return;
  // Diff-before-write mirrors the indicator/snapshot guard (R1 fix discipline).
  setIndicatorHtml(output, html || '');
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

// ============================================================================
// SPRINT INTELLIGENCE (roadmap T2.2)
// ----------------------------------------------------------------------------
// The UI here only RENDERS what the pure WIPBoardSprintIntelligence view-model
// produced. The read-only API client is intentionally NOT wired into this
// runtime yet (T2.1 + goal section 8: live access unproven), so the current
// scope comes from the DOM reader and the sprint identity comes from a MANUAL
// configuration persisted locally. When no sprint is identified, an explicit
// "unavailable" state is shown and NOTHING is presented as live/real data.
// Every DOM write goes through setIndicatorHtml() (the R1 diff-guard); the whole
// panel is mounted inside the existing withObserverPaused() phase.
// ============================================================================

function setSprintStatus(message, kind) {
  const status = document.getElementById('wip-sprint-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function setSprintOutput(html) {
  const output = document.getElementById('wip-sprint-output');
  if (!output) return;
  setIndicatorHtml(output, html || '');
}

// Manual sprint persistence: a single scoped key in chrome.storage.local so the
// user's explicit manual configuration survives a reload. No credential, no PII.
function manualSprintKey(scope) {
  return 'wipx:manual-sprint:' + [scope.organization, scope.project, scope.team, scope.board]
    .map(p => String(p == null ? '' : p).toLowerCase().replace(/::/g, ':_:'))
    .join('::');
}

function loadManualSprint(scope) {
  return new Promise(resolve => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve(null);
        return;
      }
      const key = manualSprintKey(scope);
      chrome.storage.local.get(key, items => {
        resolve((items && items[key]) || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function saveManualSprintRecord(scope, record) {
  return new Promise((resolve, reject) => {
    try {
      const key = manualSprintKey(scope);
      const obj = {};
      obj[key] = record;
      chrome.storage.local.set(obj, () => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(record);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Resolve the scope + the current DOM scope items once, shared by every sprint
// handler. Returns { scope, items } or null (after reporting the reason).
function resolveSprintContext(context, i18n) {
  let boardModel;
  try {
    boardModel = readBoardModel();
  } catch (err) {
    setSprintStatus(i18n.t('sprintError', { message: errText(err) }), 'err');
    return null;
  }
  const scope = resolveSnapshotScope(boardModel, context);
  if (!scope) {
    setSprintStatus(i18n.t('sprintScopeMissing'), 'err');
    return null;
  }
  // Map the reader model items to the scope-item shape (id/type/state/column).
  const items = (boardModel.items || []).map(it => ({
    id: it.id,
    type: it.type,
    state: it.state,
    column: it.column,
    parentId: it.parentId,
  }));
  return { scope: scope, items: items, boardModel: boardModel };
}

async function handleLoadSprint(context, i18n) {
  if (!SprintScope || !SprintBaseline || !SprintIntelligence || !SprintGoalStore) {
    setSprintStatus(i18n.t('sprintError', { message: 'module unavailable' }), 'err');
    return;
  }
  setSprintStatus(i18n.t('sprintLoading'), null);

  const ctx = resolveSprintContext(context, i18n);
  if (!ctx) return;

  // Board DOM may be filtered/partially loaded. Only an explicitly complete
  // capture can prove that planned items absent from the DOM were removed.
  let currentComplete = false;
  if (SnapshotCapture && typeof SnapshotCapture.buildCapture === 'function') {
    try {
      currentComplete = SnapshotCapture.buildCapture(ctx.boardModel, ctx.scope, {
        source: { origin: 'dom-reader' },
      }).complete === true;
    } catch (_) {
      currentComplete = false;
    }
  }

  const manualSprint = await loadManualSprint(ctx.scope);
  sprintState.manualSprint = manualSprint;

  // The read-only API is not wired into this runtime (T2.1/goal section 8), so
  // the availability inputs reflect that honestly: the flag is read from config,
  // but no apiIteration is ever fabricated here.
  const apiEnabled = context.azureApiEnabled === true;

  const availability = SprintIntelligence.resolveAvailability({
    featureFlagEnabled: apiEnabled,
    authAvailable: false, // no auth provider is wired in this runtime yet
    apiIteration: null,
    manualSprint: manualSprint,
  });

  const sprintId = availability.sprint && availability.sprint.id != null
    ? availability.sprint.id
    : null;
  sprintState.sprintId = sprintId;

  // Load the stored goal + baseline only when a sprint is identified (they are
  // keyed by sprint id). Absent sprint => no goal/baseline lookup.
  let goalRecord = null;
  let baselineRecord = null;
  if (sprintId != null) {
    const store = getSprintGoalStore();
    if (store) {
      try {
        goalRecord = await store.getGoal(ctx.scope, sprintId);
        baselineRecord = await store.getBaseline(ctx.scope, sprintId);
      } catch (err) {
        setSprintStatus(i18n.t('sprintError', { message: errText(err) }), 'err');
        return;
      }
    }
  }

  sprintState.view = SprintIntelligence.buildViewModel({
    availability: availability,
    currentItems: ctx.items,
    currentComplete: currentComplete,
    goalRecord: goalRecord,
    baselineRecord: baselineRecord,
    flowConfig: resolveSprintFlowConfig(context),
    now: new Date(),
  });
  sprintState.scope = ctx.scope;

  // Sprint Progress (T2.3): compute the baseline-vs-current progress whenever a
  // baseline is present. The engine is pure and reuses the T2.2 scope/baseline
  // modules; with no baseline it returns an honest "unavailable" result. The API
  // stays unwired (T2.1/goal section 8), so the current scope comes from the DOM.
  if (SprintProgress && baselineRecord) {
    sprintState.progress = SprintProgress.computeProgress({
      baseline: baselineRecord,
      currentItems: ctx.items,
      currentComplete: currentComplete,
      flowConfig: resolveSprintFlowConfig(context),
      sprintStart: sprintState.view.sprint ? sprintState.view.sprint.startDate : null,
    });
  } else {
    sprintState.progress = null;
  }

  // Keep the stored baseline record so an observation can reference the exact
  // baseline it was measured against (T2.4). The baseline itself is never
  // altered here.
  sprintState.baselineRecord = baselineRecord;

  // Sprint Trends (T2.4): load the persisted observation history for this sprint
  // and compute the temporal analysis. The engine is pure and reuses the T2.3
  // progress engine per observation; it never reconstructs history from the DOM.
  // With no baseline or no history it returns an honest, limitation-flagged
  // result. The read-only API stays unwired (T2.1/goal section 12).
  sprintState.trends = null;
  if (SprintTrends && baselineRecord && sprintId != null) {
    const obsStore = getSprintObservationStore();
    if (obsStore) {
      try {
        const history = await obsStore.getObservations(ctx.scope, sprintId);
        sprintState.trends = SprintTrends.computeTrends({
          sprint: sprintState.view.sprint || { id: sprintId },
          baseline: baselineRecord,
          history: history,
          flowConfig: resolveSprintFlowConfig(context),
          now: new Date(),
        });
      } catch (err) {
        console.debug('[WIP-Board] Sprint trends unavailable.', err);
        sprintState.trends = null;
      }
    }
  }

  setSprintStatus('', null);
  renderSprint(i18n);
  renderSprintProgress(i18n);
  renderSprintTrends(i18n);
  prefillSprintForms(i18n);
}

// Record a sprint-state observation (T2.4). This is an EXPLICIT user action that
// reuses the existing DOM-scope resolution and the observation store; it never
// runs on a background schedule and never mutates the baseline. A baseline must
// already exist so the observation can reference it.
async function handleRecordObservation(context, i18n) {
  const obsStore = getSprintObservationStore();
  if (!obsStore || !SprintScope) {
    setSprintTrendsStatus(i18n.t('sprintError', { message: 'module unavailable' }), 'err');
    return;
  }
  const ctx = resolveSprintContext(context, i18n);
  if (!ctx) return;
  if (!sprintState.sprintId || !sprintState.baselineRecord) {
    setSprintTrendsStatus(i18n.t('trendsObservationNeedsSprint'), 'err');
    return;
  }

  // Reuse the existing SnapshotCapture mechanism to get the honest completeness
  // verdict + reasons from the current board read (goal section 2: reuse the
  // existing capture mechanisms). Fall back to a plain read when the capture
  // module is absent.
  let complete = false;
  let incompleteReasons = [];
  let items = ctx.items;
  if (SnapshotCapture && typeof SnapshotCapture.buildCapture === 'function') {
    let boardModel;
    try {
      boardModel = readBoardModel();
    } catch (err) {
      setSprintTrendsStatus(i18n.t('sprintError', { message: errText(err) }), 'err');
      return;
    }
    try {
      const capture = SnapshotCapture.buildCapture(boardModel, ctx.scope, { source: { origin: 'dom-reader' } });
      complete = capture.complete === true;
      incompleteReasons = Array.isArray(capture.incompleteReasons) ? capture.incompleteReasons : [];
      items = Array.isArray(capture.items) && capture.items.length ? capture.items : ctx.items;
    } catch (err) {
      // A capture failure must not fabricate completeness; record as incomplete.
      complete = false;
    }
  }
  const baselineRecord = sprintState.baselineRecord;

  try {
    const observation = await obsStore.appendObservation({
      scope: ctx.scope,
      sprintId: sprintState.sprintId,
      items: items,
      complete: complete,
      reliability: complete ? 'sufficient' : 'partial',
      incompleteReasons: incompleteReasons,
      source: { origin: 'dom-reader' },
      baselineRef: {
        sprintId: sprintState.sprintId,
        revision: typeof baselineRecord.revision === 'number' ? baselineRecord.revision : 0,
        capturedAt: baselineRecord.baseline && baselineRecord.baseline.capturedAt
          ? baselineRecord.baseline.capturedAt
          : (baselineRecord.savedAt || null),
      },
    });
    setSprintTrendsStatus(i18n.t('trendsObservationSaved', { count: observation.itemCount }), 'ok');
    // Reload so the trend series reflects the newly recorded observation.
    await handleLoadSprint(context, i18n);
  } catch (err) {
    setSprintTrendsStatus(i18n.t('sprintError', { message: errText(err) }), 'err');
  }
}

function setSprintTrendsStatus(message, kind) {
  const el = document.getElementById('wip-sprint-trends-status');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

// Switch the Sprint Trends view (progress | scope | trends) and re-render from
// the in-memory result, so a toggle never re-reads the board (R1-safe).
function setSprintTrendsView(view, i18n) {
  sprintState.trendsView = view;
  renderSprintTrends(i18n);
}

// Flow configuration (goal section 4): the team's main flow is Approved -> ... ->
// Closed, but the boundaries are configurable per board. We read optional
// start/end column overrides from the board context when present; otherwise the
// baseline engine's defaults (Approved/Closed) apply.
function resolveSprintFlowConfig(context) {
  const cfg = {};
  if (context && typeof context.sprintStartColumn === 'string' && context.sprintStartColumn.trim()) {
    cfg.startColumn = context.sprintStartColumn.trim();
  }
  if (context && typeof context.sprintEndColumn === 'string' && context.sprintEndColumn.trim()) {
    cfg.endColumn = context.sprintEndColumn.trim();
  }
  return cfg;
}

async function handleRecordBaseline(context, i18n) {
  const store = getSprintGoalStore();
  if (!store || !SprintBaseline || !SprintScope) {
    setSprintStatus(i18n.t('sprintError', { message: 'module unavailable' }), 'err');
    return;
  }
  const ctx = resolveSprintContext(context, i18n);
  if (!ctx) return;

  const view = sprintState.view;
  if (!view || !sprintState.sprintId) {
    setSprintStatus(i18n.t('sprintBaselineNeedsSprint'), 'err');
    return;
  }

  const sprint = view.sprint || { id: sprintState.sprintId };
  // A filtered/partial DOM cannot establish the original planning scope.
  // Refuse baseline creation rather than preserving a misleading denominator.
  let captureComplete = false;
  try {
    captureComplete = !!(SnapshotCapture && SnapshotCapture.buildCapture(
      ctx.boardModel, ctx.scope, { source: { origin: 'dom-reader' } }
    ).complete === true);
  } catch (_) {}
  if (!captureComplete) {
    setSprintStatus(i18n.t('sprintIncompleteScope'), 'err');
    return;
  }
  const scopeItems = SprintScope.buildScopeItems(ctx.items);
  const baseline = SprintBaseline.createBaseline(sprint, scopeItems, resolveSprintFlowConfig(context), {
    capturedAt: new Date(),
    source: view.availability === 'manual' ? 'manual' : 'dom',
  });

  try {
    // An existing baseline must never be overwritten by another capture.
    await store.saveBaseline(ctx.scope, sprintState.sprintId, baseline);
  } catch (err) {
    setSprintStatus(
      err && err.code === 'DUPLICATE'
        ? i18n.t('sprintBaselineAlreadyExists')
        : i18n.t('sprintError', { message: errText(err) }),
      'err'
    );
    return;
  }
  setSprintStatus(i18n.t('sprintBaselineSaved', { count: baseline.plannedIds.length }), 'ok');
  // Reload so the view reflects the recorded baseline and scope-change signals.
  await handleLoadSprint(context, i18n);
}

async function handleSaveSprintGoal(context, i18n) {
  const store = getSprintGoalStore();
  if (!store) {
    setSprintGoalStatus(i18n.t('sprintError', { message: 'module unavailable' }), 'err');
    return;
  }
  if (!sprintState.sprintId || !sprintState.scope) {
    setSprintGoalStatus(i18n.t('sprintGoalNeedsSprint'), 'err');
    return;
  }
  const goal = {
    objective: valueById('wip-sprint-goal-objective'),
    description: valueById('wip-sprint-goal-description'),
    successCriteria: valueById('wip-sprint-goal-criteria'),
    priorities: valueById('wip-sprint-goal-priorities'),
  };
  try {
    const rec = await store.saveGoal(sprintState.scope, sprintState.sprintId, goal);
    setSprintGoalStatus(i18n.t('sprintGoalSaved', { revision: rec.revision }), 'ok');
    await handleLoadSprint(context, i18n);
  } catch (err) {
    setSprintGoalStatus(i18n.t('sprintError', { message: errText(err) }), 'err');
  }
}

async function handleSaveManualSprint(context, i18n) {
  const ctx = resolveSprintContext(context, i18n);
  if (!ctx) return;
  const id = valueById('wip-sprint-manual-id');
  if (!id) {
    setSprintManualStatus(i18n.t('sprintManualNeedsId'), 'err');
    return;
  }
  const record = {
    id: id,
    name: id,
    startDate: valueById('wip-sprint-manual-start') || null,
    finishDate: valueById('wip-sprint-manual-finish') || null,
  };
  try {
    await saveManualSprintRecord(ctx.scope, record);
    setSprintManualStatus(i18n.t('sprintManualSaved'), 'ok');
    await handleLoadSprint(context, i18n);
  } catch (err) {
    setSprintManualStatus(i18n.t('sprintError', { message: errText(err) }), 'err');
  }
}

function setSprintGoalStatus(message, kind) {
  const el = document.getElementById('wip-sprint-goal-status');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function setSprintManualStatus(message, kind) {
  const el = document.getElementById('wip-sprint-manual-status');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'wip-snap-status' + (kind ? ' ' + kind : '');
}

function valueById(id) {
  const el = document.getElementById(id);
  return el && typeof el.value === 'string' ? el.value.trim() : '';
}

// Pre-fill the goal + manual sprint forms from the loaded view so the user edits
// the existing values rather than retyping. No board read; memory only.
function prefillSprintForms(i18n) {
  const view = sprintState.view;
  if (view && view.goal) {
    setInputValue('wip-sprint-goal-objective', view.goal.objective);
    setInputValue('wip-sprint-goal-description', view.goal.description);
    setInputValue('wip-sprint-goal-criteria', (view.goal.successCriteria || []).join('\n'));
    setInputValue('wip-sprint-goal-priorities', (view.goal.priorities || []).join('\n'));
  }
  const manual = sprintState.manualSprint;
  if (manual) {
    setInputValue('wip-sprint-manual-id', manual.name || manual.id || '');
    setInputValue('wip-sprint-manual-start', toDateInputValue(manual.startDate));
    setInputValue('wip-sprint-manual-finish', toDateInputValue(manual.finishDate));
  }
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el && typeof el.value === 'string') el.value = value == null ? '' : String(value);
}

function toDateInputValue(value) {
  if (!value) return '';
  const s = String(value);
  // A date input needs yyyy-mm-dd; accept an ISO instant or a plain day.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

// Render the Sprint Intelligence view model. Pure presentation of what the
// view-model produced; it never recomputes or re-reads the board.
function renderSprint(i18n) {
  const view = sprintState.view;
  if (!view) {
    setSprintOutput('');
    return;
  }

  // Availability banner: label unavailable states honestly; mark real data.
  const stateKey = {
    api: 'sprintStateApi',
    manual: 'sprintStateManual',
    disabled: 'sprintStateDisabled',
    unauthenticated: 'sprintStateUnauthenticated',
    unavailable: 'sprintStateUnavailable',
    'no-sprint': 'sprintStateNoSprint',
  }[view.availability] || 'sprintStateNone';

  let badgeKey = 'sprintUnavailableBadge';
  if (view.availability === 'api') badgeKey = 'sprintRealBadge';
  else if (view.availability === 'manual') badgeKey = 'sprintManualBadge';
  const badgeClass = view.dataReal ? 'wip-snap-badge complete' : 'wip-snap-badge incomplete';

  const banner =
    `<div class="wip-snap-row"><span>${escapeText(i18n.t(stateKey))}</span>` +
    `<span class="${badgeClass}">${escapeText(i18n.t(badgeKey))}</span></div>`;

  let identity = '';
  let period = '';
  let days = '';
  if (view.sprint && view.sprint.available) {
    const name = unavailableToText(view.sprint.name);
    const path = unavailableToText(view.sprint.iterationPath);
    identity =
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintIdLabel'))}</span>` +
      `<span>${escapeText(name || view.sprint.id)}</span></div>` +
      (path ? `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintPathLabel'))}</span><span>${escapeText(path)}</span></div>` : '');

    const start = unavailableToText(view.sprint.startDate);
    const finish = unavailableToText(view.sprint.finishDate);
    if (start && finish) {
      period =
        `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintPeriodLabel'))}</span>` +
        `<span>${escapeText(toDateInputValue(start))} → ${escapeText(toDateInputValue(finish))}</span></div>`;
    } else {
      period = `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintPeriodUnknown'))}</span></div>`;
    }

    const d = view.days;
    if (d && d.totalDays != null) {
      days =
        `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintDaysElapsed', { elapsed: d.elapsedDays, total: d.totalDays }))}</span></div>` +
        `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintDaysRemaining', { remaining: d.remainingDays }))}</span></div>`;
    } else {
      days = `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintDaysUnknown'))}</span></div>`;
    }
  }

  // Scope counts. Always show the current scope size; show baseline-derived
  // signals only when a baseline exists (otherwise invite recording one).
  let scope = `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintCurrentCount', { count: view.currentScopeCount }))}</span></div>`;
  if (view.hasBaseline && view.changes) {
    const c = view.changes.summary;
    scope +=
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintPlannedCount', { count: c.plannedBaselineCount }))}</span></div>` +
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintAddedCount', { count: c.addedCount }))}</span></div>` +
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintRemovedCount', { count: c.removedCount }))}</span></div>` +
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintCompletedCount', { count: c.completedCount }))}</span></div>` +
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintInProgressCount', { count: c.inProgressCount }))}</span></div>`;
  } else if (view.hasBaseline && view.currentScopeComplete === false) {
    scope += `<div class="wip-snap-note">${escapeText(i18n.t('sprintIncompleteScope'))}</div>`;
  } else if (view.sprint && view.sprint.available) {
    scope += `<div class="wip-snap-note">${escapeText(i18n.t('sprintNoBaseline'))}</div>`;
  }

  // Goal summary (read-only view; editing is in the form below).
  let goal = '';
  if (view.hasGoal && view.goal) {
    const g = view.goal;
    goal =
      `<div class="wip-snap-row"><span>${escapeText(i18n.t('sprintGoalObjective'))}</span><span>${escapeText(g.objective || '—')}</span></div>` +
      (g.revisionCount > 0
        ? `<div class="wip-snap-note">${escapeText(i18n.t('sprintGoalHistory', { count: g.revisionCount }))}</div>`
        : '');
  } else if (view.sprint && view.sprint.available) {
    goal = `<div class="wip-snap-note">${escapeText(i18n.t('sprintGoalEmpty'))}</div>`;
  }

  setSprintOutput(banner + identity + period + days + scope + goal);
}

// Render the Sprint Progress view (roadmap T2.3). Pure presentation of what the
// WIPBoardSprintProgress engine produced; it never recomputes or re-reads the
// board. The baseline completion is the PRIMARY metric and is visually
// highlighted; the current-scope progress is a clearly-labeled secondary block;
// unknown items and a late baseline are surfaced honestly (goal sections 2, 3,
// 7, 8). Every write goes through the setIndicatorHtml() R1 diff-guard.
function renderSprintProgress(i18n) {
  const output = document.getElementById('wip-sprint-progress-output');
  if (!output) return;
  const p = sprintState.progress;

  if (!p || !p.hasBaseline) {
    setIndicatorHtml(output, `<div class="wip-snap-note">${escapeText(i18n.t('progressNoBaseline'))}</div>`);
    return;
  }

  const b = p.baseline;
  const partial = p.reliability === 'partial';

  // Late-baseline banner first, so the figure is never mistaken for a true
  // start-of-sprint snapshot.
  const lateBanner = p.lateBaseline
    ? `<div class="wip-snap-row"><span class="wip-snap-badge incomplete">${escapeText(i18n.t('progressLateBaseline'))}</span></div>`
    : '';

  // PRIMARY metric: baseline completion with a simple progress bar. When
  // evidence is partial, label the figure as proven-only (goal section 8).
  const pct = b.completionPct == null ? 0 : b.completionPct;
  const pctLabel = partial
    ? i18n.t('progressBaselinePctPartial', { pct: pct, evaluable: b.evaluable, total: b.total })
    : i18n.t('progressBaselinePct', { pct: pct });
  const bar =
    `<div class="wip-progress-bar" role="img" aria-label="${escapeText(String(pct))}%">` +
    `<div class="wip-progress-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;

  const primary =
    `<div class="wip-progress-primary">` +
    `<div class="wip-snap-row"><strong>${escapeText(i18n.t('progressPrimaryTitle'))}</strong></div>` +
    `<div class="wip-snap-row"><span>${escapeText(pctLabel)}</span></div>` +
    bar +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressBaselineCounts', { completed: b.completed, planned: b.total }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressCompleted', { count: b.completed }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressInProgress', { count: b.inProgress }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressNotStarted', { count: b.notStarted }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressRemoved', { count: b.removed }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressUnknown', { count: b.unknown }))}</span></div>` +
    `</div>`;

  // SECONDARY metric: current scope, kept clearly separate (goal section 3).
  const c = p.current;
  const sc = p.scopeChange;
  const cpct = c.completionPct == null ? 0 : c.completionPct;
  const secondary =
    `<div class="wip-progress-secondary">` +
    `<div class="wip-snap-row"><strong>${escapeText(i18n.t('progressSecondaryTitle'))}</strong></div>` +
    (c.completionPct == null
      ? ''
      : `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressCurrentPct', { pct: cpct }))}</span></div>`) +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressCurrentCounts', { completed: c.completed, total: c.total }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressAdded', { count: sc.added }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressAddedCompleted', { count: sc.addedCompleted }))}</span></div>` +
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressScopeDelta', { delta: sc.delta == null ? '—' : (sc.delta > 0 ? '+' + sc.delta : String(sc.delta)) }))}</span></div>` +
    `</div>`;

  // Per-column distribution (goal section 7).
  let columns = `<div class="wip-snap-row"><strong>${escapeText(i18n.t('progressColumnsTitle'))}</strong></div>`;
  (p.columns.byColumn || []).forEach(function (row) {
    columns += `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressColumnRow', { column: row.column, count: row.count }))}</span></div>`;
  });
  if (p.columns.unknown > 0) {
    columns += `<div class="wip-snap-row"><span>${escapeText(i18n.t('progressColumnUnknown', { count: p.columns.unknown }))}</span></div>`;
  }

  // Reliability line (goal section 8).
  let reliabilityKey = 'progressReliabilitySufficient';
  let reliabilityArgs = {};
  if (p.reliability === 'partial') {
    reliabilityKey = 'progressReliabilityPartial';
    reliabilityArgs = { count: b.unknown };
  } else if (p.reliability === 'unavailable') {
    reliabilityKey = 'progressReliabilityUnavailable';
  }
  const reliabilityClass = p.reliability === 'sufficient' ? 'wip-snap-badge complete' : 'wip-snap-badge incomplete';
  const reliability =
    `<div class="wip-progress-reliability">` +
    `<div class="wip-snap-row"><strong>${escapeText(i18n.t('progressReliabilityTitle'))}</strong></div>` +
    `<div class="wip-snap-row"><span class="${reliabilityClass}">${escapeText(i18n.t(reliabilityKey, reliabilityArgs))}</span></div>` +
    `</div>`;

  setIndicatorHtml(output, lateBanner + primary + secondary + columns + reliability);
}

// Render the Sprint Trends & Risk view (roadmap T2.4). Pure presentation of what
// the WIPBoardSprintTrends engine produced; it never recomputes or re-reads the
// board. Three switchable views (progress / scope / trends) all read from the
// same in-memory result. Honest about limitations: no history, a single
// observation, incomplete captures, a late baseline or unreliable dates are all
// stated instead of guessed (goal sections 8, 9). Every write goes through the
// setIndicatorHtml() R1 diff-guard.
function renderSprintTrends(i18n) {
  const output = document.getElementById('wip-sprint-trends-output');
  if (!output) return;
  const t = sprintState.trends;

  // Reflect the active view on the toggle tabs.
  const view = sprintState.trendsView || 'trends';
  ['progress', 'scope', 'trends'].forEach(function (v) {
    const tab = document.getElementById('wip-sprint-trends-tab-' + v);
    if (tab) tab.classList.toggle('active', v === view);
  });

  if (!t || !t.hasBaseline) {
    setIndicatorHtml(output, `<div class="wip-snap-note">${escapeText(i18n.t('trendsNoBaseline'))}</div>`);
    return;
  }
  if (!t.hasHistory) {
    setIndicatorHtml(output, `<div class="wip-snap-note">${escapeText(i18n.t('trendsNoHistory'))}</div>`);
    return;
  }

  const header =
    `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsObservationCount', { count: t.observationCount }))}</span></div>` +
    (t.latest
      ? `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsLastObservation', { when: formatTrendWhen(t.latest.iso) }))}</span></div>`
      : '') +
    (t.observationCount === 1
      ? `<div class="wip-snap-note">${escapeText(i18n.t('trendsSingleObservation'))}</div>`
      : '');

  let body = '';
  if (view === 'scope') {
    body = renderTrendsScopeView(t, i18n);
  } else if (view === 'progress') {
    body = renderTrendsProgressView(t, i18n);
  } else {
    body = renderTrendsTrendsView(t, i18n);
  }

  setIndicatorHtml(output, header + body);
}

// Progress-vs-time view (goal sections 4 & 3): elapsed time, linear reference,
// observed completion and the deviation (as information, never proof of delay).
function renderTrendsProgressView(t, i18n) {
  let html = `<div class="wip-snap-row"><strong>${escapeText(i18n.t('trendsTimeTitle'))}</strong></div>`;
  if (t.time && t.time.reliable && t.time.elapsedPct != null) {
    html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsElapsed', { pct: t.time.elapsedPct }))}</span></div>`;
    html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsReference', { pct: t.time.linearReferencePct }))}</span></div>`;
    const observedPct = t.latest ? t.latest.baselineCompletionPct : null;
    if (observedPct == null) {
      html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsObservedUnavailable'))}</div>`;
    } else {
      html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsObservedCompletion', { pct: observedPct }))}</span></div>`;
      html +=
        `<div class="wip-progress-bar wip-trends-ref" role="img" aria-label="${escapeText(String(observedPct))}%">` +
        `<div class="wip-progress-fill" style="width:${Math.max(0, Math.min(100, observedPct))}%"></div>` +
        `<div class="wip-trends-ref-mark" style="left:${Math.max(0, Math.min(100, t.time.linearReferencePct))}%"></div>` +
        `</div>`;
      const dev = Math.round((observedPct - t.time.linearReferencePct) * 100) / 100;
      html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsDeviation', { pts: dev > 0 ? '+' + dev : String(dev) }))}</span></div>`;
    }
  } else {
    html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsElapsedUnknown'))}</div>`;
  }
  return html;
}

// Trends view: the completion series + burnup/burndown + the risk indicator.
function renderTrendsTrendsView(t, i18n) {
  let html = `<div class="wip-snap-row"><strong>${escapeText(i18n.t('trendsSeriesTitle'))}</strong></div>`;
  (t.series || []).forEach(function (p) {
    const when = formatTrendWhen(p.iso);
    if (p.baselineCompletionPct == null) {
      html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsSeriesUnavailable', { when: when }))}</span></div>`;
    } else {
      const key = p.reliability === 'sufficient' ? 'trendsSeriesPoint' : 'trendsSeriesPointPartial';
      html += `<div class="wip-snap-row"><span>${escapeText(i18n.t(key, { when: when, pct: p.baselineCompletionPct, completed: p.completed, total: p.baselineTotal }))}</span></div>`;
    }
  });

  // Burnup / burndown (only real instants; goal section 5).
  html += `<div class="wip-snap-row"><strong>${escapeText(i18n.t('trendsBurnTitle'))}</strong></div>`;
  (t.burndown || []).forEach(function (p) {
    const when = formatTrendWhen(p.iso);
    html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsBurndownPoint', { when: when, remaining: p.remaining, unknown: p.unknown }))}</span></div>`;
  });
  html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsBurnNote'))}</div>`;

  html += renderTrendsRisk(t, i18n);
  return html;
}

// Scope view: the scope-change timeline between successive observations.
function renderTrendsScopeView(t, i18n) {
  let html = `<div class="wip-snap-row"><strong>${escapeText(i18n.t('trendsScopeTitle'))}</strong></div>`;
  const intervals = (t.scopeTimeline || []).filter(function (iv) {
    return iv.reliable === false || iv.added.length || iv.removed.length || iv.returned.length;
  });
  if (intervals.length === 0) {
    html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsScopeNone'))}</div>`;
    return html;
  }
  intervals.forEach(function (iv) {
    html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsScopeInterval', { from: formatTrendWhen(iv.fromIso), to: formatTrendWhen(iv.toIso) }))}</span></div>`;
    if (iv.reliable === false) {
      html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsScopeUnreliable'))}</div>`;
      return;
    }
    if (iv.added.length) html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsScopeAdded', { ids: iv.added.join(', ') }))}</span></div>`;
    if (iv.removed.length) html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsScopeRemoved', { ids: iv.removed.join(', ') }))}</span></div>`;
    if (iv.returned.length) html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsScopeReturned', { ids: iv.returned.join(', ') }))}</span></div>`;
  });
  return html;
}

// Risk indicator + the signals that explain it (goal sections 7 & 8). Includes
// the explicit "not a forecast" disclaimer so the heuristic is never mistaken
// for a prediction.
function renderTrendsRisk(t, i18n) {
  const risk = t.risk || { level: 'insufficient-data', signals: [] };
  const levelKey = {
    'on-track': 'trendsRiskOnTrack',
    'attention': 'trendsRiskAttention',
    'at-risk': 'trendsRiskAtRisk',
    'insufficient-data': 'trendsRiskInsufficient',
  }[risk.level] || 'trendsRiskInsufficient';
  const levelClass = {
    'on-track': 'wip-risk-ontrack',
    'attention': 'wip-risk-attention',
    'at-risk': 'wip-risk-atrisk',
    'insufficient-data': 'wip-risk-insufficient',
  }[risk.level] || 'wip-risk-insufficient';

  let html =
    `<div class="wip-snap-row"><strong>${escapeText(i18n.t('trendsRiskTitle'))}</strong></div>` +
    `<div class="wip-snap-row"><span class="wip-risk-badge ${levelClass}">${escapeText(i18n.t(levelKey))}</span></div>`;

  if (risk.level === 'insufficient-data') {
    html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsRiskInsufficientReason'))}</div>`;
    return html;
  }

  html += `<div class="wip-snap-row"><span>${escapeText(i18n.t('trendsRiskSignalsTitle'))}</span></div>`;
  const signalKey = {
    'behind-reference': 'trendsSignalBehindReference',
    'late-sprint-low-completion': 'trendsSignalLateLowCompletion',
    'scope-growth': 'trendsSignalScopeGrowth',
    'stagnation': 'trendsSignalStagnation',
    'unknown-share': 'trendsSignalUnknownShare',
  };
  const signals = Array.isArray(risk.signals) ? risk.signals : [];
  if (signals.length === 0) {
    html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsRiskNoSignals'))}</div>`;
  } else {
    signals.forEach(function (s) {
      const key = signalKey[s.code];
      if (!key) return;
      html += `<div class="wip-snap-row"><span>${escapeText(i18n.t(key, { value: s.value }))}</span></div>`;
    });
  }

  html += `<div class="wip-snap-note">${escapeText(i18n.t('trendsRiskDisclaimer'))}</div>`;
  return html;
}

function formatTrendWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString();
  } catch (e) {
    return String(iso);
  }
}

function unavailableToText(value) {
  if (value == null) return '';
  if (value && typeof value === 'object' && value.__wipFieldState === 'unavailable') return '';
  return String(value);
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
      <button id="wip-snapshot-toggle" type="button" aria-controls="wip-snapshot-body" aria-expanded="false">
        <span id="wip-snapshot-title"></span>
        <span id="wip-snapshot-caret">▴</span>
      </button>
      <div id="wip-snapshot-body" role="region" aria-labelledby="wip-snapshot-title">
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
        <div class="wip-history-section" id="wip-history-section">
          <h4 id="wip-history-title"></h4>
          <p class="wip-comparison-help" id="wip-history-help"></p>
          <div class="wip-snap-actions">
            <button class="wip-snap-btn" id="wip-history-refresh" type="button"></button>
          </div>
          <div class="wip-history-filter">
            <label id="wip-history-from-label" for="wip-history-from"></label>
            <input type="date" id="wip-history-from" class="wip-history-date" />
            <label id="wip-history-to-label" for="wip-history-to"></label>
            <input type="date" id="wip-history-to" class="wip-history-date" />
            <button class="wip-snap-btn" id="wip-history-apply" type="button"></button>
            <button class="wip-snap-btn" id="wip-history-clear" type="button"></button>
          </div>
          <p class="wip-snap-status" id="wip-history-status"></p>
          <div class="wip-commit-output" id="wip-history-output"></div>
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
        <div class="wip-sprint-section" id="wip-sprint-section">
          <h4 id="wip-sprint-title"></h4>
          <p class="wip-comparison-help" id="wip-sprint-help"></p>
          <div class="wip-snap-actions">
            <button class="wip-snap-btn" id="wip-sprint-refresh" type="button"></button>
            <button class="wip-snap-btn" id="wip-sprint-baseline" type="button"></button>
          </div>
          <p class="wip-snap-status" id="wip-sprint-status"></p>
          <div class="wip-commit-output" id="wip-sprint-output"></div>
          <div class="wip-sprint-progress" id="wip-sprint-progress">
            <h4 id="wip-sprint-progress-title"></h4>
            <p class="wip-comparison-help" id="wip-sprint-progress-help"></p>
            <div class="wip-commit-output" id="wip-sprint-progress-output"></div>
          </div>
          <div class="wip-sprint-trends" id="wip-sprint-trends">
            <h4 id="wip-sprint-trends-title"></h4>
            <p class="wip-comparison-help" id="wip-sprint-trends-help"></p>
            <div class="wip-snap-actions">
              <button class="wip-snap-btn" id="wip-sprint-observe" type="button"></button>
            </div>
            <div class="wip-trends-toggle">
              <button class="wip-trends-tab" id="wip-sprint-trends-tab-progress" data-view="progress" type="button"></button>
              <button class="wip-trends-tab" id="wip-sprint-trends-tab-scope" data-view="scope" type="button"></button>
              <button class="wip-trends-tab active" id="wip-sprint-trends-tab-trends" data-view="trends" type="button"></button>
            </div>
            <p class="wip-snap-status" id="wip-sprint-trends-status"></p>
            <div class="wip-commit-output" id="wip-sprint-trends-output"></div>
          </div>
          <div class="wip-sprint-goal" id="wip-sprint-goal">
            <h4 id="wip-sprint-goal-title"></h4>
            <label id="wip-sprint-goal-objective-label" for="wip-sprint-goal-objective"></label>
            <input class="wip-sprint-input" id="wip-sprint-goal-objective" type="text" autocomplete="off" />
            <label id="wip-sprint-goal-description-label" for="wip-sprint-goal-description"></label>
            <textarea class="wip-sprint-textarea" id="wip-sprint-goal-description" rows="2"></textarea>
            <label id="wip-sprint-goal-criteria-label" for="wip-sprint-goal-criteria"></label>
            <textarea class="wip-sprint-textarea" id="wip-sprint-goal-criteria" rows="2"></textarea>
            <label id="wip-sprint-goal-priorities-label" for="wip-sprint-goal-priorities"></label>
            <textarea class="wip-sprint-textarea" id="wip-sprint-goal-priorities" rows="2"></textarea>
            <div class="wip-snap-actions">
              <button class="wip-snap-btn" id="wip-sprint-goal-save" type="button"></button>
            </div>
            <p class="wip-snap-status" id="wip-sprint-goal-status"></p>
          </div>
          <div class="wip-sprint-manual" id="wip-sprint-manual">
            <h4 id="wip-sprint-manual-title"></h4>
            <label id="wip-sprint-manual-id-label" for="wip-sprint-manual-id"></label>
            <input class="wip-sprint-input" id="wip-sprint-manual-id" type="text" autocomplete="off" />
            <label id="wip-sprint-manual-start-label" for="wip-sprint-manual-start"></label>
            <input class="wip-sprint-input" id="wip-sprint-manual-start" type="date" />
            <label id="wip-sprint-manual-finish-label" for="wip-sprint-manual-finish"></label>
            <input class="wip-sprint-input" id="wip-sprint-manual-finish" type="date" />
            <div class="wip-snap-actions">
              <button class="wip-snap-btn" id="wip-sprint-manual-save" type="button"></button>
            </div>
            <p class="wip-snap-status" id="wip-sprint-manual-status"></p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const toggle = panel.querySelector('#wip-snapshot-toggle');
    const setOpen = (open) => {
      if (panel.classList.contains('open') === open) return;
      panel.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      const caret = panel.querySelector('#wip-snapshot-caret');
      if (caret) caret.textContent = open ? '▾' : '▴';
    };
    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    // Escape closes the panel even when focus is inside a deeply nested form.
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
        event.stopPropagation();
      }
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
    if (DailyCommitment && CommitmentPicker && DailySession) {
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
    if (ProjectedBoard && DailyCommitment && DailySession) {
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
    if (DailyComparison && DailyCommitment && DailySession) {
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

  // Daily History sub-section (roadmap T1.7). Shown only when the pure history
  // aggregation module and the comparison view-model are present; bound against
  // the current context/i18n every refresh so config and language changes take
  // effect. The UI only presents what the pure layer produced.
  const historySection = document.getElementById('wip-history-section');
  if (historySection) {
    if (DailyHistory && DailyComparison && DailyCommitment) {
      historySection.style.display = 'block';
      bindSnapshotButton('wip-history-refresh', () => handleLoadHistory(context, i18n));
      bindSnapshotButton('wip-history-apply', () => handleApplyHistoryRange(i18n));
      bindSnapshotButton('wip-history-clear', () => handleClearHistoryRange(i18n));
      setTextById('wip-history-title', i18n.t('historySectionTitle'));
      setTextById('wip-history-help', i18n.t('historyHelp'));
      setTextById('wip-history-refresh', i18n.t('historyRefresh'));
      setTextById('wip-history-from-label', i18n.t('historyFromLabel'));
      setTextById('wip-history-to-label', i18n.t('historyToLabel'));
      setTextById('wip-history-apply', i18n.t('historyApplyFilter'));
      setTextById('wip-history-clear', i18n.t('historyClearFilter'));
      // Relabel an already-rendered history without recomputing or re-reading the
      // board, so a language switch keeps the current records and metrics.
      if (historyState.view) renderHistory(i18n);
    } else {
      historySection.style.display = 'none';
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

  // Sprint Intelligence sub-section (roadmap T2.2). Shown only when the pure
  // modules are present; bound against the current context/i18n every refresh so
  // config and language changes take effect. The section operates on the DOM
  // scope + manual config + local persistence (the read-only API stays unwired
  // per T2.1 + goal section 8), so it never presents simulated data as real.
  const sprintSection = document.getElementById('wip-sprint-section');
  if (sprintSection) {
    if (SprintScope && SprintBaseline && SprintIntelligence && SprintGoalStore) {
      sprintSection.style.display = 'block';
      bindSnapshotButton('wip-sprint-refresh', () => handleLoadSprint(context, i18n));
      bindSnapshotButton('wip-sprint-baseline', () => handleRecordBaseline(context, i18n));
      bindSnapshotButton('wip-sprint-goal-save', () => handleSaveSprintGoal(context, i18n));
      bindSnapshotButton('wip-sprint-manual-save', () => handleSaveManualSprint(context, i18n));
      setTextById('wip-sprint-title', i18n.t('sprintSectionTitle'));
      setTextById('wip-sprint-help', i18n.t('sprintHelp'));
      setTextById('wip-sprint-refresh', i18n.t('sprintRefresh'));
      setTextById('wip-sprint-baseline', i18n.t('sprintRecordBaseline'));
      setTextById('wip-sprint-goal-title', i18n.t('sprintGoalTitle'));
      setTextById('wip-sprint-goal-objective-label', i18n.t('sprintGoalObjective'));
      setTextById('wip-sprint-goal-description-label', i18n.t('sprintGoalDescription'));
      setTextById('wip-sprint-goal-criteria-label', i18n.t('sprintGoalCriteria'));
      setTextById('wip-sprint-goal-priorities-label', i18n.t('sprintGoalPriorities'));
      setTextById('wip-sprint-goal-save', i18n.t('sprintGoalSave'));
      setTextById('wip-sprint-manual-title', i18n.t('sprintManualTitle'));
      setTextById('wip-sprint-manual-id-label', i18n.t('sprintManualId'));
      setTextById('wip-sprint-manual-start-label', i18n.t('sprintManualStart'));
      setTextById('wip-sprint-manual-finish-label', i18n.t('sprintManualFinish'));
      setTextById('wip-sprint-manual-save', i18n.t('sprintManualSave'));
      setTextById('wip-sprint-progress-title', i18n.t('progressSectionTitle'));
      setTextById('wip-sprint-progress-help', i18n.t('progressHelp'));

      // Sprint Trends & Risk sub-section (roadmap T2.4). Shown only when the pure
      // trend engine and the observation store are present; bound against the
      // current context/i18n every refresh. It reuses the DOM scope + local
      // observation history; the read-only API stays unwired (goal section 12).
      const trendsSection = document.getElementById('wip-sprint-trends');
      if (trendsSection) {
        if (SprintTrends && SprintObservationStore) {
          trendsSection.style.display = 'block';
          bindSnapshotButton('wip-sprint-observe', () => handleRecordObservation(context, i18n));
          bindSnapshotButton('wip-sprint-trends-tab-progress', () => setSprintTrendsView('progress', i18n));
          bindSnapshotButton('wip-sprint-trends-tab-scope', () => setSprintTrendsView('scope', i18n));
          bindSnapshotButton('wip-sprint-trends-tab-trends', () => setSprintTrendsView('trends', i18n));
          setTextById('wip-sprint-trends-title', i18n.t('trendsSectionTitle'));
          setTextById('wip-sprint-trends-help', i18n.t('trendsHelp'));
          setTextById('wip-sprint-observe', i18n.t('trendsRecordObservation'));
          setTextById('wip-sprint-trends-tab-progress', i18n.t('trendsViewProgress'));
          setTextById('wip-sprint-trends-tab-scope', i18n.t('trendsViewScope'));
          setTextById('wip-sprint-trends-tab-trends', i18n.t('trendsViewTrends'));
        } else {
          trendsSection.style.display = 'none';
        }
      }

      // Relabel an already-rendered view without recomputing, so a language
      // switch keeps the current sprint data and metrics.
      if (sprintState.view) renderSprint(i18n);
      if (sprintState.progress) renderSprintProgress(i18n);
      if (sprintState.trends) renderSprintTrends(i18n);
    } else {
      sprintSection.style.display = 'none';
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
    'azureApiEnabled',
    'sprintStartColumn',
    'sprintEndColumn',
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
    const snapshotContext = {
      currentBoardName,
      boardPathFilter,
      // Sprint Intelligence (T2.2): the API feature flag (default false) and the
      // optional, per-board flow boundaries. Read-only; the API stays unwired.
      azureApiEnabled: data.azureApiEnabled === true,
      sprintStartColumn: typeof data.sprintStartColumn === 'string' ? data.sprintStartColumn : '',
      sprintEndColumn: typeof data.sprintEndColumn === 'string' ? data.sprintEndColumn : '',
    };

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