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
- `--font-display`: `ui-serif, Georgia, 'Iowan Old Style', 'Palatino Linotype', serif` — título da receita (`.recipe-page-title h2`), título no card de receita (`.recipe-title h3`), título de categoria (`#category-header h2`), título de grupo/hub (`.grupo-view h2`) e, desde o item 6 do roadmap-mestre (2026-07-26), o NOME dentro dos 2 tipos de tile de imagem: `.category-card__title` (tile da grade) e `.home-tile__label` (tile grande da Home). Peso sempre 400 nesses 6 (o peso serif vem do desenho da própria fonte, não de font-weight).
  - **Correção nesta rodada:** esta lista dizia "título de categoria/hub (`#category-header h2`)", mas isso sempre foi impreciso — `#category-header h2` é só a página de CATEGORIA (`renderCategory`); a página de GRUPO/HUB (`renderGrupo`) sempre usou um elemento diferente (`.grupo-view h2`) que nunca tinha sido serif de verdade, apesar do que este documento já registrava. Achado e corrigido no mesmo commit que tornou o título do hub serif de fato (item 6, banner de hub).
  - **Home:** não existe hoje um título de página na home — `renderHome` só monta os tiles principais e "Mais categorias", ambos `<button>` (excluídos por regra: botões nunca levam serif — os NOMES dentro dos tiles de imagem são a exceção documentada acima, são `<span>` dentro do botão, não o botão em si). Se outro título de página entrar na home no futuro, ele se junta a esta lista.
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
- **`--chrome-clearance` (hotfix 2026-07-26, problema sistêmico) — espaço reservado no topo de
  qualquer tela que tenha um `.chrome-float` misturado com conteúdo em fluxo normal.** Achado
  confirmado pelo dono em 3 telas: a pílula `.exit-cook-float` ("Sair") cobria o nome/atalho da
  receita no modo cozinhar; o `.back-float` cobria o título nas páginas de categoria e de
  grupo/hub. Decisão de produto: o CONTEÚDO desce, o float NÃO se move — a posição do chrome
  (topo-esquerda, `env(safe-area-inset-top) + --space-3`) é uma convenção já aprendida pelo
  usuário nas outras telas, então mover o CONTEÚDO custa menos que mover o controle.
  `--chrome-clearance: calc(env(safe-area-inset-top, 0px) + var(--space-3) + 44px +
  var(--space-3))` — mesma fórmula do `top` do float (safe-area + `--space-3`) mais a altura do
  float (44px) mais outro `--space-3` de respiro, então o conteúdo começa exatamente 12px abaixo
  da borda inferior do float, nunca por baixo dele. Aplicado como `padding-top` em 3 lugares —
  `.cook-page` (modo cozinhar), `.grupo-view` (grupo/hub) e `#category-header:has(.chrome-float)`
  (categoria — escopado por `:has()` porque só `renderCategory` de fato popula
  `#category-header`; toda outra tela deixa esse elemento vazio, e um `padding-top`
  incondicional criaria um vão vazio no topo delas). **EXCEÇÃO deliberada, não um esquecimento:
  a página de receita (`.recipe-page`) não usa este token** — ali o `.back-float`/
  `.recipe-hero__heart` sobrepõem a foto de propósito (redesenho "item 1 de Deixar pro Fable,
  depois"), é o efeito visual desejado, não o bug que este token corrige nas outras 3 telas.
  Suíte: `scripts/verify-back-float-2026-07-25.js` (seção 15).
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
- **Card de receita — redesenho completo (`.recipe-card`, item 2 do roadmap-mestre "Deixar pro
  Fable, depois") — foto 2:1 sangrando + coração flutuante + faixa nome/1 chip/descrição.**
  Substitui o card antigo (header em grid com thumb 48x48, título+origem+chip de categoria,
  descrição, até 3 tags e meta de rodapé com tempo/complexidade/porções) em TODOS os 6 call
  sites (`renderGrupo`, `renderCategory`, `renderBusca` ×3, `renderMinhasReceitas`) —
  divergência zero, protegida por `scripts/verify-card-contract-2026-07-25.js`. `.recipe-card`
  vira `position: relative; overflow: hidden` (sem padding próprio — a foto sangra até a borda,
  cortada nos 2 cantos superiores pelo raio `var(--radius)` do próprio card, sem raio duplicado
  na foto); `.recipe-card__photo` é a caixa 2:1 (`aspect-ratio: 2 / 1` — **ajustada de 16:9 pra
  2:1 num julgamento visual posterior à 1ª leva**, ver bullet "Ajuste de julgamento visual"
  abaixo para o porquê e os números exatos); abaixo, `.recipe-card__body` (padding padrão de
  card, `--space-4`/`--space-5`) contendo `.recipe-card__row` (`display: flex;
  align-items: flex-start`, nome + no máximo 1 `.recipe-card__tag` na mesma linha — o chip
  acompanha a 1ª linha do nome, `flex-shrink: 0` no chip garante que só o nome quebra por
  baixo) com `.recipe-card__name` (`--font-display` 19px/`--text-md`, peso 400, sem tracking —
  tier `<20px` da escala — até 2 linhas por `-webkit-line-clamp`), e opcionalmente
  `.recipe-card__desc` empilhada abaixo (ver bullet do ajuste). Foto sempre via
  `loadRecipeImage(recipe, el)`/`applyImage()` (contrato `CONTRATO-IMAGENS-REDESIGN.md` §3),
  nunca lógica própria; placeholder `photoOff` da Fase 0c, 24px (mesmo tamanho do
  `.recent-card__thumb.placeholder`, não o hero de 56px).
  - **Ajuste de julgamento visual (2026-07-25, mesmo dia, após ver o card no ar)**: foto
    16:9→2:1 e descrição de volta como linha única. Razão da foto: §5 do
    `CONTRATO-IMAGENS-REDESIGN.md` — 2:1 mostra 67% da altura do master (`4/(3*2)`), ainda
    dentro da janela segura 1:1–2:1, sem precisar de `object-position` (o recorte central de
    67%, y 16,5%–83,5%, cobre com folga o prato, y 25%–80% medido no documento). Inspeção
    visual direta em 3 arquétipos (`torta-de-maca.webp` raso, `chateaubriand.webp` alto,
    `bouillabaisse.webp` tigela funda) confirmou o alimento sempre entre ~27% e ~80% da
    altura nos 3 — nunca alcança as faixas cortadas; só decoração de fundo (topo) e aba vazia
    de prato/guardanapo (base) saem do quadro. Medido ao vivo em 390px (Béchamel, frança):
    antes (16:9, sem descrição) card 350×252,75px, foto 348×195,75px; depois (2:1, com
    descrição) card 350×254px, foto 348×174px (2:1 exato) — foto encolheu 21,75px, card total
    ficou só 1,25px mais alto (a descrição some quase toda a diferença, como previsto).
    `.recipe-card__desc` (novo): `.recipe-card__row` sai de `.recipe-card__body` e vira
    sub-bloco próprio (`display: flex`), liberando `.recipe-card__body` como bloco simples
    onde a descrição empilha por baixo sem precisar de `flex-direction: column`. Descrição em
    `--text-sm`/`--color-text-secondary`, `margin-top: var(--space-1)`. Elemento só existe no
    DOM quando `recipe.desc` é truthy (guard em `js/app.js`, `if (recipe.desc) { ... }`) — sem
    linha fantasma vazia quando a receita não tem descrição. País/meta/chip de categoria
    continuam mortos — só a descrição voltou.
  - **Ajuste fino do dono (2026-07-25, mesmo dia, 2ª rodada de revisão visual): teto de 1
    linha virou teto DEFINITIVO de 2 linhas.** Era `white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis` (1 linha); virou o mesmo padrão de clamp já usado em
    `.recipe-card__name` — `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient:
    vertical; overflow: hidden; line-height: var(--leading-snug)`. Teto, não piso: descrição
    curta o bastante pra caber em 1 linha ocupa só 1, sem altura reservada fantasma —
    confirmado com um texto sintético curto ("Prato simples e rápido.", 23 caracteres): altura
    renderizada 18,89px, idêntica a 1 linha (`--leading-snug` a 14px = 18,9px), sem sobra.
    **Achado ao medir os dados reais**: nenhuma das 398 receitas tem descrição curta o
    bastante pra caber em 1 linha só nos 308px úteis do card (a mais curta encontrada,
    "Affogato", 74 caracteres, já precisa de 2 linhas) — ou seja, o caso "1 linha real" da
    spec é sempre sintético/hipotético no acervo atual, nunca observado numa receita de
    verdade; o mecanismo funciona (comprovado acima), só não há exemplo real pra mostrar.
    Medido ao vivo em 390px (Béchamel, frança, descrição de 95 caracteres que precisa de 3
    linhas sem clamp): card 254px (1 linha, ajuste anterior) → 272,78px (2 linhas, este
    ajuste) — cresceu 18,78px, exatamente 1 linha a mais (`--leading-snug` 18,9px). Como
    82 das 83 receitas de França (e 379 das 398 do acervo) precisam de 2+ linhas pra caber a
    descrição inteira, ~272,78px passa a ser a altura típica do card com descrição — 1 exemplo
    real de cada categoria: "Béchamel" (95 car., corta com reticências ao fim da 2ª linha,
    natural seria 3), "Camarão à Provençal (para servir com arroz)" (94 car., cabe exato em 2
    linhas, sem cortar nada), e o caso de 1 linha real inexistente descrito acima.
  - **Coração (`.recipe-card__heart`)**: círculo flutuante sobre a foto, canto superior direito
    (`top`/`right: var(--space-3)`), mesma linguagem visual do `.chrome-float` — véu
    `rgba(15, 15, 14, 0.55)`, borda 1px `var(--color-border)` — só o tamanho muda (36px visual,
    vs. 44px do `.back-float`). Hit-area invisível via `::after`/`inset: -10px` (mesma técnica
    Fase 0a, ~10px de padding invisível). Estado favoritado continua `--color-accent` sólido,
    como antes. **Ajuste de contraste feito nesta rodada**: o contorno PARADO (não-favoritado)
    trocou de `--color-text-disabled` pra `--color-text-primary` *só dentro do card*
    (`.recipe-card__heart .recipe-heart-icon path` — `.recipe-page-heart`, sobre
    `--color-surface` sólido, nunca foto, continua com a cor base, não precisou do ajuste).
    Motivo: `--color-text-disabled` contra o véu sobre foto mediu (fórmula de luminância WCAG,
    mesmo método usado nesta tabela) ~1,22:1 no pior caso calculado (véu sobre branco) e ~1,57:1
    no tom quente de referência (`rgb(232,214,176)`, mesmo usado pro cálculo do `.chrome-float`
    acima) — bem abaixo do 3:1 mínimo pra ícone/elemento gráfico (WCAG 1.4.11).
    `--color-text-primary` contra o MESMO véu já estava calculado nesta tabela pro
    `.chrome-float` (17,03:1 / 4,83:1 / 3,76:1 nos 3 casos de referência) — reaproveitado aqui
    sem recalcular, já que veu e cor são idênticos.
  - **Regra da tag (`singleCardTagId`, `js/app.js`)**: no máximo 1 chip, nunca mais. Prioridade
    `dish_type:` > `protein:` > nenhum (sem chip) — nunca `country:`, EXCETO quando a tela tem
    2+ tags `country:` DISTINTAS ativas no filtro (`hasMultiCountryFilter`, calculado 1x por
    render da lista a partir do estado de filtro de cada tela — `selectedFacetTags` em
    `renderCategory`, `tagIds` em `renderBusca` — nunca por card individual): aí o chip vira o
    país da PRÓPRIA receita, SUBSTITUINDO tipo-de-prato/proteína, nunca somando (disciplina de 1
    chip). `renderGrupo` e `renderMinhasReceitas` não têm conceito de filtro de país nessas
    telas — nunca fabricam o override, seguem sempre a prioridade tipo-de-prato/proteína normal.
    Chip reaproveita `buildTagChipsEl`/`.tag-chip-link` (pill, borda, `--text-xs`, clicável pra
    busca filtrada) — mesmo padrão visual de sempre, só a quantidade mudou (1 em vez de até 3).
  - **O que morreu, em TODOS os contextos, sem exceção**: chip de categoria (`opts.catLabel`/
    `.cat-chip`, existia em 4 dos 6 call sites, nunca em `renderCategory` — a única divergência
    do card antigo, agora irrelevante), origem/país como texto (`.origin`), descrição
    (`.recipe-card-desc`), badge de contexto de busca por ingrediente (`.recipe-card-context`,
    já não tinha nenhum caller de verdade — `opts.contextTagId` removido junto), e a linha de
    meta com tempo/complexidade/porções (`.recipe-meta`/`.recipe-meta-item`, ícones
    `clock`/`gauge`/`bowl` — esses ícones continuam em uso na página da própria receita, só
    saíram do card). `priorityTagIds`/`TAG_CHIP_PRIORITY`/`buildTagChipsEl` continuam existindo
    e em uso — servem também a `.recipe-page-tags` (até 8 tags na página da receita), não
    tocada por este redesenho.

- **Página de receita — redesenho completo (item 1 de "Deixar pro Fable, depois",
  CHECKLIST-GERAL.md) — foto fixa + folha que desliza por cima, funil de informação
  reordenado, coração novo, metadados em blocos, ingredientes com porções realocadas.**
  - **Efeito de foto fixa.** `.recipe-hero` vira `position: fixed; top: 0; left: 0;` — largura
    total do viewport, `object-position: center bottom` PRESERVADO intocado (contrato funcional,
    `docs/CONTRATO-IMAGENS-REDESIGN.md` §6.2, protegido por `scripts/test-foto-local.js`).
    **Altura — atualizada na rodada 2 (revisão do dono, "foto maximizada"):** era
    `aspect-ratio: 16 / 9` fixo (1ª rodada — resultado pequeno demais pra intenção real); agora é
    `height: var(--hero-h)`, com o token novo `--hero-h: clamp(50vw, 52vh, 125vw)` — mira ~52% da
    altura da tela, travado numa proporção entre 2:1 (viewport baixo/largo) e 4:5 (viewport
    alto/estreito), a janela segura atualizada em `CONTRATO-IMAGENS-REDESIGN.md` §5/§6.1 (mesmo
    commit, cross-front com ciência do dono). **Véu degradê no topo**
    (`.recipe-hero::before`, `linear-gradient(to bottom, rgba(15, 15, 14, 0.55), transparent 30%)`,
    `pointer-events: none`) — papel duplo: mitiga o topo do master reexposto pela caixa mais alta
    (o risco de parede/janela do §6.2, que o recorte 16:9 anterior escondia por completo) e dá
    contraste consistente pro back-float/coração, que sentam nessa faixa. `.recipe-page` vira a
    FOLHA que desliza por cima: fundo `var(--color-bg)` (mesmo tom do body — só o raio+a foto por
    trás denunciam a borda), cantos SUPERIORES arredondados com o token novo `--radius-sheet: 20px`
    (maior que o `--radius` de 14px de card — é a borda de um elemento de tela cheia), base reta.
    Bleed total via `width: 100vw; margin-left: calc(50% - 50vw)` — escapa do padding/max-width de
    `#main` sem depender de rastrear esse padding por breakpoint. **Trade-off assumido** (mobile
    primeiro, desktop depois): o teto de 720px de largura de leitura em desktop que
    `.recipe-page` tinha foi removido — a folha ocupa o viewport inteiro em qualquer tela agora;
    `padding: 0 var(--space-5)` próprio recria a margem lateral de leitura, desacoplado do
    padding de `#main`. **Padding-top novo (rodada 3, revisão do dono, "moldura consistente"):**
    era `0` no topo (o título ficava colado na curva do `--radius-sheet`) — virou
    `var(--space-6)` (24px), mesmo valor do ritmo do funil, criando respiro entre a curva
    arredondada e o início do conteúdo. Padding final: `var(--space-6) var(--space-5) 0`.
    **Sobreposição inicial — atualizada na rodada 2:** era `margin-top`
    derivado de 50% da altura do hero (cobria a metade dele); agora é
    `calc(var(--hero-h) - 24px - var(--space-10))` (e `- var(--space-5)` no breakpoint ≤700px) —
    a folha cobre só os últimos 24px do hero, revelando quase a caixa inteira antes de rolar
    ("foto grande + a beirada arredondada da folha com o começo do título").
  - **Camadas, sem token novo.** `.recipe-hero` e o coração novo (`.recipe-hero__heart`, ver
    abaixo) usam `z-index: -1` — bucket de empilhamento NEGATIVO, que sempre pinta ANTES do
    conteúdo normal não-posicionado (a folha, `.recipe-page` e tudo dentro dela). Por isso a
    folha não precisa de `position`/`z-index` próprio nenhum: sendo `position: static` (o
    default), seu conteúdo cai automaticamente por cima de qualquer coisa no bucket negativo,
    sem contexto de empilhamento novo. Resolvido pela ordem natural do fluxo, exatamente como a
    escala de z-index (Fase 0a) já previa para este efeito — ver comentário da escala em
    `css/style.css`.
  - **Sobreposição inicial calibrada.** `margin-top: calc(100vw * 9 / 32 - var(--space-10))`
    (e `- var(--space-5)` no breakpoint ≤700px, onde `#main` também troca de padding-top) — o
    valor `100vw * 9 / 32` é 50% da altura do hero (largura 100vw, aspect-ratio 16/9 ⇒ altura
    `100vw * 9/16`; metade disso). A subtração cancela o padding-top que `#main` soma ANTES da
    folha (ela é filha de `#recipes-content`, filha de `#main`), pro afastamento real do topo do
    viewport bater exatamente com o valor derivado. Resultado: a folha cobre a metade INFERIOR
    da caixa da foto antes de rolar, mostrando a faixa y ∈ [25%, 62,5%] do master — o número já
    validado pelas 398 fotos em `CONTRATO-IMAGENS-REDESIGN.md` §5, que assume exatamente essa
    sobreposição de 50%.
  - **Coração sobre a foto (`.recipe-hero__heart`)** — substitui Favoritar da linha de botões
    por completo (não troca mais de estrutura `.action-btn` ↔ ícone sólido; é sempre só o
    ícone, como o coração do card). Mesmo componente visual do `.recipe-card__heart` (36px,
    véu `rgba(15, 15, 14, 0.55)`, borda 1px `--color-border`, hit-padding `::after` de -10px,
    contorno `--color-text-primary` — não `--color-text-disabled` — pelo mesmo motivo de
    contraste WCAG sobre foto imprevisível, seletor combinado com o do card, sem recalcular).
    Diferença: `position: fixed` (não `absolute`) e topo-DIREITA (`right`, espelha o
    `.back-float` que é topo-esquerda), mesmo respeito a `env(safe-area-inset-*)`. **Elemento
    IRMÃO do hero, nunca filho** — `applyImage()`/`loadRecipeImage()` fazem `hero.innerHTML = ""`
    de forma ASSÍNCRONA assim que a foto local/Wikipedia resolve; um coração aninhado dentro do
    hero seria apagado nesse momento pra praticamente toda receita. `z-index: -1` igual ao hero
    — mesmo bucket negativo, a ordem no DOM (depois do hero) resolve "acima da foto"; sendo
    negativo, o par inteiro fica sempre abaixo do conteúdo normal da folha, coberto conforme o
    usuário rola (comportamento esperado, não um bug de z-index). `.recipe-page-heart` (a antiga
    troca de estrutura ao favoritar, usada só dentro de `.recipe-page-actions`) foi REMOVIDO por
    completo — classe, estados compartilhados (:active/:focus-visible) e a regra própria.
  - **Funil de informação, ordem exata:** título (`.recipe-page-title h2`, inalterado) →
    descrição completa (`.page-desc`, inalterada) → tags (`.recipe-page-tags`, MOVIDAS pra
    antes dos metadados — eram depois) → metadados em blocos → CTA primário → 2 secundários →
    Ingredientes (porções + colapso) → Lista de ingredientes + Modo de preparo.
  - **Metadados em blocos rotulados** (`.recipe-page-meta`, um `.recipe-meta-block` por dado
    presente — Total/Preparo/Cozimento/Dificuldade, cada bloco com `.recipe-meta-block__label`
    uppercase `--text-xs`/`--color-text-disabled` e `.recipe-meta-block__value` `--text-sm`/
    `--color-text-primary`, fundo `--color-surface`, raio `var(--radius)` — o token de CARD, não
    o `--radius-sheet` novo, que é só da folha). Substitui a linha de texto solto com
    `border-top`/`border-bottom`. **Porções SAIU daqui** — foi pro cabeçalho de Ingredientes (ver
    abaixo). **Grade — atualizada na rodada 2 (revisão do dono):** a 1ª tentativa era um flex
    tentando caber os 4 numa linha só a 390px; o rótulo DIFICULDADE (palavra única, sem espaço
    pra quebrar) truncava fora da tela nesse layout. Virou `display: grid;
    grid-template-columns: 1fr 1fr;` — grade 2x2 FIXA, sem tentativa condicional de 1 linha —
    dobrando a largura disponível por bloco. `overflow-wrap: break-word` no rótulo e no valor
    como rede de segurança estrutural adicional (independe da largura real do bloco).
  - **CTA e secundários trocaram de ordem** — "Começar preparo" (`.primary-cta`, inalterado)
    agora vem ANTES dos 2 botões secundários (`.recipe-page-actions`: "Já fiz" +
    "Adicionar à lista de compras", ambos inalterados) — era o inverso.
  - **Cabeçalho de Ingredientes redesenhado** (`.ingredients-header`) — substitui o antigo
    botão-pílula grande "Ocultar ingredientes (N)" (`.ingredients-toggle`, borda 2px accent,
    REMOVIDO por completo) por uma linha discreta: `<h4>Ingredientes (N)</h4>` (padrão sans
    uppercase já existente de `.recipe-page-section h4`) + `.ingredients-header__controls`
    (porções — stepper OU `.ingredients-yield-text` pro yield não-numérico, mutuamente
    exclusivos, mesma condição de sempre — REALOCADAS pra cá, decisão antiga, perto da lista
    que afetam) + `.ingredients-collapse-btn`, um chevron pequeno (24px visual + hit-padding
    `::after` de -10px = 44px efetivo) que é agora o ÚNICO gatilho de colapso. Precisa ser
    só o chevron (não a linha inteira, como era antes) porque o stepper mora no mesmo
    cabeçalho e seus próprios cliques (+/-, digitar) não podem borbulhar pro toggle do
    acordeão. Mecânica do acordeão (`.filter-section.is-open`, corpo escondido/mostrado,
    chevron gira 180deg via `.filter-section__chevron`) INTACTA — só a apresentação do
    gatilho mudou.
  - **Tags da página fecham a exceção de hit-area da Fase 0a.** `.recipe-page-tags .tag-chip-
    link` era 30px de altura com gap de 8px (`--space-2`) nos dois eixos — o inset do
    hit-padding só alcançava com segurança metade do gap (4px), dando ~38px efetivos, 6px
    abaixo do alvo de 44px (limitação documentada, não corrigível sem mudar o visual).
    **Histórico de calibração (3 rodadas):** rodada 1 tentou chip menor (28px) + gap maior
    (`--space-4`, 16px); rodada 2 esticou o gap ainda mais (`--space-6`, 24px, "ritmo") pra
    abrir espaço de inset. **Rodada 3 (revisão do dono) REVERTEU as duas** — gap de 24px foi
    "correção errada", o bloco de tags virou itens espalhados em vez de ler como um GRUPO.
    **Estado final:** chip 36px (MAIOR que o original de 30px, não menor — a direção "menor"
    das rodadas 1/2 foi abandonada) + gap pequeno `calc(--space-2 + 2px)` = 10px (sem degrau de
    10px na escala, por isso o calc em vez de token puro) + padding `--space-2` (8px) vertical/
    14px horizontal (também fora da escala, calibrado pro chip de 36px especificamente) + inset
    do `::after` em **-6px** (não -5px — achado ao vivo via `elementFromPoint`: `.tag-chip-link`
    base tem `border: 1px`, e o inset de um `::after absolute` resolve contra o PADDING-BOX do
    ancestral posicionado, não a borda visível — a mesma causa raiz já documentada na Fase 0a
    pro `.portion-stepper__btn`; sem compensar, o alcance efetivo media só ~4-4,5px por lado, não
    os 5px pretendidos. -6px = 5px pretendido + 1px de compensação de borda) — 36 + 5 + 5 = 46px
    efetivos pretendidos, confirmado ao vivo depois do ajuste, acima do mínimo de 44px.
    `margin-bottom: var(--space-6)` do container
    NÃO reverteu — o ritmo ENTRE seções (ver bullet abaixo) é independente do espaçamento
    INTERNO das tags, só este último oscilou entre rodadas. Medido ao vivo via
    `elementFromPoint` em cada rodada — números no relatório da tarefa.
  - **Chip de país sai da fileira de tags da página — decisão REVERSÍVEL (rodada 3, revisão do
    dono).** `renderReceita` (`js/app.js`) filtra tags `country:*` do array ANTES de chamar
    `priorityTagIds()` (`nonCountryTags = item.tags.filter(t => t.indexOf("country:") !== 0)`) —
    a linha de origem (`recipe.origin`, já exibida em `.recipe-page-title .origin` logo abaixo
    do título) já dá essa informação; um chip de país na fileira seria a mesma redundância já
    eliminada no redesenho do card. **Escopo do filtro: só a página de receita.**
    `TAG_CHIP_PRIORITY`/`priorityTagIds()` (compartilhados com o card e outras telas) NÃO foram
    alterados — busca, filtros e qualquer outra tela continuam vendo/usando `country:`
    normalmente. Reversível: se o dono decidir trazer o chip de volta, é só remover o
    `.filter(...)` — nenhuma outra parte do sistema depende dessa exclusão.
  - **Ritmo vertical do funil — `--space-6` (24px) consistente (rodada 2, revisão do dono).**
    Antes do "Começar preparo" só o CTA tinha margem própria (`--space-5`) e as tags usavam uma
    margem negativa pra se aproximar do que vinha antes; o resultado não tinha uma cadência
    única. Agora `--space-6` é o espaçamento por seção em toda a extensão título→tags→
    metadados→CTA→secundários (`.recipe-page-title` ganhou `margin-bottom` próprio — cobre o
    caso sem descrição/origem também; `.recipe-page-tags` trocou a margem negativa por
    `margin: 0 0 var(--space-6)`; `.recipe-page-meta` e `.primary-cta` viraram `margin-bottom:
    var(--space-6)`; `.recipe-page-actions` já usava `--space-6`, sem mudança). Convenção: cada
    elemento controla o espaço DEPOIS de si via `margin-bottom` — nenhum `margin-top`
    concorrente, evita depender de colapso de margem pra prever o resultado.
  - **2 bugs reais achados só ao vivo (elementFromPoint/getComputedStyle em 390px — a suíte
    estática não pega nenhum dos dois):**
    1. *Cascata de `@media`.* O override de `margin-top` de `.recipe-page` para o breakpoint
       ≤700px foi colocado, na 1ª versão, dentro do `@media (max-width: 700px)` já existente —
       que fica MAIS CEDO no arquivo que a regra base de `.recipe-page`. Mesma especificidade
       (`.recipe-page` simples nos dois) ⇒ a cascata desempata por ordem no arquivo, e a regra
       BASE (mais tarde) vencia sempre, em qualquer largura — o override "para mobile" nunca
       aplicava de verdade. Corrigido movendo o override pra um novo bloco `@media` logo APÓS a
       regra base. Lição: um override responsivo para um seletor só vale a pena checar a ORDEM
       no arquivo, não só a condição do media query.
    2. *Clique morto no coração.* `.recipe-hero__heart` (fixed, `z-index: -1`) nunca resolvia
       via `elementFromPoint` — `<body>` (não-posicionado, bucket de empilhamento "normal")
       sempre pinta NA FRENTE de qualquer descendente com z-index NEGATIVO, mesmo sem
       background/conteúdo visível naquele ponto exato; a área de padding vazia de `#main` (por
       cima do coração antes da folha cobrir) interceptava o clique silenciosamente. Corrigido
       com `pointer-events: none` em `body` + `auto` nos filhos reais (`#bottom-nav`,
       `#category-header`, `#recipes-content`) — libera a fresta vazia sem afetar nenhum clique
       que já funcionava (confirmado via elementFromPoint em back-float, abas da bottom nav, CTA,
       ações, chevron de colapso, todos intactos).
  - **Carona: tap-highlight nativo morto globalmente.** `-webkit-tap-highlight-color:
    transparent` no seletor universal (`*`) — o retângulo azul de toque em qualquer engine que
    o aplique por padrão (o `:active` da Fase 0a já cobre o feedback de pressão visual).
    `user-select: none` escopado a `button` (controles) — nunca em texto de conteúdo (`.page-
    desc`, `.ingredients-list`, etc., confirmado sem a regra). `prefers-reduced-motion`: o
    efeito de foto fixa é scroll nativo puro, sem JS/CSS animado nenhum atrelado a ele — nada a
    reduzir, confirmado nesta rodada, nenhuma regra nova precisou entrar no bloco
    `@media (prefers-reduced-motion: reduce)` existente por causa deste efeito especificamente.

- **Tile de categoria/home + banner de hub + tile de país — item 6 do roadmap-mestre
  (2026-07-26), item final do redesenho visual.** Fecha a pendência do §4/§8.1 do
  `CONTRATO-IMAGENS-REDESIGN.md` (layout do tile de categoria era "da frente de design") e o
  bucket de emoji que a Fase 0c deixou de propósito (categoria/hub em `categories.js`/
  `collections.js`/`app.js`, bandeira de país). **Regra-mãe, adotada como decisão de design
  formal:** TEXTO NUNCA SENTA EM IMAGEM. Já valia pro card de receita (nome numa faixa sob a
  foto) e pra página de receita (título na folha sobre a foto, nunca no hero); esta rodada
  estende a mesma gramática a categoria, hub e país. Investigação prévia (slug de
  `scripts/gerar-categorias.js` ↔ `id` de `window.COLLECTIONS`): **zero tile órfão** nas 16
  coleções de Fundamentos+Proteínas (paridade 1:1 confirmada, executando a função real contra o
  acervo, não só lendo o literal) e nas 20 de País (via `iso2`). Os únicos 7 sem imagem eram
  Por tempo (4) e Por dificuldade (3) — rotas sem link na Home, alcançáveis pelos próprios hubs e
  pela vitrine "Todas as categorias" (F1b) — que caíam no fallback tipográfico limpo (faixa +
  nome, sem buraco, sem ícone). Ilustradas em 2026-07-31, ver bullet "Coleções abstratas de
  tempo/dificuldade" mais abaixo — zero coleção em fallback tipográfico desde então.
  - **Tile de categoria (`.category-card`, grade "Mais Categorias" + grade de qualquer hub,
    inclusive Países)** — `renderCollectionCard` (app.js) constrói SEMPRE a mesma estrutura de 2
    partes: `.category-card__media` (a foto, `object-fit: cover`, SEM blur — blur é só do banner
    de hub, ver abaixo) + `.category-card__band`, uma faixa SÓLIDA `background: var(--color-bg)`
    grudada no rodapé (`position: absolute; inset auto 0 0 0` efetivo), contendo
    `.category-card__title` (o NOME, agora `--font-display` peso 400, `--text-sm`/14px, tier
    `<20px` da escala de tracking — sem letter-spacing negativo) e `.category-card__count` (a
    contagem "N receitas", que já existia e sobreviveu ao redesenho, `--text-xs`/
    `--color-text-secondary`). `aspect-ratio: 1` casa com a proporção nativa da imagem gerada
    (1:1, 600×600) — sem crop na largura/altura, só o que `object-fit: cover` já cobre. Contraste
    medido (fórmula de luminância WCAG, mesmo método já usado nesta tabela):
    `--color-text-primary` sobre `--color-bg` = **17,03:1** (título) e `--color-text-secondary`
    sobre `--color-bg` = **10,50:1** (contagem) — os dois muito acima do mínimo 4,5:1 AA.
    `--color-bg` escolhido em vez de `--color-surface` (que também passaria, 13,98:1/8,62:1) por
    CONSISTÊNCIA: é a mesma cor da folha (`.recipe-page`/`.grupo-sheet`) que já carrega texto
    sobre mídia em outro lugar do app — um só tom de "superfície que carrega texto sobre imagem"
    em vez de dois. Sem imagem mapeada: `.category-card__media` fica vazio, cor de
    fundo do PRÓPRIO `.category-card` (`--color-surface-elevated`, mesmo tom do placeholder
    "sem foto" já usado em outras superfícies) aparece atrás — faixa + nome, sem buraco, sem
    ícone. Nenhuma coleção cai mais nesse estado desde 2026-07-31 (ver bullet "Coleções
    abstratas de tempo/dificuldade" mais abaixo). Emoji de ícone (`collection.icon`) morreu —
    campo removido de `collections.js` inteiro (nenhuma coleção usa mais ícone próprio, dado
    morto depois do redesenho).
  - **Tile grande da Home (`.home-tile`, os 4 tiles de `HOME_MAIN_TILES`)** — MESMA estrutura de
    2 partes (`.home-tile__media`/`.home-tile__band`/`.home-tile__label`), `aspect-ratio: 4/3`
    (mais alto que o 1:1 da grade — "tile grande" também na proporção). Nome MAIOR que
    `.category-card__title` de propósito (tamanho por classe de tile, hierarquia grande vs.
    grade): `--text-md` (19px) em vez de `--text-sm` (14px), mesmo tier `<20px` de tracking. As 4
    entradas (Massas, Proteínas, Países, Sobremesas) SEMPRE têm imagem — 2 apontam
    pra uma categoria (`massas.webp`/`sobremesas-classicas.webp`) e 2 pro banner do próprio hub
    (`hub-proteinas.webp`/`paises.webp`) — zero caso de fallback aqui. Ícone outline
    (`bowl`/`flame`/`globe`/`cupcake`, `iconSvg()`) morreu — substituído pela foto.
  - **Banner de hub (`.grupo-banner`/`.grupo-sheet`, `renderGrupo`) — só nos 3 hubs alcançáveis
    por link real da Home (Mais Categorias/Proteínas/Países; tempo/dificuldade são rotas órfãs,
    sem imagem, sem banner, título simples de sempre).** Mesma gramática de `.recipe-hero`/
    `.recipe-page` (foto fixa + folha que sobrepõe), simplificada: `.grupo-banner`
    (`position: fixed; top/left: 0; z-index: -1`, MESMO mecanismo do hero — escapa do
    padding-top de `#main` pra alcançar o topo real do viewport, onde o `.chrome-float` também
    senta) tem `height: var(--hub-banner-h)` (`clamp(180px, 28vh, 280px)` — ~25-30vh, referência
    390×844 dá 236,32px). A imagem (`.grupo-banner__img`) é NÍTIDA — sem `filter`/`transform`
    própria (calibração final pós-8.1.1, 2026-07-26: o `blur(6px)` + `scale(1.1)` original
    sustentava texto-sobre-imagem direto no banner, spec que a 8.1.1 já tinha aposentado; sem
    esse motivo, mesma gramática nítida de `.recipe-hero`). `.grupo-sheet` é a FOLHA: `width:
    100vw` + `margin-left: calc(50% - 50vw)`
    (bleed total, mesma técnica de `.recipe-page`), `background: var(--color-bg)`, cantos
    superiores `--radius-sheet`, sobrepõe só os últimos 24px do banner
    (`margin-top: calc(var(--hub-banner-h) - 24px - var(--space-10))`, subtraindo o padding-top
    de `#main` pra cancelar o dele antes da folha — MESMA matemática de `.recipe-page` sobre
    `--hero-h`, só com o banner do hub no lugar do hero da receita; breakpoint `<=700px` subtrai
    `--space-5` em vez de `--space-10`, espelhando a troca de padding de `#main` nesse ponto).
    Título (`.grupo-view h2`, agora `--font-display` peso 400, `--text-xl`/30px, tier `>=28px`
    → `-0.015em`) e a busca do hub (`.home-search-wrap`) vivem SEMPRE dentro de `.grupo-sheet` —
    nunca sobre a foto. Contraste do back-float sobre a foto nítida vem do véu PRÓPRIO do botão
    (`.chrome-float`, `rgba(15, 15, 14, 0.55)`), nunca dependeu do banner estar borrado — medido
    ao vivo contra o pixel mais claro dos 3 banners (ver relatório da tarefa pros números).
    **Descrição textual do hub morreu** (decisão antiga do roadmap, fechada
    nesta rodada) — `grupo.desc` não existe mais em nenhum grupo, bannerizado ou não.
    **chrome-clearance:** hubs COM banner entram na MESMA exceção "float sobre mídia" da página
    de receita — `.grupo-view.has-banner { padding-top: 0; }` (o back-float senta sobre o
    banner de propósito, não sobre texto) — ver `--chrome-clearance` acima. `.grupo-view` sem
    banner (tempo/dificuldade) CONTINUA reservando `--chrome-clearance` normalmente, sem
    regressão. Ver `scripts/verify-back-float-2026-07-25.js` (seção 15d) e
    `scripts/verify-categoria-tiles-2026-07-26.js`.
  - **Tile de país no modal de Filtros (`.filter-tile--photo`, faceta País,
    `renderCountryTileSectionBody`)** — mesma regra-mãe em miniatura: bandeira
    (`imagens/bandeiras/<iso2>.webp`, sem blur) cobrindo o bloco inteiro do `.filter-tile`
    (min-height 76px, herdado sem mudança) + `.filter-tile__band` sólida (`var(--color-bg)`) com
    o nome do país por baixo. `countryTileIconHtml` (emoji de bandeira Unicode) morreu — layout
    próprio (`"photo-tiles"`, `def.layout` na faceta País), não reaproveita
    `renderTileSectionBody` (ícone+label+contagem empilhados, ainda usado por Equipamento) porque
    a estrutura muda de verdade. `window.COUNTRIES.<id>.iso2` (`js/countries.js`) continua a
    fonte única — só o consumo mudou de `.emoji` (Unicode) pra arquivo.
  - **Peso em disco da grade "Mais Categorias"** (6 imagens visíveis — molhos/sopas/entradas/
    risotos-arroz/padaria/tecnicas; massas/sobremesas-classicas só aparecem nos tiles grandes da
    Home): **398,5 KB** somados (números exatos no relatório da tarefa).

  **Correção pós-revisão do dono, rodada 2 (2026-07-26, mesmo commit) — 4 ajustes:**
  1. **Bandeira NÍTIDA quebrava a identidade do tile (veredito do dono).** Voltou a ser fundo
     BORRADO + véu — `filter: blur(var(--flag-blur))` (6px) + `transform: scale(1.15)` na foto,
     `::after` com `background: var(--flag-veil)` (`rgba(15, 15, 14, 0.35)`) por cima, sempre na
     MÍDIA — o nome continua na faixa sólida, regra-mãe intacta. 2 tokens calibráveis em `:root`.
     Aplicado em `.category-card--flag` (tile de país no hub Países) e `.filter-tile--photo`
     (mesma faceta no modal de Filtros) — mesmos 2 tokens nos dois lugares.
  2. **Ritmo da folha do hub, tokens explícitos** (era `--space-05`/2px entre título e busca,
     solto demais): `.grupo-view h2` margin-bottom `--space-4` (16px, medido: 16px exato);
     `.home-search-wrap` margin-bottom `--space-6` (24px). Medido ao vivo em 390px (hub
     Fundamentos): título→busca 16px exato. Busca→conteúdo mediu 57px, não 24px — o elemento
     seguinte (`.subgroup-title`, compartilhado com outras telas, `margin: var(--space-8) 0
     var(--space-4)` + `padding-bottom: var(--space-2)`) já existia ANTES desta rodada e
     contribui espaçamento próprio mesmo vazio (sem texto); não foi tocado nesta correção — só
     os tokens explicitamente pedidos (`.grupo-view h2`/`.home-search-wrap`) mudaram, e os dois
     medem exatamente o valor pedido isoladamente.
  3. **Corte fatiava o prato — achado real da rodada 1**: `.category-card`/`.home-tile` usavam a
     faixa em `position: absolute` SOBRE a base de uma imagem 1:1, cobrindo/cortando visualmente
     parte da composição centrada. Corrigido: `.category-card__media`/`.home-tile__media` viraram
     blocos PRÓPRIOS (`aspect-ratio: 1` e `4 / 3` respectivamente, `display: block` explícito —
     achado ao vivo: são `<span>`, inline por padrão, `aspect-ratio` não se aplica de verdade sem
     isso) e a faixa (`.category-card__band`/`.home-tile__band`) passou a vir DEPOIS, em fluxo
     normal, empilhada por baixo — nunca mais sobrepondo a imagem. Grade: 1:1 = o asset inteiro,
     zero corte. Home: 4:3 mínimo — a composição é overhead centrada, então 4:3 só corta as
     laterais, simetricamente, nunca o topo/base onde mora o prato. `object-position: center`
     explícito nas duas. `align-items: start` acrescentado em `.home-tiles`/`.category-grid`
     (achado ao vivo: sem isso, o Grid stretava a altura de um tile mais curto pra igualar o
     vizinho de 2 linhas de nome na mesma fileira, expondo uma tira vazia de
     `--color-surface-elevated` embaixo da faixa mais curta).
  4. **Mosaico de bandeiras substitui a foto de temperos (`hub-cozinhas.webp`) no tile "Países"
     da Home e no banner do hub Países** — ⚠️ **REVOGADO pelo rumo novo de Países (26/07/2026),
     ver seção própria no fim deste documento.** O mosaico não existe mais em lugar nenhum:
     `.flag-mosaic`, `buildFlagMosaicHtml()`, `FLAG_MOSAIC_ISO2`, `GRUPO_BANNER_MOSAIC` e os
     tokens `--flag-mosaic-blur`/`--flag-mosaic-veil` foram removidos, e `hub-cozinhas.webp` saiu
     do repo. Registro histórico abaixo mantido só pra explicar por que a linhagem existiu.
     O dono achou a composição sem identidade nessas 2
     superfícies especificamente (o resto do acervo de categoria continua igual).
     `hub-cozinhas.webp` fica ARQUIVADO em disco, sem consumidor. `.flag-mosaic`: 9 bandeiras
     fixas (`FLAG_MOSAIC_ISO2` em app.js), cada uma com `blur(var(--flag-mosaic-blur))` +
     `scale(1.15)`, mais 1 véu ÚNICO (`--flag-mosaic-veil`, `rgba(15, 15, 14, 0.45)`) sobre o
     conjunto inteiro (não por bandeira) — blur/véu mais fortes que o tile de país individual
     porque aqui é fundo decorativo, não identificação. MESMO componente
     (`buildFlagMosaicHtml()`) nas 2 superfícies, garantindo consistência sem duplicar HTML.

  **Calibração final, rodada 3 (mesmo dia, mesmo commit) — 3 ajustes, pós-revisão do dono vendo
  a rodada 2 no ar:**
  1. `--flag-blur` (tile de país individual, hub Países + modal de Filtros): **6px → 2,5px** —
     6px "virava mancha"; a bandeira precisa ficar RECONHECÍVEL, só com borda suavizada, nunca
     uma cor sem forma. Confirmado ao vivo: Brasil legível como Brasil nas 2 superfícies. Véu
     inalterado (`rgba(15, 15, 14, 0.35)`).
  2. `.flag-mosaic`: grid 2x2 (4 células grandes) → **grid 3x3 (9 células)** — célula grande
     demais lia como blob de cor, não como bandeira; 3x3 lê como textura de "vitral"/muitas
     bandeiras. `--flag-mosaic-blur` **10px → 4px** (célula menor precisa de menos blur pra
     ainda ler como bandeira). As 9 (`FLAG_MOSAIC_ISO2`, preenchimento em ordem de leitura do
     grid) escolhidas maximizando contraste de cor dominante entre vizinhos ortogonais:
     BR verde / FR azul / IT verde-branco / KR branco / IN laranja / GR azul / MX verde /
     JP branco-vermelho / ES vermelho-amarelo. Os 3 verdes (BR/IT/MX) ficam em cantos
     não-adjacentes entre si; os 2 azuis (FR/GR) também não se tocam. Par mais fraco do
     conjunto: JP-ES (os dois têm vermelho), aceito porque cada um lê dominante diferente
     (branco vs. amarelo) à distância de blur.
  3. Label do tile da Home "Navegar por Países" → **"Países"** (mesmo texto do título do
     próprio hub) — o label longo quebrava em 2 linhas e deixava esse tile mais alto que os
     outros 3 na mesma fileira do grid CSS (`align-items: start` evita o STRETCH, mas não evita
     a DIFERENÇA de altura natural entre um label de 1 linha e um de 2). `.home-tile__band`
     ganhou `min-height` derivado (`calc(var(--text-md) * var(--leading-tight) + var(--space-3)
     * 2)`) como rede de segurança pra qualquer label futuro. Medido ao vivo: os 4 tiles da
     Home com altura TOTAL idêntica, 174,05px, e faixa idêntica, 46,8px.

  **Calibração final de bandeiras, rodada 4 (2026-07-26, mesmo commit) — correção de causa raiz
  (proporção do acervo, não só blur/zoom disfarçando um corte), decisão do dono + estrategista:**
  1. **Acervo de bandeira REGERADO 3:2 (600×400), não mais 1:1 (600×600)**
     (`scripts/exportar-bandeiras.py`/`.js`, das 20 `imagens/bandeiras/<ISO2>.svg`) — o quadrado
     forçava corte em TODA bandeira, inclusive nas 14 (de 20) cuja proporção nativa já É
     exatamente 3:2 (medida direto do SVG, não assumida de tabela): AT, CN, ES, FR, GR, IN, IT,
     JP, KR, LB, MA, PE, PT, TH (corte zero). As 6 restantes: mais largas que 3:2 (cortam
     largura) — DE 1,6667 / MX 1,75 / US 1,9 / HU 2,0 (a mais larga do acervo); mais estreitas
     (cortam altura) — BR 1,4286 / DK 1,3214. EUA: o cantão (as 50 estrelas) fica no canto
     superior esquerdo, não centralizado — corte central da largura o cortaria ao meio; âncora
     especial (`ANCORA_X['US']=0.0` no `.py`, `ANCORA={US:'left'}` no `.js`) prende o corte na
     borda esquerda, preservando o cantão inteiro (confirmado por inspeção visual do arquivo
     gerado). BR/MX (os outros 2 casos com emblema) têm emblema centralizado — corte simétrico
     seguro, confirmado visualmente. O `.py` (rewrite completo, é a versão canônica/legível da
     decisão) não RODOU nesta máquina — falta libcairo/GTK3 runtime no Windows, que um
     `pip install` sozinho não resolve; quem rodou de fato foi `scripts/exportar-bandeiras.js`
     (Node+sharp, mesmo cálculo de corte/âncora, libvips já embutido no pacote, sem instalador de
     sistema separado) — os dois devem ficar sincronizados se o alvo mudar nesta decisão de novo.
  2. **Slot de mídia dos tiles de bandeira INDIVIDUAL (`.category-card--flag`/`.filter-tile--photo`)
     casa 3:2, a mesma proporção do asset** — `aspect-ratio: 3 / 2` no lugar do `1:1`
     herdado de categoria; `object-fit: cover` agora É o corte mínimo possível, medido ao vivo
     praticamente zero (`.category-card--flag .category-card__media` 167×111,328 = razão 1,5001;
     `.filter-tile--photo .filter-tile__media` 107,313×71,547 = razão 1,4999 — os 2 batem 3:2 na
     margem de arredondamento de subpixel). `scale(1.15)` → **`scale(1,02)`** nos dois — zoom é
     só o suficiente pra esconder a borda clara de um blur agora bem mais leve (item 3), não
     precisa mais disfarçar corte de proporção que não existe. **REGRA GERAL, nova nesta
     rodada, vale pra qualquer imagem de tile daqui pra frente (inclusive filtro futuro que não
     seja bandeira):** a área de mídia de um tile deve casar a proporção do PRÓPRIO asset; o
     zoom aplicado é o mínimo que cobre a caixa, nunca um valor solto escolhido pra esconder
     desalinhamento de proporção — se o zoom precisa ser grande, o sintoma real é proporção
     errada entre mídia e asset, não falta de zoom.
  3. **Blur quase imperceptível** — `--flag-blur` **2,5px → 1px** nas 2 superfícies de bandeira
     individual (hub Países + modal de Filtros): com o corte de proporção zerado (item 2), 2,5px
     já era mais forte do que o necessário só pra suavizar a borda de amostragem; o véu
     (inalterado, `rgba(15, 15, 14, 0.35)`) é quem preserva a identidade escura da faixa por
     cima — não o blur, que agora só tira o serrilhado. Confirmado ao vivo: Brasil legível como
     Brasil no hub Países e no modal de Filtros, borda só de leve suavizada, bandeira quase nítida.
  4. **Mural de bandeiras INTEIRAS substitui o mosaico recortado 3×3 da rodada 3** (tile "Países"
     da Home + banner do hub Países, mesmo componente `.flag-mosaic`/`buildFlagMosaicHtml()`/
     `FLAG_MOSAIC_ISO2` nas 2 superfícies) — grid **2×2** (4 bandeiras: BR/FR/JP/ES, ordem de
     leitura do grid, escolhidas maximizando contraste de cor dominante entre vizinhas ortogonais:
     BR verde / FR azul / JP branco-vermelho / ES vermelho-amarelo, nenhum par do mesmo domínio de
     cor é vizinho). Geometria de grid N×N (linhas=colunas): cada célula herda a MESMA proporção
     do container hospedeiro — dividir W e H pelo mesmo N preserva a razão W/H — não uma "célula
     3:2 ideal" isolada; corte por `object-fit: cover` vira só a diferença entre a proporção do
     host e a do asset (3:2), medida ao vivo em 390×844 (`getComputedStyle` real, não estimativa):
     tile da Home (host 4:3=1,3333, célula medida 82×61,125=1,3415) corta **10,57%** da LARGURA
     da bandeira (5,28% de cada lado); banner do hub (host medido 375×236,3125=1,5869, célula
     186×116,656=1,5944) corta **5,92%** da ALTURA (2,96% de cada lado). 3×3 daria o MESMO
     percentual (é geometria de N×N, não do número de células) — 2×2 escolhido por dar bandeiras
     maiores/mais reconhecíveis com o mesmo corte, e por serem INTEIRAS reconhecíveis, não uma
     textura de fragmentos como a rodada 3. `--flag-mosaic-blur` **4px → 1,5px** (célula agora é
     bandeira quase completa, não precisa disfarçar fragmento) + véu **`0.45` inalterado** (véu,
     não blur, preserva identidade — mesmo raciocínio do item 3); `scale(1.15)` →
     **`scale(1,03)`**. Achado ao vivo durante a calibração desta rodada: sem `min-width: 0;
     min-height: 0;` em `.flag-mosaic img`, o mínimo automático de item de grid (que considera o
     aspect-ratio intrínseco 3:2 da imagem quando a coluna já tem largura definida) virava o PISO
     da linha — no banner do hub esse piso (124px) excedia a altura real do container (116,656px),
     e o grid estourava por baixo do `overflow: hidden` do host, cortando parte da bandeira de
     baixo silenciosamente (0 erro no console). `min-width/height: 0` remove o piso e deixa `1fr`
     dividir o espaço real disponível — confirmado via `getComputedStyle` mostrando
     `gridTemplateRows` correto (`116,656px 116,656px`) só depois do fix.
  5. **Achado ao vivo na verificação final desta rodada (bug pré-existente, não introduzido
     agora, só descoberto ao testar de novo):** `.filter-tile--photo .filter-tile__band` tinha só
     `display: block` — sem gap nenhum entre `.filter-tile__label` e `.filter-tile__count` (2
     `<span>` irmãos colados no HTML, sem espaço), o nome e a contagem colidiam na tela
     ("Itália12", sem separação). No tile-ícone base o espaçamento vem do `.filter-tile` PAI
     (flex column + gap, label/contagem são filhos diretos dele junto do ícone) — o tile de país
     nunca teve esse mesmo tratamento na própria faixa. Corrigido com `display: flex;
     flex-direction: column; align-items: center; gap: 2px;` (mesmo `gap: 2px` de
     `.category-card__band`, consistência entre os 2 componentes; `align-items: center` — não
     `stretch` — pra manter o mesmo centro visual dos outros tiles do grid de Filtros,
     Equipamento/Proteína incluídos).

- **Exceção à regra "mídia casa a proporção do próprio asset" — mini-rodada visual de
  fechamento (2026-07-29, decisão do dono a partir de prints de referência, iFood como régua
  de calha).** A regra geral (item 2 acima, rodada 4) continua valendo como padrão — mas às
  vezes a consistência ENTRE classes de tile pesa mais que preservar a proporção nativa do
  asset sem corte nenhum; quando isso acontece, o corte central decide. Primeiro caso real:
  `.category-card__media` (grade de Mais Categorias + todos os 5 hubs, mesmo
  `renderCollectionCard` compartilhado) saiu do 1:1 nativo do asset (600×600, zero corte) para
  4:3 — a MESMA proporção de `.home-tile__media` — perdendo ~25% da altura do quadrado
  original por corte central (`object-position: center`, herdado, não mudou). Tolerável porque
  o acervo de categoria é sempre composição overhead centrada (prato no meio, nunca encosta
  nas bordas); confirmado ao vivo tile a tile (Mais Categorias + os hubs com grid), nenhum
  decapita o prato — ver relatório da tarefa pros números por tile. `.category-card--country`
  já vivia em 4:3 desde o rumo novo de Países (rodada anterior) — deixa de ser um caso isolado
  e vira o primeiro precedente desta exceção.

- **Coleções abstratas de tempo/dificuldade ganham ilustração — extensão do rumo de Países
  (2026-07-31, ver `CONTRATO-IMAGENS-REDESIGN.md` §4 "Coleções abstratas de tempo/dificuldade"
  pra curadoria completa).** As 7 coleções de Por tempo/Por dificuldade (únicas ainda em fallback
  tipográfico) ganham imagem por 2 caminhos, os dois curados à mão em `js/collections.js`, nenhum
  computado: Rápidas/Preparo Longo REUSAM `imagens/categorias/momento-rapidas.webp`/
  `momento-fim-de-semana.webp` (`collection.tileImage`, mesmo caminho de resolução do tile de
  categoria comum — `<img>` direto no innerHTML, sem `loadRecipeImage`); as 5 restantes (Até 1
  Hora/Mais de 1 Hora/Fáceis/Intermediárias/Avançadas) ganham `collection.signatureRecipe`
  (Yakitori/Cassoulet/Guacamole/Ossobuco/Pato Laqueado (Pequim)), resolvida em runtime por
  `loadRecipeImage()` — MESMO pipeline/MESMOS tokens do tile de país, classe
  `.category-card--signature` (regra CSS própria, não reusa `--country`, mas byte a byte a mesma
  receita: 4:3, `display:flex` só pra centralizar o ícone de placeholder, `object-fit:cover`, SEM
  blur/véu — foto de prato não precisa de muleta de bandeira). `.category-card__band` (faixa +
  contraste) não muda nada aqui — os números 17,03:1/10,50:1 já medidos acima pro tile de
  categoria comum valem idênticos, já que `--signature` só sobrescreve `__media`. As 4 restrições
  que curaram as 5 receitas-assinatura (pertence à coleção de verdade, nunca uma das 20
  assinaturas de país já em uso, sem gêmea visual de um tile do acervo GERADO, `nature:"prato"` +
  legível em tile) e o achado de curadoria (um candidato inicial pra Até 1 Hora foi descartado
  por duplicar visualmente `cordeiro.webp`) estão detalhados no CONTRATO, não repetidos aqui.

- **Redesenho do modal de Filtros — sistema de chip de seleção, bug do tile de país, tiles de
  Equipamento normalizados (Fase F1a, 2026-07-27).** Investigação prévia (como sempre neste
  projeto) classificou cada uma das 9 seções pelo que ela já era de fato — tile com
  imagem/ícone funcionando (só normalizar), lista-formulário nativa incl. um "tile" que nunca
  teve ícone de verdade (converter pra chip), ou grade densa própria (manter, só rescolorir) —
  antes de tocar qualquer CSS/JS. Ver `.claude/skills/mobile-recipe-ui/SKILL.md` ("Modal de
  filtros em acordeão") pro resumo de comportamento por seção; aqui ficam os números.
  - **`.filter-chip`** (pill, `renderChipSectionBody`/`.filter-chip--segment` em js/app.js) —
    substitui a lista de `<input type="checkbox">` de Complexidade/Tempo/Tipo de prato e o
    "tile" sem ícone de Proteína/Refeição (`tileIcon` desses dois sempre devolvia `""` — não se
    qualificava como "tile funcionando" pelo próprio critério usado nesta classificação), e o
    segmentado de Papel da proteína (era lista de rádio). Livre: `border: 1px solid
    var(--color-border)`, fundo transparente, `color: var(--color-text-secondary)`. Selecionada:
    `background`/`border-color: var(--color-accent-deep)`, `color: var(--color-text-primary)`,
    `font-weight: 600` — o par já calibrado 4,52:1 na Fase 0a (ver tabela de paleta no topo
    deste documento), reaproveitado sem recalcular. Altura visual **36px** — não 44px cheios —
    com hit-padding invisível via `::after { inset: -6px }`, MESMA fórmula já calibrada pra
    `.recipe-page-tags .tag-chip-link` (border 1px "come" 1px do inset absolute, que resolve
    contra o padding-box do ancestral posicionado, não a borda visível: -6px = 5px pretendido +
    1px de compensação de borda). 36 + 6 + 6 = **48px efetivos**, acima do mínimo de 44px.
    `role="checkbox"`/`aria-checked` (multi-seleção). Papel da proteína (seleção única) NÃO usa
    mais este componente de pílula — ver "Trilho deslizante genérico" abaixo (item 1b, ajuste
    visual, 2026-07-28). Mesmo par de cor também era aplicado à trava do toggle Qualquer
    um/Todos estes do Ingrediente (então `.ingredient-mode-toggle__thumb`, hoje generalizado em
    `.segmented-toggle__thumb`, mesmo parágrafo abaixo), que usava `--color-accent` puro —
    medido em 4,11:1 com o texto ativo em cima (abaixo do 4,5:1 AA); migração deliberadamente
    contida a só esse token na época, animação de mola (260ms, `cubic-bezier(0.34, 1.56, 0.64,
    1)`) preservada, e preservada de novo na generalização de hoje.
  - **Trilho deslizante genérico N-segmentos (item 1b, ajuste visual, 2026-07-28 — regra de
    design nova, formal a partir de agora: MODO/seleção-única-excludente = trilho deslizante;
    OPÇÕES/multi-seleção = chips soltos).** O segmentado de 3 pílulas de Papel da proteína
    (fechado horas antes no mesmo dia) saturava visualmente junto dos chips de proteína logo
    abaixo assim que o dono viu ao vivo — motivo declarado: pílulas soltas competem com o
    mesmo componente visual dos chips normais (`.filter-chip`), sem nada que diferencie "isto é
    um MODO, escolha 1" de "isto são OPÇÕES, marque quantas quiser". Fix: generalizar o toggle
    Qualquer um/Todos estes de Ingrediente (só calibrado pra 2 paradas até então) num componente
    único de N segmentos, `.segmented-toggle` (`segmentedToggleHtml`/`wireSegmentedToggle` em
    app.js) — MESMA mola (260ms `cubic-bezier(0.34, 1.56, 0.64, 1)`, preservada byte a byte) e
    MESMO mecanismo de defer-até-`transitionend` (nunca destrói o nó no meio da transição), só
    generalizados: a trava usa `width: calc(100% / var(--seg-count))` e
    `transform: translateX(calc(var(--seg-index) * 100%))` — 2 custom properties CSS setadas por
    JS (1x na criação + a cada seleção), nunca um modificador de classe por quantidade de
    paradas (`--and` booleano morreu). Ajustes de calibração desta rodada: altura do segmento
    36px→**44px** (era 40px no toggle original — agora bate o mínimo de alvo de toque sem
    precisar de hit-padding via `::after`); cor da opção livre `--color-text-disabled`→
    **`--color-text-secondary`** (alinha com o "livre" do resto do sistema de chip). Teclado:
    `role="radiogroup"` no trilho + `role="radio"`/`aria-checked` em cada opção (herdados do
    segmentado antigo) ganharam setas ←/→ movendo FOCO e SELEÇÃO juntos (padrão nativo de
    radiogroup) — novo nesta rodada, nenhum dos 2 usos tinha antes. Ingrediente migrou pro MESMO
    componente (N=2) — verificado ao vivo que ficou visual/motion IDÊNTICO ao anterior, zero
    divergência futura entre os 2 usos. `.ingredient-mode-toggle*`/`.filter-segmented`/
    `.filter-chip--segment` removidos do CSS, sem consumidor restante.
  - **Correção de semântica de Papel da proteína — app inteiro (2026-07-29).** Deixou de valer
    só em coleção de proteína: aparece (transição curta, `.protein-role-wrap.is-visible`, tokens
    de motion já existentes) sempre que houver >=1 proteína ATIVA — explícita (chip da faceta
    Proteína, qualquer coleção/busca) tem prioridade; sem nada explícito, cai pro implícito da
    coleção quando ela for de proteína (comportamento de sempre, agora caso particular). Nova
    `TagModel.splitByProteinRole(items, S)`: Principal = `protein:X` literal pra QUALQUER X de
    S; Secundário = nenhum `protein:X` de S literal mas `contains:X` presente pra qualquer X —
    OR entre as proteínas do conjunto (uma receita com 2 delas só conta 1x; confirmado com Aves
    real: ave isolado 14 + frango isolado 30 = 44, mas o conjunto {ave, frango} dá 40, não 44 —
    a sobreposição real entre as duas tags prova que é OR de verdade, não soma por tag). Reset:
    desselecionar a última proteína ativa (sem implícito de coleção pra cair) esconde o trilho E
    zera o papel pra Ver tudo (rótulo revisto na mini-rodada de fechamento, 2026-07-29 — era
    "Tanto faz", mecanismo idêntico, só o texto mudou) — nunca um papel "fantasma". Mudança deliberada de comportamento
    na coleção Ovos: "Secundário" era 104 (somava `ingredient:ovo` solto, ovo como simples
    ingrediente de qualquer receita — bolo, pão, massa) e passa a 17 (só `contains:ovo`,
    consistente com a regra única sem exceção por coleção) — as outras 6 coleções de proteína
    permanecem com os mesmos números de sempre.
  - **Bug da caixinha cinza do tile de país, causa raiz e fix.** `.filter-tile` (base
    compartilhada por todos os tiles do modal) é `display: flex; flex-direction: column;
    align-items: center` — certo pro tile-ícone (ícone/label/contagem hugam o próprio
    conteúdo), mas a variante `.filter-tile--photo` nunca sobrescrevia esse `align-items`, então
    seus 2 blocos filhos (`.filter-tile__media`, `.filter-tile__band` — que deveriam ocupar
    100% da largura do tile, como faixas de verdade) ficavam sujeitos ao mesmo cross-axis
    "center" do tile-ícone. `__media` "escapava" do bug por acidente (a imagem interna força uma
    largura intrínseca grande o bastante pra dominar o cálculo do flex); `__band` (só texto
    curto) não tinha nada forçando sua largura, então encolhia pro tamanho do próprio conteúdo.
    Medido ao vivo ANTES do fix (grade País, tile 111,33px de largura): `__band` só 38,58px —
    um retângulo escuro pequeno flutuando centralizado, a "caixinha cinza destoante" do print
    do dono. Fix: `.filter-tile--photo { align-items: stretch; }` (sobrescreve o `center`
    herdado) — medido depois: `__band` 107,33px, igual à `__media`. Não é o mesmo `align-items`
    documentado no item 5 da rodada 4 acima (aquele é do `.filter-tile__band` PRA DENTRO, entre
    label e contagem; este é do `.filter-tile--photo` PRA FORA, entre o tile e seus 2 blocos
    filhos — dois containers flex distintos, sem conflito). `.category-card`/`.home-tile` nunca
    tiveram esse bug por não serem flex (`display: block` puro — filhos em fluxo normal já
    ocupam 100% de largura, sem `align-items` nenhum envolvido).
  - **Tiles de Equipamento normalizados.** Medido ao vivo ANTES do fix (grade a 390px): 8 dos 9
    tiles (label de 1 linha) mediam 111,33×92,39px; só "Processador de Alimentos" (label de 2
    linhas) media 111,34×106,78px — 14,39px mais alto, visivelmente desigual na mesma fileira
    (`.filter-tile-grid` usa `align-items: start`, então a diferença não estica os vizinhos,
    fica exposta). Causa raiz: `.filter-tile__label` não reservava altura nenhuma pro texto —
    só crescia o tile inteiro quando o label quebrava linha. Fix (mesmo padrão já usado em
    `.home-tile__band` pro mesmo tipo de problema): `min-height: calc(var(--text-xs) *
    var(--leading-tight) * 2)` (reserva SEMPRE o espaço de 2 linhas) + `display: flex;
    align-items: center` (centraliza verticalmente um label de 1 linha só dentro do espaço de
    2). Medido depois: os 9 tiles de Equipamento medem 111,33×106,8px, idênticos. Regra
    compartilhada (`.filter-tile__label` é a classe base, sem escopo por seção) — o mesmo fix
    também uniformiza a grade densa do Ingrediente de graça, sem nenhum código extra.

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
tirou todos os casos que existiam (ver skill `mobile-recipe-ui`, seção "Fase 0c"). **As 2
exceções que a Fase 0c tinha deixado de propósito (emoji de categoria/hub em `categories.js`/
`collections.js`/`app.js`, e as bandeiras de país) foram RESOLVIDAS pelo item 6 do roadmap-mestre
(2026-07-26)** — ver bullet "Tile de categoria/home + banner de hub + tile de país" em
"Componentes" acima. `categories.js`/`collections.js`/`app.js` chegam a **zero emoji funcional**
(confirmado por `scripts/verify-emoji-fase0c-2026-07-25.js`, atualizado nesta rodada); a bandeira
de país virou imagem (`imagens/bandeiras/<iso2>.webp`) em todo lugar que antes usava
`COUNTRY_FLAG_EMOJI`/`countryTileIconHtml`/`collection.icon`. `js/countries.js` continua com o
campo `.emoji` (40 code points) como dado histórico/fonte — não é mais lido por nenhuma tela do
app, fora do escopo "zero" por decisão explícita (não é uma exceção nova, é um dado inerte que
sobrou de propósito).

**Tamanhos em uso, por contexto (`css/style.css`, sempre `width`/`height` explícitos — um SVG
sem essas duas propriedades cai no tamanho intrínseco do navegador, não no `font-size` que um
emoji herdava de graça):**

| Contexto | Ícone | Tamanho | Seletor |
|---|---|---|---|
| Botão de remover (`.preparo-card__delete`, Preparos e Lista de Compras) | `close` | 16px | `.preparo-card__delete svg` |
| Thumb de card sem foto (`.recipe-thumb`, `.preparo-card__thumb`) | `photoOff` | 24px | `.recipe-thumb.placeholder svg`, `.preparo-card__thumb.placeholder svg` |
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
