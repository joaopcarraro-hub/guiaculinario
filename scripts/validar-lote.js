// scripts/validar-lote.js
//
// Validador de lote de receitas novas (fase ESTEIRA-1, 2026-08-05) — porteiro da esteira de
// adição em massa: valida um arquivo de lote (MESMO formato de data/*.js, ou seja,
// window.RECIPES["<catId>"] = [...]) ANTES de ele entrar no acervo, ou o acervo inteiro
// quando chamado sem argumento (baseline/auditoria).
//
// Uso:
//   node scripts/validar-lote.js data/lote-novo.js   # valida o lote contra o acervo real
//   node scripts/validar-lote.js                     # valida o acervo inteiro
//   node scripts/validar-lote.js --self-test         # fixture inválida embutida: o validador
//                                                    # PRECISA reprová-la (teste negativo) e
//                                                    # aprovar um controle positivo do acervo
//
// Sai com código != 0 se houver qualquer ERRO; warnings não derrubam.
//
// Roda o CÓDIGO REAL de js/tagmodel.js via new Function("window", code) — mesmo truque das
// suítes verify-*.js (ver scripts/verify-busca-unificada-2026-07-29.js). Nada de parser
// paralelo: dificuldade, tempo, slug e derivação de tags vêm do TagModel de verdade
// (getRecipeTags/parseMinutes/slugify), e o dicionário canônico entra pelo mesmo
// data/derivation-dict.js de produção.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const JS_DIR = path.join(ROOT, "js");
const FOTOS_DIR = path.join(ROOT, "imagens", "receitas");

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

// slugFoto REAL de js/app.js, extraído do fonte e executado (padrão de
// verify-card-contract-2026-07-25.js: extrai e EXECUTA, não duplica). O caminho da foto usa
// slugFoto, que NÃO é idêntico a TagModel.slugify (slugify mapeia ø/å/æ antes do NFD) —
// copiar a função aqui criaria a 3ª cópia e dessincronizaria em silêncio.
function extractSlugFoto() {
  const src = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
  const m = src.match(/function slugFoto\(nome\) \{[\s\S]*?\n  \}/);
  if (!m) {
    throw new Error("nao achei function slugFoto(nome) em js/app.js — o contrato de foto mudou, atualize extractSlugFoto()");
  }
  // eslint-disable-next-line no-new-func
  return new Function("return (" + m[0] + ")")();
}

// Prefixos manuais permitidos no campo `tags` de data/*.js.
// course: liberado em 2026-08-05 (decisão do dono, fase ESTEIRA-1) — sempre ADITIVO ao
// automático da categoria. format: não está na lista da decisão, mas é convenção manual JÁ
// ESTABELECIDA do acervo aprovado (contemporaneos/tecnicas e casos pontuais como Molho de
// Salsinha em dinamarca usam format: por receita — ver o comentário de CATEGORY_BASE_TAGS em
// js/tagmodel.js) — tratá-lo como erro reprovaria acervo em produção, então fica permitido.
const ALLOWED_MANUAL_PREFIXES = ["protein:", "contains:", "ingredient:", "diet:", "course:", "format:"];

