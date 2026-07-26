# Design Tokens — v3 (final), baseado no Design System v1.0 de vocês + marca oficial

> Substitui as versões anteriores. Base: o PDF "Design System v1.0" (dark theme), com 3 ajustes
> aplicados após confirmação: cor de ação atualizada pra bater com a marca real (logo/ícone
> medidos por pixel), separação entre creme de marca e creme de texto, e correção do Error
> (que ficaria perto demais do novo acento mais saturado). Fonte única de verdade visual —
> todo prompt de UI referencia este arquivo.

---

## Identidade de marca

Nome: **Gusta**. Tagline: "Da dúvida ao prato pronto." Assets: `logo_completa.png` (wordmark +
tagline) e `Simbolo_app.png` (ícone do app, fundo vermelho + símbolo "g" com coração e brilho).

## Paleta de cor

| Token | Valor | Origem/nota |
|---|---|---|
| `--color-bg` | `#0F0F0E` | PDF original |
| `--color-bg-secondary` | `#181816` | PDF original |
| `--color-surface` | `#232321` | PDF original |
| `--color-surface-elevated` | `#2E2D2A` | PDF original |
| `--color-border` | `#3B3935` | PDF original |
| `--color-text-primary` | `#F5F1EA` | PDF original — creme NEUTRO, uso em texto de corpo/volume |
| `--color-text-secondary` | `#C5BFB5` | PDF original |
| `--color-text-disabled` | `#8E8981` | **ATUALIZADO (Fase 0a)** — era `#8D877F` (PDF original), clareado pelo mínimo necessário (mesmo matiz/saturação, busca binária). O valor original falhava AA sobre `--color-surface` (4,43:1, precisa 4,5:1); o novo passa nos 3 fundos onde é usado: `--color-surface` 4,53:1, `--color-bg` 5,52:1, `--color-bg-secondary` 5,12:1 |
| `--color-brand-cream` | `#FBEBD7` | **NOVO** — creme SATURADO da marca (medido do logo). Reservado pra momentos de marca (símbolo, splash futura), NUNCA texto de corpo — satura demais em volume |
| `--color-accent` (Tomate Assado) | `#D63B20` | **ATUALIZADO** — era `#B84C33` no PDF; agora é o vermelho real medido do ícone/logo. Única cor de ação/interação, por regra do próprio PDF ("apenas para ações") |
| `--color-accent-hover` | `#A33F2A` | PDF original — reavaliar contraste se o acento mudar de tom no futuro |
| `--color-accent-text` | `#E04527` | **NOVO** — versão mais clara de `--color-accent`, SÓ pra texto peso regular sobre `--color-bg` (nunca ícone/borda/preenchimento, que continuam `--color-accent`). `--color-accent` puro em peso regular passa de 18px+ mas falha 4,5:1 AA (4,11:1 medido); mesmo matiz/saturação (~9°, ~74%), lightness calibrada por busca binária com a fórmula de luminância do WCAG até cravar ≥4,5:1 (4,61:1 medido) — não é estimativa. Usado em `.text-link` (nome da receita clicável, modo de preparo e Lista de Compras) |
| `--color-accent-deep` | `#CB381E` | **NOVO (Fase 0a)** — versão escurecida de `--color-accent`, pra fundo SÓLIDO que carrega texto `--color-text-primary` em cima (`.primary-cta`, `.action-btn.active`, badges, chips selecionados, botões do modo cozinhar). `--color-accent` puro só passa 4,5:1 com texto grande (≥18,66px bold) — os usos reais são todos texto normal menor. Mesmo matiz/saturação, lightness calibrada por busca binária até cravar ≥4,5:1 com `--color-text-primary` em cima (4,52:1 medido). Continua passando 3:1 como uso gráfico (3,77:1 contra `--color-bg`). `--color-accent` puro continua a cor de ação padrão pra ícone/borda/realce sem texto por cima — `--color-accent-deep` é só pro caso específico de fill com texto |
| `--color-accent-soft` | `rgba(214, 59, 32, 0.08)` | **NOVO (Fase 0a)** — nome pro literal que já existia repetido 8× no CSS sem token (fundo tingido suave: badge, aba ativa, hover de chip, CTA do card). Derivado do acento CLARO, não do `--color-accent-deep` |
| `--color-success` | `#76945B` | PDF original |
| `--color-error` | `#E63950` | **ATUALIZADO** — era `#D24E47`, muito próximo do acento em matiz (8,3°, pior ainda depois do acento ficar mais saturado: 5,9°). Novo valor tem 16,9° de separação, mantém conotação de "vermelho de alerta", passa WCAG AA (4,63:1) |
| `--color-info` | `#5D87A8` | PDF original |
| `--color-accent-light` | `#D97A45` | ⚠️ **SEM REGRA DE USO DEFINIDA** — ver pendência abaixo |
| `--color-highlight` | `#D9A441` | ⚠️ **SEM REGRA DE USO DEFINIDA** — ver pendência abaixo |

