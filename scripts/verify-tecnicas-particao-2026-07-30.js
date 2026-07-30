// scripts/verify-tecnicas-particao-2026-07-30.js
//
// Suíte da tarefa "Técnicas — pratos separados da lista (partição de exibição)", 2026-07-30.
// Decisão do dono: a coleção "tecnicas" (collectionType "technique", Fundamentos) alcança 46
// receitas — 43 com nature preparo/tecnica + 3 PRATOS (nature:prato: "Legumes Glaceados",
// "Vegetais Assados em Diferentes Texturas", "Legumes Fermentados"). Antes desta tarefa a tela
// lista os 46 misturados; alvo: lista principal = 43 preparos/técnicas, seção fixa no FIM da
// tela ("Pratos com estas técnicas") com os 3 pratos — espelho exato da seção "Preparos e
// técnicas" que proteína/país já têm. A partição canônica (TagModel.getRecipesByCollection,
// campo `padrao`) já separa isso — esta suíte só prova que renderCategory passa a CONSUMIR essa
// partição, nunca reimplementá-la.
//
// Mesmo padrão fs+vm de scripts/verify-protein-role-unify-2026-07-30.js: TagModel roda de
// verdade num sandbox `window` (seção 1 — gabarito); js/app.js fica fora do harness principal
// (depende de document/location/history no escopo de módulo) — inspecionado como TEXTO via
// extractFunctionBody (mesmo mecanismo da suíte irmã), nunca reimplementando a regra numa 3ª
// forma. Literais, sem ref de git — a checagem "tagmodel.js intocado" usa um snapshot literal do
// corpo de getRecipesByCollection capturado nesta própria suíte, não um diff contra HEAD (regra
// do projeto: nunca pinar comparação em ref mutável).
//
// `node scripts/verify-tecnicas-particao-2026-07-30.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const JS_DIR = path.join(ROOT, "js");

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
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "collections.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tagmodel.js"), "utf8"));
  return sandbox.window;
}

let failures = 0;
let currentSection = null;
const sectionCounts = {};
const sectionOrder = [];
function section(key, title) {
  currentSection = key;
  if (!sectionCounts[key]) {
    sectionCounts[key] = { ok: 0, fail: 0 };
    sectionOrder.push(key);
  }
  console.log("==================================================");
  console.log(key + ". " + title);
  console.log("==================================================");
}
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
    if (currentSection) sectionCounts[currentSection].ok++;
  } else {
    console.log("  FAIL " + label);
    failures++;
    if (currentSection) sectionCounts[currentSection].fail++;
  }
}

// ---------- extrai o corpo de uma função nomeada por casamento de chaves (mesmo mecanismo de
// verify-busca-unificada-2026-07-29.js / verify-protein-role-unify-2026-07-30.js) ----------
function extractFunctionBody(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start < 0) return null;
  const braceStart = src.indexOf("{", start);
  if (braceStart < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return end < 0 ? null : src.slice(start, end);
}

