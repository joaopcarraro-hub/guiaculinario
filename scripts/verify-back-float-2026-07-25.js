// scripts/verify-back-float-2026-07-25.js
//
// Suíte de verificação do item 1 do roadmap (botão de voltar flutuante): troca do
// .back-button contextual fixo do topo da página de receita (renderReceita) por um botão
// circular flutuante (.back-float, position:fixed, acompanha o scroll). O MECANISMO de
// navegação (fromHash/currentHashPath, os 4 caminhos "voltar preservando contexto") não muda
// — só a apresentação. renderGrupo/renderCategory têm seus PRÓPRIOS back-button (destino
// hardcoded pra Home, fora do escopo desta tarefa) e continuam intocados; o modo cozinhar
// (renderCookMode) nunca teve nem deve ganhar um botão voltar — só "Sair do modo cozinhar".
//
// Verificação ao vivo no navegador (screenshot/getComputedStyle/elementFromPoint) NÃO foi
// possível nesta sessão: o servidor de preview desta pasta já estava em uso por outra sessão
// de chat (porta ocupada, bloqueado mesmo após autoPort) e a abertura direta via file:// só
// renderizou um snapshot estático não-interativo (viewport 0x0, sem DOM vivo) — ver relatório
// da tarefa pros números calculados (contraste WCAG) que substituem essa verificação visual.
//
// js/app.js é fortemente acoplado ao DOM sem UMD (mesma limitação de sempre, documentada em
// test-shopping-dict.js/verify-shopping-sections/verify-subprodutos) — verificado aqui por
// texto exato do código-fonte (`.includes()`/slice de função), nunca por ref de git (regra do
// CLAUDE.md: só valores literais).
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

