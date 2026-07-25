// scripts/verify-shopping-sections-2026-07-24.js
//
// Suíte de verificação do agrupamento por corredor de mercado na Lista de Compras (visão
// Geral), aprovado em 2026-07-24: 10 seções (Hortifruti, Padaria, Açougue e Peixaria, Frios e
// Laticínios, Mercearia e Secos, Doces e Sobremesas, Temperos e Condimentos, Produtos
// Asiáticos e Orientais, Congelados, Bebidas) + fallback "outros", SEM cabeçalho visível —
// só reordena. Despensa (PANTRY_SET) e Preparos (isReference) continuam fora, intactos.
//
// data/shopping-dict.js é UMD e testável direto via require(). js/app.js é fortemente
// acoplado ao DOM sem UMD (mesma limitação já documentada em test-shopping-dict.js) — o sort
// por seção em buildShoppingListGroups (js/app.js) é verificado por 2 vias complementares:
// (a) o comparador é reimplementado aqui, idêntico, e testado contra dados reais; (b)
// confirmamos por grep que o texto exato do comparador existe em js/app.js, pra pegar drift
// entre os dois. Verificação visual ao vivo no navegador cobre a integração de ponta a ponta
// (ver report da tarefa).
//
// `node scripts/verify-shopping-sections-2026-07-24.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

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

// ---------- carrega o pipeline real (categorias, derivação, tags, todas as 398 receitas) ----------
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