// snapshot literal do corpo de getRecipesByCollection HOJE (2026-07-30, antes desta tarefa) —
// regra do projeto (memória) proíbe comparar contra ref de git mutável; comparação é sempre
// contra este literal fixo, capturado na própria suíte.
const GETRECIPESBYCOLLECTION_SNAPSHOT =
  'function getRecipesByCollection(collectionId) {\r\n' +
  '    const collection = (window.COLLECTIONS || []).find((c) => c.id === collectionId);\r\n' +
  '    if (!collection) {\r\n' +
  '      return { collection: null, primaryRecipes: [], relatedRecipes: [], allRecipes: [], padrao: [], secundariosPrato: [], preparos: [] };\r\n' +
  '    }\r\n' +
  '    const all = getAllRecipesFlat();\r\n' +
  '    const primaryRecipes = all.filter((item) => matchesAnyTag(item.tags, collection.primaryFilterTags));\r\n' +
  '    const primaryIds = new Set(primaryRecipes.map((item) => item.id));\r\n' +
  '    const relatedRecipes = collection.relatedFilterTags\r\n' +
  '      ? all.filter((item) => !primaryIds.has(item.id) && matchesAnyTag(item.tags, collection.relatedFilterTags))\r\n' +
  '      : [];\r\n' +
  '    const allRecipes = primaryRecipes.concat(relatedRecipes);\r\n' +
  '    const padrao = primaryRecipes.filter((item) => item.recipe.nature === "prato");\r\n' +
  '    const secundariosPrato =\r\n' +
  '      collection.collectionType === "protein"\r\n' +
  '        ? splitByProteinRole(allRecipes, collection.primaryFilterTags).secondary.filter((item) => item.recipe.nature === "prato")\r\n' +
  '        : [];\r\n' +
  '    const preparos = allRecipes.filter((item) => item.recipe.nature !== "prato");\r\n' +
  '    return { collection, primaryRecipes, relatedRecipes, allRecipes, padrao, secundariosPrato, preparos };\r\n' +
  '  }';