## Tipografia — Fase 0b (2026-07-25)
Decisão final: títulos/nomes em serif (`--font-display`), resto em sans do sistema
(`--font-ui`) — direção que já estava registrada como pendência da Fase 0a, implementada aqui.
Zero ocorrências de Inter/SF Pro/Roboto seguem confirmadas (a escala Inter do rascunho nunca
foi implementada); a tabela Display/H1/H2/H3/Body/Caption/Small do rascunho anterior fica só
como referência histórica de tamanho/peso, substituída pela escala de 6 degraus abaixo.

**Famílias:**
- `--font-ui`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` — `body` e todo o app, exceto os 3 seletores de NOME/título abaixo.
- `--font-display`: `ui-serif, Georgia, 'Iowan Old Style', 'Palatino Linotype', serif` — SOMENTE título da receita (`.recipe-page-title h2`), título no card de receita (`.recipe-title h3`) e título de categoria/hub (`#category-header h2`). Peso sempre 400 nesses 3 (o peso serif vem do desenho da própria fonte, não de font-weight).
  - **Home:** não existe hoje um título de página na home — `renderHome` só monta os tiles principais e "Mais categorias", ambos `<button>` (excluídos por regra: botões nunca levam serif). Se um título de página entrar na home no futuro, ele se junta a esta lista.
  - Botões, chips, nav, metadados, labels de seção uppercase (ex. "INGREDIENTES"), inputs e copy funcional ficam sempre em `--font-ui`, mesmo quando visualmente grandes.

**Escala de tamanho (raiz 16px, piso 12px — nada abaixo de `--text-xs`):**

| Token | rem | px |
|---|---|---|
| `--text-xs` | 0.75rem | 12px |
| `--text-sm` | 0.875rem | 14px |
| `--text-base` | 1rem | 16px |
| `--text-md` | 1.1875rem | 19px |
| `--text-lg` | 1.5rem | 24px |
| `--text-xl` | 1.875rem | 30px |

93 dos 95 `font-size` do CSS foram mapeados pro degrau mais próximo (o 95º é a raiz
`:root{font-size:16px}`, não um estilo de componente — não entra na contagem de mapeamento).
Nenhum valor caiu exatamente numa das 5 fronteiras da escala (13/15/17,5/21,5/27px), então a
regra de desempate por papel (título → degrau maior, UI/metadata → degrau menor) não chegou a
ser usada na prática — registrada mesmo assim pra mapeamentos futuros. Rótulo da bottom-nav
(0.66rem/10,56px) sobe pro piso `--text-xs` (12px) — intencional, verificado sem quebra de
layout na nav.

**Exceções documentadas (fora da escala — tamanho de componente, não tipografia de texto):**
- `.cook-timer-display` (dígitos do timer, `font-variant-numeric: tabular-nums`): `2.2rem`
  literal, com comentário no CSS.
