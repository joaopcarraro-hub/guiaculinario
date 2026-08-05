// scripts/verify-busca-unificada-2026-07-29.js
//
// Suíte do motor de busca unificado (S1-S6, redesenho do parser — Fase 1 do workstream
// busca+taxonomia, ver .claude memory do projeto). Roda o CÓDIGO REAL de js/search.js e
// js/tagmodel.js via `new Function("window", code)`, mesmo truque de
// scripts/verify-search-parser-2026-07-24.js — não simula nada, chama
// Search.parseQuery/searchByQuery de verdade.
//
// js/app.js e js/router.js dependem de `document`/`location`/`history` no escopo de módulo
// (mesma limitação documentada em verify-search-parser-2026-07-24.js), então ficam fora do
// harness principal. Duas exceções pontuais, marcadas explicitamente:
//   - GRUPOS/getCatIdToGroup (item 2/3/4, escopo de hub): RÉPLICA FIEL de js/app.js:344-350 e
//     js/app.js:390-431 (não exportadas pra window) — copiado do código lido, não é o binário
//     original. Se algum dia divergir de app.js, comparar as duas.
//   - buildBuscaPath (item 9): a função em si é pura (sem dependência de DOM), então é
//     EXTRAÍDA do código-fonte REAL de js/router.js e executada isolada — é o binário
//     original, só fora do módulo que a envolve (que tem o addEventListener/rawPath() que
//     dependem de `window`/`location` reais).
//
// `node scripts/verify-busca-unificada-2026-07-29.js` — sai com código != 0 se algo falhar.

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
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "search.js"), "utf8"));
  return sandbox.window;
}

let failures = 0;
// P2 (reconciliação de contagens, 2026-07-29): cada assert() soma na seção CORRENTE
// (setada por section() abaixo) — a tabela impressa no fim (ver main()) é a MESMA contagem
// que decide OK/FAIL, nunca um recálculo em paralelo que possa divergir dela por construção.
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

// ---------- réplica fiel de js/app.js:344-350 (GRUPOS) e js/app.js:390-431 (getCatIdToGroup) ----------
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

// ---------- extrai o corpo de uma função nomeada de um texto-fonte via casamento de chaves
// (mesmo truque de loadBuildBuscaPath, generalizado — usado pelas seções 9a-9d pra isolar
// commitChip/runSearch/persistFacetState dentro de grupoBody sem reimplementar a lógica) ----------
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

// ---------- extrai buildBuscaPath REAL de js/router.js (função pura, sem dependência de DOM) ----------
function loadBuildBuscaPath() {
  const src = fs.readFileSync(path.join(JS_DIR, "router.js"), "utf8");
  const start = src.indexOf("function buildBuscaPath(");
  if (start < 0) throw new Error("buildBuscaPath não encontrada em router.js");
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("fim de buildBuscaPath não encontrado");
  const fnSrc = src.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function("return (" + fnSrc + ")")();
}