function main() {
  const win = loadPipeline();
  const TagModel = win.TagModel;
  const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
  const tagModelJs = fs.readFileSync(path.join(JS_DIR, "tagmodel.js"), "utf8");

  section("1", "GABARITO — TagModel.getRecipesByCollection('tecnicas') (dados reais, verde hoje)");
  const r = TagModel.getRecipesByCollection("tecnicas");
  console.log("  literal: allRecipes=" + r.allRecipes.length + " padrao=" + r.padrao.length + " secundariosPrato=" + r.secundariosPrato.length + " preparos=" + r.preparos.length);
  assert(r.allRecipes.length === 46, "getRecipesByCollection('tecnicas').allRecipes = 46 (obtido " + r.allRecipes.length + ")");
  assert(r.padrao.length === 3, "getRecipesByCollection('tecnicas').padrao = 3 (obtido " + r.padrao.length + ")");
  assert(r.secundariosPrato.length === 0, "getRecipesByCollection('tecnicas').secundariosPrato = 0 (obtido " + r.secundariosPrato.length + ")");
  assert(r.preparos.length === 43, "getRecipesByCollection('tecnicas').preparos = 43 (obtido " + r.preparos.length + ")");
  const padraoNames = r.padrao.map((item) => item.recipe.name).sort();
  const expectedNames = ["Legumes Fermentados", "Legumes Glaceados", "Vegetais Assados em Diferentes Texturas"].sort();
  console.log("  literal: padrao names = " + JSON.stringify(padraoNames));
  assert(JSON.stringify(padraoNames) === JSON.stringify(expectedNames), "os 3 nomes de padrao são exatamente Legumes Glaceados / Vegetais Assados em Diferentes Texturas / Legumes Fermentados");
  assert(r.preparos.length + r.padrao.length === 46, "43 + 3 = 46 — partição não perde nem duplica receita (obtido " + (r.preparos.length + r.padrao.length) + ")");
  assert(r.collection.collectionType === "technique", "collectionType da coleção 'tecnicas' é 'technique' (pré-condição)");

  console.log("");
  section("2", "FONTE — lista principal exclui pratos em technique (ramo ADITIVO de applyRoleAndNature)");
  const categoryStart = appJs.indexOf("function renderCategory(collection, initialFacetTags, initialRole, initialIngredientMode) {");
  const categoryEnd = appJs.indexOf("\n  // ---------- Busca facetada por tags ----------", categoryStart);
  assert(categoryStart !== -1 && categoryEnd !== -1, "renderCategory isolada por marcador de início/fim (mesmo mecanismo de verify-protein-role-unify)");
  const categoryBody = categoryStart !== -1 && categoryEnd !== -1 ? appJs.slice(categoryStart, categoryEnd) : "";
  const applyRoleAndNatureBody = extractFunctionBody(categoryBody, "function applyRoleAndNature(items, role, S, identityCollection) {") || "";
  assert(applyRoleAndNatureBody.length > 0, "applyRoleAndNature encontrada e isolada por casamento de chaves");
  const idxTechniqueBranch = applyRoleAndNatureBody.indexOf('identityCollection.collectionType === "technique"');
  assert(idxTechniqueBranch !== -1, "ramo aditivo: applyRoleAndNature reconhece identityCollection.collectionType === \"technique\" (RED esperado antes da implementação)");
  const idxNatureFilterTechnique = applyRoleAndNatureBody.indexOf('item.recipe.nature !== "prato"');
  assert(idxNatureFilterTechnique !== -1, "ramo aditivo filtra por item.recipe.nature !== \"prato\" (exclui os pratos da lista principal)");
  // guarda: o ramo identity (proteína/país) NÃO pode ser alterado por esta tarefa.
  const idxIdentityFilter = applyRoleAndNatureBody.indexOf('identityItems.filter((item) => item.recipe.nature === "prato")');
  assert(idxIdentityFilter !== -1, "GUARDA: ramo identity (identityItems.filter(nature === 'prato')) segue presente e inalterado");
  const idxRoleBranchIdentityFilter = applyRoleAndNatureBody.indexOf('roleItems.filter((item) => item.recipe.nature === "prato")');
  assert(idxRoleBranchIdentityFilter !== -1, "GUARDA: ramo de papel explícito (roleItems.filter(nature === 'prato') via isIdentityCollection) segue presente e inalterado");
  assert(
    applyRoleAndNatureBody.indexOf("isIdentityCollection(identityCollection)") !== -1,
    "GUARDA: isIdentityCollection(identityCollection) continua sendo a checagem usada pelo ramo de identidade (não duplicada/renomeada)"
  );
  // ordem: o ramo técnica roda ANTES do "if (!isIdentityCollection...) return items;" genérico —
  // senão coleção technique (que nunca é identity) nunca chegaria a filtrar nature.
  const idxGenericEarlyReturn = applyRoleAndNatureBody.indexOf("if (!isIdentityCollection(identityCollection)) return items;");
  assert(idxGenericEarlyReturn !== -1, "early-return genérico (não-identity) ainda presente");
  assert(
    idxTechniqueBranch !== -1 && idxGenericEarlyReturn !== -1 && idxTechniqueBranch < idxGenericEarlyReturn,
    "ramo technique vem ANTES do early-return genérico (senão nunca seria alcançado pra collectionType technique)"
  );

  console.log("");
  section("3", "FONTE — seção fixa 'Pratos com estas técnicas' (espelho de 'Preparos e técnicas')");
  const idxLabelPratos = categoryBody.indexOf('textContent = "Pratos com estas técnicas"');
  assert(idxLabelPratos !== -1, "rótulo literal 'Pratos com estas técnicas' atribuído a um elemento (textContent) em renderCategory (RED esperado antes da implementação)");
  // isola o bloco pelo GATE real (brace matching, mesmo mecanismo de extractFunctionBody — nunca
  // por posição relativa a comentário, que é frágil quando o comentário CITA o mesmo rótulo).
  const pratosBlock = extractFunctionBody(categoryBody, 'if (collection.collectionType === "technique" && basePadrao.length) {') || "";
  assert(pratosBlock.length > 0, 'bloco da seção fixa tem gate por if (collection.collectionType === "technique" && basePadrao.length)');
  assert(pratosBlock.indexOf("subgroup-title") !== -1, "seção fixa reusa a classe subgroup-title (mesma da seção 'Preparos e técnicas', sem CSS novo)");
  assert(pratosBlock.indexOf("renderRecipeCard(") !== -1, "seção fixa reusa renderRecipeCard (mesma função, sem card novo)");
  assert(pratosBlock.indexOf("fromHash") !== -1, "seção fixa passa fromHash pro card (mesmo padrão da irmã, nunca fromHash ausente)");
  assert(pratosBlock.indexOf("basePadrao") !== -1, "seção fixa consome basePadrao (partição canônica de TagModel.getRecipesByCollection), não uma cópia própria");
  assert(
    pratosBlock.indexOf('textContent = "Pratos com estas técnicas"') !== -1,
    "o rótulo atribuído está DENTRO do próprio bloco do gate (não solto em outro lugar)"
  );
  // GUARDA: a seção irmã "Preparos e técnicas" (identity) segue presente e inalterada.
  const idxLabelPreparos = categoryBody.indexOf("Preparos e técnicas");
  assert(idxLabelPreparos !== -1, "GUARDA: rótulo 'Preparos e técnicas' (seção das coleções de identidade) segue presente");
  assert(
    categoryBody.indexOf('if (isIdentityCollection(collection) && basePreparos.length) {') !== -1,
    "GUARDA: gate da seção 'Preparos e técnicas' (isIdentityCollection(collection) && basePreparos.length) inalterado"
  );

  console.log("");
  section("4", "PARIDADE — 1 predicado, N consumidores (currentItems/getUniverse/computeCounts/countForDraft), nunca cópia divergente");
  const natureFilterOccurrences = (applyRoleAndNatureBody.match(/item\.recipe\.nature !== "prato"/g) || []).length;
  console.log("  literal: 'item.recipe.nature !== \"prato\"' aparece " + natureFilterOccurrences + "x dentro de applyRoleAndNature");
  assert(natureFilterOccurrences === 1, "o predicado de exclusão de pratos aparece EXATAMENTE 1x (dentro de applyRoleAndNature, nunca duplicado) (obtido " + natureFilterOccurrences + ")");
  const natureFilterWholeFile = (categoryBody.match(/item\.recipe\.nature !== "prato"/g) || []).length;
  assert(
    natureFilterWholeFile === natureFilterOccurrences,
    "o predicado não aparece EM MAIS NENHUM LUGAR de renderCategory além de applyRoleAndNature (obtido " + natureFilterWholeFile + " no escopo inteiro vs " + natureFilterOccurrences + " no helper)"
  );
  const applyCallSites = (categoryBody.match(/applyRoleAndNature\(/g) || []).length - 1; // -1 = a própria declaração
  console.log("  literal: applyRoleAndNature( chamada em " + applyCallSites + " pontos (fora a declaração)");
  assert(
    applyCallSites === 6,
    "applyRoleAndNature continua consumida por exatamente 6 call sites (currentItems x2, getUniverse x1, computeCounts x2, countForDraft x1) — nenhum novo nem removido (obtido " + applyCallSites + ")"
  );
  assert(categoryBody.indexOf("getUniverse: (role, draftFacetState) => {") !== -1, "getUniverse (modal de facetas) presente e é 1 dos consumidores");
  assert(categoryBody.indexOf("computeCounts: (draftFacetState, draftIngredientMode) => {") !== -1, "computeCounts (pílulas Principal/Secundário) presente e é 1 dos consumidores");
  assert(categoryBody.indexOf("countForDraft: (draftFacetState, draftRole, draftIngredientMode) => {") !== -1, "countForDraft (Ver resultados (N)) presente e é 1 dos consumidores");
  assert(categoryBody.indexOf("function currentItems() {") !== -1, "currentItems (lista principal + toolbar) presente e é 1 dos consumidores");

  // prova numérica: aplicar o MESMO predicado sobre o MESMO universo (baseAll da coleção real)
  // reproduz exatamente TagModel.preparos (43) — currentItems()/getUniverse()/countForDraft(),
  // sem papel ativo e sem busca, devem todos convergir pra este número, nunca pra 46.
  const baseAllIds = r.allRecipes.map((item) => item.id).sort();
  const predicateResultIds = r.allRecipes.filter((item) => item.recipe.nature !== "prato").map((item) => item.id).sort();
  const preparosIds = r.preparos.map((item) => item.id).sort();
  console.log("  literal: aplicar item.recipe.nature !== 'prato' sobre baseAll(46) = " + predicateResultIds.length + " (TagModel.preparos = " + preparosIds.length + ")");
  assert(predicateResultIds.length === 43, "predicado sobre baseAll(46) resulta em 43 (obtido " + predicateResultIds.length + ")");
  assert(JSON.stringify(predicateResultIds) === JSON.stringify(preparosIds), "o CONJUNTO de ids bate exatamente com TagModel.getRecipesByCollection('tecnicas').preparos — nenhuma receita trocada, só recortada");
  assert(baseAllIds.length === 46, "baseAll (universo antes do corte) continua 46 (nunca é a lista principal quem perde receita, só a exibição)");

  console.log("");
  section("5", "NEGATIVOS — busca de texto continua alcançando os 46 (S5); sem edição em tagmodel.js");
  const currentItemsBody = extractFunctionBody(categoryBody, "function currentItems() {") || "";
  assert(currentItemsBody.length > 0, "currentItems isolada por casamento de chaves");
  assert(
    currentItemsBody.indexOf("if (searchResultIds) return allRecipes;") !== -1,
    "TESTE NEGATIVO: 'if (searchResultIds) return allRecipes;' segue presente e inalterado — busca de texto NUNCA ganhou filtro de nature (S5: busca alcança tudo, incluindo os 3 pratos)"
  );
  const idxSearchReturn = currentItemsBody.indexOf("if (searchResultIds) return allRecipes;");
  const searchLine = idxSearchReturn === -1 ? "" : currentItemsBody.slice(idxSearchReturn, idxSearchReturn + 80);
  assert(
    searchLine.indexOf("nature") === -1,
    "TESTE NEGATIVO: a linha do bypass de busca não ganhou nenhum '.filter(...nature...)' colado (obtido: " + JSON.stringify(searchLine) + ")"
  );
  const getRecipesByCollectionBody = extractFunctionBody(tagModelJs, "function getRecipesByCollection(collectionId) {");
  assert(!!getRecipesByCollectionBody, "getRecipesByCollection encontrada em js/tagmodel.js");
  assert(
    getRecipesByCollectionBody === GETRECIPESBYCOLLECTION_SNAPSHOT,
    "TESTE NEGATIVO: getRecipesByCollection em js/tagmodel.js é BYTE A BYTE idêntica ao snapshot literal capturado antes desta tarefa (tagmodel.js intocado — sem reimplementar a partição em app.js)"
  );
  const idxDeclaration = tagModelJs.indexOf("function getRecipesByCollection(collectionId) {");
  const secondOccurrence = tagModelJs.indexOf("function getRecipesByCollection(collectionId) {", idxDeclaration + 1);
  assert(secondOccurrence === -1, "TESTE NEGATIVO: getRecipesByCollection não foi duplicada em tagmodel.js (só 1 declaração)");

  console.log("");
  console.log("==================================================");
  console.log("RESUMO POR SEÇÃO");
  console.log("==================================================");
  sectionOrder.forEach((key) => {
    const c = sectionCounts[key];
    console.log("  " + key + ": " + c.ok + " OK, " + c.fail + " FAIL");
  });
  const totalOk = sectionOrder.reduce((s, key) => s + sectionCounts[key].ok, 0);
  const totalFail = sectionOrder.reduce((s, key) => s + sectionCounts[key].fail, 0);
  console.log("TOTAL: " + totalOk + " OK, " + totalFail + " FAIL");

  if (failures > 0) {
    console.log("\n" + failures + " FALHA(S)");
    process.exit(1);
  } else {
    console.log("\nTODAS AS ASSERÇÕES PASSARAM");
  }
}

main();
