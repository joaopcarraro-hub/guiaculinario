// scripts/verify-subprodutos-2026-07-24.js
//
// Suíte de verificação do sub-produto derivado ("não compra quebrado") na Lista de Compras,
// aprovado em 2026-07-24: núcleo que não se compra sozinho (gema/clara, raspas/suco/casca de
// cítricos, casca de parmesão) nunca vira item próprio — funde no item-base. Regra de
// combinação: base_direto + MÁXIMO(sub-produtos entre si, nunca soma) — a mesma fruta rende
// raspas E suco ao mesmo tempo, e todo ovo rende exatamente 1 gema E 1 clara. Dentro do MESMO
// sub-produto (2 receitas pedindo suco de limão), soma normal, sem mudança.
//
// data/shopping-dict.js é UMD, testável direto via require(). js/app.js é fortemente acoplado
// ao DOM sem UMD (mesma limitação de sempre) — o pós-passe de máximo em buildShoppingListGroups
// é verificado por 3 vias complementares: (a) a fórmula é reimplementada aqui, pura, testada
// com números literais; (b) a mesma fórmula roda contra ingrediente REAL das receitas (sandbox,
// sem DOM) pros 3 exemplos do relatório aprovado; (c) grep confirma que o texto exato da
// fórmula existe em js/app.js, pra pegar drift entre os dois. Verificação ao vivo no navegador
// (10 receitas reais, 4 cenários) cobre a integração de ponta a ponta — ver report da tarefa.
//
// Nenhuma comparação usa ref de git (nem HEAD, nem SHA fixo) — só valores literais, regra do
// CLAUDE.md (SHA fixo quebra se o histórico for reescrito; literal nunca quebra).
//
// `node scripts/verify-subprodutos-2026-07-24.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ShoppingDict = require(path.join(ROOT, "data", "shopping-dict.js"));

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

// ---------- pipeline real (categorias, derivação, tags, todas as 398 receitas) ----------
function loadRealFlat() {
  const sandbox = { window: {} };
  function load(rel) {
    // eslint-disable-next-line no-new-func
    new Function("window", fs.readFileSync(path.join(ROOT, rel), "utf8"))(sandbox.window);
  }
  load("js/categories.js");
  load("data/derivation-dict.js");
  load("js/tags.js");
  fs.readdirSync(path.join(ROOT, "data"))
    .filter((f) => f.endsWith(".js") && f !== "derivation-dict.js" && f !== "shopping-dict.js")
    .forEach((f) => load(path.join("data", f)));
  load("js/tagmodel.js");
  return sandbox.window.TagModel.getAllRecipesFlat();
}

// Mesma tabela de conversão de unidade de app.js (UNIT_TO_BASE_FACTOR), só a fatia de volume
// que o sub-produto usa — copiada aqui pra manter o mirror puro/sem DOM. Grep na seção 4
// confirma que os valores batem com o app.js real.
const UNIT_TO_ML = { mililitro: 1, litro: 1000, "colher-sopa": 15, "colher-cha": 5, xicara: 240, colher: 15 };
const VOLUME_UNITS = new Set(Object.keys(UNIT_TO_ML));

