// scripts/verify-recipe-name-pt-2026-07-24.js
//
// Suíte de verificação dos renomes de recipe.name pra português (2026-07-24, ver skill
// recipe-data-quality). Duas levas: leva 1 (commit dece1cb, 25 renomes) e leva 2 (regra final
// "conhecido no BR por esse nome, ou nome próprio -> mantém; senão traduz", 70 renomes — 6 deles
// são os MESMOS risotos da leva 1, renomeados de novo, exigindo migração ENCADEADA). Roda o
// CÓDIGO REAL (categories.js, derivation-dict.js, tags.js, data/*.js, tagmodel.js, storage.js,
// router.js) via `new Function`, com localStorage mockado em memória — não precisa de navegador.
// `git show <BASE_COMMIT>:` carrega o estado ANTES da leva 2 (= depois da leva 1) pra comparar
// tags sem depender de git stash (não altera a working tree). BASE_COMMIT é fixo (dece1cb, o
// commit imediatamente anterior à leva 2) em vez de HEAD: rodar a suíte de novo depois de mais
// commits com HEAD teria carregado o estado JÁ RENOMEADO como "antes", fazendo a Seção 3 inteira
// falhar por não achar o nome antigo em nenhuma árvore (achado 2026-07-24 rodando a suíte de novo
// após 3 commits não-relacionados terem avançado HEAD).
//
// `node scripts/verify-recipe-name-pt-2026-07-24.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const JS_DIR = path.join(ROOT, "js");
// Commit imediatamente anterior à leva 2 (= estado logo após a leva 1). Fixo de propósito — ver
// comentário no topo do arquivo sobre por que não pode ser HEAD.
const BASE_COMMIT = "dece1cb1f8cf334fc978228cb3ac3e908d690b9c";

function runInSandbox(sandbox, code) {
  // eslint-disable-next-line no-new-func
  new Function("window", code)(sandbox.window);
}

// ---------- pipeline ATUAL (working tree, pós leva 2) ----------
function loadCurrentPipeline() {
  const sandbox = { window: {} };
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "countries.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "categories.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(DATA_DIR, "derivation-dict.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tags.js"), "utf8"));
  fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".js") && f !== "derivation-dict.js" && f !== "shopping-dict.js")
    .forEach((f) => runInSandbox(sandbox, fs.readFileSync(path.join(DATA_DIR, f), "utf8")));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tagmodel.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "search.js"), "utf8"));
  return sandbox.window;
}

// ---------- pipeline de ANTES da leva 2 (git show BASE_COMMIT: = depois da leva 1/dece1cb), só
// tags+ids, sem tocar a working tree ----------
function loadPreviousPipeline() {
  const sandbox = { window: {} };
  function loadFromBase(relPath) {
    const code = execSync("git show " + BASE_COMMIT + ":" + relPath.split(path.sep).join("/"), { cwd: ROOT, encoding: "utf8" });
    runInSandbox(sandbox, code);
  }
  loadFromBase("js/categories.js");
  loadFromBase("data/derivation-dict.js");
  loadFromBase("js/tags.js");
  const dataFilesAtBase = execSync("git ls-tree -r --name-only " + BASE_COMMIT + " -- data/", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f.endsWith(".js") && !f.endsWith("derivation-dict.js") && !f.endsWith("shopping-dict.js"));
  dataFilesAtBase.forEach(loadFromBase);
  loadFromBase("js/tagmodel.js");
  return sandbox.window;
}

// ---------- mock de localStorage em memória, pra rodar storage.js real fora do navegador ----------
function makeLocalStorageMock() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    _dump: () => JSON.parse(JSON.stringify(store)),
  };
}

// Carrega storage.js real contra um TagModel real (pro getIdForCatAndName do migrateOldId
// funcionar) e um localStorage mockado — devolve window.Storage pronto pra uso.
function loadStorageAgainst(pipelineWindow, mockLocalStorage) {
  const sandbox = { window: Object.assign({}, pipelineWindow) };
  global.localStorage = mockLocalStorage; // bare global — storage.js usa localStorage sem "window." (convenção do arquivo)
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "storage.js"), "utf8"));
  return sandbox.window.Storage;
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