- `.recipe-hero` (ícone de placeholder quando a receita não tem foto): `3.5rem` literal, com
  comentário no CSS. Mapear pro `--text-xl` (30px) encolheria o ícone quase pela metade
  (56px→30px) — achado durante a implementação: o `3.5rem` citado originalmente como "dígitos
  do timer" pertence na verdade a este ícone, não ao timer (que é 2,2rem); corrigido aqui.

**Pesos:** todo `bold`/`700` em contexto sans virou `600` (16 ocorrências). Serif display
sempre `400`.

**Leading (line-height):**

| Token | Valor | Uso |
|---|---|---|
| `--leading-tight` | 1.2 | títulos |
| `--leading-snug` | 1.35 | UI |
| `--leading-base` | 1.55 | leitura (descrição, ingredientes, passos) |

Os 8 valores encontrados no CSS (1 · 1,15 · 1,2 · 1,25 · 1,35 · 1,4 · 1,5 · 1,55) foram
mapeados pro degrau mais próximo, sem empate exato em nenhuma das 2 fronteiras (1,275/1,45).

**Tracking (letter-spacing) do serif display — substitui a regra flat da Fase 0a:**
Escala com o tamanho do PRÓPRIO serif display, recalibrada pra Georgia (a regra anterior,
-0.02em fixo nos "2 maiores títulos", foi calibrada pra Helvetica Neue, que fecha entreletra
menos e tolera mais tracking negativo que um serif):

| Tamanho do serif display | letter-spacing |
|---|---|
| >=28px | -0.015em |
| 20–27px | -0.01em |
| <20px | 0 (sem tracking negativo) |

Aplicado hoje: `#category-header h2` e `.recipe-page-title h2` (ambos 30px, tier >=28px →
-0.015em) e `.recipe-title h3` (19px, tier <20px → 0). Nenhum título atual cai no tier
intermediário (20–27px) — registrado mesmo assim pra próximos títulos nessa faixa. Elementos
sans (chips, labels uppercase etc.) mantêm seus valores de tracking positivo existentes
(0,04–0,06em), não afetados por esta regra.

## Grid e espaçamento — Fase 0b (2026-07-25)
Grade de 4px, 10 degraus (substitui a lista solta "4, 8, 12, 16, 24, 32, 40" — mesma base,
agora com tokens, piso de 2px e o degrau de 20px preenchendo o furo entre 16 e 24):

| Token | Valor |
|---|---|
| `--space-05` | 2px |
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |

**Regra pra todo espaçamento novo:** usa um destes tokens; um valor fora da escala exige
comentário no CSS justificando (ex. geometria derivada de outro valor, não decoração).

Os 211 valores literais de `margin`/`padding`/`gap` do CSS (incl. dentro de `calc()`, excluindo
`0` sem unidade — esse não precisa de token) foram mapeados pro degrau mais próximo; empate
arredonda pra cima (6→8, 10→12, 14→16, 18→20, 22→24, 30→32, 34→32; 26px não é empate, 24 é o
mais próximo). Valores abaixo de 4px mapeiam pro mais próximo entre 2 e 4.

**Exceção documentada:** `.cook-timer-wheel` `padding: 44px 0` ficou literal — não é decorativo,
é geometria derivada (altura da coluna 132px menos altura do item 44px, dividido por 2) que
centraliza o item na faixa de destaque; arredondar pro empate (`--space-12`, 48px) quebraria
essa centralização.

**Margens negativas (2 no CSS, cada uma é ajuste óptico, revisão visual do dono pendente):**
- `.recipe-page-tags`: `-6px` → `calc(var(--space-2) * -1)` (-8px). Empate (6 é equidistante
  de 4 e 8); aplicado o mesmo arredondamento pra cima da regra geral.
- `.cook-step-ingredients`: `-12px` → `calc(var(--space-3) * -1)` (-12px, valor idêntico,
  só virou token — já batia exato com a escala).

44px de área de toque (ex. `min-height`/`min-width` dos alvos de toque) e os insets de
hit-area em `::after` (Fase 0a) NÃO são espaçamento — não entraram neste mapeamento.