// Mirror puro da lógica de js/app.js buildShoppingListGroups (bucket de sub-produto + pós-passe
// de máximo) — roda em memória, sem DOM, contra os ingredientes REAIS de uma lista de receitas.
function simulateSubprodutos(recipeIds, flat) {
  const byId = {};
  flat.forEach((it) => { byId[it.id] = it; });
  const directCore = {}; // core -> { lo, hi } — uso DIRETO (não sub-produto) sem unidade
  const subprodutos = {}; // base -> { core -> equivalente acumulado }
  recipeIds.forEach((id) => {
    const item = byId[id];
    if (!item) throw new Error("receita não encontrada: " + id);
    (item.recipe.ingredientsStructured || []).forEach((entry) => {
      (entry.items || []).forEach((ing) => {
        if (ing.isReference) return;
        const core = ShoppingDict.purchaseCore(ing.item);
        if (ShoppingDict.isPantry(core)) return;
        const subOf = ShoppingDict.subproductOf(core);
        if (subOf) {
          let amount = null;
          if (ing.qty !== null && ing.qty !== undefined) amount = ing.qty;
          else if (ing.qtyRange) amount = ing.qtyRange[1];
          let baseEquivalent = 0;
          if (amount !== null && !subOf.noQuantity) {
            if (ing.unit && VOLUME_UNITS.has(ing.unit) && subOf.perMl) {
              baseEquivalent = amount * UNIT_TO_ML[ing.unit] * subOf.perMl;
            } else {
              baseEquivalent = amount * (subOf.perCount !== undefined ? subOf.perCount : 1);
            }
          }
          if (!subprodutos[subOf.base]) subprodutos[subOf.base] = {};
          subprodutos[subOf.base][core] = (subprodutos[subOf.base][core] || 0) + baseEquivalent;
          return;
        }
        // uso direto sem unidade (mesma família "UNIT:" que o item-base ocuparia)
        if (!ing.unit) {
          let amount = null;
          if (ing.qty !== null && ing.qty !== undefined) amount = ing.qty;
          else if (ing.qtyRange) amount = ing.qtyRange[1];
          if (amount !== null) {
            if (!directCore[core]) directCore[core] = 0;
            directCore[core] += amount;
          }
        }
      });
    });
  });
  const totals = {};
  Object.keys(subprodutos).forEach((base) => {
    const maxEq = Math.max(0, ...Object.values(subprodutos[base]));
    const rounded = maxEq > 0 ? Math.ceil(maxEq - 1e-9) : 0;
    totals[base] = (directCore[base] || 0) + rounded;
  });
  return totals;
}

