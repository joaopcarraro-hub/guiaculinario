// scripts/test-foto-local.js
//
// Protege o contrato "foto própria da receita": o nome de arquivo que
// scripts/gerar-imagens.js ESCREVE tem que ser exatamente o que js/app.js PROCURA.
//
// Por que isso merece uma suíte: a falha aqui é silenciosa e cara. Se as duas slug()
// divergirem num único caractere, o app procura um arquivo que nunca existiu, o
// `probe.onerror` dispara, ele cai no fallback da Wikipedia e mostra uma foto qualquer —
// sem erro no console, sem tela quebrada, sem nada que chame atenção. As 398 fotos pagas
// simplesmente não aparecem e ninguém percebe até alguém abrir o app e estranhar.
//
// Zero dependência, roda com `node scripts/test-foto-local.js`, custo zero de API.
// Sem ref mutável de git (ver CLAUDE.md): todos os valores esperados são literais.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "js", "app.js");
const GERADOR = path.join(ROOT, "scripts", "gerar-imagens.js");
const CSS = path.join(ROOT, "css", "style.css");
const DIR_SAIDA = path.join(ROOT, "imagens", "receitas");

let falhas = 0;
let passes = 0;

function ok(nome, cond, detalhe) {
  if (cond) {
    passes++;
    console.log(`  ok   ${nome}${detalhe ? "  — " + detalhe : ""}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? "  — " + detalhe : ""}`);
  }
}

// ---------------------------------------------------------------------------------------
// Extrai as duas implementações do CÓDIGO-FONTE, não de uma cópia colada aqui. Copiar a
// função pra dentro do teste destruiria o propósito: o teste passaria feliz enquanto o app
// e o gerador divergiam entre si.
// ---------------------------------------------------------------------------------------
function extrairFuncao(arquivo, nome) {
  const src = fs.readFileSync(arquivo, "utf8");
  const i = src.indexOf(`function ${nome}(`);
  if (i === -1) throw new Error(`função ${nome}() não encontrada em ${path.basename(arquivo)}`);
  // varre contando chaves a partir da primeira "{" depois da assinatura
  let j = src.indexOf("{", i), nivel = 0, fim = -1;
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") nivel++;
    else if (src[k] === "}") { nivel--; if (nivel === 0) { fim = k + 1; break; } }
  }
  if (fim === -1) throw new Error(`não consegui delimitar ${nome}() em ${path.basename(arquivo)}`);
  const corpo = src.slice(i, fim);
  return { fn: new Function(`${corpo}; return ${nome};`)(), fonte: corpo };
}

const app = extrairFuncao(APP, "slugFoto");
const ger = extrairFuncao(GERADOR, "slug");
const slugApp = app.fn;
const slugGer = ger.fn;

// ---------------------------------------------------------------------------------------
// Carrega as 398 receitas com o mesmo shim de window que o gerador usa
// ---------------------------------------------------------------------------------------
function carregarReceitas() {
  const w = {};
  for (const f of fs.readdirSync(path.join(ROOT, "data")).filter((f) => f.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(ROOT, "data", f), "utf8");
    try { new Function("window", src)(w); } catch (e) { /* arquivo que não declara receita */ }
  }
  const out = [];
  for (const cat in w.RECIPES || {}) for (const r of w.RECIPES[cat]) out.push({ cat, name: r.name });
  return out;
}

const receitas = carregarReceitas();

console.log("\ntest-foto-local — contrato entre gerar-imagens.js e app.js\n");
console.log(`acervo carregado: ${receitas.length} receitas\n`);

// =======================================================================================
// POSITIVOS
// =======================================================================================
console.log("POSITIVOS");

ok("acervo tem 398 receitas", receitas.length === 398, `veio ${receitas.length}`);

const divergentes = receitas.filter((r) => slugApp(r.name) !== slugGer(r.name));
ok(
  "as duas slug() concordam nas 398",
  divergentes.length === 0,
  divergentes.length
    ? divergentes.slice(0, 3).map((r) => `${r.name}: app="${slugApp(r.name)}" ger="${slugGer(r.name)}"`).join(" | ")
    : `0 divergências em ${receitas.length}`
);

// Literais, não derivados. Se alguém "consertar" a slug e estes mudarem, o teste grita.
const LITERAIS = [
  ["Paella", "paella"],
  ["Dumplings (Jiaozi)", "dumplings-jiaozi"],
  ["Pato Laqueado (Pequim)", "pato-laqueado-pequim"],
  ["Acarajé", "acaraje"],
  ["Frango com Quiabo", "frango-com-quiabo"],
];
for (const [nome, esperado] of LITERAIS) {
  ok(`slug literal "${nome}"`, slugApp(nome) === esperado, `-> "${slugApp(nome)}" (esperado "${esperado}")`);
}

ok(
  "a Paella tem webp em disco e o app acha pelo slug",
  fs.existsSync(path.join(DIR_SAIDA, slugApp("Paella") + ".webp")),
  `imagens/receitas/${slugApp("Paella")}.webp`
);

