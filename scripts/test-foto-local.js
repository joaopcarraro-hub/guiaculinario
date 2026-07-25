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
// Este teste ANCORAVA numa receita real sem foto ("Sauerbraten") e quebrou sozinho quando o lote
// terminou e as 398 passaram a ter webp — falso alarme, não regressão. Ancorar em estado que o
// projeto tem por objetivo eliminar é erro de teste. Agora usa um nome que nunca vai existir,
// então vale igual com 0 ou com 398 fotos prontas.
const semFoto = receitas.filter((r) => !fs.existsSync(path.join(DIR_SAIDA, slugApp(r.name) + ".webp")));
const inexistente = "Receita Que Nao Existe No Acervo XYZ";
ok(
  "nome sem webp em disco NÃO resolve pra caminho local (cai no fallback)",
  !fs.existsSync(path.join(DIR_SAIDA, slugApp(inexistente) + ".webp")),
  `cobertura atual: ${receitas.length - semFoto.length} de ${receitas.length} com foto própria`
);

// 0 BYTES É PIOR QUE AUSENTE. Aconteceu de verdade em 25/07/2026: o processo de exportação foi
// morto no meio da escrita e deixou agnolotti.webp com 0 byte. O arquivo EXISTE, então qualquer
// checagem por existência (inclusive a minha, na hora de reexportar) o considera pronto — mas o
// navegador dispara onerror, o app cai no fallback da Wikipédia e ninguém vê erro nenhum.
// Tamanho mínimo em 10 KB: o menor webp legítimo do acervo tem 66 KB, então 10 KB só pega lixo.
const quebrados = fs
  .readdirSync(DIR_SAIDA)
  .filter((f) => f.endsWith(".webp"))
  .map((f) => ({ f, size: fs.statSync(path.join(DIR_SAIDA, f)).size }))
  .filter((x) => x.size < 10 * 1024);
ok(
  "NENHUM webp vazio ou truncado",
  quebrados.length === 0,
  quebrados.length
    ? quebrados.map((x) => `${x.f} (${x.size}B)`).join(", ")
    : `${fs.readdirSync(DIR_SAIDA).filter((f) => f.endsWith(".webp")).length} arquivos, todos acima de 10 KB`
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
// PROCESSO — o que dispara a foto de uma receita NOVA
//
// Estes testes não protegem código, protegem PROCESSO. Descoberta de 25/07/2026: o pipeline
// inteiro estava construído e nada o disparava. Pior, o documento oficial de adicionar receita
// mandava buscar foto na Wikipédia e gravar num campo `image:` que nenhuma receita tem e que o
// app nunca leu. Receita nova entrava com URL inerte e sem foto própria — e ninguém percebia,
// porque aparecia foto na tela (o fallback). Falha silenciosa é o padrão deste projeto inteiro,
// e é o que estes testes existem para quebrar.
// =======================================================================================
console.log("\nPROCESSO (receita nova)");

const claudeMd = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
const docCat = fs.readFileSync(path.join(ROOT, "docs", "prompt-categorizar-receita.md"), "utf8");
const skillImg = path.join(ROOT, ".claude", "skills", "ai-image-generator", "SKILL.md");

ok(
  "CLAUDE.md manda rodar gerar-imagens.js em receita nova",
  /gerar-imagens\.js/.test(claudeMd) && /--gerar --receita/.test(claudeMd),
  "CLAUDE.md é o único arquivo que toda sessão lê sozinha — é o único gatilho real"
);

// NEGATIVO: o campo morto não pode voltar ao documento oficial.
ok(
  "doc de receita nova NÃO pede URL de foto",
  !/image:\s*"https?:/.test(docCat),
  'o antigo `image: "https://..."` era ignorado pelo app e fingia que a receita tinha foto'
);

// NEGATIVO: nem a instrução de buscar na Wikipedia.
ok(
  "doc de receita nova NÃO manda buscar foto na Wikipedia",
  !/Buscar uma foto do prato/i.test(docCat),
  "instruía a fazer exatamente o que o pipeline substituiu"
);

// NEGATIVO: e nenhuma receita pode ter o campo de volta. Se alguém reintroduzir, vira uma
// segunda fonte da verdade — e a errada, porque o app resolve pelo nome.
const comCampoImagem = fs
  .readdirSync(path.join(ROOT, "data"))
  .filter((f) => f.endsWith(".js"))
  .filter((f) => /^\s*(image|img|foto|imagem)\s*:/m.test(fs.readFileSync(path.join(ROOT, "data", f), "utf8")));
ok(
  "NENHUM data/*.js tem campo de imagem",
  comCampoImagem.length === 0,
  comCampoImagem.length ? comCampoImagem.join(", ") : "0 de 42 arquivos"
);

ok(
  "a skill genérica de imagem está escopada para fora de foto de receita",
  fs.existsSync(skillImg) && /NÃO use esta skill para foto de receita/.test(fs.readFileSync(skillImg, "utf8")),
  "sem isso uma sessão futura escolhe a skill errada e gera fora do padrão, gastando dinheiro"
);

// NEGATIVO forte: se CAT_ARQUETIPO ou TECNICAS_PURAS quebrarem, TUDO vira `prato` — o default —
// e as 63 receitas que não são prato saem com mesa posta e taça de vinho, sem erro nenhum.
const arqFn = extrairFuncao(GERADOR, "escolherArquetipo");
{
  const srcGer = fs.readFileSync(GERADOR, "utf8");
  const i = srcGer.indexOf("const CAT_ARQUETIPO");
  const j = srcGer.indexOf("function escolherArquetipo");
  const fim = srcGer.indexOf("}", srcGer.indexOf("{", j)) + 1;
  const escolher = new Function(`${srcGer.slice(i, fim)}; return escolherArquetipo;`)();
  const w = {};
  for (const f of fs.readdirSync(path.join(ROOT, "data")).filter((f) => f.endsWith(".js"))) {
    try { new Function("window", fs.readFileSync(path.join(ROOT, "data", f), "utf8"))(w); } catch (e) {}
  }
  const conta = {};
  for (const cat in w.RECIPES || {}) for (const r of w.RECIPES[cat]) {
    const a = escolher(cat, r); conta[a] = (conta[a] || 0) + 1;
  }
  const naoPrato = (conta.molho || 0) + (conta.preparo || 0) + (conta.processo || 0);
  ok(
    "as regras de arquétipo REALMENTE disparam (nem tudo virou `prato`)",
    naoPrato === 63 && conta.processo === 6,
    `prato ${conta.prato}, molho ${conta.molho}, preparo ${conta.preparo}, processo ${conta.processo} — não-prato ${naoPrato}, esperado 63`
  );
}
void arqFn;

// =======================================================================================
console.log(`\n${passes} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