Padding padrão de card: 16px (`--space-4`). Margem lateral: 20px (`--space-5`).

Alvos de toque pequenos (ícones abaixo de ~44px, ex.: coração do card 32px, botões +/- do
portion-stepper 30px) ganham hit-padding invisível de ~10px sem mudar o tamanho visual do
ícone — mesmo princípio de área de toque confortável já usado onde o elemento bate 44px
diretamente. Quando 2 alvos desse tipo ficam lado a lado com pouco espaço entre si (ex. os
botões +/- do portion-stepper, gap de 6px), o padding horizontal é reduzido pra não sobrepor
e criar ambiguidade de toque no meio (3px em vez de 10px nesse eixo específico).

## Camadas (z-index) — Fase 0a
Antes 4 valores literais soltos (1 / 1100 / 1300 / 1400, sem relação documentada). Agora uma
escala de tokens: `--z-raised: 1` · `--z-float: 1000` (botão de voltar flutuante da página de
receita, `.back-float` — **implementado**, ver "Componentes" abaixo) · `--z-nav: 1100` (bottom
nav) · `--z-modal: 1300` (overlay do modal de filtros) · `--z-toast: 1400` (toast de
atualização). A foto de topo fixa do redesenho futuro da página de receita (item 1 da seção
"Deixar pro Fable, depois" do CHECKLIST-GERAL.md) fica ABAIXO do conteúdo que desliza por cima
— não entra nesta escala, resolve pela ordem natural do fluxo.

## Nomenclatura de tokens — Fase 0a
`--color-*` é a nomenclatura OFICIAL. Os nomes antigos (`--bg`, `--bg-panel`, `--ink`,
`--ink-soft`, `--gold`, `--line`, `--green`, `--red`) seguem declarados em `:root` só como
ALIAS (`var(--color-*)`) por segurança nesta fase — nenhuma regra do CSS os referencia mais
diretamente. Remoção dos alias fica pra uma rodada futura.

## Componentes
- Botão primário: fundo `--color-accent`, texto `--color-text-primary`, raio pill.
- Botão secundário: fundo `--color-surface`, borda `--color-border`.
- Ghost: texto `--color-accent` — **restrição de acessibilidade:** só usar em texto grande de
  verdade pelo critério exato do WCAG (≥24px peso regular, ou ≥18,66px em bold); em texto
  normal (a maioria dos casos, mesmo 19px+ se não for bold) o contraste falha AA. Pra texto
  normal que precise da cor de ação, use `--color-accent-text` em vez de `--color-accent` —
  calibrado especificamente pra passar 4,5:1 nesse peso (ver tabela acima).
- FAB circular, `--color-accent`.
- Cards: raio `var(--radius)` = **14px** (**corrigido, Fase 0a** — este documento dizia 20px,
  mas o token `--radius` sempre foi 14px; os únicos 2 usos de 20px literal no CSS não são o
  card de receita padrão. 20px fica registrado como possível revisão de design futura, não
  como bug — por ora o valor real é 14px).
- Inputs: fundo `--color-surface`, borda `--color-border`, foco `--color-accent`.
- Chips: fundo `--color-surface-elevated`, ícone de remover em `--color-accent`.
- Bottom Navigation: fundo `--color-bg-secondary`; ativo — ícone `--color-accent`, rótulo
  `--color-text-primary` (**Fase 0a**: antes os dois herdavam `--color-accent`, mas o rótulo
  a 0,66rem só mede 3,81:1 sobre `--color-bg-secondary`, abaixo de 4,5:1 AA pra texto; o ícone é
  uso gráfico, exigência 3:1, cumprida); inativo `--color-text-disabled`.