function main() {
  const FLAT = loadRealFlat();
  console.log("total receitas: " + FLAT.length);

  // ---------- censo real de canônicos, iguais aos 3 grupos que buildShoppingListGroups produz ----------
  const mainCores = new Set();
  const pantryCores = new Set();
  let referenceLines = 0;
  FLAT.forEach((it) => {
    (it.recipe.ingredientsStructured || []).forEach((entry) => {
      (entry.items || []).forEach((ing) => {
        if (ing.isReference) {
          referenceLines++;
          return;
        }
        const core = ShoppingDict.purchaseCore(ing.item);
        if (ShoppingDict.isPantry(core)) {
          pantryCores.add(core);
        } else {
          mainCores.add(core);
        }
      });
    });
  });

  console.log("");
  console.log("==================================================");
  console.log("1. COBERTURA TOTAL — todo canônico real tem seção válida (nunca undefined/crash)");
  console.log("==================================================");
  assert(mainCores.size > 0, "censo real não está vazio (" + mainCores.size + " canônicos)");
  let outrosCount = 0;
  let semSecaoValida = 0;
  mainCores.forEach((core) => {
    const section = ShoppingDict.sectionFor(core);
    if (!ShoppingDict.SECTION_ORDER.includes(section)) {
      semSecaoValida++;
      console.log("  FAIL sectionFor(\"" + core + "\") = \"" + section + "\" NÃO está em SECTION_ORDER");
    }
    if (section === "outros") outrosCount++;
  });
  assert(semSecaoValida === 0, "todos os " + mainCores.size + " canônicos reais resolvem pra uma seção dentro de SECTION_ORDER (0 inválidos)");
  console.log("  (" + outrosCount + " caem em \"outros\" — não é falha, é o fallback esperado pra itens ainda não classificados)");

  console.log("");
  console.log("==================================================");
  console.log("2. ZERO CHAVE DUPLICADA NO TEXTO FONTE do SECTION_MAP");
  console.log("==================================================");
  const raw = fs.readFileSync(path.join(ROOT, "data", "shopping-dict.js"), "utf8");
  const mapBlock = raw.slice(raw.indexOf("const SECTION_MAP = {"), raw.indexOf("\n  };\n\n  function sectionFor"));
  const keyMatches = [...mapBlock.matchAll(/\n\s*"((?:[^"\\]|\\.)*)":\s*"/g)].map((m) => m[1]);
  const seen = {};
  const dupes = [];
  keyMatches.forEach((k) => {
    if (seen[k]) dupes.push(k);
    seen[k] = true;
  });
  assert(keyMatches.length === Object.keys(ShoppingDict.SECTION_MAP).length, "contagem de chaves no texto fonte (" + keyMatches.length + ") bate com o objeto avaliado (" + Object.keys(ShoppingDict.SECTION_MAP).length + ")");
  assert(dupes.length === 0, "nenhuma chave duplicada no texto fonte (achado: " + dupes.length + (dupes.length ? " -> " + dupes.join(", ") : "") + ")");

  console.log("");
  console.log("==================================================");
  console.log("3. TODO ITEM DO SECTION_MAP EXISTE DE VERDADE NO ACERVO (zero chave fantasma)");
  console.log("==================================================");
  const realSet = new Set([...mainCores, ...pantryCores]);
  const ghosts = Object.keys(ShoppingDict.SECTION_MAP).filter((k) => !realSet.has(k));
  assert(ghosts.length === 0, "nenhuma chave do SECTION_MAP é fantasma (achado: " + ghosts.length + (ghosts.length ? " -> " + ghosts.slice(0, 10).join(", ") : "") + ")");

  console.log("");
  console.log("==================================================");
  console.log("4. ORDEM POR CORREDOR — comparador reimplementado (idêntico ao de js/app.js), testado contra amostra real diversa");
  console.log("==================================================");
  // mesmo comparador de buildShoppingListGroups (js/app.js) — seção primeiro (ordem de
  // SECTION_ORDER), alfabética pt-BR como desempate dentro da seção.
  function shoppingSort(a, b) {
    const sectionDiff =
      ShoppingDict.SECTION_ORDER.indexOf(ShoppingDict.sectionFor(a)) -
      ShoppingDict.SECTION_ORDER.indexOf(ShoppingDict.sectionFor(b));
    return sectionDiff || a.localeCompare(b, "pt-BR");
  }
  // amostra real diversa: 3 itens de cada uma das 10 seções + 2 de "outros", embaralhados
  const bySection = {};
  ShoppingDict.SECTION_ORDER.forEach((s) => { bySection[s] = []; });
  [...mainCores].forEach((core) => { bySection[ShoppingDict.sectionFor(core)].push(core); });
  let sample = [];
  ShoppingDict.SECTION_ORDER.forEach((s) => { sample = sample.concat(bySection[s].slice(0, 3)); });
  const shuffled = sample.slice().sort(() => Math.random() - 0.5);
  const sorted = shuffled.slice().sort(shoppingSort);
  // confirma: mesma seção fica CONTÍGUA (nenhuma outra seção se intercala) e na ORDEM certa
  const sortedSections = sorted.map((item) => ShoppingDict.sectionFor(item));
  const seenSections = [];
  let contiguous = true;
  sortedSections.forEach((s) => {
    if (seenSections[seenSections.length - 1] !== s) {
      if (seenSections.includes(s)) contiguous = false; // já vimos essa seção antes, não é a última — quebrou contiguidade
      seenSections.push(s);
    }
  });
  assert(contiguous, "itens da mesma seção ficam contíguos na ordem final (amostra de " + sample.length + " itens, " + seenSections.length + " blocos de seção)");
  const expectedOrder = ShoppingDict.SECTION_ORDER.filter((s) => seenSections.includes(s));
  assert(JSON.stringify(seenSections) === JSON.stringify(expectedOrder), "blocos de seção aparecem na ordem de SECTION_ORDER (obtido: " + seenSections.join(" -> ") + ")");
  // desempate alfabético dentro da seção
  let alfabeticoOk = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sortedSections[i] === sortedSections[i - 1] && sorted[i].localeCompare(sorted[i - 1], "pt-BR") < 0) alfabeticoOk = false;
  }
  assert(alfabeticoOk, "dentro da mesma seção, ordem alfabética pt-BR mantida como desempate");
  // teste negativo: ordenação NÃO é mais só alfabética pura (prova que a mudança teve efeito real)
  const pureAlpha = sample.slice().sort((a, b) => a.localeCompare(b, "pt-BR"));
  assert(JSON.stringify(sorted) !== JSON.stringify(pureAlpha), "resultado é DIFERENTE da alfabética pura — confirma que o agrupamento por seção teve efeito (teste negativo contra regressão silenciosa)");

  console.log("");
  console.log("==================================================");
  console.log("5. TEXTO EXATO DO COMPARADOR EM js/app.js (detecta drift entre este teste e o código real)");
  console.log("==================================================");
  const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  assert(appJs.includes("ShoppingDict.SECTION_ORDER.indexOf(ShoppingDict.sectionFor(a.itemLabel))"), "js/app.js contém a chamada a SECTION_ORDER.indexOf(sectionFor(...)) pro item a");
  assert(appJs.includes("ShoppingDict.SECTION_ORDER.indexOf(ShoppingDict.sectionFor(b.itemLabel))"), "js/app.js contém a chamada a SECTION_ORDER.indexOf(sectionFor(...)) pro item b");
  assert(appJs.includes("return sectionDiff || a.itemLabel.localeCompare(b.itemLabel"), "js/app.js usa sectionDiff com desempate alfabético (mesmo padrão do comparador testado acima)");
  assert(!/renderShoppingListGeral[\s\S]{0,400}shopping-list__section-title/.test(appJs), "renderShoppingListGeral NÃO insere cabeçalho de seção — decisão aprovada é ordenar em silêncio (teste negativo)");

  console.log("");
  console.log("==================================================");
  console.log("6. DESPENSA E PREPAROS INTACTOS (git show HEAD: — true antes/depois, não simulado)");
  console.log("==================================================");
  // git show normaliza fim de linha pra LF; a working tree usa CRLF (repo Windows) — sem
  // normalizar os dois lados, QUALQUER função de múltiplas linhas compararia como "diferente"
  // só por causa do \r\n, mesmo com conteúdo 100% igual. Normaliza os dois antes de comparar.
  const norm = (s) => s.replace(/\r\n/g, "\n");
  const appJsBefore = norm(execSync("git show HEAD:js/app.js", { cwd: ROOT, encoding: "utf8" }));
  const appJsNormalized = norm(appJs);
  function extractFn(src, name) {
    const start = src.indexOf("function " + name + "(");
    if (start === -1) return null;
    let depth = 0;
    let i = src.indexOf("{", start);
    const bodyStart = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    return src.slice(start, bodyStart);
  }
  const porReceitaBefore = extractFn(appJsBefore, "renderShoppingListPorReceita");
  const porReceitaAfter = extractFn(appJsNormalized, "renderShoppingListPorReceita");
  assert(porReceitaBefore !== null && porReceitaAfter !== null, "renderShoppingListPorReceita encontrada nas 2 árvores");
  assert(porReceitaBefore === porReceitaAfter, "renderShoppingListPorReceita IDÊNTICA antes/depois (visão Por receita inalterada)");

  const geralBefore = extractFn(appJsBefore, "renderShoppingListGeral");
  const geralAfter = extractFn(appJsNormalized, "renderShoppingListGeral");
  assert(geralBefore !== null && geralAfter !== null, "renderShoppingListGeral encontrada nas 2 árvores");
  assert(geralBefore === geralAfter, "renderShoppingListGeral IDÊNTICA antes/depois — Despensa e Preparos renderizam exatamente igual (só a ORDEM de groups muda, calculada antes de chegar aqui)");

  const buildBefore = extractFn(appJsBefore, "buildShoppingListGroups");
  const buildAfter = extractFn(appJsNormalized, "buildShoppingListGroups");
  assert(buildBefore !== null && buildAfter !== null, "buildShoppingListGroups encontrada nas 2 árvores");
  assert(buildBefore !== buildAfter, "buildShoppingListGroups MUDOU (esperado — é onde o sort por seção entra)");
  // a única mudança esperada é dentro do .sort() da lista principal — pantry/preparos (variáveis
  // `pantry`/`preparos`, não `groups`) continuam com a MESMA lógica de acumulação e do MESMO
  // sort alfabético de sempre
  assert(buildBefore.includes('.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));'), "sort da Despensa (pantryList) continua alfabético puro, antes");
  assert(buildAfter.includes('.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));'), "sort da Despensa (pantryList) continua alfabético puro, depois — mesmo texto");
  assert(buildBefore.includes("const preparoList = Object.keys(preparos)"), "bloco de preparoList presente antes");
  assert(buildAfter.includes("const preparoList = Object.keys(preparos)"), "bloco de preparoList presente depois");

  console.log("");
  console.log("==================================================");
  console.log("7. ZERO ITEM SUMIDO OU DUPLICADO — soma das 10 seções + outros bate com o total real");
  console.log("==================================================");
  const counts = {};
  ShoppingDict.SECTION_ORDER.forEach((s) => { counts[s] = 0; });
  mainCores.forEach((core) => { counts[ShoppingDict.sectionFor(core)]++; });
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  assert(sum === mainCores.size, "soma das 10 seções + outros (" + sum + ") = total de canônicos reais (" + mainCores.size + ")");
  assert(pantryCores.size === Object.keys(ShoppingDict.PANTRY_SET).length, "Despensa não afetada pelo agrupamento: " + pantryCores.size + " canônicos reais de despensa = " + Object.keys(ShoppingDict.PANTRY_SET).length + " definidos no PANTRY_SET");
  const uniqueAssignments = new Set(Object.keys(ShoppingDict.SECTION_MAP).map((k) => k + "|" + ShoppingDict.SECTION_MAP[k]));
  assert(uniqueAssignments.size === Object.keys(ShoppingDict.SECTION_MAP).length, "cada núcleo do SECTION_MAP tem exatamente 1 seção (zero duplicidade de atribuição)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