const ITEM_KEYS = ["qty", "qtyRange", "unit", "item", "prep", "alt", "optional", "isReference"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function checkItemShape(entryIdx, itemIdx, it, err) {
  const where = "ingredientsStructured[" + entryIdx + "].items[" + itemIdx + "]";
  if (!it || typeof it !== "object" || Array.isArray(it)) {
    err("SCHEMA", where + " nao e objeto");
    return;
  }
  ITEM_KEYS.forEach((k) => {
    if (!(k in it)) err("SCHEMA", where + " sem a chave `" + k + "`");
  });
  if ("qty" in it && it.qty !== null && typeof it.qty !== "number") err("SCHEMA", where + ".qty deve ser numero ou null");
  if ("qtyRange" in it && it.qtyRange !== null && !(Array.isArray(it.qtyRange) && it.qtyRange.length === 2 && it.qtyRange.every((n) => typeof n === "number"))) {
    err("SCHEMA", where + ".qtyRange deve ser null ou [min, max] numericos");
  }
  if ("unit" in it && it.unit !== null && typeof it.unit !== "string") err("SCHEMA", where + ".unit deve ser string ou null");
  if ("item" in it && !isNonEmptyString(it.item)) err("SCHEMA", where + ".item deve ser string nao vazia");
  if ("prep" in it && it.prep !== null && typeof it.prep !== "string") err("SCHEMA", where + ".prep deve ser string ou null");
  if ("alt" in it && it.alt !== null && typeof it.alt !== "string") err("SCHEMA", where + ".alt deve ser string ou null");
  if ("optional" in it && typeof it.optional !== "boolean") err("SCHEMA", where + ".optional deve ser boolean");
  if ("isReference" in it && typeof it.isReference !== "boolean") err("SCHEMA", where + ".isReference deve ser boolean");
}

// Valida UMA receita. opts.checkCollisions liga a checagem de colisao contra o acervo (modo
// lote — no modo acervo-inteiro a receita colidiria consigo mesma; la a colisao e checada em
// bloco via findDuplicateIds + varredura de nomes).
function validateRecipe(ctx, catId, recipe, opts) {
  const { W, TM, slugFoto, acervoNames, acervoSlugs } = ctx;
  const errors = [];
  const warnings = [];
  const err = (code, msg) => errors.push({ code, msg });
  const warn = (code, msg) => warnings.push({ code, msg });

  // 1. Schema: campos obrigatorios com tipo certo
  if (!isNonEmptyString(recipe.name)) err("SCHEMA", "`name` ausente ou vazio");
  if (!isNonEmptyString(recipe.desc)) err("SCHEMA", "`desc` ausente ou vazio");
  if (!isNonEmptyString(recipe.origin)) err("SCHEMA", "`origin` ausente ou vazio");
  if (!recipe.time || typeof recipe.time !== "object") {
    err("SCHEMA", "`time` ausente ou nao e objeto {prep, cook, total}");
  } else {
    ["prep", "cook", "total"].forEach((k) => {
      if (!isNonEmptyString(recipe.time[k])) err("SCHEMA", "`time." + k + "` ausente ou vazio");
    });
  }
  if (!isNonEmptyString(recipe.yield)) err("SCHEMA", "`yield` ausente ou vazio");
  if (!isNonEmptyString(recipe.difficulty)) err("SCHEMA", "`difficulty` ausente ou vazio");
  if (!Array.isArray(recipe.tags)) err("SCHEMA", "`tags` ausente ou nao e array (use [] se nenhuma tag manual)");
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) {
    err("SCHEMA", "`ingredients` ausente/vazio");
  } else if (!recipe.ingredients.every(isNonEmptyString)) {
    err("SCHEMA", "`ingredients` com entrada que nao e string nao vazia");
  }
  if (!Array.isArray(recipe.ingredientsStructured) || !recipe.ingredientsStructured.length) {
    err("SCHEMA", "`ingredientsStructured` ausente/vazio — campo OBRIGATORIO desde 2026-08-05 (multiplicador de porcoes + Lista de Compras)");
  } else {
    recipe.ingredientsStructured.forEach((entry, i) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        err("SCHEMA", "ingredientsStructured[" + i + "] nao e objeto");
        return;
      }
      if (!isNonEmptyString(entry.raw)) err("SCHEMA", "ingredientsStructured[" + i + "].raw ausente ou vazio");
      if (!("group" in entry) || (entry.group !== null && typeof entry.group !== "string")) {
        err("SCHEMA", "ingredientsStructured[" + i + "].group deve ser string ou null");
      }
      if (!Array.isArray(entry.items) || !entry.items.length) {
        err("SCHEMA", "ingredientsStructured[" + i + "].items ausente/vazio");
      } else {
        entry.items.forEach((it, j) => checkItemShape(i, j, it, err));
      }
    });
  }
  if (!Array.isArray(recipe.steps) || !recipe.steps.length) {
    err("SCHEMA", "`steps` ausente/vazio");
  } else if (!recipe.steps.every(isNonEmptyString)) {
    err("SCHEMA", "`steps` com entrada que nao e string nao vazia");
  }
  if ("stepIngredients" in recipe) {
    if (!Array.isArray(recipe.stepIngredients)) {
      err("SCHEMA", "`stepIngredients` presente mas nao e array");
    } else if (Array.isArray(recipe.steps) && recipe.stepIngredients.length !== recipe.steps.length) {
      err("SCHEMA", "`stepIngredients` deve ser paralelo a `steps` (" + recipe.stepIngredients.length + " vs " + recipe.steps.length + " passos)");
    }
  }
  if ("tips" in recipe && (!Array.isArray(recipe.tips) || !recipe.tips.every(isNonEmptyString))) {
    err("SCHEMA", "`tips` presente mas nao e array de strings");
  }

  // Tags derivadas pelo motor REAL (base da categoria + origin + tempo + dificuldade +
  // dicionario canonico + equipment por steps + as manuais mescladas)
  let derived = [];
  try {
    derived = TM.getRecipeTags(catId, recipe) || [];
  } catch (e) {
    err("DERIVACAO", "getRecipeTags explodiu: " + e.message);
  }

  // 2. difficulty mapeavel pelo parser real / time.total parseavel
  if (isNonEmptyString(recipe.difficulty) && !derived.some((t) => t.indexOf("difficulty:") === 0)) {
    err("DIFFICULTY", "`difficulty` \"" + recipe.difficulty + "\" nao mapeia pra nenhuma difficulty:* no parser real de js/tagmodel.js");
  }
  if (recipe.time && isNonEmptyString(recipe.time.total) && TM.parseMinutes(recipe.time.total) === null) {
    err("TIME_TOTAL", "`time.total` \"" + recipe.time.total + "\" nao e parseavel por TagModel.parseMinutes — a receita fica sem tag time:*");
  }

  // 3. Colisao de NOME e de SLUG contra o acervo completo (modo lote)
  if (opts.checkCollisions && isNonEmptyString(recipe.name)) {
    if (acervoNames.has(recipe.name)) {
      err("NAME_COLLISION", "ja existe receita chamada \"" + recipe.name + "\" no acervo");
    }
    const slug = TM.slugify(recipe.name);
    if (acervoSlugs.has(slug)) {
      err("SLUG_COLLISION", "slug \"" + slug + "\" colide com receita do acervo (mesmo com nome diferente — Storage/URLs sao chaveados por slug)");
    }
  }

  // 4. Tags manuais: existem em js/tags.js E usam prefixo permitido
  const validTagIds = ctx.validTagIds;
  (Array.isArray(recipe.tags) ? recipe.tags : []).forEach((tagId) => {
    if (typeof tagId !== "string") {
      err("TAG_INVALID", "tag manual que nao e string: " + JSON.stringify(tagId));
      return;
    }
    if (!ALLOWED_MANUAL_PREFIXES.some((p) => tagId.indexOf(p) === 0)) {
      err("TAG_PREFIX", "tag manual \"" + tagId + "\" usa prefixo nao permitido (permitidos: " + ALLOWED_MANUAL_PREFIXES.join(" ") + ")");
    }
    if (!validTagIds.has(tagId)) {
      err("TAG_INVALID", "tag manual \"" + tagId + "\" nao existe em js/tags.js");
    }
  });

  // 5. origin sem pais no filtro (warning): nem a categoria nem ORIGIN_COUNTRY_MATCHERS
  // produziram country:*
  if (isNonEmptyString(recipe.origin) && !derived.some((t) => t.indexOf("country:") === 0)) {
    warn("ORIGIN_SEM_PAIS", "`origin` \"" + recipe.origin + "\" nao casa com nenhum ORIGIN_COUNTRY_MATCHERS e a categoria nao injeta pais — receita ficara sem pais no filtro");
  }

  // 6. mesmo numero de entradas raw que ingredients
  if (Array.isArray(recipe.ingredients) && Array.isArray(recipe.ingredientsStructured) &&
      recipe.ingredients.length !== recipe.ingredientsStructured.length) {
    err("STRUCT_COUNT", "`ingredientsStructured` tem " + recipe.ingredientsStructured.length + " entradas para " + recipe.ingredients.length + " linhas de `ingredients` (deve ser 1 pra 1, na mesma ordem)");
  }

  // 8. foto (warning)
  if (isNonEmptyString(recipe.name)) {
    const fotoPath = path.join(FOTOS_DIR, slugFoto(recipe.name) + ".webp");
    if (!fs.existsSync(fotoPath)) {
      warn("FOTO_FALTANDO", "sem foto em imagens/receitas/" + slugFoto(recipe.name) + ".webp — rodar scripts/gerar-imagens.js (dry run primeiro)");
    }
  }

  // catId desconhecido do acervo (warning): categoria nova exige etapa de codigo
  // (CATEGORY_BASE_TAGS/coleta em js/*), nao pode nascer por typo num arquivo de lote
  if (!(catId in (W.RECIPES || {})) && !opts.selfTest) {
    warn("CATID_NOVO", "catId \"" + catId + "\" nao existe no acervo atual — categoria nova exige etapa de codigo, confirme que nao e typo");
  }

  return { errors, warnings, derived };
}