// Leva 2 (2026-07-24, regra final) — [catId, nome ANTES da leva 2 (= estado em BASE_COMMIT/
// dece1cb), nome DEPOIS]. Os 6 risotos aqui já tinham sido renomeados na leva 1 (Risotto X ->
// Risoto X); os outros 64 são primeiro rename.
const RENAMES = [
  ["aves", "Magret de Canard", "Magret de Pato"],
  ["carnes-bovinas", "Bife à Parmigiana", "Bife à Parmegiana"],
  ["carnes-bovinas", "Steak Diane", "Bife Diane"],
  ["carnes-bovinas", "Steak au Poivre", "Bife à Pimenta"],
  ["china", "Hot Pot (Fondue Chinês)", "Fondue Chinês"],
  ["china", "Kung Pao Chicken", "Frango Kung Pao"],
  ["china", "Wonton Soup", "Sopa de Wonton"],
  ["coreia", "Kimchi Fried Rice (Kimchi Bokkeumbap)", "Arroz Frito com Kimchi (Kimchi Bokkeumbap)"],
  ["entradas-frias", "Steak Tartare", "Tartar de Carne"],
  ["franca", "Blanquette de Veau", "Blanquette de Vitela"],
  ["franca", "Navarin d'Agneau", "Navarin de Cordeiro"],
  ["frutos-do-mar", "Moules Marinières", "Mexilhões à Marinheira"],
  ["ovos-classicos", "Oeufs en Cocotte à la Forestière", "Ovos en Cocotte à la Forestière"],
  ["ovos-classicos", "Œufs Mayonnaise", "Ovos com Maionese"],
  ["risotos", "Risoto ai Frutti di Mare", "Risoto de Frutos do Mar"],
  ["risotos", "Risoto ai Funghi", "Risoto de Cogumelos"],
  ["risotos", "Risoto al Limone", "Risoto de Limão"],
  ["risotos", "Risoto al Parmigiano", "Risoto de Parmesão"],
  ["risotos", "Risoto alla Barbabietola (Beterraba)", "Risoto de Beterraba"],
  ["risotos", "Risoto alla Zucca (Abóbora)", "Risoto de Abóbora"],
  ["tecnicas-contemporaneas-2", "Glace de Viande", "Glace de Carne"],
  ["molhos", "Sauce Tomate", "Molho de Tomate"],
  ["molhos", "Vin Blanc", "Molho de Vinho Branco"],
  ["molhos", "Jus de Viande", "Caldo de Carne"],
  ["molhos", "Sauce Robert", "Molho Robert"],
  ["contemporaneos", "Beurre Monté", "Manteiga Montada"],
  ["alemanha", "Kartoffelsalat", "Salada de Batata"],
  ["italia", "Ragù alla Bolognese", "Ragù à Bolonhesa"],
  ["italia", "Saltimbocca alla Romana", "Saltimbocca à Romana"],
  ["massas", "Aglio e Olio", "Alho e Óleo"],
  ["espanha", "Gambas al Ajillo", "Camarão ao Alho"],
  ["espanha", "Pulpo a la Gallega", "Polvo à Galega"],
  ["peixes", "Sole Meunière", "Linguado à Meunière Clássica"],
  ["sobremesas-classicas", "Crème Caramel", "Pudim de Caramelo"],
  ["dinamarca", "Agurkesalat", "Salada de Pepino"],
  ["dinamarca", "Aspargessuppe", "Sopa de Aspargos"],
  ["dinamarca", "Biksemad", "Picadinho Dinamarquês"],
  ["dinamarca", "Boller", "Pãezinhos"],
  ["dinamarca", "Brunede Kartofler", "Batatas Caramelizadas"],
  ["dinamarca", "Brændende Kærlighed", "Amor Ardente"],
  ["dinamarca", "Citrontærte", "Torta de Limão Dinamarquesa"],
  ["dinamarca", "Drømmekage", "Bolo dos Sonhos"],
  ["dinamarca", "Fiskefrikadeller", "Frikadeller de Peixe"],
  ["dinamarca", "Fiskesuppe", "Sopa de Peixe"],
  ["dinamarca", "Flæskesteg", "Porco Assado"],
  ["dinamarca", "Forloren Hare", "Lebre Falsa"],
  ["dinamarca", "Franskbrød", "Pão Branco Dinamarquês"],
  ["dinamarca", "Hakkebøf", "Bife Picado"],
  ["dinamarca", "Hindbærsnitter", "Fatias de Framboesa"],
  ["dinamarca", "Kanelsnegle", "Rolinho de Canela"],
  ["dinamarca", "Klar Suppe", "Sopa Clara"],
  ["dinamarca", "Koldskål", "Leitelho Gelado"],
  ["dinamarca", "Kransekage", "Bolo Coroa"],
  ["dinamarca", "Lagkage", "Bolo de Camadas"],
  ["dinamarca", "Leverpostej", "Patê de Fígado"],
  ["dinamarca", "Medisterpølse", "Linguiça Medister"],
  ["dinamarca", "Persillesovs", "Molho de Salsinha"],
  ["dinamarca", "Rugbrød", "Pão de Centeio"],
  ["dinamarca", "Rundstykker", "Pãezinhos Redondos"],
  ["dinamarca", "Rødgrød med Fløde", "Rødgrød com Creme"],
  ["dinamarca", "Rødkål", "Repolho Roxo"],
  ["dinamarca", "Rødspætte Stegt (Linguado Frito)", "Linguado Frito"],
  ["dinamarca", "Smørrebrød (a base)", "Sanduíche Aberto (a base)"],
  ["dinamarca", "Smørrebrød de Arenque", "Sanduíche Aberto de Arenque"],
  ["dinamarca", "Smørrebrød de Camarão", "Sanduíche Aberto de Camarão"],
  ["dinamarca", "Smørrebrød de Roast Beef", "Sanduíche Aberto de Rosbife"],
  ["dinamarca", "Stegt Flæsk med Persillesovs", "Toicinho Frito com Molho de Salsinha"],
  ["dinamarca", "Syltede Agurker", "Pepino em Conserva"],
  ["dinamarca", "Syltede Løg", "Cebola em Conserva"],
  ["dinamarca", "Syltede Rødbeder", "Beterraba em Conserva"],
];