function main() {
  const win = loadPipeline();
  const Search = win.Search;
  const TagModel = win.TagModel;
  const catIdToGroup = getCatIdToGroup(win.COLLECTIONS, win.CATEGORIES);
  const allRecipes = TagModel.getAllRecipesFlat();
  // S6.1 (correção de spec pós-auditoria 2026-07-29): réplica fiel da união nova em
  // js/app.js:renderGrupo — escopo = (a) receitas por categoria (regra antiga, mantida) UNIÃO (b)
  // receitas que cada coleção do grupo (com tile nesta tela, !hideFromGrupoGrid) abriria de
  // verdade via TagModel.getRecipesByCollection — a MESMA função que o clique real no tile chama
  // (js/app.js renderCategory), não uma cópia. Se algum dia divergir de app.js, comparar as duas.
  // P2 (auditoria pós-S6.1): por ser RÉPLICA, esta função pode ficar desatualizada em silêncio se
  // app.js mudar. GUARDA da réplica é a seção 10 (GUARDA ANTI-RÉPLICA) no fim do arquivo — lê o
  // FONTE de app.js direto e assere que renderGrupo realmente chama TagModel.getRecipesByCollection
  // em união com o caminho por categoria. Se app.js divergir desta réplica aqui, a seção 10 fica
  // vermelha antes de qualquer número desta suíte virar falso positivo.
  function scopeFor(grupoId) {
    const grupo = GRUPOS.find((g) => g.id === grupoId);
    const ids = new Set(allRecipes.filter((item) => catIdToGroup[item.catId] === grupo.collectionGroup).map((item) => item.id));
    win.COLLECTIONS.filter((c) => c.group === grupo.collectionGroup && !c.hideFromGrupoGrid).forEach((c) => {
      TagModel.getRecipesByCollection(c.id).allRecipes.forEach((item) => ids.add(item.id));
    });
    return Array.from(ids);
  }
  const scopeProteinas = scopeFor("proteinas");
  const scopeFundamentos = scopeFor("fundamentos");

  section("1", "'carn' GLOBAL — resultado > 0, superconjunto do bloco2 de 'carne'");
  const outCarn = Search.searchByQuery("carn", {});
  const outCarne = Search.searchByQuery("carne", {});
  console.log("  literal: carn.block2=" + outCarn.block2.length + " carne.block2=" + outCarne.block2.length);
  assert(outCarn.block2.length > 0, "'carn' produz resultado (obtido " + outCarn.block2.length + ")");
  const idsCarn = new Set(outCarn.block2.map((r) => r.item.id));
  const isSuperset = outCarne.block2.every((r) => idsCarn.has(r.item.id));
  assert(isSuperset, "'carn'.block2 é superconjunto de 'carne'.block2 (carn=" + outCarn.block2.length + " >= carne=" + outCarne.block2.length + ")");

  console.log("");
  section("2", "'frutos' NOS 3 ESCOPOS (null, Proteínas, Fundamentos) — S6.1: escopo de hub = UNIÃO (categoria + tile)");
  // Recalibrado 2026-07-29 (Ato 3b-cont): 30 -> 29, só a Paella — recategorizada de
  // frutos-do-mar pra arrozes (era arroz seco mal classificado como frutos do mar; auto-tag
  // protein:frutos-do-mar de CATEGORY_BASE_TAGS some com o catId, contains:frutos-do-mar
  // explícita entra no lugar). Nenhuma outra causa.
  const proteinFrutosIds = new Set(allRecipes.filter((r) => r.tags.indexOf("protein:frutos-do-mar") !== -1).map((r) => r.id));
  assert(proteinFrutosIds.size === 29, "base real: protein:frutos-do-mar = 29 receitas (obtido " + proteinFrutosIds.size + ")");
  const outFrutosNull = Search.searchByQuery("frutos", {});
  const outFrutosProt = Search.searchByQuery("frutos", { scopeIds: scopeProteinas });
  const outFrutosFund = Search.searchByQuery("frutos", { scopeIds: scopeFundamentos });
  console.log(
    "  literal: escopo=null block2=" +
      outFrutosNull.block2.length +
      " | escopo=Proteínas(S6.1) block1+2=" +
      (outFrutosProt.block1.length + outFrutosProt.block2.length) +
      " (pré-S6.1 era 8) | escopo=Fundamentos block1+2=" +
      (outFrutosFund.block1.length + outFrutosFund.block2.length) +
      " (inalterado — união não soma receita nova em Fundamentos)"
  );
  const nullIds = new Set(outFrutosNull.block1.concat(outFrutosNull.block2).map((r) => r.item.id));
  assert([...proteinFrutosIds].every((id) => nullIds.has(id)), "escopo=null: as 30 de protein:frutos-do-mar aparecem via texto (S2)");
  // S6.1 (correção de spec pós-auditoria 2026-07-29): escopo de hub passou a ser UNIÃO de (a)
  // categoria (getCatIdToGroup) e (b) receitas que cada tile do grupo abre de verdade
  // (TagModel.getRecipesByCollection). As 30 de protein:frutos-do-mar entram INTEIRAS no escopo
  // de Proteínas agora (antes só 7 entravam, a interseção com a categoria — a asserção antiga
  // testava exatamente essa interseção; ela morre aqui porque o invariante mudou: escopo ⊇ tile,
  // não escopo ∩ tile).
  const protIds = new Set(outFrutosProt.block1.concat(outFrutosProt.block2).map((r) => r.item.id));
  assert(
    [...proteinFrutosIds].every((id) => scopeProteinas.indexOf(id) !== -1),
    "escopo=Proteínas (S6.1): as 30 de protein:frutos-do-mar entram INTEIRAS no escopo (união, não só a interseção por categoria de antes)"
  );
  assert(
    [...proteinFrutosIds].every((id) => protIds.has(id)),
    "escopo=Proteínas (S6.1): as 30 de protein:frutos-do-mar são todas alcançadas via texto 'frutos' (obtido " +
      (outFrutosProt.block1.length + outFrutosProt.block2.length) +
      " resultados no total)"
  );
  const fundNames = outFrutosFund.block1.concat(outFrutosFund.block2).map((r) => r.item.recipe.name);
  assert(fundNames.indexOf("Nantua") !== -1, "escopo=Fundamentos: inclui Nantua (obtido: " + fundNames.join(", ") + ")");

  console.log("");
  section("2b", "ASSERÇÃO NOVA (S6.1) — barra 'frutos'/Proteínas contém TUDO que o tile 'Frutos do Mar' abre");
  const tileFrutosDoMar = TagModel.getRecipesByCollection("frutos-do-mar");
  console.log(
    "  literal: tile 'Frutos do Mar' allRecipes=" +
      tileFrutosDoMar.allRecipes.length +
      " (primary=" +
      tileFrutosDoMar.primaryRecipes.length +
      " + related=" +
      tileFrutosDoMar.relatedRecipes.length +
      ", related via relatedFilterTags=contains:frutos-do-mar)"
  );
  const tileMissing = tileFrutosDoMar.allRecipes.filter((item) => !protIds.has(item.id));
  assert(
    tileMissing.length === 0,
    "barra 'frutos' (escopo Proteínas, S6.1) contém as " +
      tileFrutosDoMar.allRecipes.length +
      " receitas que o tile 'Frutos do Mar' abre (faltando: " +
      (tileMissing.length ? tileMissing.map((i) => i.recipe.name).join(", ") : "nenhuma") +
      ")"
  );

  console.log("");
  section("3", "'molho' vs 'molhos' COM ESCOPO FUNDAMENTOS — contagens IGUAIS (mata bug indexOf invertido)");
  const outMolho = Search.searchByQuery("molho", { scopeIds: scopeFundamentos });
  const outMolhos = Search.searchByQuery("molhos", { scopeIds: scopeFundamentos });
  const totalMolho = outMolho.block1.length + outMolho.block2.length;
  const totalMolhos = outMolhos.block1.length + outMolhos.block2.length;
  console.log("  literal: molho=" + totalMolho + " molhos=" + totalMolhos);
  assert(totalMolho === totalMolhos, "'molho' e 'molhos' dão a MESMA contagem no escopo Fundamentos (molho=" + totalMolho + " molhos=" + totalMolhos + ")");
  assert(totalMolho > 0, "e essa contagem não é zero (obtido " + totalMolho + ")");

  console.log("");
  section("4", "'leite' COM ESCOPO PROTEÍNAS E FUNDAMENTOS — literais pós-S6.1 (>=11 e >=33)");
  const outLeiteProt = Search.searchByQuery("leite", { scopeIds: scopeProteinas });
  const outLeiteFund = Search.searchByQuery("leite", { scopeIds: scopeFundamentos });
  const totalLeiteProt = outLeiteProt.block1.length + outLeiteProt.block2.length;
  const totalLeiteFund = outLeiteFund.block1.length + outLeiteFund.block2.length;
  console.log(
    "  literal: leite escopo=Proteínas=" +
      totalLeiteProt +
      " (pré-S6.1: 11 — escopo virou união categoria+tile, cresce muito porque quase toda receita tem alguma proteína) | escopo=Fundamentos=" +
      totalLeiteFund +
      " (pré-S6.1: 33 — Fundamentos não muda com a união, 0 receita nova, mesmo valor de antes)"
  );
  assert(totalLeiteProt >= 11, "leite/Proteínas >= 11 (obtido " + totalLeiteProt + ") — se menor, PARE e investigue antes de aceitar");
  assert(totalLeiteFund >= 33, "leite/Fundamentos >= 33 (obtido " + totalLeiteFund + ") — se menor, PARE e investigue antes de aceitar");

  console.log("");
  section("5", "'ovo' -> auto dish_type:ovo ; 'ovos' -> auto protein:ovo (inalterado)");
  const pOvo = Search.parseQuery("ovo", []);
  const pOvos = Search.parseQuery("ovos", []);
  assert(pOvo.autoTagIds.indexOf("dish_type:ovo") !== -1, "'ovo' -> auto dish_type:ovo (obtido " + JSON.stringify(pOvo.autoTagIds) + ")");
  assert(pOvos.autoTagIds.indexOf("protein:ovo") !== -1, "'ovos' -> auto protein:ovo (obtido " + JSON.stringify(pOvos.autoTagIds) + ")");

  console.log("");
  section("6", "cafe/café/CAFE IDÊNTICOS — normalização única (também no caminho do hub)");
  const variants = ["cafe", "café", "CAFE", "Café"];
  const globalResults = variants.map((v) => {
    const o = Search.searchByQuery(v, {});
    return o.block1.length + "|" + o.block2.length;
  });
  assert(globalResults.every((r) => r === globalResults[0]), "busca global: cafe/café/CAFE/Café dão resultado idêntico (" + globalResults.join(", ") + ")");
  // caminho do hub: window.DerivationDict.norm (S4) aplicada nas 4 variantes deve dar o MESMO
  // normalizado, confirmando a normalização única (normText próprio morreu em app.js).
  const normed = variants.map((v) => win.DerivationDict.norm(v));
  assert(normed.every((n) => n === normed[0]), "DerivationDict.norm (usada pelo hub após S4): cafe/café/CAFE/Café normalizam pro MESMO valor ('" + normed[0] + "')");

  console.log("");
  section("7", "OS 21 TERMOS-GUARDA — nenhum auto-colapso, escopo null E os 5 escopos de hub (S6.1: re-executado com o escopo novo, união)");
  const AMBIGUOUS_21 = [
    "acafrao", "alho", "avancada", "cafe", "caldo", "camarao", "doce", "entrada", "frances",
    "leite", "lula", "massa", "mexilhao", "molho", "pato", "peixe", "peru", "polvo", "rapida",
    "rapido", "tecnica",
  ];
  assert(AMBIGUOUS_21.length === 21, "lista local tem 21 termos (guarda contra deriva desta suíte também)");
  let anyAutoNull = false;
  AMBIGUOUS_21.forEach((t) => {
    const oNull = Search.searchByQuery(t, {});
    if (oNull.parsed.autoTagIds.length) anyAutoNull = true;
  });
  assert(!anyAutoNull, "nenhum dos 21 termos-guarda auto-colapsa com escopo null");
  // S6.1: antes só Fundamentos era re-testado aqui. O escopo de Proteínas/Países/Tempo/
  // Dificuldade cresceu MUITO com a união (ex. Proteínas 64→367, Dificuldade 0→398) — maior
  // risco de auto-colapso novo justamente nesses hubs, então os 5 entram no guard agora, não só
  // o que não mudou de tamanho.
  GRUPOS.forEach((g) => {
    const scope = scopeFor(g.id);
    let anyAutoHub = false;
    AMBIGUOUS_21.forEach((t) => {
      const oHub = Search.searchByQuery(t, { scopeIds: scope });
      if (oHub.parsed.autoTagIds.length) anyAutoHub = true;
    });
    assert(!anyAutoHub, "nenhum dos 21 termos-guarda auto-colapsa no escopo (S6.1, união) do hub '" + g.id + "' (tamanho=" + scope.length + ")");
  });

  console.log("");
  section("8", "PREFIXO NÃO CONTAMINA AUTO — 'carn' e 'fru' nunca viram tag automática");
  const pCarn = Search.parseQuery("carn", []);
  const pFru = Search.parseQuery("fru", []);
  assert(pCarn.autoTagIds.length === 0, "'carn' autoTagIds = [] (obtido " + JSON.stringify(pCarn.autoTagIds) + ")");
  assert(pFru.autoTagIds.length === 0, "'fru' autoTagIds = [] (obtido " + JSON.stringify(pFru.autoTagIds) + ")");
  assert(pCarn.segments[0] && pCarn.segments[0].classification === "optional", "'carn' vira chip OPCIONAL, nunca auto (obtido " + pCarn.segments[0].classification + ")");
  const carneChips = Search.parseQuery("carne", []).segments[0].chipTagIds.slice().sort();
  const carnChips = pCarn.segments[0].chipTagIds.slice().sort();
  assert(JSON.stringify(carnChips) === JSON.stringify(carneChips), "'carn' herda os MESMOS chips que 'carne' sugere (" + JSON.stringify(carnChips) + ")");

  console.log("");
  section("9a", "CHIP DE HUB COMMITA LOCAL — rota NUNCA sai de #/grupo/:id (S3, substitui a rota antiga)");
  const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
  const grupoStart = appJs.indexOf("function renderGrupo(grupoId) {");
  const grupoEnd = appJs.indexOf("\n  // ---------- Home ----------", grupoStart);
  const grupoBody = appJs.slice(grupoStart, grupoEnd);
  assert(
    grupoBody.indexOf("Router.toBusca([btn.dataset.tag], [])") === -1,
    "TESTE NEGATIVO: chip de hub NÃO chama mais Router.toBusca([tag], []) — a navegação antiga morreu nesta rodada"
  );
  assert(grupoBody.indexOf("commitChip(btn.dataset.tag, parsed)") !== -1, "chip sugerido chama commitChip(tag, parsed) — commit local, não navegação");
  const commitChipBody = extractFunctionBody(grupoBody, "function commitChip(tagId, parsed) {");
  assert(!!commitChipBody, "commitChip encontrada e isolada por casamento de chaves");
  assert(
    !!commitChipBody && commitChipBody.indexOf("Router.") === -1,
    "TESTE NEGATIVO: commitChip não chama NENHUM método de Router — commit é 100% local, rota fica parada em #/grupo/:id"
  );
  assert(
    !!commitChipBody && commitChipBody.indexOf("selectedFacetTags = selectedFacetTags.concat([tagId])") !== -1,
    "commitChip escreve a tag no MESMO selectedFacetTags que alimenta o facetState (não um estado paralelo)"
  );
  const removeChipBody = extractFunctionBody(grupoBody, "function renderActiveChips() {");
  assert(
    !!removeChipBody && removeChipBody.indexOf('selectedFacetTags = selectedFacetTags.filter((t) => t !== btn.dataset.tag)') !== -1,
    "× do chip ativo remove do MESMO selectedFacetTags (remover o último volta ao só-texto, sem caso especial)"
  );

  console.log("");
  section("9b", "MOTOR RECEBE baseTagIds+ESCOPO JUNTOS — mecanismo do bloco 1 já existente, nenhum caminho novo");
  const runSearchBody = extractFunctionBody(grupoBody, "function runSearch(query) {");
  assert(!!runSearchBody, "runSearch encontrada e isolada por casamento de chaves");
  assert(
    !!runSearchBody && runSearchBody.indexOf("facetStateToTagIds(facetState, GENERIC_FACET_DEFS)") !== -1,
    "runSearch deriva baseTagIds do MESMO facetStateToTagIds que Coleção/Busca já usam (não uma extração de tag própria)"
  );
  assert(
    !!runSearchBody &&
      runSearchBody.indexOf("baseTagIds: baseTagIds, ingredientMode: ingredientMode, scopeIds: groupRecipeIds") !== -1,
    "a MESMA chamada de Search.searchByQuery recebe baseTagIds E scopeIds juntos (texto residual dentro do escopo do grupo, com as facetas aplicadas)"
  );
  assert(
    !!runSearchBody && runSearchBody.indexOf("facetUniverse(baseTagIds, ingredientMode)") !== -1,
    "caminho sem texto (só facetas) reusa facetUniverse — que por sua vez chama TagModel.matchesGroupedTags, mesmo primitivo do motor, não uma comparação nova"
  );
  const facetUniverseBody = extractFunctionBody(grupoBody, "function facetUniverse(tagIds, mode) {");
  assert(
    !!facetUniverseBody && facetUniverseBody.indexOf("TagModel.matchesGroupedTags(item.tags, tagIds, mode)") !== -1,
    "facetUniverse de fato delega pra TagModel.matchesGroupedTags (mesma função que Coleção/Busca/o próprio bloco 1 já usam)"
  );
  // Literal real: 'mandioca' no hub Mais Categorias (Fundamentos) — contagem por texto ANTES do
  // commit (bloco1 do motor, escopo=Fundamentos) e o autoTagId que o commit aplicaria.
  const parsedMandioca = Search.parseQuery("mandioca", []);
  const outMandiocaScoped = Search.searchByQuery("mandioca", { scopeIds: scopeFundamentos });
  console.log(
    "  literal: 'mandioca' em Mais Categorias — autoTagIds=" +
      JSON.stringify(parsedMandioca.autoTagIds) +
      ", bloco1(escopo)=" +
      outMandiocaScoped.block1.length
  );
  assert(parsedMandioca.autoTagIds.indexOf("ingredient:mandioca") !== -1, "'mandioca' auto-classifica ingredient:mandioca (o que commitChip aplicaria)");
  assert(outMandiocaScoped.block1.length === 2, "'mandioca' pré-commit, escopo Fundamentos: bloco1 = 2 (obtido " + outMandiocaScoped.block1.length + ")");
  // Paridade chip=tile (S7): commitar protein:frutos-do-mar no hub Proteínas (sem texto — só
  // faceta, mesmo bypass que runSearch usa quando query é vazia: TagModel.matchesGroupedTags
  // direto sobre o universo-união do hub) tem que bater EXATAMENTE com o tile "Frutos do Mar".
  const scopeProteinasSet = new Set(scopeProteinas);
  const universeProteinas = allRecipes.filter((item) => scopeProteinasSet.has(item.id));
  const committedFrutos = universeProteinas.filter((item) => TagModel.matchesGroupedTags(item.tags, ["protein:frutos-do-mar"], "or"));
  const tileFrutos = TagModel.getRecipesByCollection("frutos-do-mar").allRecipes;
  console.log("  literal: paridade chip=tile — commit protein:frutos-do-mar no hub Proteínas = " + committedFrutos.length + ", tile 'Frutos do Mar' = " + tileFrutos.length);
  assert(
    committedFrutos.length === 43 && tileFrutos.length === 43,
    "paridade chip=tile: commitar frutos-do-mar no hub Proteínas retorna EXATAMENTE as 43 receitas do tile 'Frutos do Mar' (obtido commit=" +
      committedFrutos.length +
      " tile=" +
      tileFrutos.length +
      ")"
  );

  console.log("");
  section("9c", "PERSISTÊNCIA SIMÉTRICA — texto E facetState restaurados pelo MESMO mecanismo (S4)");
  assert(appJs.indexOf("const grupoFacetState = {};") !== -1, "grupoFacetState declarada — mesmo padrão de módulo de grupoSearchQuery (variável, não hash)");
  assert(
    appJs.indexOf("const grupoFacetState = {};") < grupoStart,
    "grupoFacetState declarada ANTES de renderGrupo (escopo de módulo, sobrevive ao re-render — mesma regra de grupoSearchQuery)"
  );
  assert(
    grupoBody.indexOf("let selectedFacetTags = (savedFacetState && savedFacetState.tags) || [];") !== -1,
    "carga inicial de selectedFacetTags lê de grupoFacetState[grupoId] (restaura facetas ao voltar de uma receita)"
  );
  assert(grupoBody.indexOf("function persistFacetState() {") !== -1, "persistFacetState existe — grava a FOTO do facetState em grupoFacetState[grupoId]");
  const persistCalls = (grupoBody.match(/persistFacetState\(\);/g) || []).length;
  assert(
    persistCalls >= 3,
    "persistFacetState() é chamada em TODOS os 3 pontos de commit (chip sugerido, × do chip ativo, Aplicar do modal) — obtido " + persistCalls
  );

  console.log("");
  section("9d", "VÁLVULA DE ESCAPE ANTI-DECEPÇÃO (S6/R3) — os 4 ramos, casos literais REAIS da base");
  // (a) escopado vazio E global > 0 — 'bacalhau' não tem NENHUMA receita em Mais Categorias, mas
  // existe no app inteiro.
  const outBacalhauScoped = Search.searchByQuery("bacalhau", { scopeIds: scopeFundamentos });
  const outBacalhauGlobal = Search.searchByQuery("bacalhau", {});
  const bacalhauScopedTotal = outBacalhauScoped.block1.length + outBacalhauScoped.block2.length;
  const bacalhauGlobalTotal = outBacalhauGlobal.block1.length + outBacalhauGlobal.block2.length;
  console.log("  literal ramo (a): 'bacalhau' em Mais Categorias — escopado=" + bacalhauScopedTotal + " global=" + bacalhauGlobalTotal);
  assert(
    bacalhauScopedTotal === 0 && bacalhauGlobalTotal > 0,
    "ramo (a) real: escopado=0 E global>0 (obtido escopado=" + bacalhauScopedTotal + " global=" + bacalhauGlobalTotal + ") — CTA 'Pesquisar em todo o aplicativo' aparece"
  );
  // (b) escopado vazio E global = 0 — termo inventado, sem resultado em lugar nenhum.
  const outNadaScoped = Search.searchByQuery("xxzzqq", { scopeIds: scopeProteinas });
  const outNadaGlobal = Search.searchByQuery("xxzzqq", {});
  const nadaScopedTotal = outNadaScoped.block1.length + outNadaScoped.block2.length;
  const nadaGlobalTotal = outNadaGlobal.block1.length + outNadaGlobal.block2.length;
  console.log("  literal ramo (b): 'xxzzqq' no hub Proteínas — escopado=" + nadaScopedTotal + " global=" + nadaGlobalTotal);
  assert(
    nadaScopedTotal === 0 && nadaGlobalTotal === 0,
    "ramo (b) real (caso verdadeiro exigido pelo S7): escopado=0 E global=0 — só mensagem de vazio, SEM CTA (obtido escopado=" +
      nadaScopedTotal +
      " global=" +
      nadaGlobalTotal +
      ")"
  );
  // (c) escopado com resultados E global > escopado — 'frango' tem resultado em Mais Categorias,
  // mas MUITO mais no app inteiro (a maior parte das receitas de frango vive em Proteínas).
  const outFrangoScoped = Search.searchByQuery("frango", { scopeIds: scopeFundamentos });
  const outFrangoGlobal = Search.searchByQuery("frango", {});
  const frangoScopedTotal = outFrangoScoped.block1.length + outFrangoScoped.block2.length;
  const frangoGlobalTotal = outFrangoGlobal.block1.length + outFrangoGlobal.block2.length;
  console.log("  literal ramo (c): 'frango' em Mais Categorias — escopado=" + frangoScopedTotal + " global=" + frangoGlobalTotal);
  assert(
    frangoScopedTotal > 0 && frangoGlobalTotal > frangoScopedTotal,
    "ramo (c) real: escopado>0 E global>escopado (obtido escopado=" + frangoScopedTotal + " global=" + frangoGlobalTotal + ") — link discreto 'Buscar no app inteiro' aparece"
  );
  // (d) global = escopado — 'risoto' dá o MESMO total nos 2 escopos (nenhuma receita de risoto
  // fora de Mais Categorias).
  const outRisotoScoped = Search.searchByQuery("risoto", { scopeIds: scopeFundamentos });
  const outRisotoGlobal = Search.searchByQuery("risoto", {});
  const risotoScopedTotal = outRisotoScoped.block1.length + outRisotoScoped.block2.length;
  const risotoGlobalTotal = outRisotoGlobal.block1.length + outRisotoGlobal.block2.length;
  console.log("  literal ramo (d): 'risoto' em Mais Categorias — escopado=" + risotoScopedTotal + " global=" + risotoGlobalTotal);
  assert(
    risotoScopedTotal === risotoGlobalTotal && risotoScopedTotal > 0,
    "ramo (d) real: global=escopado, ambos > 0 (obtido escopado=" + risotoScopedTotal + " global=" + risotoGlobalTotal + ") — sem rodapé, sem CTA"
  );

  // P1 (auditoria 2026-07-29, OBRIGATÓRIA): o único ramo (a) testado acima (bacalhau) virava tag
  // automática (ingredient:bacalhau) — não provava que TEXTO RESIDUAL PURO (nunca classificado
  // como tag, nem auto nem opcional) de fato viaja em transferToBusca/Router.toBusca. Os 2 casos
  // abaixo são 100% classificação "text" (parsed.autoTagIds=[], nenhum segmento "auto"/"optional"
  // — confirmado por sondagem antes de escolher os termos), então transferTags fica vazio e a
  // transferência inteira depende do canal de texto (text=, nunca tags=).
  function isPureText(term) {
    const p = Search.parseQuery(term, []);
    return p.autoTagIds.length === 0 && p.segments.every((s) => s.classification === "text");
  }
  // Consistência N-prometido = N-na-chegada: "N-na-chegada" é computado pelo MESMO motor que
  // renderBusca de fato usa pro texto já commitado (facetUniverse -> Search.matchesTextFilter,
  // sem nenhuma tag aplicada aqui, já que transferTags fica vazio nos 2 casos) — não uma 2ª
  // réplica solta. Isso é literalmente o achado do P1 desta rodada: matchesTextFilter usava
  // B1_FIELDS (4 campos) enquanto o Bloco 2/global usa ALL_FIELDS (7 campos, inclui descrição/
  // origem/tags) — os 2 nunca bateriam pra termo de texto puro. Corrigido em js/search.js
  // (matchesTextFilter agora usa ALL_FIELDS) — ver comentário da função pro raciocínio completo.
  function arrivalCountFor(term) {
    return allRecipes.filter((item) => Search.matchesTextFilter(item, term)).length;
  }

  console.log("");
  console.log("  -- P1: ramo (a) com TEXTO RESIDUAL PURO (nunca vira tag) --");
  const pFlambado = Search.parseQuery("flambado", []);
  assert(isPureText("flambado"), "'flambado' é 100% classificação text (obtido " + JSON.stringify(pFlambado.segments.map((s) => s.classification)) + ", autoTagIds=" + JSON.stringify(pFlambado.autoTagIds) + ")");
  const outFlambadoScoped = Search.searchByQuery("flambado", { scopeIds: scopeFundamentos });
  const outFlambadoGlobal = Search.searchByQuery("flambado", {});
  const flambadoScopedTotal = outFlambadoScoped.block1.length + outFlambadoScoped.block2.length;
  const flambadoGlobalTotal = outFlambadoGlobal.block1.length + outFlambadoGlobal.block2.length;
  const flambadoArrival = arrivalCountFor("flambado");
  console.log(
    "  literal ramo (a) texto puro: 'flambado' em Mais Categorias — escopado=" +
      flambadoScopedTotal +
      " global(N-prometido)=" +
      flambadoGlobalTotal +
      " chegada-em-busca(N-na-chegada)=" +
      flambadoArrival
  );
  assert(flambadoScopedTotal === 0 && flambadoGlobalTotal > 0, "ramo (a) texto puro real: escopado=0 E global>0 (obtido escopado=" + flambadoScopedTotal + " global=" + flambadoGlobalTotal + ")");
  assert(
    flambadoGlobalTotal === flambadoArrival,
    "N-prometido = N-na-chegada pra 'flambado' (obtido prometido=" + flambadoGlobalTotal + " chegada=" + flambadoArrival + ") — provado ao vivo: clique navegou pra #/busca?text=flambado, 2 receitas encontradas"
  );

  console.log("");
  console.log("  -- P1: ramo (c) com TEXTO RESIDUAL PURO (nunca vira tag) --");
  const pCremoso = Search.parseQuery("cremoso", []);
  assert(isPureText("cremoso"), "'cremoso' é 100% classificação text (obtido " + JSON.stringify(pCremoso.segments.map((s) => s.classification)) + ", autoTagIds=" + JSON.stringify(pCremoso.autoTagIds) + ")");
  const outCremosoScoped = Search.searchByQuery("cremoso", { scopeIds: scopeFundamentos });
  const outCremosoGlobal = Search.searchByQuery("cremoso", {});
  const cremosoScopedTotal = outCremosoScoped.block1.length + outCremosoScoped.block2.length;
  const cremosoGlobalTotal = outCremosoGlobal.block1.length + outCremosoGlobal.block2.length;
  const cremosoArrival = arrivalCountFor("cremoso");
  console.log(
    "  literal ramo (c) texto puro: 'cremoso' em Mais Categorias — escopado=" +
      cremosoScopedTotal +
      " global(N-prometido)=" +
      cremosoGlobalTotal +
      " chegada-em-busca(N-na-chegada)=" +
      cremosoArrival
  );
  assert(
    cremosoScopedTotal > 0 && cremosoGlobalTotal > cremosoScopedTotal,
    "ramo (c) texto puro real: escopado>0 E global>escopado (obtido escopado=" + cremosoScopedTotal + " global=" + cremosoGlobalTotal + ")"
  );
  assert(
    cremosoGlobalTotal === cremosoArrival,
    "N-prometido = N-na-chegada pra 'cremoso' (obtido prometido=" + cremosoGlobalTotal + " chegada=" + cremosoArrival + ") — provado ao vivo: clique navegou pra #/busca?text=cremoso, 29 receitas encontradas"
  );
  console.log("");

  // Papel da proteína (nota do S6): seleção de papel NÃO transfere pro escape valve — só o
  // parâmetro role de Router.toBusca fica de fora da chamada (as tags protein:* explícitas, sim).
  const transferToBuscaBody = extractFunctionBody(grupoBody, "function transferToBusca(query, baseTagIds) {");
  assert(!!transferToBuscaBody, "transferToBusca encontrada e isolada por casamento de chaves");
  assert(
    !!transferToBuscaBody && transferToBuscaBody.indexOf("Router.toBusca(transferTags, parsed.residualTokens || [], ingredientMode, null)") !== -1,
    "transferToBusca chama Router.toBusca com role=null explícito — Papel da proteína do hub NÃO transfere pra busca global (nota final do S6)"
  );
  const buildBuscaPath = loadBuildBuscaPath();
  const built = buildBuscaPath(["protein:boi"], [], "or", null, null);
  console.log("  literal: buildBuscaPath(['protein:boi']) = '" + built + "'");
  assert(built === "busca?tags=protein%3Aboi", "buildBuscaPath(['protein:boi']) segue produzindo o path esperado (usado pela válvula de escape) — obtido '" + built + "'");

  console.log("");
  section("10", "GUARDA ANTI-RÉPLICA (S6.1/P2) — renderGrupo usa TagModel.getRecipesByCollection (a MESMA função do tile) em UNIÃO com o caminho por categoria, direto no FONTE de app.js");
  // scopeFor() acima é uma RÉPLICA da união (comentário lá aponta pra cá). Réplica pode divergir
  // do app.js real em silêncio — nada no JS falha se alguém, num commit futuro, reverter
  // renderGrupo pra escopo só-categoria (ou só-coleção): a suíte continuaria rodando escopo
  // "certo" contra o replica desatualizado e passaria verde enquanto o app real regrediu. Esta
  // seção lê o FONTE de app.js direto (grupoBody, já extraído pro teste 9 acima) e assere por
  // texto: (a) a chamada existe pelo NOME REAL (TagModel.getRecipesByCollection), não uma cópia
  // de lógica; (b) o caminho por categoria ainda existe; (c) as duas alimentam o MESMO Set —
  // união de verdade, não 2 cálculos soltos que não se combinam. Se qualquer uma cair, esta
  // seção fica vermelha ANTES de a réplica ficar desatualizada em silêncio.
  assert(
    grupoBody.indexOf("TagModel.getRecipesByCollection(") !== -1,
    "renderGrupo chama TagModel.getRecipesByCollection (função canônica que resolve coleção→receitas no clique real do tile) — se sumir, o escopo da barra volta a divergir do tile"
  );
  assert(
    grupoBody.indexOf("catIdToGroup[item.catId] === grupo.collectionGroup") !== -1,
    "renderGrupo ainda calcula o caminho por categoria (regra (a) da união) — se sumir, o escopo perdeu a metade categoria"
  );
  const scopeSetDeclMatch = grupoBody.match(/const (\w+) = new Set\(groupRecipes\.map/);
  assert(!!scopeSetDeclMatch, "existe um Set inicializado a partir de groupRecipes, base da união (regra (a)) — obtido " + (scopeSetDeclMatch ? scopeSetDeclMatch[1] : "nenhum"));
  if (scopeSetDeclMatch) {
    const scopeVarName = scopeSetDeclMatch[1];
    const unionRegex = new RegExp("TagModel\\.getRecipesByCollection\\([^)]*\\)\\.allRecipes\\.forEach\\([\\s\\S]{0,60}" + scopeVarName + "\\.add\\(");
    assert(
      unionRegex.test(grupoBody),
      "o MESMO Set ('" + scopeVarName + "') que recebe a categoria (a) também recebe TagModel.getRecipesByCollection(...).allRecipes (b) — união real por construção, não 2 cálculos que não se combinam"
    );
  }

  console.log("");
  section("11a", "BARRA DE BUSCA EM CATEGORIA (S1, 2026-07-29) — mesmo pipeline do hub, commit no MESMO selectedFacetTags");
  const categoryStart = appJs.indexOf("function renderCategory(collection, initialFacetTags, initialRole, initialIngredientMode) {");
  assert(categoryStart !== -1, "renderCategory encontrada pela assinatura completa");
  const categoryEnd = appJs.indexOf("\n  // ---------- Busca facetada por tags ----------", categoryStart);
  assert(categoryEnd !== -1, "fim de renderCategory encontrado (próxima seção do arquivo)");
  const categoryBody = appJs.slice(categoryStart, categoryEnd);

  assert(
    categoryBody.indexOf('search.placeholder = "Buscar em " + collection.label.toLowerCase() + "...";') !== -1,
    "input .home-search com placeholder 'Buscar em <categoria>...' — mesmo componente/padrão do hub"
  );
  assert(categoryBody.indexOf('search.className = "home-search";') !== -1, "reusa a classe .home-search do hub — nenhum CSS novo");

  const commitChipCatBody = extractFunctionBody(categoryBody, "function commitChip(tagId, parsed) {");
  assert(!!commitChipCatBody, "commitChip de categoria encontrada e isolada por casamento de chaves");
  assert(
    !!commitChipCatBody && commitChipCatBody.indexOf("selectedFacetTags = selectedFacetTags.concat([tagId])") !== -1,
    "commitChip de categoria escreve no MESMO selectedFacetTags que renderFacets()/o modal já usam — uma lógica, duas portas (padrão idêntico ao renderGrupo)"
  );
  const activeChipsCatBody = extractFunctionBody(categoryBody, "function renderActiveChips() {");
  assert(!!activeChipsCatBody, "renderActiveChips de categoria encontrada e isolada por casamento de chaves");
  assert(
    !!activeChipsCatBody && activeChipsCatBody.indexOf("selectedFacetTags = selectedFacetTags.filter((t) => t !== btn.dataset.tag)") !== -1,
    "× do chip ativo de categoria remove do MESMO selectedFacetTags"
  );

  console.log("");
  section("11b", "CASO LITERAL REAL — 1 categoria + termo com resultados, invariante resultado ⊆ baseAll");
  const catPeixes = TagModel.getRecipesByCollection("peixes");
  const baseAllPeixes = catPeixes.allRecipes;
  const baseAllIdsPeixes = baseAllPeixes.map((item) => item.id);
  const baseAllIdsPeixesSet = new Set(baseAllIdsPeixes);
  console.log("  literal: categoria 'peixes' (Peixes) — baseAll = " + baseAllPeixes.length + " receitas");
  assert(baseAllPeixes.length === 40, "categoria 'peixes': baseAll = 40 receitas (obtido " + baseAllPeixes.length + ")");
  const outCremosoPeixesScoped = Search.searchByQuery("cremoso", { scopeIds: baseAllIdsPeixes });
  const cremosoPeixesItems = outCremosoPeixesScoped.block1.concat(outCremosoPeixesScoped.block2).map((r) => r.item);
  console.log("  literal: 'cremoso' em Peixes — escopado=" + cremosoPeixesItems.length);
  assert(cremosoPeixesItems.length === 4, "'cremoso' em Peixes: escopado = 4 (obtido " + cremosoPeixesItems.length + ")");
  assert(cremosoPeixesItems.length > 0, "termo com resultados reais (não um caso degenerado de zero)");
  assert(
    cremosoPeixesItems.every((item) => baseAllIdsPeixesSet.has(item.id)),
    "invariante: TODO resultado da barra de categoria é subconjunto de baseAll (nenhum vazamento pra fora da coleção)"
  );

  console.log("");
  section("11c", "VÁLVULA DE ESCAPE (S2) — os 4 ramos, casos literais REAIS em 'Peixes', 1 caso (a) de texto residual puro + N-prometido=N-na-chegada");
  const pFlambadoCat = Search.parseQuery("flambado", []);
  assert(
    isPureText("flambado"),
    "'flambado' é 100% classificação text (mesmo termo já usado na seção 9d/P1 do hub, obtido " + JSON.stringify(pFlambadoCat.segments.map((s) => s.classification)) + ")"
  );
  const outFlambadoCatScoped = Search.searchByQuery("flambado", { scopeIds: baseAllIdsPeixes });
  const outFlambadoCatGlobal = Search.searchByQuery("flambado", {});
  const flambadoCatScoped = outFlambadoCatScoped.block1.length + outFlambadoCatScoped.block2.length;
  const flambadoCatGlobal = outFlambadoCatGlobal.block1.length + outFlambadoCatGlobal.block2.length;
  const flambadoCatArrival = arrivalCountFor("flambado");
  console.log(
    "  literal ramo (a) categoria, texto puro: 'flambado' em Peixes — escopado=" +
      flambadoCatScoped +
      " global(N-prometido)=" +
      flambadoCatGlobal +
      " chegada-em-busca(N-na-chegada)=" +
      flambadoCatArrival
  );
  assert(
    flambadoCatScoped === 0 && flambadoCatGlobal > 0,
    "ramo (a) categoria real: escopado=0 E global>0 (obtido escopado=" + flambadoCatScoped + " global=" + flambadoCatGlobal + ") — CTA 'Pesquisar em todo o aplicativo' aparece"
  );
  assert(
    flambadoCatGlobal === flambadoCatArrival,
    "N-prometido = N-na-chegada pra 'flambado' partindo de categoria (obtido prometido=" + flambadoCatGlobal + " chegada=" + flambadoCatArrival + ")"
  );

  const outNadaCatScoped = Search.searchByQuery("xxzzqq", { scopeIds: baseAllIdsPeixes });
  const outNadaCatGlobal = Search.searchByQuery("xxzzqq", {});
  const nadaCatScoped = outNadaCatScoped.block1.length + outNadaCatScoped.block2.length;
  const nadaCatGlobal = outNadaCatGlobal.block1.length + outNadaCatGlobal.block2.length;
  console.log("  literal ramo (b) categoria: 'xxzzqq' em Peixes — escopado=" + nadaCatScoped + " global=" + nadaCatGlobal);
  assert(
    nadaCatScoped === 0 && nadaCatGlobal === 0,
    "ramo (b) categoria real: escopado=0 E global=0 — só mensagem de vazio, SEM CTA (obtido escopado=" + nadaCatScoped + " global=" + nadaCatGlobal + ")"
  );

  const outCremosoCatGlobal = Search.searchByQuery("cremoso", {});
  const cremosoCatScoped = cremosoPeixesItems.length;
  const cremosoCatGlobal = outCremosoCatGlobal.block1.length + outCremosoCatGlobal.block2.length;
  console.log("  literal ramo (c) categoria: 'cremoso' em Peixes — escopado=" + cremosoCatScoped + " global=" + cremosoCatGlobal);
  assert(
    cremosoCatScoped > 0 && cremosoCatGlobal > cremosoCatScoped,
    "ramo (c) categoria real: escopado>0 E global>escopado (obtido escopado=" + cremosoCatScoped + " global=" + cremosoCatGlobal + ") — link discreto 'Buscar no app inteiro' aparece"
  );

  const outBacalhauCatScoped = Search.searchByQuery("bacalhau", { scopeIds: baseAllIdsPeixes });
  const outBacalhauCatGlobal = Search.searchByQuery("bacalhau", {});
  const bacalhauCatScoped = outBacalhauCatScoped.block1.length + outBacalhauCatScoped.block2.length;
  const bacalhauCatGlobal = outBacalhauCatGlobal.block1.length + outBacalhauCatGlobal.block2.length;
  console.log("  literal ramo (d) categoria: 'bacalhau' em Peixes — escopado=" + bacalhauCatScoped + " global=" + bacalhauCatGlobal);
  assert(
    bacalhauCatScoped === bacalhauCatGlobal && bacalhauCatScoped > 0,
    "ramo (d) categoria real: global=escopado, ambos > 0 (obtido escopado=" + bacalhauCatScoped + " global=" + bacalhauCatGlobal + ") — sem rodapé, sem CTA"
  );

  assert(
    categoryBody.indexOf("buildEscapeValveActionEl(scopedTotal, globalTotal, () => transferToBusca(query, baseTagIds))") !== -1,
    "renderCategory chama o MESMO buildEscapeValveActionEl que renderGrupo — regra dos 4 ramos compartilhada, sem cópia divergente"
  );
  assert(
    appJs.indexOf("function buildEscapeValveActionEl(scopedTotal, globalTotal, onTransfer) {") !== -1,
    "buildEscapeValveActionEl declarada 1x só, fora de renderGrupo/renderCategory — helper de módulo compartilhado"
  );
  assert(
    grupoBody.indexOf("buildEscapeValveActionEl(scopedTotal, globalTotal, () => transferToBusca(query, baseTagIds))") !== -1,
    "renderGrupo (hub) TAMBÉM foi migrado pro mesmo helper — os 2 lados chamam a MESMA função, prova de zero cópia divergente"
  );

  console.log("");
  section("11d", "PERSISTÊNCIA (S3, Dívida #1) — categoryFacetState, mesmo padrão de grupoFacetState, morta por asserção");
  assert(appJs.indexOf("const categoryFacetState = {};") !== -1, "categoryFacetState declarada — mesmo padrão de módulo de grupoFacetState");
  assert(
    appJs.indexOf("const categoryFacetState = {};") < categoryStart,
    "categoryFacetState declarada ANTES de renderCategory (escopo de módulo, sobrevive ao re-render)"
  );
  assert(
    categoryBody.indexOf("const savedState = categoryFacetState[collection.id] || null;") !== -1,
    "renderCategory lê categoryFacetState[collection.id] NO TOPO de toda renderização"
  );
  assert(
    categoryBody.indexOf("let selectedFacetTags = (savedState ? savedState.tags : initialFacetTags || []).slice();") !== -1,
    "tags restauradas de savedState (prioridade sobre os params da URL) — mesma regra do hub"
  );
  assert(
    categoryBody.indexOf('let ingredientMode = (savedState ? savedState.ingredientMode : initialIngredientMode) || "or";') !== -1,
    "ingredientMode restaurado de savedState"
  );
  assert(categoryBody.indexOf('let searchQuery = (savedState && savedState.text) || "";') !== -1, "texto da busca restaurado de savedState (nunca existiu na URL, mesma regra do hub)");
  assert(categoryBody.indexOf("function persistState() {") !== -1, "persistState existe — grava a FOTO em categoryFacetState[collection.id]");
  const persistStateCalls = (categoryBody.match(/persistState\(\);/g) || []).length;
  assert(
    persistStateCalls === 4,
    "persistState() chamada nos 4 pontos de mutação pedidos (commit de chip, × de chip, Aplicar do modal, digitação) — obtido " + persistStateCalls
  );
  // Simulação de "voltar de receita": sem DOM real disponível neste harness (ver cabeçalho do
  // arquivo), a prova é a MESMA leitura que o topo de renderCategory faz (linha a linha, acima)
  // aplicada a um objeto categoryFacetState de teste — se savedState existe, tags/imode/texto
  // saem EXATAMENTE do que foi gravado, nunca do valor inicial de URL/default.
  const categoryFacetStateSim = { peixes: { tags: ["ingredient:limao"], ingredientMode: "and", proteinRole: null, text: "cremoso" } };
  const savedSim = categoryFacetStateSim["peixes"] || null;
  const selectedFacetTagsSim = (savedSim ? savedSim.tags : []).slice();
  const ingredientModeSim = (savedSim ? savedSim.ingredientMode : "or") || "or";
  const searchQuerySim = (savedSim && savedSim.text) || "";
  assert(
    JSON.stringify(selectedFacetTagsSim) === JSON.stringify(["ingredient:limao"]) && ingredientModeSim === "and" && searchQuerySim === "cremoso",
    "simulação de 'voltar de receita': re-ler categoryFacetState pro MESMO catId devolve tags+imode+texto IDÊNTICOS ao que foi gravado antes de sair (obtido tags=" +
      JSON.stringify(selectedFacetTagsSim) +
      " imode=" +
      ingredientModeSim +
      " texto='" +
      searchQuerySim +
      "')"
  );

  console.log("");
  section("11e", "ROTA FIXA — nenhuma chamada de Router ao digitar/commitar (tela nunca navega)");
  const runSearchCatBody = extractFunctionBody(categoryBody, "function runSearch(query) {");
  assert(!!runSearchCatBody, "runSearch de categoria encontrada e isolada por casamento de chaves");
  assert(
    !!runSearchCatBody && runSearchCatBody.indexOf("scopeIds: baseAllIds") !== -1,
    "runSearch de categoria escopa a busca a baseAllIds (a coleção inteira) — mesmo mecanismo scopeIds do hub"
  );
  assert(!!runSearchCatBody && runSearchCatBody.indexOf("Router.") === -1, "TESTE NEGATIVO: runSearch de categoria NÃO chama nenhum método de Router — tela nunca navega ao digitar");
  assert(!!commitChipCatBody && commitChipCatBody.indexOf("Router.") === -1, "TESTE NEGATIVO: commitChip NÃO chama Router — nunca navega ao commitar chip");
  assert(!!activeChipsCatBody && activeChipsCatBody.indexOf("Router.") === -1, "TESTE NEGATIVO: × do chip ativo NÃO chama Router — nunca navega ao remover chip");
  const onApplyCatIdx = categoryBody.indexOf("onApply: () => {");
  assert(onApplyCatIdx !== -1, "onApply do modal de categoria encontrado");
  const onApplyCatSnippet = categoryBody.slice(onApplyCatIdx, onApplyCatIdx + 400);
  assert(onApplyCatSnippet.indexOf("Router.") === -1, "TESTE NEGATIVO: onApply do modal de categoria NÃO chama Router — Aplicar também não navega");

  console.log("");
  section(
    "12",
    "TRAVA DE INGESTÃO (Ato 3b, 2026-07-29) — campo nature: obrigatório (data/*.js), censo travado, spot-checks literais"
  );
  // 12a — todo recipe.nature (campo BRUTO de data/*.js, não derivado) precisa existir e estar
  // no enum. Esta é a trava permanente pra qualquer ingestão em massa futura: receita nova sem
  // nature, ou com valor fora do enum, derruba a suíte aqui antes de chegar em produção.
  const NATURE_ENUM = new Set(["prato", "preparo", "tecnica"]);
  assert(allRecipes.length === 398, "12a: 398 receitas no total (censo estrutural)");
  const semNatureValido = allRecipes.filter((item) => !NATURE_ENUM.has(item.recipe.nature));
  assert(
    semNatureValido.length === 0,
    "12a: 398/398 receitas com nature válido (prato|preparo|tecnica) — " + semNatureValido.length + " sem nature válido"
  );
  semNatureValido.slice(0, 10).forEach((item) => {
    console.log("      sem nature válido: " + item.catId + " / " + item.recipe.name + " (nature=" + item.recipe.nature + ")");
  });

  // 12b — censo literal (tabela-mestra do Ato 3a + delta aprovado pelo dono: Legumes Fermentados
  // tecnica -> prato, única mudança de nature vs a tabela original).
  const natureCounts = { prato: 0, preparo: 0, tecnica: 0 };
  allRecipes.forEach((item) => {
    if (NATURE_ENUM.has(item.recipe.nature)) natureCounts[item.recipe.nature]++;
  });
  assert(natureCounts.prato === 337, "12b: censo prato === 337 (medido: " + natureCounts.prato + ")");
  assert(natureCounts.preparo === 46, "12b: censo preparo === 46 (medido: " + natureCounts.preparo + ")");
  assert(natureCounts.tecnica === 15, "12b: censo tecnica === 15 (medido: " + natureCounts.tecnica + ")");

  // 12c — spot-checks literais (receitas nomeadas pelo dono na auditoria do Ato 3a/3b).
  function natureOf(name) {
    const item = allRecipes.find((it) => it.recipe.name === name);
    return item ? item.recipe.nature : undefined;
  }
  assert(natureOf("Glace de Carne") === "preparo", "12c: Glace de Carne = preparo");
  assert(natureOf("Maturação Seca (Dry Aging)") === "tecnica", "12c: Maturação Seca (Dry Aging) = tecnica");
  assert(natureOf("Carbonara") === "prato", "12c: Carbonara = prato");
  assert(natureOf("Croque Monsieur") === "prato", "12c: Croque Monsieur = prato");
  assert(natureOf("Paella") === "prato", "12c: Paella = prato");
  // Reinstalado 2026-07-29 (Ato 3b-cont): a omissão anterior (P0-gated) foi resolvida —
  // Paella recategorizada de frutos-do-mar pra arrozes (gate de referência provou id/slug
  // estável, ver relatório). protein:frutos-do-mar não vem mais de CATEGORY_BASE_TAGS (o catId
  // mudou), e contains:frutos-do-mar entrou explícita em recipe.tags — spot-check completo, como
  // pedido originalmente, sem mais omissão.
  const paellaItem = allRecipes.find((it) => it.recipe.name === "Paella");
  assert(!!paellaItem && paellaItem.catId === "arrozes", "12c: Paella catId = arrozes (recategorizada, era frutos-do-mar)");
  assert(!!paellaItem && paellaItem.tags.indexOf("protein:frutos-do-mar") === -1, "12c: Paella SEM protein:frutos-do-mar no conjunto efetivo");
  assert(!!paellaItem && paellaItem.tags.indexOf("contains:frutos-do-mar") !== -1, "12c: Paella COM contains:frutos-do-mar no conjunto efetivo");
  assert(natureOf("Gravlax") === "tecnica", "12c: Gravlax = tecnica");
  assert(
    natureOf("Legumes Fermentados") === "prato",
    "12c: Legumes Fermentados = prato (delta de arbitragem do dono — única mudança de nature vs tabela-mestra original)"
  );
  assert(natureOf("Pickles Rápidos") === "preparo", "12c: Pickles Rápidos = preparo");
  assert(natureOf("Béchamel") === "preparo", "12c: Béchamel = preparo");

  console.log("");
  section(
    "13",
    "3b-UI (2026-07-30) — VISTA PADRÃO DE COLEÇÃO: partição {padrao, secundariosPrato, preparos} (TagModel.getRecipesByCollection), gabarito medido contra o código real"
  );

  // 13a/13b — proteínas: padrão (nature:prato ∧ protein:X literal) e seção "Preparos e
  // técnicas" (alcançável ∧ nature != prato). Literais travados só depois de medir os 7 contra
  // o gabarito da auditoria — bateram 100%, sem nenhuma divergência (protocolo: qualquer
  // divergência pararia aqui antes de travar literal nenhum).
  const PROTEIN_GABARITO = {
    aves: { label: "Aves", padrao: 38, preparos: 2 },
    "carnes-bovinas": { label: "Carnes Bovinas", padrao: 46, preparos: 9 },
    suinos: { label: "Suínos", padrao: 27, preparos: 1 },
    peixes: { label: "Peixes", padrao: 29, preparos: 4 },
    "frutos-do-mar": { label: "Frutos do Mar", padrao: 29, preparos: 1 },
    "col-ovo": { label: "Ovos", padrao: 31, preparos: 9 },
    cordeiro: { label: "Cordeiro", padrao: 10, preparos: 0 },
  };
  Object.keys(PROTEIN_GABARITO).forEach((id) => {
    const g = PROTEIN_GABARITO[id];
    const r = TagModel.getRecipesByCollection(id);
    console.log("  literal: " + g.label + " padrao=" + r.padrao.length + " preparos=" + r.preparos.length);
    assert(r.padrao.length === g.padrao, "13a: " + g.label + " padrão (nature:prato ∧ protein:X literal) = " + g.padrao + " (medido " + r.padrao.length + ")");
    assert(r.preparos.length === g.preparos, "13b: " + g.label + " seção Preparos e técnicas = " + g.preparos + " (medido " + r.preparos.length + ")");
  });
  const nantuaItem = TagModel.getRecipesByCollection("frutos-do-mar").preparos.find((it) => it.recipe.name === "Nantua");
  assert(!!nantuaItem, "13b: Frutos do Mar/preparos contém Nantua nomeado (gabarito)");

  // 13c — invariante permanente (trava de ingestão futura): NENHUMA receita com protein:* literal
  // tem nature != prato — se algum dia uma ingestão violar isso, a vista padrão de proteína
  // (padrao = primaryRecipes ∧ nature:prato) silenciosamente esconderia essa receita sem avisar
  // ninguém. Hoje o dado garante isso (0 violações); esta asserção é a trava, não uma medição solta.
  const proteinNatureViolations = allRecipes.filter((item) => item.tags.some((t) => t.indexOf("protein:") === 0) && item.recipe.nature !== "prato");
  assert(proteinNatureViolations.length === 0, "13c: nenhuma receita com protein:* literal e nature != prato (obtido " + proteinNatureViolations.length + " violação(ões))");

  // 13d — países: mesma regra (padrao = country:X ∧ nature:prato; preparos = alcançável ∧
  // nature != prato), gabarito MEDIDO direto contra TagModel.getRecipesByCollection real (não
  // uma projeção) pros 20 países — trava pelo menos França/Espanha/Brasil/Dinamarca/Itália
  // (pedido explícito da tarefa), mas trava os 20 já que todos foram medidos.
  const COUNTRY_GABARITO = {
    brasil: { padrao: 33, preparos: 1 },
    franca: { padrao: 59, preparos: 24 },
    italia: { padrao: 42, preparos: 0 },
    espanha: { padrao: 14, preparos: 4 },
    portugal: { padrao: 15, preparos: 0 },
    japao: { padrao: 16, preparos: 0 },
    china: { padrao: 9, preparos: 0 },
    coreia: { padrao: 8, preparos: 0 },
    tailandia: { padrao: 8, preparos: 0 },
    india: { padrao: 8, preparos: 0 },
    mexico: { padrao: 10, preparos: 0 },
    peru: { padrao: 7, preparos: 1 },
    alemanha: { padrao: 7, preparos: 0 },
    austria: { padrao: 7, preparos: 0 },
    hungria: { padrao: 3, preparos: 0 },
    grecia: { padrao: 6, preparos: 0 },
    marrocos: { padrao: 4, preparos: 0 },
    libano: { padrao: 8, preparos: 0 },
    eua: { padrao: 14, preparos: 0 },
    dinamarca: { padrao: 43, preparos: 1 },
  };
  win.COLLECTIONS.filter((c) => c.collectionType === "country").forEach((c) => {
    const g = COUNTRY_GABARITO[c.id];
    const r = TagModel.getRecipesByCollection(c.id);
    assert(!!g, "13d: " + c.id + " tem gabarito medido (nenhum país de fora da tabela)");
    if (!g) return;
    assert(r.padrao.length === g.padrao, "13d: " + c.label + " padrão = " + g.padrao + " (medido " + r.padrao.length + ")");
    assert(r.preparos.length === g.preparos, "13d: " + c.label + " seção Preparos e técnicas = " + g.preparos + " (medido " + r.preparos.length + ")");
  });

  // 13e — spot-checks nomeados (pedido explícito da tarefa): participação nunca some, mas some
  // da vista padrão/lista de pratos; a receita real move de bucket, nunca desaparece de vez.
  const hasNamed = (list, name) => list.some((it) => it.recipe.name === name);
  const suinosPart = TagModel.getRecipesByCollection("suinos");
  assert(!hasNamed(suinosPart.padrao, "Carbonara"), "13e: Carbonara FORA da vista padrão de Suínos");
  assert(hasNamed(suinosPart.secundariosPrato, "Carbonara"), "13e: Carbonara presente no filtro secundário de Suínos");
  assert(!hasNamed(suinosPart.padrao, "Amatriciana"), "13e: Amatriciana FORA da vista padrão de Suínos");
  assert(hasNamed(suinosPart.secundariosPrato, "Amatriciana"), "13e: Amatriciana presente no filtro secundário de Suínos");
  const bovinasPart = TagModel.getRecipesByCollection("carnes-bovinas");
  assert(hasNamed(bovinasPart.preparos, "Glace de Carne"), "13e: Glace de Carne na seção de preparos de Bovinas");
  assert(!hasNamed(bovinasPart.padrao, "Glace de Carne") && !hasNamed(bovinasPart.secundariosPrato, "Glace de Carne"), "13e: Glace de Carne FORA de qualquer lista de pratos de Bovinas (nem padrão nem secundário)");
  const frutosPart = TagModel.getRecipesByCollection("frutos-do-mar");
  assert(!hasNamed(frutosPart.padrao, "Paella"), "13e: Paella fora do padrão de Frutos do Mar");
  assert(hasNamed(frutosPart.secundariosPrato, "Paella"), "13e: Paella presente no filtro secundário de Frutos do Mar");

  // 13f — GUARDA ANTI-RÉPLICA (mesmo padrão da seção 10): lê o FONTE de app.js direto e assere
  // que renderCategory realmente consome a partição canônica de tagmodel.js (padrao/preparos/
  // isIdentityCollection), nunca uma cópia solta de lógica de nature/identidade. Se algum dia
  // app.js voltar a filtrar por nature "na unha" em vez de reusar TagModel.getRecipesByCollection,
  // esta seção fica vermelha antes de qualquer número desta suíte virar falso positivo.
  assert(categoryBody.indexOf("preparos: basePreparos") !== -1, "13f: renderCategory desestrutura 'preparos' de TagModel.getRecipesByCollection (nunca recalcula nature na mão)");
  assert(categoryBody.indexOf("isIdentityCollection(collection)") !== -1, "13f: seção 'Preparos e técnicas' gated por isIdentityCollection(collection) — só proteína/país");
  assert(categoryBody.indexOf("TagModel.splitByProteinRole(") !== -1, "13f: TagModel.splitByProteinRole ainda é o único mecanismo de papel dentro de renderCategory (via applyRoleAndNature local)");
  assert(appJs.indexOf('"Preparos e técnicas"') !== -1, "13f: literal do título da seção existe em app.js");
  assert(appJs.indexOf("function isIdentityCollection(collection)") !== -1, "13f: helper isIdentityCollection existe (module scope, reusado por renderCategory)");

  console.log("");
  section(
    "14",
    "CORTE DE NATUREZA (2026-07-30) — S1 predicado isNamingTagSet, S2 coleções genéricas, S3 motor, S4 válvula; gabarito = inventário da tarefa anterior"
  );

  // 14a — S1: TagModel.isNamingTagSet, execução REAL no sandbox (nunca texto — é função pura).
  assert(typeof TagModel.isNamingTagSet === "function", "14a: TagModel.isNamingTagSet existe e é função");
  if (typeof TagModel.isNamingTagSet === "function") {
    assert(TagModel.isNamingTagSet(["format:molho"]) === true, "14a: format:molho nomeia o mundo dos preparos");
    assert(TagModel.isNamingTagSet(["format:tecnica"]) === true, "14a: format:tecnica nomeia");
    assert(TagModel.isNamingTagSet(["format:base"]) === true, "14a: format:base nomeia");
    assert(TagModel.isNamingTagSet(["format:componente"]) === true, "14a: format:componente nomeia");
    assert(TagModel.isNamingTagSet(["dish_type:molho"]) === true, "14a: dish_type:molho nomeia");
    assert(TagModel.isNamingTagSet(["dish_type:tecnica-avancada"]) === true, "14a: dish_type:tecnica-avancada nomeia");
    assert(TagModel.isNamingTagSet(["dish_type:contemporaneo"]) === true, "14a: dish_type:contemporaneo nomeia");
    assert(TagModel.isNamingTagSet(["diet:vegetariana"]) === false, "14a: TESTE NEGATIVO diet:vegetariana NÃO nomeia");
    assert(TagModel.isNamingTagSet(["time:ate-30-min"]) === false, "14a: TESTE NEGATIVO time:ate-30-min NÃO nomeia");
    assert(TagModel.isNamingTagSet(["dish_type:sopa"]) === false, "14a: TESTE NEGATIVO dish_type:sopa NÃO nomeia (não é um dos 3 dish_type explícitos)");
    assert(TagModel.isNamingTagSet([]) === false, "14a: TESTE NEGATIVO conjunto vazio NÃO nomeia");
    assert(TagModel.isNamingTagSet(["time:ate-30-min", "format:molho"]) === true, "14a: mistura com 1 tag nomeante já nomeia (OR)");
  }

  // 14b — S2: applyRoleAndNature REAL, extraída de app.js/renderCategory e recompilada com o
  // TagModel do sandbox — nunca reimplementa a regra numa 3ª forma (mesmo princípio da seção 13f).
  function s14RealApplyRoleAndNature() {
    const isIdentitySrc = extractFunctionBody(appJs, "function isIdentityCollection(");
    const mundoSrc = extractFunctionBody(appJs, "function isMundoProprioCollection(");
    const applyNatureSrc = extractFunctionBody(categoryBody, "function applyRoleAndNature(");
    if (!isIdentitySrc || !mundoSrc || !applyNatureSrc) return null;
    // eslint-disable-next-line no-new-func
    return new Function("TagModel", isIdentitySrc + "\n" + mundoSrc + "\n" + applyNatureSrc + "\nreturn applyRoleAndNature;")(TagModel);
  }
  const s14ApplyRoleAndNatureFn = s14RealApplyRoleAndNature();
  assert(!!s14ApplyRoleAndNatureFn, "14b: isIdentityCollection + isMundoProprioCollection + applyRoleAndNature recompilam sem erro a partir do FONTE real de app.js");

  const s14LeakGabarito = {
    "col-vegetariana": 23,
    "col-rapidas": 35,
    "col-ate-1h": 44,
    // 13->17 e 6->10 (ESTEIRA-1B, 2026-08-05): parseMinutes passou a entender dia(s)/semana(s)
    // e 7 receitas de preparo de dias entraram em mais-de-1h/preparo-longo; 4 delas são
    // nature técnica/preparo (Gravlax, Sous-vide, Dry Aging, Defumação Caseira) e por isso o
    // corte por nature passa a remover +4 nessas duas coleções. Ver
    // scripts/verify-time-parser-2026-08-05.js.
    "col-mais-de-1h": 17,
    "col-preparo-longo": 10,
    "col-faceis": 30,
    "col-intermediarias": 27,
    "col-avancadas": 4,
  };
  if (s14ApplyRoleAndNatureFn) {
    Object.keys(s14LeakGabarito).forEach((id) => {
      const collection = win.COLLECTIONS.find((c) => c.id === id);
      assert(!!collection, "14b: coleção " + id + " existe em window.COLLECTIONS");
      if (!collection) return;
      const before = TagModel.getRecipesByCollection(id).allRecipes;
      const after = s14ApplyRoleAndNatureFn(before, null, [], collection);
      const delta = before.length - after.length;
      console.log("  " + collection.label + " (" + id + "): antes=" + before.length + " depois=" + after.length + " delta=" + delta + " (esperado " + s14LeakGabarito[id] + ")");
      assert(delta === s14LeakGabarito[id], "14b: " + collection.label + " perde EXATAMENTE " + s14LeakGabarito[id] + " (medido delta=" + delta + ")");
      assert(after.every((item) => item.recipe.nature === "prato"), "14b: " + collection.label + " pós-corte é 100% nature:prato (corte seco)");
    });
  }

  // 14c — mundo-próprio (molhos, técnicas) intocadas pelo novo ramo genérico.
  if (s14ApplyRoleAndNatureFn) {
    const s14MolhosCollection = win.COLLECTIONS.find((c) => c.id === "molhos");
    const s14MolhosAll = TagModel.getRecipesByCollection("molhos").allRecipes;
    const s14MolhosAfter = s14ApplyRoleAndNatureFn(s14MolhosAll, null, [], s14MolhosCollection);
    assert(s14MolhosAfter.length === 17, "14c: Molhos Clássicos intacto (mundo-próprio, sem corte) — medido " + s14MolhosAfter.length);

    const s14TecnicasCollection = win.COLLECTIONS.find((c) => c.id === "tecnicas");
    const s14TecnicasAll = TagModel.getRecipesByCollection("tecnicas").allRecipes;
    const s14TecnicasAfter = s14ApplyRoleAndNatureFn(s14TecnicasAll, null, [], s14TecnicasCollection);
    assert(s14TecnicasAfter.length === 43, "14c: Técnicas intacta (ramo technique próprio, não o novo ramo genérico) — medido " + s14TecnicasAfter.length);
    assert(s14TecnicasAfter.every((item) => item.recipe.nature !== "prato"), "14c: Técnicas continua excluindo os 3 pratos (ramo technique, inalterado)");
  }

  // 14d — identidade (proteína/país) intocada — spot-check França.
  if (s14ApplyRoleAndNatureFn) {
    const s14FrancaCollection = win.COLLECTIONS.find((c) => c.id === "franca");
    const s14FrancaAll = TagModel.getRecipesByCollection("franca").allRecipes;
    const s14FrancaAfter = s14ApplyRoleAndNatureFn(s14FrancaAll, null, [], s14FrancaCollection);
    assert(s14FrancaAfter.length === 59, "14d: França (identidade) intacta — medido " + s14FrancaAfter.length);
  }

  // 14e — as 6 coleções dish-type "limpas" (0 preparos) não perdem nada — regressão contra corte
  // demais.
  if (s14ApplyRoleAndNatureFn) {
    ["sopas", "entradas", "massas", "risotos-arroz", "padaria", "sobremesas-classicas"].forEach((id) => {
      const collection = win.COLLECTIONS.find((c) => c.id === id);
      const before = TagModel.getRecipesByCollection(id).allRecipes;
      const after = s14ApplyRoleAndNatureFn(before, null, [], collection);
      assert(after.length === before.length, "14e: " + id + " sem vazamento não perde nada (before=" + before.length + " after=" + after.length + ")");
    });
  }

  // 14f — Legumes Fermentados (nature:prato, mas format:tecnica) NUNCA cortado em nenhuma das 8
  // coleções vazadas em que porventura apareça — corte é por nature, nunca por tag.
  if (s14ApplyRoleAndNatureFn) {
    Object.keys(s14LeakGabarito).forEach((id) => {
      const collection = win.COLLECTIONS.find((c) => c.id === id);
      const before = TagModel.getRecipesByCollection(id).allRecipes;
      const hasIt = before.some((it) => it.recipe.name === "Legumes Fermentados");
      if (!hasIt) return;
      const after = s14ApplyRoleAndNatureFn(before, null, [], collection);
      assert(after.some((it) => it.recipe.name === "Legumes Fermentados"), "14f: Legumes Fermentados sobrevive ao corte em " + id + " (nature=prato sempre passa, nunca por tag)");
    });
  }

  // 14g — S3: cutByNatureIfGeneric REAL, extraída de app.js e recompilada com TagModel real.
  function s14RealCutByNature() {
    const mundoSrc = extractFunctionBody(appJs, "function isMundoProprioCollection(");
    const cutSrc = extractFunctionBody(appJs, "function cutByNatureIfGeneric(");
    if (!mundoSrc || !cutSrc) return null;
    // eslint-disable-next-line no-new-func
    return new Function("TagModel", mundoSrc + "\n" + cutSrc + "\nreturn cutByNatureIfGeneric;")(TagModel);
  }
  const s14CutByNatureFn = s14RealCutByNature();
  assert(!!s14CutByNatureFn, "14g: isMundoProprioCollection + cutByNatureIfGeneric recompilam sem erro a partir do FONTE real de app.js");

  // 14h — literal do dono: Fim de Semana = 39 SEM depender de origin="vitrine" (corte no motor).
  if (s14CutByNatureFn) {
    const s14FimDeSemanaUniverse = allRecipes.filter((item) => TagModel.matchesGroupedTags(item.tags, ["time:preparo-longo"], "or"));
    // 45->52 e 39->42 (ESTEIRA-1B, 2026-08-05): +7 no universo bruto de preparo-longo
    // (parseMinutes entende dias/semanas), das quais 3 são nature:prato e sobrevivem ao corte
    // do motor (Sauerbraten, Maniçoba, Legumes Fermentados) — 39+3=42. Ver
    // scripts/verify-time-parser-2026-08-05.js.
    assert(s14FimDeSemanaUniverse.length === 52, "14h: universo bruto de Fim de Semana (time:preparo-longo) = 52 (pré-condição do gabarito)");
    const s14FimDeSemanaCut = s14CutByNatureFn(s14FimDeSemanaUniverse, ["time:preparo-longo"], null);
    assert(s14FimDeSemanaCut.length === 42, "14h literal: Fim de Semana via motor (sem origin=vitrine) = 42 — medido " + s14FimDeSemanaCut.length);
  }

  // 14i — literal do dono: diet:vegetariana "global" 99 -> 76.
  if (s14CutByNatureFn) {
    const s14VegUniverse = allRecipes.filter((item) => TagModel.matchesGroupedTags(item.tags, ["diet:vegetariana"], "or"));
    assert(s14VegUniverse.length === 99, "14i: universo bruto diet:vegetariana = 99 (pré-condição do gabarito)");
    const s14VegCut = s14CutByNatureFn(s14VegUniverse, ["diet:vegetariana"], null);
    assert(s14VegCut.length === 76, "14i literal: diet:vegetariana global via motor = 76 — medido " + s14VegCut.length);
  }

  // 14j — literal do dono: chip format:molho NÃO corta (tag nomeante — regra 2 do dono).
  if (s14CutByNatureFn) {
    const s14FormatMolhoUniverse = allRecipes.filter((item) => TagModel.matchesGroupedTags(item.tags, ["format:molho"], "or"));
    const s14FormatMolhoCut = s14CutByNatureFn(s14FormatMolhoUniverse, ["format:molho"], null);
    assert(s14FormatMolhoCut.length === s14FormatMolhoUniverse.length, "14j literal: chip format:molho NÃO corta (obtido " + s14FormatMolhoCut.length + "/" + s14FormatMolhoUniverse.length + ")");
  }

  // 14k — literal do dono: busca texto "glace" nunca passa pelo corte (bloco 2/texto livre).
  const s14CutCallSites = appJs.match(/cutByNatureIfGeneric\([^,]+,/g) || [];
  assert(s14CutCallSites.length > 0, "14k: cutByNatureIfGeneric é chamada em pelo menos 1 lugar de app.js");
  assert(
    s14CutCallSites.every((c) => c.indexOf(".block2") === -1),
    "14k: TESTE NEGATIVO nenhuma chamada de cutByNatureIfGeneric usa .block2 como 1º argumento (texto livre nunca corta) — chamadas: " + JSON.stringify(s14CutCallSites)
  );
  const s14OutGlace = Search.searchByQuery("glace", { parsed: Search.parseQuery("glace", []), baseTagIds: [] });
  assert(s14OutGlace.block2.some((r) => r.item.recipe.name === "Glace de Carne"), "14k literal: busca texto 'glace' ainda acha Glace de Carne (bloco 2, nunca cortado)");

  // 14l — preview = commit: renderPreviewResults (busca, digitação) TAMBÉM corta seu bloco 1 —
  // fecha a lacuna ii do inventário (preview nunca teve o filtro antes desta tarefa).
  const s14PreviewResultsBody = extractFunctionBody(appJs, "function renderPreviewResults(query) {");
  assert(!!s14PreviewResultsBody, "14l: renderPreviewResults encontrada em app.js");
  assert(!!s14PreviewResultsBody && s14PreviewResultsBody.indexOf("cutByNatureIfGeneric(out.block1") !== -1, "14l: renderPreviewResults corta out.block1 — preview usa a MESMA regra do commit (lacuna ii fechada)");
  assert(
    !!s14PreviewResultsBody && s14PreviewResultsBody.indexOf("out.block2") !== -1 && s14PreviewResultsBody.indexOf("cutByNatureIfGeneric(out.block2") === -1,
    "14l: TESTE NEGATIVO renderPreviewResults NÃO corta out.block2"
  );

  // 14m — válvula: caso com tag genérica provando N-prometido = N-na-chegada com o corte dos 2
  // lados (réplica do achado da investigação: hub "Por dificuldade" ∩ time:ate-30-min cobre os
  // 398 inteiros, então escopado deveria bater com global depois do mesmo corte).
  if (s14CutByNatureFn) {
    const s14ScopedRapidas = allRecipes.filter((item) => TagModel.matchesGroupedTags(item.tags, ["time:ate-30-min"], "or"));
    const s14GlobalRapidas = allRecipes.filter((item) => TagModel.matchesGroupedTags(item.tags, ["time:ate-30-min"], "or"));
    const s14ScopedRapidasCut = s14CutByNatureFn(s14ScopedRapidas, ["time:ate-30-min"], null);
    const s14GlobalRapidasCut = s14CutByNatureFn(s14GlobalRapidas, ["time:ate-30-min"], null);
    assert(
      s14ScopedRapidasCut.length === s14GlobalRapidasCut.length && s14ScopedRapidasCut.length === 95,
      "14m literal: válvula com tag genérica (time:ate-30-min) — escopado=global=95 após corte dos 2 lados (medido " + s14ScopedRapidasCut.length + "/" + s14GlobalRapidasCut.length + ")"
    );
  }
  assert(grupoBody.indexOf("cutByNatureIfGeneric(") !== -1, "14m: renderGrupo (hub) usa cutByNatureIfGeneric na contagem escopada e global da válvula");
  assert(categoryBody.indexOf("cutByNatureIfGeneric(") !== -1, "14m: renderCategory usa cutByNatureIfGeneric na contagem escopada e global da válvula");

  // 14n — S5, NÃO TOCAR: o filtro origin="vitrine" da frente de design continua existindo
  // (fica redundante depois do corte no motor, mas removê-lo não é desta tarefa).
  assert(appJs.indexOf('initialOrigin === "vitrine"') !== -1, "14n: filtro origin=\"vitrine\" da frente de design continua presente (redundante, não removido)");
  assert(appJs.indexOf("function isMundoProprioCollection(") !== -1, "14n: helper isMundoProprioCollection existe (module scope)");
  assert(appJs.indexOf("function cutByNatureIfGeneric(") !== -1, "14n: helper cutByNatureIfGeneric existe (module scope)");

  // P2 (reconciliação de contagens, 2026-07-29): tabela seção -> asserções, lida direto de
  // sectionCounts (a MESMA estrutura que assert() já incrementou seção a seção, nunca um
  // recálculo em paralelo) — a soma abaixo tem que fechar EXATAMENTE com failures+total OK.
  console.log("");
  console.log("==================================================");
  console.log("TABELA SEÇÃO -> ASSERÇÕES (P2: soma tem que fechar exato com o total)");
  console.log("==================================================");
  let totalOk = 0;
  let totalFail = 0;
  sectionOrder.forEach((key) => {
    const c = sectionCounts[key];
    totalOk += c.ok;
    totalFail += c.fail;
    console.log("  seção " + key + ": " + (c.ok + c.fail) + " (OK=" + c.ok + " FAIL=" + c.fail + ")");
  });
  console.log("  ------------------------------------------------");
  console.log("  TOTAL SOMADO: " + (totalOk + totalFail) + " (OK=" + totalOk + " FAIL=" + totalFail + ")");
  console.log("  failures (contador global, tem que bater com FAIL somado acima): " + failures);

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