function buildContext() {
  const W = loadPipeline();
  const TM = W.TagModel;
  const slugFoto = extractSlugFoto();
  const acervo = TM.getAllRecipesFlat();
  return {
    W,
    TM,
    slugFoto,
    acervo,
    acervoNames: new Set(acervo.map((i) => i.recipe.name)),
    acervoSlugs: new Set(acervo.map((i) => TM.slugify(i.recipe.name))),
    validTagIds: new Set((W.TAGS || []).map((t) => t.id)),
  };
}

function loadBatchFile(batchPath) {
  const sandbox = { window: {} };
  runInSandbox(sandbox, fs.readFileSync(batchPath, "utf8"));
  const out = [];
  Object.keys(sandbox.window.RECIPES || {}).forEach((catId) => {
    (sandbox.window.RECIPES[catId] || []).forEach((recipe) => out.push({ catId, recipe }));
  });
  return out;
}

function printResult(label, res, opts) {
  const status = res.errors.length ? "ERRO" : (res.warnings.length ? "ok (warnings)" : "ok");
  console.log("- " + label + ": " + status);
  res.errors.forEach((e) => console.log("    ERRO   [" + e.code + "] " + e.msg));
  res.warnings.forEach((w) => console.log("    warn   [" + w.code + "] " + w.msg));
  if (opts.printDerived) {
    console.log("    tags derivadas+manuais (conferencia humana): " + (res.derived.length ? res.derived.join(", ") : "(nenhuma)"));
  }
}