// Os 6 risotos que a leva 1 já tinha renomeado (Risotto X -> Risoto X) e a leva 2 renomeia de
// novo (Risoto X -> Risoto de Y) — só estes exigem migração ENCADEADA (2 slugs "antigos": o
// pré-dece1cb original e o intermediário de dece1cb, ambos precisam resolver pro final).
const CHAINED = [
  ["risotto-ai-frutti-di-mare", "risoto-ai-frutti-di-mare", "Risoto de Frutos do Mar"],
  ["risotto-ai-funghi", "risoto-ai-funghi", "Risoto de Cogumelos"],
  ["risotto-al-limone", "risoto-al-limone", "Risoto de Limão"],
  ["risotto-al-parmigiano", "risoto-al-parmigiano", "Risoto de Parmesão"],
  ["risotto-alla-barbabietola-beterraba", "risoto-alla-barbabietola-beterraba", "Risoto de Beterraba"],
  ["risotto-alla-zucca-abobora", "risoto-alla-zucca-abobora", "Risoto de Abóbora"],
];

// Não renomeados nesta leva (ajustes do dono ao relatório de investigação) — teste negativo
// específico: precisam continuar EXATAMENTE como estão.
const KEPT_AS_IS = ["Cacio e Pepe", "Dumplings (Jiaozi)", "Crème Brûlée", "Risoto alla Milanese"];

