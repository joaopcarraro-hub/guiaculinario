// scripts/verify-desktop-tier-2026-08-05.js
//
// PASSADA DESKTOP (2026-08-05), passo 2+3 do prompt do dono — implementação do tier largo.
// Tudo dentro de UMA ÚNICA @media (min-width: 900px), colocada no fim de css/style.css (mesmo
// padrão dos 2 overrides @media (max-width: 700px) já existentes — precisa vir DEPOIS na
// cascata pra vencer especificidade igual). Exceção: o fix de especificidade de
// .category-grid.category-grid--compact (item 8) vive FORA de qualquer media query — afeta os
// 2 tiers (bug real, não só uma correção do tier largo), verificado à parte abaixo.
//
// js/app.js e css/style.css são fortemente acoplados, sem build — verificado por texto exato do
// código-fonte, nunca por ref de git (regra do CLAUDE.md: só literais, HEAD é mutável).
//
// Medições ao vivo (DOM real, 3 breakpoints, navegador — não reproduzidas aqui como teste
// automático porque este projeto não usa jsdom/Puppeteer; os verify-*.js existentes são todos
// texto/regex sobre o fonte, este segue o mesmo padrão) ficam no relatório da tarefa. Este
// arquivo prova o CONTRATO estático (as regras existem, com os valores certos, no lugar certo,
// isoladas do mobile) — a prova AO VIVO (cpl real, contagem de colunas real) é responsabilidade
// da rodada que editar isto, documentada no relatório, não deste script.
//
// `node scripts/verify-desktop-tier-2026-08-05.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

