# Azure DevOps - WIP do Board

Extensão Chrome para acompanhar o WIP de um board do Azure DevOps com foco na aba `Maintenance/Features`. Ela soma o WIP das colunas configuradas, mostra um indicador fixo no topo da tela e, opcionalmente, destaca cards com sinais de atenção.

## O que esta extensão faz

A extensão lê o board do Azure DevOps, identifica as colunas de WIP configuradas e calcula o total atual com base nos cards visíveis no board. Com isso, ela exibe um indicador visual com o limite definido pelo usuário. Também pode mostrar um painel com o detalhamento por coluna e marcar cards que merecem atenção por `Aging` ou `Target Date`.

## Como funciona hoje

- O popup salva a configuração do limite de WIP.
- O popup também salva o nome do board, as colunas WIP e a lista de pessoas especiais.
- Na primeira abertura, o popup pergunta se o usuário deseja carregar uma configuração padrão recomendada.
- Sem essa escolha (ou sem salvar), a extensão não assume presets ocultos no cálculo.
- O content script roda somente na URL do board configurado no `manifest.json` e valida o board configurado no storage.
- O indicador principal aparece fixo no topo da página e mantém animação própria quando o WIP encosta no limite.
- O painel detalhado mostra o subtotal das colunas de WIP.
- O painel detalhado aplica contraste próprio no estado crítico para manter legibilidade quando o indicador estiver vermelho pulsante.
- Os cards podem receber alerta visual quando entram em faixa crítica.
- A inicialização tenta novamente logo após o carregamento para evitar depender de F5 quando o Azure ainda está montando o board.
- A inicialização faz algumas tentativas curtas até o board aparecer e também reage ao retorno da página pela cache do navegador.

## Configuração disponível

No popup é possível definir:

- Tamanho da equipe, usando a fórmula `2 x equipe + 1`.
- WIP direto, como um número fixo.
- Mostrar ou ocultar o painel de detalhamento por coluna.
- Ativar ou desativar o destaque visual dos cards.
- Ativar ou desativar a regra especial das pessoas configuradas.
- Informar o nome do board.
- Informar as colunas que entram no cálculo do WIP.
- Informar a lista de pessoas especiais que recebem a regra de WIP reduzido por tag `spa`.
- Opcionalmente carregar os valores padrão recomendados e ajustar antes de salvar.

## Regras atuais de negócio

- O cálculo do WIP considera apenas as colunas configuradas no popup. Se não houver customização, usa o padrão:
  - Desenvolvimento
  - Ready to CR
  - Code Review
  - Ready to HO
  - HO
- A regra especial é aplicada por pessoa configurada e vem ativada por padrão.
- Para cada pessoa especial, se houver um ou mais cards com tag `spa` (ex.: `#Spa.Ui`, `#Spa.Api`), todos os cards `spa` dessa pessoa contam como 1 no WIP.
- Cards da mesma pessoa especial sem tag `spa` continuam contando normalmente.
- O indicador do topo muda de cor quando o limite é excedido e ganha um estado animado diferente quando encosta no limite.
- Os cards destacados passam a usar gradação visual por faixa de risco.
- Cards com tag `#BLCK` são ignorados pelo alarme visual dos cards.

## Melhorias já pensadas ou em andamento

- Tornar o alarme dos cards mais evidente e gradual por faixa.
- Melhorar a leitura visual do destaque laranja, que hoje pode ficar discreta em alguns temas do Azure.
- Separar ainda mais a lógica de leitura do Azure em funções menores, se o projeto crescer.

## Bugs e riscos observados

- A leitura dos campos de card depende de classes internas do Azure, o que pode quebrar após mudanças da interface.
- A identificação de `#BLCK` e de tags `spa` depende do formato em que as tags são exibidas/carregadas no board.
- O `manifest.json` ainda restringe a extensão ao board `Sda.Arms` e às rotas do `Maintenance/Features`.
- A validação de board configurável depende de o texto do board aparecer na URL atual.
- A extração de tags `spa` usa fallback em dados serializados da página quando o campo `Tags` não está visível no card.

## Sugestões de evolução técnica

- Adicionar validação mais explícita no popup para colunas inválidas com preview das colunas encontradas no board.
- Separar cálculo de WIP, regras de destaque e renderização em funções menores.
- Adicionar um pequeno conjunto de testes manuais de regressão com boards reais.
- Evoluir o filtro de board para algo menos dependente do texto completo da URL, se o Azure mudar o padrão.
- Avaliar persistência de configuração por time/projeto para suportar mais de um board com perfis distintos.

## Como carregar a extensão

1. Abra o Chrome em modo de desenvolvedor.
2. Vá em `chrome://extensions`.
3. Clique em `Carregar sem compactação`.
4. Selecione esta pasta do projeto.
5. Acesse o board do Azure DevOps configurado e abra o popup da extensão.

## Observação importante

Este projeto foi feito com foco em segurança operacional: primeiro preservar o comportamento existente, depois melhorar a experiência visual e a configurabilidade. Se o Azure DevOps alterar suas classes internas, pode ser necessário ajustar o seletor dos elementos da página.
