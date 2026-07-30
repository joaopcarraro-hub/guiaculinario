// scripts/verify-protein-role-unify-2026-07-30.js
//
// Suíte da Dívida #2: unificação da validação/aplicação de proteinRole (papel da proteína) —
// 1 helper (validProteinRole) substituindo 3 cópias de validação anti-fantasma no init
// (renderGrupo/renderCategory/renderBusca) + re-validação nos 2 handlers de × + o hub passa a
// recortar seus resultados por papel (Bug A fechado). Mesmo padrão fs+vm de
// scripts/verify-busca-unificada-2026-07-29.js: TagModel roda de verdade num sandbox `window`;
// js/app.js fica fora do harness principal (depende de document/location/history no escopo de
// módulo) — extração de função por casamento de chaves (extractFunctionBody, mesmo mecanismo da
// suíte irmã) prova o comportamento direto do FONTE real, sem reimplementar a regra numa 3ª
// forma.
//
// `node scripts/verify-protein-role-unify-2026-07-30.js` — sai com código != 0 se algo falhar.

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

// ---------- réplica fiel de js/app.js:354-360 (GRUPOS) e js/app.js:396-437 (getCatIdToGroup) —
// MESMA réplica já usada e guardada por scripts/verify-busca-unificada-2026-07-29.js (seção 10,
// guarda anti-réplica lê o FONTE de app.js direto). Esta suíte não duplica aquela guarda — só
// reusa o mesmo cálculo pra chegar no gabarito do hub Proteínas (groupUniverse). ----------
const GRUPOS = [
  { id: "fundamentos", label: "Mais Categorias", collectionGroup: "Fundamentos" },
  { id: "proteinas", label: "Proteínas", collectionGroup: "Proteínas" },
  { id: "cozinhas", label: "Países", collectionGroup: "Países" },
  { id: "tempo", label: "Por tempo", collectionGroup: "Por tempo" },
  { id: "dificuldade", label: "Por dificuldade", collectionGroup: "Por dificuldade" },
];
function getCatIdToGroup(COLLECTIONS, CATEGORIES) {
  const map = {};
  COLLECTIONS.forEach((c) => {
    if (CATEGORIES.some((cat) => cat.id === c.id)) map[c.id] = c.group;
  });
  const brasilCollection = COLLECTIONS.find((c) => c.id === "brasil");
  if (brasilCollection) {
    map["brasileiros"] = brasilCollection.group;
    map["brasil-regional"] = brasilCollection.group;
  }
  const tecnicasCollection = COLLECTIONS.find((c) => c.id === "tecnicas");
  if (tecnicasCollection) {
    map["contemporaneos"] = tecnicasCollection.group;
    map["tecnicas-contemporaneas-2"] = tecnicasCollection.group;
  }
  const risotosArrozCollection = COLLECTIONS.find((c) => c.id === "risotos-arroz");
  if (risotosArrozCollection) {
    map["risotos"] = risotosArrozCollection.group;
    map["arrozes"] = risotosArrozCollection.group;
  }
  const entradasCollection = COLLECTIONS.find((c) => c.id === "entradas");
  if (entradasCollection) {
    map["entradas-frias"] = entradasCollection.group;
    map["entradas-quentes"] = entradasCollection.group;
  }
  const ovoCollection = COLLECTIONS.find((c) => c.id === "col-ovo");
  if (ovoCollection) {
    map["ovos-basicos"] = ovoCollection.group;
    map["ovos-classicos"] = ovoCollection.group;
  }
  return map;
}

// ---------- extrai o corpo de uma função nomeada por casamento de chaves (mesmo mecanismo de
// verify-busca-unificada-2026-07-29.js) ----------
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

