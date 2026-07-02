// content.js

// ============================================================================
// 1. CONFIGURAÇÃO VISUAL DE ALERTA E PAINEL (CSS)
// ============================================================================
// O código abaixo cria um "estilo" (CSS) e injeta na página do Azure DevOps.
// Ele controla as animações chamativas e o painel oculto de gargalos.
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
      border: 3px solid #c2410c !important;
      box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.35) !important, 0 0 18px rgba(194, 65, 12, 0.28) !important;
      background: linear-gradient(90deg, rgba(194, 65, 12, 0.24), rgba(255, 255, 255, 0)) !important;
      animation: pulse-card 1.4s infinite !important;
    }
    .card-alerta-alto {
      border: 3px solid #ea580c !important;
      box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.26) !important, 0 0 12px rgba(234, 88, 12, 0.18) !important;
      background: linear-gradient(90deg, rgba(234, 88, 12, 0.18), rgba(255, 255, 255, 0)) !important;
    }
    .card-alerta-medio {
      border: 3px solid #f97316 !important;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.22) !important, 0 0 10px rgba(249, 115, 22, 0.14) !important;
      background: linear-gradient(90deg, rgba(249, 115, 22, 0.14), rgba(255, 255, 255, 0)) !important;
    }
    .card-alerta-baixo {
      border: 3px solid #fb923c !important;
      box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.18) !important;
      background: linear-gradient(90deg, rgba(251, 146, 60, 0.1), rgba(255, 255, 255, 0)) !important;
    }
    
    /* Layout do Painel de detalhes que vai abrir ao clicar no indicador (Melhoria 1) */
    #wip-details-panel {
      display: none; /* Começa escondido */
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(0,0,0,0.1); /* Linha sutil separando o título do painel */
      font-size: 13px;
      font-weight: normal;
      text-transform: none;
      text-align: left;
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

function getDefaultWipColumns() {
  // Mantém o comportamento padrão atual caso o usuário não configure colunas.
  return ["Desenvolvimento", "Ready to CR", "Code Review", "Ready to HO", "HO"];
}

function getBoardContext(data) {
  // Normaliza as opções salvas no popup em um único ponto de leitura.
  return {
    isHighlightActive: data.highlightCards !== false,
    isDetailsActive: data.showDetails !== false,
    currentBoardName: (data.boardName || 'Sda.Arms').trim(),
    colunasWip: (Array.isArray(data.wipColumns) && data.wipColumns.length
      ? data.wipColumns
      : getDefaultWipColumns()).map(column => column.toLowerCase().trim()),
    isCaioRuleActive: data.caioRuleEnabled !== false,
    specialPeople: Array.isArray(data.specialPeople) && data.specialPeople.length
      ? data.specialPeople
      : ['Caio'],
  };
}

function isAllowedBoard(currentBoardName) {
  // Garante que o indicador só seja renderizado quando a URL atual corresponder ao board desejado.
  return window.location.href.includes(currentBoardName);
}

function getColumnCards(columnBodies, wipColumnIndexes) {
  // Pega apenas os cards das colunas que fazem parte do cálculo de WIP.
  const cards = [];
  columnBodies.forEach((columnContainer, index) => {
    if (!wipColumnIndexes.has(index)) return;
    cards.push(...columnContainer.querySelectorAll('.wit-card'));
  });
  return cards;
}

function applyWipIndicatorState(indicator, current, limit, isDetailsActive, breakdown) {
  // Monta o estado visual do WIP total sem depender de reload.
  let titleHTML = '';
  let panelHTML = '';

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
      const colorStyle = col.count >= 5 ? 'color: #cc292b;' : '';
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
  chrome.storage.sync.get(['useEquipe', 'equipeSize', 'directWip', 'showDetails', 'highlightCards', 'caioRuleEnabled', 'boardName', 'wipColumns'], (data) => {
    
    // --- Lógica do Limite ---
    let limit = null; // Iniciamos vazio para identificar se a pessoa ainda não configurou
    
    if (data.useEquipe === true && data.equipeSize) {
      limit = (2 * data.equipeSize) + 1; // Calcula a fórmula
    } else if (data.useEquipe === false && data.directWip) {
      limit = data.directWip; // Usa o fixo
    }

    const { isHighlightActive, isDetailsActive, currentBoardName, colunasWip, isCaioRuleActive, specialPeople } = getBoardContext(data);
    
    let totalCards = 0; // Soma bruta
    let caioCards = 0;  // Soma exclusiva do responsável que vale apenas 1
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

    // Analisa cada coluna individualmente...
    headers.forEach((header, index) => {
      // Pega o nome da coluna no HTML (aria-label), remove espaços mortos e transforma em minúsculo
      const rawName = header.getAttribute('aria-label') || '';
      const columnName = rawName.toLowerCase().trim();
      
      // Se a coluna faz parte do cálculo...
      if (colunasWip.includes(columnName)) {
        
        let colTotal = 0; // Cards dessa coluna específica
        
        // 1. Procuramos o número total que o próprio Azure mostra ao lado do título
        const countSpan = header.querySelector('.board-column-item-count');
        if (countSpan) {
          colTotal = parseInt(countSpan.textContent, 10) || 0;
          totalCards += colTotal; // Joga na soma geral
        }

        // Guarda o nome da coluna e o número dela para usarmos no painel (Melhoria 1)
        columnsBreakdown.push({ name: rawName, count: colTotal });

        // 2. Usamos a 'posição' (index) para achar os cards que pertencem a esta mesma coluna
        const columnContainer = columnBodies[index];
        if (columnContainer) {
          // Buscamos apenas nomes contidos na coluna
          const assignees = columnContainer.querySelectorAll('.identity-display-name span');
          assignees.forEach(span => {
            const name = span.textContent.trim().toLowerCase();
            // Se encontrar a palavra-chave, adicionamos +1 na conta do responsável especial
            if (isCaioRuleActive && specialPeople.some(person => name.includes(person.toLowerCase()))) {
              caioCards++;
            }
          });
        }
      }
    });

    // --- LÓGICA DA MELHORIA 2: AVALIAR OS CARDS SOMENTE NAS COLUNAS WIP ---
    const wipColumnIndexes = new Set();
    headers.forEach((header, index) => {
      const rawName = header.getAttribute('aria-label') || '';
      const columnName = rawName.toLowerCase().trim();
      if (colunasWip.includes(columnName)) {
        wipColumnIndexes.add(index);
      }
    });

    // Pré-filtra os cards para reduzir o trabalho da análise visual.
    const allCards = getColumnCards(columnBodies, wipColumnIndexes);

    allCards.forEach(card => {
      applyCardAlarm(card, isHighlightActive);
    });
    // -----------------------------------------------------------------------------
    
    // REGRA DE NEGÓCIO FINAL (WIP): O Caio vale apenas 1
    let finalWip = totalCards;
    // Se o Caio tiver algum card e a regra estiver ligada, nós retiramos a contagem dele do montante e adicionamos somente 1.
    if (isCaioRuleActive && caioCards > 0) {
      finalWip = totalCards - caioCards + 1;
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
  // Passa a observar o corpo do site
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Tenta rodar. Se o Azure ainda estiver processando o quadro, espera 1 segundo e tenta de novo.
  if (document.querySelectorAll('.kanban-board-column-header').length > 0) {
    updateWipBoard();
  } else {
    setTimeout(updateWipBoard, 1000);
  }
}

// Verifica se o navegador está ocupado carregando. Se sim, espera; se não, roda direto.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}