// ---------- self-test: fixture invalida embutida (valores LITERAIS, nenhuma ref de git) ----------
// A fixture precisa ser REPROVADA com pelo menos um erro de cada classe esperada abaixo, e o
// controle positivo (Carbonara real, direto do acervo carregado) precisa passar com 0 erros.
const SELF_TEST_FIXTURE = {
  catId: "massas",
  recipe: {
    name: "Carbonara", // colisao proposital de nome E slug com o acervo real
    // desc: ausente de proposito (SCHEMA)
    origin: "Atlantida", // nao casa com matcher nenhum -> warning ORIGIN_SEM_PAIS esperado
    time: { prep: "10 min", cook: "15 min", total: "um tempao" }, // total imparseavel (TIME_TOTAL)
    yield: "2 porcoes",
    difficulty: "Impossivel", // nao mapeia pra difficulty:* (DIFFICULTY)
    tags: ["dish_type:massa", "course:brunch"], // prefixo proibido (TAG_PREFIX) + tag inexistente (TAG_INVALID)
    ingredients: ["100 g de massa", "1 ovo"],
    ingredientsStructured: [ // 1 entrada pra 2 ingredients (STRUCT_COUNT)
      { raw: "100 g de massa", group: null, items: [{ qty: 100, qtyRange: null, unit: "grama", item: "massa", prep: null, alt: null, optional: false, isReference: false }] },
    ],
    steps: ["Cozinhe a massa."],
  },
};
const SELF_TEST_EXPECTED_ERRORS = ["SCHEMA", "TIME_TOTAL", "DIFFICULTY", "NAME_COLLISION", "SLUG_COLLISION", "TAG_PREFIX", "TAG_INVALID", "STRUCT_COUNT"];
// FOTO_FALTANDO nao pode ser testado na fixture 1: ela colide de proposito com a Carbonara
// real, entao imagens/receitas/carbonara.webp EXISTE. A fixture 2 (abaixo) cobre esse warning.
const SELF_TEST_EXPECTED_WARNINGS = ["ORIGIN_SEM_PAIS"];

