# Daily Commitment — T1.4 (Card Picker) report

> Escopo: substituir a entrada manual `id: coluna` (textarea) por uma interface
> visual de seleção de work items, integrada ao Daily Commitment existente. O
> snapshot-store, o commitment engine (T1.3) e as regras de comparação foram
> REUTILIZADOS, não reimplementados. Semântica de WIP inalterada, Manifest V3
> preservado, correção R1 do MutationObserver intacta. Nenhum commit ou push foi
> feito por esta tarefa.

## 1. Verificação de estabilidade (antes de mexer no runtime)

| # | Verificação | Resultado |
|---|---|---|
| 1 | Li `AGENTS.md`, roadmap, `ARCHITECTURE.md`, `TEST_STRATEGY.md`, relatórios T1.2/T1.3 | Feito |
| 2 | Rodei a suíte completa antes das mudanças | **128 testes passam** (`node --test`) |
| 3 | Integridade do Manifest V3 | `manifest_version: 3`, JSON válido, permissão `storage` + host_permissions intactas |
| 4 | Correção R1 ainda válida | `withObserverPaused()` + `setIndicatorHtml()` presentes e inalterados; observer ainda observa `document.body` com `{ childList: true, subtree: true }` |
| 5 | Mudanças conferidas por diff | Árvore de trabalho limpa no início; edições revisadas |

## 2. Arquivos modificados / adicionados

| Arquivo | Mudança |
|---|---|
| `src/features/daily/commitment-picker.js` | **Adicionado.** View-model puro, sem Chrome e sem DOM (`WIPBoardCommitmentPicker`): `buildColumnOptions` (colunas reais do board, em ordem de fluxo, de-duplicadas), `buildPickerRows` (merge snapshot base + board atual + compromisso salvo), `filterRows` (busca por id/título, tolerante a acento/caixa), `buildExpectationsFromSelection` (converte a seleção visual no mapa de expectativas do engine; rejeita item sem destino; colapsa id duplicado), `summarizeSelection` (resumo do planejamento). Não reimplementa store/engine/comparação; só modela dados para a UI. |
| `manifest.json` | `content_scripts[].js` passa a carregar `src/features/daily/commitment-picker.js` antes de `content.js`. |
| `content.js` | Textarea `id: coluna` substituída por lista pesquisável com checkbox + dropdown de destino por card, resumo do planejamento, botões "Escolher work items", "Salvar compromisso" e "Planejado x realizado". Novo estado em memória do picker, handlers de abertura/render/seleção/busca, helpers de escape HTML, binding do módulo `CommitmentPicker`, CSS do picker e strings EN/PT. Nenhuma conta de WIP tocada. |
| `docs/PRODUCT_ROADMAP.md` | T1.4 reescrita (textarea → card picker) com status; T1.5 (Projected Board) adicionada como próximo incremento. |
| `test/commitment-picker.test.js` | **Adicionado.** 20 testes do view-model e integração com engine/store. |
| `test/commitment-picker-r1.test.js` | **Adicionado.** 3 testes de regressão R1 para a nova UI (modelo comportamental + asserção estática sobre `content.js`). |

## 3. Como a UI funciona (fluxo)

1. **Base** — o último snapshot capturado (T1.2) define o conjunto de work items
   que podem ser comprometidos e a `startColumn` de cada um (coluna no momento do
   planejamento).
2. **Exibição** — `buildPickerRows` cruza a base com o board ao vivo
   (`WIPBoardReader`) para mostrar id, título, responsável e coluna atual. Item na
   base que sumiu do board é mantido na lista e marcado "fora do board" (nunca
   assumido como concluído).
3. **Destino** — `buildColumnOptions` lê as colunas reais do board (ao vivo, com
   fallback para as colunas do snapshot), em ordem de fluxo, para o dropdown.
4. **Seleção** — checkbox por card; escolher um destino também marca o item
   (intenção explícita). O resumo ("Selecionados X de Y · Z com destino") atualiza
   ao vivo; itens selecionados sem destino são sinalizados.
5. **Salvar** — `buildExpectationsFromSelection` → `buildCommitmentItems` (T1.3) →
   `store.saveCommitment` / `store.reviseCommitment`. Re-salvar no mesmo board vira
   revisão (histórico preservado), não duplicata.
6. **Planejado x realizado** — reusa `compareCommitment` (T1.3) contra o board
   atual, com badges por item e resumo.

## 4. Como as regras de negócio são honradas

- **Associado a data/board/snapshot base.** O compromisso é salvo pelo store, que
  embute org/projeto/time/board na chave e grava `baseSnapshotId`. Boards e dias
  não se misturam (mesmo resolver de escopo do snapshot).
- **Não altera o Azure DevOps.** O picker só lê o modelo do board e escreve em
  `chrome.storage.local`. Nada edita um work item.
- **Coluna inicial = momento do planejamento.** `startColumn` vem do snapshot
  base, não do board atual.
- **Destino explícito.** Seleção sem coluna de destino é rejeitada no
  `buildExpectationsFromSelection` (reportada como `no-destination`).
- **Adicionar/remover antes de salvar.** Checkbox e dropdown por card; nada é
  persistido até o clique em Salvar.
- **Revisão não apaga o original.** `reviseCommitment` arquiva o plano anterior em
  `revisions`.
- **Sem duplicidade.** Id duplicado na seleção é colapsado e reportado; o store
  também de-duplica por id.
- **Não perde dados ao recarregar.** Persistência em `chrome.storage.local`; ao
  reabrir o picker, o compromisso salvo pré-seleciona e pré-preenche os destinos.
