// popup.js

// Run after popup DOM is ready, then wire all fields and actions.
document.addEventListener('DOMContentLoaded', () => {
  const equipeInput = document.getElementById('equipeSize');
  const directWipInput = document.getElementById('directWip');
  const toggleDetails = document.getElementById('toggleDetails');
  const toggleHighlight = document.getElementById('toggleHighlight');
  const toggleSpecialRule = document.getElementById('toggleSpecialRule');
  const boardNameInput = document.getElementById('boardName');
  const boardPathFilterInput = document.getElementById('boardPathFilter');
  const specialPeopleInput = document.getElementById('specialPeople');
  const wipColumnsInput = document.getElementById('wipColumns');
  const specialTagPrefixInput = document.getElementById('specialTagPrefix');
  const blockTagInput = document.getElementById('blockTag');
  const agingWarningDaysInput = document.getElementById('agingWarningDays');
  const agingHighDaysInput = document.getElementById('agingHighDays');
  const agingCriticalDaysInput = document.getElementById('agingCriticalDays');
  const targetDateWarningDaysInput = document.getElementById('targetDateWarningDays');
  const saveBtn = document.getElementById('saveBtn');
  const applyTemplateBtn = document.getElementById('apply-template');
  const languageToggle = document.getElementById('languageToggle');
  const status = document.getElementById('status');
  const errorMsg = document.getElementById('error-msg');

  const I18N = {
    en: {
      title: 'WIP Monitor Settings',
      languageToggleLabel: 'Use Portuguese (PT-BR)',
      applyTemplate: 'Use sample configuration',
      labelTeamSize: 'Team Size:',
      hintFormula: 'Formula mode: 2 x team + 1',
      dividerOr: 'OR',
      labelDirectWip: 'Direct WIP Limit:',
      dividerBoard: 'BOARD TARGETING',
      labelBoardKeyword: 'Board URL keyword:',
      hintBoardKeyword: 'Used to detect the current board URL.',
      labelBoardRoute: 'Optional route keyword:',
      hintBoardRoute: 'Leave empty to work on any route inside the board.',
      labelWipColumns: 'WIP columns (comma-separated):',
      hintWipColumns: 'Only these columns are included in WIP calculation.',
      dividerSpecialRule: 'SPECIAL RULE',
      labelSpecialPeople: 'Special people (comma-separated):',
      hintSpecialPeople: 'Required only when special rule is enabled.',
      labelSpecialTag: 'Special tag prefix:',
      labelBlockTag: 'Block tag:',
      specialRulePeopleExplanation: 'Special people rule: for each configured person, all cards matching the special tag prefix count as 1 block in WIP (instead of counting each card separately).',
      specialRuleBlockExplanation: 'Block tag rule: cards containing the block tag are excluded from card highlight alarms, but they still count in WIP totals.',
      dividerThresholds: 'ALERT THRESHOLDS',
      labelAgingWarning: 'Aging warning:',
      labelAgingHigh: 'Aging high:',
      labelAgingCritical: 'Aging critical:',
      labelTargetDateWarning: 'Target date warning:',
      agingRuleExplanation: 'Aging rule: when a card reaches the configured warning/high/critical aging thresholds, visual card alarms are applied based on severity.',
      targetDateRuleExplanation: 'Target date rule: when a card has Target Date with remaining days less than or equal to the configured threshold, it is marked as alert. Overdue cards are also alerted.',
      dividerFeatures: 'FEATURES',
      labelToggleDetails: 'Enable click on indicator to show column details.',
      labelToggleHighlight: 'Highlight cards by aging and target date thresholds.',
      labelToggleSpecialRule: 'Enable special rule for configured people and tag prefix.',
      saveBtn: 'Save configuration',
      statusSaved: 'Configuration saved successfully!',
      defaultError: 'Please fill in the required fields.',
      placeholders: {
        equipeSize: 'Number of people',
        directWip: 'Fixed limit',
        boardName: 'Example: Sda.Arms',
        boardPathFilter: 'Example: maintenance/features',
        wipColumns: 'In Progress, Code Review, Ready for QA',
        specialPeople: 'Person A, Person B',
      },
      errors: {
        boardName: 'Please provide a valid board URL keyword.',
        wipColumns: 'Please provide at least one WIP column.',
        specialPeople: 'Special people are required when special rule is enabled.',
        agingThresholds: 'Aging thresholds must be positive numbers.',
        agingOrder: 'Aging thresholds must follow: warning <= high <= critical.',
        targetDate: 'Target date warning must be zero or a positive number.',
        limitMode: 'Please provide either Team Size or Direct WIP Limit.',
      },
    },
    pt: {
      title: 'Configurações do Monitor de WIP',
      languageToggleLabel: 'Usar Português (PT-BR)',
      applyTemplate: 'Usar configuração de exemplo',
      labelTeamSize: 'Tamanho da Equipe:',
      hintFormula: 'Modo fórmula: 2 x equipe + 1',
      dividerOr: 'OU',
      labelDirectWip: 'Limite WIP Direto:',
      dividerBoard: 'ALVO DO BOARD',
      labelBoardKeyword: 'Palavra-chave da URL do board:',
      hintBoardKeyword: 'Usado para detectar o board na URL atual.',
      labelBoardRoute: 'Palavra-chave opcional da rota:',
      hintBoardRoute: 'Deixe vazio para funcionar em qualquer rota dentro do board.',
      labelWipColumns: 'Colunas WIP (separadas por vírgula):',
      hintWipColumns: 'Somente essas colunas entram no cálculo do WIP.',
      dividerSpecialRule: 'REGRA ESPECIAL',
      labelSpecialPeople: 'Pessoas especiais (separadas por vírgula):',
      hintSpecialPeople: 'Obrigatório apenas quando a regra especial estiver habilitada.',
      labelSpecialTag: 'Prefixo da tag especial:',
      labelBlockTag: 'Tag de bloqueio:',
      specialRulePeopleExplanation: 'Regra de pessoas especiais: para cada pessoa configurada, todos os cards que baterem com o prefixo da tag especial contam como 1 bloco no WIP (em vez de contar cada card separadamente).',
      specialRuleBlockExplanation: 'Regra da tag de bloqueio: cards com a tag de bloqueio ficam fora dos alertas visuais dos cards, mas continuam contando no WIP total.',
      dividerThresholds: 'LIMITES DE ALERTA',
      labelAgingWarning: 'Aging de atenção:',
      labelAgingHigh: 'Aging alto:',
      labelAgingCritical: 'Aging crítico:',
      labelTargetDateWarning: 'Alerta de prazo:',
      agingRuleExplanation: 'Regra de Aging: quando um card atinge os limites configurados de atenção/alto/crítico, os alertas visuais do card são aplicados conforme a severidade.',
      targetDateRuleExplanation: 'Regra de Prazo: quando um card tem Target Date com dias restantes menor ou igual ao limite configurado, ele entra em alerta. Cards atrasados também entram em alerta.',
      dividerFeatures: 'FUNCIONALIDADES',
      labelToggleDetails: 'Permitir clique no indicador para mostrar detalhes por coluna.',
      labelToggleHighlight: 'Destacar cards por limites de aging e data alvo.',
      labelToggleSpecialRule: 'Habilitar regra especial para pessoas e prefixo de tag.',
      saveBtn: 'Salvar configuração',
      statusSaved: 'Configuração salva com sucesso!',
      defaultError: 'Preencha os campos obrigatórios.',
      placeholders: {
        equipeSize: 'Número de pessoas',
        directWip: 'Limite fixo',
        boardName: 'Exemplo: Sda.Arms',
        boardPathFilter: 'Exemplo: maintenance/features',
        wipColumns: 'In Progress, Code Review, Ready for QA',
        specialPeople: 'Pessoa A, Pessoa B',
      },
      errors: {
        boardName: 'Informe uma palavra-chave válida para URL do board.',
        wipColumns: 'Informe pelo menos uma coluna WIP.',
        specialPeople: 'Pessoas especiais são obrigatórias quando a regra especial está ativa.',
        agingThresholds: 'Os limites de aging devem ser números positivos.',
        agingOrder: 'Os limites de aging devem seguir: atenção <= alto <= crítico.',
        targetDate: 'O alerta de prazo deve ser zero ou um número positivo.',
        limitMode: 'Informe Tamanho da Equipe ou Limite WIP Direto.',
      },
    },
  };

  let currentLanguage = 'en';

  function t(key) {
    return I18N[currentLanguage][key] ?? I18N.en[key] ?? key;
  }

  function applyPopupLanguage() {
    const messages = I18N[currentLanguage];

    document.documentElement.lang = currentLanguage === 'pt' ? 'pt-BR' : 'en';
    document.getElementById('title').textContent = messages.title;
    document.getElementById('languageToggleLabel').textContent = messages.languageToggleLabel;
    applyTemplateBtn.textContent = messages.applyTemplate;
    document.getElementById('labelTeamSize').textContent = messages.labelTeamSize;
    document.getElementById('hintFormula').textContent = messages.hintFormula;
    document.getElementById('dividerOr').textContent = messages.dividerOr;
    document.getElementById('labelDirectWip').textContent = messages.labelDirectWip;
    document.getElementById('dividerBoard').textContent = messages.dividerBoard;
    document.getElementById('labelBoardKeyword').textContent = messages.labelBoardKeyword;
    document.getElementById('hintBoardKeyword').textContent = messages.hintBoardKeyword;
    document.getElementById('labelBoardRoute').textContent = messages.labelBoardRoute;
    document.getElementById('hintBoardRoute').textContent = messages.hintBoardRoute;
    document.getElementById('labelWipColumns').textContent = messages.labelWipColumns;
    document.getElementById('hintWipColumns').textContent = messages.hintWipColumns;
    document.getElementById('dividerSpecialRule').textContent = messages.dividerSpecialRule;
    document.getElementById('labelSpecialPeople').textContent = messages.labelSpecialPeople;
    document.getElementById('hintSpecialPeople').textContent = messages.hintSpecialPeople;
    document.getElementById('labelSpecialTag').textContent = messages.labelSpecialTag;
    document.getElementById('labelBlockTag').textContent = messages.labelBlockTag;
    document.getElementById('specialRulePeopleExplanation').textContent = messages.specialRulePeopleExplanation;
    document.getElementById('specialRuleBlockExplanation').textContent = messages.specialRuleBlockExplanation;
    document.getElementById('dividerThresholds').textContent = messages.dividerThresholds;
    document.getElementById('labelAgingWarning').textContent = messages.labelAgingWarning;
    document.getElementById('labelAgingHigh').textContent = messages.labelAgingHigh;
    document.getElementById('labelAgingCritical').textContent = messages.labelAgingCritical;
    document.getElementById('labelTargetDateWarning').textContent = messages.labelTargetDateWarning;
    document.getElementById('agingRuleExplanation').textContent = messages.agingRuleExplanation;
    document.getElementById('targetDateRuleExplanation').textContent = messages.targetDateRuleExplanation;
    document.getElementById('dividerFeatures').textContent = messages.dividerFeatures;
    document.getElementById('labelToggleDetails').textContent = messages.labelToggleDetails;
    document.getElementById('labelToggleHighlight').textContent = messages.labelToggleHighlight;
    document.getElementById('labelToggleSpecialRule').textContent = messages.labelToggleSpecialRule;
    saveBtn.textContent = messages.saveBtn;
    status.textContent = messages.statusSaved;
    if (errorMsg.dataset.key) {
      errorMsg.textContent = messages.errors[errorMsg.dataset.key] || messages.defaultError;
    } else {
      errorMsg.textContent = messages.defaultError;
    }

    equipeInput.placeholder = messages.placeholders.equipeSize;
    directWipInput.placeholder = messages.placeholders.directWip;
    boardNameInput.placeholder = messages.placeholders.boardName;
    boardPathFilterInput.placeholder = messages.placeholders.boardPathFilter;
    wipColumnsInput.placeholder = messages.placeholders.wipColumns;
    specialPeopleInput.placeholder = messages.placeholders.specialPeople;
  }

  function setError(errorKey) {
    errorMsg.dataset.key = errorKey;
    errorMsg.textContent = I18N[currentLanguage].errors[errorKey] || I18N[currentLanguage].defaultError;
    errorMsg.style.display = 'block';
  }

  // Sample values are generic and can be adapted by each team before saving.
  const sampleConfig = {
    wipColumns: ['In Progress', 'Code Review', 'Ready for QA'],
    specialTagPrefix: '#spa',
    blockTag: '#blck',
    showDetails: true,
    highlightCards: true,
    specialRuleEnabled: false,
    agingWarningDays: 10,
    agingHighDays: 15,
    agingCriticalDays: 20,
    targetDateWarningDays: 3,
  };

  function normalizeList(value) {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  function normalizeTag(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }

  function clearError() {
    delete errorMsg.dataset.key;
    errorMsg.style.display = 'none';
  }

  function applySampleConfigToForm() {
    wipColumnsInput.value = sampleConfig.wipColumns.join(', ');
    specialTagPrefixInput.value = sampleConfig.specialTagPrefix;
    blockTagInput.value = sampleConfig.blockTag;
    toggleDetails.checked = sampleConfig.showDetails;
    toggleHighlight.checked = sampleConfig.highlightCards;
    toggleSpecialRule.checked = sampleConfig.specialRuleEnabled;
    agingWarningDaysInput.value = sampleConfig.agingWarningDays;
    agingHighDaysInput.value = sampleConfig.agingHighDays;
    agingCriticalDaysInput.value = sampleConfig.agingCriticalDays;
    targetDateWarningDaysInput.value = sampleConfig.targetDateWarningDays;
  }

  applyTemplateBtn.addEventListener('click', () => {
    applySampleConfigToForm();
    clearError();
  });

  languageToggle.addEventListener('change', () => {
    currentLanguage = languageToggle.checked ? 'pt' : 'en';
    applyPopupLanguage();
    chrome.storage.sync.set({ language: currentLanguage });
  });

  chrome.storage.sync.get([
    'equipeSize',
    'directWip',
    'useEquipe',
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
    'hasInitializedConfig',
  ], (data) => {
    currentLanguage = data.language === 'pt' ? 'pt' : 'en';
    languageToggle.checked = currentLanguage === 'pt';
    applyPopupLanguage();

    if (data.useEquipe === true && data.equipeSize) {
      equipeInput.value = data.equipeSize;
    }
    if (data.useEquipe === false && data.directWip) {
      directWipInput.value = data.directWip;
    }

    toggleDetails.checked = data.showDetails === true;
    toggleHighlight.checked = data.highlightCards === true;
    toggleSpecialRule.checked = data.specialRuleEnabled === true;

    boardNameInput.value = data.boardName || '';
    boardPathFilterInput.value = data.boardPathFilter || '';
    specialPeopleInput.value = Array.isArray(data.specialPeople) ? data.specialPeople.join(', ') : '';
    wipColumnsInput.value = Array.isArray(data.wipColumns) ? data.wipColumns.join(', ') : '';
    specialTagPrefixInput.value = data.specialTagPrefix || '';
    blockTagInput.value = data.blockTag || '';
    agingWarningDaysInput.value = data.agingWarningDays || '';
    agingHighDaysInput.value = data.agingHighDays || '';
    agingCriticalDaysInput.value = data.agingCriticalDays || '';
    targetDateWarningDaysInput.value = data.targetDateWarningDays || '';

    const hasAnyConfig = Boolean(data.boardName)
      || (Array.isArray(data.wipColumns) && data.wipColumns.length)
      || data.equipeSize
      || data.directWip;

    if (!data.hasInitializedConfig && !hasAnyConfig) {
      applyTemplateBtn.style.background = '#bfdbfe';
      applyTemplateBtn.style.borderColor = '#2563eb';
      applyTemplateBtn.style.fontWeight = 'bold';
    }
  });

  equipeInput.addEventListener('input', () => {
    directWipInput.value = '';
    clearError();
  });

  directWipInput.addEventListener('input', () => {
    equipeInput.value = '';
    clearError();
  });

  [
    boardNameInput,
    boardPathFilterInput,
    specialPeopleInput,
    wipColumnsInput,
    specialTagPrefixInput,
    blockTagInput,
    agingWarningDaysInput,
    agingHighDaysInput,
    agingCriticalDaysInput,
    targetDateWarningDaysInput,
  ].forEach(input => input.addEventListener('input', clearError));

  saveBtn.addEventListener('click', () => {
    const boardName = boardNameInput.value.trim();
    const boardPathFilter = boardPathFilterInput.value.trim();
    const specialPeople = normalizeList(specialPeopleInput.value);
    const wipColumns = normalizeList(wipColumnsInput.value);
    const specialTagPrefix = normalizeTag(specialTagPrefixInput.value || sampleConfig.specialTagPrefix);
    const blockTag = normalizeTag(blockTagInput.value || sampleConfig.blockTag);
    const agingWarningDays = parseInt(agingWarningDaysInput.value || sampleConfig.agingWarningDays, 10);
    const agingHighDays = parseInt(agingHighDaysInput.value || sampleConfig.agingHighDays, 10);
    const agingCriticalDays = parseInt(agingCriticalDaysInput.value || sampleConfig.agingCriticalDays, 10);
    const targetDateWarningDays = parseInt(targetDateWarningDaysInput.value || sampleConfig.targetDateWarningDays, 10);

    const config = {
      language: currentLanguage,
      useEquipe: null,
      equipeSize: null,
      directWip: null,
      showDetails: toggleDetails.checked,
      highlightCards: toggleHighlight.checked,
      specialRuleEnabled: toggleSpecialRule.checked,
      boardName,
      boardPathFilter,
      specialPeople,
      wipColumns,
      specialTagPrefix,
      blockTag,
      agingWarningDays,
      agingHighDays,
      agingCriticalDays,
      targetDateWarningDays,
      hasInitializedConfig: true,
    };

    if (!boardName) {
      setError('boardName');
      return;
    }

    if (config.wipColumns.length === 0) {
      setError('wipColumns');
      return;
    }

    if (toggleSpecialRule.checked && specialPeople.length === 0) {
      setError('specialPeople');
      return;
    }

    if (!Number.isFinite(agingWarningDays) || !Number.isFinite(agingHighDays) || !Number.isFinite(agingCriticalDays) || agingWarningDays < 1 || agingHighDays < 1 || agingCriticalDays < 1) {
      setError('agingThresholds');
      return;
    }

    if (agingWarningDays > agingHighDays || agingHighDays > agingCriticalDays) {
      setError('agingOrder');
      return;
    }

    if (!Number.isFinite(targetDateWarningDays) || targetDateWarningDays < 0) {
      setError('targetDate');
      return;
    }

    if (equipeInput.value) {
      config.useEquipe = true;
      config.equipeSize = parseInt(equipeInput.value, 10);
    } else if (directWipInput.value) {
      config.useEquipe = false;
      config.directWip = parseInt(directWipInput.value, 10);
    } else {
      setError('limitMode');
      return;
    }

    chrome.storage.sync.set(config, () => {
      status.style.display = 'block';
      setTimeout(() => { status.style.display = 'none'; }, 2500);
    });
  });
});