- **Controles flutuantes de topo (`.chrome-float`, item 1 do roadmap) — base compartilhada de
  `.back-float` (voltar) e `.exit-cook-float` (sair do modo cozinhar).** `position: fixed`,
  topo-esquerda, `top`/`left` somam `env(safe-area-inset-top/left)` + `--space-3` (12px),
  `z-index: var(--z-float)`, fundo `rgba(15, 15, 14, 0.55)` — véu fixo (não reage a tema/hover),
  igual sobre o tema escuro e sobre foto clara de hero (regra §8.1 do
  `CONTRATO-IMAGENS-REDESIGN.md`: nenhum elemento claro solto sobre foto clara). SEM
  `backdrop-filter` (celular modesto é público-alvo). Borda 1px `--color-border` — a mesma cor
  do véu já é ~idêntica a `--color-bg`, então sobre tela sem foto a borda é o que separa a forma
  do controle do fundo por trás (sem ela ele quase desaparece num fundo já escuro). Estados
  `:active`/`:focus-visible` ficam UMA vez só na base `.chrome-float`, reaproveitando as mesmas
  listas compartilhadas que já existiam (tokens `--motion-base`, `--focus-ring-*`) — as duas
  subclasses herdam junto, nenhum CSS de estado duplicado por variante.
  - `.back-float` (círculo, 44×44px exato — `box-sizing: border-box` global, a borda de 1px fica
    DENTRO dos 44px, não os aumenta). Ícone `chevronLeft` (`ICONS`/`iconSvg()`, outline
    stroke-based), 22px (mesmo tamanho do ícone da bottom nav), cor `--color-text-primary`.
    `aria-label` dinâmico "Voltar para X". **Presente em toda tela com página-mãe**: página de
    receita (`renderReceita`, item 1 original — cadeia de fallback do rótulo: coleção de origem
    → "Pesquisar" → "Minhas Receitas" → categoria da receita), coleção/categoria
    (`renderCategory` — rótulo = grupo dono da coleção, ou "Home" nas 2 exceções
    `hideFromGrupoGrid`) e grupo/hub (`renderGrupo` — rótulo sempre "Home", único pai real dos 5
    hubs). Construído por um helper único, `createBackFloat(destLabel, onClick)` em `js/app.js`
    — nenhuma tela duplica a criação do elemento, só passa o rótulo e o destino.
  - `.exit-cook-float` (pílula, `border-radius: 999px`, mesmas proporções de `.filter-trigger`
    já estabelecido no app — `min-height: 44px`, ícone 18px). Ícone `close` (já existia desde a
    Fase 0c, reaproveitado) + texto "Sair" num `<span>`, `aria-label` FIXO "Sair do modo
    cozinhar" (não é dinâmico — não é "voltar", é "sair"). Só no modo de preparo
    (`renderCookMode`), via `createExitCookFloat(onClick)` — substitui o antigo botão textual
    "Sair do modo cozinhar" (`.back-button`), devolvendo o peso visual que o ✕ removido na Fase
    0c dava. O modo cozinhar continua SEM nenhum botão de voltar — isto é o único controle
    flutuante que existe nessa tela, por regra fixa da skill `product-navigation-ux`.
  - Contraste do ícone/texto contra o véu (fórmula de luminância WCAG, mesmo método já usado
    nesta tabela pros tokens de cor — **calculado, não medido ao vivo**: sessão sem acesso a
    screenshot/DOM real nas duas rodadas desta tarefa, ver relatório): sobre `--color-bg` puro,
    17,03:1; sobre um tom claro/quente representativo do acervo de fotos (`rgb(232,214,176)`),
    4,83:1; no PIOR CASO teórico (véu sobre branco puro, mais claro que qualquer foto real do
    acervo), 3,76:1 — os 3 passam o mínimo de 3:1 exigido pra ícone/elemento gráfico (WCAG
    1.4.11; nenhum dos dois controles tem texto visível grande o bastante pra exigir 4,5:1, e o
    "Sair" da pílula, texto pequeno sobre fundo já contrastado, herda a mesma folga). Compensação
    óptica do chevron (vértice "pesa" visualmente pro lado que aponta) segue pendente de
    confirmação visual ao vivo — o path escolhido já é geometricamente centrado (centroide do
    traço em (12,12) no viewBox 24×24, conferido por cálculo), mas o ajuste fino por percepção
    não pôde ser calibrado em nenhuma das duas rodadas, pelo mesmo motivo de acesso a navegador.
