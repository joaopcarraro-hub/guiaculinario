---
name: mobile-recipe-ui
description: Revisar e melhorar UI mobile-first de cards, home, páginas de grupo, listagens, filtros, chips, busca e página da receita.
---

# Mobile Recipe UI

Use esta skill quando o trabalho envolver interface mobile do app de receitas.

## Princípio central

A interface deve ajudar o usuário a decidir rápido o que cozinhar.

Mobile primeiro. Desktop depois.

## Home (Bloco 2, Fase 2.2)

A home deve ser simples e guiada.

Mostrar só, nesta ordem:
- 4 tiles grandes: Massas, Proteínas, Navegar por Países, Sobremesas.
- "Mais categorias" — entrada pequena, num canto, ABAIXO dos tiles (era acima, invertido numa
  rodada de correção — só troca de ordem de appendChild, mesmo comportamento). Ganhou pill
  visual (mesmos tokens do `.filter-trigger`: borda `--color-border`, fundo `--color-surface`,
  `border-radius: 999px`) porque a versão só-texto parecia não-clicável — antes ficava
  invisível como elemento interativo. Texto continua em `--color-text-secondary`, nunca
  `--color-accent` (texto pequeno, falha WCAG AA); o ÍCONE (não o texto) usa `--color-accent`
  — ícone não tem a restrição de ghost-text que texto pequeno tem.
- Carrossel "Vistas recentemente" — condicional, só quando o histórico não está vazio, DEPOIS
  do bloco de categorias acima (ver parágrafo "Como era vs. como ficou" abaixo — posição corrigida
  2026-07-26, era antes dos tiles na primeira leva).

Sem contador de progresso ("X de Y receitas já feitas") — removido, era resíduo do sistema
antigo de tracking, redundante nesta tela.

**Como era vs. como ficou (correção, item 4 do roadmap-mestre CHECKLIST-GERAL.md):** esta seção
dizia, sem exceção, "sem busca livre e sem atalhos de Favoritos/Quero fazer/Histórico na home".
Isso CONTINUA valendo pra busca livre e pra Favoritos/Quero fazer — nenhum dos dois ganhou
atalho na home, seguem só na barra de navegação inferior. Deixou de valer só pra "Histórico": um
carrossel "Vistas recentemente" (mini-card com foto 16:9 + nome em até 2 linhas, nada além
disso — sem país, sem meta, sem coração) foi aprovado e implementado na home, DEPOIS do bloco de
categorias (tiles + "Mais categorias") — posição corrigida 2026-07-26 (julgamento visual do
dono), a primeira leva tinha colocado antes dos tiles. Não é um retorno do antigo atalho
genérico de histórico — é um componente próprio e CONDICIONAL: ausente por completo (nem título
nem trilho) quando `Storage.getRecentlyViewed()` está vazio, nunca aparece "quebrado" ou em
branco. Lê esse mesmo `Storage.getRecentlyViewed()` (dado já rastreado desde antes, só faltava
UI) via `buildRecentlyViewedSection()` em `js/app.js`; scroll horizontal por CSS puro
(`overflow-x`/`scroll-snap-type: x mandatory`, sem nenhum JS de carrossel), ~3 cards inteiros +
fatia do 4º visíveis em 390px. A separação do bloco de categorias pro carrossel é só espaçamento
(`.recent-views` `margin-top: var(--space-6)`) — a antiga linha horizontal ali era a borda
COMPARTILHADA de `#progress` (elemento único, reusado por toda tela; fica vazio na home), zerada
só pra home via `#recipes-content:has(.home-view) ~ #progress`, sem tocar a regra base nem
nenhuma outra tela. Clique navega com `fromHash="home"` literal — contrato público e
documentado (ver "Botão Voltar" em `product-navigation-ux/SKILL.md`), nunca `currentHashPath()`
(que devolve `""`, falsy, na home — faria o back-float da receita cair na categoria em vez de
voltar pra Home). Spec visual completa (dimensões, tokens, estados) em docs/DESIGN-TOKENS.md
("Componentes"); suíte versionada em `scripts/verify-recentes-ui-2026-07-25.js`.

Cada tile grande deve ter:
- ícone outline monocromático (`--color-text-primary`) + label
- área de toque grande (mín. 120px de altura)
- cartão `--color-surface`, raio 20px, borda `--color-border`
- visual limpo, sem excesso de chips ou contadores

Tiles/entrada "Mais categorias"/barra inferior usam os tokens novos (docs/DESIGN-TOKENS.md)
diretamente (`--color-*`). Desde o Bloco 4, o resto do app (página de categoria, dropdowns,
cards de receita) também é tema escuro — só que via os tokens ANTIGOS redefinidos no `:root`
de `css/style.css` (`--bg`/`--ink`/`--gold`/etc. com os NOMES mantidos, mas valores apontando
pros mesmos hex do tema escuro). Não há mais inconsistência visual entre blocos — o app é
100% escuro. Ver "Reskin escuro (Bloco 4)" abaixo pro detalhamento.

## Barra de navegação inferior

Fixa, 5 abas (Home / Pesquisar / Minhas Receitas / Preparos / Lista de Compras), fundo
`--color-bg-secondary`. Aba ativa: ícone + label em `--color-accent`. Inativas:
`--color-text-disabled`. Sem FAB — não é um padrão deste app.

4 das 5 abas usam o sistema de ícones outline compartilhado (`ICON_SVG_ATTRS`/`ICONS` em
app.js — stroke-based, viewBox 24x24, `fill="none"`). "Preparos" é exceção: ícone autoral
próprio (`icons/preparos.svg`, panela de cabo único), formato de traço preenchido
(`fill="currentColor"`), fora do sistema compartilhado — embutido como string própria
(`PREPAROS_ICON_SVG` em app.js), nunca via `fetch()`/`<img src>`, mesmo padrão anti-race-
condition do `EQUIPMENT_SVG_MARKUP`. Visualmente indistinguível do resto (mesmo tamanho
22x22px via `.bottom-nav__icon`, mesma troca de cor ativo/inativo via `currentColor`).

## Minhas Receitas (aba da barra inferior)

Deixou de ser placeholder — é uma tela real (`renderMinhasReceitas` em app.js), com 2 abas em
memória (sem navegação de rota): Favoritas (`Storage.getAllFavorites()`) e Já Feitas
(`Storage.getAllMade()`). Alternar aba só troca a variável de módulo `minhasReceitasTab` e
re-renderiza a mesma tela — não empilha histórico nem muda `location.hash`. Cada aba lista com
`renderRecipeCard` (sem adaptação nenhuma, já funcionava standalone antes disso) e tem sua
própria mensagem de vazio; nenhuma aba mostra contador comparativo com a outra.

As antigas rotas standalone `#/favoritos` e `#/historico` (e `Router.toFavoritos`/
`toHistorico`) foram REMOVIDAS — não tinham nenhum link visível apontando pra elas (só
acessíveis digitando a URL direto), e depois desta tela existir teriam virado caminho
redundante mostrando os mesmos dados de novo. `LIST_VIEWS`/`renderListView` também saíram do
app.js. Acessar `#/favoritos` ou `#/historico` agora cai no fallback padrão do router (`{ name:
"home" }`), mesmo tratamento que `#/quero-fazer` já recebe.

"Histórico de receitas vistas" (visita real à tela de receita, distinto de "já feita") não
existe — a antiga entrada `historico` de `LIST_VIEWS` só reaproveitava `Storage.getAllMade()`
com outro rótulo, sem nenhum rastreamento de visita de verdade. Construir isso de verdade exige
infraestrutura nova (gravar cada visita à tela de receita) — fora do escopo desta rodada,
fica pra quando for aprovado como tarefa própria.

O bloco de créditos de ícones (`buildIconCreditsEl`) que ficava no fim desta tela foi REMOVIDO
por completo (função, `content.appendChild` e o CSS `.icon-credits`) — confirmado que nenhum
ícone em uso hoje exige atribuição obrigatória (SVG Repo é CC0, atribuição recomendada mas não
obrigatória; Icons8 já tinha sido removido antes). Sem cabeçalho de tela nem créditos, a tela
de Minhas Receitas mostra só o toggle de abas e a listagem.

## Lista de Compras (aba da barra inferior)

Deixou de ser placeholder — Fase 1 trouxe a visão "Por receita" e Fase 2 trouxe "Geral"
(`renderListaCompras` em app.js, as 2 abas já funcionam). Botão "Adicionar à lista de compras"
na tela de receita (`.action-btn`, 3ª ação —
ver seção de ações acima) adiciona TODAS as entries de `ingredientsStructured` de uma vez,
capturando o `portionMultiplier` atual do stepper (mesmo padrão de `currentRatio()` que o
botão "Começar preparo" já usava). Clicar de novo com a receita já na lista só ressincroniza
(porção/entries/`addedAt` atualizados) — não existe remover 1 receita pela tela de receita,
só de dentro da própria Lista de Compras: "Limpar lista" remove tudo (receitas E o registro
de comprados) e cada seção por receita também tem seu próprio "x" (`.preparo-card__delete`
reaproveitado, `Storage.removeRecipeFromShoppingList`) pra remover só aquela receita.

**"Limpar lista" — passada visual F1c (2026-07-30, achado do dono: "quase tudo vermelho e
redondo").** Visível SEMPRE que a lista não estiver vazia (ausência real do elemento, nunca
opacidade/disabled) — o limiar antigo de MAIS de 10 receitas morreu, era indescobrível (a
maioria das listas nunca chegava lá). Rebaixado visualmente de pill cheia (borda+texto
`--color-error`, competia como se fosse ação primária da tela) pra texto/ghost discreto
(`.shopping-list__clear`: sem borda, sem fundo, só `color: var(--color-error)` — mesma família
estrutural de `.text-link`, min-height 44px direto, sem precisar de `::after` já que não há
mais pill a preservar). Sai do bloco empilhado sozinho e entra no canto do cabeçalho: novo
wrapper `.shopping-list__header` (flex) contém as abas (`.shopping-list__tabs`, sem nenhuma
mudança de estilo — `flex:1` pra dividir o espaço com o botão) e "Limpar lista" lado a lado.
Continua sem `window.confirm` — a rede de segurança virou um toast de desfazer: clicar executa
o clear NA HORA (`Storage.clearShoppingList()`, tela já mostra vazio) + `showShoppingUndoToast`
reusa a infraestrutura visual/pointer-events do `.update-toast` (2 classes no elemento —
`update-toast` de graça pro CSS, `shopping-undo-toast` como marcador PRÓPRIO na whitelist de
`body { pointer-events: none }` (mesmo mecanismo do modal de Filtros, ver comentário em
`css/style.css` perto de `body { pointer-events: none; }`) — sem isso o toast novo renderiza
mas fica com clique morto, causa conhecida).
Auto-some em 6s; "Desfazer" chama `Storage.snapshotShoppingList()`/`restoreShoppingListSnapshot`
(clone JSON de `{recipes, boughtKeys}` tirado ANTES do clear) e só re-renderiza a tela se o
usuário ainda estiver em Lista de Compras (`Router.current().name === "lista-compras"`) —
navegar pra outra aba enquanto o toast existe não troca o conteúdo visível por baixo do
usuário quando ele volta e clica Desfazer depois. `scripts/verify-lista-compras-ui-2026-07-30.js`
prova a restauração com execução real (valores literais, não só contagem) e a auditoria
sistêmica de `scripts/verify-filter-modal-pointer-events-2026-07-26.js` (todo
`document.body.appendChild` precisa de cobertura na whitelist) ganhou suporte a elemento com
MÚLTIPLAS classes nessa mesma rodada — a checagem antiga só testava a string composta inteira,
nunca batendo pra um `className` com espaço.

Gap da linha de receita (`.shopping-list__recipe-row`, nome-link + chevron + "x") subiu de
`--space-1` (4px) pra `--space-2` (8px) — medido ao vivo na Fase A de F1c, apertado pros 3
controles. Abas (`.shopping-list__tab`) e o "x" por receita (`.preparo-card__delete`)
confirmados JÁ no padrão certo (aba: borda+fundo neutros, accent-soft só quando ativa, nunca
pill; "x": neutro por padrão, `--color-error` só no hover) — nenhum dos dois mudou nesta
rodada. Checkboxes de ingrediente (`accent-color: var(--color-accent)`, sólido quando marcado)
tampouco mudaram — identificados na Fase A como outro contribuinte real pro "vermelho" da
tela (chega a 40+ simultâneos numa lista grande), mas fora do escopo desta rodada por decisão
explícita do dono ("checkboxes e linhas mantêm o comportamento funcional intocado").

Cada seção por receita (`.shopping-list__recipe`) tem 3 controles na mesma linha
(`.shopping-list__recipe-row`), com áreas de toque DELIBERADAMENTE desiguais — colapsar é a
ação mais usada, navegar/excluir são situacionais: o clique de colapsar/expandir é ouvido na
LINHA INTEIRA (`row.addEventListener("click", ...)`, reaproveita o acordeão
`.filter-section`/`.is-open` do modal de filtros), cobrindo até o espaço vazio ao redor do
nome e o ícone do chevron (`.shopping-list__recipe-chevron` não tem listener próprio — um
clique nele só borbulha até o da linha; ter os 2 disparava a ação 2x no mesmo clique). O nome
da receita (`.shopping-list__recipe-name-link`, classe compartilhada `.text-link` — mesmo
padrão do nome clicável no cabeçalho do modo cozinhar, `.cook-title__link`, ver
product-navigation-ux/SKILL.md — SEMPRE navega pra `Router.toReceita`) e o "x" de excluir
usam `stopPropagation()` nos próprios listeners pra manter a área de toque PEQUENA e precisa
(só a extensão visual de cada um) e nunca também colapsar a linha. Os 3 continuam
independentes entre receitas diferentes.

