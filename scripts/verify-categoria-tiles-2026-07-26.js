// scripts/verify-categoria-tiles-2026-07-26.js
//
// Suíte do item final do redesenho visual (item 6 do roadmap-mestre, CHECKLIST-GERAL.md): tile
// de categoria/home, banner de hub, tile de bandeira + extermínio final de emoji.
//
// Verifica ESTRUTURA (media+faixa nos 2 tipos de tile, banner só em hub — nunca em
// categoria/país, título nunca dentro do container de imagem) e MAPEAMENTO
// (collectionTileImageSrc/GRUPO_BANNER_IMAGE extraídos de app.js e EXECUTADOS de verdade contra
// window.COLLECTIONS real, não só grep do literal) — confirma que todo caminho resolvido existe
// de fato em disco e que a lista de órfãos bate exatamente com a do relatório da tarefa.
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
  assert(categoriaFiles.length === 19, "imagens/categorias/: 19 webp (achado " + categoriaFiles.length + ")");
  assert(bandeiraFiles.length === 20, "imagens/bandeiras/: 20 webp (achado " + bandeiraFiles.length + ")");

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
  const EXPECTED_ORPHANS = ["col-rapidas", "col-ate-1h", "col-mais-de-1h", "col-preparo-longo", "col-faceis", "col-intermediarias", "col-avancadas"];

  assert(imaged.length === EXPECTED_CATEGORY_IDS.length + EXPECTED_COUNTRY_IDS.length, "total de tiles COM imagem: " + imaged.length + " (esperado " + (EXPECTED_CATEGORY_IDS.length + EXPECTED_COUNTRY_IDS.length) + " = 16 categoria + 20 país)");
  assert(orphan.length === EXPECTED_ORPHANS.length, "total de tiles ÓRFÃOS (sem imagem): " + orphan.length + " (esperado " + EXPECTED_ORPHANS.length + ")");
  assert(
    EXPECTED_ORPHANS.every((id) => orphan.indexOf(id) !== -1) && orphan.every((id) => EXPECTED_ORPHANS.indexOf(id) !== -1),
    "lista de órfãos bate EXATAMENTE com a esperada (Por tempo x4 + Por dificuldade x3): " + orphan.join(", ")
  );

  const missing = [];
  imaged.forEach((item) => {
    const full = path.join(ROOT, item.src.split("/").join(path.sep));
    if (!fs.existsSync(full)) missing.push(item.id + " -> " + item.src);
  });
  assert(missing.length === 0, "TODOS os " + imaged.length + " caminhos resolvidos por collectionTileImageSrc existem de fato em disco" + (missing.length ? " (faltando: " + missing.join("; ") + ")" : ""));

  const countryImaged = imaged.filter((i) => i.src.indexOf("imagens/bandeiras/") === 0);
  const categoryImaged = imaged.filter((i) => i.src.indexOf("imagens/categorias/") === 0);
  assert(countryImaged.length === 20, "20 coleções de país resolvem pra imagens/bandeiras/<iso2>.webp");
  assert(categoryImaged.length === 16, "16 coleções (8 Fundamentos + 8 Proteínas) resolvem pra imagens/categorias/<id>.webp");

  console.log("");
  console.log("==================================================");
  console.log("2. BANNER DE HUB — GRUPO_BANNER_IMAGE + GRUPO_BANNER_MOSAIC EXECUTADOS (3 hubs alcançáveis, tempo/dificuldade sem banner)");
  console.log("==================================================");
  const bannerStart = appJs.indexOf("const GRUPO_BANNER_IMAGE = {");
  const bannerEnd = appJs.indexOf("};", bannerStart) + 2;
  assert(bannerStart > 0 && bannerEnd > bannerStart, "GRUPO_BANNER_IMAGE encontrado em app.js");
  const mosaicSetStart = appJs.indexOf('const GRUPO_BANNER_MOSAIC = new Set([');
  const mosaicSetEnd = appJs.indexOf("]);", mosaicSetStart) + 3;
  assert(mosaicSetStart > bannerEnd, "GRUPO_BANNER_MOSAIC encontrado em app.js, depois de GRUPO_BANNER_IMAGE");
  // const/let de topo-de-script não viram propriedade do objeto de contexto no vm (só function
  // declaration e var viram) — troca só NESTE snippet extraído (não no arquivo real) pra
  // conseguir ler sandbox.GRUPO_BANNER_IMAGE/GRUPO_BANNER_MOSAIC depois do runInContext.
  vm.runInContext(
    appJs.slice(bannerStart, bannerEnd).replace("const GRUPO_BANNER_IMAGE", "var GRUPO_BANNER_IMAGE") +
      "\n" +
      appJs.slice(mosaicSetStart, mosaicSetEnd).replace("const GRUPO_BANNER_MOSAIC", "var GRUPO_BANNER_MOSAIC"),
    sandbox,
    { filename: "extracted-GRUPO_BANNER_IMAGE-MOSAIC" }
  );
  assert(typeof sandbox.GRUPO_BANNER_IMAGE === "object" && sandbox.GRUPO_BANNER_IMAGE !== null, "GRUPO_BANNER_IMAGE carregado no sandbox");
  // "instanceof Set" falharia aqui mesmo com um Set genuíno: o objeto foi criado DENTRO do
  // realm isolado do vm, com seu próprio Set.prototype — diferente do Set deste processo Node.
  // Duck-typing (tem .has()) é o jeito realm-safe de confirmar que é um Set de verdade.
  assert(sandbox.GRUPO_BANNER_MOSAIC && typeof sandbox.GRUPO_BANNER_MOSAIC.has === "function", "GRUPO_BANNER_MOSAIC carregado no sandbox como Set (duck-typed, realm-safe)");
  const bannerImgKeys = Object.keys(sandbox.GRUPO_BANNER_IMAGE || {});
  assert(
    bannerImgKeys.length === 2 && ["fundamentos", "proteinas"].every((k) => bannerImgKeys.indexOf(k) !== -1),
    "GRUPO_BANNER_IMAGE tem EXATAMENTE 2 chaves (foto): fundamentos/proteinas (achado: " + bannerImgKeys.join(", ") + ")"
  );
  assert(
    sandbox.GRUPO_BANNER_MOSAIC.size === 1 && sandbox.GRUPO_BANNER_MOSAIC.has("cozinhas"),
    "GRUPO_BANNER_MOSAIC tem EXATAMENTE 1 entrada (mosaico): cozinhas (rodada 2 — hub-cozinhas.webp arquivado, ver item D do relatório)"
  );
  assert(!("cozinhas" in sandbox.GRUPO_BANNER_IMAGE), "TESTE NEGATIVO: cozinhas NÃO tem mais entrada em GRUPO_BANNER_IMAGE (a foto de temperos foi arquivada)");
  assert(
    !("tempo" in sandbox.GRUPO_BANNER_IMAGE) && !("dificuldade" in sandbox.GRUPO_BANNER_IMAGE) && !sandbox.GRUPO_BANNER_MOSAIC.has("tempo") && !sandbox.GRUPO_BANNER_MOSAIC.has("dificuldade"),
    "TESTE NEGATIVO: tempo/dificuldade (rotas órfãs) NÃO têm banner, nem foto nem mosaico"
  );
  bannerImgKeys.forEach((k) => {
    const full = path.join(ROOT, sandbox.GRUPO_BANNER_IMAGE[k].split("/").join(path.sep));
    assert(fs.existsSync(full), "banner de " + k + " existe em disco: " + sandbox.GRUPO_BANNER_IMAGE[k]);
  });
  assert(fs.existsSync(path.join(ROOT, "imagens", "categorias", "hub-cozinhas.webp")), "hub-cozinhas.webp ARQUIVADO mas presente em disco (não apagado, só sem consumidor)");

  console.log("");
  console.log("==================================================");
  console.log("3. TILE DE CATEGORIA/HOME — estrutura media+faixa, emoji morto, título nunca no container de imagem");
  console.log("==================================================");
  const cardFnBody = sliceFn(appJs, "function renderCollectionCard(collection) {", "renderCollectionCard");
  assert(cardFnBody.indexOf('"category-card__media"') < cardFnBody.indexOf('"category-card__band"'), "media vem ANTES da faixa na montagem do template (ordem de construção)");
  assert(cardFnBody.indexOf('"category-card__title"') > cardFnBody.indexOf('"category-card__band"'), "título (__title) fica DENTRO da faixa (__band), nunca no container de mídia");
  assert(!cardFnBody.includes("collection.icon"), "TESTE NEGATIVO: renderCollectionCard não lê mais collection.icon (emoji morto)");
  assert(!cardFnBody.includes('iconSvg("photoOff"'), "TESTE NEGATIVO: sem ícone de fallback SVG — fallback é tipográfico limpo (faixa + nome, sem buraco), não um ícone");
  assert(cardFnBody.includes('allRecipes.length + " receitas'), "contagem de receitas sobrevive na faixa (não é só o nome)");
  assert(
    cardFnBody.includes('collection.collectionType === "country"') && cardFnBody.includes("category-card--flag"),
    "rodada 2: tile de país ganha classe category-card--flag (bandeira borrada+véu, ver seção 6)"
  );

  const homeMainTilesStart = appJs.indexOf("const HOME_MAIN_TILES = [");
  const homeMainTilesEnd = appJs.indexOf("];", homeMainTilesStart) + 2;
  const homeMainTilesSrc = appJs.slice(homeMainTilesStart, homeMainTilesEnd);
  assert((homeMainTilesSrc.match(/img: "imagens\/categorias\//g) || []).length === 3, "HOME_MAIN_TILES: 3 das 4 entradas têm img: apontando pra imagens/categorias/ (rodada 2 — cozinhas virou mosaico)");
  assert(homeMainTilesSrc.includes('id: "cozinhas"') && /id: "cozinhas"[^}]*mosaic: true/.test(homeMainTilesSrc), "HOME_MAIN_TILES: entrada cozinhas tem mosaic: true, sem campo img");
  assert(!homeMainTilesSrc.includes("hub-cozinhas.webp"), "TESTE NEGATIVO: HOME_MAIN_TILES não referencia mais hub-cozinhas.webp (arquivado)");
  assert(!homeMainTilesSrc.includes("icon:"), "TESTE NEGATIVO: HOME_MAIN_TILES não tem mais campo icon (ícone outline morto, virou foto)");
  assert(/id: "cozinhas", label: "Países"/.test(homeMainTilesSrc), 'rodada 3: label do tile cozinhas é "Países" (curto, cabe em 1 linha, mesmo texto do título do hub)');
  assert(!homeMainTilesSrc.includes("Navegar por Países"), 'TESTE NEGATIVO: label longo "Navegar por Países" não sobra mais em HOME_MAIN_TILES (quebrava linha e desalinhava a altura dos 4 tiles)');

  const homeFnBody = sliceFn(appJs, "function renderHome() {", "renderHome");
  assert(homeFnBody.indexOf('"home-tile__media"') < homeFnBody.indexOf('"home-tile__band"'), "home-tile: media vem ANTES da faixa");
  assert(homeFnBody.indexOf('"home-tile__label"') > homeFnBody.indexOf('"home-tile__band"'), "home-tile: label fica DENTRO da faixa, nunca no container de mídia");
  assert(!homeFnBody.includes("iconSvg(tile.icon"), "TESTE NEGATIVO: renderHome não chama mais iconSvg(tile.icon, ...)");
  assert(homeFnBody.includes("tile.mosaic ? buildFlagMosaicHtml()"), "rodada 2: renderHome usa buildFlagMosaicHtml() quando tile.mosaic é true");

  console.log("");
  console.log("==================================================");
  console.log("4. BANNER DE HUB — presente nos 3 hubs, folha (.grupo-sheet) nunca sobre o blur");
  console.log("==================================================");
  const grupoFnBody = sliceFn(appJs, "function renderGrupo(grupoId) {", "renderGrupo");
  assert(grupoFnBody.includes("GRUPO_BANNER_IMAGE[grupoId] || null"), "renderGrupo consulta GRUPO_BANNER_IMAGE por grupoId");
  assert(grupoFnBody.includes("GRUPO_BANNER_MOSAIC.has(grupoId)"), "rodada 2: renderGrupo também consulta GRUPO_BANNER_MOSAIC por grupoId (cozinhas)");
  assert(grupoFnBody.includes('"grupo-view" + (hasBanner ? " has-banner" : "")'), "wrap ganha classe has-banner (foto OU mosaico) só quando há banner de algum tipo (condicional, não fixo)");
  assert(grupoFnBody.includes('"grupo-banner"') && grupoFnBody.includes('"grupo-sheet"'), "banner (.grupo-banner) e folha (.grupo-sheet) construídos quando hasBanner é true");
  assert(grupoFnBody.includes("bannerMosaic ? buildFlagMosaicHtml() :"), "rodada 2: renderGrupo escolhe mosaico OU foto pro conteúdo do banner");
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
  assert(grupoBannerImgRule.includes("blur(6px)"), ".grupo-banner__img usa blur(6px), conforme especificado (fundamentos/proteinas — cozinhas agora é mosaico, ver seção 6c)");
  assert(!/\.grupo-sheet\s*\{[^}]*blur/.test(css), "TESTE NEGATIVO: .grupo-sheet (a folha/conteúdo) NÃO leva blur — só o banner por trás dela");

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
  console.log("6b. CSS rodada 2/3/4 — bandeira BORRADA + véu (nunca nítida), slot 3:2 casando o asset, zoom mínimo");
  console.log("==================================================");
  assert(css.includes("--flag-blur:") && css.includes("--flag-veil:"), "--flag-blur/--flag-veil declarados em :root (calibração de 1 número cada)");
  assert(/--flag-blur:\s*1px;/.test(css), "rodada 4: --flag-blur calibrado pra 1px (quase imperceptível — o véu, não o blur, preserva a identidade escura; era 2,5px)");
  const flagTileMediaRule = ruleBody(css, ".category-card--flag .category-card__media {", ".category-card--flag .category-card__media");
  assert(/aspect-ratio:\s*3 \/ 2;/.test(flagTileMediaRule), "rodada 4: .category-card--flag .category-card__media casa a proporção 3:2 do asset (era 1:1 herdado de categoria) — corte ~zero");
  const flagTileImgRule = ruleBody(css, ".category-card--flag .category-card__img {", ".category-card--flag .category-card__img");
  assert(flagTileImgRule.includes("blur(var(--flag-blur))"), ".category-card--flag borra a bandeira com var(--flag-blur)");
  assert(flagTileImgRule.includes("scale(1.02)"), "rodada 4: scale reduzido pra 1,02 (era 1,15 — zoom é o mínimo que cobre, não sobra corte de proporção pra disfarçar)");
  assert(css.includes(".category-card--flag .category-card__media::after"), ".category-card--flag tem véu (::after) sobre a mídia, nunca sobre a faixa");
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
  console.log("6c. CSS+JS rodada 2/3/4 — mural de bandeiras INTEIRAS 2x2 (Países: tile da Home + banner do hub)");
  console.log("==================================================");
  assert(css.includes(".flag-mosaic {") && css.includes("--flag-mosaic-blur:") && css.includes("--flag-mosaic-veil:"), "CSS declara .flag-mosaic + os 2 tokens de calibração");
  assert(/--flag-mosaic-blur:\s*1\.5px;/.test(css), "rodada 4: --flag-mosaic-blur calibrado pra 1,5px (era 4px — célula agora é bandeira INTEIRA, não precisa disfarçar corte)");
  const flagMosaicRule = ruleBody(css, ".flag-mosaic {", ".flag-mosaic (grid)");
  assert(/grid-template-columns:\s*repeat\(2,\s*1fr\);/.test(flagMosaicRule) && /grid-template-rows:\s*repeat\(2,\s*1fr\);/.test(flagMosaicRule), "rodada 4: .flag-mosaic é grid 2x2 (era 3x3 recortado — virou mural de bandeiras INTEIRAS, 4 maiores em vez de 9 pequenas)");
  assert(/gap:\s*3px;/.test(flagMosaicRule), "rodada 4: gap de 3px entre bandeiras (framing fino, não buraco)");
  const flagMosaicImgRule = ruleBody(css, ".flag-mosaic img {", ".flag-mosaic img");
  assert(flagMosaicImgRule.includes("blur(var(--flag-mosaic-blur))"), ".flag-mosaic img usa var(--flag-mosaic-blur)");
  assert(flagMosaicImgRule.includes("scale(1.03)"), "rodada 4: scale reduzido pra 1,03 (era 1,15 — blur muito mais leve, não precisa esconder tanta borda)");
  assert(css.includes(".flag-mosaic::after"), ".flag-mosaic tem véu único (::after) sobre o conjunto das bandeiras");
  const mosaicFnStart = appJs.indexOf("function buildFlagMosaicHtml() {");
  assert(mosaicFnStart > 0, "buildFlagMosaicHtml encontrada em app.js");
  const mosaicIsoStart = appJs.indexOf("const FLAG_MOSAIC_ISO2 = [");
  const mosaicIsoEnd = appJs.indexOf("];", mosaicIsoStart) + 2;
  assert(mosaicIsoStart > 0 && mosaicIsoStart < mosaicFnStart, "FLAG_MOSAIC_ISO2 declarado antes de buildFlagMosaicHtml, mesmo módulo");
  vm.runInContext(
    appJs.slice(mosaicIsoStart, mosaicIsoEnd).replace("const FLAG_MOSAIC_ISO2", "var FLAG_MOSAIC_ISO2") + "\n" + appJs.slice(mosaicFnStart, appJs.indexOf("\r\n  }", mosaicFnStart) + 5),
    sandbox,
    { filename: "extracted-buildFlagMosaicHtml" }
  );
  assert(
    Array.isArray(sandbox.FLAG_MOSAIC_ISO2) && sandbox.FLAG_MOSAIC_ISO2.length === 4,
    "rodada 4: FLAG_MOSAIC_ISO2 tem EXATAMENTE 4 países, grid 2x2 (era 9/3x3 na rodada 3; achado: " + (sandbox.FLAG_MOSAIC_ISO2 || []).join(", ") + ")"
  );
  const mosaicHtml = sandbox.buildFlagMosaicHtml();
  const mosaicImgCount = (mosaicHtml.match(/<img /g) || []).length;
  assert(mosaicImgCount === 4, "buildFlagMosaicHtml() gera EXATAMENTE 4 <img> (achado: " + mosaicImgCount + ")");
  const mosaicFlagsExist = sandbox.FLAG_MOSAIC_ISO2.every((iso2) => fs.existsSync(path.join(bandeiraDir, iso2 + ".webp")));
  assert(mosaicFlagsExist, "as " + sandbox.FLAG_MOSAIC_ISO2.length + " bandeiras do mural existem de fato em disco (imagens/bandeiras/<iso2>.webp)");
  const mosaicUnique = new Set(sandbox.FLAG_MOSAIC_ISO2).size === sandbox.FLAG_MOSAIC_ISO2.length;
  assert(mosaicUnique, "as 4 bandeiras do mural são todas DISTINTAS (0 repetição)");
  // Checa o CAMINHO USÁVEL entre aspas (o que importaria como valor de src), não a string solta
  // "hub-cozinhas.webp" — os comentários desta própria rodada mencionam o nome do arquivo em
  // prosa pra explicar o arquivamento, o que é esperado (mesmo padrão já aceito em comentários/
  // docs, ver verify-emoji-fase0c).
  assert(!appJs.includes('"imagens/categorias/hub-cozinhas.webp"'), "TESTE NEGATIVO: nenhum código em app.js usa mais o caminho imagens/categorias/hub-cozinhas.webp como valor (só mencionado em comentário explicando o arquivamento)");

  console.log("");
  console.log("==================================================");
  console.log("7. CHROME-CLEARANCE — exceção 'float sobre mídia' ampliada (recipe-page + grupo-view.has-banner)");
  console.log("==================================================");
  const grupoViewRule = ruleBody(css, ".grupo-view {", ".grupo-view (base)");
  assert(/padding-top:\s*var\(--chrome-clearance\);/.test(grupoViewRule), ".grupo-view (base, sem banner) continua reservando --chrome-clearance — tempo/dificuldade intactos");
  const hasBannerRule = ruleBody(css, ".grupo-view.has-banner {", ".grupo-view.has-banner");
  assert(/padding-top:\s*0;/.test(hasBannerRule), ".grupo-view.has-banner ZERA o padding-top (exceção nova — float senta no banner)");

  console.log("");
  console.log("==================================================");
  console.log("7b. RITMO DA FOLHA DO HUB (rodada 2, pós-revisão do dono) — tokens explícitos, nada solto");
  console.log("==================================================");
  const grupoSheetRule = ruleBody(css, ".grupo-sheet {", ".grupo-sheet");
  assert(/padding:\s*var\(--space-6\)\s*var\(--space-5\)\s*0;/.test(grupoSheetRule), ".grupo-sheet: padding-top --space-6, lateral --space-5 (mesmos tokens da folha da página de receita)");
  const grupoH2Rule = ruleBody(css, ".grupo-view h2 {", ".grupo-view h2");
  assert(/margin:\s*0 0 var\(--space-4\);/.test(grupoH2Rule), "título->busca: margin-bottom --space-4 (era --space-05/2px, ritmo solto demais)");
  const searchWrapRule = ruleBody(css, ".home-search-wrap {", ".home-search-wrap");
  assert(/margin-bottom:\s*var\(--space-6\);/.test(searchWrapRule), "busca->conteúdo: margin-bottom --space-6 (era --space-5)");

  console.log("");
  console.log("==================================================");
  console.log("8. SERVICE WORKER — v33 (bump desta leva)");
  console.log("==================================================");
  const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert(swJs.includes('const CACHE_NAME = "cardapio-v33";'), "CACHE_NAME v33 — css/style.css, js/app.js, js/categories.js e js/collections.js mudaram, todos no APP_SHELL");

  console.log("");
  console.log("==================================================");
  console.log("9. INFORMATIVO — peso em disco da grade 'Mais Categorias' (6 imagens visíveis; massas/sobremesas ficam só nos tiles da Home)");
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
