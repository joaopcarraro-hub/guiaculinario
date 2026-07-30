// scripts/verify-nav-graph-2026-07-30.js
//
// Dívida #3 (2026-07-30): trava o grafo de navegação por suíte. A premissa "cada coleção tem
// UM caminho de entrada" (que justifica o back-float com destino calculado, ver
// scripts/verify-back-float-2026-07-25.js) estava documentada só em prosa (skill
// product-navigation-ux + comentário app.js ~1914) e nunca travada em código — nenhuma suíte
// gritava quando nascia um call site novo de navegação. Esta suíte é o alarme desse gatilho:
// censa o grafo inteiro (toHome/toGrupo/toCategoria/toReceita/toCozinhar/createBackFloat) e
// exige que toda navegação de receita/cozinhar leve fromHash (2º argumento) — sem exceção.
//
// Fecha também os 2 furos do contrato de Voltar (skill product-navigation-ux: Voltar SEMPRE
// leva à última tela realmente visitada, via fromHash): Lista de Compras (nome da receita) e
// Preparos (retomar sessão) navegavam SEM fromHash, caindo na categoria da receita em vez de
// voltar pra origem real.
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte
// (`.includes()`/regex/slice de função), nunca por ref de git (regra do CLAUDE.md: só
// literais). js/app.js usa CRLF (\r\n) — ver nota em sliceFn abaixo. js/router.js usa LF.
//
// `node scripts/verify-nav-graph-2026-07-30.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const routerJs = fs.readFileSync(path.join(ROOT, "js", "router.js"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

function countLiteral(src, literal) {
  return src.split(literal).length - 1;
}

// \s* antes de um \n literal casa \n E \r\n (backtracking) — string literal com \n cru só casa
// LF puro. Fim de função = próxima declaração "  function " no nível de módulo (2 espaços).
function sliceFn(src, startMarker, label) {
  const start = src.indexOf(startMarker);
  assert(start > 0, label + ": marca de início encontrada");
  let end = src.indexOf("\r\n  function ", start + startMarker.length);
  if (end < 0) end = src.length;
  assert(end > start, label + ": marca de fim encontrada (depois do início)");
  return src.slice(start, end);
}