- **Carrossel "Vistas recentemente" (`.recent-views`/`.recent-views__rail`/`.recent-card`,
  DEPOIS do bloco de categorias — tiles + "Mais categorias" — na home, item 4 do roadmap-mestre;
  posição corrigida 2026-07-26, era antes dos tiles na primeira leva) — mini-card, scroll
  horizontal puro.** `.recent-views` usa `margin-top: var(--space-6)` (24px, colapsa com o
  `margin-bottom: var(--space-4)` de `.home-more-categories` — resultado efetivo 24px, o maior
  dos dois, não a soma) — a separação do bloco de categorias é só espaçamento, nunca borda.
  `#progress` (elemento COMPARTILHADO por toda tela — nunca mudar a regra base) ganhou um
  override só pra home (`#recipes-content:has(.home-view) ~ #progress`, zera margin-top/
  padding-top/border-top) porque fica sempre vazio ali e sua borda sobrava como linha solta sem
  propósito. Título
  (`.recent-views__title`): mesmo padrão sans uppercase pequeno já usado nos labels de seção
  (`--text-sm`, `text-transform: uppercase`, `letter-spacing: 0.06em`, `--color-text-secondary`).
  Trilho (`.recent-views__rail`): `overflow-x: auto` + `scroll-snap-type: x mandatory` +
  `scroll-snap-align: start` nos filhos — SEM nenhum JS de carrossel, scrollbar oculta
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`, mesmo par já usado em
  `.cook-timer-wheel`). Sem padding próprio — herda o inset de 20px de `#main`, mesma convenção
  de `.home-tiles`. Mini-card (`.recent-card`, `flex: 0 0 26vw; min-width: 84px; max-width:
  140px`): calibrado pro viewport de referência de 390px — ~101px de card, cabem 3 inteiros +
  uma fatia do 4º dentro dos ~350px úteis. Foto 16:9 (`.recent-card__thumb`, `aspect-ratio: 16 /
  9`, `object-fit: cover`, raio `var(--radius)` = 14px — o card PADRÃO de receita/preparo, não o
  literal 20px dos tiles grandes da home) + nome abaixo (`.recent-card__name`, `--font-display`
  peso 400, `--text-sm` = 14px, `letter-spacing: 0` — tier `<20px` da escala de tracking do
  serif, ver "Tipografia" acima — `-webkit-line-clamp: 2`). Nada além de foto e nome: sem país,
  sem meta, sem coração — item de navegação rápida, não um `recipe-card` reduzido. Foto sempre
  via `loadRecipeImage(recipe, el)`/`applyImage()` (contrato `CONTRATO-IMAGENS-REDESIGN.md` §3),
  nunca lógica própria — `loading="lazy"` já vem de `applyImage()`, não duplicado aqui. Estados
  `:active`/`:focus-visible`: `.recent-card` entra nas MESMAS listas compartilhadas de
  `.recipe-card`/`.category-card`/`.home-tile` etc., nenhuma regra de estado isolada. Ausente por
  completo (nem título nem trilho) quando `Storage.getRecentlyViewed()` está vazio.
  `fromHash="home"` no clique é contrato público à parte — ver "Botão Voltar" em
  `product-navigation-ux/SKILL.md`.

## Iconografia

Outline, espessura consistente, monocromático. Ativos `--color-accent`, inativos
`--color-text-disabled`.

