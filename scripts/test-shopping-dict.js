// scripts/test-shopping-dict.js
//
// Suíte de teste versionada do dicionário de compras (data/shopping-dict.js) e da migração
// boughtKeys v1→v2 (js/storage.js). Reconstrói os ~781 testes (750 dicionário + 31 migração)
// escritos numa sessão anterior como script avulso e nunca commitados — nunca mais deve
// acontecer (ver nota em CLAUDE.md). Roda via `node scripts/test-shopping-dict.js`, sem
// dependência externa (mesmo padrão zero-dependência de derive-tags-dry-run.js/
// derive-equipment-dry-run.js) — sai com código 1 se qualquer teste falhar, pra poder entrar
// num hook/CI depois sem trabalho extra.
//
// Não reproduz os mesmos 781 casos originais (perdidos) — cobre as MESMAS classes de risco,
// com casos reais do acervo (data/*.js), organizadas em 6 seções:
//   1. Fusões positivas (variantes que DEVEM fundir no mesmo núcleo de compra)
//   2. Negativos (o mais importante — produtos que parecem a mesma coisa mas NÃO são)
//   3. Idempotência (rodar o pipeline 2x dá o mesmo resultado — todo valor de CANONICAL é
//      ponto fixo, varrido automaticamente, não só uma amostra)
//   4. PANTRY_SET (Despensa) — quem entra, quem fica de fora por decisão explícita
//   5. Conversão de unidade de venda (Fase 3B) — colher/xícara nunca sobrevive como unidade
//      final pro sólido tabelado, contagem de embalagem arredonda pra cima
//   6. Migração boughtKeys v1→v2 (js/storage.js) — colisão funde sem perda, chave malformada
//      é preservada intacta, versão desconhecida reseta pro vazio
//
// A conversão de líquido pra ml/L (tabela em js/app.js, não exportada — 15/5/240 por
// colher-sopa/colher-cha/xícara) e o arredondamento de contagem na visão Geral NÃO entram
// aqui: app.js está fortemente acoplado ao DOM, sem UMD, então não dá pra `require()` limpo
// como shopping-dict.js/storage.js. Essa parte foi verificada ao vivo no navegador (ver
// report da tarefa), não neste script.

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..");
const ShoppingDict = require(path.join(ROOT, "data", "shopping-dict.js"));

// ---------- Harness mínimo (sem dependência externa) ----------
let passCount = 0;
let failCount = 0;
const failures = [];
const sectionCounts = []; // [{ name, count }] na ordem em que as seções rodam
let currentSection = "";

function section(name) {
  currentSection = name;
  sectionCounts.push({ name, count: 0 });
}

function test(description, fn) {
  if (sectionCounts.length) sectionCounts[sectionCounts.length - 1].count++;
  try {
    fn();
    passCount++;
  } catch (e) {
    failCount++;
    failures.push({ section: currentSection, description, error: e.message });
  }
}

function assertMerge(a, b, expectedCore) {
  test('"' + a + '" e "' + b + '" fundem em "' + expectedCore + '"', () => {
    const coreA = ShoppingDict.purchaseCore(a);
    const coreB = ShoppingDict.purchaseCore(b);
    assert.strictEqual(coreA, expectedCore, 'purchaseCore("' + a + '") = "' + coreA + '", esperado "' + expectedCore + '"');
    assert.strictEqual(coreB, expectedCore, 'purchaseCore("' + b + '") = "' + coreB + '", esperado "' + expectedCore + '"');
  });
}

function assertDistinct(a, b) {
  test('"' + a + '" e "' + b + '" NAO fundem', () => {
    const coreA = ShoppingDict.purchaseCore(a);
    const coreB = ShoppingDict.purchaseCore(b);
    assert.notStrictEqual(
      coreA,
      coreB,
      'purchaseCore("' + a + '") = purchaseCore("' + b + '") = "' + coreA + '" — deveriam ser diferentes'
    );
  });
}

