// scripts/verify-categoria-tiles-2026-07-26.js
//
// Suíte do item final do redesenho visual (item 6 do roadmap-mestre, CHECKLIST-GERAL.md): tile
// de categoria/home, banner de hub, tile de país + extermínio final de emoji. Estendida no
// RUMO NOVO DE PAÍSES (26/07/2026).
//
// Verifica ESTRUTURA (media+faixa nos 2 tipos de tile, banner só em hub — nunca em
// categoria/país, título nunca dentro do container de imagem) e MAPEAMENTO
// (collectionTileImageSrc/GRUPO_BANNER_IMAGE extraídos de app.js e EXECUTADOS de verdade contra
// window.COLLECTIONS real, não só grep do literal) — confirma que todo caminho resolvido existe
// de fato em disco e que a lista de órfãos bate exatamente com a do relatório da tarefa.
//
// O que o rumo novo de Países acrescentou:
//   §0/§2b  o mural de bandeiras está EXTINTO (cada símbolo da linhagem asserido sozinho), as 2
//           superfícies de Países usam imagens/categorias/paises.webp, e hub-cozinhas.webp saiu
//           do repo — com teste de "zero referência em CÓDIGO" (comentário histórico permitido).
//   §6c     o tile de país é foto de prato NÍTIDA em 4:3, não bandeira borrada em 3:2.
//   §7      PORTÃO CARO: os 20 signatureRecipe resolvem contra o ACERVO INTEIRO (os 40 data/*.js
//           carregados de verdade) e têm .webp em disco. Falha de resolução é falha de suíte —
//           em runtime esse erro seria MUDO, e é justamente o modo de falha que este projeto
//           paga caro (mesma lição do slug()/slugFoto() no §2 do contrato de imagens).
//
// js/app.js é fortemente acoplado ao DOM sem UMD — funções de render são verificadas por texto
// exato do código-fonte (mesma técnica de scripts/verify-back-float-2026-07-25.js), mas
// collectionTileImageSrc/GRUPO_BANNER_IMAGE são funções/dados puros o bastante pra extrair e
// EXECUTAR de verdade num sandbox vm, então fazemos isso em vez de só ler o literal.
// js/app.js usa CRLF (\r\n) — mesma ressalva de sliceFn já documentada na suíte de back-float.
//
// `node scripts/verify-categoria-tiles-2026-07-26.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

// Fim de função = próxima "  function " no nível de módulo (2 espaços) — mesmo padrão de
// scripts/verify-back-float-2026-07-25.js.
function sliceFn(src, startMarker, label) {
  const start = src.indexOf(startMarker);
  assert(start > 0, label + ": marca de início encontrada");
  let end = src.indexOf("\r\n  function ", start + startMarker.length);
  if (end < 0) end = src.length;
  assert(end > start, label + ": marca de fim encontrada (depois do início)");
  return src.slice(start, end);
}

function ruleBody(cssText, selectorWithBrace, label) {
  const start = cssText.indexOf(selectorWithBrace);
  assert(start >= 0, label + ": regra encontrada (" + selectorWithBrace + ")");
  return cssText.slice(start, cssText.indexOf("}", start));
}

// Leitor de dimensão WEBP sem dependência externa (parse direto do header RIFF) — só os 2
// formatos que scripts/exportar-bandeiras.js produz (nunca VP8X/alpha/animação). Evita precisar
// de sharp (usado só pra GERAR o acervo, não pra testar) rodando nesta suíte.
function webpDims(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, format: "lossy" };
  }
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, format: "lossless" };
  }
  return null;
}

