// scripts/verify-protein-search-nav-2026-07-28.js
//
// Suíte dos 3 itens fechados desta tarefa (2026-07-28):
//   1. Papel da proteína — bug de produção investigado (sem defeito de código encontrado,
//      ver relatório da tarefa) + redesenho: seção separada morre, controle segmentado passa a
//      viver DENTRO da seção Proteína (sub-controle no topo do corpo, mesmo padrão do toggle
//      Qualquer um/Todos estes do Ingrediente).
//   2. Limpar busca — botão de limpar (glifo X) interno em toda barra de busca do app (só 2 existem de fato: busca
//      global/Pesquisar e busca contextual de hub/grupo — inventário confirmou que NÃO existe
//      um "modal de países" com busca própria, é a mesma barra de renderGrupo reaproveitada).
//   3. Voltar sem zigue-zague — mecanismo fromHash/histórico (js/router.js) ganha colapso: ao
//      empilhar navegação, se o destino é o mesmo hash do nível penúltimo (o que "voltar 1 passo"
//      já alcançaria), navega via history.go(-1) em vez de empilhar duplicata.
//
// TDD: escrita e rodada RED antes da implementação de cada seção (mesmo padrão já estabelecido
// no projeto, ver verify-filter-redesign-2026-07-27.js), GREEN depois.
//
// js/app.js e js/router.js usam CRLF (\r\n) — nenhuma regex/string aqui assume \n puro num
// literal multi-linha (ver memória cardapio-verify-script-base-commit).
//
// Nenhuma comparação usa ref de git — só valores literais, regra do CLAUDE.md.
//
// `node scripts/verify-protein-search-nav-2026-07-28.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const routerJs = fs.readFileSync(path.join(ROOT, "js", "router.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

// Mesmo padrão de fatiamento já estabelecido (verify-filter-redesign-2026-07-27.js): fronteira é
// a PRÓXIMA declaração de função no mesmo nível de indentação, robusto a reordenação interna.
function sliceModuleFunction(src, startNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return null;
  let end = src.indexOf("\r\n  function ", start + startNeedle.length);
  if (end < 0) end = src.length;
  return src.slice(start, end);
}
function sliceNestedFunction(src, startNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return null;
  let end = src.indexOf("\r\n      function ", start + startNeedle.length);
  if (end < 0) end = src.length;
  return src.slice(start, end);
}

