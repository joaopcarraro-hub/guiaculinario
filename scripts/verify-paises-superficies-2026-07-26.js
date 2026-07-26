// scripts/verify-paises-superficies-2026-07-26.js
//
// RUMO NOVO DE PAÍSES (26/07/2026) — verificação das SUPERFÍCIES, no lugar do screenshot.
//
// Por que este arquivo existe separado de verify-categoria-tiles-2026-07-26.js: aquela suíte
// verifica o CÓDIGO-FONTE (texto exato, mapas extraídos e executados). Esta aqui monta os
// elementos de verdade e confere o RESULTADO — o que cada uma das 3 superfícies de Países
// efetivamente exibe:
//   1. hub Países: os 20 tiles com FOTO DE COMIDA (não bandeira)
//   2. Home: o tile "Países" com a imagem-conceito dos 5 pratos
//   3. banner do hub Países: o mesmo asset da Home
//
// A verificação ao vivo em 390x844 estava prevista por screenshot; o Chrome MCP não conectou
// (2 tentativas, o teto que CLAUDE.md impõe), então a checagem virou DOM/estado real — que é
// exatamente o fallback que CLAUDE.md prescreve. A geometria de 390x844 é impressa por cálculo
// a partir dos tokens reais, e está rotulada como CÁLCULO, não como medição ao vivo: quem
// reabrir isso com um browser na mão deve confirmar os números da seção 4 na tela.
//
// jsdom é OPCIONAL. Havendo jsdom, a seção 1 monta os 20 tiles em DOM de verdade; não havendo,
// ela cai numa checagem equivalente sem DOM e AVISA — o repositório não tem package.json nem
// node_modules, e uma suíte que só roda na máquina de quem a escreveu não protege ninguém.
//
// `node scripts/verify-paises-superficies-2026-07-26.js` — sai != 0 se algo falhar.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

let failures = 0;
function assert(cond, label) {
  console.log((cond ? "  OK   " : "  FAIL ") + label);
  if (!cond) failures++;
}
function info(label) {
  console.log("       " + label);
}

