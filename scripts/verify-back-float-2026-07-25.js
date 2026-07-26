// scripts/verify-back-float-2026-07-25.js
//
// Suíte de verificação do item 1 do roadmap (botão de voltar flutuante). Rodada 1 (commit
// d234da3): só a página de receita (renderReceita). Rodada 2 (esta): expandida pra TODA tela
// com página-mãe (grupo/hub, coleção/categoria) + "Sair do modo cozinhar" virou pílula na mesma
// linguagem visual. Mapa completo da investigação e a lista de telas alteradas vivem no
// relatório da tarefa, não aqui — este arquivo só verifica o resultado no código-fonte.
//
// Mecanismo de navegação NUNCA muda nesta suíte — só apresentação:
//   - renderReceita: fromHash/currentHashPath (os 4 caminhos "voltar preservando contexto").
//   - renderGrupo: Router.toHome() direto (único pai real — proteinas/cozinhas/fundamentos só
//     linkados da Home, tempo/dificuldade sem link nenhum hoje, mas Home é o único pai
//     estrutural pros 5, sem ambiguidade).
//   - renderCategory: já era dinâmico ANTES desta tarefa (hideFromGrupoGrid ? Home : grupo dono
//     ? esse grupo : Home) — só trocou de elemento, a lógica de destino é idêntica.
//   - renderCookMode: SEM botão de voltar, nunca teve, não ganha agora — só o "Sair" (que já
//     existia) virou pílula flutuante em vez de botão textual.
// Nenhum caso ficou ambíguo (2+ entry points sem histórico) nesta rodada — logo, 0 TODO-1b.
//
// Verificação ao vivo (screenshot/getComputedStyle/elementFromPoint) segue limitada nesta
// sessão pelos mesmos motivos da rodada 1 (ver relatório) — o servidor ad-hoc em 192.168.15.2:
// 5502 foi usado pra exercitar categoria/grupo/cook mode via fetch, não via DOM real.
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte
// (`.includes()`/slice de função), nunca por ref de git (regra do CLAUDE.md: só literais).
// js/app.js usa CRLF (\r\n) — ver nota em sliceFn abaixo.
//
// `node scripts/verify-back-float-2026-07-25.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
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

// \s* antes de um \n literal casa \n E \r\n (backtracking) — string literal com \n cru só casa
// LF puro. Fim de função = próxima declaração "  function " no nível de módulo (2 espaços).
function sliceFn(src, startMarker, label) {
  const start = src.indexOf(startMarker);
  assert(start > 0, label + ": marca de início encontrada");
  let end = src.indexOf("\r\n  function ", start + startMarker.length);
  if (end < 0) end = src.length;
  assert(end > start, label + ": marca de fim encontrada (depois do início)");
  return src.slice(start, end);
}

