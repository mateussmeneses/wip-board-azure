// popup.js

// O evento 'DOMContentLoaded' garante que este script só vai rodar depois 
// que toda a telinha do popup (o HTML) estiver carregada e pronta na tela.
document.addEventListener('DOMContentLoaded', () => {
  // 1. CAPTURA DOS ELEMENTOS DA TELA
  // Buscamos os campos de texto, botões e caixas de mensagem pelo ID deles no HTML
  const equipeInput = document.getElementById('equipeSize');
  const directWipInput = document.getElementById('directWip');
  const toggleDetails = document.getElementById('toggleDetails');
  const toggleHighlight = document.getElementById('toggleHighlight');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  const errorMsg = document.getElementById('error-msg');

  // 2. CARREGAMENTO DOS DADOS SALVOS
  // Ao abrir o popup, perguntamos ao navegador se o usuário já havia salvo algo antes
  chrome.storage.sync.get(['equipeSize', 'directWip', 'useEquipe', 'showDetails', 'highlightCards'], (data) => {
    
    // Se existir configuração e foi escolhida a Equipe, preenchemos o input da Equipe
    if (data.useEquipe === true && data.equipeSize) {
      equipeInput.value = data.equipeSize;
    }
    // Se existir configuração e foi escolhido Direto, preenchemos o input Direto
    if (data.useEquipe === false && data.directWip) {
      directWipInput.value = data.directWip;
    }
    
    // Lógica dos Botões (Toggles) das Melhorias:
    // Se a propriedade existir no banco (não for 'undefined'), marca o checkbox de acordo com o que foi salvo.
    // Se for a primeira vez da pessoa, os checkboxes ficarão ativados por padrão (pois estão com 'checked' no HTML).
    if (data.showDetails !== undefined) {
      toggleDetails.checked = data.showDetails;
    }
    if (data.highlightCards !== undefined) {
      toggleHighlight.checked = data.highlightCards;
    }
  });

  // 3. EXPERIÊNCIA DO USUÁRIO (UX) - EVITANDO CONFLITOS
  // Se a pessoa começar a digitar no campo 'Equipe', apagamos automaticamente o campo 'Direto'
  // e escondemos qualquer mensagem de erro vermelha que estivesse na tela.
  equipeInput.addEventListener('input', () => { 
    directWipInput.value = ''; 
    errorMsg.style.display = 'none'; 
  });
  
  // Fazemos a mesma coisa caso ela digite no campo 'Direto'
  directWipInput.addEventListener('input', () => { 
    equipeInput.value = ''; 
    errorMsg.style.display = 'none'; 
  });

  // 4. AÇÃO DE SALVAR
  // Quando o botão "Salvar Configuração" for clicado:
  saveBtn.addEventListener('click', () => {
    // Criamos um objeto que vai guardar as decisões do usuário
    let config = { 
      useEquipe: null, 
      equipeSize: null, 
      directWip: null,
      showDetails: toggleDetails.checked,     // Salva se o usuário quer ver o painel (true/false)
      highlightCards: toggleHighlight.checked // Salva se o usuário quer os cards piscando (true/false)
    };

    // Se o campo de equipe estiver preenchido, configuramos o objeto para a fórmula matemática
    if (equipeInput.value) {
      config.useEquipe = true;
      config.equipeSize = parseInt(equipeInput.value, 10);
    } 
    // Senão, se o campo direto estiver preenchido, configuramos o objeto para usar o número fixo
    else if (directWipInput.value) {
      config.useEquipe = false;
      config.directWip = parseInt(directWipInput.value, 10);
    } 
    // Se AMBOS os campos de limite estiverem vazios, bloqueamos o salvamento e mostramos aviso em vermelho
    else {
      errorMsg.style.display = 'block';
      return; // O 'return' interrompe a função, impedindo que salve vazio
    }

    // Salva o objeto preenchido no "banco de dados" de extensões do Google Chrome
    chrome.storage.sync.set(config, () => {
      // Exibe a mensagem de sucesso verdinha
      status.style.display = 'block';
      // Esconde a mensagem de sucesso automaticamente após 2.5 segundos (2500 milissegundos)
      setTimeout(() => { status.style.display = 'none'; }, 2500);
    });
  });
});