function main() {
  console.log("==================================================");
  console.log("1. CENSO DO GRAFO — contagens exatas em js/app.js (já verdes hoje)");
  console.log("==================================================");
  const nToHome = countLiteral(appJs, "Router.toHome(");
  const nToGrupo = countLiteral(appJs, "Router.toGrupo(");
  const nToCategoria = countLiteral(appJs, "Router.toCategoria(");
  const nToReceita = countLiteral(appJs, "Router.toReceita(");
  const nToCozinhar = countLiteral(appJs, "Router.toCozinhar(");
  const nCreateBackFloat = countLiteral(appJs, "createBackFloat(");
  console.log("  Router.toHome( = " + nToHome);
  console.log("  Router.toGrupo( = " + nToGrupo);
  console.log("  Router.toCategoria( = " + nToCategoria);
  console.log("  Router.toReceita( = " + nToReceita);
  console.log("  Router.toCozinhar( = " + nToCozinhar);
  console.log("  createBackFloat( = " + nCreateBackFloat);
  assert(nToHome === 4, "Router.toHome( aparece exatamente 4x");
  assert(nToGrupo === 4, "Router.toGrupo( aparece exatamente 4x");
  assert(nToCategoria === 4, "Router.toCategoria( aparece exatamente 4x — premissa de caminho único por coleção");
  assert(nToReceita === 7, "Router.toReceita( aparece exatamente 7x");
  assert(
    nToCozinhar === 3,
    "Router.toCozinhar( aparece exatamente 3x (Fase multi-timer, 2026-07-30: 3º call site = tocar o CORPO de um chip de timer no card de Preparos — grava Storage.savePreparoStep(recipeId, stepIndex) pro passo DAQUELE chip antes de navegar, mas usa o MESMO fromHash \"preparos\" do 2º call site já existente [tocar o card]; não é um mecanismo de volta novo, é uma 2ª porta de entrada pro mesmo destino-e-origem já coberto pelas regras abaixo — decisão consciente, não só o número ajustado pra passar)"
  );
  assert(
    nCreateBackFloat === 5,
    "createBackFloat( aparece exatamente 5x (1 declaração + hub/categoria/receita/busca-condicional — F1b acabamento, 2026-07-30, ver seção 8 abaixo pro mecanismo de volta decidido conscientemente, não só o número atualizado)"
  );

  console.log("");
  console.log("==================================================");
  console.log("2. ORIGEM OBRIGATÓRIA — coração da trava: toda navegação de receita/cozinhar leva fromHash");
  console.log("==================================================");
  const semOrigemReceita = appJs.match(/Router\.toReceita\([^,)]*\)/g) || [];
  const semOrigemCozinhar = appJs.match(/Router\.toCozinhar\([^,)]*\)/g) || [];
  console.log("  Router.toReceita(...) SEM 2º argumento = " + semOrigemReceita.length + (semOrigemReceita.length ? " -> " + semOrigemReceita.join(", ") : ""));
  console.log("  Router.toCozinhar(...) SEM 2º argumento = " + semOrigemCozinhar.length + (semOrigemCozinhar.length ? " -> " + semOrigemCozinhar.join(", ") : ""));
  assert(semOrigemReceita.length === 0, "nenhum Router.toReceita( sem fromHash — 2º argumento obrigatório em TODA chamada");
  assert(semOrigemCozinhar.length === 0, "nenhum Router.toCozinhar( sem fromHash — 2º argumento obrigatório em TODA chamada");

  console.log("");
  console.log("==================================================");
  console.log("3. ÂNCORAS — premissa de caminho único dos 4 toCategoria (já verdes hoje)");
  console.log("==================================================");
  assert(appJs.includes("Router.toCategoria(collection.id)"), "renderCollectionCard usa Router.toCategoria(collection.id)");
  assert(appJs.includes('Router.toCategoria("massas")'), "tile Home 'Massas' usa Router.toCategoria(\"massas\")");
  assert(appJs.includes('Router.toCategoria("sobremesas-classicas")'), "tile Home 'Sobremesas' usa Router.toCategoria(\"sobremesas-classicas\")");
  assert(appJs.includes("else Router.toCategoria(backCollection ? backCollection.id : catId);"), "renderReceita preserva o fallback exato pra categoria quando não há fromHash (deep link sem origem — comportamento desejado, não é furo)");

  console.log("");
  console.log("==================================================");
  console.log("4. CALL SITES NOVOS — Lista de Compras e Preparos passam a levar fromHash (RED até o Passo 2)");
  console.log("==================================================");
  assert(appJs.includes('Router.toReceita(entry.recipeId, "lista-compras")'), "Lista de Compras chama Router.toReceita(entry.recipeId, \"lista-compras\")");
  assert(appJs.includes('Router.toCozinhar(session.recipeId, "preparos")'), "Preparos chama Router.toCozinhar(session.recipeId, \"preparos\")");

  console.log("");
  console.log("==================================================");
  console.log("5. RÓTULOS — 2 elos novos no ternário de backDestLabel em renderReceita (RED até o Passo 2)");
  console.log("==================================================");
  const receitaFnBody = sliceFn(appJs, "function renderReceita(id, fromHash) {", "renderReceita");
  assert(receitaFnBody.includes('fromListaCompras ? "Lista de Compras"'), "elo 'Lista de Compras' presente no ternário (após fromHome, antes de fromPreparos)");
  assert(receitaFnBody.includes('fromPreparos ? "Preparos"'), "elo 'Preparos' presente no ternário (após lista de compras, antes do fallback categoria)");

  console.log("");
  console.log("==================================================");
  console.log("6. CONTRATO DO ROUTER — rotas de volta existem no parseHash (leitura, router.js não é editado)");
  console.log("==================================================");
  assert(routerJs.includes('parts[0] === "preparos"'), "router.js reconhece a rota preparos no parseHash");
  assert(routerJs.includes('parts[0] === "lista-compras"'), "router.js reconhece a rota lista-compras no parseHash");

  console.log("");
  console.log("==================================================");
  console.log("7. TESTE NEGATIVO — modo cozinhar continua sem botão de voltar (já verde hoje)");
  console.log("==================================================");
  const cookModeFnBody = sliceFn(appJs, "function renderCookMode(id, fromHash, portionMultiplier) {", "renderCookMode");
  assert(!cookModeFnBody.includes("createBackFloat("), "renderCookMode não chama createBackFloat( — modo cozinhar nunca tem voltar");

  console.log("");
  console.log("==================================================");
  console.log("8. 5º createBackFloat — busca CONDICIONAL (F1b acabamento, 2026-07-30, decisão consciente)");
  console.log("==================================================");
  // Diferente dos outros 4 (sempre presentes na tela): este só aparece quando a busca foi
  // alcançada por um Momento da vitrine (initialOrigin === "vitrine", nunca setado por
  // refinamento orgânico — ver Router.toBusca em router.js e goTo/goToTags abaixo). Destino
  // SEMPRE Router.toBusca([], []) — determinístico, nunca history.back() (mesma regra dos
  // outros 4: "Voltar" nunca é um history.back() cru, sempre um destino calculado).
  const renderBuscaBody = sliceFn(appJs, "function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery, initialRole, initialOrigin) {", "renderBusca");
  assert(renderBuscaBody.includes('createBackFloat("Pesquisar"'), "5º call site: createBackFloat(\"Pesquisar\", ...) dentro de renderBusca");
  assert(/initialOrigin === "vitrine" && !!\(tagIds\.length \|\| textFilters\.length\)/.test(renderBuscaBody), "condição exata: só com origin=vitrine E resultado não vazio (nunca na própria vitrine)");
  assert(renderBuscaBody.includes("() => Router.toBusca([], [])"), "destino determinístico: Router.toBusca([], []) — nunca history.back() cru");
  assert(
    appJs.includes("Router.toBusca(dedupedTags, dedupedText, ingredientMode, proteinRole);"),
    "TESTE NEGATIVO: goTo (refinamento orgânico — digitar, tocar chip/facet) chama Router.toBusca com exatamente 4 argumentos, NUNCA um 5º (origin) — organicamente construído nunca herda o back-float"
  );

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
