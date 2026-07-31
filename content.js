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
  },
};

function getLanguageCode(value) {
  return value === 'pt' ? 'pt' : 'en';
}

function formatMessage(template, tokens = {}) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, token) => String(tokens[token] ?? ''));
}

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
  const languageData = await getStorageValues(['language']);
  const i18n = getLanguagePack(languageData.language);
  const web = await fetch('https://raw.githubusercontent.com/mateussmeneses/wip-board-azure/refs/heads/master/version.json').then(r => r.json());
  const local = await fetch(chrome.runtime.getURL('version.json')).then(r => r.json());

  const isUpdated = web.version === local.version;
  if (isUpdated) return;
  alert(i18n.t('outdatedExtension'));
  console.clear();
  console.warn("https://codeload.github.com/mateussmeneses/wip-board-azure/zip/refs/heads/master");
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


  `;
  document.head.appendChild(style);
}


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

function getHeaderColumnDisplayName(header) {
  // Read a reliable column name from common header locations.
  const ariaLabel = header?.getAttribute('aria-label') || '';
  const editableLabel = header?.querySelector('.click-edit-field')?.textContent || '';

  if (editableLabel.trim()) return editableLabel.trim();
  if (ariaLabel.trim()) return ariaLabel.trim();

  return (header?.textContent || '').trim();
}

function isConfiguredWipColumn(columnName, configuredColumns) {
  const normalizedColumn = normalizeColumnName(columnName);
  if (!normalizedColumn) return false;

  return configuredColumns.some(configured => {
    const normalizedConfigured = normalizeColumnName(configured);
    if (!normalizedConfigured) return false;

    // Accept exact and inclusive matching to tolerate Azure suffixes.
    return normalizedConfigured === normalizedColumn
      || normalizedConfigured.includes(normalizedColumn)
      || normalizedColumn.includes(normalizedConfigured);
  });
}

function isCardVisible(card) {
  // Azure can keep filtered cards in DOM; count only cards currently visible.
  if (!card) return false;
  const style = window.getComputedStyle(card);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (card.closest('[aria-hidden="true"], .is-hidden, .hidden')) return false;
  return card.getClientRects().length > 0;
}

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
  indicator.innerHTML = `<div>${titleHTML}</div>${panelHTML}`;

  if (wasOpen && isDetailsActive) {
    document.getElementById('wip-details-panel').style.display = 'block';
  }
}

function getCardSeverityClass(agingValue, alarmConfig) {
  if (agingValue !== null && agingValue >= alarmConfig.agingCriticalDays) return 'card-alerta-critico';
  if (agingValue !== null && agingValue >= alarmConfig.agingHighDays) return 'card-alerta-alto';
  if (agingValue !== null && agingValue >= alarmConfig.agingWarningDays) return 'card-alerta-medio';
  return 'card-alerta-baixo';
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
      const parts = val.split('/');
      if (parts.length === 3) {
        const targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffTime = targetDate - today;
        targetDateDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
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
// 2. MAIN WIP CALCULATION AND ANALYSIS
// ============================================================================
// Main runtime flow: scan board, count cards, apply rules, render indicator.
function updateWipBoard() {

  // Guard clause: extension can be reloaded while tab is still open.
  if (!chrome.runtime?.id) return;

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
    
    // Calculate limit based on selected mode.
    let limit = null;
    
    if (data.useEquipe === true && data.equipeSize) {
      limit = (2 * data.equipeSize) + 1;
    } else if (data.useEquipe === false && data.directWip) {
      limit = data.directWip;
    }

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
      indicator.innerHTML = `<div>${i18n.t('indicatorMissingConfig')}</div>`;
      return;
    }
    
    let totalCards = 0; // Soma bruta baseada nos cards visíveis
    const specialStatsByPerson = new Map(); // Per-person counters used by the special WIP reduction rule.
    const allWipCards = [];
    let columnsBreakdown = []; // Array que vai guardar o subtotal de CADA coluna para mostrarmos no painel

    // Locate board column headers and bodies from the current page.
    const headers = document.querySelectorAll('.kanban-board-column-header');
    const columnBodies = document.querySelectorAll('.kanban-board-column');

    // Hide indicator when current URL does not match configured board/route filters.
    if (!isAllowedBoard(currentBoardName, boardPathFilter)) {
      const indicator = document.getElementById('custom-wip-indicator');
      if (indicator) indicator.style.display = 'none';
      return;
    }

    // Build column index map for columns included in WIP.
    const wipColumnsMeta = [];
    headers.forEach((header, index) => {
      const displayName = getHeaderColumnDisplayName(header);
      if (isConfiguredWipColumn(displayName, wipColumns)) {
        wipColumnsMeta.push({ index, displayName });
      }
    });

    // Analyze cards only in configured WIP columns.
    wipColumnsMeta.forEach(({ index, displayName }) => {
      const columnContainer = columnBodies[index];
      const cardsInColumn = columnContainer
        ? Array.from(columnContainer.querySelectorAll('.wit-card')).filter(isCardVisible)
        : [];

      const colTotal = cardsInColumn.length;
      totalCards += colTotal;
      columnsBreakdown.push({ name: displayName, count: colTotal });

      cardsInColumn.forEach(card => {
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

    // Evaluate card-level alarms only in WIP columns.
    allWipCards.forEach(card => {
      applyCardAlarm(card, isHighlightActive, alarmConfig, blockTag, i18n);
    });
    
    
    // Final WIP business rule: per special person, all matching special-tag cards count as 1 block.
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

    // Render final indicator state.
    displayWip(finalWip, limit, columnsBreakdown, isDetailsActive, i18n);
  });
}

// ============================================================================
// 3. INDICATOR RENDERING AND DETAILS PANEL
// ============================================================================
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