// ========================================================================
// 1. FUSÕES POSITIVAS — variantes que DEVEM fundir
// ========================================================================
section("1. Fusões positivas");

// Fusões ORDENADAS (genérico assume o rótulo específico)
assertMerge("azeite", "azeite de oliva", "azeite extra virgem");
assertMerge("azeite de oliva extra virgem", "azeite extra", "azeite extra virgem");
assertMerge("leite", "leite morno", "leite integral");
assertMerge("manteiga", "manteiga extra", "manteiga sem sal");
assertMerge("frango", "frango", "frango inteiro");
assertMerge("óleo", "óleo", "óleo neutro");
assertMerge("arroz", "arroz cru", "arroz branco");
assertMerge("vinagre", "vinagre", "vinagre branco");
assertMerge("pimenta", "pimenta-do-reino preta", "pimenta-do-reino");
assertMerge("pimenta-do-reino grossa", "pimenta", "pimenta-do-reino");
assertMerge("iogurte natural", "iogurte natural", "iogurte natural integral");
assertMerge("cogumelos", "cogumelos frescos", "cogumelos paris");
assertMerge("peito", "peito", "peito de frango");
assertMerge("vinho branco", "vinho branco", "vinho branco seco");
assertMerge("páprica", "páprica", "páprica doce");
assertMerge("canela", "canela", "canela em pó");
assertMerge("lombo", "lombo", "lombo de porco");

// Plural / grafia (a lista real usa "cebola pequena", "batatas médias" etc. — camada 3 some
// com "pequena"/"médias" antes da consulta de plural bater)
assertMerge("cebolas", "cebola pequena", "cebola");
assertMerge("tomates", "tomates", "tomate");
assertMerge("tomates cereja", "tomates cereja", "tomate cereja");
assertMerge("batatas", "batatas médias", "batata");
assertMerge("ovos", "ovos inteiros", "ovo");
assertMerge("gemas", "gemas frescas", "gema");
assertMerge("claras", "claras de ovo", "clara");
assertMerge("cenouras", "cenouras", "cenoura");
assertMerge("camarões", "camarão fresco", "camarão");
assertMerge("limões", "limões", "limão");
assertMerge("berinjelas", "berinjelas", "berinjela");
assertMerge("mexilhões", "mexilhões", "mexilhão");
assertMerge("pepinos", "pepinos", "pepino");
assertMerge("filés mignon", "filé mignon fresco", "filé mignon");
assertMerge("joelhos de porco", "joelhos de porco", "joelho de porco");
assertMerge("maços de salsinha", "maço de salsinha", "maço de salsinha");
assertMerge("pães", "pão amanhecido", "pão");
assertMerge("cabeças de alho", "cabeças de alho", "cabeça de alho");

// Paralelas → genérico
assertMerge("vinho tinto seco", "vinho tinto encorpado", "vinho tinto");
assertMerge("fundo escuro", "fundo de carne", "fundo escuro de carne");
assertMerge("frango com osso e pele", "frango com osso e pele", "frango com osso");
assertMerge("lombo de porco assado", "lombo de porco inteiro", "lombo de porco");
assertMerge("pernil de porco com pele", "pernil de porco com pele e osso", "pernil de porco");

// Ervas: "fresco/fresca" redundante (decidido caso a caso, nunca STRIP_WORD genérico)
assertMerge("salsinha fresca", "salsinha fresca", "salsinha");
assertMerge("coentro fresco", "coentro fresco", "coentro");
assertMerge("hortelã fresca", "folhas de hortelã", "hortelã");
assertMerge("manjericão fresco", "manjericão fresco", "manjericão");
assertMerge("gengibre fresco", "gengibre fresco", "gengibre");
assertMerge("espinafre fresco", "folhas de espinafre", "espinafre");
assertMerge("alecrim fresco", "alecrim fresco", "alecrim");
assertMerge("estragão fresco", "estragão fresco", "estragão");