function main() {
  console.log("==================================================");
  console.log("1. ÍCONES — chevronLeft (rodada 1) e close (Fase 0c) reaproveitados, nada novo");
  console.log("==================================================");
  assert(appJs.includes("chevronLeft: '<path"), "ICONS.chevronLeft declarado (rodada 1, back-float)");
  assert(appJs.includes("close: '<path"), "ICONS.close já existia (Fase 0c) — reaproveitado na pílula de sair, não duplicado");

  console.log("");
  console.log("==================================================");
  console.log("2. CSS .chrome-float — base compartilhada nova (fixed, véu, borda, z-float, safe-area)");
  console.log("==================================================");
  const chromeFloatStart = css.indexOf(".chrome-float {");
  assert(chromeFloatStart > 0, ".chrome-float declarado no CSS");
  const chromeFloatEnd = css.indexOf("}", chromeFloatStart);
  const chromeFloatRule = css.slice(chromeFloatStart, chromeFloatEnd);
  assert(chromeFloatRule.includes("position: fixed;"), "position: fixed (acompanha o scroll)");
  assert(chromeFloatRule.includes("z-index: var(--z-float);"), "usa o token --z-float");
  assert(chromeFloatRule.includes("background: rgba(15, 15, 14, 0.55);"), "véu escuro rgba(15,15,14,0.55) — funciona sobre tema escuro E hero claro");
  assert(chromeFloatRule.includes("border: 1px solid var(--color-border);"), "borda 1px var(--color-border)");
  assert(chromeFloatRule.includes("env(safe-area-inset-top)") && chromeFloatRule.includes("env(safe-area-inset-left)"), "respeita safe-area (notch/ilha dinâmica)");
  assert(!chromeFloatRule.includes("backdrop-filter"), "SEM backdrop-filter (celular modesto é público-alvo)");

  console.log("");
  console.log("==================================================");
  console.log("3. CSS .back-float — agora só as propriedades PRÓPRIAS (resto vem de .chrome-float)");
  console.log("==================================================");
  const backFloatStart = css.indexOf(".back-float {");
  assert(backFloatStart > chromeFloatStart, ".back-float declarado DEPOIS de .chrome-float (composição, não substituição)");
  const backFloatEnd = css.indexOf("}", backFloatStart);
  const backFloatRule = css.slice(backFloatStart, backFloatEnd);
  assert(backFloatRule.includes("width: 44px;") && backFloatRule.includes("height: 44px;"), "44x44px — mínimo de toque");
  assert(backFloatRule.includes("border-radius: 50%;"), "círculo (border-radius 50%)");
  assert(!backFloatRule.includes("position: fixed"), "não duplica position:fixed (herda de .chrome-float)");
  assert(!backFloatRule.includes("rgba(15"), "não duplica o véu (herda de .chrome-float)");
  assert(css.includes(".back-float__icon { width: 22px; height: 22px; }"), "ícone 22px (mesmo tamanho do ícone da bottom-nav)");

  console.log("");
  console.log("==================================================");
  console.log("4. CSS .exit-cook-float — pílula nova do 'Sair do modo cozinhar' (mesmas proporções de .filter-trigger)");
  console.log("==================================================");
  const exitFloatStart = css.indexOf(".exit-cook-float {");
  assert(exitFloatStart > chromeFloatStart, ".exit-cook-float declarado DEPOIS de .chrome-float (composição)");
  const exitFloatEnd = css.indexOf("}", exitFloatStart);
  const exitFloatRule = css.slice(exitFloatStart, exitFloatEnd);
  assert(exitFloatRule.includes("min-height: 44px;"), "altura mínima 44px — mínimo de toque, mesma regra do back-float");
  assert(exitFloatRule.includes("border-radius: 999px;"), "formato pílula (border-radius 999px), não círculo");
  assert(!exitFloatRule.includes("position: fixed"), "não duplica position:fixed (herda de .chrome-float)");
  assert(css.includes(".exit-cook-float__icon { width: 18px; height: 18px;"), "ícone close 18px, conforme spec do dono");

  console.log("");
  console.log("==================================================");
  console.log("5. ESTADOS — .chrome-float (base) nas listas compartilhadas, cobre back-float E exit-cook-float juntos");
  console.log("==================================================");
  assert(/\.update-toast__btn,\s*\n\.chrome-float,/.test(css), ".chrome-float na lista de transition base (--motion-base) — sem entrada solta por subclasse");
  assert(/\.update-toast__btn:active,\s*\n\.chrome-float:active,/.test(css), ".chrome-float:active na lista compartilhada (scale 0.97 + opacity 0.85)");
  assert(/\.category-card:focus-visible,\s*\n\.chrome-float:focus-visible,/.test(css), ".chrome-float:focus-visible na lista compartilhada (ring padrão --focus-ring-*)");
  const reducedMotionBlockStart = css.indexOf("@media (prefers-reduced-motion: reduce) {");
  const reducedMotionBlockEnd = css.indexOf("\n}", reducedMotionBlockStart);
  const reducedMotionBlock = css.slice(reducedMotionBlockStart, reducedMotionBlockEnd);
  assert(reducedMotionBlock.includes(".chrome-float:active,"), ".chrome-float:active também suprime a escala sob prefers-reduced-motion");
  assert(!css.includes(".back-float,") && !css.includes(".back-float:active,") && !css.includes(".back-float:focus-visible,"), "nenhuma entrada SOLTA de .back-float sobrando nas listas (tudo via .chrome-float agora)");

  console.log("");
  console.log("==================================================");
  console.log("6. HELPERS JS — createBackFloat/createExitCookFloat centralizam a construção (nunca duplicada por tela)");
  console.log("==================================================");
  const createBackFloatStart = appJs.indexOf("function createBackFloat(destLabel, onClick) {");
  assert(createBackFloatStart > 0, "createBackFloat declarado");
  const createBackFloatBody = sliceFn(appJs, "function createBackFloat(destLabel, onClick) {", "createBackFloat");
  assert(createBackFloatBody.includes('btn.className = "chrome-float back-float";'), "createBackFloat aplica as 2 classes (base + subclasse)");
  assert(createBackFloatBody.includes('btn.setAttribute("aria-label", "Voltar para " + destLabel);'), "createBackFloat monta o aria-label dinâmico 'Voltar para X'");
  assert(createBackFloatBody.includes('iconSvg("chevronLeft", "back-float__icon")'), "createBackFloat usa o ícone chevron-esquerda via iconSvg");
  const createExitFloatBody = sliceFn(appJs, "function createExitCookFloat(onClick) {", "createExitCookFloat");
  assert(createExitFloatBody.includes('btn.className = "chrome-float exit-cook-float";'), "createExitCookFloat aplica as 2 classes (base + subclasse)");
  assert(createExitFloatBody.includes('btn.setAttribute("aria-label", "Sair do modo cozinhar");'), "aria-label fixo 'Sair do modo cozinhar' (não é dinâmico — não é 'voltar')");
  assert(createExitFloatBody.includes('iconSvg("close", "exit-cook-float__icon") + "<span>Sair</span>"'), "ícone close 18px + texto 'Sair', nessa ordem");

  console.log("");
  console.log("==================================================");
  console.log("7. renderReceita — refatorado pra usar createBackFloat (rodada 1 preservada, sem duplicar construção)");
  console.log("==================================================");
  const receitaFnBody = sliceFn(appJs, "function renderReceita(id, fromHash) {", "renderReceita");
  assert(receitaFnBody.includes("createBackFloat(backDestLabel, () => {"), "renderReceita chama o helper compartilhado (não constrói o botão inline mais)");
  assert(
    receitaFnBody.includes("const backDestLabel = backCollection ? backCollection.label : fromBusca ? \"Pesquisar\" : fromMinhasReceitas ? \"Minhas Receitas\" : fromHome ? \"Início\" : cat ? cat.label : catId;"),
    "cadeia de fallback do destino: rodada 1 preservada + elo novo pra Home (item 4, carrossel de recentes — coleção > busca > minhas receitas > home > categoria da receita), ver scripts/verify-recentes-ui-2026-07-25.js"
  );
  assert(receitaFnBody.includes("if (fromHash) Router.navigate(fromHash);"), "fromHash real (histórico) tem prioridade — mecanismo intacto");
  assert(receitaFnBody.includes("else Router.toCategoria(backCollection ? backCollection.id : catId);"), "Router.toCategoria só é fallback sem contexto — nunca destino hardcoded");
  assert(!appJs.includes('"← Voltar para "'), "texto antigo '← Voltar para ' não existe mais em lugar nenhum do arquivo");

  console.log("");
  console.log("==================================================");
  console.log("8. renderGrupo — back-button textual (Router.toHome hardcoded) VIROU back-float (Home, único pai real)");
  console.log("==================================================");
  const grupoFnBody = sliceFn(appJs, "function renderGrupo(grupoId) {", "renderGrupo");
  assert(grupoFnBody.includes('createBackFloat("Home", () => Router.toHome())'), "renderGrupo usa o helper, destino Router.toHome() idêntico ao botão antigo");
  assert(!grupoFnBody.includes('back.className = "back-button"'), "back-button textual não existe mais em renderGrupo (teste negativo)");
  assert(!grupoFnBody.includes("← Voltar"), "texto '← Voltar' não sobra em renderGrupo");

  console.log("");
  console.log("==================================================");
  console.log("9. renderCategory — lógica de destino IDÊNTICA à de antes (já era dinâmica), só trocou de elemento");
  console.log("==================================================");
  const categoryFnBody = sliceFn(appJs, "function renderCategory(collection, initialFacetTags, initialRole, initialIngredientMode) {", "renderCategory");
  assert(categoryFnBody.includes("createBackFloat(collection.hideFromGrupoGrid || !grupo ? \"Home\" : grupo.label, () => {"), "renderCategory usa o helper com o mesmo rótulo condicional (grupo dono ou Home)");
  assert(categoryFnBody.includes("if (collection.hideFromGrupoGrid) Router.toHome();"), "hideFromGrupoGrid (massas/sobremesas-classicas) continua indo pra Home — lógica intacta");
  assert(categoryFnBody.includes("else if (grupo) Router.toGrupo(grupo.id);"), "coleção com grupo dono volta pro HUB, não pra Home — lógica já existia antes desta tarefa, preservada");
  assert(!categoryFnBody.includes('class="back-button"'), "back-button textual não existe mais em renderCategory (teste negativo)");
  assert(!appJs.includes('<button type="button" class="back-button">← Voltar</button><h2>'), "innerHTML antigo com o botão embutido não existe mais");

  console.log("");
  console.log("==================================================");
  console.log("10. TESTE NEGATIVO — modo cozinhar CONTINUA sem botão de voltar; exitBtn virou pílula, não back-float");
  console.log("==================================================");
  const cookModeFnBody = sliceFn(appJs, "function renderCookMode(id, fromHash, portionMultiplier) {", "renderCookMode");
  assert(cookModeFnBody.includes("const exitBtn = createExitCookFloat(() => {"), "exitBtn agora vem de createExitCookFloat (pílula), não mais back-button textual");
  // Checa CHAMADA/CLASSE de verdade, não a palavra solta — o comentário logo acima do exitBtn
  // MENCIONA "back-float" em prosa (explicando a linguagem visual compartilhada), o que é
  // esperado e não é o mesmo que o botão de voltar vazar pra cá.
  assert(!cookModeFnBody.includes("createBackFloat(") && !cookModeFnBody.includes('"chrome-float back-float"'), "NENHUMA chamada a createBackFloat nem classe back-float em renderCookMode — nenhum botão de voltar vaza pro modo cozinhar (só a palavra em comentário/prosa é esperada)");
  assert(!cookModeFnBody.includes('"back-button"'), "back-button textual não sobra em renderCookMode");
  assert(cookModeFnBody.includes("Router.toReceita(id, fromHash);"), "destino do Sair inalterado (Router.toReceita com o mesmo fromHash de sempre)");

  console.log("");
  console.log("==================================================");
  console.log("11. TESTE NEGATIVO GLOBAL — telas-raiz da bottom nav NÃO ganharam nenhum controle flutuante novo");
  console.log("==================================================");
  const buscaFnBody = sliceFn(appJs, "function renderBusca(tagIds, textFilters, initialIngredientMode, initialQuery) {", "renderBusca");
  assert(!buscaFnBody.includes("chrome-float") && !buscaFnBody.includes("createBackFloat") && !buscaFnBody.includes("createExitCookFloat"), "Busca (aba raiz) sem back-float/exit-cook-float — sem página-mãe, por design (comentário do próprio código)");
  const minhasReceitasFnBody = sliceFn(appJs, "function renderMinhasReceitas() {", "renderMinhasReceitas");
  assert(!minhasReceitasFnBody.includes("chrome-float"), "Minhas Receitas (aba raiz) sem controle flutuante novo");
  const preparosFnBody = sliceFn(appJs, "function renderPreparosList() {", "renderPreparosList");
  assert(!preparosFnBody.includes("chrome-float"), "Preparos (aba raiz) sem controle flutuante novo");
  const listaComprasFnBody = sliceFn(appJs, "function renderListaCompras() {", "renderListaCompras");
  assert(!listaComprasFnBody.includes("chrome-float"), "Lista de Compras (aba raiz) sem controle flutuante novo");

  console.log("");
  console.log("==================================================");
  console.log("12. LIMPEZA — .back-button morreu de vez (0 usos em JS, regra própria removida do CSS)");
  console.log("==================================================");
  assert(!appJs.includes('"back-button"'), "zero ocorrências da string back-button em js/app.js (as 4 telas que a usavam já migraram)");
  assert(!/\n\.back-button \{/.test(css), "regra .back-button {} removida do CSS (classe morta, ficou sem nenhum uso depois desta rodada)");

  console.log("");
  console.log("==================================================");
  console.log("13. SERVICE WORKER — v26 (item 2, redesenho do card, mudou css/js de novo)");
  console.log("==================================================");
  // Cadeia de bumps desde esta suíte: v25 (verify-recentes-ui-2026-07-25.js, carrossel) -> v26
  // (verify-card-contract-2026-07-25.js, redesenho completo do card) — mesma regra do CLAUDE.md,
  // cada leva que muda css/style.css ou js/app.js sobe a versão, e esta asserção sempre
  // acompanha o bump MAIS RECENTE, nunca uma versão presa no passado.
  assert(swJs.includes('const CACHE_NAME = "cardapio-v26";'), "CACHE_NAME v26 — 2º bump desde esta suíte (v24->v25 carrossel, v25->v26 redesenho do card), mesma regra do CLAUDE.md");

  console.log("");
  console.log("==================================================");
  console.log("14. DOCS — skill product-navigation-ux e DESIGN-TOKENS.md refletem a expansão pra todas as telas");
  console.log("==================================================");
  const skillPath = path.join(ROOT, ".claude", "skills", "product-navigation-ux", "SKILL.md");
  const skill = fs.readFileSync(skillPath, "utf8");
  assert(skill.includes("chrome-float") || skill.includes("exit-cook-float"), "skill product-navigation-ux cita a expansão (chrome-float/exit-cook-float)");
  const tokensPath = path.join(ROOT, "docs", "DESIGN-TOKENS.md");
  const tokens = fs.readFileSync(tokensPath, "utf8");
  assert(tokens.includes("chrome-float"), "DESIGN-TOKENS.md documenta a base compartilhada .chrome-float");
  assert(tokens.includes("exit-cook-float"), "DESIGN-TOKENS.md documenta a pílula .exit-cook-float");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