function main() {
  console.log("==================================================");
  console.log("ITEM 1b — Papel da proteína aninhado dentro de Proteína");
  console.log("==================================================");

  assert(!/function renderProteinRoleSection\(\)/.test(appJs), "renderProteinRoleSection não existe mais como seção própria (matou a seção separada)");

  const renderBodyScope = sliceNestedFunction(appJs, "function renderBody() {");
  assert(!!renderBodyScope, "renderBody() encontrado");
  assert(
    !!renderBodyScope && !/renderProteinRoleSection/.test(renderBodyScope),
    "renderBody() não referencia mais renderProteinRoleSection — toda coleção (proteína ou não) sempre renderiza exatamente defs.length seções de topo"
  );
  assert(
    !!renderBodyScope && /defs\.forEach\(\(def\) => bodyEl\.appendChild\(renderGenericSection\(def\)\)\);/.test(renderBodyScope),
    "renderBody() continua montando as seções via defs.forEach(renderGenericSection) — mecanismo de topo intacto"
  );

  const chipBodyScope = sliceNestedFunction(appJs, "function renderChipSectionBody(sectionBody, def, options) {");
  assert(!!chipBodyScope, "renderChipSectionBody encontrado");
  assert(!!chipBodyScope && /def\.key === "protein" && opts\.proteinRole/.test(chipBodyScope), 'gate exato def.key === "protein" && opts.proteinRole (só a seção Proteína ganha o sub-controle, só quando a coleção tem papel de proteína pra oferecer)');
  assert(!!chipBodyScope && /filter-subcontrol-label/.test(chipBodyScope), "label visível do sub-controle presente (rótulo próprio — diferente do toggle de Ingrediente, que não tem um)");
  assert(!!chipBodyScope && chipBodyScope.indexOf("Papel da proteína") !== -1, 'rótulo mantido EXATAMENTE "Papel da proteína" (decisão do dono: não trocar por nenhuma das 2 alternativas de copy)');
  // role="radiogroup" em si agora mora dentro de segmentedToggleHtml (função separada, checada
  // na seção "AJUSTE VISUAL" abaixo) — aqui só confirma que renderChipSectionBody passa o
  // aria-label certo pra essa função compartilhada, provando que É o trilho de Papel da
  // proteína sendo montado, não outra instância genérica.
  assert(!!chipBodyScope && /segmentedToggleHtml\("Papel da proteína"/.test(chipBodyScope), 'segmentedToggleHtml chamado com aria-label "Papel da proteína" (role=radiogroup vem de dentro dessa função, checado na seção seguinte)');
  assert(!!chipBodyScope && /"Ver tudo"/.test(chipBodyScope) && /Principal \(/.test(chipBodyScope) && /Secundário \(/.test(chipBodyScope), "os 3 segmentos (Ver tudo/Principal (N)/Secundário (N)) presentes, com contagem — rótulo revisto 2026-07-29 (era Tanto faz), confirmado ao vivo em 360px que cabe no 1/3 do trilho sem truncar");
  assert(!!chipBodyScope && !/"Tanto faz"/.test(chipBodyScope), "TESTE NEGATIVO: rótulo antigo \"Tanto faz\" não sobrevive no código");
  assert(
    !!chipBodyScope && /querySelectorAll\(".filter-chip-row .filter-chip"\)/.test(chipBodyScope),
    "listener dos chips de VALOR (protein:X) escopado a .filter-chip-row .filter-chip — NÃO ao seletor genérico .filter-chip, que agora TAMBÉM casaria os botões do trilho (bug de contaminação cruzada: mexer no trilho não pode mexer em draftFacetState.protein)"
  );
  assert(!!chipBodyScope && /segmentedToggleHtml\(/.test(chipBodyScope), "Papel da proteína usa o gerador compartilhado segmentedToggleHtml(...) — não reconstrói HTML de segmentado à mão");
  assert(!!chipBodyScope && /wireSegmentedToggle\(/.test(chipBodyScope), "Papel da proteína fia o trilho via wireSegmentedToggle(...) compartilhado — mesma mola/teclado/mecanismo do toggle de Ingrediente");
  assert(!!chipBodyScope && /draftProteinRole = roleOptions\[index\]\.value \|\| null;/.test(chipBodyScope), "onSelect do trilho escreve draftProteinRole pelo índice escolhido (mesmo rascunho de antes, só mudou o mecanismo de seleção)");

  console.log("");
  console.log("==================================================");
  console.log("ITEM 1b — AJUSTE VISUAL: trilho deslizante generalizado (2026-07-28, rodada 2)");
  console.log("==================================================");
  // Pedido do dono, ratificado: 3 pílulas soltas do segmentado saturavam junto dos chips de
  // proteína — vira trilho deslizante, generalizando o MESMO componente do toggle de Ingrediente
  // (antes calibrado só pra 2 paradas) pra N segmentos via custom properties CSS
  // (--seg-count/--seg-index) em vez de recalcular posição/largura em JS por quantidade.

  // Checa REGRA viva (comentários /* ... */ removidos primeiro) — mencionar o nome antigo num
  // comentário histórico ("era X") é convenção já estabelecida do projeto, não pollution.
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/\.filter-segmented\b/.test(cssNoComments) && !/\.filter-chip--segment\b/.test(cssNoComments), ".filter-segmented/.filter-chip--segment sem regra viva no CSS (fora de comentário) — substituídos pelo trilho único .segmented-toggle");
  assert(!/class="filter-segmented"/.test(appJs) && !/filter-chip--segment/.test(appJs), "nenhuma referência residual a filter-segmented/filter-chip--segment em app.js (nem em comentário)");
  assert(!/\.ingredient-mode-toggle\b/.test(cssNoComments), ".ingredient-mode-toggle (nome antigo, só-Ingrediente) sem regra viva no CSS (fora de comentário) — generalizado pra .segmented-toggle");
  assert(!/ingredient-mode-toggle/.test(appJs), "nenhuma referência residual a ingredient-mode-toggle em app.js — Ingrediente também migrou pro componente novo");

  const segHtmlScope = sliceModuleFunction(appJs, "function segmentedToggleHtml(");
  assert(!!segHtmlScope, "segmentedToggleHtml(ariaLabel, options, selectedIndex) — gerador de HTML único, module-level (reusável sem depender do closure do modal)");
  assert(!!segHtmlScope && /role="radiogroup"/.test(segHtmlScope), 'trilho carrega role="radiogroup"');
  assert(!!segHtmlScope && /role="radio"/.test(segHtmlScope), "cada opção carrega role=\"radio\"");
  assert(!!segHtmlScope && /--seg-count/.test(segHtmlScope) && /--seg-index/.test(segHtmlScope), "posição/contagem via custom properties CSS (--seg-count/--seg-index) — generaliza N sem modificador de classe por quantidade");
  assert(!!segHtmlScope && /segmented-toggle__thumb/.test(segHtmlScope), "elemento .segmented-toggle__thumb (a trava deslizante) presente no HTML gerado");

  const wireScope = sliceModuleFunction(appJs, "function wireSegmentedToggle(");
  assert(!!wireScope, "wireSegmentedToggle(containerEl, onSelect, onSettled) — fiação compartilhada");
  assert(!!wireScope && /ArrowLeft/.test(wireScope) && /ArrowRight/.test(wireScope), "setas ←→ movem a seleção (padrão de teclado de radiogroup nativo)");
  assert(!!wireScope && /transitionend/.test(wireScope), "onSettled (renderBody completo) só roda DEPOIS da transição terminar — nunca destrói o nó no meio da mola (mesmo cuidado que o toggle de Ingrediente já tinha)");
  assert(!!wireScope && /setTimeout\(settle, 400\)/.test(wireScope), "timeout de segurança de 400ms preservado (caso transitionend não dispare — prefers-reduced-motion, por ex.)");

  const ingredientBodyScope = sliceNestedFunction(appJs, "function renderIngredientTileSectionBody(sectionBody, def, options) {");
  assert(!!ingredientBodyScope, "renderIngredientTileSectionBody encontrado");
  assert(!!ingredientBodyScope && /segmentedToggleHtml\(/.test(ingredientBodyScope), "toggle de Ingrediente (Qualquer um/Todos estes) também usa segmentedToggleHtml — componente ÚNICO pros 2 usos, zero divergência futura");
  assert(!!ingredientBodyScope && /wireSegmentedToggle\(/.test(ingredientBodyScope), "toggle de Ingrediente fia via wireSegmentedToggle — mesma mola/teclado do trilho de Papel da proteína");
  assert(!!ingredientBodyScope && /Qualquer um destes/.test(ingredientBodyScope) && /Todos estes/.test(ingredientBodyScope), "rótulos originais do toggle de Ingrediente preservados, byte a byte");

  const trackCss = css.slice(css.indexOf(".segmented-toggle {"), css.indexOf(".segmented-toggle {") + 3500);
  assert(css.indexOf(".segmented-toggle {") !== -1, ".segmented-toggle (trilho) tem regra CSS própria");
  assert(/cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/.test(trackCss), "mola EXATA reaproveitada (260ms cubic-bezier(0.34, 1.56, 0.64, 1)) — mesma curva do toggle de Ingrediente original, não uma nova calibrada");
  assert(/min-height:\s*44px/.test(trackCss), "altura do segmento >=44px (era 40px no toggle antigo — ajuste pedido nesta rodada)");
  assert(/color:\s*var\(--color-text-secondary\)/.test(trackCss), "opção NÃO selecionada usa --color-text-secondary (era --color-text-disabled no toggle antigo — ajuste pedido nesta rodada, alinha com o unselected do sistema de chip)");
  assert(/color:\s*var\(--color-text-primary\)/.test(trackCss), "opção selecionada usa --color-text-primary (par 4,52:1 já calibrado, reaproveitado)");
  assert(/width:\s*calc\(100% \/ var\(--seg-count/.test(trackCss), "largura da trava = 100%/N (generaliza pra qualquer N, não só 50% fixo)");
  assert(/translateX\(calc\(var\(--seg-index/.test(trackCss), "posição da trava = índice * 100% da própria largura (generaliza a mesma matemática do toggle de 2 pra N paradas)");

  // Teste negativo: as OUTRAS facetas de chip (Complexidade/Tempo/Refeição/Tipo de prato) não
  // ganham o sub-controle — a função é compartilhada, o gate é que decide, não uma duplicata.
  const genericSectionScope = sliceNestedFunction(appJs, "function renderGenericSection(def) {");
  assert(
    !!genericSectionScope && /else if \(def\.multi && def\.combineMode === "or"\) renderChipSectionBody\(sectionBody, def, options\);/.test(genericSectionScope),
    "renderGenericSection continua despachando TODAS as facetas multi/or (incl. Proteína) pra renderChipSectionBody — nenhum layout novo introduzido só pra Proteína"
  );

  // Teste negativo: o mecanismo por trás (tagmodel/opts) não foi tocado — só a apresentação.
  const applyBtnScope = appJs.slice(appJs.indexOf('applyBtn.addEventListener("click"'), appJs.indexOf('applyBtn.addEventListener("click"') + 400);
  assert(/if \(opts\.proteinRole\) opts\.proteinRole\.setValue\(draftProteinRole\);/.test(applyBtnScope), "Ver resultados continua aplicando draftProteinRole via opts.proteinRole.setValue — mecanismo de aplicação intacto");
  // SUPERSEDIDO pela correção de semântica (2026-07-29, seção "ITEM SEMÂNTICA" mais abaixo): o
  // gate isProteinRole (fixo, só collectionType==="protein") foi deliberadamente removido e
  // substituído por um dinâmico (activeProteinTagIds) — este item 1b só reposicionou o MARKUP,
  // não tocou o gate; a rodada seguinte no mesmo dia é que generalizou o gate em si, por pedido
  // explícito do dono. Ver seção 7 da "ITEM SEMÂNTICA" pro teste negativo atualizado.
  assert(!/const isProteinRole = collection\.collectionType === "protein" && baseRelated\.length > 0;/.test(appJs), "gate isProteinRole antigo NÃO existe mais — generalizado pra activeProteinTagIds na correção de semântica do mesmo dia (2026-07-29)");

  console.log("");
  console.log("==================================================");
  console.log("ITEM 2 — botao de limpar busca em toda barra de busca do app");
  console.log("==================================================");

  // Literal encadeado atualizado 2026-07-29 (S1, barra de busca em categoria): +1 <input>
  // (.home-search de renderCategory, mesmo componente do hub) — ver seção 11 de
  // verify-busca-unificada-2026-07-29.js.
  assert((appJs.match(/document\.createElement\("input"\)/g) || []).length === 4, "inventário confirmado: 4 <input> no app inteiro (home-search do hub, home-search de categoria, tagsearch-input da busca global, e o input numérico do timer — este último NÃO é busca, fora de escopo)");

  const clearHelperScope = sliceModuleFunction(appJs, "function attachSearchClear(");
  assert(!!clearHelperScope, "helper compartilhado attachSearchClear encontrado (1 implementação, 2 usos — home-search e tagsearch-input)");
  assert(!!clearHelperScope && /setAttribute\("aria-label", "Limpar busca"\)/.test(clearHelperScope), 'aria-label "Limpar busca" presente (mesmo padrão setAttribute de createBackFloat/createExitCookFloat, não HTML literal)');
  assert(!!clearHelperScope && /iconSvg\("close"/.test(clearHelperScope), "reaproveita iconSvg(\"close\") já existente (Fase 0c) — nenhum ícone novo criado");
  assert(!!clearHelperScope && /search-clear-btn/.test(clearHelperScope), "classe própria .search-clear-btn (reaproveitável nos 2 pontos)");

  // Busca a regra de verdade (".search-clear-btn {"), não uma menção em comentário — achado ao
  // escrever esta suíte: a 1ª ocorrência textual de ".search-clear-btn" no arquivo é dentro de um
  // comentário (âncora do .home-search-wrap), bem antes da regra real.
  const searchClearBtnRuleIdx = css.indexOf(".search-clear-btn {");
  const searchClearBtnCss = css.slice(searchClearBtnRuleIdx, searchClearBtnRuleIdx + 1500);
  assert(searchClearBtnRuleIdx !== -1, ".search-clear-btn tem regra CSS própria");
  assert(/inset:\s*-\d+px/.test(searchClearBtnCss), "hit-area estendida via ::after inset (mesmo padrão de .preparo-card__delete) — alvo >=44px");

  // Literal encadeado atualizado 2026-07-29 (S1, barra de busca em categoria): +1 chamada de
  // attachSearchClear (renderCategory reusa o helper, mesmo padrão do hub) — ver seção 11 de
  // verify-busca-unificada-2026-07-29.js.
  assert((appJs.match(/attachSearchClear\(/g) || []).length === 4, "attachSearchClear: 1 declaração + 3 chamadas (home-search do hub, home-search de categoria, tagsearch-input), nenhuma duplicada");

  const grupoScope = sliceModuleFunction(appJs, "function renderGrupo(grupoId) {");
  assert(!!grupoScope && /attachSearchClear\(\s*search,/.test(grupoScope), "busca do hub (renderGrupo/.home-search) usa o helper compartilhado");

  const buscaScope = sliceModuleFunction(appJs, "function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery, initialRole) {");
  assert(!!buscaScope && /attachSearchClear\(\s*input,/.test(buscaScope), "busca global (renderBusca/.tagsearch-input) usa o helper compartilhado");

  // Teste negativo: o input numérico do timer (cook-timer-display__edit-input) NUNCA ganha o
  // botão de limpar — não é uma barra de busca, está fora do escopo do item 2.
  const timerInputScope = appJs.slice(appJs.indexOf('input.className = "cook-timer-display__edit-input"') - 200, appJs.indexOf('input.className = "cook-timer-display__edit-input"') + 400);
  assert(timerInputScope.indexOf("attachSearchClear") === -1, "teste negativo: input numérico do timer NÃO ganha attachSearchClear (não é busca)");

  console.log("");
  console.log("==================================================");
  console.log("ITEM 3 — Voltar sem zigue-zague (colapso no mecanismo fromHash/histórico)");
  console.log("==================================================");

  assert(/navHistory/.test(routerJs), "router.js ganhou rastreamento de pilha de navegação (navHistory)");
  assert(/history\.go\(-1\)/.test(routerJs), "colapso usa history.go(-1) — navegação nativa de 1 passo, não um push duplicado");
  assert(
    /navHistoryStack\[navHistoryStack\.length - 2\] === path/.test(routerJs) || /navHistoryStack\[cursor - 1\] === path/.test(routerJs),
    "navigate() compara o destino contra o penúltimo nível ANTES de decidir empilhar (regra: mesmo hash do penúltimo -> colapsa)"
  );
  assert(/function replace\(path\)/.test(routerJs) && /navHistoryStack\[cursor\] = path;/.test(routerJs), "replace() também mantém a pilha rastreada em sincronia (sobrescreve o topo, já que replaceState não empilha)");
  assert(/pendingSelfNav/.test(routerJs), "hashchange nativo (voltar/avançar de verdade, ex. botão físico) é distinguido de navegação própria — cursor resincroniza sozinho");

  console.log("");
  console.log("==================================================");
  console.log("ITEM 3b — TESTE-TABELA COMPORTAMENTAL (simulador de histórico real do navegador)");
  console.log("==================================================");
  // Regra estática (acima) só prova que o PADRÃO existe no código-fonte — não que o algoritmo
  // produz o resultado certo. Aqui router.js roda DE VERDADE (new Function, mesmo padrão já
  // estabelecido em verify-recipe-name-pt-2026-07-24.js), com location/history simulados como um
  // navegador real se comportaria: location.hash= empilha (corta o "futuro" a partir do cursor,
  // como QUALQUER navegador faz), history.go(n) move o cursor sem empilhar,
  // history.replaceState não dispara hashchange. "voltar nativo" é simulado chamando
  // historyMock.go(-1) DIRETO (bypassando o Router por completo) — exatamente o que um botão
  // físico/gesto do sistema faz, já que o app não controla esse evento.
  function makeRouterSandbox(initialPath) {
    let currentHash = "#/" + (initialPath || "");
    let hashChangeHandler = null;
    const real = { stack: [initialPath || ""], cursor: 0 };
    function fireHashChange() {
      if (hashChangeHandler) hashChangeHandler();
    }
    const locationMock = {
      pathname: "/guiaculinario/",
      search: "",
      get hash() {
        return currentHash;
      },
      set hash(v) {
        const newPath = String(v).replace(/^\/?/, "");
        const newHashStr = "#/" + newPath;
        if (newHashStr === currentHash) return; // sem mudança real — browser real não faz nada
        real.stack = real.stack.slice(0, real.cursor + 1);
        real.stack.push(newPath);
        real.cursor = real.stack.length - 1;
        currentHash = newHashStr;
        fireHashChange();
      },
    };
    const historyMock = {
      go: (n) => {
        const target = Math.max(0, Math.min(real.stack.length - 1, real.cursor + n));
        if (target === real.cursor) return;
        real.cursor = target;
        currentHash = "#/" + real.stack[real.cursor];
        fireHashChange();
      },
      replaceState: (state, title, url) => {
        const hashIdx = url.indexOf("#");
        const newHashStr = hashIdx === -1 ? "#/" : url.slice(hashIdx);
        real.stack[real.cursor] = newHashStr.replace(/^#\/?/, "");
        currentHash = newHashStr;
      },
    };
    const win = { Storage: { RENAME_SLUG_MAP: {} } };
    win.addEventListener = (evt, fn) => {
      if (evt === "hashchange") hashChangeHandler = fn;
    };
    global.location = locationMock;
    global.history = historyMock;
    // eslint-disable-next-line no-new-func
    new Function("window", routerJs)(win);
    return { Router: win.Router, real, nativeBack: () => historyMock.go(-1), nativeForward: () => historyMock.go(1) };
  }

  console.log("");
  console.log("-- sequência 1: exemplo LITERAL do dono --");
  console.log("-- receita->preparo->receita->preparo->voltar->voltar deve dar receita->origem, sem repetir preparo --");
  {
    const { Router, nativeBack } = makeRouterSandbox("categoria/aves");
    Router.toReceita("paella", "categoria/aves"); // origem -> receita
    assert(Router.current().name === "receita", "hop 1 (origem->receita): rota atual é receita");
    Router.toCozinhar("paella", "categoria/aves", null); // receita -> preparo
    assert(Router.current().name === "cozinhar", "hop 2 (receita->preparo): rota atual é preparo");
    Router.toReceita("paella", "categoria/aves"); // preparo -> receita (nome no cabeçalho/Sair) — MESMO fromHash de sempre
    assert(Router.current().name === "receita", "hop 3 (preparo->receita, título/Sair): rota atual é receita de novo");
    Router.toCozinhar("paella", "categoria/aves", null); // receita -> preparo (2ª vez)
    assert(Router.current().name === "cozinhar", "hop 4 (receita->preparo, 2ª vez): rota atual é preparo de novo");
    nativeBack(); // 1º "voltar" — botão físico/gesto, único jeito de sair do preparo sem usar "Sair"
    assert(Router.current().name === "receita", "1º voltar nativo: dá RECEITA (não repete preparo)");
    nativeBack(); // 2º "voltar"
    const afterSecondBack = Router.current();
    assert(afterSecondBack.name === "categoria", "2º voltar nativo: dá a ORIGEM (categoria/aves), não repete preparo nem receita — resultado exato pedido pelo dono");
  }

  console.log("");
  console.log("-- sequência 2: caminho simples (baseline) — colapso não muda o resultado do caso comum --");
  {
    const { Router, real } = makeRouterSandbox("categoria/aves");
    Router.toReceita("paella", "categoria/aves");
    Router.navigate("categoria/aves"); // clique no back-float da receita (fromHash de sempre)
    assert(Router.current().name === "categoria" && Router.current().catId === "aves", "voltar simples (1 visita só) continua indo pra categoria/aves — comportamento idêntico ao de antes");
    assert(real.stack.length === 2, "colapso evitou crescer o histórico real pra 3 entradas (ficou em 2: origem+receita) — o 'voltar' virou go(-1) de verdade, não um push duplicado");
  }

  console.log("");
  console.log("-- sequência 3: teste NEGATIVO — 3 telas distintas sem repetição, colapso não deve disparar --");
  {
    const { Router, real } = makeRouterSandbox("grupo/proteinas");
    Router.toCategoria("aves"); // grupo -> categoria
    Router.toReceita("paella", "categoria/aves"); // categoria -> receita
    assert(real.stack.length === 3, "3 telas distintas empilham 3 entradas de verdade (nenhum colapso falso-positivo)");
    Router.navigate(""); // simula qualquer 4ª navegação NOVA (não repete nenhum nível anterior)
    assert(real.stack.length === 4, "4ª navegação nova empilha normalmente — colapso só dispara quando o destino bate com o penúltimo de verdade");
  }

  console.log("");
  console.log("-- sequência 4: replace() no meio do fluxo mantém a pilha rastreada em sincronia --");
  {
    const { Router, real } = makeRouterSandbox("categoria/aves");
    // Refino in-context ENQUANTO ainda na tela de origem (replaceCategoriaFacets usa o mesmo
    // replace()) — acontece ANTES de abrir a receita, cursor=0 (a própria categoria/aves).
    Router.replace("categoria/aves?tags=ingredient:tomate");
    assert(real.stack[0] === "categoria/aves?tags=ingredient:tomate", "replace() atualiza a entrada JÁ EXISTENTE no histórico real (sem empilhar) — refino de filtro não cria entrada nova");
    // fromHash capturado agora É o hash já com o filtro (currentHashPath lido fresco em app.js).
    Router.toReceita("paella", "categoria/aves?tags=ingredient:tomate");
    Router.navigate("categoria/aves?tags=ingredient:tomate"); // voltar da receita, mesmo fromHash
    assert(Router.current().tags && Router.current().tags.indexOf("ingredient:tomate") !== -1, "voltar da receita restaura o filtro aplicado DEPOIS que a receita foi aberta (fromHash sempre lido fresco, comportamento pré-existente não afetado)");
    assert(real.stack.length === 2, "colapso reconheceu o destino (já atualizado via replace) como o penúltimo de verdade — foi um go(-1), não um 3º push");
  }

  console.log("");
  console.log("==================================================");
  console.log("ITEM SEMÂNTICA — Papel da proteína vale no app inteiro (2026-07-29)");
  console.log("==================================================");
  // Correção de semântica: "Papel da proteína" deixa de valer só em coleção de proteína — vale
  // em QUALQUER contexto (busca global, coleção não-proteica) sempre que houver >=1 proteína
  // selecionada. Investigação prévia (relatório da tarefa) confirmou: o mecanismo de hoje
  // (getRecipesByCollection) só sabe operar sobre as tags FIXAS da própria coleção — não existe
  // caminho pra calcular Principal/Secundário a partir de um conjunto de proteínas escolhido
  // dinamicamente. A peça reaproveitável é matchesTagId (protein:X casa contains:X) — a nova
  // função TagModel.splitByProteinRole generaliza isso de "presente?" pra "presente COMO O QUÊ?".

  console.log("");
  console.log("-- 1. TagModel.splitByProteinRole — assinatura e reaproveitamento de matchesTagId --");
  const tagmodelJs = fs.readFileSync(path.join(ROOT, "js", "tagmodel.js"), "utf8");
  assert(/function splitByProteinRole\(/.test(tagmodelJs), "TagModel ganhou splitByProteinRole(items, selectedProteinTagIds)");
  assert(/splitByProteinRole,/.test(tagmodelJs), "splitByProteinRole exportada em window.TagModel");
  const splitFnScope = sliceNestedFunction(tagmodelJs.replace(/\r\n  function /g, "\r\n      function "), "function splitByProteinRole(") || "";
  // (fronteira "\r\n  function " também serve de nested aqui — tagmodel.js só tem 1 nível de
  // indentação de função dentro do IIFE, diferente de app.js que tem módulo E aninhado)

  console.log("");
  console.log("-- 2. Números LITERAIS contra os dados reais (executando a função, não grep) --");
  // Mesmo padrão de sandbox já usado nesta suíte/projeto (new Function/vm + dados reais) — ver
  // scripts/verify-recipe-name-pt-2026-07-24.js. Números confirmados no relatório da investigação
  // (2026-07-29): rodando TagModel.getRecipesByCollection HOJE e comparando com
  // splitByProteinRole aplicada ao mesmo universo com S=primaryFilterTags da própria coleção.
  function loadDataSandbox() {
    const sandbox = {};
    sandbox.window = sandbox;
    const vm = require("vm");
    vm.createContext(sandbox);
    function load(relPath) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, relPath), "utf8"), sandbox, { filename: relPath });
    }
    load("js/countries.js");
    load("js/tags.js");
    load("js/categories.js");
    load("js/collections.js");
    fs.readdirSync(path.join(ROOT, "data"))
      .filter((f) => f.endsWith(".js"))
      .forEach((f) => load(path.join("data", f)));
    load("js/tagmodel.js");
    return sandbox.window;
  }
  const dataWin = loadDataSandbox();
  const TagModel = dataWin.TagModel;
  const allRecipes = TagModel.getAllRecipesFlat();

  // Números por proteína ISOLADA (contra o universo INTEIRO, não só dentro de 1 coleção) — são
  // os números literais do relatório da investigação (2026-07-29), citados pelo dono como
  // referência ("bate com os teus números"). ovo é 33/17 (NÃO 104) — achado durante a
  // investigação: o related da coleção Ovos hoje soma contains:ovo COM ingredient:ovo (egg como
  // simples ingrediente de qualquer receita, ex. massa de bolo/pão/macarrão) — um sinal muito
  // mais largo que "contains:X" das outras 6 proteínas. A especificação fechada do dono usa só
  // protein:X/contains:X — 17 é o número CORRETO da nova semântica; 104 era o comportamento
  // antigo, específico de Ovos, que este item aposenta de propósito (regra única, sem exceção
  // por coleção).
  const LITERAL_COUNTS = [
    { label: "frango", ids: ["protein:frango"], primary: 30, secondary: 7 },
    { label: "ave", ids: ["protein:ave"], primary: 14, secondary: 1 },
    { label: "boi", ids: ["protein:boi"], primary: 50, secondary: 18 },
    { label: "suino", ids: ["protein:suino"], primary: 27, secondary: 43 },
    { label: "cordeiro", ids: ["protein:cordeiro"], primary: 10, secondary: 1 },
    { label: "peixe", ids: ["protein:peixe"], primary: 32, secondary: 8 },
    { label: "frutos-do-mar", ids: ["protein:frutos-do-mar"], primary: 30, secondary: 13 },
    { label: "ovo", ids: ["protein:ovo"], primary: 33, secondary: 17 },
  ];
  LITERAL_COUNTS.forEach((c) => {
    const split = TagModel.splitByProteinRole(allRecipes, c.ids);
    assert(
      split.primary.length === c.primary && split.secondary.length === c.secondary,
      c.label + ": Principal=" + split.primary.length + " (esperado " + c.primary + "), Secundário=" + split.secondary.length + " (esperado " + c.secondary + ")"
    );
  });

  console.log("");
  console.log("-- 3. OR entre proteínas do conjunto — coleção de proteína é CASO PARTICULAR (S = primaryFilterTags) --");
  // col-ovo é EXCEÇÃO DELIBERADA, tratada à parte logo abaixo: seu relatedFilterTags de hoje
  // (["contains:ovo", "ingredient:ovo"]) soma um sinal MUITO mais largo que contains:X (ovo como
  // simples ingrediente de qualquer receita — bolo, pão, massa — não "ovo como componente
  // secundário da proteína"), achado durante a investigação (2026-07-29). A especificação
  // fechada do dono usa só protein:X/contains:X — a regra nova, única, sem exceção por coleção,
  // MUDA o número de Secundário de Ovos de propósito (104 -> 17). As outras 6 continuam idênticas.
  const proteinCollections = dataWin.COLLECTIONS.filter((c) => c.collectionType === "protein" && c.id !== "col-ovo");
  proteinCollections.forEach((c) => {
    const old = TagModel.getRecipesByCollection(c.id);
    const gen = TagModel.splitByProteinRole(old.allRecipes, c.primaryFilterTags);
    assert(
      gen.primary.length === old.primaryRecipes.length && gen.secondary.length === old.relatedRecipes.length,
      "coleção " + c.id + ": splitByProteinRole(universo-da-coleção, primaryFilterTags) reproduz EXATAMENTE getRecipesByCollection de hoje — Principal=" + gen.primary.length + "/Secundário=" + gen.secondary.length
    );
  });
  {
    const oldOvo = TagModel.getRecipesByCollection("col-ovo");
    const genOvo = TagModel.splitByProteinRole(oldOvo.allRecipes, ["protein:ovo"]);
    assert(
      oldOvo.primaryRecipes.length === 33 && oldOvo.relatedRecipes.length === 104,
      "col-ovo ANTES desta rodada: Principal=33/Secundário=104 (o 104 inclui ingredient:ovo solto — qualquer receita com ovo como ingrediente comum, não como proteína secundária de verdade)"
    );
    assert(
      genOvo.primary.length === 33 && genOvo.secondary.length === 17,
      "col-ovo DEPOIS (regra única protein:X/contains:X, sem exceção): Principal=33 (igual), Secundário=17 (era 104) — mudança DELIBERADA, reportada explicitamente, não uma regressão"
    );
  }
  // Teste negativo: soma ingênua por tag individual NÃO é igual ao OR de verdade (Aves tem
  // sobreposição real — receitas com protein:ave E protein:frango ao mesmo tempo).
  const avesGen = TagModel.splitByProteinRole(allRecipes, ["protein:ave", "protein:frango"]);
  const naiveSum = 14 + 30; // ave isolado + frango isolado
  assert(avesGen.primary.length === 40, "Aves (ave+frango combinados): Principal=40 — o número da COLEÇÃO, não a soma ingênua");
  assert(avesGen.primary.length < naiveSum, "TESTE NEGATIVO: 40 < " + naiveSum + " (14+30) — confirma que existe sobreposição real (receita com as duas tags) e o OR não conta 2x, soma ingênua por tag estaria ERRADA");

  console.log("");
  console.log("-- 4. Teste negativo — proteína sem par contains:X definido (leguminosa/laticínio) não quebra --");
  const legSplit = TagModel.splitByProteinRole(allRecipes, ["protein:leguminosa"]);
  assert(legSplit.primary.length === 0 && legSplit.secondary.length === 0, "protein:leguminosa: 0 receitas reais no acervo hoje (achado da investigação) — função não quebra, retorna vazio (nunca aparece como opção clicável no facet Proteína, que só lista contagem > 0)");

  console.log("");
  console.log("-- 5. Gate de visibilidade dinâmico (app.js) — não mais um opts.proteinRole estático --");
  const chipBodyScope2 = sliceNestedFunction(appJs, "function renderChipSectionBody(sectionBody, def, options) {");
  assert(!!chipBodyScope2 && /function activeProteinTagIds\(/.test(appJs), "helper activeProteinTagIds(draftFacetState, collection) existe — explícito tem prioridade, cai pro implícito da coleção só se nada foi selecionado");
  assert(!!chipBodyScope2 && /activeProteinTagIds\(draftFacetState/.test(chipBodyScope2), "renderChipSectionBody consulta activeProteinTagIds a cada render — visibilidade RE-AVALIADA a cada mudança de rascunho, não fixada 1x na abertura do modal");
  assert(!!chipBodyScope2 && /protein-role-wrap/.test(chipBodyScope2), "wrapper .protein-role-wrap presente — sempre no DOM (permite transição de entrada/saída via CSS, não um hard show/hide)");

  console.log("");
  console.log("-- 6. Reset — desselecionar a última proteína (sem fallback implícito) zera o papel --");
  assert(/draftProteinRole = null/.test(chipBodyScope2) && /activeProteinTagIds\(draftFacetState, opts\.collection\)\.length === 0/.test(chipBodyScope2.replace(/\s+/g, " ")), "listener de clique do chip de Proteína, ao ficar sem nenhuma proteína ativa, zera draftProteinRole — nunca fica com papel 'fantasma' (Principal/Secundário) sem nenhuma proteína selecionada");

  console.log("");
  console.log("-- 7. renderCategory — continua funcionando, agora via caso particular --");
  const categoryScope = sliceModuleFunction(appJs, "function renderCategory(catId, initialFacetTags, initialRole, initialIngredientMode) {") || sliceModuleFunction(appJs, "function renderCategory(");
  assert(!!categoryScope, "renderCategory encontrado");
  assert(!!categoryScope && /TagModel\.splitByProteinRole\(/.test(categoryScope), "renderCategory usa TagModel.splitByProteinRole (não mais só basePrimary/baseRelated fixos) pro cálculo de Principal/Secundário");
  assert(!!categoryScope && !/const isProteinRole = collection\.collectionType === "protein" && baseRelated\.length > 0;/.test(categoryScope), "TESTE NEGATIVO: o gate antigo (só collectionType==='protein') não existe mais sozinho — substituído pelo dinâmico");

  console.log("");
  console.log("-- 8. renderBusca — ganhou o caminho que não existia (antes proteinRole: null fixo) --");
  const buscaScope2 = sliceModuleFunction(appJs, "function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery, initialRole) {");
  assert(!!buscaScope2, "renderBusca encontrado");
  assert(!!buscaScope2 && !/proteinRole: null,/.test(buscaScope2), "TESTE NEGATIVO: proteinRole não é mais hardcoded null em renderBusca");
  assert(!!buscaScope2 && /TagModel\.splitByProteinRole\(/.test(buscaScope2), "renderBusca também usa TagModel.splitByProteinRole — mesmo mecanismo de renderCategory, sem duplicar lógica");

  console.log("");
  console.log("-- 9. router.js — busca ganha parâmetro role= (mesmo padrão de categoria) --");
  assert(/if \(k === "role" && v\)/.test(routerJs) && (routerJs.match(/if \(k === "role" && v\)/g) || []).length === 2, "parseHash lê role= tanto em categoria (já existia) quanto em busca (novo) — 2 ocorrências");
  assert(/toBusca: function \(tagIds, textFilters, ingredientMode, role\)/.test(routerJs) || /function buildBuscaPath\(tagIds, textFilters, ingredientMode, query, role\)/.test(routerJs), "toBusca/buildBuscaPath ganham parâmetro role");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