// Colaterais da auditoria de cobertura (2026-07-23) — grafia/sinônimo do mesmo produto
assertMerge("pimenta-caiena", "pimenta-caiena", "pimenta caiena");
assertMerge("flocos de pimenta", "flocos de pimenta", "pimenta em flocos");
assertMerge("açafrão-da-terra", "açafrão-da-terra", "cúrcuma");
assertMerge("parmesão", "parmesão", "queijo parmesão");
assertMerge("salsa", "salsa", "salsinha");
assertMerge("aipo", "aipo", "salsão");
assertMerge("negi", "negi", "cebolinha grossa");

// Redundância cultural (o genérico É o específico no Brasil)
assertMerge("cominho em pó", "cominho em pó", "cominho");
assertMerge("orégano seco", "orégano seco", "orégano");
assertMerge("acém bovino", "acém bovino", "acém");
assertMerge("carne suína", "carne suína", "carne de porco");
assertMerge("molho shoyu", "molho shoyu", "shoyu");
assertMerge("pão árabe", "pão árabe", "pão pita");
assertMerge("vinho de arroz shaoxing", "vinho de arroz shaoxing", "vinho shaoxing");
assertMerge("creme de confeiteiro", "creme de confeiteiro", "crème pâtissière");

// Parênteses (camada 1) — nota de uso nunca é identidade
assertMerge("azeite (para untar)", "azeite", "azeite extra virgem");
assertMerge("cebola (picada)", "cebolas", "cebola");

// ========================================================================
// 2. NEGATIVOS — o mais importante: o que NÃO pode fundir
// ========================================================================
section("2. Negativos (não pode fundir)");

// Manteiga clarificada é produto DIFERENTE de manteiga (sem sal) — nunca fundir
assertDistinct("manteiga clarificada", "manteiga");
assertDistinct("manteiga clarificada", "manteiga extra");

// Creme de leite FRESCO (nata) é produto diferente do creme de leite de lata/caixinha
assertDistinct("creme de leite fresco", "creme de leite");
assertDistinct("creme de leite fresco por ramequim", "creme de leite");

// Cortes de proteína ficam separados — peito ≠ coxa, lombo ≠ pernil
assertDistinct("peito de frango", "coxa de frango");
assertDistinct("peito de frango grandes", "coxas de pato com sobrecoxa");
assertDistinct("lombo de porco", "pernil de porco");
assertDistinct("lombo", "pernil de cordeiro");
assertDistinct("lombo de porco assado", "pernil de porco com pele");

// Carne seca (desidratada) ≠ carne de sol (salgada, processo diferente)
assertDistinct("carne seca dessalgada", "carne de sol");
assertDistinct("carne seca", "carne de sol, dessalgada");

// Batata frita (acompanhamento pronto/montagem) ≠ batata crua — nenhuma receita frita no
// próprio passo, é ingrediente comprado pronto (Gyros/decisão 2026-07-23)
assertDistinct("batata frita", "batata");
assertDistinct("batata frita", "batatas médias");
assertDistinct("batata frita, cortada em palitos e frita (batata frita crocante)".replace(/\s*\([^)]*\)/g, ""), "batata");

// Tortilla frita (tostada, produto comprado pronto) ≠ tortilla crua de milho/trigo
assertDistinct("tortillas fritas (tostadas)", "tortillas de milho");
assertDistinct("tortillas fritas (tostadas)", "tortilla de trigo");

// Açafrão (pistilo, Crocus sativus) ≠ açafrão-da-terra/cúrcuma (raiz, Curcuma longa) — nomes
// parecidos, produtos e preços completamente diferentes
assertDistinct("açafrão", "açafrão-da-terra");
assertDistinct("açafrão", "cúrcuma");

// Tofu firme ≠ tofu macio/silken — textura muda o uso culinário, produto diferente na prateleira
assertDistinct("tofu firme", "tofu macio (silken tofu)".replace(/\s*\([^)]*\)/g, ""));
assertDistinct("tofu firme", "tofu macio (silken ou firme)".replace(/\s*\([^)]*\)/g, ""));