// Fixture 2 — VALIDA, nome inexistente no acervo: prova que (a) receita correta com course:
// manual passa com 0 erros, (b) warning nao derruba, (c) FOTO_FALTANDO dispara pra receita
// sem foto gerada.
const SELF_TEST_FIXTURE_VALID = {
  catId: "ovos-classicos",
  recipe: {
    name: "Prato Fantasma do Self-Test",
    desc: "Fixture valida embutida do validador — nunca deve entrar no acervo.",
    origin: "França",
    time: { prep: "5 min", cook: "10 min", total: "15 min" },
    yield: "1 porção",
    difficulty: "Fácil",
    tags: ["protein:ovo", "course:cafe-da-manha"],
    ingredients: ["2 ovos"],
    ingredientsStructured: [
      { raw: "2 ovos", group: null, items: [{ qty: 2, qtyRange: null, unit: null, item: "ovos", prep: null, alt: null, optional: false, isReference: false }] },
    ],
    steps: ["Prepare os ovos em um passo qualquer."],
  },
};

function runSelfTest(ctx) {
  console.log("== validar-lote --self-test ==\n");
  let failures = 0;

  const res = validateRecipe(ctx, SELF_TEST_FIXTURE.catId, SELF_TEST_FIXTURE.recipe, { checkCollisions: true, selfTest: true });
  printResult("fixture invalida (massas/Carbonara falsa)", res, { printDerived: true });
  const gotErr = new Set(res.errors.map((e) => e.code));
  const gotWarn = new Set(res.warnings.map((w) => w.code));
  SELF_TEST_EXPECTED_ERRORS.forEach((code) => {
    if (!gotErr.has(code)) {
      failures++;
      console.log("  FALHA DO SELF-TEST: erro esperado [" + code + "] nao foi emitido");
    }
  });
  SELF_TEST_EXPECTED_WARNINGS.forEach((code) => {
    if (!gotWarn.has(code)) {
      failures++;
      console.log("  FALHA DO SELF-TEST: warning esperado [" + code + "] nao foi emitido");
    }
  });
  if (!res.errors.length) {
    failures++;
    console.log("  FALHA DO SELF-TEST: fixture invalida foi APROVADA (0 erros) — o validador nao esta validando");
  }

  // fixture 2: valida, sem foto — 0 erros, warning FOTO_FALTANDO presente
  const res2 = validateRecipe(ctx, SELF_TEST_FIXTURE_VALID.catId, SELF_TEST_FIXTURE_VALID.recipe, { checkCollisions: true, selfTest: true });
  printResult("fixture valida sem foto (ovos-classicos/Prato Fantasma do Self-Test)", res2, { printDerived: true });
  if (res2.errors.length) {
    failures++;
    console.log("  FALHA DO SELF-TEST: fixture VALIDA foi reprovada (" + res2.errors.length + " erro(s)) — validador rigido demais");
  }
  if (!res2.warnings.some((w) => w.code === "FOTO_FALTANDO")) {
    failures++;
    console.log("  FALHA DO SELF-TEST: warning esperado [FOTO_FALTANDO] nao foi emitido pra receita sem foto");
  }

  // controle positivo: receita real do acervo passa sem erros (sem checagem de colisao,
  // que compararia a receita com ela mesma)
  const carb = ctx.acervo.find((i) => i.catId === "massas" && i.recipe.name === "Carbonara");
  if (!carb) {
    failures++;
    console.log("  FALHA DO SELF-TEST: nao achei a Carbonara real no acervo (controle positivo)");
  } else {
    const resOk = validateRecipe(ctx, carb.catId, carb.recipe, { checkCollisions: false, selfTest: false });
    printResult("controle positivo (massas/Carbonara real)", resOk, { printDerived: false });
    if (resOk.errors.length) {
      failures++;
      console.log("  FALHA DO SELF-TEST: controle positivo reprovado — " + resOk.errors.length + " erro(s) numa receita valida do acervo");
    }
  }

  console.log("");
  if (failures) {
    console.log("SELF-TEST: FALHOU (" + failures + " problema(s) no proprio validador)");
    return 1;
  }
  console.log("SELF-TEST: OK — fixture reprovada com todas as " + SELF_TEST_EXPECTED_ERRORS.length +
    " classes de erro esperadas + " + SELF_TEST_EXPECTED_WARNINGS.length + " warnings, controle positivo aprovado");
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  const ctx = buildContext();

  if (args.indexOf("--self-test") !== -1) {
    process.exitCode = runSelfTest(ctx);
    return;
  }

  const batchPath = args.find((a) => a.indexOf("--") !== 0);
  let items;
  let mode;
  if (batchPath) {
    mode = "lote";
    items = loadBatchFile(path.resolve(batchPath));
    if (!items.length) {
      console.log("ERRO: " + batchPath + " nao definiu nenhuma receita em window.RECIPES — formato de lote deve ser igual a data/*.js");
      process.exitCode = 1;
      return;
    }
    console.log("== validar-lote: " + batchPath + " (" + items.length + " receita(s)) ==\n");
  } else {
    mode = "acervo";
    items = ctx.acervo.map((i) => ({ catId: i.catId, recipe: i.recipe }));
    console.log("== validar-lote: acervo inteiro (" + items.length + " receitas) ==\n");
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  const warnByCode = {};
  items.forEach(({ catId, recipe }) => {
    const res = validateRecipe(ctx, catId, recipe, { checkCollisions: mode === "lote", selfTest: false });
    totalErrors += res.errors.length;
    totalWarnings += res.warnings.length;
    res.warnings.forEach((w) => { warnByCode[w.code] = (warnByCode[w.code] || 0) + 1; });
    // 7. dry-run de derivacao: no modo lote toda receita imprime as tags pra conferencia
    // humana; no modo acervo so quem tem problema aparece (398 blocos de tags = ruido)
    if (mode === "lote" || res.errors.length || res.warnings.length) {
      printResult(catId + "/" + (recipe.name || "(sem nome)"), res, { printDerived: mode === "lote" });
    }
  });

  // colisoes internas (dentro do proprio conjunto): nomes e slugs repetidos
  const seenName = {};
  const seenSlug = {};
  items.forEach(({ catId, recipe }) => {
    if (!isNonEmptyString(recipe.name)) return;
    const slug = ctx.TM.slugify(recipe.name);
    if (seenName[recipe.name]) {
      totalErrors++;
      console.log("- ERRO [NAME_COLLISION] nome repetido dentro do proprio conjunto: \"" + recipe.name + "\" (" + seenName[recipe.name] + " e " + catId + ")");
    } else if (seenSlug[slug]) {
      totalErrors++;
      console.log("- ERRO [SLUG_COLLISION] slug repetido dentro do proprio conjunto: \"" + slug + "\" (" + seenSlug[slug] + " e " + catId + "/" + recipe.name + ")");
    }
    seenName[recipe.name] = catId + "/" + recipe.name;
    seenSlug[slug] = catId + "/" + recipe.name;
  });
  if (mode === "acervo") {
    // getAllRecipesFlat ja desambigua slug repetido sufixando o catId; findDuplicateIds
    // acusa o que sobrou repetido mesmo depois disso
    const dupes = ctx.TM.findDuplicateIds();
    if (dupes.length) {
      totalErrors += dupes.length;
      console.log("- ERRO [SLUG_COLLISION] findDuplicateIds acusou ids repetidos no acervo: " + dupes.join(", "));
    }
  }

  console.log("\n== resumo (" + mode + ") ==");
  console.log("receitas validadas: " + items.length);
  console.log("erros: " + totalErrors);
  console.log("warnings: " + totalWarnings + (totalWarnings ? "  (" + Object.keys(warnByCode).map((c) => c + "=" + warnByCode[c]).join(", ") + ")" : ""));
  console.log(totalErrors ? "RESULTADO: REPROVADO" : "RESULTADO: APROVADO" + (totalWarnings ? " com warnings" : ""));
  process.exitCode = totalErrors ? 1 : 0;
}

main();