**Sistema (`ICON_SVG_ATTRS`/`ICONS`/`iconSvg()`, topo de `js/app.js`):** todo ícone novo do app é
um `<path>`/`<circle>`/`<rect>` dentro de um `viewBox="0 0 24 24"`, `fill="none"`,
`stroke="currentColor"`, `stroke-width="1.8"`, `stroke-linecap`/`stroke-linejoin="round"`. A cor
nunca é fixa no path — vem sempre do `color` do elemento ancestral via `currentColor`, o mesmo
mecanismo de token de cor do resto do app (`--color-accent`/`--color-text-disabled`/etc.).
`iconSvg(key, className)` monta a tag a partir de uma entrada do dicionário `ICONS` — sem
arquivo, sem `<img>`, sem `fetch()` (mesma razão anti-race-condition do `EQUIPMENT_SVG_MARKUP`:
um ícone carregado de forma assíncrona pode renderizar em branco se o modal abrir antes do
fetch terminar).

**Regra (Fase 0c): emoji nunca é ícone.** Ícone de produto (ação, estado, categoria de dado) usa
sempre `iconSvg()`. Emoji cru só é aceitável em copy decorativa opcional — e mesmo aí, a Fase 0c
tirou todos os casos que existiam (ver skill `mobile-recipe-ui`, seção "Fase 0c"). As duas
exceções que restam hoje (emoji de categoria/hub em `categories.js`/`collections.js`, e as
bandeiras de país) não são exceções À REGRA — são migração pendente, adiada de propósito pro
item 6 do roadmap (junto com as fotos), não um caso de uso aprovado pra emoji novo.

**Tamanhos em uso, por contexto (`css/style.css`, sempre `width`/`height` explícitos — um SVG
sem essas duas propriedades cai no tamanho intrínseco do navegador, não no `font-size` que um
emoji herdava de graça):**

| Contexto | Ícone | Tamanho | Seletor |
|---|---|---|---|
| Botão de remover (`.preparo-card__delete`, Preparos e Lista de Compras) | `close` | 16px | `.preparo-card__delete svg` |
| Thumb de card sem foto (`.recipe-thumb`, `.preparo-card__thumb`) | `photoOff` | 24px | `.recipe-thumb.placeholder svg`, `.preparo-card__thumb.placeholder svg` |
| Ícone de categoria sem `icon` definido (raríssimo — os 49 hoje têm todos) | `photoOff` | 24px | `.category-card__icon svg` |
| Hero da página de receita sem foto (`.recipe-hero`) | `photoOff` | 56px | `.recipe-hero.placeholder svg` |

Calibrado pra bater com o que o emoji/glifo antigo ocupava em cada contêiner (16px ≈
`--text-base` do glifo "✕"; 24px ≈ `--text-lg` do 🍽 nos thumbs; 56px ≈ os `3.5rem` do 🍽 no
hero) — não são valores arbitrários, são o mesmo peso visual de antes, só com um SVG no lugar
do caractere.

**`photoOff` — spec do placeholder "sem foto" (componente de produto, não decoração):**
Representa um ESTADO de dado ausente (nenhuma foto própria nem fallback da Wikipédia resolveu),
não um enfeite — por isso é sempre acompanhado da classe `.placeholder` no elemento (contrato
de `loadRecipeImage()`/`applyImage()` em `docs/CONTRATO-IMAGENS-REDESIGN.md` §8.1: a ausência de
foto tem que ser sinalizada de forma detectável e estável). Cor: herda `--color-text-disabled`
do elemento `.placeholder` ancestral (nunca cor própria). Fundo do contêiner:
`--color-surface-elevated`, o mesmo em todas as 3 superfícies (thumb de card, thumb de preparo,
hero). Estilizar esse estado (fundo, borda, animação) é decisão livre da frente de design a
qualquer momento — o único contrato fixo é o sinal (`.placeholder` presente + ausência de
`<img>`), não a aparência.