// Wasabi (em si) vs wasabi fresco — "fresco" nunca é stripado mecanicamente (regra geral do
// dicionário), então formas diferentes de wasabi ficam separadas em vez de coalescer errado
assertDistinct("wasabi", "wasabi fresco");

// Sal comum ≠ sal grosso ≠ sal em flocos — "grosso" nunca é descritor genérico aqui (são
// produtos com granulometria/uso de compra diferentes, todos ficam na Despensa MAS distintos)
assertDistinct("sal", "sal grosso");
assertDistinct("sal", "sal em flocos");

// Sanidade: cores de vinho e pimentas nunca colidem entre si
assertDistinct("vinho branco seco", "vinho tinto");
assertDistinct("pimenta-do-reino", "pimenta caiena");
assertDistinct("pimenta-do-reino", "pimenta-caiena");

// ========================================================================
// 3. IDEMPOTÊNCIA — pipeline rodado 2x dá o mesmo resultado
// ========================================================================
section("3. Idempotência");

// Propriedade geral: qualquer entrada, rodar purchaseCore no resultado dá o MESMO resultado
// de novo (o core já é o ponto de chegada do pipeline).
const IDEMPOTENCE_SAMPLE = [
  "azeite", "azeite de oliva", "leite morno", "cebolas", "manteiga clarificada",
  "creme de leite fresco", "peito de frango", "lombo de porco", "carne de sol",
  "batata frita", "tortillas fritas (tostadas)", "açafrão", "tofu firme", "wasabi fresco",
  "sal grosso", "pimenta-caiena", "vinho branco", "farinha de trigo", "arroz branco",
];
IDEMPOTENCE_SAMPLE.forEach((raw) => {
  test('idempotência: purchaseCore(purchaseCore("' + raw + '")) === purchaseCore("' + raw + '")', () => {
    const once = ShoppingDict.purchaseCore(raw);
    const twice = ShoppingDict.purchaseCore(once);
    assert.strictEqual(twice, once, 'rodar 2x: "' + once + '" -> "' + twice + '"');
  });
});

// Varredura EXAUSTIVA (não só amostra): todo VALOR do mapa CANONICAL precisa ser ponto fixo —
// é a garantia estrutural que o próprio arquivo documenta ("Valores devem ser pontos fixos").
// Cresce sozinho conforme o dicionário cresce, sem precisar adicionar caso por caso.
const canonicalValues = Array.from(new Set(Object.values(ShoppingDict.CANONICAL)));
canonicalValues.forEach((value) => {
  test('ponto fixo: purchaseCore("' + value + '") === "' + value + '" (valor do CANONICAL)', () => {
    assert.strictEqual(ShoppingDict.purchaseCore(value), value);
  });
});

// ========================================================================
// 4. PANTRY_SET — Despensa
// ========================================================================
section("4. PANTRY_SET (Despensa)");

["sal", "sal grosso", "sal em flocos", "sal não iodado", "pimenta-do-reino", "pimenta-do-reino em grãos", "pimenta-do-reino branca", "pimenta branca", "azeite extra virgem", "óleo neutro", "vinagre branco", "água"].forEach((core) => {
  test('isPantry("' + core + '") === true', () => {
    assert.strictEqual(ShoppingDict.isPantry(core), true);
  });
});

// Decisão EXPLÍCITA de ficar fora (quantidade típica muda a compra de verdade) — os 5 citados
// no próprio comentário do arquivo, mais especialidades que também não entram
["farinha de trigo", "açúcar", "manteiga sem sal", "arroz branco", "leite integral", "azeite leve", "óleo de gergelim", "vinagre de xerez", "vinagre balsâmico"].forEach((core) => {
  test('isPantry("' + core + '") === false', () => {
    assert.strictEqual(ShoppingDict.isPantry(core), false);
  });
});

// ========================================================================
// 5. CONVERSÃO DE UNIDADE DE VENDA (Fase 3B)
// ========================================================================
section("5. Conversão de unidade de venda");

