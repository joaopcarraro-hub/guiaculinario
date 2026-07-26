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
  const cardBuildMatch = appJs.match(/const card = document\.createElement\("div"\);\s*card\.className = "recent-card";[\s\S]*?rail\.appendChild\(card\);/);
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
  assert(cardBuildBody.includes('Router.toReceita(item.id, "home")'), 'card navega com Router.toReceita(id, "home") literal — nunca currentHashPath() (retorna "" na home, falsy)');
  assert(routerJs.includes('raw === "home"'), 'parseHash trata "home" EXPLICITAMENTE, não só via fallback genérico do fim da função');
  const explicitHomeIdx = routerJs.indexOf('if (!raw || raw === "home") return { name: "home" };');
  const fallbackIdx = routerJs.lastIndexOf('return { name: "home" };');
  assert(
    explicitHomeIdx !== -1 && fallbackIdx !== -1 && explicitHomeIdx < fallbackIdx,
    'checagem explícita de "home" (topo de parseHash) vem ANTES do fallback genérico do fim — não depende dele, "home" resolveria mesmo que esse fallback mudasse depois'
  );
  assert(appJs.includes('const fromHome = fromHash === "home";'), "renderReceita calcula fromHome explicitamente");
  assert(
    appJs.includes('fromMinhasReceitas ? "Minhas Receitas" : fromHome ? "Início" : cat ? cat.label : catId;'),
    'rótulo do back-float mostra "Início" quando a origem é o carrossel — nunca a categoria da receita, mesmo o destino real sendo Home'
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
  assert(swJs.includes('const CACHE_NAME = "cardapio-v32";'), "CACHE_NAME v32 — sucessor de v31 via fix pontual (fora desta feature, css/style.css mudou de novo)");
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
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