## Estados
Hover `--color-accent-hover` · Pressed: leve redução de escala (`scale(0.97)`) + opacidade
~0,85, disparado no pointer-down/touchstart — não espera o release. Aplicado originalmente a 6
elementos (CTA primário, "Ver resultados" do modal, `action-btn`, botão "Filtros", abas da
bottom nav, card de receita) e **estendido na Fase 0a a mais 24** (todo componente tocável que
antes só tinha `:hover` — não confiável em touch — ou nenhum estado nenhum; lista completa em
`.claude/skills/mobile-recipe-ui/SKILL.md`), usando os tokens de movimento (ver Animações).
Disabled: **padrão genérico (Fase 0a)** — `opacity: 0.35` + `cursor: not-allowed` no seletor
`:disabled` puro (antes só `.cook-nav-btn` tinha; agora qualquer controle desabilitado herda
automaticamente, `:disabled` só casa com controles de formulário de verdade). Loading:
`--color-accent` · Sucesso `--color-success` · **Erro: `--color-error` SEMPRE acompanhado de
ícone — nunca só a cor, dado a proximidade de matiz com o acento principal.**

Foco por teclado (**Fase 0a** — antes 0 regras `:focus-visible` em todo o app): ring padrão
`outline: 2px solid var(--color-accent-text)` + `outline-offset: 2px` (tokens
`--focus-ring-width`/`--focus-ring-color`/`--focus-ring-offset`), aplicado a todo componente
tocável via `:focus-visible`. Reaproveita `--color-accent-text` (já calibrado a 4,61:1) em vez
de introduzir mais um cálculo de cor.

## Animações
180–250ms, ease-out. Evitar excesso. **Tokens (Fase 0a)**: `--motion-fast: 150ms` (segundo
valor mais usado no CSS) e `--motion-base: 200ms` (o mais usado), `--motion-easing: ease-out` —
formaliza o que já era dominante, não muda o orçamento. Durações fora desses 2 valores (220ms
do modal, 260ms do spring do toggle de ingrediente) continuam literais de propósito — são
decisões específicas documentadas no CSS, não o caso genérico.

Modal/sheet: a saída sempre espelha a entrada — mesma duração e curva, direção invertida.
Nunca fecha instantâneo depois de ter aberto animado (ex.: o modal de filtro entra com
translateY+fade de 220ms e agora sai com a mesma transição revertida, em vez do
`overlay.remove()` direto de antes).

## Acessibilidade
`prefers-reduced-motion: reduce` — a redução de escala do Pressed é suprimida (sobra só a
opacidade); a entrada do modal aparece estática, sem o translateY; a saída do modal vira um
cross-fade curto de opacidade, sem o deslocamento. Nenhuma dessas animações é removida por
completo — reduced motion troca por um equivalente mais simples, não elimina o feedback.

`prefers-contrast: more` — borda dos componentes mais tocados (card de receita, `action-btn`,
botão "Filtros") reforçada pra 2px em `--color-text-secondary`, sem criar token de cor novo.

## Regras de UX (do PDF original)
`--color-accent` apenas para ações. Nunca mais de 1 CTA principal por tela. Fotos sempre
maiores que elementos gráficos. Filtros em acordeão. Categorias com ícones simples.

## Regras gerais
Interface nunca compete com as receitas. Consistência acima de criatividade. Todo componente
novo reutiliza token existente antes de criar cor/estilo novo.

---

## Pendências ainda em aberto

1. ~~`--color-accent-light` e `--color-highlight` sem regra de uso~~ — **RESOLVIDO:** reservadas,
   sem uso em nenhum componente por ora (nenhum componente do sistema atual pede uma 3ª/4ª cor
   de marca; ativar só se surgir necessidade concreta, com regra explícita na hora).
2. **Estrutura de Telas (seção 10 do PDF):** Onboarding/Perfil são visão de produto futura, não
   deste ciclo. ~~"Minhas Receitas" deve voltar à lista completa (sumiu por engano)~~ —
   **RESOLVIDO:** virou tela real (`renderMinhasReceitas`, abas Favoritas/Já Feitas), ver
   `.claude/skills/mobile-recipe-ui/SKILL.md`. Só falta o ajuste de registro no PDF de vocês,
   quando conveniente.

## Estados ainda sem design (natural nesta fase — desenhar ao construir o Bloco 2/3)
Distinção visual seleção única vs múltipla no filtro, toggle `##` (todos/qualquer um), estado
zero-resultado com fallback OR.
