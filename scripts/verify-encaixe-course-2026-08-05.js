// scripts/verify-encaixe-course-2026-08-05.js
//
// Suíte da fase ENCAIXE-1 (ciclo EQUALIZAÇÃO): as 60 tags course: manuais aprovadas pelo dono
// a partir de docs/RELATORIO-DRYRUN-COURSE-2026-08-05.md foram aplicadas em data/*.js —
// 21 cafe-da-manha (20 ALTA da §2 + Croque Monsieur, única aprovada das 11 DUVIDOSAS da §3),
// 17 sobremesa (§5.2), 13 entrada (§5.3) e 9 acompanhamento (§5.4).
//
// Valores 100% LITERAIS — zero refs mutáveis de git (regra do CLAUDE.md). O contrato de
// conjunto FECHADO substitui o diff de snapshot da aplicação: a lista de receitas com
// course: manual no acervo tem que ser EXATAMENTE as 60 desta fase + as 2 pré-existentes de
// contemporaneos (Legumes Glaceados, Vegetais Assados em Diferentes Texturas). Qualquer
// course: manual fora da lista, ou a falta de um, derruba a suíte — é o "nenhuma receita
// fora da lista ganhou course: novo" garantido para sempre, sem depender de git.
//
// Roda o CÓDIGO REAL de js/tagmodel.js via new Function("window", code), mesmo truque das
// outras suítes. `node scripts/verify-encaixe-course-2026-08-05.js` — exit != 0 se falhar.

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
let current = "";
function section(name) {
  current = name;
  console.log("\n== " + name + " ==");
}
function assert(cond, msg) {
  if (cond) {
    console.log("  ok  " + msg);
  } else {
    failures++;
    console.log("  FAIL " + msg + "  <-- [" + current + "]");
  }
}

// As 60 receitas da fase, por catId e nome EXATO em data/*.js (nota: o relatório grafa
// "Ovo a Baixa Temperatura 63°C" nas duvidosas; o nome real no acervo tem parênteses).
const APPLIED = {
  "course:cafe-da-manha": [
    ["ovos-basicos", "Ovo Cozido (mole, médio e duro)"],
    ["ovos-basicos", "Ovo Poché"],
    ["ovos-basicos", "Ovo Frito Perfeito"],
    ["ovos-basicos", "Ovo Mexido Francês (cremoso)"],
    ["ovos-basicos", "Ovo Mexido Americano"],
    ["ovos-basicos", "Omelete Francesa"],
    ["ovos-basicos", "Ovo Cocotte"],
    ["ovos-basicos", "Ovo no Ramequim (simples)"],
    ["ovos-classicos", "Eggs Benedict"],
    ["ovos-classicos", "Eggs Florentine"],
    ["ovos-classicos", "Eggs Royale"],
    ["ovos-classicos", "Shakshuka"],
    ["ovos-classicos", "Menemen"],
    ["ovos-classicos", "Huevos Rancheros"],
    ["dinamarca", "Pão de Centeio"],
    ["dinamarca", "Pão Branco Dinamarquês"],
    ["dinamarca", "Pãezinhos Redondos"],
    ["dinamarca", "Pãezinhos"],
    ["dinamarca", "Wienerbrød (Massa Folhada Dinamarquesa)"],
    ["dinamarca", "Rolinho de Canela"],
    ["entradas-quentes", "Croque Monsieur"],
  ],
  "course:sobremesa": [
    ["austria", "Strudel de Maçã"],
    ["austria", "Kaiserschmarrn"],
    ["eua", "Torta de Maçã"],
    ["italia", "Zabaglione"],
    ["italia", "Semifreddo"],
    ["italia", "Affogato"],
    ["portugal", "Pastel de Nata"],
    ["dinamarca", "Æbleskiver"],
    ["dinamarca", "Risalamande"],
    ["dinamarca", "Bolo dos Sonhos"],
    ["dinamarca", "Fatias de Framboesa"],
    ["dinamarca", "Bolo de Camadas"],
    ["dinamarca", "Rødgrød com Creme"],
    ["dinamarca", "Torta de Limão Dinamarquesa"],
    ["dinamarca", "Brunsviger"],
    ["dinamarca", "Bolo Coroa"],
    ["dinamarca", "Leitelho Gelado"],
  ],
  "course:entrada": [
    ["mexico", "Guacamole"],
    ["espanha", "Salmorejo"],
    ["espanha", "Patatas Bravas"],
    ["grecia", "Tzatziki"],
    ["grecia", "Dolmades"],
    ["libano", "Hommus"],
    ["libano", "Babaganuche"],
    ["libano", "Tabule"],
    ["libano", "Fattoush"],
    ["india", "Samosa"],
    ["peru", "Tiradito"],
    ["ovos-classicos", "Ovos com Maionese"],
    ["ovos-classicos", "Scotch Egg"],
  ],
  "course:acompanhamento": [
    ["alemanha", "Salada de Batata"],
    ["dinamarca", "Batatas Caramelizadas"],
    ["dinamarca", "Repolho Roxo"],
    ["dinamarca", "Salada de Pepino"],
    ["dinamarca", "Beterraba em Conserva"],
    ["dinamarca", "Pepino em Conserva"],
    ["dinamarca", "Cebola em Conserva"],
    ["coreia", "Kimchi"],
    ["india", "Naan"],
  ],
};

