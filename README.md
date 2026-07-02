# Azure DevOps - WIP do Board

Extensão Chrome para acompanhar o WIP de um board do Azure DevOps com foco na aba `Maintenance/Features`. Ela soma o WIP das colunas configuradas, mostra um indicador fixo no topo da tela e, opcionalmente, destaca cards com sinais de atenção.

## O que esta extensão faz

A extensão lê o board do Azure DevOps, identifica as colunas de WIP configuradas e calcula o total atual. Com isso, ela exibe um indicador visual com o limite definido pelo usuário. Também pode mostrar um painel com o detalhamento por coluna e marcar cards que merecem atenção por `Aging` ou `Target Date`.

## Como funciona hoje

- O popup salva a configuração do limite de WIP.
- O popup também salva o nome do board, as colunas WIP e a lista de pessoas especiais.
- O content script roda somente na URL do board configurado no `manifest.json` e valida o board configurado no storage.
- O indicador principal aparece fixo no topo da página e mantém animação própria quando o WIP encosta no limite.
- O painel detalhado mostra o subtotal das colunas de WIP.
- Os cards podem receber alerta visual quando entram em faixa crítica.

## Configuração disponível

No popup é possível definir:

- Tamanho da equipe, usando a fórmula `2 x equipe + 1`.
- WIP direto, como um número fixo.
- Mostrar ou ocultar o painel de detalhamento por coluna.
- Ativar ou desativar o destaque visual dos cards.
- Ativar ou desativar a regra especial das pessoas configuradas.
- Informar o nome do board.
- Informar as colunas que entram no cálculo do WIP.
- Informar a lista de pessoas especiais que recebem a regra de WIP reduzido.

## Regras atuais de negócio

- O cálculo do WIP considera apenas as colunas:
  - Desenvolvimento
  - Ready to CR
  - Code Review
  - Ready to HO
  - HO
- A regra especial é aplicada a uma lista configurável de pessoas e vem ativada por padrão.
- O indicador do topo muda de cor quando o limite é excedido e ganha um estado animado diferente quando encosta no limite.
- Os cards destacados passam a usar gradação visual por faixa de risco.
- Cards com tag `#BLCK` são ignorados pelo alarme visual dos cards.

## Melhorias já pensadas ou em andamento

- Tornar o alarme dos cards mais evidente e gradual por faixa.
- Melhorar a leitura visual do destaque laranja, que hoje pode ficar discreta em alguns temas do Azure.
- Separar ainda mais a lógica de leitura do Azure em funções menores, se o projeto crescer.

## Bugs e riscos observados

- A leitura das colunas depende do texto do `aria-label` do Azure DevOps; se o board mudar o nome das colunas, o cálculo pode parar de bater.
- A leitura dos campos de card depende de classes internas do Azure, o que pode quebrar após mudanças da interface.
- A identificação de `#BLCK` depende do formato em que a tag é exibida dentro do card.
- O `manifest.json` ainda restringe a extensão ao board `Sda.Arms` e às rotas do `Maintenance/Features`.
- A validação de board configurável depende de o texto do board aparecer na URL atual.
- A validação do popup ainda é básica e pode ser refinada para melhorar a experiência do usuário.

## Sugestões de evolução técnica

- Adicionar validação mais explícita no popup para colunas vazias ou nomes inválidos.
- Separar cálculo de WIP, regras de destaque e renderização em funções menores.
- Adicionar um pequeno conjunto de testes manuais de regressão com boards reais.
- Evoluir o filtro de board para algo menos dependente do texto completo da URL, se o Azure mudar o padrão.

## Como carregar a extensão

1. Abra o Chrome em modo de desenvolvedor.
2. Vá em `chrome://extensions`.
3. Clique em `Carregar sem compactação`.
4. Selecione esta pasta do projeto.
5. Acesse o board do Azure DevOps configurado e abra o popup da extensão.

## Observação importante

Este projeto foi feito com foco em segurança operacional: primeiro preservar o comportamento existente, depois melhorar a experiência visual e a configurabilidade. Se o Azure DevOps alterar suas classes internas, pode ser necessário ajustar o seletor dos elementos da página.