- **Snapshot incompleto tratado com honestidade.** Item ausente do board aparece
  "fora do board"; nunca é inferido como entregue.
- **Bilíngue.** Toda label, placeholder, status e resumo têm EN e PT.
- **R1 preservado.** Ver §6.

## 5. Testes executados

Comando: `node --test` (single-run; o `npm test` do projeto).

Resultado: **151 testes passam, 0 falham** (128 anteriores + 20 + 3 novos).

`test/commitment-picker.test.js` cobre: opções de coluna dinâmicas (ordem de
fluxo, de-dup, fallback); linhas do picker (campos de exibição, ordenação pelo
fluxo); snapshot incompleto / item fora do board / item novo não injetado /
id duplicado colapsado; busca por id e por título (acento/caixa); consulta e
edição de plano existente (pré-seleção/pré-preenchimento); resumo da seleção;
conversão da seleção em expectativas (destino obrigatório, duplicata); integração
real com engine (T1.3) e store (salvar → consultar → revisar → comparar);
isolamento entre boards; higiene do módulo (sem DOM, sem Chrome, sem innerHTML).

`test/commitment-picker-r1.test.js` cobre: re-renders do picker roteados por
`withObserverPaused` não geram registros observados (mudança externa real ainda
é observada); asserção estática de que `content.js` envolve o render do picker em
`withObserverPaused`, faz diff-guard do resumo e mantém `setCommitmentOutput` via
`setIndicatorHtml`; e que as primitivas R1 e a config do observer seguem no
arquivo.

## 6. Verificação específica da correção R1 (MutationObserver)

A nova UI é mais pesada em escrita que a antiga: a lista re-renderiza a cada tecla
na busca e a cada toggle de seleção. A lista fica dentro de `document.body`, que o
observer observa. Para não reintroduzir o loop R1:

- `renderPickerList` escreve o `innerHTML` da lista DENTRO de
  `withObserverPaused()` (disconnect → write → reconnect no próximo microtask).
- `updatePlanSummary` faz diff-before-write e também escreve dentro de
  `withObserverPaused()`.
- `setCommitmentOutput` continua passando pelo diff-guard `setIndicatorHtml`.
- `withObserverPaused`, `setIndicatorHtml` e a config `{ childList: true, subtree:
  true }` permanecem inalterados.

Provado por `test/commitment-picker-r1.test.js` (zero registros observados em uma
sequência de re-renders) e pela suíte R1 existente (`test/mutation-observer-r1.test.js`),
ambos verdes.

## 7. Riscos identificados

- **Título ausente no snapshot base.** O store não persiste `title`. O picker
  busca o título no board ao vivo; se o item sumiu do board, a linha fica sem
  título (mostra "(sem título)"). Aceitável e honesto, mas depende do board atual.
- **Seletores de DOM do Azure.** O título/coluna/responsável vêm do
  `WIPBoardReader`, que depende da marcação do Azure (risco já documentado em
  `AGENTS.md`). Mudança de markup pode afetar o que o picker exibe (não a
  persistência nem a comparação, que usam id estável).
- **Um compromisso por board no painel.** Re-salvar é revisão; múltiplos
  compromissos concorrentes por board existem no store mas não na UI (igual T1.3).
- **Validação em Chrome real pendente.** A suíte automatizada não dirige um Chrome
  vivo contra o Azure. Ver §8.

## 8. Checklist de validação em Chrome real (PENDENTE, NÃO executado)

- [ ] Carregar a extensão em `chrome://extensions` sem erros de console.
- [ ] Em um board configurado, o painel de snapshot mostra a sub-seção
      "Compromisso diário (planejado x realizado)" com o botão "Escolher work items".
- [ ] Capturar um snapshot; clicar "Escolher work items" lista os work items do
      snapshot base com id, título, responsável e coluna atual.
- [ ] O dropdown de destino mostra as colunas reais do board, em ordem.
- [ ] Buscar por id e por (parte do) título filtra a lista; busca vazia mostra tudo.
- [ ] Marcar vários cards e escolher destinos; o resumo atualiza ao vivo e alerta
      quando há item selecionado sem destino.
- [ ] Clicar "Salvar compromisso" reporta a contagem; salvar de novo reporta
      revisão (histórico preservado).
- [ ] Reabrir "Escolher work items" pré-seleciona os itens e pré-preenche os
      destinos do compromisso salvo (consulta/edição).
- [ ] Recarregar a página e reabrir: o compromisso persiste (não se perde).
- [ ] "Planejado x realizado" lista cada item com esperado → atual e badge
      (atingiu/aquém/além/indefinido/sumiu) + resumo.
- [ ] Item removido do board aparece "fora do board" na seleção e "sumiu" na
      comparação (nunca como entregue).
- [ ] Alternar idioma (EN/PT) relabela toda a UI do picker sem perder a seleção.
- [ ] Um compromisso de um board/time não aparece em outro.
- [ ] O número de WIP e o comportamento do indicador seguem inalterados; uma única
      mudança externa no board dispara exatamente um recálculo (R1 intacto), mesmo
      enquanto o usuário digita na busca do picker.

> Nenhuma afirmação de teste em Chrome real é feita aqui; o checklist acima é o
> registro explícito do que falta.

## 9. Próximo incremento previsto

**T1.5 — Projected Board:** a partir do compromisso salvo + board ao vivo, renderizar
o estado esperado do board ao final do expediente (cada item comprometido na sua
coluna de destino), reutilizando o view-model do picker e o engine de comparação.
Read-only, sem alterar o Azure DevOps.