// course: manuais que JÁ existiam antes da fase (contemporaneos, decisão antiga) — junto com
// as 60 acima formam o conjunto FECHADO de course: manual permitido no acervo.
const PREEXISTING_MANUAL = [
  ["contemporaneos", "Legumes Glaceados", "course:acompanhamento"],
  ["contemporaneos", "Vegetais Assados em Diferentes Texturas", "course:principal"],
];

// As 10 DUVIDOSAS de cafe-da-manha REJEITADAS pelo dono (2026-08-05) — teste NEGATIVO.
// As 4 últimas ganharam course:sobremesa pela §5.2, mas cafe-da-manha NÃO.
const REJECTED_CAFE = [
  ["ovos-basicos", "Ovo Mollet"],
  ["ovos-basicos", "Ovo a Baixa Temperatura (63°C)"],
  ["ovos-basicos", "Ovo Confitado"],
  ["ovos-basicos", "Frittata"],
  ["ovos-basicos", "Tamagoyaki"],
  ["ovos-classicos", "Ovos en Cocotte à la Forestière"],
  ["portugal", "Pastel de Nata"],
  ["austria", "Kaiserschmarrn"],
  ["dinamarca", "Æbleskiver"],
  ["dinamarca", "Leitelho Gelado"],
];

// Contagens EFETIVAS por course: (automático da categoria + manual), medidas após a
// aplicação — contrato desta fase. "Antes" (medido no estado a6eba7b): 9/19/25/24/84, 237
// sem course: — fica registrado aqui só como história; o contrato é o DEPOIS.
const EXPECTED_COUNTS = {
  "course:cafe-da-manha": 30,
  "course:sobremesa": 36,
  "course:entrada": 38,
  "course:acompanhamento": 33,
  "course:principal": 84,
};
const EXPECTED_NONE = 194;
const EXPECTED_TOTAL = 398;

const W = loadPipeline();
const TM = W.TagModel;

const byKey = {};
const effCounts = {};
let none = 0;
let total = 0;
for (const [catId, recipes] of Object.entries(W.RECIPES)) {
  for (const r of recipes) {
    total++;
    const eff = [...new Set(TM.getRecipeTags(catId, r).filter((t) => t.startsWith("course:")))];
    if (!eff.length) none++;
    eff.forEach((c) => { effCounts[c] = (effCounts[c] || 0) + 1; });
    byKey[catId + "||" + r.name] = { manual: (r.tags || []).filter((t) => t.startsWith("course:")), eff };
  }
}