function main() {
  console.log("==================================================");
  console.log("0. PORTAO DE ENTRADA — acervo de imagem completo em disco");
  console.log("==================================================");
  const categoriaDir = path.join(ROOT, "imagens", "categorias");
  const bandeiraDir = path.join(ROOT, "imagens", "bandeiras");
  const categoriaFiles = fs.readdirSync(categoriaDir).filter((f) => f.endsWith(".webp"));
  const bandeiraFiles = fs.readdirSync(bandeiraDir).filter((f) => f.endsWith(".webp"));
  // 19 = 16 tiles de categoria + 2 banners de hub (fundamentos/proteinas) + 1 imagem-conceito
  // (paises.webp). Bateu 19 antes do rumo novo de Países por outra conta (havia hub-cozinhas e
  // não havia paises); o número só coincide, a composição mudou — por isso a decomposição
  // explícita abaixo, que uma contagem solta não pegaria.
  assert(categoriaFiles.length === 19, "imagens/categorias/: 19 webp = 16 categoria + 2 hub + 1 conceito (achado " + categoriaFiles.length + ")");
  assert(bandeiraFiles.length === 20, "imagens/bandeiras/: 20 webp (achado " + bandeiraFiles.length + ")");
  assert(categoriaFiles.indexOf("paises.webp") !== -1, "paises.webp presente no acervo (imagem-conceito de 5 pratos — asset das 2 superfícies de Países)");
  assert(
    categoriaFiles.indexOf("hub-cozinhas.webp") === -1,
    "TESTE NEGATIVO: hub-cozinhas.webp SAIU do repo (git rm no rumo novo de Países) — era a foto de temperos, ficou sem consumidor nenhum quando o mural de bandeiras morreu"
  );

  console.log("");
  console.log("==================================================");
  console.log("0b. RODADA 4 — as 20 bandeiras foram REGERADAS 3:2 (600x400), não mais 1:1 (600x600)");
  console.log("==================================================");
  const dimsErrados = [];
  bandeiraFiles.forEach((f) => {
    const d = webpDims(path.join(bandeiraDir, f));
    if (!d || d.width !== 600 || d.height !== 400) dimsErrados.push(f + " -> " + (d ? d.width + "x" + d.height : "formato não reconhecido"));
  });
  assert(dimsErrados.length === 0, "TODAS as 20 bandeiras são EXATAMENTE 600x400 (3:2), lidas do header WEBP real, não assumidas — " + (dimsErrados.length ? "erradas: " + dimsErrados.join("; ") : "confirmado"));

  console.log("");
  console.log("==================================================");
  console.log("1. MAPA slug<->tile — collectionTileImageSrc EXECUTADO contra window.COLLECTIONS real");
  console.log("==================================================");

  // Sandbox com countries.js -> categories.js -> collections.js, MESMA ordem do index.html
  // (countries.js precisa carregar antes dos outros dois, senão window.COUNTRIES.X.nome usado
  // em categories.js/collections.js quebra).
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ["js/countries.js", "js/categories.js", "js/collections.js"].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
  });
  assert(Array.isArray(sandbox.COLLECTIONS) && sandbox.COLLECTIONS.length > 0, "window.COLLECTIONS carregado no sandbox (" + ((sandbox.COLLECTIONS || []).length) + " coleções)");
  assert(sandbox.COUNTRIES && Object.keys(sandbox.COUNTRIES).length === 20, "window.COUNTRIES carregado no sandbox (20 países)");

  // Extrai CATEGORY_TILE_IMAGE_IDS + collectionTileImageSrc de app.js (texto exato) e roda no
  // MESMO sandbox — função pura de verdade, não só grep do literal.
  const idsStart = appJs.indexOf("const CATEGORY_TILE_IMAGE_IDS = new Set([");
  const idsEnd = appJs.indexOf("]);", idsStart) + 3;
  const fnStart = appJs.indexOf("function collectionTileImageSrc(collection) {");
  const fnEnd = appJs.indexOf("\r\n  }", fnStart) + 5;
  assert(idsStart > 0 && fnStart > idsStart && fnEnd > fnStart, "CATEGORY_TILE_IMAGE_IDS e collectionTileImageSrc encontrados em app.js, nessa ordem");
  vm.runInContext(appJs.slice(idsStart, idsEnd) + "\n" + appJs.slice(fnStart, fnEnd), sandbox, { filename: "extracted-collectionTileImageSrc" });
  assert(typeof sandbox.collectionTileImageSrc === "function", "collectionTileImageSrc carregado no sandbox como função real");

  const imaged = [];
  const orphan = [];
  sandbox.COLLECTIONS.forEach((c) => {
    const src = sandbox.collectionTileImageSrc(c);
    if (src) imaged.push({ id: c.id, src: src });
    else orphan.push(c.id);
  });

  const EXPECTED_CATEGORY_IDS = ["molhos", "sopas", "entradas", "massas", "risotos-arroz", "padaria", "sobremesas-classicas", "tecnicas", "aves", "carnes-bovinas", "suinos", "peixes", "frutos-do-mar", "col-ovo", "cordeiro", "col-vegetariana"];
  const EXPECTED_COUNTRY_IDS = ["brasil", "franca", "italia", "espanha", "portugal", "japao", "china", "coreia", "tailandia", "india", "mexico", "peru", "alemanha", "austria", "hungria", "grecia", "marrocos", "libano", "eua", "dinamarca"];
  const EXPECTED_TIME_DIFF_ORPHANS = ["col-rapidas", "col-ate-1h", "col-mais-de-1h", "col-preparo-longo", "col-faceis", "col-intermediarias", "col-avancadas"];
  // Rumo novo de Países (26/07/2026): collectionTileImageSrc devolve null pra TODA coleção de
  // país — o tile de país não sai mais deste mapa estático, sai de countrySignatureRecipe +
  // loadRecipeImage (seção 7). "Órfão" aqui passou a significar só "não resolvido por este
  // mapa", o que inclui os 20 países DE PROPÓSITO; quem garante que país tem foto é a seção 7.
  const EXPECTED_ORPHANS = EXPECTED_TIME_DIFF_ORPHANS.concat(EXPECTED_COUNTRY_IDS);

  assert(imaged.length === EXPECTED_CATEGORY_IDS.length, "total de tiles COM imagem por este mapa: " + imaged.length + " (esperado " + EXPECTED_CATEGORY_IDS.length + " = 16 categoria; país saiu daqui)");
  assert(orphan.length === EXPECTED_ORPHANS.length, "total de tiles fora deste mapa: " + orphan.length + " (esperado " + EXPECTED_ORPHANS.length + " = 7 tempo/dificuldade + 20 país)");
  assert(
    EXPECTED_ORPHANS.every((id) => orphan.indexOf(id) !== -1) && orphan.every((id) => EXPECTED_ORPHANS.indexOf(id) !== -1),
    "lista fora do mapa bate EXATAMENTE com a esperada (Por tempo x4 + Por dificuldade x3 + 20 países)"
  );
  assert(
    EXPECTED_COUNTRY_IDS.every((id) => {
      const c = sandbox.COLLECTIONS.find((x) => x.id === id);
      return c && sandbox.collectionTileImageSrc(c) === null;
    }),
    "TESTE NEGATIVO: os 20 países resolvem pra null em collectionTileImageSrc — NENHUM caminho imagens/bandeiras/ sobrou no tile do hub (bandeira só no modal de Filtros, seção 5)"
  );

  const missing = [];
  imaged.forEach((item) => {
    const full = path.join(ROOT, item.src.split("/").join(path.sep));
    if (!fs.existsSync(full)) missing.push(item.id + " -> " + item.src);
  });
  assert(missing.length === 0, "TODOS os " + imaged.length + " caminhos resolvidos por collectionTileImageSrc existem de fato em disco" + (missing.length ? " (faltando: " + missing.join("; ") + ")" : ""));

  const countryImaged = imaged.filter((i) => i.src.indexOf("imagens/bandeiras/") === 0);
  const categoryImaged = imaged.filter((i) => i.src.indexOf("imagens/categorias/") === 0);
  assert(countryImaged.length === 0, "TESTE NEGATIVO: ZERO coleções resolvem pra imagens/bandeiras/ por este mapa (achado " + countryImaged.length + ")");
  assert(categoryImaged.length === 16, "16 coleções (8 Fundamentos + 8 Proteínas) resolvem pra imagens/categorias/<id>.webp");

  console.log("");
  console.log("==================================================");
  console.log("2. BANNER DE HUB — GRUPO_BANNER_IMAGE EXECUTADO (3 hubs alcançáveis, todos com FOTO; tempo/dificuldade sem banner)");
  console.log("==================================================");
  const bannerStart = appJs.indexOf("const GRUPO_BANNER_IMAGE = {");
  const bannerEnd = appJs.indexOf("};", bannerStart) + 2;
  assert(bannerStart > 0 && bannerEnd > bannerStart, "GRUPO_BANNER_IMAGE encontrado em app.js");
  // const/let de topo-de-script não viram propriedade do objeto de contexto no vm (só function
  // declaration e var viram) — troca só NESTE snippet extraído (não no arquivo real) pra
  // conseguir ler sandbox.GRUPO_BANNER_IMAGE depois do runInContext.
  vm.runInContext(
    appJs.slice(bannerStart, bannerEnd).replace("const GRUPO_BANNER_IMAGE", "var GRUPO_BANNER_IMAGE"),
    sandbox,
    { filename: "extracted-GRUPO_BANNER_IMAGE" }
  );
  assert(typeof sandbox.GRUPO_BANNER_IMAGE === "object" && sandbox.GRUPO_BANNER_IMAGE !== null, "GRUPO_BANNER_IMAGE carregado no sandbox");
  const bannerImgKeys = Object.keys(sandbox.GRUPO_BANNER_IMAGE || {});
  assert(
    bannerImgKeys.length === 3 && ["fundamentos", "proteinas", "cozinhas"].every((k) => bannerImgKeys.indexOf(k) !== -1),
    "GRUPO_BANNER_IMAGE tem EXATAMENTE 3 chaves, todas com FOTO: fundamentos/proteinas/cozinhas (achado: " + bannerImgKeys.join(", ") + ")"
  );
  assert(
    sandbox.GRUPO_BANNER_IMAGE.cozinhas === "imagens/categorias/paises.webp",
    "SUPERFÍCIE 1/2 — banner do hub Países aponta pra imagens/categorias/paises.webp (achado: " + sandbox.GRUPO_BANNER_IMAGE.cozinhas + ")"
  );
  assert(
    !("tempo" in sandbox.GRUPO_BANNER_IMAGE) && !("dificuldade" in sandbox.GRUPO_BANNER_IMAGE),
    "TESTE NEGATIVO: tempo/dificuldade (rotas órfãs) NÃO têm banner"
  );
  bannerImgKeys.forEach((k) => {
    const full = path.join(ROOT, sandbox.GRUPO_BANNER_IMAGE[k].split("/").join(path.sep));
    assert(fs.existsSync(full), "banner de " + k + " existe em disco: " + sandbox.GRUPO_BANNER_IMAGE[k]);
  });

  console.log("");
  console.log("==================================================");
  console.log("2b. MURAL DE BANDEIRAS — EXTINTO (as 2 superfícies de Países usam paises.webp)");
  console.log("==================================================");
  // Linhagem inteira da rodada 2-4: JS (Set + builder + lista de iso2), CSS (componente + 2
  // tokens) e o asset que ela substituía. Cada símbolo é asserido SOZINHO — um grep único
  // ("mosaic") passaria com metade da linhagem viva, que é exatamente o resíduo que a suíte
  // precisa pegar.
  [
    ["GRUPO_BANNER_MOSAIC", "o Set de hub-com-mosaico"],
    ["buildFlagMosaicHtml", "o builder de HTML do mural"],
    ["FLAG_MOSAIC_ISO2", "a lista das 4 bandeiras do mural"],
  ].forEach(([sym, oque]) => {
    assert(!appJs.includes(sym), "TESTE NEGATIVO: " + sym + " (" + oque + ") não existe mais em js/app.js");
  });
  [
    [".flag-mosaic", "o componente de grid do mural"],
    ["--flag-mosaic-blur", "o token de blur do mural"],
    ["--flag-mosaic-veil", "o token de véu do mural"],
  ].forEach(([sym, oque]) => {
    assert(!css.includes(sym), "TESTE NEGATIVO: " + sym + " (" + oque + ") não existe mais em css/style.css");
  });
  assert(
    !fs.existsSync(path.join(ROOT, "imagens", "categorias", "hub-cozinhas.webp")),
    "TESTE NEGATIVO: hub-cozinhas.webp não existe mais em disco (git rm — sem consumidor desde que o mural morreu)"
  );
  // Zero referência a hub-cozinhas em CÓDIGO (js/css/scripts). Docs/comentários históricos podem
  // citar o nome pra explicar por que o arquivo existiu — o que a suíte proíbe é código vivo
  // apontando pra um arquivo que não está mais no repo.
  const CODE_FILES = [
    ["js/app.js", appJs],
    ["css/style.css", css],
    ["js/countries.js", fs.readFileSync(path.join(ROOT, "js", "countries.js"), "utf8")],
    ["scripts/gerar-categorias.js", fs.readFileSync(path.join(ROOT, "scripts", "gerar-categorias.js"), "utf8")],
    ["index.html", fs.readFileSync(path.join(ROOT, "index.html"), "utf8")],
    ["sw.js", fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")],
  ];
  CODE_FILES.forEach(([nome, src]) => {
    // Descarta comentários (// linha, /* bloco */) antes de procurar — o que sobra é código.
    const semComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert(!semComentarios.includes("hub-cozinhas"), "TESTE NEGATIVO: zero referência a hub-cozinhas em CÓDIGO de " + nome + " (comentário histórico é permitido)");
  });

  console.log("");
  console.log("==================================================");
  console.log("3. TILE DE CATEGORIA/HOME — estrutura media+faixa, emoji morto, título nunca no container de imagem");
  console.log("==================================================");
  const cardFnBody = sliceFn(appJs, "function renderCollectionCard(collection) {", "renderCollectionCard");
  assert(cardFnBody.indexOf('"category-card__media"') < cardFnBody.indexOf('"category-card__band"'), "media vem ANTES da faixa na montagem do template (ordem de construção)");
  assert(cardFnBody.indexOf('"category-card__title"') > cardFnBody.indexOf('"category-card__band"'), "título (__title) fica DENTRO da faixa (__band), nunca no container de mídia");
  assert(!cardFnBody.includes("collection.icon"), "TESTE NEGATIVO: renderCollectionCard não lê mais collection.icon (emoji morto)");
  assert(!cardFnBody.includes('iconSvg("photoOff"'), "TESTE NEGATIVO: sem ícone de fallback SVG montado no template — quem injeta placeholder é applyImage, só no tile de país e só quando a foto falha");
  assert(cardFnBody.includes('allRecipes.length + " receitas'), "contagem de receitas sobrevive na faixa (não é só o nome) — mantida no tile de país também");
  assert(
    cardFnBody.includes('collection.collectionType === "country"') && cardFnBody.includes("category-card--country"),
    "rumo novo: tile de país ganha classe category-card--country (foto de prato NÍTIDA, 4:3 — ver seção 6c)"
  );
  assert(!cardFnBody.includes("category-card--flag"), "TESTE NEGATIVO: category-card--flag morreu do template — tile de país não é mais bandeira");
  assert(
    cardFnBody.includes("countrySignatureRecipe(collection.id)") && cardFnBody.includes("loadRecipeImage(signature,"),
    "tile de país carrega a foto por countrySignatureRecipe + loadRecipeImage (mesma cascata foto própria -> Wikipedia -> placeholder das outras superfícies de receita)"
  );

  const homeMainTilesStart = appJs.indexOf("const HOME_MAIN_TILES = [");
  const homeMainTilesEnd = appJs.indexOf("];", homeMainTilesStart) + 2;
  const homeMainTilesSrc = appJs.slice(homeMainTilesStart, homeMainTilesEnd);
  assert((homeMainTilesSrc.match(/img: "imagens\/categorias\//g) || []).length === 4, "HOME_MAIN_TILES: as 4 entradas têm img: apontando pra imagens/categorias/ (nenhum caminho especial sobrou)");
  assert(
    /id: "cozinhas"[^}]*img: "imagens\/categorias\/paises\.webp"/.test(homeMainTilesSrc),
    "SUPERFÍCIE 2/2 — tile Países da Home aponta pra imagens/categorias/paises.webp (MESMO asset do banner do hub)"
  );
  assert(!homeMainTilesSrc.includes("mosaic"), "TESTE NEGATIVO: HOME_MAIN_TILES não tem mais campo mosaic (mural extinto)");
  assert(!homeMainTilesSrc.includes("hub-cozinhas.webp"), "TESTE NEGATIVO: HOME_MAIN_TILES não referencia hub-cozinhas.webp (arquivo fora do repo)");
  assert(!homeMainTilesSrc.includes("icon:"), "TESTE NEGATIVO: HOME_MAIN_TILES não tem mais campo icon (ícone outline morto, virou foto)");
  assert(/id: "cozinhas", label: "Países"/.test(homeMainTilesSrc), 'rodada 3: label do tile cozinhas é "Países" (curto, cabe em 1 linha, mesmo texto do título do hub)');
  assert(!homeMainTilesSrc.includes("Navegar por Países"), 'TESTE NEGATIVO: label longo "Navegar por Países" não sobra mais em HOME_MAIN_TILES (quebrava linha e desalinhava a altura dos 4 tiles)');

  const homeFnBody = sliceFn(appJs, "function renderHome() {", "renderHome");
  assert(homeFnBody.indexOf('"home-tile__media"') < homeFnBody.indexOf('"home-tile__band"'), "home-tile: media vem ANTES da faixa");
  assert(homeFnBody.indexOf('"home-tile__label"') > homeFnBody.indexOf('"home-tile__band"'), "home-tile: label fica DENTRO da faixa, nunca no container de mídia");
  assert(!homeFnBody.includes("iconSvg(tile.icon"), "TESTE NEGATIVO: renderHome não chama mais iconSvg(tile.icon, ...)");
  assert(!homeFnBody.includes("tile.mosaic"), "TESTE NEGATIVO: renderHome não tem mais ramo tile.mosaic — os 4 tiles saem do MESMO caminho <img class=home-tile__img>");
  assert(homeFnBody.includes('\'<img class="home-tile__img" src="\' + tile.img +'), "renderHome monta os 4 tiles por <img class=home-tile__img src=tile.img>, sem ternário");

  console.log("");
  console.log("==================================================");
  console.log("4. BANNER DE HUB — presente nos 3 hubs, folha (.grupo-sheet) nunca sobre o blur");
  console.log("==================================================");
  const grupoFnBody = sliceFn(appJs, "function renderGrupo(grupoId) {", "renderGrupo");
  assert(grupoFnBody.includes("GRUPO_BANNER_IMAGE[grupoId] || null"), "renderGrupo consulta GRUPO_BANNER_IMAGE por grupoId");
  assert(!grupoFnBody.includes("MOSAIC") && !grupoFnBody.includes("bannerMosaic"), "TESTE NEGATIVO: renderGrupo não consulta mais nenhum Set de mosaico nem ramifica por bannerMosaic");
  assert(grupoFnBody.includes("const hasBanner = !!bannerImg;"), "hasBanner virou só !!bannerImg (fonte ÚNICA de banner: a foto) — sem segundo mecanismo paralelo");
  assert(grupoFnBody.includes('"grupo-view" + (hasBanner ? " has-banner" : "")'), "wrap ganha classe has-banner só quando há banner (condicional, não fixo)");
  assert(grupoFnBody.includes('"grupo-banner"') && grupoFnBody.includes('"grupo-sheet"'), "banner (.grupo-banner) e folha (.grupo-sheet) construídos quando hasBanner é true");
  assert(
    grupoFnBody.includes('banner.innerHTML = \'<img class="grupo-banner__img" src="\' + bannerImg +'),
    "conteúdo do banner é SEMPRE <img class=grupo-banner__img> — caminho único, sem ternário"
  );
  assert(grupoFnBody.indexOf("sheetParent.appendChild(titleEl)") > grupoFnBody.indexOf("sheetParent = sheet"), "título é anexado a sheetParent DEPOIS de sheetParent apontar pra folha (nunca sobre o banner)");
  assert(!grupoFnBody.includes("grupo.icon"), "TESTE NEGATIVO: título do hub não concatena mais grupo.icon (emoji morto)");
  // Checa o PADRÃO funcional morto (statement de verdade), não a string solta "grupo.desc" —
  // o comentário logo acima na função explica em prosa que ela morreu e legitimamente contém
  // essas palavras (mesmo padrão já aceito em docs/comentários, ver verify-emoji-fase0c).
  assert(!grupoFnBody.includes("descEl.textContent") && !grupoFnBody.includes('className = "desc"'), "TESTE NEGATIVO: descrição textual do hub morreu — nem descEl nem a classe .desc são criados mais");

  console.log("");
  console.log("==================================================");
  console.log("4b. TESTE NEGATIVO — banner é EXCLUSIVO de hub: renderCategory (página de categoria/país) não ganha banner");
  console.log("==================================================");
  const categoryFnBody = sliceFn(appJs, "function renderCategory(collection, initialFacetTags, initialRole, initialIngredientMode) {", "renderCategory");
  assert(!categoryFnBody.includes("grupo-banner") && !categoryFnBody.includes("grupo-sheet"), "renderCategory NÃO constrói .grupo-banner nem .grupo-sheet — banner é só de hub");

  console.log("");
  console.log("==================================================");
  console.log("5. TILE DE PAÍS NO MODAL DE FILTROS — bandeira via iso2, emoji morto, layout próprio");
  console.log("==================================================");
  assert(!appJs.includes("function countryTileIconHtml("), "TESTE NEGATIVO: countryTileIconHtml não existe mais como função (só mencionada em comentário explicando a remoção)");
  assert(appJs.includes('layout: "photo-tiles"'), 'faceta País usa layout "photo-tiles" (estrutura própria, não "tiles" genérico)');
  const countryFacetLineStart = appJs.indexOf('{ key: "country"');
  const countryFacetLine = appJs.slice(countryFacetLineStart, appJs.indexOf("\r\n", countryFacetLineStart));
  assert(!countryFacetLine.includes("tileIcon"), "TESTE NEGATIVO: def da faceta País não tem mais tileIcon plugável");
  const countryTileFnBody = sliceFn(appJs, "function renderCountryTileSectionBody(sectionBody, def, options) {", "renderCountryTileSectionBody");
  assert(countryTileFnBody.includes("imagens/bandeiras/") && countryTileFnBody.includes("country.iso2"), "renderCountryTileSectionBody monta o caminho via window.COUNTRIES.<id>.iso2 -> imagens/bandeiras/<iso2>.webp");
  assert(countryTileFnBody.indexOf('"filter-tile__media"') < countryTileFnBody.indexOf('"filter-tile__band"'), "tile de país no modal: media vem ANTES da faixa");
  assert(countryTileFnBody.indexOf('"filter-tile__label"') > countryTileFnBody.indexOf('"filter-tile__band"'), "tile de país no modal: label fica DENTRO da faixa, nunca no container de mídia");
  assert(appJs.includes('if (def.layout === "photo-tiles") renderCountryTileSectionBody(sectionBody, def, options);'), "renderGenericSection despacha pra renderCountryTileSectionBody quando layout é photo-tiles");

  console.log("");
  console.log("==================================================");
  console.log("6. CSS — media+faixa dos 2 tipos de tile, banner de hub, tile de bandeira no modal");
  console.log("==================================================");
  [".category-card__media", ".category-card__band", ".home-tile__media", ".home-tile__band", ".grupo-banner", ".grupo-banner__img", ".grupo-sheet", ".filter-tile--photo", "--hub-banner-h"].forEach((sel) => {
    assert(css.includes(sel), "CSS declara " + sel);
  });
  const categoryBandRule = ruleBody(css, ".category-card__band {", ".category-card__band");
  assert(categoryBandRule.includes("background: var(--color-bg);"), ".category-card__band é SÓLIDA (var(--color-bg)) — regra-mãe, texto nunca sobre imagem");
  const homeBandRule = ruleBody(css, ".home-tile__band {", ".home-tile__band");
  assert(homeBandRule.includes("background: var(--color-bg);"), ".home-tile__band é SÓLIDA (var(--color-bg))");
  const grupoBannerImgRule = ruleBody(css, ".grupo-banner__img {", ".grupo-banner__img");
  // CALIBRAÇÃO FINAL pós-8.1.1 (2026-07-26): banner deixou de ser borrado — o blur sustentava
  // texto-sobre-imagem direto no banner, spec que a 8.1.1 já tinha aposentado (título/busca
  // vivem sempre na folha sólida). scale(1.1) morre junto — só existia pra esconder a borda que
  // o PRÓPRIO blur criava, sem blur não tem mais o que esconder.
  assert(!grupoBannerImgRule.includes("blur("), "TESTE NEGATIVO: .grupo-banner__img NÃO tem mais blur — banner nítido, mesma gramática de .recipe-hero");
  assert(!grupoBannerImgRule.includes("scale("), "TESTE NEGATIVO: .grupo-banner__img NÃO tem mais scale de compensação — não sobrou borda de blur pra esconder");
  assert(!/\.grupo-sheet\s*\{[^}]*blur/.test(css), "TESTE NEGATIVO: .grupo-sheet (a folha/conteúdo) NÃO leva blur — só o banner por trás dela");
  const chromeFloatRule = ruleBody(css, ".chrome-float {", ".chrome-float");
  assert(chromeFloatRule.includes("rgba(15, 15, 14, 0.55)"), "véu PRÓPRIO do back-float/exit-cook-float (rgba(15, 15, 14, 0.55)) inalterado — é ele, não o blur do banner, quem garante contraste do ícone sobre a foto (medido ao vivo, ver relatório da tarefa)");

  console.log("");
  console.log("==================================================");
  console.log("6a. CSS rodada 2 — ZERO CORTE na grade (1:1, media+faixa EMPILHADOS, não sobrepostos) e 4:3 mínimo na Home");
  console.log("==================================================");
  const categoryCardRule = ruleBody(css, ".category-card {", "categoria .category-card");
  assert(!categoryCardRule.includes("aspect-ratio"), "TESTE NEGATIVO: .category-card (o botão inteiro) NÃO tem mais aspect-ratio própria — moveu pra .category-card__media");
  const categoryMediaRule = ruleBody(css, ".category-card__media {", ".category-card__media");
  assert(categoryMediaRule.includes("aspect-ratio: 1;"), ".category-card__media tem aspect-ratio:1 — área de imagem é o QUADRADO INTEIRO do asset, zero corte");
  assert(!/position:\s*absolute/.test(categoryMediaRule), "TESTE NEGATIVO: .category-card__media NÃO é mais position:absolute (era o que fazia a faixa cobrir/fatiar a imagem)");
  const categoryBandPositionCheck = ruleBody(css, ".category-card__band {", ".category-card__band (posição)");
  assert(!/position:\s*absolute/.test(categoryBandPositionCheck), "TESTE NEGATIVO: .category-card__band NÃO é mais position:absolute — vem DEPOIS da mídia em fluxo normal, nunca sobrepondo");
  const homeMediaRule = ruleBody(css, ".home-tile__media {", ".home-tile__media");
  assert(homeMediaRule.includes("aspect-ratio: 4 / 3;"), ".home-tile__media tem aspect-ratio 4/3 (mínimo) — mais largo que o 1:1 da grade, tile grande também na proporção");
  assert(!/position:\s*absolute/.test(homeMediaRule), "TESTE NEGATIVO: .home-tile__media NÃO é mais position:absolute");
  const homeBandPositionCheck = ruleBody(css, ".home-tile__band {", ".home-tile__band (posição)");
  assert(!/position:\s*absolute/.test(homeBandPositionCheck), "TESTE NEGATIVO: .home-tile__band NÃO é mais position:absolute — empilhada abaixo da mídia");
  assert(css.includes("object-position: center;"), "object-position:center explícito nos 2 tipos de imagem (não depende do default implícito)");
  const homeBandRuleMinHeight = ruleBody(css, ".home-tile__band {", ".home-tile__band (min-height)");
  assert(
    /min-height:\s*calc\(var\(--text-md\)\s*\*\s*var\(--leading-tight\)\s*\+\s*var\(--space-3\)\s*\*\s*2\);/.test(homeBandRuleMinHeight),
    "rodada 3: .home-tile__band tem min-height derivado (1 linha de --text-md/--leading-tight + 2x --space-3) — garante altura igual nos 4 tiles mesmo se um label futuro quebrar linha"
  );

  console.log("");
  console.log("==================================================");
  console.log("6b. CSS — bandeira BORRADA + véu, slot 3:2 casando o asset, zoom mínimo (SÓ no modal de Filtros)");
  console.log("==================================================");
  assert(css.includes("--flag-blur:") && css.includes("--flag-veil:"), "--flag-blur/--flag-veil declarados em :root (calibração de 1 número cada)");
  assert(/--flag-blur:\s*1px;/.test(css), "rodada 4: --flag-blur calibrado pra 1px (quase imperceptível — o véu, não o blur, preserva a identidade escura; era 2,5px)");
  // Rumo novo de Países: .category-card--flag morreu inteiro (o tile do hub virou foto de prato,
  // seção 6c). O modal de Filtros é o ÚNICO consumidor de bandeira que sobrou — e portanto o
  // único de --flag-blur/--flag-veil. Sem este teste negativo, uma regra órfã de bandeira
  // sobreviveria no CSS sem ninguém notar, porque nada mais emite essa classe.
  assert(!css.includes(".category-card--flag"), "TESTE NEGATIVO: nenhuma regra .category-card--flag sobrou no CSS (tile de país não é mais bandeira)");
  const flagVarUsers = (css.match(/var\(--flag-(?:blur|veil)\)/g) || []).length;
  assert(flagVarUsers === 2, "--flag-blur/--flag-veil têm EXATAMENTE 2 usos, ambos em .filter-tile--photo (1 blur no __img, 1 véu no ::after) — achado: " + flagVarUsers);
  const filterPhotoRule = ruleBody(css, ".filter-tile--photo {", ".filter-tile--photo (container)");
  assert(!/position:\s*absolute/.test(filterPhotoRule) && !/position:\s*relative/.test(filterPhotoRule), "rodada 4: .filter-tile--photo não força mais position própria — media/faixa empilhados em fluxo normal, mesma correção do .category-card/.home-tile");
  const filterPhotoMediaRule = ruleBody(css, ".filter-tile--photo .filter-tile__media {", ".filter-tile--photo .filter-tile__media");
  assert(/aspect-ratio:\s*3 \/ 2;/.test(filterPhotoMediaRule), "rodada 4: .filter-tile--photo .filter-tile__media também casa 3:2");
  assert(!/position:\s*absolute/.test(filterPhotoMediaRule), "TESTE NEGATIVO: .filter-tile--photo .filter-tile__media não é mais position:absolute (media e faixa empilhados, não sobrepostos)");
  const filterPhotoImgRule = ruleBody(css, ".filter-tile--photo .filter-tile__img {", ".filter-tile--photo .filter-tile__img");
  assert(filterPhotoImgRule.includes("blur(var(--flag-blur))"), ".filter-tile--photo (modal de Filtros) também borra com var(--flag-blur), mesmo token");
  assert(filterPhotoImgRule.includes("scale(1.02)"), "rodada 4: .filter-tile--photo também reduz scale pra 1,02");
  assert(css.includes(".filter-tile--photo .filter-tile__media::after"), ".filter-tile--photo tem véu (::after) sobre a mídia");
  const filterPhotoBandRule = ruleBody(css, ".filter-tile--photo .filter-tile__band {", ".filter-tile--photo .filter-tile__band");
  assert(!/position:\s*absolute/.test(filterPhotoBandRule), "TESTE NEGATIVO: .filter-tile--photo .filter-tile__band não é mais position:absolute — vem DEPOIS da mídia em fluxo normal");
  // Achado ao vivo (rodada 4, verificação final): __label e __count são 2 <span> irmãos dentro
  // de __band, sem espaço nenhum no HTML entre eles (js/app.js monta os 2 colados). No tile-ícone
  // base o espaçamento vem do .filter-tile pai (flex column + gap, ver seção 1); aqui, sem
  // gap/flex PRÓPRIO de __band, colidiam de vdd na tela: "Itália12" sem separação nenhuma.
  assert(/display:\s*flex;/.test(filterPhotoBandRule) && /flex-direction:\s*column;/.test(filterPhotoBandRule), "rodada 4 (achado ao vivo): .filter-tile--photo .filter-tile__band é flex column — label e contagem (2 <span> irmãos colados no HTML) precisam de layout próprio pra não colidir");
  assert(/gap:\s*2px;/.test(filterPhotoBandRule), "rodada 4 (achado ao vivo): gap:2px entre label e contagem (mesmo valor de .category-card__band, consistência visual entre os 2 componentes)");
  assert(!/^\s*display:\s*block;/m.test(filterPhotoBandRule), "TESTE NEGATIVO: .filter-tile--photo .filter-tile__band não é mais só display:block (era o bug — sem gap, label+contagem coladas)");

  console.log("");
  console.log("==================================================");
  console.log("6c. CSS — TILE DE PAÍS = foto de prato NÍTIDA em 4:3 (não mais bandeira borrada)");
  console.log("==================================================");
  const countryMediaRule = ruleBody(css, ".category-card--country .category-card__media {", ".category-card--country .category-card__media");
  assert(/aspect-ratio:\s*4 \/ 3;/.test(countryMediaRule), "mídia do tile de país é 4:3 — MESMA proporção de .home-tile__media (composição overhead: corta só as laterais, nunca topo/base onde mora o prato)");
  assert(/display:\s*flex;/.test(countryMediaRule), "mídia é flex (centra o ícone de placeholder quando não há foto — mesma gramática de .recent-card__thumb)");
  // applyImage (js/app.js) monta o <img> em runtime SEM classe — se o seletor daqui exigisse
  // .category-card__img, a foto entraria sem dimensionamento nenhum e vazaria do tile, sem erro
  // no console. Por isso o seletor é por TAG, e por isso este teste existe.
  const countryImgRule = ruleBody(css, ".category-card--country .category-card__media img {", ".category-card--country .category-card__media img");
  assert(/object-fit:\s*cover;/.test(countryImgRule) && /width:\s*100%;/.test(countryImgRule) && /height:\s*100%;/.test(countryImgRule), "o <img> injetado por applyImage (SEM classe) é dimensionado por seletor de TAG — cover + 100%/100%");
  assert(css.includes(".category-card--country .category-card__media.placeholder svg"), "estado placeholder tem regra própria (ícone photoOff dimensionado), mesma gramática de .recipe-card__photo/.recent-card__thumb");
  assert(!countryImgRule.includes("blur("), "TESTE NEGATIVO: foto do tile de país é NÍTIDA — blur era muleta de bandeira, não se aplica a foto de prato");
  assert(!css.includes(".category-card--country .category-card__media::after"), "TESTE NEGATIVO: sem véu sobre a foto do tile de país (véu era muleta de bandeira)");

  console.log("");
  console.log("==================================================");
  console.log("7. RECEITA-ASSINATURA — os 20 países resolvem contra o ACERVO INTEIRO e têm foto em disco");
  console.log("==================================================");
  // ESTE É O PORTÃO CARO DESTA FRENTE. O modo de falha que ele existe pra impedir não dá erro
  // no console: um país cuja signatureRecipe não casa nome nenhum simplesmente fica com o tile
  // vazio. Falha de resolução TEM que ser falha de suíte, nunca silêncio.
  //
  // Carrega o acervo REAL na ordem do index.html (os 40 data/*.js populam window.RECIPES) e
  // resolve por nome exato contra o flat inteiro — a MESMA busca que countrySignatureRecipe faz
  // em runtime, não uma reimplementação otimista escopada por categoria.
  const acervo = {};
  acervo.window = acervo;
  vm.createContext(acervo);
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dataSrcs = (indexHtml.match(/<script src="(data\/[^"]+)"><\/script>/g) || []).map((t) => t.match(/src="([^"]+)"/)[1]);
  assert(dataSrcs.length > 0, "index.html lista os arquivos de data/ (achado " + dataSrcs.length + ")");
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "countries.js"), "utf8"), acervo, { filename: "js/countries.js" });
  dataSrcs.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), acervo, { filename: f }));
  const flat = [];
  Object.keys(acervo.RECIPES || {}).forEach((catId) => (acervo.RECIPES[catId] || []).forEach((r) => flat.push({ catId: catId, name: r.name })));
  assert(flat.length > 300, "acervo carregado no sandbox: " + flat.length + " receitas em " + Object.keys(acervo.RECIPES || {}).length + " categorias");

  // MESMA slug() de scripts/gerar-imagens.js e de slugFoto() em app.js (§2 do contrato: as três
  // andam juntas — se divergirem, toda foto própria some de uma vez, sem erro no console).
  const slugFoto = (nome) => String(nome).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const countryIds = Object.keys(acervo.COUNTRIES);
  assert(countryIds.length === 20, "window.COUNTRIES tem 20 países (achado " + countryIds.length + ")");
  const semSignature = countryIds.filter((id) => !acervo.COUNTRIES[id].signatureRecipe);
  assert(semSignature.length === 0, "os 20 têm signatureRecipe preenchida" + (semSignature.length ? " (faltando: " + semSignature.join(", ") + ")" : ""));

  const naoResolve = [];
  const ambiguo = [];
  const semFoto = [];
  const foraDaCategoria = [];
  countryIds.forEach((id) => {
    const nome = acervo.COUNTRIES[id].signatureRecipe;
    const hits = flat.filter((r) => r.name === nome);
    if (hits.length === 0) {
      naoResolve.push(id + ' -> "' + nome + '"');
      return;
    }
    // 2+ receitas com o MESMO nome em categorias diferentes: a busca por nome pegaria a primeira
    // da ordem de carregamento, que é acidental. Ambiguidade é falha, não empate aceitável.
    if (hits.length > 1) ambiguo.push(id + ' -> "' + nome + '" em ' + hits.map((h) => h.catId).join("/"));
    if (hits[0].catId !== id) foraDaCategoria.push(id + " -> " + hits[0].catId);
    if (!fs.existsSync(path.join(ROOT, "imagens", "receitas", slugFoto(nome) + ".webp"))) semFoto.push(id + ' -> "' + nome + '"');
  });
  assert(naoResolve.length === 0, "os 20 ids RESOLVEM pra uma receita existente no acervo" + (naoResolve.length ? " — NÃO RESOLVEM: " + naoResolve.join("; ") : ""));
  assert(ambiguo.length === 0, "nenhuma das 20 resolve de forma AMBÍGUA (2+ receitas com o mesmo nome)" + (ambiguo.length ? " — ambíguas: " + ambiguo.join("; ") : ""));
  assert(semFoto.length === 0, "as 20 receitas-assinatura têm .webp em imagens/receitas/ (slug idêntico ao do gerador)" + (semFoto.length ? " — SEM FOTO: " + semFoto.join("; ") : ""));
  // Trava o número que justifica a busca no acervo inteiro. Se alguém "otimizar" pra
  // RECIPES[catId], estes 5 quebram — e a suíte diz quais, em vez de o app ficar mudo.
  assert(
    foraDaCategoria.length === 5,
    "EXATAMENTE 5 das 20 moram FORA da categoria do próprio país — é isto que proíbe resolver por RECIPES[catId] (achado " + foraDaCategoria.length + ": " + foraDaCategoria.join(", ") + ")"
  );
  assert(
    ["brasil", "franca", "italia", "espanha", "hungria"].every((id) => foraDaCategoria.some((f) => f.indexOf(id + " ->") === 0)),
    "os 5 de fora são exatamente brasil/franca/italia/espanha/hungria (mesma lista do §4 do contrato e do comentário de js/countries.js)"
  );
  countryIds.forEach((id) => {
    const nome = acervo.COUNTRIES[id].signatureRecipe;
    const hit = flat.filter((r) => r.name === nome)[0];
    console.log("       " + id.padEnd(11) + ' "' + nome + '" -> ' + (hit ? hit.catId : "???") + (hit && hit.catId !== id ? "   [FORA]" : ""));
  });

  console.log("");
  console.log("==================================================");
  console.log("8. CHROME-CLEARANCE — exceção 'float sobre mídia' ampliada (recipe-page + grupo-view.has-banner)");
  console.log("==================================================");
  const grupoViewRule = ruleBody(css, ".grupo-view {", ".grupo-view (base)");
  assert(/padding-top:\s*var\(--chrome-clearance\);/.test(grupoViewRule), ".grupo-view (base, sem banner) continua reservando --chrome-clearance — tempo/dificuldade intactos");
  const hasBannerRule = ruleBody(css, ".grupo-view.has-banner {", ".grupo-view.has-banner");
  assert(/padding-top:\s*0;/.test(hasBannerRule), ".grupo-view.has-banner ZERA o padding-top (exceção nova — float senta no banner)");

  console.log("");
  console.log("==================================================");
  console.log("8b. RITMO DA FOLHA DO HUB (rodada 2, pós-revisão do dono) — tokens explícitos, nada solto");
  console.log("==================================================");
  const grupoSheetRule = ruleBody(css, ".grupo-sheet {", ".grupo-sheet");
  assert(/padding:\s*var\(--space-6\)\s*var\(--space-5\)\s*0;/.test(grupoSheetRule), ".grupo-sheet: padding-top --space-6, lateral --space-5 (mesmos tokens da folha da página de receita)");
  const grupoH2Rule = ruleBody(css, ".grupo-view h2 {", ".grupo-view h2");
  assert(/margin:\s*0 0 var\(--space-4\);/.test(grupoH2Rule), "título->busca: margin-bottom --space-4 (era --space-05/2px, ritmo solto demais)");
  const searchWrapRule = ruleBody(css, ".home-search-wrap {", ".home-search-wrap");
  assert(/margin-bottom:\s*var\(--space-6\);/.test(searchWrapRule), "busca->conteúdo: margin-bottom --space-6 (era --space-5)");

  console.log("");
  console.log("==================================================");
  console.log("9. SERVICE WORKER — v35 (calibração final do banner de hub, sem blur) + APP_SHELL completo");
  console.log("==================================================");
  const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert(swJs.includes('const CACHE_NAME = "cardapio-v35";'), "CACHE_NAME v35 — css/style.css mudou (banner de hub sem blur), está no APP_SHELL");
  // Regressão que passou despercebida desde que js/countries.js foi criado: o arquivo é
  // pré-requisito duro de js/categories.js e js/collections.js (os dois leem window.COUNTRIES
  // no topo, fora de função) e não estava no APP_SHELL. Ficava no cache só de carona, pelo
  // cache.put do handler network-first — some numa evicção ou num offline logo após a primeira
  // visita, e aí o app não degrada, quebra. Agora que ele carrega o signatureRecipe dos 20
  // tiles, é shell. O teste de ORDEM é a parte que importa: precachear na ordem errada não
  // quebra o install (addAll não executa nada), mas deixa a lista mentindo sobre a dependência.
  const shellStart = swJs.indexOf("const APP_SHELL = [");
  const shellSrc = swJs.slice(shellStart, swJs.indexOf("];", shellStart));
  assert(shellSrc.includes('"js/countries.js"'), "js/countries.js está no APP_SHELL (pré-requisito de categories.js/collections.js e fonte do signatureRecipe dos 20 tiles)");
  assert(
    shellSrc.indexOf('"js/countries.js"') < shellSrc.indexOf('"js/categories.js"') && shellSrc.indexOf('"js/countries.js"') < shellSrc.indexOf('"js/collections.js"'),
    "js/countries.js vem ANTES de categories.js e collections.js no APP_SHELL — mesma ordem do index.html"
  );

  console.log("");
  console.log("==================================================");
  console.log("10. INFORMATIVO — peso em disco da grade 'Mais Categorias' (6 imagens visíveis; massas/sobremesas ficam só nos tiles da Home)");
  console.log("==================================================");
  const GRID_IDS = ["molhos", "sopas", "entradas", "risotos-arroz", "padaria", "tecnicas"];
  let totalBytes = 0;
  GRID_IDS.forEach((id) => {
    const full = path.join(categoriaDir, id + ".webp");
    const bytes = fs.statSync(full).size;
    totalBytes += bytes;
    console.log("  " + id + ".webp: " + (bytes / 1024).toFixed(1) + " KB");
  });
  console.log("  TOTAL (peso em disco, aproxima a transferência real): " + (totalBytes / 1024).toFixed(1) + " KB");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