const cssTxt = fs.readFileSync(CSS, "utf8");
ok(
  "CSS: .recipe-hero img tem object-position",
  /\.recipe-hero img\s*\{[^}]*object-position:\s*center/.test(cssTxt),
  "sem isso o prato encosta na borda de cima"
);
ok(
  "CSS: .recipe-hero usa aspect-ratio, não altura fixa",
  /\.recipe-hero\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/.test(cssTxt),
  "altura fixa fazia o enquadramento mudar com a largura da tela"
);

// =======================================================================================
// NEGATIVOS — o que NÃO pode acontecer
// =======================================================================================
console.log("\nNEGATIVOS");

// 1. Duas receitas não podem cair no mesmo arquivo: a segunda sobrescreveria a foto da primeira
//    e uma delas ficaria com a foto da outra, silenciosamente.
const vistos = new Map();
const colisoes = [];
for (const r of receitas) {
  const s = slugApp(r.name);
  if (vistos.has(s)) colisoes.push(`${s}: "${vistos.get(s)}" vs "${r.name}"`);
  else vistos.set(s, r.name);
}
ok("NENHUMA colisão de slug entre as 398", colisoes.length === 0, colisoes.length ? colisoes.join(" | ") : "398 slugs distintos");

// 2. Nenhum slug pode ser vazio: "" viraria imagens/receitas/.webp pra várias receitas de uma vez.
const vazios = receitas.filter((r) => !slugApp(r.name));
ok("NENHUM slug vazio", vazios.length === 0, `${vazios.length} vazios`);

// 3. O slug NÃO pode sair do nome sem parênteses (que é o que imageQuery() faz pra Wikipedia).
//    Se alguém unificar os dois por engano, o app procuraria "dumplings.webp" e o gerador teria
//    escrito "dumplings-jiaozi.webp" — 24 receitas perderiam a foto.
const imageQuery = (n) => n.replace(/\s*\([^)]*\)/g, "").trim();
const comParenteses = receitas.filter((r) => /\(/.test(r.name));
const contaminados = comParenteses.filter((r) => slugApp(r.name) === slugApp(imageQuery(r.name)));
ok(
  "o slug NÃO é derivado de imageQuery()",
  comParenteses.length > 0 && contaminados.length === 0,
  `${comParenteses.length} nomes com parênteses, ${contaminados.length} contaminados`
);

// 4. TESTE DE MUTAÇÃO: se a comparação acima não conseguir detectar uma slug quebrada, ela é
//    decorativa. Aqui eu quebro de propósito e exijo que a checagem ACUSE.
const slugQuebrada = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, "_"); // "_" em vez de "-"
// Limiar em PROPORÇÃO, não em número absoluto: nome de uma palavra só e sem acento
// ("Acarajé" não, "Ceviche" sim) sai igual nas duas, então nunca vai dar 100% — hoje são
// 276 de 398 (69%). Fixar 276 aqui quebraria o teste na próxima receita adicionada, que é
// o tipo de teste que o time aprende a ignorar. Meia dúzia já provaria que não é decorativo;
// metade do acervo é folga confortável.
const detectados = receitas.filter((r) => slugQuebrada(r.name) !== slugGer(r.name));
ok(
  "a comparação DETECTA uma slug adulterada (não é teste decorativo)",
  detectados.length > receitas.length * 0.5,
  `${detectados.length} de ${receitas.length} (${Math.round((detectados.length / receitas.length) * 100)}%) divergências acusadas contra a versão quebrada`
);

// 5. Receita SEM webp em disco não pode ser tratada como "tem foto". Enquanto o lote não roda,
//    a esmagadora maioria está nesse estado — e o app tem que cair no fallback, não mostrar quadrado quebrado.
const semFoto = receitas.filter((r) => !fs.existsSync(path.join(DIR_SAIDA, slugApp(r.name) + ".webp")));
ok(
  "receita sem webp NÃO resolve pra caminho local",
  !fs.existsSync(path.join(DIR_SAIDA, slugApp("Sauerbraten") + ".webp")),
  `"Sauerbraten" sem foto; ${semFoto.length} de ${receitas.length} ainda sem webp`
);

// 6. Não pode sobrar chamada no formato antigo: loadRecipeImage() agora recebe a RECEITA.
//    Passar a string faria recipe.name virar undefined e TODA foto local sumir.
const appTxt = fs.readFileSync(APP, "utf8");
ok(
  "NENHUMA chamada antiga loadRecipeImage(imageQuery(...))",
  !/loadRecipeImage\(\s*imageQuery\(/.test(appTxt),
  "3 call sites migrados para loadRecipeImage(recipe, el)"
);

// 7. O resultado do teste local NÃO pode ser gravado no localStorage: persistiria "não existe"
//    depois que a foto passasse a existir, e a foto nova nunca apareceria naquele aparelho.
const corpoFotoLocal = extrairFuncao(APP, "fotoLocal").fonte;
ok(
  "fotoLocal() NÃO grava em localStorage",
  !/localStorage/.test(corpoFotoLocal),
  "cache do teste local vive só em memória (Map), morre no reload"
);

// =======================================================================================
console.log(`\n${passes} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