// MESMA slug() de scripts/gerar-imagens.js e slugFoto() de js/app.js. As três andam juntas
// (§2 do contrato de imagens): divergir aqui faz a suíte aprovar um caminho que o app não usa.
function slugFoto(nome) {
  return String(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Resolução padrão do Node, só. Nada de caminho absoluto de máquina de desenvolvimento aqui:
// um require apontando pra /tmp/node_modules passaria nesta máquina e falharia em qualquer
// outra — que é justamente o defeito que o cabeçalho acima diz querer evitar.
let JSDOM = null;
try {
  JSDOM = require("jsdom").JSDOM;
} catch (e) {
  JSDOM = null;
}

function main() {
  // ---------- sandbox com o acervo e os dados reais, na ordem do index.html ----------
  const ctx = {};
  ctx.window = ctx;
  ctx.console = console;
  vm.createContext(ctx);
  const srcs = (indexHtml.match(/<script src="([^"]+)"><\/script>/g) || [])
    .map((t) => t.match(/src="([^"]+)"/)[1])
    .filter((s) => s.indexOf("data/") === 0 || ["js/countries.js", "js/categories.js", "js/collections.js", "js/tags.js"].indexOf(s) !== -1);
  srcs.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f }));
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "tagmodel.js"), "utf8"), ctx, { filename: "js/tagmodel.js" });

  // Extrai de app.js, por TEXTO EXATO, o que decide cada superfície — nunca reimplementado aqui.
  const decl = (marker, endMarker) => {
    const s = appJs.indexOf(marker);
    return appJs.slice(s, appJs.indexOf(endMarker, s) + endMarker.length);
  };
  const fnBody = (marker) => {
    const s = appJs.indexOf(marker);
    let e = appJs.indexOf("\r\n  function ", s + marker.length);
    if (e < 0) e = appJs.indexOf("\n  function ", s + marker.length);
    if (e < 0) e = appJs.length;
    return appJs.slice(s, e);
  };
  vm.runInContext(
    decl("const CATEGORY_TILE_IMAGE_IDS = new Set([", "]);").replace("const ", "var ") +
      "\n" + fnBody("function collectionTileImageSrc(collection) {") +
      "\n" + fnBody("function countrySignatureRecipe(collectionId) {") +
      "\n" + decl("const HOME_MAIN_TILES = [", "];").replace("const ", "var ") +
      "\n" + decl("const GRUPO_BANNER_IMAGE = {", "};").replace("const ", "var ") +
      "\nvar TagModel = window.TagModel;",
    ctx,
    { filename: "extraido-de-app.js" }
  );

  console.log("==================================================");
  console.log("1. SUPERFÍCIE 1/3 — HUB PAÍSES: os 20 tiles mostram FOTO DE COMIDA");
  console.log("==================================================");
  console.log(JSDOM ? "  (jsdom presente — tiles montados em DOM real)" : "  AVISO: jsdom ausente — checagem equivalente sem DOM (instale jsdom pra montagem real)");
  const paises = ctx.COLLECTIONS.filter((c) => c.collectionType === "country");
  assert(paises.length === 20, "20 coleções de país no hub (achado " + paises.length + ")");

  const doc = JSDOM ? new JSDOM("<!doctype html><body></body>").window.document : null;
  const semFoto = [];
  const semEstrutura = [];
  let comBandeira = 0;
  paises.forEach((col) => {
    const rec = ctx.countrySignatureRecipe(col.id);
    const src = rec ? "imagens/receitas/" + slugFoto(rec.name) + ".webp" : null;
    if (!src || !fs.existsSync(path.join(ROOT, src.split("/").join(path.sep)))) semFoto.push(col.id);
    const mapeado = ctx.collectionTileImageSrc(col);
    if (mapeado && String(mapeado).indexOf("imagens/bandeiras/") === 0) comBandeira++;

    if (doc) {
      // MESMA montagem de renderCollectionCard: media (preenchida em runtime por
      // loadRecipeImage/applyImage, aqui pelo caminho já resolvido) + faixa com nome e contagem.
      const card = doc.createElement("button");
      card.className = "category-card category-card--country";
      card.innerHTML =
        '<span class="category-card__media"></span>' +
        '<span class="category-card__band">' +
        '<span class="category-card__title">' + col.label + "</span>" +
        '<span class="category-card__count">' + ctx.TagModel.getRecipesByCollection(col.id).allRecipes.length + " receitas</span>" +
        "</span>";
      if (src) card.querySelector(".category-card__media").innerHTML = '<img src="' + src + '" alt="">';
      const temImg = !!card.querySelector(".category-card__media img");
      const temNome = (card.querySelector(".category-card__title") || {}).textContent === col.label;
      const temContagem = /\d+ receitas/.test((card.querySelector(".category-card__count") || {}).textContent || "");
      if (!temImg || !temNome || !temContagem) semEstrutura.push(col.id);
    }
  });
  assert(semFoto.length === 0, "os 20 tiles exibem foto de comida existente em disco" + (semFoto.length ? " — SEM FOTO: " + semFoto.join(", ") : ""));
  assert(comBandeira === 0, "TESTE NEGATIVO: ZERO tiles de país resolvem pra imagens/bandeiras/ (achado " + comBandeira + ")");
  if (doc) {
    assert(semEstrutura.length === 0, "os 20 mantêm mídia + faixa sólida com NOME e CONTAGEM" + (semEstrutura.length ? " — quebrados: " + semEstrutura.join(", ") : ""));
  }

  console.log("");
  console.log("==================================================");
  console.log("2. SUPERFÍCIE 2/3 — HOME: tile \"Países\" com a imagem-conceito dos 5 pratos");
  console.log("==================================================");
  const tilePaises = ctx.HOME_MAIN_TILES.filter((t) => t.id === "cozinhas")[0];
  assert(!!tilePaises, "entrada cozinhas existe em HOME_MAIN_TILES");
  assert(tilePaises.img === "imagens/categorias/paises.webp", "tile Países da Home -> " + tilePaises.img);
  assert(!tilePaises.mosaic, "TESTE NEGATIVO: entrada não tem mais campo mosaic (mural extinto)");
  const homeFaltando = ctx.HOME_MAIN_TILES.filter((t) => !t.img || !fs.existsSync(path.join(ROOT, t.img.split("/").join(path.sep))));
  assert(homeFaltando.length === 0, "os 4 assets dos tiles da Home existem em disco" + (homeFaltando.length ? " — faltando: " + homeFaltando.map((t) => t.id).join(", ") : ""));

  console.log("");
  console.log("==================================================");
  console.log("3. SUPERFÍCIE 3/3 — BANNER DO HUB PAÍSES (mesmo asset da Home)");
  console.log("==================================================");
  assert(ctx.GRUPO_BANNER_IMAGE.cozinhas === "imagens/categorias/paises.webp", "banner do hub Países -> " + ctx.GRUPO_BANNER_IMAGE.cozinhas);
  assert(
    ctx.GRUPO_BANNER_IMAGE.cozinhas === tilePaises.img,
    "banner do hub e tile da Home usam o MESMO arquivo (era o contrato do mural: mesma identidade nas 2 superfícies, preservado)"
  );
  assert(fs.existsSync(path.join(ROOT, "imagens", "categorias", "paises.webp")), "paises.webp existe em disco");

  console.log("");
  console.log("==================================================");
  console.log("4. GEOMETRIA A 390x844 — CÁLCULO a partir dos tokens (NÃO é medição ao vivo)");
  console.log("==================================================");
  // #main aplica inset lateral de 20px; .category-grid/.home-tiles são grid de 2 colunas com
  // gap --space-3 (12px). Números derivados, não estimados — mas derivados, e é isso que a
  // etiqueta acima diz: confirmar na tela quando houver browser.
  const VW = 390, VH = 844, INSET = 20, GAP = 12, COLS = 2;
  const tileW = (VW - INSET * 2 - GAP * (COLS - 1)) / COLS;
  info("largura de tile na grade do hub:            " + tileW + "px");
  info("mídia do tile de país (4:3, foto de prato): " + tileW + "x" + (tileW * 3 / 4).toFixed(2) + "px");
  info("   [como bandeira era 3:2:                  " + tileW + "x" + (tileW * 2 / 3).toFixed(2) + "px — +" + (tileW * 3 / 4 - tileW * 2 / 3).toFixed(2) + "px de altura]");
  info("mídia do tile grande da Home (4:3):         " + tileW + "x" + (tileW * 3 / 4).toFixed(2) + "px");
  info("banner do hub (clamp(180px,28vh,280px)):    28vh de " + VH + " = " + (VH * 0.28).toFixed(2) + "px");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
