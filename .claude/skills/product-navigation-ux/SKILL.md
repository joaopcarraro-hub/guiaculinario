---
name: product-navigation-ux
description: Planejar navegação, arquitetura de informação, grupos da home, páginas intermediárias, fluxos de decisão e priorização de UX para o app de receitas.
---

# Product Navigation UX

Use esta skill para decisões de navegação, arquitetura de informação e fluxo de decisão do produto.

## Proposta do produto

O app deve reduzir a indecisão de quem quer cozinhar.

Não competir com Google, YouTube ou blogs em quantidade.

Competir em:
- curadoria
- clareza
- decisão rápida
- execução guiada

## Estrutura de navegação correta

Home:
- grandes caminhos

Página de grupo:
- opções dentro daquele caminho

Página de coleção:
- receitas e refinamentos

Página da receita:
- execução

## Nova home (Bloco 2, Fase 2.2)

A home não mostra mais os 5 grupos macro diretamente. Mostra:
1. 4 tiles grandes: Massas, Proteínas, Navegar por Países, Sobremesas — cada um leva direto pra
   sua categoria/hub (Massas -> #/categoria/massas, Sobremesas -> #/categoria/sobremesas-classicas,
   Proteínas -> #/grupo/proteinas, Navegar por Países -> #/grupo/cozinhas).
2. "Mais categorias" — entrada pequena, num canto, ABAIXO dos tiles (era acima, invertido numa
   rodada de correção) — leva pro grupo `fundamentos` (#/grupo/fundamentos). O cabeçalho dessa
   tela mostra "Mais Categorias" (rótulo trocado de "Fundamentos", que não fazia sentido pra
   quem clicou num link chamado "Mais categorias") — só o `label` mudou; o `id`/`collectionGroup`
   internos continuam "fundamentos"/"Fundamentos", sem afetar a taxonomia de busca escopada.

Sem contador de progresso ("X de Y receitas já feitas") na home — removido (resíduo do sistema
antigo de tracking, redundante nesta tela).

Busca livre e os atalhos de Favoritos/Quero fazer/Histórico saíram da home — migram pra dentro
de "Minhas Receitas" (aba da barra inferior) num bloco futuro; a busca livre virou a aba
"Pesquisar" da barra inferior (reaproveita a rota #/busca já existente — ver seção própria
"Tela Pesquisar (vitrine, F1b)" abaixo pro que essa aba mostra hoje).

Tempo e Dificuldade continuam existindo como grupos/rotas próprios (#/grupo/tempo,
#/grupo/dificuldade) mas, neste bloco, sem link direto na HOME — só alcançáveis por URL direta
por ora. **Atualização F1b (2026-07-30):** ganharam o primeiro link real do app fora de URL
direta — a seção "Todas as categorias" da vitrine da Pesquisar lista TODAS as entradas de
`window.COLLECTIONS` sem filtro de grupo, então as 7 coleções órfãs (Por tempo ×4 + Por
dificuldade ×3) aparecem ali como qualquer outra. Os grupos/rotas em si (`#/grupo/tempo`,
`#/grupo/dificuldade`) continuam sem link — o que mudou é que as COLEÇÕES individuais de tempo/
dificuldade (ex. "Rápidas", "Fáceis") agora são alcançáveis por toque, só não a página de grupo
que as agrupa.

Massas e Sobremesas saíram da grade do grupo `fundamentos` (tela "Mais Categorias", ficam só
acessíveis via tile da home) — a taxonomia/grupo delas pra efeito de busca escopada continua
"Fundamentos" (`collectionGroup`, chave interna, não muda), só a exibição na grade que muda.

## Barra de navegação inferior

Fixa, 5 abas: Home, Pesquisar, Minhas Receitas, Preparos, Lista de Compras. Substitui o antigo
botão "Início" do topo (removido). Minhas Receitas, Preparos e Lista de Compras já são telas
reais (não placeholder mais) — Minhas Receitas (favoritas/já feitas em abas), Preparos (lista
de sessões de cozinha em andamento) e Lista de Compras (2 visões já funcionam: "Por receita" e
"Geral" com soma agrupada entre receitas por família de unidade, ver mobile-recipe-ui/SKILL.md).

## Tela Pesquisar (vitrine, F1b — 2026-07-30)

Até aqui, a aba "Pesquisar" só redirecionava pra `#/busca` vazio, caindo direto no modal de
facetas/mensagem genérica ("Escolha uma tag abaixo..."). F1b dá à Pesquisar uma vitrine própria
— mesma rota (`#/busca`), mesma `renderBusca`, só o ESTADO de query/tags vazios (dentro de
`renderResults`) que passa a montar 5 seções em vez da mensagem estática antiga. Ao digitar (ou
tocar um Momento/categoria, que também resulta em tags/texto não-vazios), a vitrine some e entra
a UI de resultados de sempre — mecanismo de troca já existia (`schedulePreview`), nenhuma lógica
nova de swap foi criada, só o CONTEÚDO do lado "vazio" mudou.

As 5 seções, nesta ordem:
1. Busca (o input de sempre, não faz parte da vitrine em si — sempre visível).
2. Buscas recentes — até 5 chips das últimas queries de TEXTO efetivadas (Enter ou tocar um chip
   do preview do parser; nunca tag/Momento/categoria, que já são atalhos próprios). Ausente por
   completo quando vazia (mesmo princípio do carrossel "Vistas recentemente" da Home). Cada chip
   tem 2 zonas de toque: o corpo reexecuta a busca (mesmo parser, `Search.parseQuery`), o × some
   só aquela entrada. Chave `gusta-buscas-v1` (mesma família de `gusta-recentes-v1`), teto 5.
3. Momentos — 5 atalhos fixos com foto (Café da Manhã, Rápidas, Sobremesas, Vegetarianas, Fim de
   Semana/Projetos Longos), cada um mapeado a 1 tag JÁ EXISTENTE na taxonomia (nenhuma tag nova
   foi criada). Toque em qualquer um chama `Router.toBusca([tagId], [], "or", null, "vitrine")`
   — NUNCA a rota de categoria dedicada (ver seção "Botão Voltar" acima: aquela rota tem destino
   de back-float FIXO — grupo dono da coleção ou Home — nunca a origem real). O 5º argumento
   ("vitrine") liga 2 coisas nos resultados (ver seção "Botão Voltar" acima pro back-float, e
   abaixo pro filtro): back-float "Voltar para Pesquisar" e filtro `nature === "prato"` — molho/
   técnica não é o que alguém chama de "Momento" (achado do dono, F1b acabamento: contagens
   reais antes/depois do filtro — Café da Manhã 9→9, Rápidas 130→95, Sobremesas 19→19,
   Vegetarianas 99→76, Fim de Semana 45→39; nenhum zerou). Filtro CONTIDO só na chamada dos
   Momentos (`initialOrigin === "vitrine"` dentro de `renderResults`), nunca no motor genérico —
   uma busca orgânica pelas mesmas tags continua vendo preparos/técnicas normalmente. Abrir uma
   receita a partir de um Momento e voltar cai de volta nos MESMOS resultados filtrados (fromHash
   já é a própria tela por construção). "Lanche" foi avaliado e CORTADO na Fase A de mapeamento
   (única tag candidata, `dish_type:sanduiche`, tinha 0 receitas) — regra dura do time: sem
   mapeamento limpo pra taxonomia já existente, o atalho não entra, nunca se inventa tag nova só
   pra preencher um Momento.
4. Sugestões de hoje — 6 receitas, embaralhadas por uma semente determinística = data local do
   dia (mesma seleção o dia inteiro, nova no dia seguinte), preferindo espalhar por categorias
   diferentes. Reusa o MESMO mini-card (foto 16:9 + nome, nada além) do carrossel "Vistas
   recentemente" da Home — 1 único componente compartilhado entre as 2 telas.
5. Todas as categorias — grade compacta de 3 colunas, MESMA fonte de dado e MESMO componente de
   tile das grades já existentes (`window.COLLECTIONS`/`renderCollectionCard`), sem nenhum
   filtro de grupo e sem excluir as coleções que só tinham tile grande da Home (Massas,
   Sobremesas). Diferença deliberada da grade "Mais Categorias" do hub Fundamentos (que SÓ
   mostra o grupo Fundamentos, excluindo essas 2): "todas" aqui é literal — ver nota na seção
   "Nova home" acima sobre Por tempo/Por dificuldade ganharem o primeiro link real do app aqui.

Ver `mobile-recipe-ui/SKILL.md` ("Vitrine da Pesquisar") pro detalhe visual/CSS completo e
`scripts/verify-pesquisar-vitrine-2026-07-30.js` pra suíte versionada.

## Botão Voltar (item 1 do roadmap — flutuante, expandido pra todas as telas com página-mãe)

**Rodada 1 (2026-07-25):** a página de receita (`renderReceita`) trocou o `.back-button`
contextual fixo do topo (texto "← Voltar para X") por um botão circular flutuante (`.back-float`,
`position: fixed`, topo-esquerda, acompanha o scroll — nunca esconde/mostra, sem variação
hide-on-scroll por enquanto). Isso foi só uma troca de APRESENTAÇÃO — o MECANISMO por baixo não
mudou: continua o mesmo `fromHash`/`currentHashPath()` de sempre, os mesmos 4 caminhos ("voltar
preservando contexto": Coleção, Busca, Minhas Receitas, busca inline de grupo/hub) intactos,
mesmo `Router.navigate(fromHash)` no clique. O rótulo que antes era texto visível ("Voltar para
X") virou `aria-label` dinâmico (o botão agora só tem o ícone `chevronLeft`), com a MESMA cadeia
de fallback de antes (coleção de origem → "Pesquisar" → "Minhas Receitas" → categoria da
receita).

**Rodada 2 (mesma data, leva aprovada em separado):** expandido pra TODA tela com página-mãe.
`renderGrupo` e `renderCategory` (cabeçalho de coleção) tinham seus PRÓPRIOS botões "← Voltar"
textuais — descritos numa versão anterior desta skill como "destino hardcoded pra Home", o que
só era exato pra `renderGrupo`; `renderCategory` já era dinâmico ANTES desta rodada
(`hideFromGrupoGrid` ? Home : grupo dono da coleção ? esse grupo : Home — correção registrada
aqui). Os dois agora usam o MESMO `.back-float`/`createBackFloat()` da receita (helper
compartilhado em `js/app.js`, nunca duplicado por tela) — só trocou o elemento, a lógica de
destino de cada um ficou idêntica à de antes:
- `renderGrupo`: destino sempre Home — único pai real dos 5 hubs (proteínas/países só têm tile
  na Home; "Mais Categorias" só tem o link da Home; tempo/dificuldade não têm NENHUM link hoje,
  só URL direta, mas Home segue sendo o único pai estrutural). Sem ambiguidade.
- `renderCategory`: destino = grupo dono da coleção (`GRUPOS.find` por `collectionGroup`), ou
  Home só nas 2 exceções `hideFromGrupoGrid` (massas, sobremesas-classicas — únicas 2 coleções
  linkadas direto da Home em vez de uma grade de grupo). Confirmado por grep que TODA coleção
  tem exatamente 1 entry point real (nunca 2), então nenhum caso ficou ambíguo nesta rodada — 0
  telas com TODO-1b pendente.

Ver `docs/DESIGN-TOKENS.md` ("Componentes") pra spec visual completa (dimensões, véu, z-index,
contraste) e `scripts/verify-back-float-2026-07-25.js` pra a suíte versionada (as duas rodadas).

Busca/Pesquisar, Minhas Receitas, Preparos e Lista de Compras são abas de nível superior da
barra inferior — não têm página-mãe (múltiplos entry points, ou nenhum "pai" conceitual, mesmo
comentário já existia no código antes desta tarefa) — não ganham `.back-float`.

**Exceção pontual — resultados alcançados por um Momento da vitrine (F1b acabamento,
2026-07-30, achado do dono: sem essa exceção, a única saída de "Fim de Semana" era remover a
tag manualmente).** Busca segue sem página-mãe fixa — a exceção é condicional, não uma 5ª tela
com pai definido. Regra exata: `renderBusca` ganha `.back-float` ("Voltar para Pesquisar")
SÓ quando a tela de resultados foi alcançada por NAVEGAÇÃO com origem explícita
(`Router.toBusca(..., "vitrine")`, hoje só o toque num Momento) E há resultado (tags/texto não
vazios) — nunca na própria vitrine. Destino sempre `Router.toBusca([], [])`, determinístico,
nunca `history.back()` cru (mesma regra de todo `.back-float` do app). Estado ORGANICAMENTE
CONSTRUÍDO dentro da própria tela — digitar e confirmar, tocar um chip/facet, tirar um filtro —
NUNCA ganha o float: `goTo`/`goToTags` (os 2 pontos que materializam qualquer refinamento
manual em `js/app.js`) nunca passam esse 5º argumento pra `Router.toBusca`, propositalmente —
ali o × de cada chip e "Remover filtro" seguem sendo a saída natural, igual sempre foi. Como
toda navegação por `Router.toBusca` recria `renderBusca` do zero, o float aparece/some sozinho
a cada troca real de rota — nenhum código reage "ao vivo" enquanto o usuário digita em cima de
um resultado que veio de Momento. Trava em `scripts/verify-nav-graph-2026-07-30.js` (seção 8:
condição exata, destino, teste negativo do caminho orgânico) — `createBackFloat(` subiu de 4
pra 5 ocorrências, censo atualizado conscientemente, não só o número.

A regra de navegação, já valendo antes desta rodada e reafirmada aqui: o botão voltar deve
SEMPRE voltar pra última tela realmente visitada pelo usuário (histórico real de navegação —
`fromHash`/`history.back()`/equivalente), NUNCA um destino fixo hardcoded na tela (ex.:
"#/categoria/X" cravado no código, ignorando de onde o usuário realmente veio). Onde não existe
histórico de verdade (grupo/categoria não usam fromHash, usam navegação direta) mas o pai é
estrutural e único, voltar pro pai real conta como cumprir a regra — só vira "hardcoded ruim"
se o destino for fixo APESAR de existir mais de um caminho real de chegada.

**Colapso de zigue-zague (item 3, 2026-07-28) — regra nova do mecanismo `fromHash`/histórico
(`js/router.js`):** ao empilhar uma navegação nova, se o destino é o MESMO hash do nível
PENÚLTIMO (o que "voltar 1 passo" já alcançaria), o router COLAPSA — usa `history.go(-1)` em vez
de empilhar mais uma entrada duplicada. Sem isso, alternar entre 2 telas via navegação PRÓPRIA do
app (não um "voltar" de histórico) — o caso real: receita → preparo → nome da receita no
cabeçalho do modo cozinhar, que é `Router.toReceita` de novo, NÃO um voltar — empilhava
duplicatas alternadas; o botão/gesto de voltar NATIVO do sistema (único jeito de sair do modo
cozinhar sem usar "Sair", já que aquela tela nunca tem back-float, ver exceção abaixo) repetia a
zigue-zague inteira em vez de avançar pro que veio antes. Exemplo (o mesmo do pedido original):
receita → preparo → receita → preparo → voltar → voltar deve dar receita → origem, SEM repetir
preparo — confirmado ao vivo (navegação real do navegador, não simulada) e num simulador de
histórico de navegador em `scripts/verify-protein-search-nav-2026-07-28.js` (teste-tabela de
sequências, incl. um teste negativo de que os 4 caminhos "voltar preservando contexto" abaixo
continuam idênticos — o colapso não muda NENHUM resultado observável desses 4, só evita duplicar
entradas no histórico real quando o destino já é o penúltimo nível). Mecanismo é TRANSPARENTE ao
resto do app — `fromHash`/`currentHashPath()` continuam exatamente como sempre, nenhum call site
em app.js precisou mudar.

**Rodada 3 (item 4 do roadmap-mestre, carrossel "Vistas recentemente" da home):** `fromHash =
"home"` (string literal) é um valor PÚBLICO e documentado do contrato de `fromHash` — origem:
os mini-cards do carrossel de recentes, único lugar que emite esse valor
(`Router.toReceita(id, "home")` em `buildRecentlyViewedSection`, `js/app.js`). `parseHash`
(`js/router.js`) trata `"home"` explicitamente, ao lado do `raw` vazio de sempre — não depende
do fallback genérico do fim da função — e `renderReceita` calcula `fromHome` à parte pro rótulo
do back-float ("Início"), pelo mesmo motivo que `fromBusca`/`fromMinhasReceitas` já tinham rótulo
próprio. Suíte dedicada em `scripts/verify-recentes-ui-2026-07-25.js`.

**Rodada 4 (Dívida #3, 2026-07-30) — 2 furos fechados, premissa vira invariante travada:** Lista
de Compras (nome da receita, `Router.toReceita`) e Preparos (retomar sessão, `Router.toCozinhar`)
navegavam SEM fromHash — Voltar caía na categoria da receita em vez da tela de origem real,
violando a regra da seção acima. As duas chamadas ganharam o 2º argumento (`"lista-compras"` e
`"preparos"`, mesmo padrão de `"home"` na Rodada 3); `renderReceita` ganhou `fromListaCompras`/
`fromPreparos` e os 2 elos correspondentes no ternário de `backDestLabel`. Os "4 caminhos" viram
6, contando por rótulo distinto no ternário: categoria, busca, minhas-receitas, home,
lista-compras, preparos (o fallback pra categoria da receita fica de fora da contagem — só
dispara sem NENHUM fromHash, deep link/bookmark). A premissa "cada coleção tem UM caminho de
entrada" (que justifica o back-float com destino calculado em `renderGrupo`/`renderCategory`, ver
parágrafos acima) deixa de ser só documentada em prosa e vira invariante TRAVADA: cada coleção
tem exatamente os 4 pontos de entrada censados em `scripts/verify-nav-graph-2026-07-30.js`
(`Router.toCategoria(` = 4). Call site novo de `Router.to*` quebra essa suíte de propósito — ao
aparecer um, atualizar o censo E decidir conscientemente o mecanismo de volta (fromHash vs
destino estrutural calculado) antes de dar green, nunca só ajustar o número pra fazer passar.

EXCEÇÃO: a tela do modo de preparo (cozinhar) NUNCA deve ter botão voltar adicional — só o
botão "Sair do modo cozinhar" resolve a saída daquela tela, e continua sendo o ÚNICO controle
flutuante ali (nenhum `.back-float` nunca deve aparecer no modo cozinhar). Rodada 2: esse botão
virou pílula flutuante (`.exit-cook-float`, `createExitCookFloat()` em app.js — ícone `close` já
existente da Fase 0c + texto "Sair", mesma linguagem visual do `.back-float`: véu, borda,
z-float, estados), devolvendo o peso visual que o ✕ removido na Fase 0c dava. Continua sendo
"sair", não "voltar" — `aria-label` fixo "Sair do modo cozinhar", nunca dinâmico. Nenhum botão
de voltar extra deve ser adicionado ali, mesmo depois do redesenho.

Isso NÃO impede um botão de navegação DIFERENTE de "voltar" — o nome da receita no cabeçalho
(`.cook-title__link`, usando a classe compartilhada `.text-link`: texto + ícone arrowUpRight
colado, mesmo padrão do nome de receita em `.shopping-list__recipe-name-link` na Lista de
Compras) leva pra tela da RECEITA especificamente (`Router.toReceita`), não é um "voltar"
genérico por histórico. Limpa `timerInterval` antes de navegar (mesma proteção contra o "timer
fantasma" que o `exitBtn` já tinha) — sem isso o timer continuaria rodando escondido.

**Entrada em `#/cozinhar` por um passo específico (Fase multi-timer, 2026-07-30).** O corpo do
card de Preparos continua abrindo a sessão em `session.currentStep` (retomar de onde parou, sem
mudança). Um chip de timer dentro do card (`.preparo-timer-chip__body`, ver mobile-recipe-ui/
SKILL.md "Preparos — pilha de timers") é uma 2ª porta de entrada pro MESMO `#/cozinhar/:id`: grava
`Storage.savePreparoStep(recipeId, stepIndex)` — o stepIndex DAQUELE chip, não necessariamente o
currentStep — ANTES de chamar `Router.toCozinhar(recipeId, "preparos")` (mesmo fromHash "preparos"
de sempre, nenhum argumento novo no Router). `renderCookMode` sempre resume em
`session.currentStep`, então gravar o passo alvo primeiro é o que faz a tela abrir exatamente
nele, sem precisar de um mecanismo de navegação novo. stopPropagation no chip evita que o clique
vaze pro onclick do card (que abriria em currentStep por cima).

**Mais uma porta de entrada: toast de conclusão (Fase indicadores, 2026-07-30).** O corpo do
toast global que avisa quando um timer vence fora da tela de Preparos (ver mobile-recipe-ui/
SKILL.md "Preparos — indicadores de conclusão") é uma 3ª porta pro MESMO `#/cozinhar/:id`, MESMO
mecanismo do chip acima: grava `Storage.savePreparoStep(recipeId, stepIndex)` antes de
`Router.toCozinhar(recipeId, "preparos")`, mesmo fromHash "preparos" de sempre. Não é um
mecanismo de volta novo — `Router.toCozinhar(` agora aparece 4x no código (censo travado em
`scripts/verify-nav-graph-2026-07-30.js`), e qualquer 5ª chamada futura precisa atualizar esse
censo conscientemente, nunca só ajustar o número. Esta é a ÚNICA navegação disparada por um
elemento que vive fora de `#recipes-content`/`#bottom-nav` (o toast é `document.body.appendChild`
direto, mesma família do `.filter-modal-overlay`/`.update-toast` — ver whitelist de
`pointer-events` no CSS) — mas o destino e a regra de origem (fromHash) são idênticos às outras
portas, nenhuma exceção nova na tabela de Voltar.

## Páginas intermediárias

Cada grupo tem sua própria página (independente de estar linkada na home ou não).

Exemplos:
#/grupo/fundamentos
#/grupo/proteinas
#/grupo/cozinhas
#/grupo/tempo
#/grupo/dificuldade

A página de grupo deve ter busca contextual escopada àquele grupo — "opções" inclui tanto as
categorias/coleções do grupo (por nome) quanto receitas do grupo que batem em tag de
ingrediente, mostradas numa seção separada. Nunca traz opção nem receita de outro grupo.

**Banner de hub (item 6 do roadmap-mestre, 2026-07-26) — só nos 3 hubs alcançáveis por link real
da Home (Mais Categorias/Proteínas/Países; tempo/dificuldade continuam com o título simples de
sempre, sem imagem, sem link nenhum no app hoje).** Imagem de categoria/hub borrada em faixa no
topo (`.grupo-banner`) + folha (`.grupo-sheet`) que sobrepõe a base do banner — título (agora
serif) e a busca do hub vivem sempre na folha, nunca sobre o blur (mesma gramática de
`.recipe-hero`/`.recipe-page`, ver skill `mobile-recipe-ui`, seção "Item 6"). **Descrição
textual do hub morreu** de vez nesta rodada (decisão antiga do roadmap, fechada aqui) — nenhum
grupo mostra mais `grupo.desc`, bannerizado ou não. O back-float (botão voltar, ver seção
própria abaixo) passa a sentar sobre o banner nos 3 hubs com imagem — mesma exceção
"float sobre mídia" que a página de receita já tinha, hubs sem banner continuam com o respiro
`--chrome-clearance` de sempre.

## Ordem de decisão

A navegação deve seguir:
1. O usuário escolhe um caminho macro.
2. Escolhe uma opção dentro do caminho.
3. Refina se necessário.
4. Abre uma receita.
5. Cozinha.

## Princípio anti-overwhelm

Não mostrar todas as possibilidades ao mesmo tempo.

Dentro de uma coleção (país, proteína, tempo, dificuldade, fundamentos), o refino é um MODAL
de filtros em acordeão (Bloco 3) — não mais uma barra sempre-visível. Um botão "Filtros" (com
badge de contagem de filtros ativos) fica no lugar de onde a barra ficava; abre um modal cheio
de tela com 8 seções em acordeão: País, Complexidade, Tempo, Equipamento, Proteína, Refeição,
Tipo de prato, Ingrediente. "Papel da proteína" deixou de ser a 9ª seção própria (item 1b,
2026-07-28) — virou sub-controle DENTRO do corpo de Proteína. Deixou de valer só em coleções
de proteína (correção de semântica, 2026-07-29) — aparece em QUALQUER contexto (busca global
incluída) sempre que houver pelo menos 1 proteína ATIVA, ver parágrafo próprio mais abaixo.
Cada seção de topo mostra a contagem de opções no cabeçalho
e, se já tiver algo selecionado, um resumo (ex.: "Brasil", "2 selecionados"). Mudanças dentro
do modal ficam em RASCUNHO — só se aplicam de fato ao tocar "Ver resultados (N)" (N = contagem
ao vivo do resultado combinado); "Cancelar" fecha sem aplicar nada. "Limpar filtros" continua
existindo dentro do modal, só aparece quando há pelo menos 1 filtro ativo, mas NÃO aplica nem
fecha sozinho — zera só o RASCUNHO (todas as seções voltam a "Todos"/nenhuma selecionada,
rodapé recalcula pra contagem sem filtro) e mantém o modal aberto; o usuário ainda confirma em
"Ver resultados" ou desiste em "Cancelar", como qualquer outra mudança de faceta.

Cada seção só lista os valores presentes no resultado atual, com contagem, e nada vem
pré-selecionado (default = item "Todos" marcado). Duas famílias de multi-seleção coexistem, e
nenhuma vaza pra outra:
- País, Complexidade, Tempo, Equipamento, Proteína, Refeição, Tipo de prato: OR PURO entre os
  valores da MESMA faceta (união — ex.: País = Itália + Alemanha mostra receitas de qualquer
  um dos dois). Nunca zera ao adicionar mais um valor, então não tem fallback nenhum aqui.
  Complexidade/Tempo/Tipo de prato/Proteína/Refeição são CHIPS (pill `role="checkbox"`, Fase
  F1a — substituiu tanto a lista de checkbox nativa quanto o "tile" sem ícone real que
  Proteína/Refeição tinham antes); só País e Equipamento continuam grade de tiles de verdade
  (imagem/ícone real). Sem tile/chip "Todos"; nenhum marcado = nenhum filtro ativo.
  Proteína (`protein:`) não deve ser confundida com "Papel da proteína" (seleção única
  Principal/Secundário/Ver tudo (rótulo revisto 2026-07-29, era "Tanto faz") — desde o item 1b, 2026-07-28, um SUB-CONTROLE no topo do
  corpo da própria seção Proteína, não mais uma seção à parte, ver parágrafo abaixo) — Proteína
  pergunta QUAL proteína e fica disponível em qualquer coleção/busca; as duas são eixos
  independentes que se combinam em AND normalmente. Proteína conta só `protein:X`
  (protagonista), nunca soma com `contains:X` (secundário) — mesma semântica de "Papel da
  proteína = Principal". Correção de semântica (2026-07-29): S (conjunto de proteínas que o
  papel qualifica) = o que está EXPLICITAMENTE selecionado nesta mesma faceta Proteína; sem
  nada selecionado, cai pro implícito da coleção quando ela for de proteína (`TagModel.
  splitByProteinRole` em tagmodel.js, OR entre as proteínas de S — uma receita com 2 delas ao
  mesmo tempo só conta 1x).
  "Restrições" (`diet:`) NÃO virou faceta: cobertura de 99/398 (24,9%) e um único valor
  (`diet:vegetariana`), abaixo do limiar combinado com o usuário — fica pro backlog de
  expansão de dados. Ver `.claude/skills/mobile-recipe-ui/SKILL.md` pro detalhe visual.
- Ingrediente: chips removíveis + campo de adicionar (grade de tiles), MAIS um trilho único em
  pílula com trava deslizante ("Qualquer um destes"/"Todos estes", NÃO 2 botões separados)
  numa linha própria ANTES dos chips, logo abaixo do cabeçalho do acordeão — só aparece com 2+
  ingredientes selecionados (0/1 não tem o que combinar, elemento removido do DOM). "Qualquer
  um destes" (or) é o default; a escolha fica no próprio modal, persistida junto com a seleção
  de ingredientes (mesma URL). Substituiu o antigo fallback reativo que vivia na tela de
  RESULTADOS (só aparecia depois de um AND zerar) — agora a escolha é proativa, ANTES de zerar,
  direto onde os ingredientes são selecionados.

ENTRE facetas diferentes (País × Equipamento × Ingrediente etc.) sempre é AND, mesmo quando
cada faceta individualmente é OR por dentro — ex.: País=Itália+Alemanha E Equipamento=Forno
mostra a interseção do OR de país com o equipamento, nunca OR entre tudo.

Proteínas ganham um sub-controle a mais dentro da própria seção Proteína, "Papel da proteína":
Principal / Secundário / Ver tudo (default; rótulo revisto 2026-07-29, era "Tanto faz" — mecanismo idêntico, só o texto mudou). Isso substituiu o antigo conceito de abas "Foco
da receita / Também leva / Todas" (Fase F1a) e, desde o item 1b (2026-07-28), deixou de ser uma
seção própria do acordeão — vive no topo do corpo de Proteína, mesmo padrão de POSIÇÃO do toggle
Qualquer um/Todos estes de Ingrediente acima. Desde o ajuste visual do mesmo dia (rodada 2), é
literalmente o MESMO componente de trilho deslizante que Ingrediente usa (generalizado pra N
segmentos) — não mais 3 pílulas soltas; ver `.claude/skills/mobile-recipe-ui/SKILL.md` pro
detalhe visual/mecânico completo.

**Correção de semântica (2026-07-29) — vale no APP INTEIRO, não só em coleção de proteína.**
Visibilidade dinâmica, reavaliada a cada mudança de rascunho: o sub-controle aparece (com
transição curta, tokens de motion existentes) sempre que há >=1 proteína ATIVA — explícita
(chip da faceta Proteína marcado, em QUALQUER coleção ou na busca global) OU implícita (dentro
de uma coleção de proteína sem nenhum chip explicitamente marcado, comportamento de sempre,
agora um caso particular). Desselecionar a última proteína ativa, quando não há implícito de
coleção pra cair de volta, esconde o sub-controle E reseta o papel pra Ver tudo — nunca fica
"fantasma" (Principal/Secundário ativo sem nenhuma proteína selecionada). Mecanismo:
`TagModel.splitByProteinRole(items, S)` — Principal = `protein:X` literal presente pra QUALQUER
X do conjunto S selecionado; Secundário = nenhum `protein:X` de S literal, mas `contains:X`
presente pra qualquer X de S (OR entre as proteínas do conjunto — uma receita com 2 delas ao
mesmo tempo só conta 1x, nunca soma por tag isolada). Coleção de proteína sem nada
explicitamente selecionado continua idêntica a antes (S = proteína implícita da coleção) —
EXCETO Ovos, mudança deliberada: "Secundário" caiu de 104 pra 17 receitas (a regra única não
soma mais `ingredient:ovo` solto — ovo como simples ingrediente de bolo/pão/massa, um sinal
bem mais largo que `contains:ovo`, que a coleção usava sozinha antes desta correção).

## Tema visual (Bloco 4)

O app é 100% tema escuro — não há mais tela remanescente na paleta clara antiga nem
inconsistência visual entre blocos de redesign. Detalhamento de cores/tokens em
`.claude/skills/mobile-recipe-ui/SKILL.md` (seção "Reskin escuro (Bloco 4)"); esta skill trata
só de navegação/IA, não de cor.

## Critérios de aceite

- A home deve ficar curta.
- O usuário deve saber onde clicar.
- A busca contextual não deve misturar níveis.
- Categorias duplicadas devem ser eliminadas.
- Brasil deve entrar dentro de Países.
- Tempo e dificuldade devem existir como caminhos próprios.

## Checklist de aceite — Heurísticas de Nielsen

Todo prompt de design/UI a partir de agora deve ser avaliado contra esta lista antes de ser
considerado concluído — não é opcional, é parte do critério de "pronto".

1. **Visibilidade do status do sistema** — o usuário sempre sabe o que está acontecendo (contagem
   de receitas, filtros ativos, estado de carregamento), sem precisar adivinhar.
2. **Correspondência entre o sistema e o mundo real** — linguagem, ícones e fluxo usam os termos
   e a lógica de quem cozinha, não jargão técnico do sistema de tags.
3. **Controle e liberdade do usuário** — sempre existe uma saída clara (voltar, desfazer, limpar
   filtros) sem precisar recarregar a página ou navegar às cegas.
4. **Consistência e padrões** — o mesmo tipo de controle se comporta do mesmo jeito em toda a
   navegação (ex.: todos os dropdowns single-select funcionam igual, exceto Ingrediente, que é a
   exceção documentada e assumida).
5. **Prevenção de erros** — a interface evita que o usuário chegue a um estado inválido ou vazio
   sem explicação (ex.: o toggle Qualquer um/Todos estes do Ingrediente, escolhido ANTES de
   zerar, em vez de só reagir depois de já mostrar "0 receitas").
6. **Reconhecimento em vez de memorização** — opções e filtros ficam visíveis e com contagem, o
   usuário não precisa lembrar o que já selecionou em outra tela.
7. **Flexibilidade e eficiência de uso** — atalhos pra quem sabe o que quer (busca direta, tags
   clicáveis) sem obrigar todo mundo a passar pelo funil completo.
8. **Design estético e minimalista** — só mostra o que ajuda a decidir nesse momento; informação
   extra fica escondida até ser relevante (princípio anti-overwhelm já documentado acima).
9. **Ajudar o usuário a reconhecer, diagnosticar e se recuperar de erros** — mensagens de estado
   vazio ("Nenhuma receita com esses filtros") sempre vêm com uma ação clara pra sair do buraco,
   não só a constatação do problema.
10. **Ajuda e documentação** — quando a interface não é auto-explicativa, o texto de apoio
    (descrição do grupo/coleção, placeholder de busca) cobre a lacuna sem exigir manual.