// ---------- carrega activeProteinTagIds+validProteinRole REAIS via extração de app.js — as
// únicas 2 funções puras (sem document/location/history) que este par precisa; extraídas e
// executadas JUNTAS no mesmo escopo (validProteinRole chama activeProteinTagIds) — roda o
// binário real, não reimplementa a regra. validProteinRole é a função NOVA desta dívida (S1):
// pré-implementação a extração devolve null (RED esperado). ----------
function loadRoleHelpers(appJs) {
  const activeBody = extractFunctionBody(appJs, "function activeProteinTagIds(facetState, collection) {");
  const validBody = extractFunctionBody(appJs, "function validProteinRole(candidate, facetState, collection) {");
  if (!activeBody || !validBody) return null;
  // eslint-disable-next-line no-new-func
  return new Function(
    "return (function() {\n" + activeBody + "\n" + validBody + "\nreturn { activeProteinTagIds: activeProteinTagIds, validProteinRole: validProteinRole };\n})()"
  )();
}

function main() {
  const win = loadPipeline();
  const TagModel = win.TagModel;
  const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
  const catIdToGroup = getCatIdToGroup(win.COLLECTIONS, win.CATEGORIES);
  const allRecipes = TagModel.getAllRecipesFlat();

  // réplica fiel de renderGrupo 671-710 (collections do grupo sem hideFromGrupoGrid; groupRecipes
  // por catId->grupo; união com getRecipesByCollection(c.id).allRecipes; groupItemById espelha o
  // item real de cada fonte, coleção sobrescrevendo categoria — mesma ordem do fonte real).
  function groupUniverseFor(grupoId) {
    const grupo = GRUPOS.find((g) => g.id === grupoId);
    const collections = win.COLLECTIONS.filter((c) => c.group === grupo.collectionGroup && !c.hideFromGrupoGrid);
    const groupRecipes = allRecipes.filter((item) => catIdToGroup[item.catId] === grupo.collectionGroup);
    const groupScopeIds = new Set(groupRecipes.map((item) => item.id));
    collections.forEach((c) => {
      TagModel.getRecipesByCollection(c.id).allRecipes.forEach((item) => groupScopeIds.add(item.id));
    });
    const groupRecipeIds = Array.from(groupScopeIds);
    const groupItemById = {};
    groupRecipes.forEach((item) => {
      groupItemById[item.id] = item;
    });
    collections.forEach((c) => {
      TagModel.getRecipesByCollection(c.id).allRecipes.forEach((item) => {
        groupItemById[item.id] = item;
      });
    });
    return groupRecipeIds.map((id) => groupItemById[id]);
  }

  section("1", "GABARITO — Hub Proteínas + faceta Frango (Bug A: hub promete papel e não recorta)");
  const groupUniverse = groupUniverseFor("proteinas");
  console.log("  literal: groupUniverse (hub Proteínas) = " + groupUniverse.length);
  assert(groupUniverse.length === 367, "groupUniverse (hub Proteínas) = 367 (obtido " + groupUniverse.length + ")");
  const filtrado = groupUniverse.filter((item) => TagModel.matchesGroupedTags(item.tags, ["protein:frango"], "or"));
  console.log("  literal: filtrado por protein:frango = " + filtrado.length);
  assert(filtrado.length === 36, "filtrado por matchesGroupedTags(['protein:frango']) = 36 (obtido " + filtrado.length + ")");
  const splitHub = TagModel.splitByProteinRole(filtrado, ["protein:frango"]);
  console.log("  literal: split -> primary=" + splitHub.primary.length + " secondary=" + splitHub.secondary.length);
  assert(splitHub.primary.length === 29, "splitByProteinRole(filtrado).primary = 29 (obtido " + splitHub.primary.length + ")");
  assert(splitHub.secondary.length === 7, "splitByProteinRole(filtrado).secondary = 7 (obtido " + splitHub.secondary.length + ")");
  assert(
    splitHub.primary.length + splitHub.secondary.length === 36,
    "29+7 = 36, nenhuma receita perdida na partição (obtido " + (splitHub.primary.length + splitHub.secondary.length) + ")"
  );

  console.log("");
  section("2", "GABARITO — França (país, sem S implícito) (Bug B: papel fantasma no × de chip)");
  const franca = TagModel.getRecipesByCollection("franca").allRecipes;
  console.log("  literal: França allRecipes = " + franca.length);
  assert(franca.length === 83, "getRecipesByCollection('franca').allRecipes = 83 (obtido " + franca.length + ")");
  const francaFrango = franca.filter((item) => TagModel.matchesGroupedTags(item.tags, ["protein:frango"], "or"));
  console.log("  literal: França + protein:frango = " + francaFrango.length);
  assert(francaFrango.length === 6, "França filtrada por protein:frango = 6 (obtido " + francaFrango.length + ")");
  const splitFranca = TagModel.splitByProteinRole(francaFrango, ["protein:frango"]);
  assert(splitFranca.primary.length === 4, "split França -> primary = 4 (obtido " + splitFranca.primary.length + ")");
  assert(splitFranca.secondary.length === 2, "split França -> secondary = 2 (obtido " + splitFranca.secondary.length + ")");
  const splitFrancaGhost = TagModel.splitByProteinRole(franca, []);
  console.log(
    "  literal: splitByProteinRole(allRecipes, []) -> primary=" + splitFrancaGhost.primary.length + " secondary=" + splitFrancaGhost.secondary.length
  );
  assert(
    splitFrancaGhost.primary.length === 83 && splitFrancaGhost.secondary.length === 0,
    "splitByProteinRole(allRecipes, []) = {primary:83, secondary:0} — documenta o mecanismo do fantasma (S vazio: 'focus' vira inerte com TUDO dentro, 'secondary' zera a lista)"
  );

  console.log("");
  section("3", "validProteinRole EXECUTADA DE VERDADE (extração real de app.js)");
  const helpers = loadRoleHelpers(appJs);
  assert(!!helpers, "activeProteinTagIds E validProteinRole extraídas e executadas juntas de app.js (RED esperado antes de S1: validProteinRole ainda não existe)");
  const validProteinRole = helpers ? helpers.validProteinRole : null;
  const facetStateFrango = { protein: ["protein:frango"] };
  const facetStateVazio = { protein: [] };
  const proteinCollection = win.COLLECTIONS.find((c) => c.collectionType === "protein");
  assert(!!proteinCollection, "existe pelo menos 1 coleção collectionType==='protein' na base real (pré-condição do teste)");
  if (validProteinRole) {
    assert(validProteinRole("focus", facetStateFrango, null) === "focus", "('focus', S≠∅, collection=null) -> 'focus'");
    assert(validProteinRole("secondary", facetStateFrango, null) === "secondary", "('secondary', S≠∅, collection=null) -> 'secondary'");
    assert(validProteinRole("focus", facetStateVazio, null) === null, "('focus', S=∅, collection=null) -> null (fantasma morto)");
    assert(validProteinRole("secondary", facetStateVazio, null) === null, "('secondary', S=∅, collection=null) -> null (fantasma morto)");
    assert(validProteinRole("qualquercoisa", facetStateFrango, null) === null, "candidate fora de {focus,secondary} -> null (obtido com 'qualquercoisa')");
    assert(validProteinRole(undefined, facetStateFrango, null) === null, "candidate undefined -> null");
    assert(validProteinRole(null, facetStateFrango, null) === null, "candidate null -> null");
    if (proteinCollection) {
      assert(
        validProteinRole("focus", facetStateVazio, proteinCollection) === "focus",
        "('focus', facetState sem explícito, collection de proteína '" + proteinCollection.id + "') -> 'focus' (S implícito via primaryFilterTags)"
      );
      assert(
        validProteinRole("secondary", facetStateVazio, proteinCollection) === "secondary",
        "('secondary', facetState sem explícito, collection de proteína '" + proteinCollection.id + "') -> 'secondary' (S implícito via primaryFilterTags)"
      );
    }
  } else {
    assert(false, "('focus', S≠∅, collection=null) -> 'focus' — não executado, validProteinRole ainda não existe");
    assert(false, "('secondary', S≠∅, collection=null) -> 'secondary' — não executado, validProteinRole ainda não existe");
    assert(false, "('focus', S=∅, collection=null) -> null — não executado, validProteinRole ainda não existe");
    assert(false, "candidate fora de {focus,secondary} -> null — não executado, validProteinRole ainda não existe");
    assert(false, "candidate undefined/null -> null — não executado, validProteinRole ainda não existe");
    assert(false, "S implícito via collection de proteína — não executado, validProteinRole ainda não existe");
  }

  console.log("");
  section("4", "CENSO — validProteinRole( aparece EXATAMENTE 6x em js/app.js");
  const occurrences = (appJs.match(/validProteinRole\(/g) || []).length;
  console.log("  literal: ocorrências de 'validProteinRole(' = " + occurrences);
  assert(
    occurrences === 6,
    "1 declaração + 3 inits (renderGrupo/renderCategory/renderBusca) + 2 handlers de × (hub/categoria) = 6 (obtido " + occurrences + ")"
  );

  console.log("");
  section("5", "HUB APLICA PAPEL (S3) — runSearch recorta out.block1 E out.block2 ANTES de scopedTotal");
  const grupoStart = appJs.indexOf("function renderGrupo(grupoId) {");
  const grupoEnd = appJs.indexOf("\n  // ---------- Home ----------", grupoStart);
  assert(grupoStart !== -1 && grupoEnd !== -1, "renderGrupo isolada por marcador de início/fim (mesmo mecanismo de verify-busca-unificada)");
  const grupoBody = grupoStart !== -1 && grupoEnd !== -1 ? appJs.slice(grupoStart, grupoEnd) : "";
  const runSearchHubBody = extractFunctionBody(grupoBody, "function runSearch(query) {") || "";
  assert(runSearchHubBody.length > 0, "runSearch (escopo do hub) encontrada e isolada por casamento de chaves");
  const idxRoleGuard = runSearchHubBody.indexOf('if (proteinRole === "focus" || proteinRole === "secondary") {');
  const idxActiveS = runSearchHubBody.indexOf("activeProteinTagIds(facetState, null)");
  const idxSplit = runSearchHubBody.indexOf("TagModel.splitByProteinRole(entries.map((e) => e.item), S)");
  const idxBlock1 = runSearchHubBody.indexOf("out.block1 = sliceByRole(out.block1);");
  const idxBlock2 = runSearchHubBody.indexOf("out.block2 = sliceByRole(out.block2);");
  const idxScopedTotal = runSearchHubBody.indexOf("const scopedTotal = out.block1.length + out.block2.length;");
  assert(idxRoleGuard !== -1, "guarda 'proteinRole === focus||secondary' presente em runSearch do hub");
  assert(idxActiveS !== -1, "S = activeProteinTagIds(facetState, null) presente em runSearch do hub");
  assert(idxSplit !== -1, "TagModel.splitByProteinRole aplicado via sliceByRole(entries) presente em runSearch do hub");
  assert(idxBlock1 !== -1 && idxBlock2 !== -1, "recorte aplicado a out.block1 E out.block2 (não só um dos dois)");
  assert(idxScopedTotal !== -1, "const scopedTotal ainda presente (pino legado, linha de contagem real não removida)");
  assert(
    idxRoleGuard !== -1 && idxScopedTotal !== -1 && idxRoleGuard < idxScopedTotal && idxBlock1 !== -1 && idxBlock1 < idxScopedTotal && idxBlock2 !== -1 && idxBlock2 < idxScopedTotal,
    "o recorte por papel roda ANTES de scopedTotal (scopedTotal sai recortado por consequência, regra da válvula)"
  );

  console.log("");
  section("6", "PINOS LEGADOS — runSearch do hub preserva os literais das suítes antigas (nenhuma edição nelas, mas o comportamento tem que sobreviver)");
  assert(
    runSearchHubBody.indexOf("facetStateToTagIds(facetState, GENERIC_FACET_DEFS)") !== -1,
    "pino busca-unificada L381: facetStateToTagIds(facetState, GENERIC_FACET_DEFS) ainda presente"
  );
  assert(
    runSearchHubBody.indexOf("baseTagIds: baseTagIds, ingredientMode: ingredientMode, scopeIds: groupRecipeIds") !== -1,
    "pino busca-unificada L386: a MESMA chamada de Search.searchByQuery recebe baseTagIds+ingredientMode+scopeIds juntos"
  );
  assert(runSearchHubBody.indexOf("facetUniverse(baseTagIds, ingredientMode)") !== -1, "pino busca-unificada L390: caminho sem texto reusa facetUniverse");
  const runSearchCallCount = (grupoBody.match(/runSearch\(/g) || []).length;
  assert(runSearchCallCount === 3, "pino grupo-fromhash L91: runSearch( aparece 3x no escopo do grupo (obtido " + runSearchCallCount + ")");

  console.log("");
  section("7", "RE-VALIDAÇÃO NO × DA CATEGORIA — ANTES de syncUrl()/persistState()");
  const categoryStart = appJs.indexOf("function renderCategory(collection, initialFacetTags, initialRole, initialIngredientMode) {");
  const categoryEnd = appJs.indexOf("\n  // ---------- Busca facetada por tags ----------", categoryStart);
  assert(categoryStart !== -1 && categoryEnd !== -1, "renderCategory isolada por marcador de início/fim");
  const categoryBody = categoryStart !== -1 && categoryEnd !== -1 ? appJs.slice(categoryStart, categoryEnd) : "";
  const activeChipsCatBody = extractFunctionBody(categoryBody, "function renderActiveChips() {") || "";
  assert(activeChipsCatBody.length > 0, "renderActiveChips (categoria) encontrada e isolada por casamento de chaves");
  const idxRevalidateCat = activeChipsCatBody.indexOf(
    "proteinRole = validProteinRole(proteinRole, readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS), collection);"
  );
  const idxSyncUrl = activeChipsCatBody.indexOf("syncUrl();");
  const idxPersistState = activeChipsCatBody.indexOf("persistState();");
  assert(idxRevalidateCat !== -1, "re-validação de proteinRole presente no handler de × da categoria");
  assert(idxSyncUrl !== -1 && idxPersistState !== -1, "syncUrl()/persistState() presentes no mesmo handler");
  assert(
    idxRevalidateCat !== -1 && idxSyncUrl !== -1 && idxPersistState !== -1 && idxRevalidateCat < idxSyncUrl && idxRevalidateCat < idxPersistState,
    "re-validação roda ANTES de syncUrl() E persistState() (papel nunca sobrevive sem proteína ativa em nenhum caminho de mutação)"
  );

  console.log("");
  section("8", "RE-VALIDAÇÃO NO × DO HUB — ANTES de persistFacetState()");
  const activeChipsHubBody = extractFunctionBody(grupoBody, "function renderActiveChips() {") || "";
  assert(activeChipsHubBody.length > 0, "renderActiveChips (hub) encontrada e isolada por casamento de chaves");
  const idxRevalidateHub = activeChipsHubBody.indexOf(
    "proteinRole = validProteinRole(proteinRole, readFacetStateFromTags(selectedFacetTags, GENERIC_FACET_DEFS), null);"
  );
  const idxPersistFacetState = activeChipsHubBody.indexOf("persistFacetState();");
  assert(idxRevalidateHub !== -1, "re-validação de proteinRole presente no handler de × do hub");
  assert(idxPersistFacetState !== -1, "persistFacetState() presente no mesmo handler");
  assert(
    idxRevalidateHub !== -1 && idxPersistFacetState !== -1 && idxRevalidateHub < idxPersistFacetState,
    "re-validação roda ANTES de persistFacetState()"
  );

  console.log("");
  section("9", "NEGATIVOS — dedupe real, nada de código morto sobrevivendo");
  assert(appJs.indexOf("const savedRole") === -1, "TESTE NEGATIVO: 'const savedRole' não existe mais em app.js (cópia de init do hub morreu)");
  assert(appJs.indexOf("const roleCandidate") === -1, "TESTE NEGATIVO: 'const roleCandidate' não existe mais em app.js (cópia de init da categoria morreu)");
  const buscaStart = appJs.indexOf("function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery, initialRole) {");
  const buscaEnd = appJs.indexOf("\n  // ---------- Telas-placeholder", buscaStart);
  assert(buscaStart !== -1 && buscaEnd !== -1, "renderBusca isolada por marcador de início/fim");
  const buscaBody = buscaStart !== -1 && buscaEnd !== -1 ? appJs.slice(buscaStart, buscaEnd) : "";
  assert(
    buscaBody.indexOf("proteinRole: null,") === -1,
    "TESTE NEGATIVO: escopo de renderBusca segue SEM o literal 'proteinRole: null,' (nunca existiu, guarda contra reintrodução)"
  );

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