Schema `gusta-lista-compras-v1` segue o MESMO padrão de 2 níveis de `gusta-preparos-v1`
(`SHOPPING_LIST_MIGRATIONS` mapa vazio desde a v1, validação individual por receita que
descarta só a entrada malformada) — projetado com migração desde o início, não como remendo
depois. `selectedEntries` guarda só os ÍNDICES das linhas de `ingredientsStructured`
escolhidas, nunca copia texto/qty/unit — a exibição sempre resolve contra a receita de
verdade, reaproveitando `formatStructuredItem` (mesma função do multiplicador de porções)
pra escalar pelo `portionMultiplier` salvo.

"Comprado" NÃO é por receita: `boughtKeys` é um registro único e compartilhado, chaveado por
"item normalizado + unit" (`normalizeShoppingKey` em storage.js — trim + lowercase do texto do
item, concatenado com a unidade). Marcar um ingrediente numa receita reflete em QUALQUER outra
seção que tenha o mesmo item+unit, mesmo vindo de uma receita diferente — o checkbox nunca
guarda estado próprio da receita. Cada marcação re-renderiza a tela inteira
(`renderListaCompras()` de novo), mesmo princípio simples já usado em `renderMinhasReceitas`
ao trocar de aba, garantindo que toda ocorrência do mesmo ingrediente atualize junto.

Toggle no topo (Por receita / Geral, `.shopping-list__tabs`, mesmo padrão visual das abas de
Minhas Receitas) alterna a variável de módulo `listaComprasView` e re-renderiza — mesmo
princípio de `minhasReceitasTab`.

Visão "Geral" (Fase 2, `buildShoppingListGroups` em app.js): percorre TODAS as entries
selecionadas de TODAS as receitas da lista e agrupa por (item normalizado + família de
unidade, quando a unidade tem família — ou item+unidade exata, quando não tem), somando
qty/qtyRange já escalado pelo `portionMultiplier` de CADA receita. Famílias:
- Peso (grama/quilograma): conversão trivial por potência de 1000 (`UNIT_TO_BASE_FACTOR`).
- Volume (mililitro/litro/colher-sopa/colher-cha/xícara): tabela fixa de equivalência
  culinária (colher-sopa=15ml, colher-cha=5ml, xícara=240ml, litro=1000ml) — soma tudo
  convertido pra mililitro, depois formata de volta pra litro se o total passar de 1000ml
  (nunca mostra "3000 ml", mostra "3 litros").
- Contagem (dente/folha/talo/etc. + itens sem unidade mas com número, tipo "2 cebolas"): soma
  direta, SEM conversão nenhuma, só dentro do mesmo par item+unidade exato — a família entra
  na chave de agrupamento, então peso e volume NUNCA se misturam, mesmo com o item de nome
  idêntico (2 linhas separadas nesse caso, nunca consolidado — densidade não é confiável,
  decisão da investigação anterior).
Itens com `qtyRange` somam limite inferior e superior separadamente (ex.: "8-10" + "2" vira
"10-12") — funciona porque todo grupo acumula lo/hi desde o início (item exato: lo=hi=valor),
sem tratamento especial pra faixa. Grupo sem quantidade numérica nenhuma (~28% do acervo, ex.
"a gosto") aparece só como nome + "usado em: Receita A, Receita B", sem número (nunca inventa
quantidade). Formatação reaproveita `formatStructuredItem` com um item sintético (o total já
somado, `ratio=1`) — mesma função do multiplicador de porções, sem duplicar lógica de
pluralização/fração.

Checkbox "comprado" na visão Geral representa TODOS os pares item+unit originais daquele
grupo de uma vez (`pairs` em cada grupo) — marcado só quando todos já estão em `boughtKeys`;
clicar alterna todos juntos via `Storage.isShoppingItemBought`/`toggleShoppingItemBought`
(as MESMAS funções da visão Por receita, nunca um estado próprio) — testado marcando um item
compartilhado (mesma unidade em 2 receitas) na visão Geral e confirmando refletido nas 2
seções da visão Por receita, e vice-versa.

## Página de grupo

Cada grupo deve ter:
- botão voltar
- título
- descrição
- busca contextual
- opções internas do grupo

Exemplo de Proteínas:
- Aves
- Carnes bovinas
- Suínos
- Peixes
- Frutos do mar
- Ovos

Cada card de opção mostra só UM número total ("N receitas") — sem split "X de foco · Y no
total" (resíduo do antigo sistema de Foco/Também leva, redundante com o dropdown "Papel da
proteína" já disponível um clique depois) e sem "X/Y feitas" (contador de progresso removido).
Card compartilhado por todos os hubs (renderCollectionCard em app.js) — mudar aqui muda em
todos de uma vez.

