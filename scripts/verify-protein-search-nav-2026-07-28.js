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
  assert(!!chipBodyScope && /"Tanto faz"/.test(chipBodyScope) && /Principal \(/.test(chipBodyScope) && /Secundário \(/.test(chipBodyScope), "os 3 segmentos (Tanto faz/Principal (N)/Secundário (N)) presentes, com contagem");
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
  assert(/const isProteinRole = collection\.collectionType === "protein" && baseRelated\.length > 0;/.test(appJs), "gate isProteinRole (renderCategory) intacto — não tocado por este redesenho, só reposicionado no modal");

  console.log("");
  console.log("==================================================");
  console.log("ITEM 2 — botao de limpar busca em toda barra de busca do app");
  console.log("==================================================");

  assert((appJs.match(/document\.createElement\("input"\)/g) || []).length === 3, "inventário confirmado: 3 <input> no app inteiro (home-search do hub, tagsearch-input da busca global, e o input numérico do timer — este último NÃO é busca, fora de escopo)");

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

  assert((appJs.match(/attachSearchClear\(/g) || []).length === 3, "attachSearchClear: 1 declaração + 2 chamadas (home-search + tagsearch-input), nenhuma duplicada");

  const grupoScope = sliceModuleFunction(appJs, "function renderGrupo(grupoId) {");
  assert(!!grupoScope && /attachSearchClear\(\s*search,/.test(grupoScope), "busca do hub (renderGrupo/.home-search) usa o helper compartilhado");

  const buscaScope = sliceModuleFunction(appJs, "function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery) {");
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
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
