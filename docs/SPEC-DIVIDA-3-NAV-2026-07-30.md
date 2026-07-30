# SPEC — Dívida #3: 3 mecanismos de voltar / premissa de caminho único (2026-07-30)

> **STATUS (2026-07-30, pós-execução): EXECUTADO e AUDITADO.** Implementado em `00b430b`
> (Sonnet, mesma sessão após PARE correto no gatilho do CACHE — 2ª exceção autorizada na
> variante dinâmica). Auditoria aprovada na mesma data: app.js com exatamente as 3 edições
> do spec, skill com a Rodada 4, suíte nova verify-nav-graph 23 OK (RED 6 conforme previsto),
> verify-back-float 95 OK / 0 FAIL (100% verde pela 1ª vez desde v41 — pino de CACHE agora
> dinâmico, formato cardapio-vN + piso ≥40), 7 suítes / 536 asserções / 0 falhas, CACHE
> v46→v47 no mesmo commit. Os 2 furos descritos abaixo estão FECHADOS — o texto segue no
> tempo original da especificação.

Base: commit `db8ec9f` (HEAD = origin/main), CACHE v46, 5 suítes verdes (418). Linhas citadas =
este commit. Decisões do dono (2026-07-30): escopo = furos + trava + skill (sem unificação);
edições cirúrgicas AUTORIZADAS em 2 asserções de verify-back-float-2026-07-25.js: (a) pino do
ternário backDestLabel (L143-145); (b) pino de CACHE_NAME (L223, RED desde v41 — quebrou 6
bumps seguidos) → vira leitura dinâmica do sw.js com formato cardapio-vN e piso N>=40, mesma
solução prescrita na fila para as suítes da frente visual. Nota de método: este segundo item
foi achado pela SESSÃO EXECUTORA no gatilho de PARE (baseline da suíte divergiu), não pela
preparação — baseline de toda suíte listada no pathspec passa a ser item obrigatório do
gabarito do autor.

## 1. Medição — os 3 mecanismos

| Mecanismo | Onde | Regra |
|---|---|---|
| M1 destino calculado | back-float hub→Home (605); categoria→grupo dono/Home (1937-1942); fallback receita→categoria (3811) | grafo estático embutido no call site; assume caminho único de entrada |
| M2 fromHash (origem exata) | produzido em toda lista de cards via currentHashPath (grupo 634, categoria 2224, busca 2649, minhas-receitas 3529, literal "home" 1084); consumido em renderReceita 3810 (`Router.navigate(fromHash)`) e na cadeia cozinhar (4141/4185/4202/4650) | voltar = navegar pra origem inteira (path+query), reproduz filtros; colapso do router evita duplicata |
| M3 histórico nativo + espelho | router.js 144-246 (navHistoryStack/cursor/pendingSelfNav; colapso via history.go(-1)) | botão físico/gesto; resync no hashchange |

Dependentes de M2 reproduzir o hash exato: scrollPositionsByHash (4822) e as fotos de estado
(grupoFacetState/categoryFacetState/grupoSearchQuery/minhasReceitasTab).

A premissa de caminho único está documentada 2x (skill product-navigation-ux, "pai estrutural
e único conta como cumprir a regra"; comentário app.js 1914 "confirmado por grep" — grep
humano, uma vez) e travada 0x. Censo real em db8ec9f: `Router.toHome(` 4, `Router.toGrupo(` 4,
`Router.toCategoria(` 4 (renderCollectionCard 530; tiles Home massas 1042 / sobremesas 1045;
fallback receita 3811 — todos canônicos, premissa VERDADEIRA hoje), `Router.toReceita(` 7,
`Router.toCozinhar(` 2, `createBackFloat(` 4 (1 declaração + hub/categoria/receita).

## 2. Furos (contrato violado hoje)

- **Lista de Compras (3324):** `Router.toReceita(entry.recipeId)` SEM fromHash → abrir a
  receita pelo nome na lista e tocar Voltar cai na CATEGORIA da receita, não na lista.
- **Preparos (2899):** `Router.toCozinhar(session.recipeId)` SEM fromHash → a cadeia
  cozinhar→receita→Voltar perde a origem e cai na categoria.

Os "4 caminhos de volta" documentados na skill (categoria/busca/minhas-receitas/home) devem
ser 6 — lista-compras e preparos ficaram de fora quando ganharam links de receita. As rotas
existem no parseHash (router.js 132-140); nada no router muda.

## 3. Desenho (escopo aprovado)

- **S1 — fechar os furos:** 3324 → `Router.toReceita(entry.recipeId, "lista-compras")`;
  2899 → `Router.toCozinhar(session.recipeId, "preparos")` (retomada ignora portion, fromHash
  propaga pela cadeia interna que já usa a variável). renderReceita: derivar
  `fromListaCompras`/`fromPreparos` (indexOf === 0, mesmo padrão de fromMinhasReceitas) e
  inserir os 2 elos no ternário de `backDestLabel` após fromHome, antes do fallback `cat`.
- **S2 — edição cirúrgica autorizada (única na suíte legada):** verify-back-float L143-145 —
  atualizar o literal pinado do ternário para a cadeia de 6 elos + o label da asserção.
  Diff bruto obrigatório no relatório. NADA mais naquela suíte.
- **S3 — trava executável:** suíte nova `scripts/verify-nav-graph-2026-07-30.js` — censo do
  grafo (toHome 4, toGrupo 4, toCategoria 4 com âncoras de contexto, toReceita 7, toCozinhar 2,
  createBackFloat 4), origem OBRIGATÓRIA (`Router\.toReceita\([^,)]*\)` e
  `Router\.toCozinhar\([^,)]*\)` === 0 ocorrências — hoje 1+1, é o RED), literais dos 2 call
  sites novos, 6 elos no ternário, fallback 3811 preservado, rotas preparos/lista-compras
  presentes no parseHash. Qualquer call site novo de navegação passa a QUEBRAR a suíte —
  a premissa vira invariante que grita, não comentário.
- **S4 — skill no mesmo commit:** product-navigation-ux/SKILL.md — 4→6 caminhos; premissa de
  caminho único formulada como invariante TRAVADA com ponteiro pra suíte nova; instrução: call
  site novo de navegação → rodar a suíte → atualizar censo E decidir mecanismo de volta
  conscientemente.

## 4. Pinos que sobrevivem sem edição (inventariados)

verify-back-float: `if (fromHash) Router.navigate(fromHash);`, fallback
`else Router.toCategoria(...)`, seções 8/9/10/11 (grupo/categoria/cozinhar/raízes) — intocados
pelo fix. verify-recentes-ui L100 (`Router.toReceita(item.id, "home")` literal) — intocado.
protein-search-nav seções de colapso (sandbox de router) — comportamento inalterado.
Frente visual (untracked): não pina as regiões tocadas (verificado por grep).

## 5. Fora de escopo (registrado)

- Unificação dos 3 mecanismos (categoria/grupo com fromHash): gatilho = nascer o 2º caminho
  real de entrada de coleção. A suíte nova é exatamente o alarme desse gatilho.
- router.js: nenhuma linha.
- Aceite: 6 suítes verdes (41/20/104/206/47 + nova), CACHE v46→v47 no mesmo commit,
  commit único com pathspec explícito, sem push.