A busca nessa página filtra as opções (categorias/coleções) exibidas por nome — e também
mostra receitas que batem em tags de ingrediente (ingredient:/contains:), escopadas às
coleções deste grupo, numa seção separada da lista de opções (ex.: "Categorias" e "Receitas
com [termo]"). Nunca traz receita de fora do grupo atual.

## Botão de limpar busca (item 2, 2026-07-28)

Inventário confirmou só 2 barras de busca de texto reais no app inteiro (o input numérico do
timer, `.cook-timer-display__edit-input`, não conta): `.home-search` (busca contextual desta
página de grupo, acima) e `.tagsearch-input` (busca global, aba Pesquisar). O "modal de países"
citado num pedido antigo não existe como algo à parte — o hub Países usa exatamente a MESMA
`.home-search` de qualquer outro grupo, só troca o placeholder.

Helper único (`attachSearchClear(input, wrap, onClear)` em app.js) injeta um botão circular
`.search-clear-btn` (36px, ícone `iconSvg("close")` já existente da Fase 0c, mesma família visual
de `.preparo-card__delete`) dentro de um wrapper `position: relative` (`.home-search-wrap` já
existia; `.tagsearch-input-wrap` é novo — a busca global nunca teve wrapper próprio antes).
Escondido por padrão (`display: none`), aparece (`.is-visible`) só quando `input.value` não é
vazio — sincronizado no listener `"input"` do próprio helper, não duplica a lógica de busca de
cada tela. Clique: zera o valor, refoca o campo, esconde o botão de novo, e dispara
`input.dispatchEvent(new Event("input"))` — reaproveita o listener de busca QUE JÁ EXISTE em cada
tela (debounce da busca global incluso) em vez de duplicar a lógica de re-render aqui. Hit-area
36px + `::after{inset:-5px}` = 46px efetivos (mesma fórmula de `.preparo-card__delete`), acima do
mínimo de 44px. `aria-label="Limpar busca"` via `setAttribute` (mesmo padrão de
`createBackFloat`/`createExitCookFloat`, não HTML literal). `padding-right` dos 2 inputs cresceu
pra 50px fixo — espaço reservado pro botão mesmo escondido, texto digitado nunca reflui de
largura ao aparecer/sumir o botão.

## Vitrine da Pesquisar (F1b, 2026-07-30)

Estado de query/tags vazios de `renderBusca` (dentro de `renderResults`, ver
`product-navigation-ux/SKILL.md` "Tela Pesquisar" pra arquitetura/rotas completas) — substitui a
mensagem estática antiga por 5 seções, `.pesquisar-vitrine` como wrapper, cada
`.pesquisar-vitrine__section` controlando seu próprio `margin-bottom` (ritmo entre seções, mesma
convenção já usada na página de receita: cada elemento cuida do espaço DEPOIS de si, nunca
margin-top concorrente). Título de cada seção reusa `.tagsearch-group-label` (mesmo rótulo
pequeno/uppercase já usado pelos grupos de tags populares) — zero CSS novo pros títulos.

- **Buscas recentes (`.busca-recente-chip`)** — mesma linguagem visual de `.tag-chip--selected`
  (pílula, fundo `--color-accent-deep`), mas 2 `<button>` IRMÃOS dentro do `<span>` externo em
  vez de 1 só: `.busca-recente-chip__label` (reexecuta) e `.busca-recente-chip__remove` (some só
  aquela entrada). Botão dentro de botão é HTML inválido — por isso 2 controles independentes em
  vez do truque de `e.stopPropagation()` num alvo aninhado que o app usa em outros pontos pro
  mesmo tipo de problema (ex. coração dentro do card de receita). Hit-padding assimétrico (mesmo
  princípio já documentado pro par +/- do `.portion-stepper`): o rótulo expande só verticalmente
  (`inset: -4px 0`, nunca invade o × vizinho), o × expande nas 3 bordas livres e ZERO na borda
  compartilhada com o rótulo (`inset: -6px -6px -6px 0`) — os 2 chegam a ~44-46px efetivos sem
  ambiguar o toque no meio.
- **Momentos (`.momento-card`)** — trilho full-bleed, MESMA técnica de `.recent-views__rail`
  (`width:100vw` + `margin-left:calc(50% - 50vw)`, reconstrói a calha com `padding-left`). Card
  maior que o `.recent-card` de "Vistas recentemente" (representa uma CATEGORIA/atalho, não uma
  receita específica): mídia em `aspect-ratio: 4/3` — a mesma proporção de `.category-card__media`,
  não o 16:9 do mini-card de receita — + nome serif ABAIXO da foto (nunca sobre ela, regra-mãe do
  item 6 do roadmap-mestre). Sem foto mapeada = `.momento-card__media` vazio, fundo
  `--color-surface-elevated`, mesmo fallback tipográfico limpo das 7 coleções órfãs de tempo/
  dificuldade — guarda defensiva pra um Momento futuro sem asset pronto; os 5 atuais têm foto
  (Sobremesas/Vegetarianas reaproveitam o asset que já existia; os outros 3, mini-lote novo,
  `momento-cafe-da-manha.webp`/`momento-rapidas.webp`/`momento-fim-de-semana.webp`).
- **Sugestões de hoje** — reusa `.recent-views__rail`/`.recent-card` (mesmo mini-card, mesma
  técnica full-bleed) SEM classe própria — zero diferença visual da versão da Home. A construção
  do card (`buildMiniRecipeCard(item, fromHash)`) saiu de dentro de `buildRecentlyViewedSection`
  (Home) e virou helper compartilhado — 2 call sites agora, nenhum duplica a criação do elemento
  (mesmo princípio já usado por `createBackFloat`).
- **Todas as categorias** — `.category-grid--compact` (modificador: `repeat(3, 1fr)` fixo, no
  lugar do `repeat(auto-fill, minmax(150px, 1fr))` padrão, que só cabe 2 colunas em ~350px
  úteis). Mesmo `.category-card`/`renderCollectionCard` de sempre, `__title` ganha
  `-webkit-line-clamp: 2` só dentro deste modificador (nomes mais longos, coluna mais estreita).

Estados `:active`/`:focus-visible`/`prefers-reduced-motion` de `.momento-card` e dos 2 botões do
chip de busca recente entram nas MESMAS listas compartilhadas que todo o resto do app já usa
(ver "Reskin escuro (Bloco 4)" abaixo) — nenhuma regra de estado isolada nova.

## Cards de receita mobile

O card mobile deve ser vertical e escaneável.

Regras:
- sem coluna vazia lateral
- título até 2 linhas
- descrição até 2 linhas
- tags limitadas
- metadados com ícone outline + valor (não chip/pill)
- sem CTA nem ações próprias — o card inteiro é a área de toque
- área de toque confortável

### Redesenho completo do card (item 2 do roadmap-mestre) — foto 16:9 + coração flutuante + nome/1 chip

O card descrito nas rodadas anteriores desta seção (sem ações/CTA, header em grid, meta de
rodapé) morreu por completo nesta rodada — não foi ajuste, nasceu um card novo. Spec fechada e
números (dimensões, tokens, contraste calculado) ficam em docs/DESIGN-TOKENS.md ("Componentes"
→ "Card de receita — redesenho completo"); aqui fica o resumo de comportamento.

`renderRecipeCard` (app.js) é a função ÚNICA compartilhada por **6 call sites em 4 telas**
(contagem corrigida nesta rodada — a versão anterior desta skill dizia 5, com 2 erros que quase
se cancelavam: contava 2 call sites em `renderCategory`, quando na verdade é 1 — os "2 modos de
ordenação" apenas re-renderizam a mesma `renderList()` ao trocar de valor, não são 2 pontos
físicos no código — e contava 1 em `renderBusca`, quando na verdade são 3: lista principal
`renderResults()`, preview ao vivo `renderPreviewSection()` [chamada 2x, "Com esses filtros" e
"Mais resultados por texto"] e o fallback de resultados parciais em `renderPreviewResults()`).
Telas: `renderCategory` (categoria/coleção), `renderBusca` (busca global, as 3 acima),
`renderGrupo` (resultado de busca por ingrediente dentro de um hub) e `renderMinhasReceitas`
(aba Minhas Receitas, ver seção própria abaixo). Mudar a função muda as 6 de uma vez, sem
duplicação — e as 6 agora produzem uma estrutura byte a byte idêntica (divergência zero,
protegida por `scripts/verify-card-contract-2026-07-25.js`).

**O que nasceu**: foto sangrando até as bordas do card (`.recipe-card__photo` — o card vira
`position: relative; overflow: hidden`, sem padding próprio; os 2 cantos superiores são
cortados pelo raio do próprio card, a foto não tem raio duplicado) → coração flutuante sobre a
foto (ver parágrafo mais abaixo) → faixa `.recipe-card__body` com `.recipe-card__row` (nome + no
máximo 1 chip na mesma linha, `.recipe-card__name`/`.recipe-card__tag`, `align-items: flex-start`
alinha o chip com a 1ª linha do nome; o chip nunca encolhe — só o nome quebra por baixo, até 2
linhas) e, opcionalmente, `.recipe-card__desc` empilhada abaixo. **Ajuste de julgamento visual no
mesmo dia, depois de ver o card no ar**: a foto era 16:9, virou 2:1 (mostra 67% da altura do
master em vez de 75%, ainda dentro da janela segura do §5 de `CONTRATO-IMAGENS-REDESIGN.md`) pra
abrir espaço pra descrição sem crescer o card — medido em 390px: card foi de 252,75px pra 254px
(quase igual, como previsto), foto de 195,75px pra 174px. Verificação de que nenhum prato corta
em 2:1: inspeção visual de 3 fotos de arquétipo variado (torta rasa, corte alto, tigela funda)
confirmou o alimento sempre entre ~27%-80% da altura, dentro da janela cortada de 16,5%-83,5% —
só fundo (topo) e aba vazia de prato/guardanapo (base) saem. `.recipe-card__row` existe
justamente pra separar nome+chip (uma faixa) da descrição (outra, abaixo) dentro do mesmo
`.recipe-card__body`, que virou bloco simples (sem `display:flex` próprio).

**Ajuste fino do dono, 2ª rodada de revisão no mesmo dia: teto de 1 linha virou teto
DEFINITIVO de 2.** A descrição nasceu com `white-space: nowrap` (1 linha, ellipsis); depois de
ver ao vivo, o dono decidiu por um teto de 2 linhas — mesmo padrão de clamp que
`.recipe-card__name` já usa (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient:
vertical; overflow: hidden`, mais `line-height: var(--leading-snug)`). Continua teto, não piso:
uma descrição curta o bastante pra caber em 1 linha ocupa só 1 linha de altura, sem espaço
reservado — confirmado com texto sintético curto, já que **nenhuma das 398 receitas do acervo
tem descrição curta o bastante pra realmente testar isso ao vivo** (a mais curta, "Affogato",
74 caracteres, já precisa de 2 linhas nos 308px úteis do card — achado ao medir os dados reais
pra este ajuste, não uma limitação da regra). Medido em 390px: card com descrição de 2 linhas
(o caso comum — 379 das 398 receitas, 82 das 83 de França precisam de 2+ linhas) fica em
~272,78px (Béchamel, antes 254px com 1 linha só, +18,78px = 1 linha inteira a mais).

**O que morreu, em TODOS os 6 contextos, sem exceção**: chip de categoria (`opts.catLabel`/
`.cat-chip` — existia em 4 dos 5 call sites antigos, nunca em `renderCategory`; essa já era a
ÚNICA divergência visual do card antigo entre telas, e agora é irrelevante porque o recurso
inteiro saiu), origem/país como texto solto, o badge de contexto de busca
(`.recipe-card-context`/`opts.contextTagId` — já era código morto, nenhum dos 6 call sites
passava `contextTagId`, removido junto por higiene), e a linha de meta com
tempo/complexidade/porções (ver parágrafo "Metadados" mais abaixo, agora histórico). A
descrição morreu na 1ª leva e VOLTOU no ajuste de julgamento visual do mesmo dia (ver acima) —
não é uma exceção à regra "não reabrir decisão fechada", é a própria frente de design revendo o
resultado ao vivo, o processo normal deste projeto. `priorityTagIds`/`TAG_CHIP_PRIORITY`/
`buildTagChipsEl` continuam existindo e em uso — servem também `.recipe-page-tags` (até 8 tags
na página da própria receita), não tocada por esta rodada.

**Regra da tag única (`singleCardTagId`, `js/app.js`)**: tipo-de-prato > proteína > nenhum chip
— NUNCA país, EXCETO quando a tela tem 2+ tags `country:` DISTINTAS ativas no filtro
(`hasMultiCountryFilter`, calculado 1x por render da lista — `selectedFacetTags` em
`renderCategory`, `tagIds` em `renderBusca` — nunca recalculado por card individual). Nesse
caso o chip vira o país da PRÓPRIA receita, SUBSTITUINDO tipo-de-prato/proteína, nunca somando
(disciplina de 1 chip só). `renderGrupo` e `renderMinhasReceitas` não têm noção de filtro de
país nessas telas e nunca fabricam esse override — seguem sempre a prioridade normal. O chip
reaproveita `buildTagChipsEl`/`.tag-chip-link` (pill, borda, `--text-xs`, clicável pra busca
filtrada, `stopPropagation` de sempre) — mesmo padrão visual de sempre, só a quantidade mudou.

Removido do card: os ícones de ação antigos (já feito ✓ / favoritar ★ / quero fazer 🔖,
`.recipe-card-actions`) e a barra de CTA "Ver receita" (`.recipe-card-cta`) como elemento
próprio. O card inteiro continua sendo a área de toque (mesmo
`card.addEventListener("click", ...)` de sempre).

"Quero Fazer" foi REMOVIDO DO APP INTEIRO (não só do card) — não existe mais em nenhuma tela.
Removido de: `LIST_VIEWS["quero-fazer"]` e o bloco `wantBtn`/`isWant` inteiro de `renderReceita`
(app.js); rota `quero-fazer` e a função morta `toQueroFazer` — zero callers antes mesmo da
remoção — (router.js); campo `wantToCook` de ambos os ramos de `load()` e os acessores
`isWantToCook`/`toggleWantToCook`/`getAllWantToCook` do export `window.Storage` (storage.js).
Acessar `#/quero-fazer` agora cai no fallback padrão do router (`{ name: "home" }`), sem erro.
A tela de receita (`renderReceita`) e o card ficaram com só 2 ações: Marcar como feita e
Favoritar. (Atualização Lista de Compras, Fase 1: a tela de receita ganhou uma 3ª ação,
"Adicionar à lista de compras" — `.action-btn` reaproveitado, mesmo formato — mas só ali, o
card continua com as mesmas 2 de sempre, sem 3ª ação.)

Favoritar virou coração (`HEART_ICON_SVG`, definido perto de `iconSvg()` em app.js) — contorno
vazio `--color-text-disabled` parado, preenchido `--color-accent` quando favoritado. É um ícone
"multi-estado" que não usa o sistema genérico `ICON_SVG_ATTRS`/`ICONS` (que tem `fill="none"`
fixo): o preenchimento troca via classe CSS (`.recipe-heart-icon` base + `.is-favorite` no
ancestral controla `fill`/`stroke` via seletor descendente), não via troca de ícone.

No card, o coração é um botão isolado sem texto (`.recipe-card__heart`), sempre no mesmo formato
— só a cor do preenchimento muda com `.is-favorite`.

Na tela de receita (`renderReceita`), o botão de favoritar troca de ESTRUTURA inteira ao
alternar, não só de cor (`renderFavBtn(fav)` em app.js recria `className`+`innerHTML` do
elemento a cada clique):
- Não favoritado: pill igual à de "Marcar como feita" — reaproveita a própria classe
  `.action-btn` (mesma borda/padding/formato, sem inventar uma classe nova), contendo o coração
  em contorno + texto "Favoritar" dentro (`.action-btn` ganhou `display: inline-flex;
  align-items: center; gap: 8px` pra alinhar ícone+texto lado a lado — antes só tinha texto).
- Favoritado: a pill inteira some (troca pra `.recipe-page-heart is-favorite`, sem
  `.action-btn`) — sobra só o ícone preenchido `--color-accent`, sem borda/fundo, mesmo
  tratamento visual do coração do card.
`aria-label` ("Favoritar" / "Favoritado") atualizado a cada troca, nos dois estados, mantendo
acessibilidade pra leitor de tela mesmo quando não há texto visível. O botão "Marcar como feita"
ao lado (`.action-btn`/`.active`) não participa dessa troca de estrutura — continua sempre pill,
só muda o preenchimento via `.active` como antes.

Ordem dos 2 botões na tela de receita: Favoritar primeiro (esquerda), "Marcar como feita" depois
(direita) — só ordem de `appendChild` em `renderReceita`, nenhuma lógica muda.

No card, o coração fica no canto superior direito (mesmo slot onde antes ficava o chevron —
`chevronRight`/`.recipe-card__chevron` foram REMOVIDOS na Fase 0a, não existe mais afordance de
seta). **Redesenho completo desta rodada**: o "canto superior direito" deixou de ser uma célula
de grid (`.recipe-header`, removida) e virou posicionamento flutuante de verdade sobre a foto
(`position: absolute`, mesma linguagem visual do `.chrome-float` — véu `rgba(15, 15, 14, 0.55)`
+ borda 1px `var(--color-border)` — só o tamanho muda, 36px vs. 44px do `.back-float`; hit-area
`::after` de sempre). Contorno parado trocou de `--color-text-disabled` pra
`--color-text-primary` só dentro do card (sobre foto, fundo imprevisível — `--color-text-
disabled` falha o mínimo de contraste 3:1 nesse contexto; `.recipe-page-heart`, sobre superfície
sólida, não precisou do ajuste); estado favoritado continua `--color-accent`, sem mudança. Por
estar dentro de um card inteiramente clicável, o clique no coração precisa de
`e.stopPropagation()` ANTES de alternar o favorito, senão o clique vaza pro
`card.addEventListener("click", ...)` e navega pra receita por engano. Verificado via teste de
hash: clicar no coração NÃO muda `location.hash`; clicar em qualquer outra parte do card (nome,
chip, foto) muda normalmente.

**Histórico, morto no redesenho desta rodada**: o card já teve uma linha de metadados no rodapé
(tempo/complexidade/porções, ícone outline + valor via `.recipe-meta-item`, tokens
`clock`/`gauge`/`bowl` do objeto `ICONS`) e chegou a ter uma rodada experimental que tentou
mover essa linha pra logo abaixo do título (`width: 50%`) — revertida por não ficar boa
visualmente. Toda essa linha (`.recipe-meta`/`.recipe-meta-item`) foi removida por completo
nesta rodada, em TODOS os contextos — os ícones `clock`/`gauge`/`bowl` continuam existindo e em
uso na página da própria receita, só saíram do card. Imagem, título e chips de tag NÃO
continuam como antes — ver a seção "Redesenho completo do card" acima pro estado atual (foto
16:9, nome, no máximo 1 chip com a regra de país).

### Redesenho completo da página de receita (item 1 de "Deixar pro Fable, depois", CHECKLIST-GERAL.md)

**Efeito de foto fixa + folha que desliza por cima.** `.recipe-hero` vira `position: fixed` no
topo do viewport, largura total — `aspect-ratio: 16/9` e `object-position: center bottom`
continuam INTOCADOS (contrato funcional protegido por `scripts/test-foto-local.js`, ver
`docs/CONTRATO-IMAGENS-REDESIGN.md` §6.1/§6.2). `.recipe-page` vira a folha: bleed total
(`width: 100vw` + `margin-left: calc(50% - 50vw)`, escapando do padding de `#main`), fundo
`var(--color-bg)`, cantos superiores arredondados com o token novo `--radius-sheet` (20px).
Camadas resolvidas SEM token novo de z-index: hero e o coração novo (abaixo) usam
`z-index: -1` (bucket negativo, sempre atrás do fluxo normal) — a folha não precisa de
`position`/`z-index` próprio nenhum pra ficar por cima. `margin-top` da folha é DERIVADO (50%
da altura do hero, calculado em `vw`) pra mostrar a metade SUPERIOR da caixa da foto antes de
rolar — o número y∈[25%,62,5%] do `CONTRATO-IMAGENS-REDESIGN.md` §5 já assumia essa
sobreposição de 50%. Sem JS de parallax, sem `backdrop-filter` — só `position: fixed` e fluxo
normal, exatamente como o roadmap pedia. `prefers-reduced-motion` não precisou de regra nova: o
efeito é scroll nativo puro, nada animado pra reduzir. Ver `docs/DESIGN-TOKENS.md`
("Componentes") pra todos os números/fórmulas exatos.

**Coração sobre a foto (`.recipe-hero__heart`)** substitui Favoritar da linha de botões por
completo — mesmo componente visual do coração do card (36px, véu, borda, hit-padding), mas
`position: fixed` + topo-DIREITA (espelha o `.back-float`) em vez de `absolute` sobre um card.
Construído como elemento IRMÃO do hero em `renderReceita` (app.js), nunca filho —
`applyImage()`/`loadRecipeImage()` fazem `hero.innerHTML = ""` de forma assíncrona assim que a
foto resolve, o que apagaria um coração aninhado. Coberto pela folha conforme o usuário rola —
comportamento esperado (mesmo bucket de z-index negativo do hero). `.recipe-page-heart` (a
antiga troca de estrutura `.action-btn` ↔ ícone sólido ao favoritar, vivia dentro de
`.recipe-page-actions`) foi REMOVIDA por completo — Favoritar não é mais uma das ações da linha.

**Funil reordenado:** título → descrição → tags (`.recipe-page-tags`, MOVIDAS pra antes dos
metadados — eram depois) → metadados em blocos → CTA "Começar preparo" (agora ANTES dos 2
secundários — era o inverso) → "Já fiz" + "Adicionar à lista de compras" lado a lado →
Ingredientes (porções + colapso, ver abaixo) → Modo de preparo. Metadados
(`.recipe-page-meta`) viraram blocos rotulados (`.recipe-meta-block`: rótulo uppercase
disabled + valor primary, fundo surface, raio de card) em vez de texto solto com bordas
divisórias — Total/Preparo/Cozimento/Dificuldade, um bloco por dado presente. Porções SAIU
daqui, ver próxima seção.

**Tags da página fecham a exceção de hit-area da Fase 0a** (`.recipe-page-tags .tag-chip-link`
media ~38px efetivos antes, 6px abaixo do alvo de 44px — limitação documentada na época como
"não corrigível sem mudar o visual"). Nesta rodada o layout NASCEU com o alvo resolvido: chip
mais baixo (28px, menor que os 30px de antes) + gap dobrado (16px, era 8px) — o gap maior abre
espaço de sobra pro hit-padding (`::after`, -8px uniforme, ainda a metade do gap — o mesmo
limite seguro de antes) chegar a 44px efetivos sem colidir com o chip da linha quebrada
seguinte. Medido ao vivo via `elementFromPoint`, números no relatório da tarefa.

**Carona:** `-webkit-tap-highlight-color: transparent` (seletor universal `*`) mata o realce
azul nativo de toque em qualquer controle — o `:active` da Fase 0a já cobre o feedback visual
de pressão. `user-select: none` escopado a `button` (controles), nunca em texto de conteúdo.

### Ingredientes: cabeçalho redesenhado, colapso agora é só do chevron

A seção de ingredientes na tela de receita abre EXPANDIDA por padrão (sempre — não lembra
estado entre visitas; `ingSection.className` já inclui `is-open` desde a criação do elemento) —
isso NÃO mudou nesta rodada. O que mudou foi o CABEÇALHO: o antigo botão-pílula grande
"Ocultar ingredientes (N)" (`.ingredients-toggle`, borda 2px `--color-accent`, cobria a linha
inteira como um único botão clicável) foi REMOVIDO por completo. No lugar,
`.ingredients-header` é uma linha discreta — `<h4>Ingredientes (N)</h4>` no mesmo padrão sans
uppercase já usado por `.recipe-page-section h4` (ex. "Modo de preparo") +
`.ingredients-header__controls` (porções, ver seção seguinte) + `.ingredients-collapse-btn`, um
chevron pequeno (24px visual, hit-padding até 44px) que é agora o ÚNICO gatilho de
colapso/expansão (`ingSection.classList.toggle("is-open")`, mesmo mecanismo de sempre, só o
elemento que escuta o clique mudou). Precisa ser só o chevron — não a linha inteira como antes
— porque o stepper de porções mora no mesmo cabeçalho agora, e seus próprios cliques (+/-,
digitar no input) não podem borbulhar pro toggle do acordeão.

Continua reaproveitando literalmente as MESMAS classes CSS do acordeão do modal de filtro
(`.filter-section`/`.filter-section__count`/`.filter-section__chevron`/`.filter-section__body`,
ver "Modal de filtros em acordeão" abaixo) — chevron que gira 180° quando `.is-open`, corpo
escondido via `display:none`/mostrado via `display:flex`. `.filter-section__header` (a classe
do gatilho-botão do modal) deixou de ser reaproveitada aqui de propósito — ela entra na lista
compartilhada de `:active`/cursor:pointer de componentes CLICÁVEIS por inteiro, o que não é
mais o caso deste cabeçalho (só o chevron é clicável agora); `.ingredients-header` é uma classe
própria, só com o layout (flex, espaçamento), sem nenhum dos estados de botão.

MUDANÇA (Lista de Compras, Fase 1): a lista de ingredientes na tela de receita virou SÓ LEITURA
— não tem mais `<input type="checkbox">` nenhum (nem a classe `checklist` no `<ul>`, volta ao
marcador de bullet padrão de `.ingredients-list`). `Storage.toggleIngredient`/
`getCheckedIngredients`/`isIngredientChecked` e o campo `checkedIngredients` de
`cardapio-state-v2` foram REMOVIDOS por completo de storage.js (mesmo tratamento que "quero
fazer" recebeu antes) — marcar item como comprado só existe dentro da tela Lista de Compras
agora, chaveado por ingrediente (item+unit normalizado), não por receita.

### Multiplicador de porções (usa ingredientsStructured)

**Realocado (item 1 de "Deixar pro Fable, depois") pro cabeçalho de Ingredientes
(`.ingredients-header__controls`) — decisão antiga, perto da lista que ele afeta. Morava em
`.recipe-page-meta`, que agora é só os 4 blocos de tempo/dificuldade (ver seção acima); o
mecanismo abaixo não mudou NADA, só o elemento-pai que o contém.** O texto estático "N porções"
(Fase 0c: sem emoji) vira um controle interativo
(`.portion-stepper`: botões −/+ redondos de 30px + `<input type="number">` central + sufixo de
texto) sempre que `parseYieldBase` (app.js) consegue extrair uma base numérica segura do começo
do texto de `recipe.yield` — ex. "4 porções" -> base 4, sufixo "porções"; "4-6 porções" -> base 4
(primeiro número do intervalo), sufixo "porções", o "-6" nunca fica solto no sufixo. Formatos como
"≈ 500 ml", "Para 1 prato", "Conforme a peça" (o número não começa o texto, ou não existe) ficam
de fora de propósito — mostram o yield como texto simples (`.ingredients-yield-text`, mesmo slot
mutuamente exclusivo do stepper), sem controle, em vez de arriscar uma base errada. Isso é uma
decisão de escopo explícita, não uma limitação a corrigir depois.

Mudar o valor recalcula a lista de ingredientes ao vivo (`refreshIngredients()`, re-renderiza só o
`<ul class="ingredients-list">`, sem afetar o estado aberto/fechado do acordeão nem os checkboxes
já marcados — o estado marcado vem sempre do `Storage.getCheckedIngredients`, nunca do DOM
anterior, então sobrevive à re-renderização). A escala usa `recipe.ingredientsStructured` (Fase
2b) — só os campos verdadeiramente numéricos (`qty`, `qtyRange`) são multiplicados pela razão
`porçõesAtuais / porçõesBase`; `item`/`prep`/`alt`/`group` são texto livre e ficam INTOCADOS mesmo
quando contêm números (ex. "cerca de 4 cm de espessura" no prep) — escalar um número solto dentro
de texto livre arriscaria acertar a coisa errada. Itens sem `qty` nem `qtyRange` (ex. "sal a
gosto", referências cruzadas) nunca ganham um número inventado, em qualquer multiplicador.

Formatação do número escalado (`formatQty(value, unit)`) DEPENDE da unidade — corrigido depois de
constatar que a fração "bonita" universal fazia sentido pra utensílio marcado em fração mas não
pra peso/volume nem pra objeto discreto (ninguém fala "1/3 de grama" ou "2/3 de dente de alho"):
- xícara/colher-sopa/colher-cha (instrumento físico marcado em fração): fecha pra fração comum de
  cozinha (1/4, 1/3, 1/2, 2/3, 3/4, tolerância de 4%, número misto tipo "1 1/2" quando a parte
  inteira é maior que zero) quando a parte decimal bate de perto; fora disso cai pra 1 casa
  decimal com vírgula. Comportamento IDÊNTICO ao de antes desta correção, sem mudança nenhuma.
- grama/mililitro (unidade-base de peso/volume): sempre número inteiro, nunca fração, nunca casa
  decimal (ex. 66,67 g escalado vira "67 g", nunca "66 2/3 g" nem "66,7 g").
- quilograma/litro (múltiplo): sempre 1 casa decimal com vírgula (padrão PT-BR já usado no texto
  original, ex. "1,5 kg"), nunca fração (nunca "1 1/2 kg").
- Contagem (dente, folha, talo, fatia, ramo, pedaço, filé, fio, disco, fava, posta, pacote, lata,
  e qualquer item sem unidade mas com número, tipo "2 cebolas" — na prática, qualquer unidade que
  não caia nos 2 grupos acima): só aceita a fração 1/2 (ex. "1 1/2 dente" é aceitável); 1/3, 1/4,
  2/3 e 3/4 NUNCA aparecem pra objeto discreto — se não estiver perto de inteiro nem de meio,
  arredonda pro inteiro mais próximo (ex. alho 2 dentes × 0,33 -> "1 dente", não "2/3 dente").
`qtyRange` escala os dois extremos independentemente e junta com hífen (ex.
"8-10" x2 -> "16-20"), cada extremo passando pela MESMA regra por unidade acima. Unidade usa
`UNIT_DISPLAY` (mesmos ids canônicos do parser da Fase 2b) —
grama/quilograma/mililitro/litro viram abreviação sem plural (g/kg/ml/L); o resto (dente, xícara,
colher-sopa etc.) é substantivo contável com singular/plural escolhido pela quantidade escalada
arredondada (ex. "1 dente" vs "2 dentes"). Limitação explícita, não corrigida nesta rodada: o
substantivo do próprio `item` (ex. "cenouras") não se reconcilia gramaticalmente com a quantidade
escalada — só a unidade (quando existe) ganha esse tratamento; o schema não guarda uma forma
singular/plural separada pro nome do item.

Cada entrada de `ingredientsStructured` pode ter mais de um `items[]` (linha multi-item ou rótulo
de grupo "Para X:") — todos os itens da MESMA entrada são reconstruídos e juntados com "; " (ex.
"1 cebola, em pedaços; 2 cenouras, em pedaços; 1 talo de salsão, em pedaços"), preservando o
`group` como prefixo "Para {group}: " quando existir. Isso ainda ocupa 1 único `<li>`/checkbox
(mesmo índice do array `ingredients` original) — a granularidade de marcação continua por LINHA
original, não por item individual dentro dela.

Fallback obrigatório: se `recipe.ingredientsStructured` não existir pra alguma receita (não
deveria acontecer, as 398 já foram cobertas na Fase 2b), a linha cai pro `ing` (texto raw) sem
escalar, sem quebrar — testado forçando a ausência do campo em runtime.

Bug de dados encontrado e corrigido durante esta rodada (não é do multiplicador, é da Fase 2b):
linhas de ingrediente que juntam DUAS quantidades sem usar vírgula/" e "/travessão (os únicos
separadores que o classificador da Fase 2b reconhecia) nunca disparavam revisão manual — caíam no
bucket "confiante" como 1 item só, com a segunda quantidade colada dentro do texto do `item` ou do
`prep` (nunca virava um `qty` próprio, por isso nunca escalava). Duas rodadas de varredura no
acervo inteiro (2942 linhas):

1ª rodada — separador "+": regex `/\+\s*\d/` no campo `item`. 9 ocorrências em 8 receitas (Coq au
Vin, Espuma com Sifão, Carbonara, Béarnaise, Ovos en Meurette, Crème Caramel, Petit Gâteau, Bisque,
French Onion Soup), em 7 arquivos.

2ª rodada — varredura mais ampla pedida explicitamente (checar `;`, `/`, `+` em outras posições,
e qualquer padrão numérico repetido sem separador reconhecido): reaplicou o mesmo regex `+` mas
nos 4 campos (`item`/`prep`/`alt`/`group`, não só `item` — achou 4 casos onde o "+" tinha caído no
`prep`, não no `item`, por isso escaparam da 1ª rodada); scan de conectores de combinação
("dissolvido em", "hidratado em", "espetado com" etc. seguidos de número) achou mais 5 casos onde
a segunda quantidade nem usava vírgula nem "+"; scan bruto de contagem de dígitos (2+ números numa
linha, mais que o `items.length` atual) cobriu o resto e não achou nada novo além do já encontrado
pelos scans direcionados — usado só pra checar cobertura, não como fonte primária (produz muitos
falsos positivos de faixas de peso/tempo/tamanho em parênteses, ex. "(1,2-1,5 kg)", "por 8h",
que descrevem o MESMO item único, não um segundo item). 10 ocorrências novas em 10 receitas (Mapo
Tofu, Biryani, Risotto ai Funghi, Cassoulet, Blanquette de Veau, Arenque em Conserva/Sild, Vitello
Tonnato, Escargot, Polvo à Lagareiro, Risalamande), em 8 arquivos novos.

Total: 19 ocorrências em 18 receitas, 15 arquivos — todas corrigidas pra `items[]` separados (ou,
no caso de Arenque em Conserva, só a extração do `qty` que faltava no item primário — a segunda
metade já era uma alternativa "ou" legítima, tratada via `alt` como as outras ~155 linhas desse
tipo no acervo). Confirmado por rescan: 0 ocorrências de `+` residual em item/prep/alt/group, 0
conectores de combinação com `items.length` ainda em 1.

Casos revisados e propositalmente NÃO alterados (falso-positivo do scan, não bug): ~15 linhas com
alternativa "ou" que também têm uma quantidade dentro do próprio `alt` (ex. "50 g de tutano de boi
... ou 20 g de manteiga extra") — o `alt` nunca escala mesmo, é decisão de schema já testada, não
confundir com o bug acima. Também não alterado: a família "Suco de 1/2 limão" (9 ocorrências, 7
receitas) — a fração está no meio da frase, não é um separador de múltiplos itens (só 1
quantidade na linha), então fica fora do escopo desta varredura; registrado como limitação
conhecida separada, não corrigido nesta rodada.

## Filtros e chips

Não mostrar tudo que é possível.
Mostrar apenas o que ajuda a decidir.

Evitar poluir a UI com:
- alho
- cebola
- sal
- óleo
- categoria original
- filtros redundantes com a página atual

## Modal de filtros em acordeão (Bloco 3 — design tokens v3; redesenho de chips — Fase F1a, 2026-07-27)

Coleções (país, proteína, tempo, dificuldade, fundamentos) usam um botão "Filtros" (pill,
`--color-surface`/`--color-border`, ícone outline + badge `--color-accent-deep` com a contagem
de filtros ativos) no lugar de onde a antiga barra de dropdowns sempre-visível ficava. Toca no
botão, abre um modal cheio de tela (`--color-bg`) com "Cancelar" / título "Filtros" à esquerda/
centro. O RODAPÉ (Fase F1a) agora empilha as 2 ações do modal juntas — hierarquia única, em vez
de "Limpar filtros" solto no topo: `.filter-modal__clear-row` ("Limpar filtros", ghost) fica
DENTRO de `.filter-modal__footer`, acima de `.filter-modal__apply` ("Ver resultados (N)", pill
cheia `--color-accent-deep`, largura total, N = contagem ao vivo do rascunho). Já era sticky de
fato antes disso (flex child fora do único elemento com `flex:1`/`overflow-y` do overlay,
`.filter-modal__body`) — a mudança foi só de composição, não de mecânica de scroll.

Dentro, 8 seções em acordeão — País, Complexidade, Tempo, Equipamento, Proteína, Refeição,
Tipo de prato, Ingrediente — cada uma com cabeçalho no MESMO padrão único (Fase F1a: label
uppercase + tracking + contagem entre parênteses + chevron do acordeão). "Papel da proteína"
deixou de ser a 9ª seção própria (item 1b, 2026-07-28, ver parágrafo "Segmentado de pílulas"
abaixo) — virou sub-controle DENTRO do corpo de Proteína, então não conta mais como seção de
topo nem tem cabeçalho/contagem próprios. Quatro UIs de seleção coexistem, escolhidas por CLASSIFICAÇÃO do
que cada seção já era antes de qualquer mudança (investigação da Fase F1a, ver
docs/DESIGN-TOKENS.md "Sistema de chip de seleção" pro detalhe de cores/estados): tile com
imagem/ícone que já funcionava → só normalizado; lista-formulário nativa (checkbox/rádio,
incluindo um "tile" sem ícone algum, que na prática também era só formulário disfarçado) →
convertida pra chip; grade densa própria do Ingrediente → mantida, só rescolorida pro sistema
novo.

- **Chip de seleção** (`renderChipSectionBody` em app.js, `.filter-chip`/`.filter-chip-row`) —
  Complexidade, Tempo, Tipo de prato, Proteína e Refeição. Pill `<button role="checkbox"
  aria-checked>`: borda `--color-border`/texto `--color-text-secondary` livre, preenchida
  `--color-accent-deep`/texto `--color-text-primary` (peso 600) selecionada — mesmo par já
  calibrado a 4,52:1 na Fase 0a, reaproveitado sem recalcular. Substitui DUAS coisas antigas:
  (1) a lista de `<input type="checkbox">` real que Complexidade/Tempo/Tipo de prato já tinham
  (`renderCheckboxSectionBody`, removida — incluía um item especial "Todos" que limpava a
  seleção; MORREU sem substituto, harmonizado com a convenção que os tiles já usavam: nenhum
  chip marcado = nenhum filtro ativo, sem precisar de um item "Todos" à parte); (2) o "tile" de
  Proteína/Refeição que, investigado a fundo nesta rodada, nunca teve ícone de verdade
  (`tileIcon: noIconTileIcon` sempre devolvia `""` — label+contagem só, com o espaço reservado
  do ícone vazio) — não se qualificava como "tile funcionando" pelo próprio critério usado pra
  decidir o que preservar, então converteu junto. Combinam em OR puro entre si (união), mesma
  lógica de sempre — só a apresentação mudou. `<button>` nativo: foco/Enter/Espaço funcionam
  sem handler de teclado próprio.
  - Proteína (`protein:`, não confundir com "Papel da proteína" abaixo): 10 valores na
    taxonomia (`js/tags.js` — cresceu de 8 pra 10 desde a última vez que este documento foi
    atualizado: `leguminosa`/`laticinio` são novos). Cobertura de imagem investigada contra
    `imagens/categorias/`: só 7 dos 10 têm uma imagem candidata óbvia (reaproveitando fotos de
    categoria já existentes — `ave`→`aves.webp`, `boi`→`carnes-bovinas.webp`,
    `suino`→`suinos.webp`, `cordeiro`→`cordeiro.webp`, `peixe`→`peixes.webp`,
    `frutos-do-mar`→`frutos-do-mar.webp`, `ovo`→`col-ovo.webp`), e mesmo essa candidata pra
    `frango` seria emprestada de `aves.webp` — já reivindicada pela tag irmã `protein:ave`, não
    uma foto própria; `leguminosa`/`laticinio` não têm candidata nenhuma. Abaixo do limiar de
    10/10 travado no spec — chip de texto nesta rodada, photo-tile (mesma regra-mãe de
    `.filter-tile--photo`) fica pro mini-lote de imagem futuro. "protein:X" continua casando
    com `contains:X` (`matchesTagId`) — protagonista OU não — mecanismo intocado por esta
    rodada, só a apresentação mudou. "Papel da proteína" (Principal/Secundário/Ver tudo,
    abaixo — rótulo revisto 2026-07-29, era "Tanto faz") continua OUTRO mecanismo via `getRecipesByCollection`/`matchesAnyTag` em
    tagmodel.js, não tocado.
  - Refeição (`course:`, 5 valores: Prato Principal, Entrada, Acompanhamento, Sobremesa, Café
    da Manhã): cobertura de 161/398 receitas (40,5%). Mesma situação de Proteína — nunca teve
    ícone de verdade — e mesma conversão pra chip nesta rodada, por consistência (nenhum pedido
    explícito do dono citava esta seção por nome; extrapolação da mesma regra aplicada a
    Proteína, documentada no relatório da tarefa).
  - "Tipo de prato" (`dish_type:`, ~12-13 valores em uso) e "Restrições" (`diet:`) foram
    medidos juntos antes de `dish_type:` entrar no modal (rodada anterior): `dish_type:` tinha
    cobertura de 166/398 (41,7%); `diet:` tinha só 99/398 (24,9%) e um ÚNICO valor
    (`diet:vegetariana`) — abaixo do limiar combinado com o usuário, `diet:` NÃO entrou, seguE
    fora do modal, fica pro backlog de expansão de dados (não confundir com "Dieta" citado em
    specs antigas — não existe seção com esse nome no modal hoje).
- **Tile com imagem/ícone** (classe 1 da classificação Fase F1a — já funcionava, só
  normalizado/corrigido nesta rodada, NUNCA convertido pra chip):
  - País: bandeira real (`imagens/bandeiras/<iso2>.webp`, `renderCountryTileSectionBody`,
    layout `"photo-tiles"`) cobrindo o bloco + faixa sólida com nome/contagem por baixo — ver
    "Componentes" no DESIGN-TOKENS.md pro histórico completo (rumo novo de Países, calibração
    de blur). **Bug da caixinha cinza corrigido (Fase F1a)**: `.filter-tile` base é flex column
    com `align-items: center` (certo pro tile-ícone, que hug-content no próprio conteúdo) — a
    variante `--photo` nunca sobrescrevia isso, então `.filter-tile__band` (que deveria ocupar
    a largura CHEIA do tile, como `.category-card__band`) ficava sujeita ao mesmo cross-axis
    "center", encolhendo pro tamanho do próprio texto (medido ao vivo ANTES do fix: banda
    38,58px contra 111,33px do tile — um retângulo escuro pequeno flutuando centralizado, a
    "caixinha cinza destoante" do print do dono). `.filter-tile--photo { align-items: stretch;
    }` resolve — banda e mídia passam a ocupar 100% da largura (medido depois: 107,33px, igual
    à mídia). `.category-card`/`.home-tile` nunca tiveram esse bug por não serem flex (são
    `display: block` puro, filhos em fluxo normal já ocupam 100% de largura sem precisar de
    `align-items` nenhum) — a causa raiz era específica de `.filter-tile` reusar um container
    flex desenhado pro tile-ícone.
  - Equipamento: ícones reais em `icons/equipment/` (9 de 9 valores — todo tile tem ícone,
    TODOS SVG, nenhum PNG restante). 4 SVG de SVGRepo (forno, liquidificador, batedeira,
    micro-ondas) + 5 autorais (processador, sous vide, air-fryer, panela-de-pressao,
    churrasqueira — os 3 últimos eram PNG do Icons8 com `filter: invert(1)` como aproximação,
    substituídos por SVG real nesta rodada). Todos com `fill="currentColor"` no arquivo,
    injetados INLINE no DOM (não `<img src>`, senão currentColor não herda a cor do CSS).
    Recolorem com o estado do tile: `--color-text-disabled` parado, `--color-accent`
    selecionado — os 3 que eram PNG agora recolorem também, coisa que raster nunca conseguia
    fazer (limitação eliminada, não só contornada). O texto do SVG fica EMBUTIDO como string em
    `EQUIPMENT_SVG_MARKUP` (app.js) — não é carregado via `fetch()`. Motivo: um `fetch()` é
    assíncrono, e abrir o modal antes dele terminar (ex.: usuário indo direto no filtro logo
    após o app carregar) deixava o tile sem ícone até uma re-renderização tardia — bug real,
    confirmado por screenshot, corrigido eliminando o fetch por completo. Os arquivos em
    `icons/equipment/*.svg` continuam existindo como fonte/atribuição; o texto embutido é
    mantido idêntico a eles, ignorando espaço em branco entre tags (checagem antes de cada
    commit que tocar nisso). `.filter-tile__icon--png`/`EQUIPMENT_PNG_SRC` foram REMOVIDOS do
    CSS/app.js — não têm mais uso.
  - Créditos na tela de Minhas Receitas (buildIconCreditsEl em app.js): existiram por uma
    rodada, só SVG Repo (recomendado mas não obrigatório pela licença deles — CC0). Icons8 foi
    REMOVIDO por completo antes disso — os 3 PNG que exigiam essa atribuição viraram SVG
    autoral, nenhum ícone do app usa mais Icons8. Processador, Sous Vide, air-fryer,
    panela-de-pressao, churrasqueira e o ícone da aba Preparos são autorais (confirmado com o
    usuário) — sem fonte externa a creditar. Numa rodada posterior, com a ausência de qualquer
    atribuição OBRIGATÓRIA reconfirmada, o bloco de créditos inteiro foi removido (função,
    chamada e CSS) — não existe mais crédito de ícone em nenhuma tela do app.
- **Grade densa própria** (classe própria, mantida — item 3 do spec F1a travou "só-texto",
  restilizada pro sistema novo sem mudar de mecanismo): Ingrediente. Chips removíveis
  (`--color-surface-elevated`, × em `--color-accent`) continuam iguais acima da grade; o antigo
  `<select>` de "+ adicionar" é uma grade MAIS DENSA que País/Equipamento
  (`renderIngredientTileSectionBody` em app.js, `def.layout === "ingredient-tiles"`, função
  própria — não reaproveita `renderChipSectionBody`/`renderTileSectionBody` porque coexiste com
  os chips e não tem estado "selecionado" no próprio tile: um valor escolhido sai da grade e
  vira chip, nunca aparece nos dois lugares). Classes `.filter-tile-grid--dense`/
  `.filter-tile--dense` (4 colunas ≥380px, 3 em ≤380px). Sem ícone — só label+contagem pra
  TODOS os valores. Combina em AND ou OR entre si por escolha do usuário — único toggle desse
  tipo entre as facetas: trilho único em pílula com trava deslizante ("Qualquer um destes"/
  "Todos estes"), numa linha própria ANTES dos chips selecionados, só visível com 2+
  selecionados; "or" é o default. **Achado de contraste na Fase F1a**: a trava
  (`.ingredient-mode-toggle__thumb`) usava `--color-accent` puro de fundo — o texto ativo
  (`--color-text-primary`, `--text-sm`) sentado em cima mede 4,11:1 nesse par (DESIGN-TOKENS.md),
  abaixo do 4,5:1 AA. Corrigido pra `--color-accent-deep` (medido ao vivo depois do fix,
  fórmula de luminância WCAG: 4,52:1) — o mesmo par já usado no sistema de chip novo (Fase F1a).
  **Atualização (ajuste visual, 2026-07-28, mesmo dia de F1a + item 1b):** o backlog citado aqui
  ("migrar o mecanismo inteiro pro componente segmentado... fica pro backlog caso o dono peça
  consistência total") foi RESOLVIDO — o dono pediu exatamente essa consistência ao ver o
  segmentado de Papel da proteína saturando junto dos chips. Os 2 toggles (Ingrediente e Papel
  da proteína) agora COMPARTILHAM um único componente generalizado (`.segmented-toggle`, ver
  parágrafo "Trilho deslizante — Papel da proteína" abaixo) — a preocupação original de "perder
  a transição suave" não se confirmou: a mola (`260ms cubic-bezier(0.34, 1.56, 0.64, 1)`)
  sobrevive byte a byte na generalização, confirmado ao vivo que o toggle de Ingrediente ficou
  visual/motion idêntico ao anterior. Gengibre e curry NÃO aparecem nesta seção: existem só como
  `seasoning:*` (ver js/tags.js), não `ingredient:*`.
- **Trilho deslizante — Papel da proteína** (seleção única; ANINHADO dentro de Proteína desde o
  item 1b, 2026-07-28; trilho desde o ajuste visual, 2026-07-28 rodada 2 — mesmo dia). Linhagem
  completa: lista de rádio nativa (`<input type="radio">`) antes da Fase F1a → 3 pílulas soltas
  lado a lado (`.filter-chip--segment`, Fase F1a) → sub-controle aninhado no topo do corpo de
  Proteína, ainda como 3 pílulas (item 1b) → **trilho deslizante** (ajuste visual, rodada 2): o
  dono viu as 3 pílulas ao vivo e achou que saturavam junto dos chips de proteína logo abaixo —
  nada diferenciava visualmente "isto é um MODO, escolha 1" de "isto são OPÇÕES, marque quantas
  quiser" quando os dois usam o mesmo componente de pílula solta. Regra nova, formal a partir de
  agora: **MODO/seleção-única = trilho deslizante; OPÇÕES/multi-seleção = chips soltos** (ver
  DESIGN-TOKENS.md "Componentes" pro parágrafo completo). Mecanicamente, isso generalizou o
  toggle Qualquer um/Todos estes de Ingrediente (que já era um trilho, mas calibrado só pra 2
  paradas) num componente ÚNICO de N segmentos — `segmentedToggleHtml`/`wireSegmentedToggle`
  (app.js), CSS `.segmented-toggle` (era `.ingredient-mode-toggle`, renomeado/generalizado; as
  classes antigas `.filter-segmented`/`.filter-chip--segment` morreram, sem consumidor). Posição
  da trava via 2 custom properties CSS (`--seg-count`/`--seg-index`, setadas por JS), nunca um
  modificador de classe por quantidade de paradas — a MESMA mola (260ms
  `cubic-bezier(0.34, 1.56, 0.64, 1)`) e o MESMO cuidado de adiar o `renderBody()` completo até
  `transitionend` (pra não destruir o nó no meio da transição) sobrevivem intocados da versão
  original do toggle. Ingrediente migrou pro mesmo componente (N=2) — confirmado ao vivo que
  ficou visual/motion IDÊNTICO ao anterior. Novidades desta rodada, nos 2 usos: altura do
  segmento 40px→44px, cor livre `--color-text-disabled`→`--color-text-secondary` (alinha com o
  "livre" dos chips normais), e teclado — setas ←/→ movem foco+seleção juntos dentro do
  `role="radiogroup"` (padrão nativo, nenhum dos 2 usos tinha antes). Rótulo visível do
  sub-controle de Proteína continua `.filter-subcontrol-label` estático, "Papel da proteína"
  (mantido — o dono optou por não trocar por nenhuma das 2 alternativas de copy da Fase F1a).
  **Correção de semântica (2026-07-29, rodada 4 — a única desta linhagem que mexeu no
  MECANISMO, não só na apresentação):** deixou de valer só em coleção de proteína — vale no app
  inteiro (busca global incluída) sempre que houver >=1 proteína ATIVA. `getRecipesByCollection`
  não serve mais de base pro cálculo de Principal/Secundário (é fixo por coleção, não sabe
  operar sobre um conjunto de proteínas escolhido dinamicamente) — nova função
  `TagModel.splitByProteinRole(items, S)` generaliza `matchesTagId` (que só respondia
  presente/ausente) numa distinção protagonista/coadjuvante pra QUALQUER S. Visibilidade e
  contagens do trilho passam a ser recalculadas a cada mudança de rascunho (helper
  `activeProteinTagIds`), não fixadas 1x na abertura do modal. Ver detalhe completo em
  `product-navigation-ux/SKILL.md` ("Princípio anti-overwhelm"). **Achado da investigação de bug que motivou o redesenho original (item 1a)**: a
  seção NÃO tinha defeito de código — deploy em produção batia byte-a-byte com HEAD, e a seção
  renderizava corretamente em teste ao vivo fresco; causa mais provável do relato foi staleness
  local de PWA/SW no dispositivo de teste do dono, não um bug a corrigir em código. **Bug real
  corrigido no item 1b**, ainda válido: o listener de clique dos chips de VALOR de Proteína
  (`protein:X`) usava o seletor genérico `.filter-chip` — passou a ficar escopado a
  `.filter-chip-row .filter-chip` (valores) vs. o trilho (`wireSegmentedToggle`, escopado ao seu
  próprio container) pra nunca contaminar `draftFacetState.protein` com cliques no papel, e
  vice-versa — confirmado ao vivo de novo depois da migração pro trilho.

A contagem de cada opção não-selecionada é sempre "quantos eu teria se também adicionasse
este" — universo restrito pelas OUTRAS facetas, nunca pela própria (mesma lógica que já existia
pro dropdown de Ingrediente, só reaproveitada) — intocado pela Fase F1a.

Mudanças dentro do modal ficam em rascunho — só valem de fato ao tocar "Ver resultados";
"Cancelar" descarta tudo. "Papel da proteína" (Principal / Secundário / Ver tudo) substitui
as antigas abas "Foco da receita / Também leva / Todas".

"Limpar filtros" (texto sublinhado, `--color-text-secondary` — nunca `--color-accent` em texto
pequeno, falha WCAG AA) aparece só quando pelo menos 1 filtro está ativo, agora DENTRO do
rodapé (Fase F1a, ver acima — antes vivia solto logo abaixo do header). NÃO aplica nem fecha o
modal — zera só o rascunho (seções voltam ao estado sem seleção, rodapé recalcula) e mantém o
modal aberto; ainda precisa de "Ver resultados" (ou "Cancelar" pra desistir).

### Sistema de chip de seleção (Fase F1a, 2026-07-27)

Componente `.filter-chip` (docs/DESIGN-TOKENS.md "Componentes" tem os números completos):
pill `<button>`, 36px de altura visual, `border-radius: 999px`. Livre: `border: 1px solid
var(--color-border)`, fundo transparente, texto `--color-text-secondary`. Selecionada:
`background`/`border-color: var(--color-accent-deep)`, texto `--color-text-primary` peso 600 —
o par já calibrado a 4,52:1 na Fase 0a, reaproveitado sem recalcular em NENHUM dos 3 lugares
que passaram a usá-lo (chip multi-seleção, segmentado de Papel da proteína, trava do toggle de
Ingrediente). Alvo de toque: 36px visual + `::after` com `inset: -6px` (mesma fórmula da Fase
0a já usada em `.recipe-page-tags .tag-chip-link` — border:1px "come" 1px do inset, que resolve
contra o padding-box do ancestral posicionado, não a borda visível) = 48px efetivos, acima do
mínimo de 44px. `.filter-chip-row` (wrap, `gap: var(--space-2)`) pras 5 facetas multi-seleção;
`.filter-segmented` (`display: flex`, sem wrap, filhos `flex: 1`) só pro Papel da proteína.
Estados `:active`/`:focus-visible` entram nas listas compartilhadas de componentes tocáveis do
app (mesmos tokens de movimento/foco de sempre, nenhum CSS de estado duplicado).

O resto da tela de categoria/busca (cards, dropdown de ordenação, toolbar) também é tema
escuro desde o Bloco 4 (via os tokens antigos redefinidos, ver seção abaixo) — o botão
"Filtros" e o modal continuam sendo os únicos a usar os tokens `--color-*` novos diretamente,
mas os valores finais renderizados são os mesmos em ambos os casos.

## Reskin escuro (Bloco 4)

O app inteiro é tema escuro agora — nenhuma tela remanescente na paleta clara. Caminho usado:
redefinir os VALORES dos 10 tokens antigos no `:root` de `css/style.css`, mantendo os NOMES
(`--bg`, `--bg-panel`, `--ink`, `--ink-soft`, `--gold`, `--line`, `--green`, `--red`,
`--radius`), sem tocar nos tokens `--color-*` novos. Isso re-temizou quase toda a tela antiga
de uma vez, já que ela consistentemente usava `var(--token)` em vez de cor hardcoded (só ~16
exceções pontuais, resolvidas uma a uma).

Equivalência 1:1 aplicada: `--bg`=`--color-bg`, `--bg-panel`=`--color-surface`,
`--ink`=`--color-text-primary`, `--ink-soft`=`--color-text-secondary`, `--gold`=`--color-accent`,
`--line`=`--color-border`, `--green`=`--color-success`, `--red`=`--color-error`. `--radius`
ficou em 14px (não forçado pra 20px — decisão em aberto, separada).

`--gold-soft` e `--shadow` foram REMOVIDOS do `:root` (não tinham 1 equivalente novo único):
- `--gold-soft` (19 usos) tinha 3 papéis, cada um resolvido pro token certo: borda
  padrão/estática -> `--color-border`; borda de hover/outline de foco -> `--color-accent-hover`
  (hover) ou `--color-accent` (foco, regra "Inputs:... foco --color-accent" do
  DESIGN-TOKENS.md); ícone de placeholder/vazio -> `--color-text-disabled`; fundo tingido
  suave (badge, marcador decorativo, aba ativa, hover de chip, CTA do card, pill de fallback)
  -> `rgba(214, 59, 32, 0.08)` (tom de `--color-accent` em baixa opacidade — decisão confirmada
  com o usuário, não existe token pronto pra isso).
- `--shadow` (5 usos de `box-shadow`) foi removido sem substituto: nenhum componente do Bloco
  2/3 tinha precedente de elevação em dark mode, e `--line`/`--color-border` já separa camadas
  sozinho (sombra escura sobre fundo escuro ficaria invisível de qualquer forma).

Achado importante durante a resolução: várias regras usavam `color: var(--gold)` em texto
PEQUENO (<18px) — `.icon-credits a`, `.btn-or-fallback` (removido depois, junto com o resto do
fallback reativo do Ingrediente — ver seção Ingrediente/toggle acima), `.subgroup-title`, `.recipe-title
.cat-chip`, `.recipe-card-cta`, `.tag-chip-link`, `.back-button`, `.recipe-page-section h4`,
`.cook-step-label`. Mapear direto pra `--gold`=`--color-accent` faria essas 9 regras virarem
ghost-text que falha WCAG AA no tamanho (a mesma regra já documentada pra "Mais categorias" na
home). Todas foram desviadas pra `--color-text-secondary` (ou `--color-text-primary` no caso
do `.recipe-card-cta`, que é uma CTA de ação real) em vez do mapeamento automático — bordas,
ícones e preenchimentos sólidos com texto claro em cima (`--ink`, ex.: número do passo,
chip selecionado, botão primário) não têm esse problema e usam `--gold`/`--color-accent`
normalmente.

~16 valores hardcoded fora do `:root` também resolvidos individualmente: 5×`#fff` + 1×`white`
(texto sobre preenchimento sólido) -> `--color-text-primary`; `rgba(163,118,44,0.08)` (gold
cru) -> mesmo tom de `--color-accent` tingido acima; `#f1e8d3`×2 (fundo de placeholder) ->
`--color-surface-elevated`; `#f6efdd`×2 (tips-box e hover de sugestão) ->
`--color-surface-elevated`; `#8f6624`×2 (hover mais escuro de dourado) -> `--color-accent-hover`.

Card de receita (`renderRecipeCard`) e card de coleção (`renderCollectionCard`) são funções
únicas reaproveitadas por toda tela que lista receitas/coleções — o reskin vale pra todas de
uma vez, sem duplicação.

## Feedback de pressão, hit-padding e acessibilidade (apple-design skill)

5 itens adotados da skill `apple-design` depois de um levantamento comparado com este
documento e com o DESIGN-TOKENS.md (nenhum toca em token/decisão existente — todos aditivos):

- Pressão instantânea (`:active`, `scale(0.97)` + opacidade ~0,85, 200ms ease-out — dentro do
  orçamento de 180–250ms já documentado) em `.primary-cta`, `.filter-modal__apply`,
  `.action-btn`, `.filter-trigger`, `.bottom-nav__tab` e `.recipe-card`. Antes desses 6, só
  existia 1 `:active` no CSS inteiro (`.portion-stepper__btn`, e só cor, sem escala). Fix do
  iOS Safari incluso (`js/app.js`, listener de `touchstart` vazio no `document`, registrado 1x
  no load): sem ele, `:active` não dispara em toque real nesse navegador, só com mouse.
- Hit-padding invisível (~10px) no coração do card (`.recipe-card__heart`, 32px) e nos botões
  +/- do portion-stepper (`.portion-stepper__btn`, 30px) via `::after` com `position:absolute;
  inset:-10px` — não muda o tamanho visual do ícone, não afeta layout (pseudo-elemento fora do
  fluxo). No portion-stepper o padding horizontal cai pra 3px (`inset: -10px -3px`) porque os 2
  botões ficam a 6px um do outro — 10px de cada lado se sobreporia e criaria ambiguidade de
  toque bem no meio dos dois.
- Saída do modal de filtro agora espelha a entrada: `closeModal` (`js/app.js`) não faz mais
  `overlay.remove()` direto — adiciona `.filter-modal--closing` (CSS: `@keyframes
  filter-modal-out`, reverso de `filter-modal-in`, mesmos 220ms) e só remove o overlay do DOM
  depois, via `setTimeout`. `overlay.style.pointerEvents = "none"` no início bloqueia cliques
  repetidos (Cancelar 2x, tocar no backdrop durante a saída) nesse intervalo.
- `@media (prefers-reduced-motion: reduce)`: a escala do Pressed vira só opacidade (sem
  `transform`); a entrada do modal perde a animação (aparece estática); a saída vira um
  cross-fade de opacidade sem o `translateY`. `closeModal` lê
  `matchMedia("(prefers-reduced-motion: reduce)")` e usa 200ms em vez de 220ms pro
  `setTimeout` (o valor não precisa bater 1:1 com a transição CSS, só não remover o overlay
  antes da hora).
- `@media (prefers-contrast: more)`: borda de `.recipe-card`, `.action-btn` e `.filter-trigger`
  reforçada pra 2px em `--color-text-secondary` — sem token de cor novo.
- Tracking negativo (`letter-spacing`) nos 2 maiores títulos do app: `#category-header h2`
  (-0.02em, ~32px) e `.recipe-page-title h2` (-0.015em, ~27px). O tracking positivo já usado
  em texto pequeno uppercase (subgroup-title, cat-chip etc.) não muda.

Ver docs/DESIGN-TOKENS.md (Tipografia, Grid e espaçamento, Estados, Animações, e a nova seção
Acessibilidade) pra essas 5 decisões como regra formal — não ficam só documentadas aqui.

## Fase 0a — fundação de acessibilidade, estados e tokens (2026-07-26)

Baseado na auditoria visual de 2026-07-25 (scripts `audit-visual-*.js` em `scripts/`, não
commitados). Mudanças de COMPORTAMENTO (não só visual) relevantes pra esta skill:

- **`.recipe-card` agora é operável por teclado** — `renderRecipeCard` (app.js) ganhou
  `role="button"`, `tabindex="0"`, `aria-label` e um handler de `keydown` (Enter/Espaço
  disparam `el.click()`, reaproveitando o listener de clique já existente, sem duplicar lógica
  de navegação). Antes era uma `<div>` pura, inalcançável via Tab — era o mecanismo de
  navegação PRIMÁRIO do app e não tinha caminho de teclado nenhum. Mesmo tratamento
  (`makeKeyboardClickable`, helper novo em app.js) aplicado a `.preparo-card` (Preparos) e aos
  3 `<span data-unit>` do mostrador do timer (`enableDisplayTapToEdit`). `.category-card` e
  `.home-tile` NÃO precisaram de tratamento — já são `<button>` nativos (achado da auditoria
  original estava errado nesses 2 casos, corrigido durante a implementação).
  `.shopping-list__recipe-row` também ficou de fora, mas por critério, não por native já ser
  `<button>`: seu chevron (`.shopping-list__recipe-chevron`) É um `<button>` nativo sem
  listener próprio, que já entrega o colapsar/expandir da linha via bubbling nativo de
  Enter/Espaço→click — confirmado ao vivo (`chevron.click()` colapsa a linha). O backdrop do
  modal de filtro (clique fora fecha) também ficou de fora: o botão "Cancelar" nativo já
  entrega o mesmo resultado via Tab.
- **Foco visível**: todo componente tocável (lista completa abaixo) ganhou
  `:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset); }` — antes 0 regras `:focus-visible` no app inteiro.
- **`:active` estendido** dos 6 originais (ver seção acima) pra mais 24: `.category-card`,
  `.home-tile`, `.preparo-card`, `.preparo-card__delete`, `.recipe-suggestion`,
  `.tag-chip-link`, `.tag-suggestion`, `.tag-chip--selected` (2 contextos), `.update-toast__btn`
  (esses 9 só tinham `:hover`, mesmo anti-padrão que motivou a lista original) + `.back-button`,
  `.checklist label`, `.cook-timer-controls button`, `.cook-timer-display__part`, `.filter-modal
  .btn-clear-filters`, `.filter-modal__cancel`, `.filter-option`, `.filter-section__header`,
  `.home-more-categories`, `.recipe-page-heart`, `.shopping-list__clear`,
  `.shopping-list__recipe-chevron`, `.shopping-list__recipe-row`, `.text-link` (esses 15 não
  tinham NENHUM estado). Usa os tokens `--motion-fast`/`--motion-base`/`--motion-easing` novos.
- **Área de toque**: os 13 elementos abaixo de 44×44px mapeados na auditoria ganharam hit-area
  invisível (`::after`, mesma técnica do coração/portion-stepper) ou, no caso do checkbox da
  Lista de Compras (`.checklist input[checkbox]`, 20×20px), `min-height: 44px` na `<label>`
  inteira (a linha vira o alvo, não o checkbox sozinho — clique em qualquer parte da label já
  alternava o checkbox nativamente, sem mudança de comportamento).
- **Bug real encontrado e corrigido**: a compensação horizontal do `::after` do
  `.portion-stepper__btn` (documentada acima como "3px") nunca funcionou de verdade — `inset`
  de um `::after` absolute resolve contra o PADDING-BOX do ancestral posicionado, não a borda
  visível; com `border: 2px` no botão, os 2px "comiam" cada inset silenciosamente (efetivo real
  ~1px horizontal / ~8px vertical, não 3px/10px). Corrigido somando a borda ao inset
  (`-12px -5px`, mantendo os 10px/3px pretendidos a partir da borda visível) — confirmado com
  `elementFromPoint` nos 4 lados dos 2 botões, todos batendo no botão agora.
- **Contraste**: `--color-accent-deep` novo (fill sólido + texto), `--color-text-disabled`
  clareado, rótulo da bottom nav ativa trocado pra `--color-text-primary` (ícone continua
  `--color-accent`), `::placeholder` ganhou cor explícita — ver docs/DESIGN-TOKENS.md pros
  valores e ratios.
- **Nomenclatura de tokens**: `--color-*` é oficial agora, nomes antigos (`--gold`, `--ink`
  etc.) viraram alias — ver docs/DESIGN-TOKENS.md.

## Fase 0c — extermínio de emoji, primeira leva (2026-07-25)

Inventário completo: 266 instâncias de emoji em 8 arquivos. Nesta leva morreram só 4 grupos —
os outros dois (47 de ícone de categoria/hub em `categories.js`/`collections.js`/`app.js`, e a
RENDERIZAÇÃO das 60 bandeiras via `COUNTRY_FLAG_EMOJI`/`countryTileIconHtml`) ficam de propósito
pro item 6 do roadmap, junto com as fotos — nenhum dos dois foi tocado aqui.

**Os 2 grupos deixados de propósito acima foram RESOLVIDOS pelo item 6 do roadmap-mestre
(2026-07-26)** — ver seção própria "Item 6 — tile de categoria/home, banner de hub, tile de
país" mais abaixo. `categories.js`/`collections.js`/`app.js` chegam a zero emoji funcional.

- **Ingrediente (43)**: `INGREDIENT_EMOJI` e `ingredientTileIconHtml` removidos por completo —
  ver seção "Ingrediente" acima.
- **Botão (8)**: 6 casos (✓ Já fiz, toggle de lista de compras, "Começar preparo", "Sair do modo
  cozinhar", "Finalizar") perderam só o emoji — o texto já bastava, nenhum ícone novo. Os outros
  2 (`.preparo-card__delete`, usado tanto na aba Preparos quanto na Lista de Compras) eram SÓ o
  glifo "✕" sem texto ao lado — apagar sem repor deixaria o botão vazio, então ganharam o ícone
  novo `close` (ver abaixo).
- **Decoração de copy (6 contados + 1 achado durante a implementação)**: os metadados da PÁGINA
  da receita (Total/Preparo/Cozimento/porções/dificuldade, `.recipe-page-meta`) e o ícone do
  portion-stepper perderam o emoji e viraram texto puro, SEM ícone — decisão deliberada de NÃO
  estender o padrão de ícone outline que o CARD da receita já usa pro mesmo dado
  (`.recipe-meta-item` com `iconSvg("clock"/"gauge"/"bowl")`); a página e o card ficam com
  tratamentos diferentes pra esse metadado por ora. O "⏱ Total" não estava nos 6 originais do
  inventário (gap do levantamento — o emoji ⏱ cai fora da faixa Unicode varrida), mas é a mesma
  linha `metaHtml` dos outros 4 que perderam emoji nesta leva — deixá-lo sozinho ficaria
  inconsistente, então saiu junto.
- **Fallback sem-foto (7 contados)**: os 6 que são de verdade sobre FOTO ausente (ícone de
  coleção sem `icon`, thumb do card, thumb do preparo, hero da página, os 2 call sites genéricos
  dentro de `applyImage()`) ganharam o ícone novo `photoOff`. O 7º ("Essa coleção ainda não tem
  receitas — em breve. 🍳") NÃO é sobre foto — é decoração de mensagem de estado vazio — então
  levou o mesmo tratamento do grupo "decoração de copy" (só perdeu o emoji, sem ícone).
- **2 ícones novos em `ICONS`/`iconSvg()` (app.js)**: `close` (✕ genérico, outline, usado nos 2
  botões só-ícone) e `photoOff` (moldura+sol+montanha, outline, usado nos 6 fallbacks de foto).
  Ambos stroke-based (`currentColor`), mesmo sistema de sempre — sem arquivo, sem licença, cor
  vem do CSS igual a todo o resto. Tamanho calibrado em CSS pra bater com o que o glifo/emoji
  antigo ocupava em cada contêiner (`.preparo-card__delete svg` 16px, `.recipe-thumb`/
  `.preparo-card__thumb.placeholder svg` 24px, `.recipe-hero.placeholder svg` 56px,
  `.category-card__icon svg` 24px — este último REMOVIDO por completo pelo item 6 do
  roadmap-mestre, 2026-07-26: o tile sem imagem mapeada não leva mais nenhum ícone de fallback,
  só a faixa+nome sobre fundo neutro, ver seção "Item 6" mais abaixo).

## Item 6 — tile de categoria/home, banner de hub, tile de país (2026-07-26)

Item final do redesenho visual (CHECKLIST-GERAL.md) — fecha a pendência de layout que
`CONTRATO-IMAGENS-REDESIGN.md` §4 tinha deixado explicitamente "da frente de design" e o bucket
de emoji que a Fase 0c (acima) tinha deixado de propósito. Números exatos, contraste medido e o
CSS completo ficam em `docs/DESIGN-TOKENS.md` ("Componentes"); aqui fica o resumo de decisão e
comportamento.

**Regra-mãe adotada:** texto nunca senta em imagem — mesma gramática que o card de receita (nome
na faixa sob a foto) e a página de receita (título na folha sobre a foto) já usavam, agora
estendida a categoria/home/hub/país. Alternativa avaliada e arquivada, não usada: blur 6px + véu
branco 25% + texto escuro (medido 5,10–5,65:1) — preterida por consistência com o resto do app,
não por falha técnica (ver `docs/CONTRATO-IMAGENS-REDESIGN.md` §8.1.1).

**Investigação de mapeamento (feita ANTES de qualquer CSS/JS, como sempre neste projeto):** slug
de cada imagem de `scripts/gerar-categorias.js` (19 itens: 8 Fundamentos + 8 Proteínas + 3 hubs)
cruzado com `id` de `window.COLLECTIONS` — **zero tile órfão** nas 16 coleções de
Fundamentos/Proteínas e nas 20 de País (via `iso2`, não este acervo). Os únicos 7 sem imagem são
Por tempo (4) e Por dificuldade (3) — coleções de rotas ÓRFÃS (`#/grupo/tempo`,
`#/grupo/dificuldade`, sem link nenhum hoje no app, só URL direta) — recebem fallback tipográfico
limpo (faixa + nome sobre fundo neutro, sem ícone, sem buraco). Verificado por
`scripts/verify-categoria-tiles-2026-07-26.js`, que EXTRAI e EXECUTA `collectionTileImageSrc`/
`GRUPO_BANNER_IMAGE` de verdade contra os dados reais (não só grep do literal), inclusive
confirmando que cada caminho resolvido existe de fato em disco.

**O que mudou, por superfície:**
- **Tile de categoria (`.category-card`, grade "Mais Categorias" + grade de qualquer hub,
  INCLUSIVE Países)** — `renderCollectionCard` (função única, compartilhada por todo hub) passou
  a montar foto (cobre o bloco, `object-fit: cover`, sem blur) + faixa sólida com nome+contagem.
  Emoji de ícone (`collection.icon`) morreu — campo removido de `collections.js` inteiro.
- **Tile grande da Home (`.home-tile`, os 4 tiles de `HOME_MAIN_TILES`)** — mesma estrutura,
  proporção mais alta (4:3) e nome maior (hierarquia "tile grande" vs. "tile de grade"). Ícone
  outline (`bowl`/`flame`/`globe`/`cupcake`) morreu, substituído por foto — as 4 entradas sempre
  têm imagem (2 de categoria, 2 de banner de hub), zero fallback aqui.
- **Banner de hub (`.grupo-banner`/`.grupo-sheet`, `renderGrupo`) — só nos 3 hubs alcançáveis por
  link real da Home (Mais Categorias/Proteínas/Países).** Imagem NÍTIDA (calibração final
  pós-8.1.1, 2026-07-26 — `blur(6px)`/`scale(1.1)` originais removidos: sustentavam
  texto-sobre-imagem direto no banner, spec que a 8.1.1 já tinha aposentado; contraste do
  back-float continua garantido pelo véu PRÓPRIO do botão, `rgba(15, 15, 14, 0.55)`, nunca
  dependeu do banner borrado) em faixa no topo (~25-30vh) + folha (`--radius-sheet`) que
  sobrepõe a base do banner, MESMA gramática de `.recipe-hero`/`.recipe-page` (foto fixa + folha
  por cima), simplificada (sem parallax de scroll — o hub é uma lista de tiles, não um funil de
  leitura longo). Título (agora SERIF de verdade — achado desta rodada: `.grupo-view h2` nunca
  tinha sido serif apesar do que `docs/DESIGN-TOKENS.md` já registrava, corrigido no mesmo
  commit) e a busca do hub vivem sempre na folha. **Descrição textual do hub morreu** (decisão
  antiga do roadmap, fechada aqui) — `grupo.desc`/`GRUPOS[].desc` não existem mais, em nenhum
  grupo. Tempo/dificuldade (rotas órfãs, sem imagem) mantêm o título simples de sempre, sem
  banner.
  - **chrome-clearance ampliado:** hubs COM banner entram na mesma exceção "float sobre mídia"
    que a página de receita já tinha (`.grupo-view.has-banner { padding-top: 0; }` — o back-float
    senta sobre o banner de propósito). Hubs SEM banner continuam reservando
    `--chrome-clearance` normalmente (nenhuma regressão). Ver
    `scripts/verify-back-float-2026-07-25.js` seção 15d.
- **Tile de país no modal de Filtros (`.filter-tile--photo`, faceta País)** — mesma regra-mãe em
  miniatura (bandeira cobrindo o bloco + faixa sólida com o nome). `countryTileIconHtml` (emoji
  de bandeira Unicode) morreu — layout próprio (`"photo-tiles"`), não reaproveita
  `renderTileSectionBody` (ainda usado por Equipamento). `window.COUNTRIES.<id>.iso2` continua a
  fonte única (`js/countries.js`), só o consumo mudou de emoji pra arquivo
  (`imagens/bandeiras/<iso2>.webp`).
- **Extermínio final de emoji:** `categories.js`/`collections.js`/`app.js` chegam a ZERO emoji
  funcional (campo `icon` removido inteiro dos dois primeiros; `GRUPOS.icon`/`.desc` removidos do
  terceiro). `js/countries.js` continua com `.emoji` como dado inerte (não lido por nenhuma tela
  mais) — fora do escopo "zero", decisão explícita, não uma exceção nova. Suíte
  `scripts/verify-emoji-fase0c-2026-07-25.js` atualizada pros novos esperados.

**Correção pós-revisão do dono, rodada 2 (mesmo dia, mesmo commit) — 4 ajustes, ver
`docs/DESIGN-TOKENS.md` pros números/CSS exatos:**
1. Bandeira do tile de país voltou a ser BORRADA + véu (nunca nítida — nítida quebrava a
   identidade, veredito do dono ao ver no ar). `--flag-blur`/`--flag-veil` calibráveis.
2. Ritmo da folha do hub ganhou tokens explícitos (título→busca `--space-4`, busca→conteúdo
   `--space-6` na própria margem do search-wrap).
3. **Bug real de julgamento na rodada 1**: a faixa em `position: absolute` cobria a base de uma
   imagem 1:1, fatiando o prato visualmente. Corrigido — mídia (com `aspect-ratio`) e faixa
   viraram blocos empilhados, nunca sobrepostos (grade 1:1 zero corte na época, Home 4:3 mínimo,
   `object-position: center` — ⚠️ a grade deixou de ser 1:1 na mini-rodada visual de fechamento,
   2026-07-29, ver seção própria mais abaixo). Achado extra ao vivo: `.category-card__media`/
   `.home-tile__media` são `<span>` (inline por padrão) — `aspect-ratio` não pegava sem
   `display: block` explícito.
4. Mosaico de bandeiras (CSS, `.flag-mosaic`) substitui a foto de temperos no tile "Países" da
   Home e no banner do hub Países — o dono achou a composição sem identidade nessas 2
   superfícies. ⚠️ **REVOGADO no rumo novo de Países (26/07/2026)**: as 2 superfícies passaram a
   usar `imagens/categorias/paises.webp` (imagem-conceito de 5 pratos), o mosaico foi removido
   inteiro do código e `hub-cozinhas.webp` saiu do repo. Bandeira sobreviveu só na faceta País do
   modal de Filtros; o tile de país do hub virou a FOTO da receita-assinatura
   (`window.COUNTRIES[].signatureRecipe`). Registro mantido como histórico da linhagem.

**Calibração final, rodada 3 (mesmo dia) — 3 ajustes pós-revisão ao vivo, ver
`docs/DESIGN-TOKENS.md` pros números exatos:** blur do tile de país individual 6px→2,5px
(reconhecível, não mancha); mosaico virou grid 3x3 (9 bandeiras, era 2x2/4) com blur 10px→4px,
ordem escolhida por contraste de cor entre vizinhos; label do tile "Navegar por Países"→"Países"
(cabe em 1 linha, resolve o tile mais alto que os vizinhos) + `min-height` derivado na faixa dos
4 tiles da Home como rede de segurança. Medido ao vivo: os 4 tiles com altura idêntica.

**Calibração final de bandeiras, rodada 4 (mesmo dia) — correção de causa raiz (proporção), ver
`docs/DESIGN-TOKENS.md` pros números exatos:** o acervo `imagens/bandeiras/*.webp` foi REGERADO
3:2 (600×400, era 1:1 600×600) direto dos SVGs (`scripts/exportar-bandeiras.py`/`.js` — o `.js`
rodou de fato nesta máquina, Node+sharp, por bloqueio real de libcairo/GTK3 no Windows pro `.py`).
Com o asset já 3:2, o SLOT de mídia dos tiles individuais (`.category-card--flag`/
`.filter-tile--photo`) também virou `aspect-ratio: 3 / 2` — corte medido ~zero (era 1:1,
forçando corte em toda bandeira) — e o zoom caiu de `scale(1.15)` pra `scale(1,02)` (**regra
geral nova, vale pra qualquer imagem de tile futura:** a mídia do tile casa a proporção do
próprio asset; zoom é só o mínimo que cobre, nunca o disfarce de uma proporção errada). Blur
individual `--flag-blur` 2,5px→1px (quase imperceptível — o véu, não o blur, preserva
identidade). Mosaico recortado 3x3 da rodada 3 morreu — virou MURAL de bandeiras INTEIRAS, grid
2x2 (4, não 9: BR/FR/JP/ES, mesma lógica de contraste de vizinhos), `--flag-mosaic-blur`
4px→1,5px; corte agora é só a diferença de proporção entre o host (grid N×N herda a proporção do
CONTAINER, não uma célula "ideal" isolada) e o asset — pequeno e medido (~10,6% de largura na
Home, ~5,9% de altura no banner do hub), não mais um recorte de composição. Achado ao vivo na
verificação final (bug pré-existente, não desta rodada): `.filter-tile--photo .filter-tile__band`
não tinha gap entre nome e contagem (2 `<span>` colados, "Itália12" na tela) — o tile-ícone base
ganha esse espaçamento do `.filter-tile` pai (flex+gap), mas a faixa de país nunca tinha o mesmo
tratamento; corrigido com flex column + `gap: 2px` na própria faixa, mesmo valor de
`.category-card__band`.

**Mini-rodada visual de fechamento (2026-07-29) — 2 correções do dono a partir de prints de
referência, iFood como régua de calha, ver `docs/DESIGN-TOKENS.md` pros números exatos:**
1. **`.category-card__media` (grade "Mais Categorias" + grade de qualquer hub) sai do 1:1
   nativo do asset pro 4:3 de `.home-tile__media`** — primeira exceção real à regra geral "mídia
   casa a proporção do próprio asset" (item acima, rodada 4 de bandeiras): consistência ENTRE
   classes de tile pesou mais que preservar corte zero. Corte central perde ~25% da altura do
   quadrado original (600×600); confirmado ao vivo tile a tile (6 de Mais Categorias + 8 de
   Proteínas + amostra de Países) que nenhum decapita o prato — acervo é sempre composição
   overhead centrada. `.category-card--country .category-card__media` já vivia em 4:3 (rumo
   novo de Países) — vira o primeiro precedente da exceção, não mais caso isolado.
2. **Calha lateral do `#main` (`<=700px`) revista de `--space-5` (20px) pra `--space-4`
   (16px)** — usável em 390px passa de 350px pra 358px (medido ao vivo). TOP do `#main`
   preservado em `--space-5` de propósito: `.grupo-sheet`/`.recipe-page` cancelam esse valor
   exato no próprio `margin-top` pra manter a folha encostada no fim do banner/hero — mexer no
   top quebraria essa matemática sem necessidade (achado da investigação desta rodada, não
   tocado). Padding PRÓPRIO de `.grupo-sheet`/`.recipe-page` (que recria a margem de leitura nos
   2 elementos em bleed, `width: 100vw` + `margin-left: calc(50% - 50vw)`) também não muda —
   só a calha do `#main` em si. Carrossel "Vistas recentemente" (`.recent-card`, `flex: 0 0
   26vw`) não depende do padding de `#main`, então só a largura útil do container cresce: fatia
   visível do 4º card passa de 9,83px pra 17,83px (medido, `getBoundingClientRect`) — a "fatia
   de convite" cresce, não desaparece.

## Preparos — pilha de timers em tempo real (Fase multi-timer, 2026-07-30)

3 problemas reais reportados pelo dono no card de Preparos (`renderPreparosList`, `.preparo-card`,
não confundir com `.recipe-page-section`/ingredientes): (1) mostrava `mm:ss`, divergindo do
mostrador `hh:mm:ss` do modo cozinhar; (2) não contava ao vivo — era uma FOTO tirada no momento do
render, congelada até a lista ser reconstruída por outro motivo; (3) com 2+ timers ativos em
passos DIFERENTES da mesma sessão, o card só lia `session.stepTimers[session.currentStep]` — o
timer do passo não-atual ficava rodando de verdade no Storage, mas invisível no card.

**Investigação prévia importante:** o MODELO já era `{endsAt, remainingSeconds, running,
started}` por `stepIndex` (`Storage.savePreparoStepTimer`, `gusta-preparos-v1`), `endsAt` já um
timestamp ABSOLUTO, e nada no código impedia 2+ `stepIndex` distintos com `running: true` ao
mesmo tempo — o storage já suportava múltiplos timers simultâneos, o bug inteiro era na LEITURA
(card só olhava 1 chave) e na EXIBIÇÃO (sem ticker, formatação ad-hoc). Por isso esta fase não
mudou o schema nem precisou de migração (`PREPARO_SCHEMA_VERSION` continua `1`).

- **`getActiveStepTimers(stepTimers, now)`** (`js/app.js`, função pura, sem DOM) — deriva do
  `stepTimers` bruto da sessão a lista de timers ativos (`running && endsAt`), com
  `remainingSeconds`/`isDone` calculados a partir de `now` (PARÂMETRO, não `Date.now()` direto —
  testável com relógio injetado, ver `scripts/verify-preparos-multitimer-2026-07-30.js`),
  ordenada por `endsAt` ASCENDENTE. Ordem nunca precisa ser recalculada a cada tick — `endsAt` é
  absoluto, a ordem relativa entre 2 timers não se inverte com o tempo.
- **Pilha de chips** (`.preparo-timer-chips` > `.preparo-timer-chip`, 1 por timer ativo): "Passo N
  · hh:mm:ss" (reaproveita `formatBigTime`, o MESMO formatador do modo cozinhar — nenhum
  formatador duplicado sobrevive; a regra é SEMPRE `hh:mm:ss`, nunca cair pra `mm:ss` mesmo com 0
  horas, igual ao contador grande). Zerado (`endsAt <= now`) vira "Pronto!" com fundo
  `--color-accent-deep` (`.is-done`) até ser dispensado pelo mesmo ×.
- **2 botões IRMÃOS por chip, nunca aninhados** (mesmo padrão de `.busca-recente-chip__label`/
  `__remove` — botão dentro de botão é HTML inválido, por isso não é o truque de
  `e.stopPropagation()` num alvo aninhado que `.preparo-card__delete`/`.recipe-hero__heart` usam
  em outros pontos): `.preparo-timer-chip__body` (grava `Storage.savePreparoStep` pro stepIndex
  DAQUELE chip e abre o modo cozinhar nele — não no `currentStep` da sessão) e
  `.preparo-timer-chip__cancel` (cancela só aquele timer, mesma semântica do "Cancelar" do modo
  cozinhar — volta pro estado PARADO guardando o restante, nunca reseta a duração original — com
  desfazer). Os 2 fazem `stopPropagation()` porque vivem dentro do `.preparo-card`, que tem seu
  próprio onclick (retomar de onde parou) — tocar no CORPO do card fora dos chips continua
  intocado.
- **Desfazer do cancelamento** (`showPreparoTimerUndoToast`) reusa a MESMA infraestrutura de
  `showShoppingUndoToast` (F1c): `.update-toast` (visual) + `.preparo-timer-undo-toast` (marcador
  próprio na whitelist de `pointer-events` do body, `css/style.css`). Snapshot é o objeto
  `{endsAt, remainingSeconds, running, started}` de ANTES do cancelamento, restaurado verbatim —
  `endsAt` volta idêntico, nenhum tempo "perdido" no vaivém de cancelar+desfazer. Só re-renderiza
  se `Router.current().name === "preparos"` ainda.
- **Ticker único por tela** (`preparosTickInterval`, 1s): atualiza SÓ texto/classe dos chips já no
  DOM (nunca reconstrói a lista — evitaria recarregar foto/Wikipedia de cada sessão a cada
  segundo). Parado de forma idempotente no topo de `renderPreparosList` (re-render pelo próprio
  cancelamento não empilha um 2º interval) E no topo de `handleRoute` (sair de `#/preparos` por
  qualquer caminho nunca deixa o interval órfão rodando escondido) — mesmo princípio de
  `closeActiveFilterModal()` já chamado ali. Só é criado se houver ao menos 1 chip pra atualizar.

## Critérios de aceite

- A home deve parecer limpa em telas de 360px a 430px.
- O usuário deve entender cada bloco em até 2 segundos.
- A listagem não deve parecer desktop adaptado.
- O usuário não deve ver 30 opções de filtro ao mesmo tempo.
- O fluxo deve reduzir indecisão, não aumentar.

Todo prompt de design/UI também precisa passar pelo checklist de Heurísticas de Nielsen em
`.claude/skills/product-navigation-ux/SKILL.md` (seção "Checklist de aceite — Heurísticas de
Nielsen") antes de ser considerado concluído.
