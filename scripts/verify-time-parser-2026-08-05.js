// scripts/verify-time-parser-2026-08-05.js
//
// Suíte da fase ESTEIRA-1B: parseMinutes entende dia(s)/semana(s) e as 7 receitas de preparo
// de dias (achado da ESTEIRA-1, reprovavam no validar-lote por TIME_TOTAL e ficavam sem
// NENHUMA tag time: em produção) passam a derivar mais-de-1h + preparo-longo.
//
// Valores 100% LITERAIS — zero refs mutáveis de git (regra do CLAUDE.md). Os literais de
// bucket "antes" (41/130/297/94/45) foram medidos na árvore pré-mudança (estado da
// ESTEIRA-1, commit bf486f6) e ficam aqui como contrato do teste NEGATIVO: as outras 391
// receitas não podem mudar de bucket nunca mais por causa desta fase.
//
// Roda o CÓDIGO REAL de js/tagmodel.js via new Function("window", code), mesmo truque das
// outras suítes. `node scripts/verify-time-parser-2026-08-05.js` — exit != 0 se falhar.

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

const W = loadPipeline();
const TM = W.TagModel;

// ---------- §1: casos unitários do parser (comportamento antigo preservado + novo) ----------
section("1. parseMinutes unitário");
const CASES = [
  // comportamento pré-existente — NÃO pode mudar
  ["40 min", 40],
  ["1h 30 min", 90],
  ["2h", 120],
  ["45", 45],
  ["1-48 h", 2880], // faixa de horas já caía no segundo número antes desta fase
  ["2-6 h", 360],
  // novo (ESTEIRA-1B): dias/semanas, incluindo faixas (vale o maior)
  ["≈3 dias", 4320],
  ["2-3 dias", 4320],
  ["5-7 dias", 10080],
  ["14-45 dias", 64800],
  ["3-14 dias fermentando", 20160],
  ["3-4 semanas", 40320],
  ["1 dia", 1440],
  ["1 semana", 10080],
  // texto sem número segue null — o parser não adivinha
  ["Varia", null],
  ["Vários dias", null],
  ["Semanas", null],
];
CASES.forEach(([input, expected]) => {
  const got = TM.parseMinutes(input);
  assert(got === expected, 'parseMinutes("' + input + '") = ' + got + " (esperado " + expected + ")");
});

// ---------- §2: as 7 receitas do achado da ESTEIRA-1 ----------
section("2. as 7 receitas de preparo de dias derivam mais-de-1h + preparo-longo");
const SETE = [
  ["alemanha", "Sauerbraten"],
  ["brasil-regional", "Maniçoba"],
  ["tecnicas-contemporaneas-2", "Gravlax"],
  ["tecnicas-contemporaneas-2", "Sous-vide (Técnica Geral)"],
  ["tecnicas-contemporaneas-2", "Maturação Seca (Dry Aging)"],
  ["tecnicas-contemporaneas-2", "Defumação Caseira"],
  ["tecnicas-contemporaneas-2", "Legumes Fermentados"],
];
const flat = TM.getAllRecipesFlat();
const seteSet = new Set(SETE.map(([c, n]) => c + "/" + n));
SETE.forEach(([catId, name]) => {
  const item = flat.find((i) => i.catId === catId && i.recipe.name === name);
  assert(!!item, catId + "/" + name + " existe no acervo");
  if (!item) return;
  const timeTags = TM.getRecipeTags(item.catId, item.recipe).filter((t) => t.indexOf("time:") === 0).sort();
  assert(timeTags.indexOf("time:mais-de-1h") !== -1, name + " deriva time:mais-de-1h (tags: " + timeTags.join(",") + ")");
  assert(timeTags.indexOf("time:preparo-longo") !== -1, name + " deriva time:preparo-longo");
  assert(!timeTags.some((t) => t.indexOf("time:ate-") === 0), name + " NÃO deriva nenhuma time:ate-* (teste negativo local)");
});