// ---------- §1: contagens efetivas por course: ----------
section("1. contagens efetivas por course: (automático + manual)");
assert(total === EXPECTED_TOTAL, "acervo com " + EXPECTED_TOTAL + " receitas (atual: " + total + ")");
for (const [tag, n] of Object.entries(EXPECTED_COUNTS)) {
  assert((effCounts[tag] || 0) === n, tag + " = " + n + " (atual: " + (effCounts[tag] || 0) + ")");
}
assert(none === EXPECTED_NONE, "receitas SEM course: nenhum = " + EXPECTED_NONE + " (atual: " + none + ")");
const knownTags = Object.keys(EXPECTED_COUNTS);
const unknownTags = Object.keys(effCounts).filter((t) => !knownTags.includes(t));
assert(unknownTags.length === 0, "nenhum valor de course: fora dos 5 conhecidos (atual: " + JSON.stringify(unknownTags) + ")");

// ---------- §2: as 60 receitas têm a tag MANUAL certa ----------
section("2. as 60 aplicadas têm a tag manual certa (e só 1 course: manual)");
let applied60 = 0;
for (const [tag, list] of Object.entries(APPLIED)) {
  let okCount = 0;
  for (const [catId, name] of list) {
    applied60++;
    const rec = byKey[catId + "||" + name];
    if (!rec) {
      assert(false, catId + " / " + name + " existe no acervo");
      continue;
    }
    if (rec.manual.length === 1 && rec.manual[0] === tag) {
      okCount++;
    } else {
      assert(false, catId + " / " + name + " com manual " + JSON.stringify(rec.manual) + ", esperado [" + tag + "]");
    }
  }
  assert(okCount === list.length, tag + ": " + okCount + "/" + list.length + " receitas com a tag manual exata");
}
assert(applied60 === 60, "lista fechada da fase tem 60 receitas (atual: " + applied60 + ")");

// ---------- §3: NEGATIVO — as 10 duvidosas rejeitadas seguem SEM cafe-da-manha ----------
section("3. NEGATIVO: 10 duvidosas rejeitadas sem course:cafe-da-manha");
for (const [catId, name] of REJECTED_CAFE) {
  const rec = byKey[catId + "||" + name];
  if (!rec) {
    assert(false, catId + " / " + name + " existe no acervo");
    continue;
  }
  assert(!rec.eff.includes("course:cafe-da-manha"), catId + " / " + name + " sem cafe-da-manha (efetivo: " + JSON.stringify(rec.eff) + ")");
}

// ---------- §4: NEGATIVO — conjunto FECHADO de course: manual no acervo ----------
section("4. NEGATIVO: course: manual no acervo = exatamente 60 da fase + 2 pré-existentes");
const expectedManual = {};
for (const [tag, list] of Object.entries(APPLIED)) {
  for (const [catId, name] of list) expectedManual[catId + "||" + name] = tag;
}
for (const [catId, name, tag] of PREEXISTING_MANUAL) expectedManual[catId + "||" + name] = tag;
let extra = 0;
let missing = 0;
let wrong = 0;
for (const [key, rec] of Object.entries(byKey)) {
  const exp = expectedManual[key];
  if (!exp) {
    if (rec.manual.length) {
      extra++;
      assert(false, key + " tem course: manual FORA da lista: " + JSON.stringify(rec.manual));
    }
  } else {
    if (!rec.manual.includes(exp)) {
      missing++;
      assert(false, key + " deveria ter " + exp + " manual, tem " + JSON.stringify(rec.manual));
    } else if (rec.manual.length !== 1) {
      wrong++;
      assert(false, key + " com mais de um course: manual: " + JSON.stringify(rec.manual));
    }
  }
}
assert(extra === 0, "nenhuma receita fora da lista com course: manual (extras: " + extra + ")");
assert(missing === 0 && wrong === 0, "as 62 da lista fechada com exatamente 1 course: manual cada");
assert(Object.keys(expectedManual).length === 62, "lista fechada = 62 receitas (60 da fase + 2 contemporaneos)");

// ---------- resultado ----------
console.log("");
if (failures) {
  console.log("FALHOU: " + failures + " asserção(ões).");
  process.exit(1);
}
console.log("verify-encaixe-course-2026-08-05: TUDO VERDE.");