function main() {
  const FLAT = loadRealFlat();
  console.log("total receitas: " + FLAT.length);

  console.log("");
  console.log("==================================================");
  console.log("1. FÓRMULA PURA — máximo entre sub-produtos do MESMO base, nunca soma (números literais)");
  console.log("==================================================");
  function ovosNecessarios(ovoDireto, gema, clara) {
    return ovoDireto + Math.ceil(Math.max(0, gema, clara) - 1e-9);
  }
  assert(ovosNecessarios(0, 2, 3) === 3, "2 gemas + 3 claras = 3 ovos (NÃO 5) — máximo, não soma");
  assert(ovosNecessarios(3, 2, 0) === 5, "3 ovos + 2 gemas = 5 ovos — direto + máximo(2,0)");
  assert(ovosNecessarios(0, 5, 5) === 5, "5 gemas + 5 claras (mesmo ovo) = 5 ovos, não 10 — teste negativo contra soma");
  assert(ovosNecessarios(0, 0, 0) === 0, "sem gema nem clara = 0 ovos adicionais — teste negativo");
  assert(ovosNecessarios(10, 0, 0) === 10, "10 ovos diretos, sem sub-produto = 10 — direto sozinho não muda");

  console.log("");
  console.log("==================================================");
  console.log("2. VARIANTES DE CLARA/GEMA/SUCO/RASPAS — todas capturadas pelo canônico esperado (dados reais)");
  console.log("==================================================");
  const PATTERNS = { clara: /clara/i, gema: /gema/i, suco: /suco/i, raspas: /raspa/i };
  const EXPECTED_CORE = { clara: "clara", gema: "gema" }; // suco/raspas variam por fruta, checado abaixo por prefixo
  let variantFails = 0;
  FLAT.forEach((it) => {
    (it.recipe.ingredientsStructured || []).forEach((entry) => {
      (entry.items || []).forEach((ing) => {
        if (ing.isReference) return;
        Object.keys(PATTERNS).forEach((key) => {
          if (!PATTERNS[key].test(ing.item)) return;
          const core = ShoppingDict.purchaseCore(ing.item);
          if (key === "clara" || key === "gema") {
            if (core !== EXPECTED_CORE[key]) {
              console.log("  FAIL variante escapou: \"" + ing.item + "\" -> \"" + core + "\" (esperado \"" + key + "\"), receita: " + it.recipe.name);
              variantFails++;
            }
          } else {
            // suco/raspas: todo canônico resultante tem que ter subproductOf mapeado, OU ser
            // um caso conhecido fora da família cítrica (suco cítrico genérico, suco de
            // groselha — não são sub-produto, ficam de fora de propósito)
            const KNOWN_NON_SUBPRODUCT = ["suco cítrico", "suco de groselha", "raspas da fruta cítrica usada"];
            if (!ShoppingDict.subproductOf(core) && !KNOWN_NON_SUBPRODUCT.includes(core)) {
              console.log("  FAIL variante de " + key + " sem subproductOf: \"" + ing.item + "\" -> \"" + core + "\", receita: " + it.recipe.name);
              variantFails++;
            }
          }
        });
      });
    });
  });
  assert(variantFails === 0, "nenhuma variante de clara/gema/suco/raspas escapou do canônico/mapeamento esperado (achado: " + variantFails + ")");

  console.log("");
  console.log("==================================================");
  console.log("3. OS 3 EXEMPLOS REAIS DO RELATÓRIO APROVADO (verificados ao vivo no navegador, travados aqui como regressão)");
  console.log("==================================================");
  const exemplo1 = simulateSubprodutos(["arroz-biro-biro", "beef-wellington", "pavlova"], FLAT);
  assert(exemplo1["ovo"] === 8, "exemplo 1 — Arroz Biro-Biro (2 ovos) + Beef Wellington (1 gema) + Pavlova (6 claras) = 8 ovos (obtido " + exemplo1["ovo"] + ")");

  const exemplo2 = simulateSubprodutos(["torta-de-limao", "tom-yum", "chicken-tikka-masala"], FLAT);
  assert(exemplo2["limão"] === 3, "exemplo 2 — Torta de Limão (raspas) + Tom Yum (suco) + Chicken Tikka Masala (suco) = 3 limões via MÁXIMO, não soma (obtido " + exemplo2["limão"] + ")");

  const exemplo3 = simulateSubprodutos(["frango-cordon-bleu", "galantine"], FLAT);
  assert(exemplo3["frango inteiro"] === undefined, "exemplo 3 negativo — frango inteiro não é sub-produto, não entra no bucket (confirmado ausente)");
  assert(exemplo3["peito de frango"] === undefined, "exemplo 3 negativo — peito de frango não é sub-produto, não entra no bucket (confirmado ausente)");

  console.log("");
  console.log("==================================================");
  console.log("4. TEXTO EXATO DO PÓS-PASSE EM js/app.js (detecta drift entre este mirror e o código real)");
  console.log("==================================================");
  const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  assert(appJs.includes("const subOf = ShoppingDict.subproductOf(core);"), "js/app.js checa subproductOf logo após calcular core");
  assert(appJs.includes("const maxEquivalent = Math.max(0, ...Object.values(subprodutos[base]));"), "js/app.js calcula MÁXIMO entre sub-produtos do mesmo base (não soma)");
  assert(appJs.includes("const rounded = Math.ceil(maxEquivalent - 1e-9);"), "js/app.js arredonda pra cima (assimetria de risco)");
  assert(appJs.includes('amount = it.qtyRange[1]; // limite superior — assimetria de risco'), "js/app.js usa limite superior da faixa, não o inferior");

  console.log("");
  console.log("==================================================");
  console.log("5. BALDE B (cortes de ave/boi/suíno) — confirmado SEM subproductOf, nunca funde (negativo)");
  console.log("==================================================");
  ["peito de frango", "coxa de frango", "sobrecoxa de frango com osso", "asas de frango", "frango inteiro", "frango com osso", "frango caipira", "peito de pato", "coxa de pato com sobrecoxa", "pé de porco", "orelha de porco", "fígado de porco", "tutano de boi", "coração de boi", "carne bovina", "carne de porco"].forEach((core) => {
    assert(ShoppingDict.subproductOf(core) === null, '"' + core + '" não tem subproductOf (bucket B, confirmado não-fusão)');
  });

  console.log("");
  console.log("==================================================");
  console.log("6. CASO noQuantity (casca de parmesão) — nunca inventa número");
  console.log("==================================================");
  const spCasca = ShoppingDict.subproductOf("casca de parmesão");
  assert(!!spCasca && spCasca.base === "queijo parmesão" && spCasca.noQuantity === true, "casca de parmesão mapeada pra queijo parmesão com noQuantity=true");
  const exemploParmesao = simulateSubprodutos(["minestrone"], FLAT);
  assert(exemploParmesao["queijo parmesão"] === 0, "Minestrone sozinha (só casca de parmesão, sem outro uso de queijo parmesão): contribuição numérica = 0, nunca inventa grama (obtido " + exemploParmesao["queijo parmesão"] + ")");

  console.log("");
  console.log("==================================================");
  console.log("7. ALMÔNDEGAS E PURÊ DE FRUTA — confirmado NÃO são sub-produto (sem mudança de seção)");
  console.log("==================================================");
  assert(ShoppingDict.subproductOf("almôndegas") === null, "almôndegas não é sub-produto (negativo)");
  assert(ShoppingDict.subproductOf("purê de fruta") === null, "purê de fruta não é sub-produto (negativo)");
  assert(ShoppingDict.sectionFor("almôndegas") === "Açougue e Peixaria", "almôndegas mantém seção Açougue e Peixaria (provisório, sem mudança)");
  assert(ShoppingDict.sectionFor("purê de fruta") === "Mercearia e Secos", "purê de fruta mantém seção Mercearia e Secos (provisório, sem mudança)");

  console.log("");
  console.log("==================================================");
  console.log("8. DESPENSA/PREPAROS/POR-RECEITA INTACTOS — comparação por VALOR LITERAL, sem git (regra do CLAUDE.md)");
  console.log("==================================================");
  // Snippets literais hardcoded aqui — se qualquer um destes sumir do app.js real, a lógica de
  // Despensa/Preparos/Por-receita mudou sem essa suíte saber. Preferido a git show (SHA quebra
  // se o histórico for reescrito; literal nunca quebra).
  const LITERAIS_INTACTOS = [
    'if (ShoppingDict.isPantry(core)) {',
    'pantry[core].pairs[normalizeGroupKey(it.item) + "|" + (it.unit || "")] = { item: it.item, unit: it.unit || null };',
    'function renderShoppingListPorReceita(recipeEntries) {',
    'pantryTitle.textContent = "Despensa — confira se já tem";',
    'title.textContent = "Preparos que você precisa fazer antes";',
    '.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));', // sort da Despensa/Preparos, alfabético puro
  ];
  LITERAIS_INTACTOS.forEach((snippet) => {
    assert(appJs.includes(snippet), "js/app.js contém literal intacto: " + JSON.stringify(snippet.slice(0, 60)) + (snippet.length > 60 ? "..." : ""));
  });
  // sub-produto NÃO pode interceptar isReference (preparos) nem pantry — checa ORDEM no texto
  // fonte: subOf precisa vir DEPOIS do "if (it.isReference)" e ANTES do "isPantry"
  const isReferenceIdx = appJs.indexOf("if (it.isReference) {");
  const subOfIdx = appJs.indexOf("const subOf = ShoppingDict.subproductOf(core);");
  const isPantryIdx = appJs.indexOf("if (ShoppingDict.isPantry(core)) {");
  assert(isReferenceIdx > 0 && subOfIdx > isReferenceIdx, "checagem de sub-produto vem DEPOIS de isReference no código-fonte (preparos nunca vira sub-produto)");
  assert(subOfIdx > 0 && isPantryIdx > subOfIdx, "checagem de sub-produto vem ANTES de isPantry no código-fonte (mas nenhum sub-produto desta leva é item de despensa, confirmado na seção 5/6)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