test('spoonToGram("açúcar", "colher-sopa") === 12', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("açúcar", "colher-sopa"), 12);
});
test('spoonToGram("açúcar", "colher-cha") === 4', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("açúcar", "colher-cha"), 4);
});
test('spoonToGram("açúcar", "xicara") === 180', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("açúcar", "xicara"), 180);
});
test('spoonToGram("farinha de trigo", "colher-sopa") === 8', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("farinha de trigo", "colher-sopa"), 8);
});
test('spoonToGram("farinha de trigo", "xicara") === 120', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("farinha de trigo", "xicara"), 120);
});
test('spoonToGram("manteiga sem sal", "colher-cha") === 5 (valor tabelado, não fallback)', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("manteiga sem sal", "colher-cha"), 5);
});
test('spoonToGram("arroz branco", "xicara") === 200', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("arroz branco", "xicara"), 200);
});
// Fallback colher-chá = cs/3 arredondado, quando só "cs" está tabelado
test('spoonToGram("passas", "colher-cha") usa fallback cs/3 (10/3 -> 3)', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("passas", "colher-cha"), 3);
});
test('spoonToGram("banha", "colher-cha") usa fallback cs/3 (13/3 -> 4)', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("banha", "colher-cha"), 4);
});
// Núcleo fora da tabela -> null (sem conversão, nunca inventa número)
test('spoonToGram("abacate", "colher-sopa") === null (fora da tabela)', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("abacate", "colher-sopa"), null);
});
test('spoonToGram("açúcar", "grama") === null (unit não é colher/xícara)', () => {
  assert.strictEqual(ShoppingDict.spoonToGram("açúcar", "grama"), null);
});

// Invariante estrutural: colher/xícara NUNCA sobrevive como unidade final pro sólido
// tabelado — todo núcleo em SPOON_TO_GRAM converte em gramas por PELO MENOS uma das 3
// unidades (alguns, como "arroz japonês"/"arroz basmati", só têm "xic" — ninguém mede arroz
// cru por colher — então cs/cc sozinhos não podem ser exigidos aqui)
test("todo núcleo de SPOON_TO_GRAM converte em pelo menos 1 das 3 unidades (cs/cc/xícara)", () => {
  Object.keys(ShoppingDict.SPOON_TO_GRAM).forEach((core) => {
    const cs = ShoppingDict.spoonToGram(core, "colher-sopa");
    const cc = ShoppingDict.spoonToGram(core, "colher-cha");
    const xic = ShoppingDict.spoonToGram(core, "xicara");
    assert.ok(cs !== null || cc !== null || xic !== null, 'núcleo "' + core + '" não converte em nenhuma das 3 unidades');
  });
});

// Invariante: núcleos LÍQUIDOS conhecidos nunca entram em SPOON_TO_GRAM (líquido vira ml/L
// direto em js/app.js, nunca por esta tabela — ver comentário no arquivo)
["leite integral", "azeite extra virgem", "vinho tinto", "vinho branco seco", "shoyu", "mirin", "sake", "dashi", "fundo escuro de carne", "água", "vinagre branco", "óleo neutro"].forEach((liquidCore) => {
  test('"' + liquidCore + '" (líquido) NÃO está em SPOON_TO_GRAM', () => {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(ShoppingDict.SPOON_TO_GRAM, liquidCore), false);
  });
});

// Ervas em colherada viram "sem quantidade" (maço é a unidade de venda real) — nunca gramas
["salsinha", "cebolinha", "endro", "hortelã", "alecrim", "estragão", "raspas de limão"].forEach((core) => {
  test('isSpoonNoQuantity("' + core + '") === true', () => {
    assert.strictEqual(ShoppingDict.isSpoonNoQuantity(core), true);
  });
});
["farinha de trigo", "açúcar", "manteiga sem sal"].forEach((core) => {
  test('isSpoonNoQuantity("' + core + '") === false', () => {
    assert.strictEqual(ShoppingDict.isSpoonNoQuantity(core), false);
  });
});