// ---------- §3: time.total literais pós-fase (trava os dados normalizados E os intocados) ----------
section("3. time.total das 7 — 4 normalizados nesta fase + 3 que o parser resolve sozinho");
const TOTAIS = [
  ["brasil-regional", "Maniçoba", "5-7 dias"],                       // era "Vários dias"
  ["tecnicas-contemporaneas-2", "Maturação Seca (Dry Aging)", "14-45 dias"], // era "Semanas"
  ["tecnicas-contemporaneas-2", "Sous-vide (Técnica Geral)", "1-48 h"],      // era "Varia"
  ["tecnicas-contemporaneas-2", "Defumação Caseira", "2-6 h"],               // era "Varia"
  // estes 3 NÃO foram editados — a correção deles é 100% do parser; se alguém "normalizar"
  // o dado no futuro, esta trava força a decisão a ser consciente
  ["alemanha", "Sauerbraten", "≈3 dias"],
  ["tecnicas-contemporaneas-2", "Gravlax", "2-3 dias"],
  ["tecnicas-contemporaneas-2", "Legumes Fermentados", "3-14 dias fermentando"],
];
TOTAIS.forEach(([catId, name, expected]) => {
  const item = flat.find((i) => i.catId === catId && i.recipe.name === name);
  if (!item) {
    failures++;
    console.log("  FAIL " + catId + "/" + name + " sumiu do acervo");
    return;
  }
  const got = item.recipe.time && item.recipe.time.total;
  assert(got === expected, name + ' time.total = "' + got + '" (esperado "' + expected + '")');
});

// ---------- §4: TESTE NEGATIVO global — nenhuma das outras 391 mudou de bucket ----------
section("4. buckets de tempo — 391 intocadas nos literais pré-fase, acervo nos pós-fase");
// Literais medidos na árvore PRÉ-mudança (ESTEIRA-1, bf486f6):
const BUCKETS_ANTES = { "time:ate-15-min": 41, "time:ate-30-min": 130, "time:ate-1h": 297, "time:mais-de-1h": 94, "time:preparo-longo": 45 };
// Pós-fase: só mais-de-1h e preparo-longo crescem, exatamente +7 cada:
const BUCKETS_DEPOIS = { "time:ate-15-min": 41, "time:ate-30-min": 130, "time:ate-1h": 297, "time:mais-de-1h": 101, "time:preparo-longo": 52 };

const bucketsTotais = {};
const buckets391 = {};
let total = 0;
flat.forEach((item) => {
  total++;
  const key = item.catId + "/" + item.recipe.name;
  const timeTags = TM.getRecipeTags(item.catId, item.recipe).filter((t) => t.indexOf("time:") === 0);
  timeTags.forEach((t) => {
    bucketsTotais[t] = (bucketsTotais[t] || 0) + 1;
    if (!seteSet.has(key)) buckets391[t] = (buckets391[t] || 0) + 1;
  });
});
assert(total === 398, "acervo tem 398 receitas (tem " + total + ")");
Object.keys(BUCKETS_ANTES).forEach((tag) => {
  assert((buckets391[tag] || 0) === BUCKETS_ANTES[tag],
    "EXCLUINDO as 7: " + tag + " = " + (buckets391[tag] || 0) + " (literal pré-fase " + BUCKETS_ANTES[tag] + " — nenhuma das outras 391 pode ter mudado)");
});
Object.keys(BUCKETS_DEPOIS).forEach((tag) => {
  assert((bucketsTotais[tag] || 0) === BUCKETS_DEPOIS[tag],
    "ACERVO INTEIRO: " + tag + " = " + (bucketsTotais[tag] || 0) + " (literal pós-fase " + BUCKETS_DEPOIS[tag] + ")");
});

// ---------- resultado ----------
console.log("\n" + (failures ? "FALHOU: " + failures + " asserção(ões)" : "OK: todas as asserções passaram"));
process.exitCode = failures ? 1 : 0;
