# SPEC — Dívida #2: proteinRole paralelo ao facetState (2026-07-30)

> **STATUS (2026-07-30, pós-execução): EXECUTADO e AUDITADO.** Implementado em `19a6243`
> (Sonnet, sessão dedicada), auditoria aprovada na mesma data: diff conferido hunk a hunk
> contra este spec (7 hunks, 51 linhas, nada além), suíte nova
> `scripts/verify-protein-role-unify-2026-07-30.js` com 47 OK, 5 suítes / 418 asserções /
> 0 falhas, CACHE v45→v46 no mesmo commit. Os Bugs A e B descritos abaixo estão FECHADOS —
> o texto segue no tempo original da especificação (pré-implementação), como registro da
> decisão e da medição.

Base: commit `a441b92`, CACHE v45, 4 suítes verdes (371). Linhas citadas = este commit.
Decisões do dono (2026-07-30): hub PASSA a recortar resultados por papel; recorte vale para
block1 + block2 + scopedTotal; globalTotal segue SEM papel (transferência já vai com role=null).

## 1. Medição — os 3 consumidores hoje

| Tela | Valida no init | opts.proteinRole | Aplica nos resultados | Re-valida no × de chip |
|---|---|---|---|---|
| renderGrupo | 723–730 (cópia 1) | 782–794 | **NÃO — Bug A** | **NÃO — Bug B** (843–851) |
| renderCategory | 1987–1994 (cópia 2) | 2151–2164 | applyRoleAndNature 2093–2102, via currentItems 2113–2122 | **NÃO — Bug B** (2295–2304) |
| renderBusca | 2392–2395 (cópia 3) | 2551–2564 | 2621–2625 | imune (× remonta a rota → init re-valida) |

Modal (renderFacetModal) já é único e correto: rascunho 1388, aplicação 1465, auto-zera o
rascunho quando a última proteína sai DENTRO do modal (pino protein-search-nav L476).
Persistência já unificada: fotos grupoFacetState 732 / categoryFacetState 2004–2011
(+ URL: categoria 1997, busca 2466/2765). A dívida restante é a REGRA DE VALIDADE em 3 cópias
+ nenhum caminho de mutação reusa a regra + o hub perdeu o elo de aplicação.

## 2. Bugs (gabarito calculado nos dados reais em a441b92)

**Bug A — hub promete papel e não recorta.** runSearch do hub (951–992) nunca lê proteinRole.
Hub Proteínas + faceta Frango: groupUniverse 367 → filtrado 36 → Principal **29** / Secundário
**7** (29+7=36). O botão diz "Ver resultados (29)"; a lista mostra 36. Badge conta +1 (1372).

**Bug B — papel fantasma no × de chip.** França (country, sem S implícito): base 83; +frango =
6 (Principal 4 / Secundário 2). Usuário com Secundário ativo tira o chip Frango → S=[] →
splitByProteinRole devolve secondary=[] → **lista zera (0 de 83) sem causa visível**; com
Principal fantasma o filtro fica inerte (primary=items) com badge/URL mentindo. Persiste na
foto e na URL; só cura re-entrando (init re-valida). Invariante violada:
`proteinRole ∈ {focus, secondary} ⇒ activeProteinTagIds(estado commitado) ≠ ∅`.

## 3. Desenho

- **S1 — helper único** `validProteinRole(candidate, facetState, collection)` no nível do
  módulo, ao lado de activeProteinTagIds (218–222): candidate fora de {focus, secondary} → null;
  senão candidate se `activeProteinTagIds(facetState, collection).length > 0`, senão null.
  As 3 cópias de init viram 1 linha cada, mesmo comportamento.
- **S2 — re-validação nos ×**: nos handlers de × (categoria 2295+, hub 843+), re-atribuir
  proteinRole via helper ANTES de syncUrl/persistState. commitChip não precisa (só adiciona
  tag). Modal não precisa (L476 já cobre o rascunho). Torna a invariante verdadeira por
  construção em todos os caminhos.
- **S3 — hub aplica papel**: em runSearch, entre a montagem de out (965–983) e scopedTotal
  (984): se papel ativo, recortar out.block1 e out.block2 por splitByProteinRole com
  S = activeProteinTagIds(facetState, null). scopedTotal sai recortado por consequência;
  globalOut/globalTotal intactos (pino busca-unificada L572: transferência com role=null).
- **S4 — suíte NOVA** `scripts/verify-protein-role-unify-2026-07-30.js` (TDD: RED antes):
  tabela-verdade do helper executada; gabarito literal do hub (367/36/29/7) recomputado via
  TagModel; França 83/6/4/2; censo `validProteinRole(` = 6 ocorrências (1 declaração + 3 inits
  + 2 ×); recorte presente no corpo de runSearch (block1 E block2); negativos: `const savedRole`
  e `const roleCandidate` ausentes de app.js, renderBusca segue sem `proteinRole: null,`.

## 4. Pinos de suíte (o que NÃO pode mudar) — zero edição em suíte legada

- applyRoleAndNature permanece LOCAL a renderCategory, com `TagModel.splitByProteinRole(`
  literal no escopo (protein-search-nav L482; busca-unificada L936).
- renderBusca mantém `TagModel.splitByProteinRole(` no escopo (L490) e sem literal
  `proteinRole: null,` (L489).
- runSearch do hub preserva os literais: `facetStateToTagIds(facetState, GENERIC_FACET_DEFS)`,
  `baseTagIds: baseTagIds, ingredientMode: ingredientMode, scopeIds: groupRecipeIds`,
  `facetUniverse(baseTagIds, ingredientMode)` (busca-unificada L381/386/390) e contagem
  `runSearch(` === 3 no escopo do grupo (grupo-fromhash L91). O recorte S3 só ADICIONA linhas.
- renderFacetModal intocado (pinos L80/96/153/476).
- Aceite: 4 suítes legadas verdes (371) + suíte nova verde; CACHE v45→v46 no mesmo commit
  (regra CLAUDE.md: push que toca app.js exige bump no sw.js).

## 5. Fora de escopo (registrado, não fazer agora)

- Absorver a variável proteinRole num objeto de estado unificado por tela (fase 2 da dívida,
  se um 4º consumidor aparecer; custo alto em pinos de fatiamento, benefício marginal pós S1–S3).
- Os 3 literais opts.proteinRole {value, setValue, computeCounts}: variação essencial
  (universo por tela; nature só na categoria) — ficam.
- Ranking identidade/natureza na busca (item 6 da fila, adiado pelo dono).