// Embalagem de tamanho universal — tomate pelado vira contagem de lata (arredonda pra cima é
// responsabilidade de js/app.js; aqui só confirma o tamanho/rótulo da embalagem)
test('packageFor("tomate pelado") === {grams:400, label:"lata", labelPlural:"latas"}', () => {
  const pkg = ShoppingDict.packageFor("tomate pelado");
  assert.ok(pkg, "packageFor não devolveu nada");
  assert.strictEqual(pkg.grams, 400);
  assert.strictEqual(pkg.label, "lata");
  assert.strictEqual(pkg.labelPlural, "latas");
});
// Fora de PACKAGE_SIZE por decisão explícita (variação real de tamanho por marca) — nunca vira
// contagem de embalagem, continua em g/ml
["leite de coco", "creme de leite", "azeitonas pretas", "alcaparras"].forEach((core) => {
  test('packageFor("' + core + '") === null (variação real de tamanho, decisão 2026-07-23)', () => {
    assert.strictEqual(ShoppingDict.packageFor(core), null);
  });
});

// ========================================================================
// 6. MIGRAÇÃO boughtKeys v1→v2 (js/storage.js)
// ========================================================================
// storage.js não é UMD (é um IIFE de navegador puro, window.Storage = {...}) — carregado aqui
// no mesmo sandbox de window+localStorage fake que os outros scripts de auditoria do projeto
// usam pra data/*.js. window.ShoppingDict é o MESMO módulo real já carregado acima (require),
// nunca uma cópia — testa a migração de verdade, não uma reimplementação.
section("6. Migração boughtKeys v1→v2");

function makeFakeLocalStorage(initial) {
  const store = Object.assign({}, initial);
  const writes = [];
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
      writes.push({ key: k, value: String(v) });
    },
    removeItem: (k) => {
      delete store[k];
    },
    _writes: writes,
  };
}

function loadStorageSandbox(seedShoppingListV1) {
  const code = fs.readFileSync(path.join(ROOT, "js", "storage.js"), "utf8");
  const fakeLocalStorage = makeFakeLocalStorage(
    seedShoppingListV1 ? { "gusta-lista-compras-v1": JSON.stringify(seedShoppingListV1) } : {}
  );
  const sandboxWindow = { ShoppingDict: ShoppingDict };
  // eslint-disable-next-line no-new-func
  const fn = new Function("window", "localStorage", code);
  fn(sandboxWindow, fakeLocalStorage);
  return { Storage: sandboxWindow.Storage, localStorage: fakeLocalStorage };
}

function lastPersistedShoppingList(fakeLocalStorage) {
  const writes = fakeLocalStorage._writes.filter((w) => w.key === "gusta-lista-compras-v1");
  assert.ok(writes.length > 0, "nenhum save de gusta-lista-compras-v1 foi observado");
  return JSON.parse(writes[writes.length - 1].value);
}

// 6a. Colisão funde sem perda: "azeite|" e "azeite de oliva|" (ambos true) viram a MESMA
// chave nova ("azeite extra virgem|") — as 2 receitas que geraram cada uma já estavam
// compradas, então o merge não perde informação nenhuma.
test("migração v1->v2: colisão de azeite/azeite de oliva funde em 1 chave, sem perda", () => {
  const { Storage, localStorage } = loadStorageSandbox({
    version: 1,
    recipes: {},
    boughtKeys: { "azeite|": true, "azeite de oliva|": true },
  });
  assert.strictEqual(Storage.isShoppingItemBought("azeite extra virgem", ""), true);
  // força 1 save pra poder inspecionar o JSON persistido de verdade (nenhuma escrita
  // automática acontece só ao carregar — só em mutações públicas)
  Storage.addRecipeToShoppingList("_teste_", 1, []);
  const persisted = lastPersistedShoppingList(localStorage);
  assert.strictEqual(persisted.version, 2);
  assert.strictEqual(persisted.boughtKeys["azeite extra virgem|"], true);
  assert.strictEqual(Object.keys(persisted.boughtKeys).length, 1, "as 2 chaves antigas deveriam virar 1 só");
});