function main() {
  console.log("==================================================");
  console.log("0. MEDIA QUERY ÚNICA — todo o tier largo mora numa só @media (min-width: 900px)");
  console.log("==================================================");
  const openers = css.match(/@media \(min-width: 900px\)/g) || [];
  assert(openers.length === 1, "exatamente 1 ocorrência de \"@media (min-width: 900px)\" em style.css — " + openers.length + " encontrada(s)");
  const desktopStart = css.indexOf("@media (min-width: 900px)");
  assert(desktopStart > -1, "bloco do tier largo existe");
  const mobileZone = css.slice(0, desktopStart);
  const desktopZone = css.slice(desktopStart);
  assert(desktopZone.trim().endsWith("}"), "bloco do tier largo é o ÚLTIMO conteúdo do arquivo (fecha no fim, sem nada depois)");

  console.log("");
  console.log("==================================================");
  console.log("1. CONTAINER — #main 980px -> 1320px, calha lateral --space-6");
  console.log("==================================================");
  assert(/#main\s*\{\s*\n\s*max-width:\s*1320px;\s*\n\s*padding-left:\s*var\(--space-6\);\s*\n\s*padding-right:\s*var\(--space-6\);\s*\n\s*\}/.test(desktopZone), "#main ganha max-width:1320px + padding-left/right:var(--space-6) dentro do tier largo");
  assert(/#main\s*\{\s*\n\s*padding:\s*var\(--space-10\)\s*var\(--space-12\)/.test(mobileZone), "regra BASE de #main (--space-10/--space-12, 980px) continua intocada fora do tier largo");
  assert(!/max-width:\s*1320px/.test(mobileZone), "TESTE NEGATIVO: 1320px não aparece fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("2. CHROME FLOATS — ancorados no container (1320px), exceções preservadas");
  console.log("==================================================");
  assert(/\.chrome-float\s*\{\s*\n\s*left:\s*max\(var\(--space-3\),\s*calc\(\(100vw - 1320px\)\s*\/\s*2\s*\+\s*var\(--space-3\)\)\);\s*\n\s*\}/.test(desktopZone), ".chrome-float ganha left ancorado no container (max() com a fórmula de 1320px)");
  assert(/\.grupo-view\.has-banner \.chrome-float\s*\{\s*\n\s*left:\s*calc\(env\(safe-area-inset-left\)\s*\+\s*var\(--space-3\)\);\s*\n\s*\}/.test(desktopZone), "exceção mantida: hub com banner full-bleed continua no canto físico");
  assert(/\.recipe-page > \.back-float\s*\{\s*\n\s*left:\s*calc\(\(100vw - min\(100vw, 1100px\)\)\s*\/\s*2\s*\+\s*var\(--space-3\)\);\s*\n\s*\}/.test(desktopZone), "exceção da página de receita: back-float ancorado no canto da capa contida (1100px), não no container 1320 nem no viewport");
  assert(/\.recipe-page > \.recipe-hero__heart\s*\{\s*\n\s*right:\s*calc\(\(100vw - min\(100vw, 1100px\)\)\s*\/\s*2\s*\+\s*var\(--space-3\)\);\s*\n\s*\}/.test(desktopZone), "espelho: coração ancorado no canto da capa contida, right em vez de left");
  assert(/\.chrome-float\s*\{\s*\n\s*position:\s*fixed;\s*\n\s*top:\s*calc\(env\(safe-area-inset-top\)\s*\+\s*var\(--space-3\)\);\s*\n\s*left:\s*calc\(env\(safe-area-inset-left\)\s*\+\s*var\(--space-3\)\);/.test(mobileZone), "regra BASE de .chrome-float (canto físico do viewport) continua intocada fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("3. BOTTOM NAV — barra full-width, abas com teto de 640px (128px x 5)");
  console.log("==================================================");
  assert(/\.bottom-nav\s*\{\s*\n\s*justify-content:\s*center;\s*\n\s*\}/.test(desktopZone), ".bottom-nav ganha justify-content:center no tier largo (a barra em si não encolhe — sem max-width nesta regra)");
  assert(/\.bottom-nav__tab\s*\{\s*\n\s*flex:\s*0 1 128px;\s*\n\s*\}/.test(desktopZone), ".bottom-nav__tab troca flex:1 (mobile) por flex:0 1 128px no tier largo");
  assert(!/max-width:\s*1320px/.test(desktopZone.match(/\.bottom-nav\s*\{[\s\S]*?\}/)[0] || ""), "regra .bottom-nav do tier largo não trava max-width na própria barra (full-width preservado)");
  assert(5 * 128 === 640, "aritmética: 5 abas x 128px = 640px (teto pedido)");
  assert(/\.bottom-nav__tab\s*\{\s*\n\s*flex:\s*1;/.test(mobileZone), "regra BASE de .bottom-nav__tab (flex:1, abas esticando full-width) continua intocada fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("4. CARROSSÉIS — trilho respeita o container no tier largo (sem bleed)");
  console.log("==================================================");
  assert(/\.recent-views__rail,\s*\n\s*\.pesquisar-momentos__rail\s*\{\s*\n\s*width:\s*100%;\s*\n\s*margin-left:\s*0;\s*\n\s*padding-left:\s*0;\s*\n\s*scroll-padding-left:\s*0;\s*\n\s*\}/.test(desktopZone), ".recent-views__rail/.pesquisar-momentos__rail perdem o bleed (width:100vw -> 100%) no tier largo");
  assert(/\.recent-card:last-child,\s*\n\s*\.momento-card:last-child\s*\{\s*\n\s*margin-right:\s*0;\s*\n\s*\}/.test(desktopZone), "respiro do fim do scroll (margin-right no último filho) zerado no tier largo, sem bleed pra compensar");
  assert(/\.recent-views__rail\s*\{[\s\S]{0,200}width:\s*100vw;/.test(mobileZone), "regra BASE do trilho (width:100vw, bleed) continua intocada fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("5. RECIPE-GRID — listas de receita (categoria/busca/Minhas Receitas) viram grade");
  console.log("==================================================");
  assert(/const listEl = document\.createElement\("div"\);\s*\n\s*listEl\.className = "recipe-grid";/.test(appJs), "renderCategory: listEl ganha className \"recipe-grid\"");
  assert(/resultsEl\.className = "tagsearch-results recipe-grid";/.test(appJs), "renderBusca: resultsEl ganha a 2ª classe \"recipe-grid\" (mantém tagsearch-results)");
  assert(/Wrapper próprio pra lista \(item 5, tier largo/.test(appJs), "renderMinhasReceitas: comentário do wrapper novo presente (âncora de contexto)");
  // Mesmo padrão literal em renderCategory (listEl bare) E renderMinhasReceitas (wrapper novo) —
  // as 2 batem no MESMO regex de propósito (className+appendChild idênticos); 2 é o total certo.
  const listElWrapMatches = appJs.match(/const listEl = document\.createElement\("div"\);\s*\n\s*listEl\.className = "recipe-grid";\s*\n\s*content\.appendChild\(listEl\);/g) || [];
  assert(listElWrapMatches.length === 2, "2 wrappers .recipe-grid criados com este padrão (renderCategory + renderMinhasReceitas) — " + listElWrapMatches.length + " encontrado(s)");
  assert(/\.recipe-grid\s*\{\s*\n\s*display:\s*grid;\s*\n\s*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(320px,\s*1fr\)\);/.test(desktopZone), ".recipe-grid vira grid auto-fill minmax(320px,1fr) no tier largo");
  assert(/\.recipe-grid \.recipe-card\s*\{\s*\n\s*margin-bottom:\s*0;\s*\n\s*\}/.test(desktopZone), "margin-bottom do card (redundante com o gap da grade) zerado só dentro de .recipe-grid");
  assert(/\.recipe-grid \.tagsearch-group-label,\s*\n\s*\.recipe-grid \.empty-state\s*\{\s*\n\s*grid-column:\s*1 \/ -1;\s*\n\s*\}/.test(desktopZone), "rótulos de grupo/empty-state ocupam a largura total da grade, não uma célula");
  assert(/\.recipe-grid > \.pesquisar-vitrine\s*\{\s*\n\s*grid-column:\s*1 \/ -1;\s*\n\s*\}/.test(desktopZone), "achado ao vivo: .pesquisar-vitrine (vitrine inteira da Pesquisar, reaproveita o mesmo container de resultsEl) também ganha grid-column:1/-1 — senão a vitrine inteira encolhia numa célula de ~320px");
  assert(!/\brecipe-grid\b/.test(mobileZone), "TESTE NEGATIVO: nenhuma regra CSS de .recipe-grid existe fora do tier largo (classe inerte abaixo de 900px)");

  console.log("");
  console.log("==================================================");
  console.log("6. GRADES DE TILE — hubs + Todas as Categorias viram auto-fill 200-240px; bandeira trava no nativo");
  console.log("==================================================");
  assert(/\.category-grid,\s*\n\s*\.category-grid\.category-grid--compact\s*\{\s*\n\s*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(220px,\s*1fr\)\);\s*\n\s*\}/.test(desktopZone), ".category-grid e .category-grid.category-grid--compact viram auto-fill minmax(220px,1fr) no tier largo (220 está no range 200-240 pedido)");
  assert(/\.filter-tile--photo \.filter-tile__media\s*\{\s*\n\s*max-width:\s*300px;\s*\n\s*\}/.test(desktopZone), "tile de bandeira ganha max-width:300px (asset nativo 600x400, nunca ampliado além dele)");
  assert(/\.home-tiles\s*\{\s*\n\s*display:\s*grid;\s*\n\s*grid-template-columns:\s*repeat\(2,\s*1fr\);/.test(mobileZone) && !new RegExp("\\.home-tiles\\s*\\{[^}]*auto-fill").test(desktopZone), "TESTE NEGATIVO: .home-tiles (os 4 tiles grandes da Home) NÃO entra no auto-fill — fora do pedido (\"hubs, Todas as Categorias\" só)");

  console.log("");
  console.log("==================================================");
  console.log("7. PREPAROS/LISTA DE COMPRAS — coluna de conteúdo confortável (800px) dentro do container 1320");
  console.log("==================================================");
  const comfortableWrapMatches = appJs.match(/const wrap = document\.createElement\("div"\);\s*\n\s*wrap\.className = "comfortable-view";\s*\n\s*content\.appendChild\(wrap\);/g) || [];
  assert(comfortableWrapMatches.length === 2, "exatamente 2 wrappers .comfortable-view criados (renderPreparosList + renderListaCompras) — " + comfortableWrapMatches.length + " encontrado(s)");
  assert(/\.comfortable-view\s*\{\s*\n\s*max-width:\s*800px;\s*\n\s*margin-left:\s*auto;\s*\n\s*margin-right:\s*auto;\s*\n\s*\}/.test(desktopZone), ".comfortable-view centraliza em max-width:800px no tier largo");
  assert(!/\bcomfortable-view\b/.test(mobileZone), "TESTE NEGATIVO: nenhuma regra CSS de .comfortable-view existe fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("8. BUG DE ESPECIFICIDADE — grade Todas as Categorias (FORA de qualquer media query, afeta os 2 tiers)");
  console.log("==================================================");
  assert(desktopStart > css.indexOf(".category-grid.category-grid--compact {"), "o fix (seletor composto) vive ANTES do tier largo no arquivo — fora de qualquer @media, correção vale pros 2 tiers");
  assert(/\.category-grid\.category-grid--compact\s*\{\s*\n\s*grid-template-columns:\s*repeat\(3,\s*1fr\);\s*\n\s*gap:\s*var\(--space-2\);\s*\n\s*\}/.test(mobileZone), "seletor composto .category-grid.category-grid--compact (especificidade 0-2-0) define as 3 colunas fixas — vence por especificidade, não por ordem");
  assert(!/(^|[^.\w])\.category-grid--compact\s*\{/.test(css), "TESTE NEGATIVO: não sobra nenhum seletor .category-grid--compact SOZINHO (1 classe só) — sempre composto com .category-grid, senão o empate de especificidade volta");
  assert(/\.category-grid\.category-grid--compact \.category-card__title\s*\{/.test(css), "seletor filho (line-clamp do título) também virou composto, mesma correção");
  // Grid.className real (js/app.js) tem que levar as 2 classes juntas — é isso que torna o bug
  // possível (e o fix necessário): se algum dia virasse só 1 classe, este teste apontaria a
  // incoerência entre HTML/CSS.
  assert(/grid\.className = "category-grid category-grid--compact";/.test(appJs), "js/app.js: o elemento real leva as 2 classes juntas (confirma que o seletor composto é o certo, não coincidência)");

  console.log("");
  console.log("==================================================");
  console.log("9. PÁGINA DE RECEITA — hero vira capa contida (1100px/2:1), coluna de leitura 720px");
  console.log("==================================================");
  assert(/\.recipe-hero\s*\{\s*\n\s*left:\s*50%;\s*\n\s*right:\s*auto;\s*\n\s*transform:\s*translateX\(-50%\);\s*\n\s*width:\s*100%;\s*\n\s*max-width:\s*1100px;\s*\n\s*height:\s*auto;\s*\n\s*aspect-ratio:\s*2 \/ 1;\s*\n\s*border-radius:\s*var\(--radius-sheet\);\s*\n\s*\}/.test(desktopZone), ".recipe-hero vira capa contida: max-width 1100px centrada (left:50%+transform), aspect-ratio 2:1, cantos --radius-sheet nos 4 lados");
  assert(/\.recipe-page\s*\{\s*\n\s*margin-top:\s*calc\(min\(100vw,\s*1100px\)\s*\/\s*2\s*-\s*24px\s*-\s*var\(--space-10\)\);\s*\n\s*\}/.test(desktopZone), ".recipe-page recalcula o overlap com a altura REAL da capa contida (min(100vw,1100px)/2), não mais --hero-h");
  assert(/\.recipe-page > \*:not\(\.recipe-hero\):not\(\.back-float\):not\(\.recipe-hero__heart\)\s*\{\s*\n\s*max-width:\s*720px;\s*\n\s*margin-left:\s*auto;\s*\n\s*margin-right:\s*auto;\s*\n\s*\}/.test(desktopZone), "todo filho direto de .recipe-page (exceto os 2 floats fixed e o próprio hero) vira coluna de leitura de 720px centrada");
  assert(/height:\s*var\(--hero-h\);/.test(mobileZone), "regra BASE de .recipe-hero (height:var(--hero-h), full-bleed) continua intocada fora do tier largo");
  assert(/page\.appendChild\(\s*\n\s*createBackFloat/.test(appJs) && /page\.appendChild\(hero\);/.test(appJs) && /page\.appendChild\(heart\);/.test(appJs), "js/app.js: back-float, hero e heart continuam filhos DIRETOS de .recipe-page (renderReceita) — pré-condição dos seletores > acima");

  console.log("");
  console.log("==================================================");
  console.log("10. MODO COZINHAR — centralização vertical escopada (:has), teto de 600px intocado");
  console.log("==================================================");
  assert(/#recipes-content:has\(\.cook-page\)\s*\{\s*\n\s*display:\s*flex;\s*\n\s*align-items:\s*center;\s*\n\s*min-height:\s*calc\(100vh - var\(--space-10\) - var\(--bottom-nav-height\)\);\s*\n\s*\}/.test(desktopZone), "#recipes-content:has(.cook-page) vira flex centralizado verticalmente, escopado só a essa tela");
  assert(/\.cook-page\s*\{\s*max-width:\s*600px;\s*padding-top:\s*var\(--chrome-clearance\);\s*\}/.test(css), "regra de .cook-page (teto 600px) continua intocada — nenhuma mudança de largura, só a centralização do pai");

  console.log("");
  console.log("==================================================");
  console.log("11. MODAL DE FILTROS — diálogo centrado 560px/85vh");
  console.log("==================================================");
  assert(/\.filter-modal-overlay\s*\{\s*\n\s*align-items:\s*center;\s*\n\s*justify-content:\s*center;\s*\n\s*\}/.test(desktopZone), ".filter-modal-overlay centraliza o diálogo (era align-items:flex-start/normal implícito, tela cheia)");
  assert(/\.filter-modal\s*\{\s*\n\s*width:\s*100%;\s*\n\s*max-width:\s*560px;\s*\n\s*height:\s*auto;\s*\n\s*max-height:\s*85vh;\s*\n\s*border-radius:\s*var\(--radius-sheet\);\s*\n\s*overflow:\s*hidden;\s*\n\s*\}/.test(desktopZone), ".filter-modal vira diálogo (560px/85vh/radius), mesma flex-column/scroll interno da regra base");
  assert(/\.filter-modal-overlay\s*\{\s*\n\s*position:\s*fixed;\s*\n\s*inset:\s*0;/.test(mobileZone), "regra BASE de .filter-modal-overlay (tela cheia) continua intocada fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("12. SHEET DO ORDENAR — diálogo centrado compacto 400px");
  console.log("==================================================");
  assert(/\.sort-sheet-overlay\s*\{\s*\n\s*align-items:\s*center;\s*\n\s*justify-content:\s*center;\s*\n\s*\}/.test(desktopZone), ".sort-sheet-overlay centraliza o diálogo (era align-items:flex-end, bottom-sheet)");
  assert(/\.sort-sheet\s*\{\s*\n\s*max-width:\s*400px;\s*\n\s*border-radius:\s*var\(--radius-sheet\);\s*\n\s*border-bottom:\s*1px solid var\(--color-border\);\s*\n\s*\}/.test(desktopZone), ".sort-sheet vira diálogo compacto (400px, radius nos 4 lados, border-bottom de volta)");
  assert(/\.sort-sheet-overlay\s*\{\s*\n\s*position:\s*fixed;\s*\n\s*inset:\s*0;\s*\n\s*z-index:\s*var\(--z-modal\);\s*\n\s*background:\s*rgba\(15, 15, 14, 0\.55\);[^\n]*\n\s*display:\s*flex;\s*\n\s*align-items:\s*flex-end;/.test(mobileZone), "regra BASE de .sort-sheet-overlay (bottom-sheet, align-items:flex-end) continua intocada fora do tier largo");

  console.log("");
  console.log("==================================================");
  console.log("13. SW BUMP — CACHE_NAME atualizado no mesmo commit que mexeu em css/style.css e js/app.js");
  console.log("==================================================");
  const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const cacheNameMatch = swJs.match(/CACHE_NAME\s*=\s*"([^"]+)"/);
  assert(!!cacheNameMatch, "CACHE_NAME encontrado em sw.js");
  if (cacheNameMatch) {
    console.log("       CACHE_NAME atual: " + cacheNameMatch[1]);
  }

  console.log("");
  console.log("==================================================");
  console.log("RESUMO");
  console.log("==================================================");
  if (failures === 0) {
    console.log("TODAS AS ASSERÇÕES PASSARAM.");
  } else {
    console.log(failures + " ASSERÇÃO(ÕES) FALHARAM.");
    process.exitCode = 1;
  }
}

main();