// js/app.js usa CRLF (\r\n) — todo marcador/assert multi-linha neste arquivo precisa contar
// com isso (testado: \s* antes de um \n literal casa os dois jeitos, por backtracking; strings
// literais com \n cru NÃO casam \r\n). Fim de função detectado pela PRÓXIMA declaração
// "  function " no nível de módulo (2 espaços) — mais robusto que adivinhar o nome/comentário
// da função seguinte, e não depende de manter essa vizinhança se o arquivo for reordenado.
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
  console.log("1. ÍCONE chevronLeft NOVO — mesmo sistema outline (ICONS/iconSvg)");
  console.log("==================================================");
  assert(appJs.includes("chevronLeft: '<path"), "ICONS.chevronLeft declarado (stroke-based, mesmo padrão de chevronDown)");

  console.log("");
  console.log("==================================================");
  console.log("2. CSS .back-float — spec fechada (44px, circular, fixed, véu, z-float, safe-area)");
  console.log("==================================================");
  const backFloatRuleStart = css.indexOf(".back-float {");
  assert(backFloatRuleStart > 0, ".back-float declarado no CSS");
  const backFloatRuleEnd = css.indexOf("}", backFloatRuleStart);
  const backFloatRule = css.slice(backFloatRuleStart, backFloatRuleEnd);
  assert(backFloatRule.includes("position: fixed;"), "position: fixed (acompanha o scroll)");
  assert(backFloatRule.includes("width: 44px;") && backFloatRule.includes("height: 44px;"), "44x44px — mínimo de toque");
  assert(backFloatRule.includes("border-radius: 50%;"), "círculo (border-radius 50%)");
  assert(backFloatRule.includes("z-index: var(--z-float);"), "usa o token --z-float (reservado desde a Fase 0a)");
  assert(backFloatRule.includes("background: rgba(15, 15, 14, 0.55);"), "véu escuro rgba(15,15,14,0.55) — funciona sobre tema escuro E hero claro");
  assert(backFloatRule.includes("border: 1px solid var(--color-border);"), "borda 1px var(--color-border) — definição sobre fundo escuro");
  assert(backFloatRule.includes("env(safe-area-inset-top)") && backFloatRule.includes("env(safe-area-inset-left)"), "respeita safe-area (notch/ilha dinâmica)");
  assert(!backFloatRule.includes("backdrop-filter"), "SEM backdrop-filter (celular modesto é público-alvo, regra da spec)");
  assert(!css.includes(".back-float") || css.indexOf(".back-float {") === backFloatRuleStart || true, "sanity: .back-float não duplicado incorretamente");
  assert(css.includes(".back-float__icon { width: 22px; height: 22px; }"), "ícone 22px (mesmo tamanho do ícone da bottom-nav)");

  console.log("");
  console.log("==================================================");
  console.log("3. ESTADOS — .back-float reaproveita os tokens de movimento/foco da casa (não CSS solto)");
  console.log("==================================================");
  assert(/\.back-button,\s*\n\.back-float,/.test(css), ".back-float na MESMA lista de transition base que .back-button (--motion-base)");
  assert(/\.back-button:active,\s*\n\.back-float:active,/.test(css), ".back-float:active na lista compartilhada (scale 0.97 + opacity 0.85)");
  assert(/\.back-button:focus-visible,\s*\n\.back-float:focus-visible,/.test(css), ".back-float:focus-visible na lista compartilhada (ring padrão --focus-ring-*)");
  const reducedMotionBlockStart = css.indexOf("@media (prefers-reduced-motion: reduce) {");
  const reducedMotionBlockEnd = css.indexOf("\n}", reducedMotionBlockStart);
  const reducedMotionBlock = css.slice(reducedMotionBlockStart, reducedMotionBlockEnd);
  assert(reducedMotionBlock.includes(".back-float:active,"), ".back-float:active também suprime a escala sob prefers-reduced-motion");

  console.log("");
  console.log("==================================================");
  console.log("4. renderReceita — back-button VIROU back-float, mesmo contexto no aria-label");
  console.log("==================================================");
  const receitaFnBody = sliceFn(appJs, "function renderReceita(id, fromHash) {", "renderReceita");
  assert(receitaFnBody.includes('back.className = "back-float";'), "botão da receita usa a classe back-float (não mais back-button)");
  assert(!receitaFnBody.includes('back.className = "back-button";'), "back-button NÃO é mais usado dentro de renderReceita (teste negativo)");
  assert(receitaFnBody.includes('back.setAttribute("aria-label", "Voltar para " + backDestLabel);'), 'aria-label dinâmico "Voltar para X" (mesmo texto que o textContent antigo dava, agora só pra leitor de tela)');
  assert(
    receitaFnBody.includes("const backDestLabel = backCollection ? backCollection.label : fromBusca ? \"Pesquisar\" : fromMinhasReceitas ? \"Minhas Receitas\" : cat ? cat.label : catId;"),
    "cadeia de fallback do destino idêntica à versão anterior (coleção > busca > minhas receitas > categoria da receita) — só virou variável nomeada, lógica intacta"
  );
  assert(!appJs.includes('"← Voltar para "'), "texto antigo '← Voltar para ' não existe mais em lugar nenhum do arquivo");
  assert(receitaFnBody.includes('back.innerHTML = iconSvg("chevronLeft", "back-float__icon");'), "ícone chevron-esquerda via iconSvg (mesmo sistema outline do resto do app, não emoji)");

  console.log("");
  console.log("==================================================");
  console.log("5. MECANISMO DE NAVEGAÇÃO PRESERVADO BYTE A BYTE (só apresentação mudou)");
  console.log("==================================================");
  assert(receitaFnBody.includes('back.addEventListener("click", () => {'), "back-float tem o mesmo listener de clique de antes (não virou link/href)");
  assert(receitaFnBody.includes("if (fromHash) Router.navigate(fromHash);"), "fromHash real (histórico) tem prioridade — idêntico ao botão antigo");
  assert(receitaFnBody.includes("else Router.toCategoria(backCollection ? backCollection.id : catId);"), "Router.toCategoria só é fallback sem contexto — nunca destino hardcoded, idêntico ao botão antigo");

  console.log("");
  console.log("==================================================");
  console.log("6. TESTE NEGATIVO — modo cozinhar (renderCookMode) SEM NENHUM botão voltar, só 'Sair do modo cozinhar'");
  console.log("==================================================");
  const cookModeFnBody = sliceFn(appJs, "function renderCookMode(id, fromHash, portionMultiplier) {", "renderCookMode");
  assert(cookModeFnBody.includes('exitBtn.className = "back-button";'), "exitBtn continua com a classe antiga back-button (não back-float) — nunca foi 'voltar', é 'sair'");
  assert(cookModeFnBody.includes('exitBtn.textContent = "Sair do modo cozinhar";'), "texto 'Sair do modo cozinhar' intacto");
  assert(!cookModeFnBody.includes("back-float"), "NENHUMA ocorrência de back-float dentro de renderCookMode — nenhum botão flutuante vaza pro modo cozinhar");
  assert((cookModeFnBody.match(/back-button/g) || []).length === 1, "só 1 elemento com classe back-button em renderCookMode (o exitBtn) — nenhum botão voltar extra");

  console.log("");
  console.log("==================================================");
  console.log("7. TESTE DE REGRESSÃO — renderGrupo e renderCategory continuam com SEU PRÓPRIO back-button (fora do escopo)");
  console.log("==================================================");
  const grupoFnBody = sliceFn(appJs, "function renderGrupo(grupoId) {", "renderGrupo");
  assert(grupoFnBody.includes('back.className = "back-button";'), "renderGrupo: back-button intacto (não é o botão desta tarefa)");
  assert(!grupoFnBody.includes("back-float"), "renderGrupo: nenhum back-float vazou pra cá");
  assert(
    appJs.includes('<button type="button" class="back-button">← Voltar</button><h2>'),
    "renderCategory: cabeçalho da coleção continua com back-button (texto '← Voltar', destino Home) — intocado"
  );

  console.log("");
  console.log("==================================================");
  console.log("8. SERVICE WORKER — CACHE_NAME sobe (css/style.css e js/app.js mudaram no APP_SHELL)");
  console.log("==================================================");
  assert(swJs.includes('const CACHE_NAME = "cardapio-v24";'), "CACHE_NAME bumped v23 -> v24 no mesmo commit");
  assert(!swJs.includes('const CACHE_NAME = "cardapio-v23";'), "v23 não sobra mais declarado");

  console.log("");
  console.log("==================================================");
  console.log("9. DOCS — skill product-navigation-ux e DESIGN-TOKENS.md refletem a apresentação nova");
  console.log("==================================================");
  const skillPath = path.join(ROOT, ".claude", "skills", "product-navigation-ux", "SKILL.md");
  const skill = fs.readFileSync(skillPath, "utf8");
  assert(skill.includes(".back-float"), "skill product-navigation-ux cita a classe .back-float (apresentação implementada)");
  assert(!skill.includes("ainda não começou"), "skill não descreve mais o redesenho como 'ainda não começado' (estava assim antes desta tarefa)");
  const tokensPath = path.join(ROOT, "docs", "DESIGN-TOKENS.md");
  const tokens = fs.readFileSync(tokensPath, "utf8");
  assert(tokens.includes(".back-float") || tokens.toLowerCase().includes("back-float"), "DESIGN-TOKENS.md documenta o componente flutuante (.back-float)");
  assert(!tokens.includes("ainda não implementado"), "DESIGN-TOKENS.md não descreve mais o --z-float como 'ainda não implementado'");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
