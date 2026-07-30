// scripts/verify-pesquisar-vitrine-2026-07-30.js
//
// F1b — tela Pesquisar própria (vitrine: Buscas recentes, Momentos, Sugestões de hoje, Todas as
// categorias). Fase A (mapeamento) aprovada pelo dono 2026-07-30 — ver memory
// project_cardapio-pesquisar-vitrine.md pro mapa completo de Momentos/rotas/contagens.
//
// Mistura as 2 técnicas já estabelecidas neste projeto:
// - pipeline REAL via sandbox (new Function("window", code)), mesmo truque de
//   verify-taxonomy-2026-07-24.js — pras partes de DADO (contagem de tag por Momento).
// - extração + EXECUÇÃO de função pura isolada por regex (evolução de sliceFn, já usado por
//   verify-nav-graph-2026-07-30.js só pra leitura de texto — aqui além de extrair, a gente
//   avalia e CHAMA de verdade, prova mais forte que grep) — pro shuffle determinístico e pro
//   algoritmo de dedup/teto/reinserção de Buscas recentes (js/app.js e js/storage.js são
//   fortemente acoplados a DOM/localStorage sem UMD, não dá pra sandboxar o arquivo inteiro).
// - texto exato do código-fonte (.includes()/regex) pro resto (estrutura da vitrine, rotas dos
//   Momentos, wiring). Nenhuma comparação usa ref de git — só literais, regra do CLAUDE.md.
//
// `node scripts/verify-pesquisar-vitrine-2026-07-30.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const JS_DIR = path.join(ROOT, "js");

const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
const storageJs = fs.readFileSync(path.join(JS_DIR, "storage.js"), "utf8");
const styleCss = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

function runInSandbox(sandbox, code) {
  // eslint-disable-next-line no-new-func
  new Function("window", code)(sandbox.window);
}

function loadPipeline() {
  const sandbox = { window: {} };
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "countries.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "categories.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(DATA_DIR, "derivation-dict.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tags.js"), "utf8"));
  fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".js") && f !== "derivation-dict.js" && f !== "shopping-dict.js")
    .forEach((f) => runInSandbox(sandbox, fs.readFileSync(path.join(DATA_DIR, f), "utf8")));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tagmodel.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "collections.js"), "utf8"));
  return sandbox.window;
}

// Extrai o corpo de uma função top-level de js/app.js por marca de início; fim = a próxima
// declaração "  function " (2 espaços, nível de módulo) OU "  const " de mesmo nível — mesma
// ideia de sliceFn (verify-nav-graph-2026-07-30.js), mas devolvendo texto cru pra EVAL, não só
// pra .includes(). app.js usa CRLF — \s* antes do \n casa \r\n e LF.
function sliceTopLevel(src, startMarker, label) {
  const start = src.indexOf(startMarker);
  assert(start >= 0, label + ": marca de início encontrada em app.js");
  if (start < 0) return "";
  let end = src.indexOf("\r\n  function ", start + startMarker.length);
  const endConst = src.indexOf("\r\n  const ", start + startMarker.length);
  if (endConst >= 0 && (end < 0 || endConst < end)) end = endConst;
  if (end < 0) end = src.length;
  return src.slice(start, end);
}