// 6b. Chave válida simples migra corretamente (unit conhecida, núcleo já canônico)
test("migração v1->v2: chave válida simples (sal|pitada) migra sem mudar de forma", () => {
  const { Storage } = loadStorageSandbox({
    version: 1,
    recipes: {},
    boughtKeys: { "sal|pitada": true },
  });
  assert.strictEqual(Storage.isShoppingItemBought("sal", "pitada"), true);
});

// 6c. Chave malformada (sem "|") é PRESERVADA intacta, nunca descartada silenciosamente
test("migração v1->v2: chave sem pipe é preservada intacta", () => {
  const { Storage, localStorage } = loadStorageSandbox({
    version: 1,
    recipes: {},
    boughtKeys: { chavesolta: true },
  });
  Storage.addRecipeToShoppingList("_teste_", 1, []);
  const persisted = lastPersistedShoppingList(localStorage);
  assert.strictEqual(persisted.boughtKeys.chavesolta, true, "chave sem pipe deveria sobreviver do jeito que estava");
});

// 6d. Chave com unit desconhecida (não bate com KNOWN_UNITS) também é preservada intacta —
// a migração nunca arrisca reescrever algo que não consegue validar
test("migração v1->v2: chave com unit desconhecida é preservada intacta", () => {
  const { Storage, localStorage } = loadStorageSandbox({
    version: 1,
    recipes: {},
    boughtKeys: { "algumacoisa|unidade-fantasma": true },
  });
  Storage.addRecipeToShoppingList("_teste_", 1, []);
  const persisted = lastPersistedShoppingList(localStorage);
  assert.strictEqual(persisted.boughtKeys["algumacoisa|unidade-fantasma"], true);
});

// 6e. Versão desconhecida (sem migração registrada) reseta pro estado vazio — nunca quebra,
// nunca inventa dado
test("migração: versão desconhecida (999) reseta pro vazio, sem lançar erro", () => {
  const { Storage } = loadStorageSandbox({
    version: 999,
    recipes: { "receita-fantasma": { recipeId: "x", portionMultiplier: 1, selectedEntries: [] } },
    boughtKeys: { "algo|kg": true },
  });
  assert.deepStrictEqual(Storage.getShoppingListRecipes(), []);
  assert.strictEqual(Storage.isShoppingItemBought("algo", "kg"), false);
});

// 6f. Dado já em v2 carrega direto, sem hop de migração nenhum (sanity check — não regride o
// caminho feliz enquanto mexe no de migração)
test("dado já em v2 carrega sem alteração (nenhum hop de migração)", () => {
  const { Storage } = loadStorageSandbox({
    version: 2,
    recipes: {},
    boughtKeys: { "cebola|": true },
  });
  assert.strictEqual(Storage.isShoppingItemBought("cebola", ""), true);
});

// 6g. localStorage vazio (1ª visita) carrega o padrão vazio em v2, sem erro
test("localStorage vazio carrega o padrão vazio em v2", () => {
  const { Storage } = loadStorageSandbox(null);
  assert.deepStrictEqual(Storage.getShoppingListRecipes(), []);
});

// ========================================================================
// Relatório final
// ========================================================================
console.log("");
console.log("========================================");
console.log("Resultado: " + passCount + " pass / " + failCount + " fail (" + (passCount + failCount) + " total)");
console.log("========================================");
sectionCounts.forEach((s) => {
  console.log("  " + s.name + ": " + s.count);
});

if (failures.length) {
  console.log("");
  console.log("Falhas:");
  failures.forEach((f, i) => {
    console.log((i + 1) + ". [" + f.section + "] " + f.description);
    console.log("   " + f.error);
  });
  process.exitCode = 1;
}
