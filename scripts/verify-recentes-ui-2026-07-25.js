// scripts/verify-recentes-ui-2026-07-25.js
//
// Suíte de verificação do carrossel "Vistas recentemente" na home (item 4 do roadmap-mestre,
// CHECKLIST-GERAL.md). O DADO já existia antes desta tarefa (Storage.recordRecipeView/
// getRecentlyViewed, gusta-recentes-v1) — esta suíte cobre só a UI nova: buildRecentlyViewedSection
// em js/app.js, o CSS do carrossel/mini-card, e o contrato explícito de fromHash="home" (emenda
// aprovada: "home" não pode depender do fallback genérico de parseHash por acidente).
//
// js/app.js e js/router.js são fortemente acoplados ao DOM sem UMD (mesma limitação de sempre,
// documentada em test-shopping-dict.js/verify-shopping-sections/verify-subprodutos/
// verify-grupo-search-fromhash-2026-07-25.js) — verificado aqui por texto exato do código-fonte
// (grep/.includes()/regex), e ao vivo no navegador (ver report da tarefa: 3 receitas visitadas,
// carrossel na ordem certa com thumb real, clique num card, voltar pelo flutuante cai na Home,
// localStorage limpo esconde a seção por completo, nome longo trunca em 2 linhas).
//
// Nenhuma comparação usa ref de git — só valores literais, regra do CLAUDE.md.
//
// `node scripts/verify-recentes-ui-2026-07-25.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");
const { extractCacheName } = require("./lib-cache-name");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const routerJs = fs.readFileSync(path.join(ROOT, "js", "router.js"), "utf8");
const styleCss = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
const storageJs = fs.readFileSync(path.join(ROOT, "js", "storage.js"), "utf8");
const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

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
  console.log("1. Dado (storage.js) — API já existente, não recriada");
  console.log("==================================================");
  assert(storageJs.includes('const RECENT_KEY = "gusta-recentes-v1";'), "chave gusta-recentes-v1 inalterada");
  assert(storageJs.includes("const RECENT_MAX_ITEMS = 10;"), "cap de 10 inalterado");
  assert(storageJs.includes("recordRecipeView:"), "Storage.recordRecipeView ainda exportado");
  assert(storageJs.includes("getRecentlyViewed:"), "Storage.getRecentlyViewed ainda exportado");

  console.log("");
  console.log("==================================================");
  console.log("2. Componente novo — construção da seção");
  console.log("==================================================");
  assert(appJs.includes("function buildRecentlyViewedSection"), "função buildRecentlyViewedSection existe");
  assert(appJs.includes("Storage.getRecentlyViewed()"), "lê Storage.getRecentlyViewed() (nunca reimplementa dedup/ordem/cap)");
  assert(appJs.includes("TagModel.findRecipeById(entry.recipeId)"), "resolve cada item via TagModel.findRecipeById (mesmo resolvedor de renderReceita)");

  console.log("");
  console.log("==================================================");
  console.log("3. Ausência quando vazio (teste NEGATIVO obrigatório)");
  console.log("==================================================");
  const buildFnMatch = appJs.match(/function buildRecentlyViewedSection\(\)\s*\{[\s\S]*?\n  \}/);
  const buildFnBody = buildFnMatch ? buildFnMatch[0] : "";
  assert(buildFnBody.length > 0, "corpo de buildRecentlyViewedSection localizado pra análise");
  assert(/if \(!recentItems\.length\) return null;/.test(buildFnBody), "retorna null (nenhum elemento) quando não há itens");
  assert(
    appJs.includes("const recentSection = buildRecentlyViewedSection();") && appJs.includes("if (recentSection) wrap.appendChild(recentSection);"),
    "renderHome só anexa a seção (título+trilho) quando ela existe — ausente por completo com histórico vazio"
  );

  console.log("");
  console.log("==================================================");
  console.log("4. Conteúdo do card — só foto e nome, nada além");
  console.log("==================================================");
  // Higiene 2026-07-30 (F1b): o bloco de construção saiu de dentro do forEach de
  // buildRecentlyViewedSection e virou o helper buildMiniRecipeCard(item, fromHash) —
  // compartilhado com "Sugestões de hoje" (Pesquisar). Mesmo conteúdo/comportamento pro caso
  // "home", só reorganizado; regex atualizada pra apontar pro novo endereço.
  const cardBuildMatch = appJs.match(/function buildMiniRecipeCard\(item, fromHash\) \{[\s\S]*?\n  \}/);
  const cardBuildBody = cardBuildMatch ? cardBuildMatch[0] : "";
  assert(cardBuildBody.length > 0, "bloco de construção do recent-card localizado");
  assert(cardBuildBody.includes("recent-card__thumb"), "card tem thumb de foto");
  assert(cardBuildBody.includes("recent-card__name"), "card tem nome");
  assert(!/recipe-meta|cat-chip|origin|heart|favorite/i.test(cardBuildBody), "sem meta/país/coração — teste negativo de conteúdo extra");

  console.log("");
  console.log("==================================================");
  console.log("5. Foto — reusa loadRecipeImage/applyImage, nunca recria lógica");
  console.log("==================================================");
  assert(cardBuildBody.includes("applyImage(thumb, item.recipe.image)"), "usa applyImage(el, url) pra recipe.image manual");
  assert(cardBuildBody.includes("loadRecipeImage(item.recipe, thumb)"), 'usa loadRecipeImage(recipe, el) — assinatura do contrato (CONTRATO-IMAGENS-REDESIGN.md §3)');
  assert(appJs.includes('img.loading = "lazy";'), "loading=lazy já é padrão de applyImage — herdado pelos 10 thumbs, não duplicado por card");

  console.log("");
  console.log("==================================================");
  console.log("6. Acessibilidade — mesmo padrão do recipe-card (Fase 0a)");
  console.log("==================================================");
  assert(cardBuildBody.includes("makeKeyboardClickable(card)"), "makeKeyboardClickable aplicado (role=button, tabIndex=0, Enter/Espaço)");
  assert(cardBuildBody.includes('card.setAttribute("aria-label"'), "aria-label descritivo no card");

  console.log("");
  console.log("==================================================");
  console.log('7. fromHash="home" — contrato EXPLÍCITO (emenda aprovada), não fallback acidental');
  console.log("==================================================");
  // Higiene 2026-07-30: o literal "home" agora vive no CALL SITE (buildRecentlyViewedSection),
  // não dentro do helper compartilhado (que ficou genérico, parametrizado por fromHash) — mesma
  // garantia de antes (Home passa "home" explícito), endereço atualizado.
  assert(appJs.includes('rail.appendChild(buildMiniRecipeCard(item, "home"))'), 'Home passa "home" literal pro helper — nunca currentHashPath() (retorna "" na home, falsy)');
  assert(cardBuildBody.includes("Router.toReceita(item.id, fromHash)"), "helper compartilhado navega via Router.toReceita(id, fromHash) — genérico, cada chamador decide o literal");
  assert(routerJs.includes('raw === "home"'), 'parseHash trata "home" EXPLICITAMENTE, não só via fallback genérico do fim da função');
  const explicitHomeIdx = routerJs.indexOf('if (!raw || raw === "home") return { name: "home" };');
  const fallbackIdx = routerJs.lastIndexOf('return { name: "home" };');
  assert(
    explicitHomeIdx !== -1 && fallbackIdx !== -1 && explicitHomeIdx < fallbackIdx,
    'checagem explícita de "home" (topo de parseHash) vem ANTES do fallback genérico do fim — não depende dele, "home" resolveria mesmo que esse fallback mudasse depois'
  );
  assert(appJs.includes('const fromHome = fromHash === "home";'), "renderReceita calcula fromHome explicitamente");
  // Higiene 2026-07-30: Dívida #3 (commit 00b430b, 2026-07-30) inseriu 2 elos NOVOS no meio da
  // cadeia (fromListaCompras/fromPreparos, fechando os 2 furos de fromHash da Lista de Compras
  // e Preparos) — o "Início" desta rodada continua no mesmo lugar da cadeia (logo depois de
  // fromMinhasReceitas), só ganhou vizinhos depois dele. Reproduzido ao vivo (Home -> carrossel
  // "Vistas recentemente" -> Carbonara -> back-float): aria-label exato "Voltar para Início",
  // clique no float navega pra "#/home" (destino real confirmado, não só o rótulo) — comportamento
  // 100% intacto, só o literal do teste estava defasado do tamanho novo da cadeia.
  assert(
    appJs.includes(
      'fromMinhasReceitas ? "Minhas Receitas" : fromHome ? "Início" : fromListaCompras ? "Lista de Compras" : fromPreparos ? "Preparos" : cat ? cat.label : catId;'
    ),
    'rótulo do back-float mostra "Início" quando a origem é o carrossel — nunca a categoria da receita, mesmo o destino real sendo Home (verificado ao vivo: aria-label "Voltar para Início" + clique navega pra #/home)'
  );

  console.log("");
  console.log("==================================================");
  console.log("8. CSS — carrossel novo, sem JS de scroll, estados compartilhados");
  console.log("==================================================");
  assert(styleCss.includes(".recent-views__rail {"), "trilho do carrossel definido");
  assert(styleCss.includes("scroll-snap-type: x mandatory;") && /overflow-x:\s*auto;/.test(styleCss), "scroll horizontal + snap-x mandatory (CSS puro)");
  assert(styleCss.includes(".recent-views__rail::-webkit-scrollbar { display: none; }"), "scrollbar oculta no WebKit");
  assert(/\.recent-views__rail\s*\{[\s\S]{0,300}scrollbar-width:\s*none;/.test(styleCss), "scrollbar oculta no Firefox (scrollbar-width: none dentro do próprio bloco do trilho)");
  assert(
    styleCss.includes(".recent-card,") && styleCss.includes(".recent-card:active,") && styleCss.includes(".recent-card:focus-visible,"),
    ".recent-card entrou nas listas compartilhadas de transition/:active/:focus-visible (não regra de estado isolada)"
  );
  assert(!/\.recent-card\s*\{[^}]*transform:\s*scale/.test(styleCss), "nenhuma regra :active própria/duplicada fora da lista compartilhada — teste negativo");
  assert(styleCss.includes("aspect-ratio: 16 / 9;"), "thumb do mini-card é 16:9, conforme spec");

  console.log("");
  console.log("==================================================");
  console.log("9. Docs e skills atualizadas no mesmo commit (regra do CLAUDE.md)");
  console.log("==================================================");
  const mobileSkill = fs.readFileSync(path.join(ROOT, ".claude", "skills", "mobile-recipe-ui", "SKILL.md"), "utf8");
  const navSkill = fs.readFileSync(path.join(ROOT, ".claude", "skills", "product-navigation-ux", "SKILL.md"), "utf8");
  const tokensDoc = fs.readFileSync(path.join(ROOT, "docs", "DESIGN-TOKENS.md"), "utf8");
  assert(mobileSkill.includes("Vistas recentemente"), "skill mobile-recipe-ui documenta o carrossel novo");
  assert(
    !/Sem busca livre e sem atalhos de Favoritos\/Quero fazer\/Histórico na home/.test(mobileSkill),
    'frase antiga "Sem busca livre... Histórico na home" (sem exceção) não sobrevive como afirmação viva — teste negativo, ela contradiria a UI nova'
  );
  assert(mobileSkill.includes("Como era vs. como ficou"), "skill mobile-recipe-ui descreve explicitamente como era e como ficou (nota 1 da aprovação)");
  assert(
    /fromHash\s*=\s*"home"/.test(navSkill) && navSkill.toLowerCase().includes("carrossel"),
    'contrato fromHash="home" registrado na skill product-navigation-ux (\\s* cobre a quebra de linha do markdown, CRLF ou LF)'
  );
  assert(tokensDoc.includes("Vistas recentemente"), "DESIGN-TOKENS.md documenta o spec do mini-card");

  console.log("");
  console.log("==================================================");
  console.log("10. Service worker — CACHE_NAME v24 -> v25 no commit desta tarefa");
  console.log("==================================================");
  // Atualizado 2026-07-25 (redesenho completo do card, item 2 do roadmap-mestre, leva aprovada
  // em separado): mais uma mudança em css/style.css e js/app.js bumpou v25 -> v26. O que esta
  // suíte protege (v25 sucedendo v24 corretamente NAQUELE commit) já é fato consumado — a
  // checagem agora confirma que a cadeia continuou (v27 presente) sem "prender" a versão no v25.
  // Atualizado de novo (item 1 de "Deixar pro Fable, depois"): v26 -> v27, redesenho da página
  // de receita mudou css/style.css e js/app.js mais uma vez.
  // v29 -> v30: hotfix 2026-07-26 (pointer-events da whitelist de body), não uma rodada desta
  // feature — ver scripts/verify-filter-modal-pointer-events-2026-07-26.js.
  // v30 -> v31: leva final de sobras (2026-07-26) — header de ingredientes, js/app.js mudou de
  // novo, também fora desta feature.
  // v31 -> v32: fix pontual (2026-07-26) — centralização vertical do mesmo header de
  // ingredientes, css/style.css mudou de novo, também fora desta feature.
  // v32 -> v33: item final do redesenho visual. v33 -> v34: rumo novo de Países. v34 -> v35:
  // calibração final do banner de hub (blur/scale removidos) — todos fora desta feature.
  assert(/const CACHE_NAME = "cardapio-v\d+";/.test(swJs), "CACHE_NAME presente em sw.js no formato esperado (lido dinamicamente via scripts/lib-cache-name.js — bump não exige editar esta suíte): " + extractCacheName(swJs));
  // Pin histórico legítimo (não migra pro helper): v25 é a versão anterior a ESTA tarefa
  // (recentes-ui), travada aqui pra provar que o bump da própria tarefa não ficou preso no
  // valor antigo. Não é "valor vigente atualizado a cada bump" como o assert acima era — é
  // comparação com um estado fixo do passado, exatamente o caso de exceção do CLAUDE.md.
  assert(!swJs.includes('const CACHE_NAME = "cardapio-v25";'), "v25 não sobrevive — teste negativo (a versão desta tarefa foi sucedida, não deixada presa)");
  assert(swJs.includes('"css/style.css"') && swJs.includes('"js/app.js"'), "css/style.css e js/app.js seguem no APP_SHELL precache");

  console.log("");
  console.log("==================================================");
  console.log("11. Posição (julgamento visual do dono, 2026-07-26) — DEPOIS do bloco de categorias");
  console.log("==================================================");
  const renderHomeMatch = appJs.match(/function renderHome\(\)\s*\{[\s\S]*?\n  \}/);
  const renderHomeBody = renderHomeMatch ? renderHomeMatch[0] : "";
  assert(renderHomeBody.length > 0, "corpo de renderHome localizado pra análise");
  const moreCategoriasAppendIdx = renderHomeBody.indexOf("wrap.appendChild(moreCategorias);");
  const recentAppendIdx = renderHomeBody.indexOf("if (recentSection) wrap.appendChild(recentSection);");
  assert(
    moreCategoriasAppendIdx !== -1 && recentAppendIdx !== -1 && moreCategoriasAppendIdx < recentAppendIdx,
    "ordem final em renderHome: tiles + Mais categorias são anexados ANTES do carrossel de recentes (era o contrário na primeira leva)"
  );
  assert(
    !/const recentSection = buildRecentlyViewedSection\(\);[\s\S]{0,80}const moreCategorias/.test(renderHomeBody),
    "teste negativo — recentSection não volta a ser construído antes de moreCategorias"
  );
  assert(
    styleCss.includes(".recent-views {") && /\.recent-views\s*\{[\s\S]{0,700}margin-top:\s*var\(--space-6\);/.test(styleCss),
    "separação do bloco de categorias pro carrossel é margin-top: var(--space-6) em .recent-views (24px, colapsa com o margin-bottom de .home-more-categories)"
  );
  assert(
    !/\.recent-views\s*\{[^}]*margin-bottom:/.test(styleCss),
    "teste negativo — .recent-views não tem mais declaração margin-bottom: (posição antiga, antes dos tiles); exige o ':' pra não confundir com a prosa do comentário que MENCIONA o margin-bottom de .home-more-categories"
  );
  assert(
    styleCss.includes("#recipes-content:has(.home-view) ~ #progress {") && /#recipes-content:has\(\.home-view\) ~ #progress \{[\s\S]{0,120}border-top:\s*none;/.test(styleCss),
    'override ":has()" zera a linha de #progress só na home (marca .home-view)'
  );
  const progressBaseMatch = styleCss.match(/(?<!~ )#progress \{[\s\S]*?\}/);
  assert(
    !!progressBaseMatch && progressBaseMatch[0].includes("border-top: 1px solid var(--color-border);"),
    "regra BASE de #progress (compartilhada por toda tela) continua com a borda — só a home ganhou override, nenhuma outra tela foi tocada"
  );

  console.log("");
  console.log("==================================================");
  console.log("12. Calha do #main (--space-5 -> --space-4) e recalibração do carrossel — mini-rodada visual de fechamento, 2026-07-29");
  console.log("==================================================");
  assert(
    styleCss.includes("#main { padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + env(safe-area-inset-bottom)) var(--space-4); }"),
    "#main (<=700px) tem calha LATERAL --space-4 (16px, era --space-5/20px) — usável em 390px: 358px (medido ao vivo)"
  );
  assert(
    !/#main \{ padding: var\(--space-5\) var\(--space-5\)/.test(styleCss),
    "TESTE NEGATIVO: #main (<=700px) não usa mais --space-5 nos 2 primeiros valores do shorthand (era de 3 valores top/laterais/baixo, virou de 4 pra decompor top de laterais)"
  );
  const mainMobileRuleMatch = styleCss.match(/@media \(max-width: 700px\) \{[\s\S]*?#main \{ padding: ([^}]*); \}/);
  assert(!!mainMobileRuleMatch, "regra #main dentro do breakpoint <=700px localizada");
  assert(
    !!mainMobileRuleMatch && /^var\(--space-5\)/.test(mainMobileRuleMatch[1]),
    "TOP do #main continua var(--space-5) — preservado DE PROPÓSITO (não é a calha lateral que o dono pediu pra mudar)"
  );
  // .grupo-sheet/.recipe-page cancelam o padding-TOP de #main no próprio margin-top (achado da
  // investigação desta rodada) — como só a calha LATERAL mudou, essa matemática de cancelamento
  // não podia ter sido tocada. As 4 asserções abaixo são regressão, não comportamento novo.
  assert(
    /\.grupo-sheet\s*\{\s*margin-top:\s*calc\(var\(--hub-banner-h\) - 24px - var\(--space-5\)\);\s*\}/.test(styleCss),
    "regressão: .grupo-sheet (<=700px) continua cancelando --space-5 (TOP de #main) no próprio margin-top — a calha lateral não mexeu nisso"
  );
  assert(
    /\.recipe-page\s*\{\s*margin-top:\s*calc\(var\(--hero-h\) - 24px - var\(--space-5\)\);\s*\}/.test(styleCss),
    "regressão: .recipe-page (<=700px) continua cancelando --space-5 (TOP de #main) no próprio margin-top — mesma razão"
  );
  const sheetPaddingMatches = styleCss.match(/padding: var\(--space-6\) var\(--space-5\) 0;/g) || [];
  assert(
    sheetPaddingMatches.length === 2,
    "regressão: padding PRÓPRIO de .grupo-sheet E .recipe-page continua var(--space-6) var(--space-5) 0 — a calha do #main mudou, o padding interno dessas 2 folhas NÃO (item 2 do briefing pediu só #main; achado: 2 ocorrências, uma por componente)"
  );
  assert(
    /\.recent-card\s*\{\s*flex:\s*0 0 26vw;/.test(styleCss),
    "regressão: .recent-card continua flex: 0 0 26vw — card/gap não dependem do padding de #main, só a largura útil do container muda com a calha"
  );

  const recentCardComment = styleCss.match(/\/\* 26vw por card:[\s\S]*?\*\//);
  assert(!!recentCardComment, "comentário de .recent-card (26vw por card) localizado");
  assert(!!recentCardComment && recentCardComment[0].includes("17,83px"), "comentário preserva o valor histórico da fatia SEM bleed (17,83px, calha --space-4 sozinha) como referência");
  assert(!!recentCardComment && recentCardComment[0].includes("33,83px"), "fatia visível do 4º card recalibrada pro valor medido ao vivo COM o trilho full-bleed: 33,83px (getBoundingClientRect, não estimativa)");
  assert(!!recentCardComment && !recentCardComment[0].includes("350px"), "TESTE NEGATIVO: comentário do carrossel não sobrou com o número antigo (350px) escrito");

  console.log("");
  console.log("==================================================");
  console.log("13. Carrossel full-bleed (sangramento até as bordas, padrão iFood) — mini-rodada visual de fechamento, 2026-07-29");
  console.log("==================================================");
  const railRuleMatch = styleCss.match(/\.recent-views__rail \{[\s\S]*?\n\}/);
  const railRuleBody = railRuleMatch ? railRuleMatch[0] : "";
  assert(railRuleBody.length > 0, "regra .recent-views__rail localizada");
  assert(/width:\s*100vw;/.test(railRuleBody), "trilho ganha width: 100vw — mesma técnica de bleed de .grupo-sheet/.recipe-page");
  assert(/margin-left:\s*calc\(50% - 50vw\);/.test(railRuleBody), "trilho ganha margin-left: calc(50% - 50vw) — mesma técnica de bleed de .grupo-sheet/.recipe-page");
  assert(/padding-left:\s*var\(--space-4\);/.test(railRuleBody), "trilho reconstrói o alinhamento do 1º card com padding-left: var(--space-4) — mesma calha da mudança #2 desta rodada");
  assert(/scroll-padding-left:\s*var\(--space-4\);/.test(railRuleBody), "scroll-padding-left espelha o padding-left — snap \"start\" respeita o mesmo ponto de alinhamento, não a borda real da tela");
  // regex exige ":" (declaração CSS de verdade) — o comentário logo acima MENCIONA "padding-right"
  // em prosa (explicando por que ele NÃO existe aqui), então checar a palavra sozinha daria falso
  // positivo; só uma declaração real (\bpadding-right\s*:) conta.
  assert(!/padding-right\s*:/.test(railRuleBody), "TESTE NEGATIVO: sem DECLARAÇÃO padding-right no trilho — \"padding final artificial\" explicitamente rejeitado pelo briefing, respiro do fim vem do último card, não do container");
  assert(
    /\.recent-card:last-child \{ margin-right: var\(--space-4\); \}/.test(styleCss),
    ".recent-card:last-child tem margin-right: var(--space-4) — respiro no fim do scroll (técnica robusta a Safari/WebKit, ao contrário de padding-right no container)"
  );
  assert(!/\.recent-views__title[^}]*100vw/.test(styleCss), "TESTE NEGATIVO: .recent-views__title não sangra — só o trilho, o título continua alinhado à calha normal");
  assert(!/\.recent-views \{[^}]*100vw/.test(styleCss), "TESTE NEGATIVO: .recent-views (a seção inteira, título+trilho) não ganhou bleed próprio — só .recent-views__rail, o filho, sangra");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