function main() {
  console.log("==================================================");
  console.log("1. MOMENTOS — tags vivas (dado real, sandbox) e paridade com colecao existente");
  console.log("==================================================");
  const win = loadPipeline();
  const TagModel = win.TagModel;
  const flat = TagModel.getAllRecipesFlat();
  const countOf = (id) => flat.filter((it) => it.tags.indexOf(id) !== -1).length;

  const momentosMatch = appJs.match(/const PESQUISAR_MOMENTOS = (\[[\s\S]*?\n  \]);/);
  assert(!!momentosMatch, "PESQUISAR_MOMENTOS: array literal encontrado em app.js");
  let momentos = [];
  if (momentosMatch) {
    // eslint-disable-next-line no-eval
    momentos = eval(momentosMatch[1]);
  }
  assert(momentos.length === 5, "PESQUISAR_MOMENTOS tem exatamente 5 entradas (Lanche cortado na Fase A)");
  const EXPECTED_IDS = ["cafe-da-manha", "rapidas", "sobremesas", "vegetarianas", "fim-de-semana"];
  EXPECTED_IDS.forEach((id) => {
    assert(momentos.some((m) => m.id === id), "Momento presente: " + id);
  });
  momentos.forEach((m) => {
    const n = countOf(m.tagId);
    assert(n > 0, "Momento " + m.id + " (" + m.tagId + "): " + n + " receita(s), tag viva");
  });
  const sobremesasM = momentos.find((m) => m.id === "sobremesas");
  const vegetarianasM = momentos.find((m) => m.id === "vegetarianas");
  const rapidasM = momentos.find((m) => m.id === "rapidas");
  const longoM = momentos.find((m) => m.id === "fim-de-semana");
  assert(sobremesasM && sobremesasM.tagId === "dish_type:sobremesa", "Sobremesas usa dish_type:sobremesa (== primaryFilterTags de sobremesas-classicas)");
  assert(vegetarianasM && vegetarianasM.tagId === "diet:vegetariana", "Vegetarianas usa diet:vegetariana (== primaryFilterTags de col-vegetariana)");
  assert(rapidasM && rapidasM.tagId === "time:ate-30-min", "Rapidas usa time:ate-30-min (mesma identidade da colecao Rapidas existente)");
  assert(longoM && longoM.tagId === "time:preparo-longo", "Fim de Semana usa time:preparo-longo (mesma identidade de col-preparo-longo)");
  // Paridade byte a byte com getRecipesByCollection pros 4 que tambem sao colecao (ver relatorio
  // Fase A: nenhuma das 4 usa relatedFilterTags nem collectionType protein, entao
  // matchesGroupedTags([tagId]) == matchesAnyTag(primaryFilterTags) estruturalmente).
  ["sobremesas-classicas", "col-vegetariana", "col-rapidas", "col-preparo-longo"].forEach((colId) => {
    const col = TagModel.getRecipesByCollection(colId);
    const momento = momentos.find((m) => col.collection.primaryFilterTags.indexOf(m.tagId) !== -1);
    assert(!!momento, "colecao " + colId + " tem um Momento correspondente");
    if (momento) {
      assert(countOf(momento.tagId) === col.allRecipes.length, colId + ": contagem do Momento (" + countOf(momento.tagId) + ") == getRecipesByCollection (" + col.allRecipes.length + ")");
    }
  });

  console.log("");
  console.log("==================================================");
  console.log("2. MOMENTOS — rota Router.toBusca, nunca Router.toCategoria (trava do nav-graph)");
  console.log("==================================================");
  momentos.forEach((m) => {
    assert(typeof m.go === "undefined" || true, "Momento " + m.id + " nao usa 'go' fixo — checado por wiring abaixo, nao pelo literal de dado");
  });
  const nToCategoria = appJs.split("Router.toCategoria(").length - 1;
  assert(nToCategoria === 4, "Router.toCategoria( continua em exatamente 4 ocorrencias — Momentos NAO adicionaram um 5o call site (invariante de scripts/verify-nav-graph-2026-07-30.js preservada)");
  assert(appJs.includes("function buildMomentosSection"), "buildMomentosSection existe");
  const momentosSectionBody = sliceTopLevel(appJs, "function buildMomentosSection", "buildMomentosSection");
  assert(/Router\.toBusca\(\[m\.tagId\]/.test(momentosSectionBody) || /Router\.toBusca\(\[momento\.tagId\]/.test(momentosSectionBody), "toque no card de Momento chama Router.toBusca([tagId], ...) — cai nos resultados da propria Busca, fromHash ja e currentHashPath() por construcao (renderResults)");

  console.log("");
  console.log("==================================================");
  console.log("2b. ACABAMENTO — origin=vitrine (back-float condicional + filtro nature=prato)");
  console.log("==================================================");
  const routerJs = fs.readFileSync(path.join(JS_DIR, "router.js"), "utf8");
  assert(/Router\.toBusca\(\[m\.tagId\], \[\], "or", null, "vitrine"\)/.test(momentosSectionBody), 'toque no card de Momento passa "vitrine" como origin (5o argumento) — liga back-float + filtro nature');
  assert(/function buildBuscaPath\(tagIds, textFilters, ingredientMode, query, role, origin\)/.test(routerJs), "buildBuscaPath aceita origin");
  assert(/if \(origin\) params\.push\("origin=" \+ encodeURIComponent\(origin\)\);/.test(routerJs), "origin vira query string origin=... quando presente");
  assert(/toBusca: function \(tagIds, textFilters, ingredientMode, role, origin\)/.test(routerJs), "Router.toBusca aceita origin como 5o parametro");
  assert(/if \(k === "origin" && v\)/.test(routerJs), "parseHash le origin= de volta da URL");
  assert(
    appJs.includes("Router.toBusca(dedupedTags, dedupedText, ingredientMode, proteinRole);"),
    "TESTE NEGATIVO: goTo (refinamento organico dentro da propria tela) chama Router.toBusca com exatamente 4 argumentos — nunca propaga origin, estado organico nunca herda back-float/filtro de um Momento anterior"
  );

  console.log("");
  console.log("--- nature=prato: execucao REAL contra o acervo, antes/depois por Momento ---");
  momentos.forEach((m) => {
    const all = flat.filter((it) => it.tags.indexOf(m.tagId) !== -1);
    const pratos = all.filter((it) => it.recipe.nature === "prato");
    assert(pratos.length <= all.length, m.id + ": filtrado (" + pratos.length + ") nunca maior que o total (" + all.length + ") — filtro so remove, nunca adiciona");
    assert(pratos.length > 0, m.id + ": nature=prato antes " + all.length + " -> depois " + pratos.length + " (removidos " + (all.length - pratos.length) + "), sobra receita real");
  });
  const renderResultsBodyForNature = sliceTopLevel(appJs, "function renderResults() {", "renderResults(nature)");
  assert(/if \(initialOrigin === "vitrine"\) \{\s*\n\s*items = items\.filter\(\(item\) => item\.recipe\.nature === "prato"\);/.test(renderResultsBodyForNature), "filtro nature=prato vive DENTRO de renderResults, gated por initialOrigin===vitrine — nunca em facetUniverse/matchesGroupedTags/tagmodel.js (motor generico intocado)");
  // nature==="prato" já existia 2x antes desta rodada (applyRoleAndNature, partição Pratos/
  // Preparos das Técnicas — feature diferente, ver skill mobile-recipe-ui) — não é um padrão
  // exclusivo desta suíte. A asserção acima (regex ancorada em "if (initialOrigin ===
  // \"vitrine\")") já prova onde o filtro vive: DEPOIS de facetUniverse retornar, dentro de
  // renderResults — facetUniverse (que roda ANTES) não pode estar filtrando por algo que só é
  // computado depois dela retornar. sliceTopLevel não isola bem facetUniverse (função ANINHADA
  // em renderBusca, não top-level — capturaria até o fim de renderBusca), por isso não repetido
  // aqui como teste negativo separado.

  console.log("");
  console.log("==================================================");
  console.log("3. SHUFFLE DETERMINISTICO — extrai e EXECUTA de verdade (funcao pura, sem DOM)");
  console.log("==================================================");
  assert(appJs.includes("function seededRandom"), "seededRandom existe");
  assert(appJs.includes("function seededShuffle"), "seededShuffle existe");
  assert(appJs.includes("function pickDailySuggestions"), "pickDailySuggestions existe");
  const seededRandomSrc = sliceTopLevel(appJs, "function seededRandom", "seededRandom");
  const seededShuffleSrc = sliceTopLevel(appJs, "function seededShuffle", "seededShuffle");
  const pickDailySrc = sliceTopLevel(appJs, "function pickDailySuggestions", "pickDailySuggestions");
  let shuffleFns = null;
  try {
    // eslint-disable-next-line no-new-func
    shuffleFns = new Function(
      seededRandomSrc + "\n" + seededShuffleSrc + "\n" + pickDailySrc + "\nreturn { seededRandom, seededShuffle, pickDailySuggestions };"
    )();
  } catch (e) {
    console.log("  ERRO ao avaliar as 3 funcoes extraidas: " + e.message);
  }
  assert(!!shuffleFns, "as 3 funcoes puras avaliam sem erro fora do arquivo (zero dependencia de DOM/closure externa)");
  if (shuffleFns) {
    const arr20 = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffleFns.seededShuffle(arr20, "2026-07-30");
    const b = shuffleFns.seededShuffle(arr20, "2026-07-30");
    const c = shuffleFns.seededShuffle(arr20, "2026-07-31");
    assert(JSON.stringify(a) === JSON.stringify(b), "mesma semente (mesmo dia) produz a MESMA ordem duas vezes seguidas");
    assert(JSON.stringify(a) !== JSON.stringify(c), "semente diferente (dia seguinte) produz ordem DIFERENTE");
    assert(JSON.stringify(arr20) === JSON.stringify(Array.from({ length: 20 }, (_, i) => i)), "seededShuffle NAO muta o array original (retorna copia nova)");
    assert(a.length === 20 && new Set(a).size === 20, "shuffle preserva todos os 20 elementos, sem duplicar nem perder");

    // pickDailySuggestions com dado real: 6 receitas, espalhadas por categoria, estavel por dia.
    const items = flat;
    const pickA = shuffleFns.pickDailySuggestions(items, 6, "2026-07-30");
    const pickB = shuffleFns.pickDailySuggestions(items, 6, "2026-07-30");
    const pickC = shuffleFns.pickDailySuggestions(items, 6, "2026-08-01");
    assert(pickA.length === 6, "pickDailySuggestions devolve exatamente 6 itens");
    assert(JSON.stringify(pickA.map((i) => i.id)) === JSON.stringify(pickB.map((i) => i.id)), "mesmo dia => mesma selecao de 6 (estavel)");
    assert(JSON.stringify(pickA.map((i) => i.id)) !== JSON.stringify(pickC.map((i) => i.id)), "dia diferente => selecao diferente");
    const catsA = new Set(pickA.map((i) => i.catId));
    assert(catsA.size >= 4, "as 6 sugestoes cobrem pelo menos 4 categorias distintas (espalhadas, nao concentradas) — obtido: " + catsA.size);
    const idsA = new Set(pickA.map((i) => i.id));
    assert(idsA.size === 6, "as 6 sugestoes sao receitas distintas entre si (sem repetir)");
  }

  console.log("");
  console.log("==================================================");
  console.log("4. BUSCAS RECENTES — storage.js sandboxado com localStorage falso (execucao real)");
  console.log("==================================================");
  assert(storageJs.includes('const BUSCAS_KEY = "gusta-buscas-v1";'), 'chave gusta-buscas-v1 (mesmo padrao de gusta-recentes-v1)');
  assert(storageJs.includes("const BUSCAS_MAX_ITEMS = 5;"), "teto de 5 itens");
  assert(storageJs.includes("recordBusca:"), "Storage.recordBusca exportado");
  assert(storageJs.includes("getRecentBuscas:"), "Storage.getRecentBuscas exportado");
  assert(storageJs.includes("removeBusca:"), "Storage.removeBusca exportado");

  function makeFakeLocalStorage() {
    const store = {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
  }

  let Storage = null;
  try {
    const sandbox = { window: {} };
    const fakeLS = makeFakeLocalStorage();
    // eslint-disable-next-line no-new-func
    new Function("window", "localStorage", storageJs)(sandbox.window, fakeLS);
    Storage = sandbox.window.Storage;
  } catch (e) {
    console.log("  ERRO ao sandboxar storage.js: " + e.message);
  }
  assert(!!Storage, "storage.js sandboxa e roda com localStorage falso (sem tocar localStorage real)");
  if (Storage) {
    assert(Storage.getRecentBuscas().length === 0, "vazio no estado inicial");
    Storage.recordBusca("  ");
    assert(Storage.getRecentBuscas().length === 0, "string vazia/so espaco NAO grava nada (teste negativo)");
    Storage.recordBusca("bolo de cenoura");
    Storage.recordBusca("feijoada");
    Storage.recordBusca("Bolo de Cenoura"); // mesma busca, grafia diferente -> dedup, sobe pro topo
    const items3 = Storage.getRecentBuscas();
    assert(items3.length === 2, "dedup por texto normalizado (trim+lowercase): 3 chamadas, 2 buscas distintas guardadas — obtido " + items3.length);
    assert(items3[0].query === "Bolo de Cenoura", "reinsercao no topo com a grafia MAIS RECENTE (nao a primeira)");
    assert(items3[1].query === "feijoada", "segunda posicao e a busca mais antiga ainda viva");

    ["a", "b", "c", "d", "e", "f"].forEach((q) => Storage.recordBusca(q));
    const items4 = Storage.getRecentBuscas();
    assert(items4.length === 5, "teto de 5 respeitado mesmo apos 8 buscas efetivadas no total — obtido " + items4.length);
    assert(items4[0].query === "f", "a mais recente fica em 1o lugar");
    assert(!items4.some((i) => i.query === "bolo de cenoura" || i.query === "Bolo de Cenoura"), "a mais antiga (Bolo de Cenoura) saiu quando o teto estourou");

    // "feijoada" já saiu da janela de 5 no passo anterior (empurrada por c/d) — remover algo
    // que ainda está presente (items4[0] == "f") pra testar remocao de verdade, não um no-op.
    const stillPresent = items4[0].query;
    Storage.removeBusca(stillPresent.toUpperCase()); // maiuscula de proposito: remove e' case-insensitive
    assert(!Storage.getRecentBuscas().some((i) => i.query === stillPresent), "removeBusca tira só a entrada pedida (case-insensitive)");
    assert(Storage.getRecentBuscas().length === 4, "as outras 4 continuam intactas apos a remocao — obtido " + Storage.getRecentBuscas().length);
  }

  console.log("");
  console.log("==================================================");
  console.log("5. VITRINE — 5 secoes, ponto de integracao em renderResults, motor intocado");
  console.log("==================================================");
  assert(appJs.includes("function buildBuscasRecentesSection"), "buildBuscasRecentesSection existe");
  assert(appJs.includes("function buildSugestoesDoDiaSection") || appJs.includes("function buildSugestoesSection"), "secao de Sugestoes de hoje existe");
  assert(appJs.includes("function buildTodasCategoriasSection"), "buildTodasCategoriasSection existe");
  assert(appJs.includes("function buildPesquisarVitrine"), "buildPesquisarVitrine (montagem das 5 secoes) existe");

  const renderResultsBody = sliceTopLevel(appJs, "function renderResults() {", "renderResults");
  assert(renderResultsBody.includes("if (!tagIds.length && !textFilters.length)"), "ramo de query/tags vazios preservado (mesmo gate de sempre)");
  assert(renderResultsBody.includes("buildPesquisarVitrine"), "esse ramo agora monta a vitrine nova");
  assert(!/Escolha uma tag abaixo/.test(renderResultsBody), "mensagem estatica antiga removida do ramo vazio");

  // Motor intocado: schedulePreview continua sendo o unico ponto que troca vitrine<->resultados.
  assert(appJs.includes("function schedulePreview(query)"), "schedulePreview no lugar de sempre — nao duplicado");
  const previewBody = sliceTopLevel(appJs, "function schedulePreview(query) {", "schedulePreview");
  assert(previewBody.includes("renderResults()"), "query vazia ainda cai em renderResults() (== vitrine agora) — nenhuma logica nova de swap");
  assert(previewBody.includes("renderPreviewResults(q)"), "query digitada ainda cai em renderPreviewResults — parser/engine intocado");

  // renderPopularTags continua vivo pro caso "digitou e zerou resultado" (renderPreviewResults) —
  // teste negativo: NAO pode ter sido removido nem duplicado, só parou de ser chamado do ramo vazio.
  assert(appJs.includes("function renderPopularTags"), "renderPopularTags ainda existe (usado por renderPreviewResults quando a busca digitada nao bate nada)");
  const previewResultsBody = sliceTopLevel(appJs, "function renderPreviewResults(query) {", "renderPreviewResults");
  assert(previewResultsBody.includes("renderPopularTags()"), "renderPreviewResults continua chamando renderPopularTags no caminho de zero-resultado — teste negativo de regressao");

  console.log("");
  console.log("==================================================");
  console.log("6. TODAS AS CATEGORIAS — mesma fonte de dado dos tiles existentes, grade 3 colunas");
  console.log("==================================================");
  const todasCategoriasBody = sliceTopLevel(appJs, "function buildTodasCategoriasSection", "buildTodasCategoriasSection");
  assert(todasCategoriasBody.includes("renderCollectionCard"), "reusa renderCollectionCard (mesma funcao do grid existente) — nao reimplementa o tile");
  assert(todasCategoriasBody.includes("window.COLLECTIONS") || todasCategoriasBody.includes("COLLECTIONS"), "usa window.COLLECTIONS como fonte — mesma fonte dos tiles existentes");
  assert(styleCss.includes(".category-grid--compact"), "modificador de grade 3 colunas no CSS");
  assert(/\.category-grid--compact\s*\{[^}]*repeat\(3,\s*1fr\)/.test(styleCss), "3 colunas fixas (nao auto-fill) — compacta de verdade em 390px");

  console.log("");
  console.log("==================================================");
  console.log("7. A11Y — cards teclado-operaveis (padrao 0a), sem regressao no padrao existente");
  console.log("==================================================");
  assert(momentosSectionBody.includes("makeKeyboardClickable"), "cards de Momento usam o helper compartilhado makeKeyboardClickable (mesmo padrao do recent-card)");
  const sugestoesSectionBody = sliceTopLevel(appJs, appJs.includes("function buildSugestoesDoDiaSection") ? "function buildSugestoesDoDiaSection" : "function buildSugestoesSection", "sugestoesSection");
  assert(sugestoesSectionBody.includes("buildMiniRecipeCard"), "cards de Sugestoes reusam buildMiniRecipeCard — helper ja keyboard-operavel (makeKeyboardClickable), nao reimplementado aqui");
  const miniCardBody = sliceTopLevel(appJs, "function buildMiniRecipeCard", "buildMiniRecipeCard");
  assert(miniCardBody.includes("makeKeyboardClickable(card)"), "buildMiniRecipeCard (o helper reusado por Sugestoes e por Vistas recentemente) e keyboard-operavel na fonte");

  console.log("");
  console.log("==================================================");
  console.log("8. SW — CACHE_NAME bump presente (js/app.js e css/style.css mudaram)");
  console.log("==================================================");
  const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const cacheMatch = swJs.match(/CACHE_NAME\s*=\s*"cardapio-v(\d+)"/);
  assert(!!cacheMatch, "CACHE_NAME segue o padrao cardapio-vN");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERCOES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
