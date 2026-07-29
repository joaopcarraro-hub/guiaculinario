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
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
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

  console.log("==================================================");
  console.log("1. 'carn' GLOBAL — resultado > 0, superconjunto do bloco2 de 'carne'");
  console.log("==================================================");
  const outCarn = Search.searchByQuery("carn", {});
  const outCarne = Search.searchByQuery("carne", {});
  console.log("  literal: carn.block2=" + outCarn.block2.length + " carne.block2=" + outCarne.block2.length);
  assert(outCarn.block2.length > 0, "'carn' produz resultado (obtido " + outCarn.block2.length + ")");
  const idsCarn = new Set(outCarn.block2.map((r) => r.item.id));
  const isSuperset = outCarne.block2.every((r) => idsCarn.has(r.item.id));
  assert(isSuperset, "'carn'.block2 é superconjunto de 'carne'.block2 (carn=" + outCarn.block2.length + " >= carne=" + outCarne.block2.length + ")");

  console.log("");
  console.log("==================================================");
  console.log("2. 'frutos' NOS 3 ESCOPOS (null, Proteínas, Fundamentos) — S6.1: escopo de hub = UNIÃO (categoria + tile)");
  console.log("==================================================");
  const proteinFrutosIds = new Set(allRecipes.filter((r) => r.tags.indexOf("protein:frutos-do-mar") !== -1).map((r) => r.id));
  assert(proteinFrutosIds.size === 30, "base real: protein:frutos-do-mar = 30 receitas (obtido " + proteinFrutosIds.size + ")");
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
  console.log("==================================================");
  console.log("2b. ASSERÇÃO NOVA (S6.1) — barra 'frutos'/Proteínas contém TUDO que o tile 'Frutos do Mar' abre");
  console.log("==================================================");
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
  console.log("==================================================");
  console.log("3. 'molho' vs 'molhos' COM ESCOPO FUNDAMENTOS — contagens IGUAIS (mata bug indexOf invertido)");
  console.log("==================================================");
  const outMolho = Search.searchByQuery("molho", { scopeIds: scopeFundamentos });
  const outMolhos = Search.searchByQuery("molhos", { scopeIds: scopeFundamentos });
  const totalMolho = outMolho.block1.length + outMolho.block2.length;
  const totalMolhos = outMolhos.block1.length + outMolhos.block2.length;
  console.log("  literal: molho=" + totalMolho + " molhos=" + totalMolhos);
  assert(totalMolho === totalMolhos, "'molho' e 'molhos' dão a MESMA contagem no escopo Fundamentos (molho=" + totalMolho + " molhos=" + totalMolhos + ")");
  assert(totalMolho > 0, "e essa contagem não é zero (obtido " + totalMolho + ")");

  console.log("");
  console.log("==================================================");
  console.log("4. 'leite' COM ESCOPO PROTEÍNAS E FUNDAMENTOS — literais pós-S6.1 (>=11 e >=33)");
  console.log("==================================================");
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
  console.log("==================================================");
  console.log("5. 'ovo' -> auto dish_type:ovo ; 'ovos' -> auto protein:ovo (inalterado)");
  console.log("==================================================");
  const pOvo = Search.parseQuery("ovo", []);
  const pOvos = Search.parseQuery("ovos", []);
  assert(pOvo.autoTagIds.indexOf("dish_type:ovo") !== -1, "'ovo' -> auto dish_type:ovo (obtido " + JSON.stringify(pOvo.autoTagIds) + ")");
  assert(pOvos.autoTagIds.indexOf("protein:ovo") !== -1, "'ovos' -> auto protein:ovo (obtido " + JSON.stringify(pOvos.autoTagIds) + ")");

  console.log("");
  console.log("==================================================");
  console.log("6. cafe/café/CAFE IDÊNTICOS — normalização única (também no caminho do hub)");
  console.log("==================================================");
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
  console.log("==================================================");
  console.log("7. OS 21 TERMOS-GUARDA — nenhum auto-colapso, escopo null E os 5 escopos de hub (S6.1: re-executado com o escopo novo, união)");
  console.log("==================================================");
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
  console.log("==================================================");
  console.log("8. PREFIXO NÃO CONTAMINA AUTO — 'carn' e 'fru' nunca viram tag automática");
  console.log("==================================================");
  const pCarn = Search.parseQuery("carn", []);
  const pFru = Search.parseQuery("fru", []);
  assert(pCarn.autoTagIds.length === 0, "'carn' autoTagIds = [] (obtido " + JSON.stringify(pCarn.autoTagIds) + ")");
  assert(pFru.autoTagIds.length === 0, "'fru' autoTagIds = [] (obtido " + JSON.stringify(pFru.autoTagIds) + ")");
  assert(pCarn.segments[0] && pCarn.segments[0].classification === "optional", "'carn' vira chip OPCIONAL, nunca auto (obtido " + pCarn.segments[0].classification + ")");
  const carneChips = Search.parseQuery("carne", []).segments[0].chipTagIds.slice().sort();
  const carnChips = pCarn.segments[0].chipTagIds.slice().sort();
  assert(JSON.stringify(carnChips) === JSON.stringify(carneChips), "'carn' herda os MESMOS chips que 'carne' sugere (" + JSON.stringify(carnChips) + ")");

  console.log("");
  console.log("==================================================");
  console.log("9. ROTA DO CHIP DE HUB — hash gerado por Router.toBusca([tag]) no formato esperado");
  console.log("==================================================");
  const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
  const grupoStart = appJs.indexOf("function renderGrupo(grupoId) {");
  const grupoEnd = appJs.indexOf("\n  // ---------- Home ----------", grupoStart);
  const grupoBody = appJs.slice(grupoStart, grupoEnd);
  assert(grupoBody.includes('Router.toBusca([btn.dataset.tag], [])'), "chip de hub chama Router.toBusca([tag], []) (fluxo existente, sem novo caminho de navegação)");
  const buildBuscaPath = loadBuildBuscaPath();
  const built = buildBuscaPath(["protein:boi"], [], "or", null, null);
  console.log("  literal: buildBuscaPath(['protein:boi']) = '" + built + "'");
  assert(built === "busca?tags=protein%3Aboi", "buildBuscaPath(['protein:boi']) produz o path esperado (obtido '" + built + "')");

  console.log("");
  console.log("==================================================");
  console.log("10. GUARDA ANTI-RÉPLICA (S6.1/P2) — renderGrupo usa TagModel.getRecipesByCollection (a MESMA função do tile) em UNIÃO com o caminho por categoria, direto no FONTE de app.js");
  console.log("==================================================");
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
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
