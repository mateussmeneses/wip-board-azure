// content.js

// ============================================================================
// 1. CONFIGURAÇÃO VISUAL DE ALERTA E PAINEL (CSS)
// ============================================================================
// O código abaixo cria um "estilo" (CSS) e injeta na página do Azure DevOps.
// Ele controla as animações chamativas e o painel oculto de gargalos.
async function getVersion() {
  const web = await fetch('https://raw.githubusercontent.com/mateussmeneses/wip-board-azure/refs/heads/master/version.json').then(r => r.json());
  const local = await fetch(chrome.runtime.getURL('version.json')).then(r => r.json());

  const isUpdated = web.version === local.version;
  if (isUpdated) return;
  alert("Sua extensão está desatualizada, por favor atualize. O link está no console");
  console.clear();
  console.warn("https://codeload.github.com/mateussmeneses/wip-board-azure/zip/refs/heads/master");
}

getVersion()


if (!document.getElementById('wip-alarm-style')) {
  const style = document.createElement('style');
  style.id = 'wip-alarm-style';
  style.innerHTML = `
    /* Animação para o Indicador flutuante quando o WIP estiver estourado */
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

    /* Animação laranja chamativa para os CARDS com Aging/Prazo crítico (Melhoria 2) */
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
    
    /* Layout do Painel de detalhes que vai abrir ao clicar no indicador (Melhoria 1) */
    #wip-details-panel {
      display: none; /* Começa escondido */
      margin-top: 10px;
      padding: 10px;
      border-top: 1px solid rgba(0,0,0,0.1); /* Linha sutil separando o título do painel */
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
    /* Como cada linha do painel vai se comportar (Nome da Coluna na esquerda, Número na direita) */
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
  // Normaliza nomes de coluna para comparação resiliente contra variações de renderização do Azure.
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, ' ')
    .trim();
}

function getHeaderColumnDisplayName(header) {
  // Tenta obter o nome real da coluna a partir de diferentes pontos do header.
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

    // Aceita match exato e aproximação por inclusão para lidar com sufixos no Azure.
    return normalizedConfigured === normalizedColumn
      || normalizedConfigured.includes(normalizedColumn)
      || normalizedColumn.includes(normalizedConfigured);
  });
}

function isCardVisible(card) {
  // O board do Azure pode manter cards no DOM mesmo filtrados; contamos apenas os visíveis.
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
  // Fallback: alguns boards não exibem o campo Tags no card, mas trazem os dados no HTML serializado.
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
  // Normaliza as opções salvas no popup em um único ponto de leitura.
  const normalizedSpecialPeople = Array.isArray(data.specialPeople) && data.specialPeople.length
    ? data.specialPeople.map(person => normalizeText(person)).filter(Boolean)
    : [];

  const normalizedColumns = (Array.isArray(data.wipColumns) && data.wipColumns.length
    ? data.wipColumns
    : []).map(column => normalizeColumnName(column)).filter(Boolean);

  const currentBoardName = normalizeText(data.boardName || '');

  const isConfigured = Boolean(currentBoardName)
    && normalizedColumns.length > 0
    && normalizedSpecialPeople.length > 0;

  return {
    isConfigured,
    isHighlightActive: data.highlightCards === true,
    isDetailsActive: data.showDetails === true,
    currentBoardName,
    colunasWip: normalizedColumns,
    isSpecialRuleActive: data.specialRuleEnabled === true,
    specialPeople: normalizedSpecialPeople,
    specialTagPrefix: '#spa',
  };
}

function isAllowedBoard(currentBoardName) {
  // Garante que o indicador só seja renderizado quando a URL atual corresponder ao board desejado.
  return !!currentBoardName && window.location.href.toLowerCase().includes(currentBoardName);
}

function applyWipIndicatorState(indicator, current, limit, isDetailsActive, breakdown) {
  // Monta o estado visual do WIP total sem depender de reload.
  let titleHTML = '';
  let panelHTML = '';
  const isCriticalState = limit !== null && current > limit;

  if (limit === null) {
    titleHTML = `<span>WIP: ${current} (Configure o limite na extensão)</span>`;
    indicator.className = '';
    indicator.style.backgroundColor = '#fff3cd';
    indicator.style.color = '#856404';
    indicator.style.border = '2px solid #ffeeba';
  } else {
    titleHTML = `<span>WIP Total do Board: ${current} / ${limit}</span>`;

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
      <div style="font-size: 11px; margin-bottom: 5px; opacity: 0.8;">Gargalos por Coluna:</div>
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

function getCardSeverityClass(agingValue) {
  if (agingValue !== null && agingValue >= 20) return 'card-alerta-critico';
  if (agingValue !== null && agingValue >= 15) return 'card-alerta-alto';
  if (agingValue !== null && agingValue >= 10) return 'card-alerta-medio';
  return 'card-alerta-baixo';
}

function analyzeCard(card) {
  // Lê os campos do card que alimentam os alarmes visuais.
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

    if (label === 'tags' && val.toLowerCase().includes('#blck')) {
      hasBlockTag = true;
    }
  });

  return { agingValue, targetDateDays, hasBlockTag };
}

function analyzeSpecialRule(card, specialTagPrefix) {
  // Considera qualquer variação do prefixo (spa, spa.ui, spaapi) como tag especial única por card.
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
  // Primeiro tenta pelo campo visível de Tags; se não existir, usa fallback por itemId no HTML serializado.
  const hasSpecialTag = tagRegex.test(tagsText) || cardHasSpaTagFromSource(card, specialTagPrefix);

  return { hasSpecialTag };
}

function applyCardAlarm(card, isHighlightActive) {
  // Aplica ou remove os estilos do card conforme o resultado da análise.
  if (!isHighlightActive) {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.removeAttribute('title');
    return;
  }

  const { agingValue, targetDateDays, hasBlockTag } = analyzeCard(card);

  if (hasBlockTag) {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.removeAttribute('title');
    return;
  }

  let isCritical = false;
  const criticalReasons = [];

  if (agingValue !== null) {
    if (agingValue >= 20) {
      isCritical = true;
      criticalReasons.push(`Aging muito alto (${agingValue} dias)`);
    } else if (agingValue >= 15) {
      isCritical = true;
      criticalReasons.push(`Aging alto (${agingValue} dias)`);
    } else if (agingValue >= 10) {
      isCritical = true;
      criticalReasons.push(`Aging em atenção (${agingValue} dias)`);
    }
  }

  if (targetDateDays !== null && targetDateDays <= 3) {
    isCritical = true;
    const statusPrazo = targetDateDays < 0 ? 'ATRASADO' : `Faltam ${targetDateDays} dia(s)`;
    criticalReasons.push(`Prazo: ${statusPrazo}`);
  }

  if (isCritical) {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.classList.add(getCardSeverityClass(agingValue));
    card.setAttribute('title', 'Alerta Crítico:\n' + criticalReasons.join('\n'));
  } else {
    card.classList.remove('card-alerta-critico', 'card-alerta-baixo', 'card-alerta-medio', 'card-alerta-alto');
    card.removeAttribute('title');
  }
}

// ============================================================================
// 2. FUNÇÃO PRINCIPAL DE CÁLCULO E ANÁLISE
// ============================================================================
// Esta é a função principal que varre o quadro do Azure, conta os cards e checa datas
function updateWipBoard() {
  
  // VALIDAÇÃO 1: Evita erros caso a extensão seja recarregada no navegador enquanto a aba está aberta
  if (!chrome.runtime?.id) return;

  // VALIDAÇÃO 2 (Correção do Bug do Roadmap):
  // O Azure DevOps não recarrega a página ao trocar de aba, apenas muda a URL.
  // Checamos se a URL atual contém "Maintenance/Features". Se não, escondemos o indicador e paramos a função.
  if (!window.location.href.includes('Maintenance/Features')) {
    const indicator = document.getElementById('custom-wip-indicator');
    if (indicator) indicator.style.display = 'none';
    return;
  }

  // Pede os dados e as configurações (toggles) que o usuário escolheu no popup
  chrome.storage.sync.get(['useEquipe', 'equipeSize', 'directWip', 'showDetails', 'highlightCards', 'specialRuleEnabled', 'boardName', 'specialPeople', 'wipColumns'], (data) => {
    
    // --- Lógica do Limite ---
    let limit = null; // Iniciamos vazio para identificar se a pessoa ainda não configurou
    
    if (data.useEquipe === true && data.equipeSize) {
      limit = (2 * data.equipeSize) + 1; // Calcula a fórmula
    } else if (data.useEquipe === false && data.directWip) {
      limit = data.directWip; // Usa o fixo
    }

    const { isConfigured, isHighlightActive, isDetailsActive, currentBoardName, colunasWip, isSpecialRuleActive, specialPeople, specialTagPrefix } = getBoardContext(data);

    if (!isConfigured) {
      displayWip(0, null, [], false);
      const indicator = document.getElementById('custom-wip-indicator');
      if (indicator) {
        indicator.innerHTML = '<div><span>Configure o board e as colunas no popup para iniciar.</span></div>';
      }
      return;
    }
    
    let totalCards = 0; // Soma bruta baseada nos cards visíveis
    const specialStatsByPerson = new Map(); // Controle por pessoa para aplicar regra de redução por pessoa.
    const allWipCards = [];
    let columnsBreakdown = []; // Array que vai guardar o subtotal de CADA coluna para mostrarmos no painel

    // Buscamos na página as caixas de título das colunas e as caixas de conteúdo
    const headers = document.querySelectorAll('.kanban-board-column-header');
    const columnBodies = document.querySelectorAll('.kanban-board-column');

    // Se o board configurado não estiver na URL atual, não mostramos o indicador.
    if (!isAllowedBoard(currentBoardName)) {
      const indicator = document.getElementById('custom-wip-indicator');
      if (indicator) indicator.style.display = 'none';
      return;
    }

    // Mapeia os índices de coluna que realmente entram na regra de WIP.
    const wipColumnsMeta = [];
    headers.forEach((header, index) => {
      const displayName = getHeaderColumnDisplayName(header);
      if (isConfiguredWipColumn(displayName, colunasWip)) {
        wipColumnsMeta.push({ index, displayName });
      }
    });

    // Analisa apenas as colunas configuradas como WIP.
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

    // --- LÓGICA DA MELHORIA 2: AVALIAR OS CARDS SOMENTE NAS COLUNAS WIP ---
    allWipCards.forEach(card => {
      applyCardAlarm(card, isHighlightActive);
    });
    // -----------------------------------------------------------------------------
    
    // REGRA DE NEGÓCIO FINAL (WIP): por pessoa especial, os cards spa* contam como 1 bloco.
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

    // Envia todas as variáveis construídas para a função desenhar a tela
    displayWip(finalWip, limit, columnsBreakdown, isDetailsActive);
  });
}

// ============================================================================
// 3. CRIAÇÃO VISUAL DO INDICADOR E PAINEL DE GARGALOS
// ============================================================================
// Recebe o WIP atual, o Limite, o Resumo das Colunas e se o usuário quer usar o clique
function displayWip(current, limit, breakdown, isDetailsActive) {
  let indicator = document.getElementById('custom-wip-indicator');
  
  // Cria a "caixinha" caso ela ainda não exista na página
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
    
    // --- LÓGICA MISTA DE MOUSE (ARRASTAR vs CLICAR) ---
    // Precisamos saber se o usuário apenas "clicou" para abrir o painel, ou se ele clicou e "arrastou"
    let isDragging = false;
    let startX = 0, startY = 0, offsetX = 0, offsetY = 0;

    // Quando o mouse afunda no botão...
    indicator.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = false; // Presumimos inicialmente que é um clique simples
      startX = e.clientX;
      startY = e.clientY;
      const rect = indicator.getBoundingClientRect();
      offsetX = rect.left;
      offsetY = rect.top;

      // Passa a observar o mouse se movendo e quando ele é solto
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Se o mouse se mover enquanto segurado...
    function onMouseMove(e) {
      // Se mover mais de 5 pixels, decretamos que foi um arrasto (ignora tremidinhas)
      if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
        isDragging = true;
      }
      
      // Calcula a nova posição, limitando pelas beiradas da tela
      let newLeft = offsetX + (e.clientX - startX);
      let newTop = offsetY + (e.clientY - startY);
      const maxLeft = window.innerWidth - indicator.offsetWidth;
      const maxTop = window.innerHeight - indicator.offsetHeight;
      
      indicator.style.left = Math.min(Math.max(newLeft, 0), maxLeft) + 'px';
      indicator.style.top = Math.min(Math.max(newTop, 0), maxTop) + 'px';
      indicator.style.transform = 'scale(1)'; 
    }

    // Quando o mouse for solto...
    function onMouseUp(e) {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Se NÃO foi um arrasto E o botão está autorizado a receber cliques (Toggle 1 ativado)
      if (!isDragging && indicator.dataset.clickable === "true") {
        const panel = document.getElementById('wip-details-panel');
        if (panel) {
          // Inverte o display (esconde se estiver visível, mostra se estiver escondido)
          panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        }
      }
    }

    document.body.appendChild(indicator);
  }

  // Controle visual: Se puder clicar, vira 'mãozinha', se não puder, vira ícone de 'mover'
  indicator.dataset.clickable = isDetailsActive;
  indicator.style.cursor = isDetailsActive ? 'pointer' : 'move';

  // Garante que será visível (para tratar o bug de sumir no Roadmap)
  indicator.style.display = 'block';

  applyWipIndicatorState(indicator, current, limit, isDetailsActive, breakdown);
}

function startBoardObservation() {
  // Só começa a observar quando o body já existe, evitando falha no primeiro carregamento.
  if (!document.body) {
    window.addEventListener('load', startBoardObservation, { once: true });
    return;
  }

  observer.observe(document.body, { childList: true, subtree: true });
  bootstrapBoardRender();
}

function bootstrapBoardRender(attempt = 0) {
  // Faz pequenas tentativas até o Azure terminar de montar o board sem exigir F5.
  updateWipBoard();

  const hasBoardHeaders = document.querySelectorAll('.kanban-board-column-header').length > 0;
  if (hasBoardHeaders || attempt >= 10) {
    return;
  }

  setTimeout(() => bootstrapBoardRender(attempt + 1), 500);
}

function ensureBoardMounted() {
  // O Azure monta a board de forma assíncrona; aqui repetimos a tentativa até os headers existirem.
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
// 4. OBSERVERS E GATILHOS INICIAIS
// ============================================================================

// O MutationObserver vigia a página "escondido". 
// Se alguém mover um card ou editar um responsável, ele detecta.
let observerTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(observerTimeout);
  // O atraso de 300ms garante que ele não trave o navegador calculando centenas de vezes durante um movimento de mouse
  observerTimeout = setTimeout(updateWipBoard, 300);
});

// Listener Extra: Se a pessoa alterar as opções de Equipe ou Checkboxes no Popup, 
// este aviso chega até aqui e a página atualiza as cores/limites imediatamente, sem precisar dar F5.
chrome.storage.onChanged.addListener(() => {
  updateWipBoard();
});

// A primeira função executada ao carregar a página
function init() {
  startBoardObservation();
}

// Verifica se o navegador está ocupado carregando. Se sim, espera; se não, roda direto.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('pageshow', () => {
  ensureBoardMounted();
});