function main() {
  const before = loadPreviousPipeline();
  const after = loadCurrentPipeline();
  const beforeFlat = before.TagModel.getAllRecipesFlat();
  const afterFlat = after.TagModel.getAllRecipesFlat();

  console.log("==================================================");
  console.log("1. OS " + RENAMES.length + " NOMES NOVOS EXISTEM; OS ANTIGOS SUMIRAM; O QUE NÃO MUDOU CONTINUA IGUAL");
  console.log("==================================================");
  RENAMES.forEach(([catId, oldName, newName]) => {
    const now = afterFlat.find((it) => it.catId === catId && it.recipe.name === newName);
    const oldStill = afterFlat.find((it) => it.catId === catId && it.recipe.name === oldName);
    assert(!!now, catId + "/" + newName + " existe no estado atual");
    assert(!oldStill, catId + "/" + oldName + " NÃO existe mais (teste negativo)");
  });
  KEPT_AS_IS.forEach((name) => {
    assert(afterFlat.some((it) => it.recipe.name === name), name + " continua exatamente como estava (não renomeado nesta leva)");
  });

  console.log("");
  console.log("==================================================");
  console.log("2. ZERO COLISÃO DE NOME E DE SLUG — 398 receitas atuais + entre os " + RENAMES.length + " renomes");
  console.log("==================================================");
  const idCounts = {};
  const nameCounts = {};
  afterFlat.forEach((it) => {
    idCounts[it.id] = (idCounts[it.id] || 0) + 1;
    nameCounts[it.recipe.name] = (nameCounts[it.recipe.name] || 0) + 1;
  });
  const dupIds = Object.keys(idCounts).filter((id) => idCounts[id] > 1);
  const dupNames = Object.keys(nameCounts).filter((n) => nameCounts[n] > 1);
  assert(afterFlat.length === 398, "total de receitas = 398 (obtido " + afterFlat.length + ")");
  assert(dupIds.length === 0, "nenhum id duplicado entre as 398 receitas (obtido " + dupIds.length + ")");
  assert(dupNames.length === 0, "nenhum NOME duplicado entre as 398 receitas (obtido " + dupNames.length + ") — pega colisão tipo Citrontærte x Torta de Limão");
  const renameNewIds = RENAMES.map(([catId, , newName]) => afterFlat.find((it) => it.catId === catId && it.recipe.name === newName).id);
  assert(new Set(renameNewIds).size === RENAMES.length, "os " + RENAMES.length + " novos slugs são todos distintos entre si");

  console.log("");
  console.log("==================================================");
  console.log("3. TAGS IDÊNTICAS ANTES x DEPOIS DA LEVA 2 (renomear não deriva tag nenhuma)");
  console.log("==================================================");
  // Higiene 2026-07-30: 2 exceções conhecidas — o commit dbd733b (eixo nature, 2026-07-29,
  // "12 correções de identidade aprovadas") mudou as tags manuais destas 2 receitas por razão
  // TOTALMENTE separada do renome de nome pra português (leva 2, este arquivo) — confirmado via
  // `git log -S` isolando exatamente esse commit como origem de cada mudança, nenhum outro. Não
  // é regressão do renome (a seção 1 acima já garante nome/slug intactos) nem falha desta suíte
  // — é dado mais recente e aprovado sobrepondo um "antes" fixo de 6 dias atrás. Exceção documenta
  // o valor NOVO esperado em vez de afrouxar a comparação — qualquer 3ª tag mudando sem entrar
  // aqui continua pegando a suíte de propósito.
  const KNOWN_TAG_CHANGES_POST_BASE = {
    "tecnicas-contemporaneas-2|Glace de Carne": {
      // Único delta: protein:boi -> contains:boi (as outras 6 tags derivadas idênticas).
      before: ["country:franca", "cuisine:franca", "difficulty:media", "dish_type:tecnica-avancada", "format:tecnica", "protein:boi", "time:mais-de-1h"],
      after: ["contains:boi", "country:franca", "cuisine:franca", "difficulty:media", "dish_type:tecnica-avancada", "format:tecnica", "time:mais-de-1h"],
      reason: "dbd733b: Glace de Carne é preparo/técnica (glace, não prato de boi) — protein:boi rebaixado pra contains:boi, mesma lógica da partição prato/preparo/técnica",
    },
    "dinamarca|Molho de Salsinha": {
      // Único delta: ganha format:molho (as outras 8 tags derivadas idênticas, puramente aditivo).
      before: ["country:dinamarca", "cuisine:dinamarca", "diet:vegetariana", "difficulty:facil", "ingredient:leite", "seasoning:noz-moscada", "seasoning:salsinha", "time:ate-1h", "time:ate-30-min"],
      after: ["country:dinamarca", "cuisine:dinamarca", "diet:vegetariana", "difficulty:facil", "format:molho", "ingredient:leite", "seasoning:noz-moscada", "seasoning:salsinha", "time:ate-1h", "time:ate-30-min"],
      reason: "dbd733b: ganhou format:molho (tag nova da leva de derivação, aditiva — resto preservado)",
    },
  };
  RENAMES.forEach(([catId, oldName, newName]) => {
    const beforeItem = beforeFlat.find((it) => it.catId === catId && it.recipe.name === oldName);
    const afterItem = afterFlat.find((it) => it.catId === catId && it.recipe.name === newName);
    if (!beforeItem || !afterItem) {
      assert(false, catId + "/" + oldName + " -> " + newName + ": não encontrado em uma das duas árvores");
      return;
    }
    const beforeTags = beforeItem.tags.slice().sort();
    const afterTags = afterItem.tags.slice().sort();
    const knownChange = KNOWN_TAG_CHANGES_POST_BASE[catId + "|" + newName];
    if (knownChange) {
      assert(
        JSON.stringify(beforeTags) === JSON.stringify(knownChange.before.slice().sort()) &&
          JSON.stringify(afterTags) === JSON.stringify(knownChange.after.slice().sort()),
        catId + "/" + newName + ": tag mudou por razão aprovada e já documentada (" + knownChange.reason + ") — " + afterTags.length + " tags"
      );
      return;
    }
    assert(
      JSON.stringify(beforeTags) === JSON.stringify(afterTags),
      catId + "/" + newName + ": tags idênticas (" + afterTags.length + " tags)"
    );
  });
  assert(beforeFlat.length === afterFlat.length, "contagem total de receitas inalterada (" + beforeFlat.length + " = " + afterFlat.length + ")");

  console.log("");
  console.log("==================================================");
  console.log("4. ALIAS DO ROUTER — slugs antigos (incl. os 2 níveis da migração encadeada) resolvem pro final");
  console.log("==================================================");
  const routerSandboxWindow = Object.assign({}, after);
  const mockLS = makeLocalStorageMock();
  routerSandboxWindow.Storage = loadStorageAgainst(after, mockLS);
  routerSandboxWindow.addEventListener = () => {}; // router.js só usa isso pra hashchange, irrelevante aqui (testamos parseHash via Router.current())
  global.location = { hash: "" };
  const routerSandbox = { window: routerSandboxWindow };
  runInSandbox(routerSandbox, fs.readFileSync(path.join(JS_DIR, "router.js"), "utf8"));
  const Router = routerSandbox.window.Router;

  const map = routerSandboxWindow.Storage.RENAME_SLUG_MAP;
  assert(Object.keys(map).length === 95, "RENAME_SLUG_MAP tem 95 pares — 25 leva 1 + 6 intermediárias + 64 leva 2 (obtido " + Object.keys(map).length + ")");
  Object.keys(map).forEach((oldSlug) => {
    const newSlug = map[oldSlug];
    global.location.hash = "#/receita/" + oldSlug;
    const route = Router.current();
    assert(route.name === "receita" && route.id === newSlug, "#/receita/" + oldSlug + " resolve pra " + newSlug + " (obtido: " + route.id + ")");
  });
  // migração encadeada especificamente: as DUAS pontas do mesmo risoto resolvem pro MESMO final
  CHAINED.forEach(([originalSlug, intermediateSlug]) => {
    const finalFromOriginal = map[originalSlug];
    const finalFromIntermediate = map[intermediateSlug];
    assert(
      finalFromOriginal === finalFromIntermediate,
      "encadeado: " + originalSlug + " e " + intermediateSlug + " resolvem pro MESMO slug final (" + finalFromOriginal + ")"
    );
  });
  // teste negativo: um slug que NUNCA existiu não deve ser "resolvido" pra nada
  global.location.hash = "#/receita/isso-nao-existe-nunca";
  const noop = Router.current();
  assert(noop.id === "isso-nao-existe-nunca", "slug desconhecido passa direto, sem alias falso-positivo (teste negativo)");
  // cozinhar/:id também, usando um par da migração encadeada
  global.location.hash = "#/cozinhar/" + CHAINED[2][0]; // risotto-al-limone
  const cook = Router.current();
  assert(cook.name === "cozinhar" && cook.id === "risoto-de-limao", "#/cozinhar/" + CHAINED[2][0] + " resolve pro slug final (risoto-de-limao)");

  console.log("");
  console.log("==================================================");
  console.log("5. TESTE NEGATIVO DE MIGRAÇÃO ENCADEADA — favoritada+feita pelos DOIS slugs antigos do MESMO risoto");
  console.log("==================================================");
  {
    // simula: o usuário favoritou "Risotto al Limone" antes do dece1cb (slug pré-dece1cb),
    // e TAMBÉM marcou "Risoto al Limone" como feita depois do dece1cb mas antes desta leva
    // (slug intermediário) — os DOIS precisam convergir pro MESMO slug final, sem duplicar
    // e sem orfanar nenhum dos dois.
    const [originalSlug, intermediateSlug, finalName] = CHAINED[2]; // Risoto de Limão
    const mock = makeLocalStorageMock();
    mock.setItem(
      "cardapio-state-v2",
      JSON.stringify({ favorites: [originalSlug], made: [intermediateSlug, "outra-receita-qualquer"] })
    );
    const Storage1 = loadStorageAgainst(after, mock);
    const finalItem = afterFlat.find((it) => it.recipe.name === finalName);
    const finalSlug = finalItem.id;
    assert(Storage1.isFavorite(finalSlug) === true, "favoritada pelo slug ORIGINAL pré-dece1cb (" + originalSlug + ") sobrevive no slug final (" + finalSlug + ")");
    assert(Storage1.isMade(finalSlug) === true, "feita pelo slug INTERMEDIÁRIO de dece1cb (" + intermediateSlug + ") sobrevive no MESMO slug final");
    assert(Storage1.isFavorite(originalSlug) === false, "slug original não fica favoritado também — teste negativo");
    assert(Storage1.isMade(intermediateSlug) === false, "slug intermediário não fica marcado como feito também — teste negativo");
    assert(Storage1.isMade("outra-receita-qualquer") === true, "receita não-renomeada no mesmo estado não é afetada — teste negativo");
  }

  console.log("");
  console.log("==================================================");
  console.log("6. TESTE NEGATIVO DE MIGRAÇÃO — favoritas/feitas sobrevivem (renome comum, não-encadeado)");
  console.log("==================================================");
  {
    const mock = makeLocalStorageMock();
    const [sampleOld, sampleNewSlug] = ["kartoffelsalat", "salada-de-batata"];
    mock.setItem("cardapio-state-v2", JSON.stringify({ made: [sampleOld, "outra-receita-qualquer"], favorites: [sampleOld] }));
    const Storage2 = loadStorageAgainst(after, mock);
    assert(Storage2.isFavorite(sampleNewSlug) === true, "favorita pelo slug ANTIGO (" + sampleOld + ") sobrevive no slug NOVO (" + sampleNewSlug + ")");
    assert(Storage2.isMade(sampleNewSlug) === true, "feita pelo slug ANTIGO sobrevive no slug NOVO");
    assert(Storage2.isFavorite(sampleOld) === false, "slug antigo NÃO fica favoritado também (sem duplicata) — teste negativo");
    assert(Storage2.isMade("outra-receita-qualquer") === true, "receita não-renomeada no mesmo estado não é afetada — teste negativo");
  }

  console.log("");
  console.log("==================================================");
  console.log("7. TESTE NEGATIVO DE MIGRAÇÃO — últimas visitadas (gusta-recentes-v1), caso encadeado");
  console.log("==================================================");
  {
    const [originalSlug, intermediateSlug, finalName] = CHAINED[4]; // Risoto de Beterraba
    const finalSlug = afterFlat.find((it) => it.recipe.name === finalName).id;
    const otherRecipe = afterFlat.find((it) => !map[it.id]).id;
    const mock = makeLocalStorageMock();
    mock.setItem(
      "gusta-recentes-v1",
      JSON.stringify({
        version: 1,
        items: [
          { recipeId: intermediateSlug, viewedAt: 1000 },
          { recipeId: otherRecipe, viewedAt: 900 },
        ],
      })
    );
    const Storage3 = loadStorageAgainst(after, mock);
    const recent = Storage3.getRecentlyViewed();
    const migrated = recent.find((it) => it.recipeId === finalSlug);
    assert(!!migrated && migrated.viewedAt === 1000, "recipeId intermediário (" + intermediateSlug + ") migrou pro final (" + finalSlug + "), viewedAt preservado");
    assert(!recent.some((it) => it.recipeId === intermediateSlug || it.recipeId === originalSlug), "nenhum dos dois slugs antigos sobra na lista — teste negativo");
    assert(recent.some((it) => it.recipeId === otherRecipe && it.viewedAt === 900), "receita não-renomeada na mesma lista não é afetada — teste negativo");
  }

  console.log("");
  console.log("==================================================");
  console.log("8. BUSCA — nomes novos são acháveis (Search.searchRecipes)");
  console.log("==================================================");
  const Search = after.Search;
  [
    ["torta de limão dinamarquesa", "Torta de Limão Dinamarquesa"],
    ["risoto de limão", "Risoto de Limão"],
    ["sanduíche aberto de rosbife", "Sanduíche Aberto de Rosbife"],
    ["pudim de caramelo", "Pudim de Caramelo"],
    ["bife diane", "Bife Diane"],
  ].forEach(([query, expectedName]) => {
    const results = Search.searchRecipes(query, { limit: 5 });
    const found = results.some((r) => r.recipe.name === expectedName);
    assert(found, '"' + query + '" acha "' + expectedName + '" (top: ' + (results[0] ? results[0].recipe.name : "nenhum") + ")");
  });
  // teste negativo: nome ANTIGO de um dos encadeados não deveria mais casar por nome
  const oldNameResults = Search.searchRecipes("risotto al limone", { limit: 5 });
  const stillMatchesOldName = oldNameResults.some((r) => r.recipe.name === "Risotto al Limone" || r.recipe.name === "Risoto al Limone");
  assert(!stillMatchesOldName, "nenhuma receita chamada 'Risotto al Limone' ou 'Risoto al Limone' existe mais — teste negativo");
  // teste negativo: Cacio e Pepe/Dumplings continuam achável pelo nome ORIGINAL (não foram renomeados)
  const cacioResults = Search.searchRecipes("cacio e pepe", { limit: 3 });
  assert(cacioResults.some((r) => r.recipe.name === "Cacio e Pepe"), "'Cacio e Pepe' continua achável pelo nome original (não renomeado nesta leva)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
