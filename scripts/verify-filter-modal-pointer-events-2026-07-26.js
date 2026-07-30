// scripts/verify-filter-modal-pointer-events-2026-07-26.js
//
// HOTFIX 2026-07-26: modal de filtros não recebia nenhum clique (abria, mas não selecionava
// filtro nem fechava — "Cancelar" também morto). Causa raiz confirmada ao vivo via
// elementFromPoint num filtro do modal aberto, ANTES de qualquer mudança: o commit 2ed3045
// introduziu `body { pointer-events: none; }` com whitelist de `auto` só em
// #bottom-nav/#category-header/#recipes-content (resolvia um clique morto real no coração da
// página de receita, .recipe-hero__heart, z-index negativo — ver seção 3 abaixo). Mas
// .filter-modal-overlay é appendado direto em document.body (fora dessa whitelist, comentário
// de js/app.js:8 já registrava isso, escrito ANTES da whitelist existir) — herdou
// pointer-events:none, matando todo clique dentro do modal, silenciosamente (sem erro no
// console).
//
// Auditoria sistêmica (pedida junto com o fix, não só o caso reportado) encontrou uma 2ª
// vítima do mesmo padrão, ainda não reportada pelo dono: .update-toast (mesmo
// document.body.appendChild direto, mesma ausência de pointer-events próprio) — o botão
// "Atualizar" do toast de nova versão também estava morto.
//
// Em vez de fixar só os 2 nomes conhecidos, a seção 2 AUDITA TODO document.body.appendChild(X)
// em js/app.js e confirma que a classe de X está coberta pela whitelist de pointer-events:auto
// no CSS — pega uma 3ª instância futura automaticamente, não só as 2 de hoje. Decisão de manter
// a whitelist (não inverter pra isolar hero/coração num stacking context próprio): ver relatório
// da tarefa — a inversão é uma mudança de arquitetura maior, fora do escopo de um hotfix; fica
// registrada como recomendação, não implementada aqui.
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte,
// nunca por ref de git (regra do CLAUDE.md: só literais).
//
// `node scripts/verify-filter-modal-pointer-events-2026-07-26.js` — sai com código != 0 se algo falhar.

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

function main() {
  console.log("==================================================");
  console.log("1. MECANISMO BASE — body:none + whitelist de auto (introduzido no commit 2ed3045) continua existindo");
  console.log("==================================================");
  assert(/body\s*\{\s*pointer-events:\s*none;\s*\}/.test(css), "body { pointer-events: none; } presente");
  const whitelistMatch = css.match(/#bottom-nav,\s*#category-header,\s*#recipes-content(?:,\s*\.[\w-]+)*\s*\{\s*pointer-events:\s*auto;\s*\}/);
  assert(!!whitelistMatch, "regra de whitelist #bottom-nav/#category-header/#recipes-content(+extras) { pointer-events: auto; } encontrada");
  const whitelist = whitelistMatch ? whitelistMatch[0] : "";

  console.log("");
  console.log("==================================================");
  console.log("2. AUDITORIA SISTÊMICA — todo document.body.appendChild(X) em app.js precisa da classe de X coberta pela whitelist");
  console.log("==================================================");
  const appendRe = /document\.body\.appendChild\((\w+)\)/g;
  let m;
  let auditedCount = 0;
  while ((m = appendRe.exec(appJs))) {
    const varName = m[1];
    const idx = m.index;
    const classNeedle = varName + '.className = "';
    const classIdx = appJs.lastIndexOf(classNeedle, idx);
    const closeEnough = classIdx >= 0 && idx - classIdx < 2000;
    assert(closeEnough, "document.body.appendChild(" + varName + "): atribuição de " + varName + ".className encontrada perto (mesmo bloco, <2000 chars antes)");
    if (closeEnough) {
      const afterQuote = appJs.slice(classIdx + classNeedle.length);
      const endQuote = afterQuote.indexOf('"');
      const cls = afterQuote.slice(0, endQuote);
      auditedCount++;
      assert(whitelist.includes("." + cls), "." + cls + " (appendado direto em document.body, fora de #bottom-nav/#category-header/#recipes-content) está coberto pela whitelist de pointer-events:auto");
    }
  }
  assert(auditedCount >= 2, "auditoria encontrou pelo menos os 2 casos conhecidos (.filter-modal-overlay, .update-toast) — " + auditedCount + " encontrados. Um 3º document.body.appendChild futuro sem classe correspondente na whitelist FALHA este teste automaticamente.");

  console.log("");
  console.log("==================================================");
  console.log("3. TESTE NEGATIVO — coração da página de receita continua fora da whitelist DIRETA (não precisa: herda auto via #recipes-content, seu ancestral real) — não regride o fix do commit 2ed3045");
  console.log("==================================================");
  assert(!whitelist.includes(".recipe-hero__heart"), "TESTE NEGATIVO: .recipe-hero__heart não foi (e não precisa ser) adicionado à whitelist direta");
  const receitaStart = appJs.indexOf("function renderReceita(id, fromHash) {");
  let receitaEnd = appJs.indexOf("\r\n  function ", receitaStart + 10);
  if (receitaEnd < 0) receitaEnd = appJs.length;
  const receitaFnBody = appJs.slice(receitaStart, receitaEnd);
  assert(receitaFnBody.includes("page.appendChild(heart)"), "heart continua appendado em page (não em document.body) — não muda com este hotfix");
  assert(receitaFnBody.includes("content.appendChild(page)"), "page (que contém heart) continua appendado em content = #recipes-content — a rota de herança de pointer-events:auto continua intacta");
  assert(!/document\.body\.appendChild\(heart\)/.test(appJs), "TESTE NEGATIVO: heart nunca é appendado direto em document.body");

  console.log("");
  console.log("==================================================");
  console.log("4. SERVICE WORKER — CACHE_NAME bump (hotfix mexe em css/style.css, faz parte do APP_SHELL)");
  console.log("==================================================");
  // v30 -> v31: stale por causa da leva final de sobras (header de ingredientes, js/app.js),
  // não desta suíte — mesmo padrão de literal-encadeado das outras suítes do projeto.
  // v31 -> v32: stale de novo, desta vez por um fix pontual (centralização vertical do mesmo
  // header, css/style.css) — mesmo padrão, também externo a este hotfix.
  // v32 -> v33 -> v34 -> v35: item final do redesenho visual, rumo novo de Países, calibração
  // final do banner de hub — todos externos a este hotfix, mesmo padrão de sempre.
  assert(/const CACHE_NAME = "cardapio-v51";/.test(swJs), "CACHE_NAME v29 -> ... -> v50 -> v51 (higiene F1b 2026-07-30: mais um bump de feature externa, atualizado pro valor vigente)");

  console.log("");
  console.log("==================================================");
  console.log("5. HANDLER DO TOAST DE UPDATE — prova ao vivo feita na tarefa (relatório); aqui só o guard-rail estático contra regressão da fiação");
  console.log("==================================================");
  // Prova ao vivo (fora desta suíte, resultado no relatório da tarefa): bump temporário local
  // de CACHE_NAME + registration.update() real numa aba já controlada reproduziu a cadeia
  // inteira sem intervenção manual — updatefound -> installing -> installed -> activating (sem
  // ficar preso em "waiting", confirma self.skipWaiting() em sw.js) -> .update-toast APARECEU
  // sozinho no DOM (prova que controllerchange + hadControllerBefore + showUpdateToast()
  // disparam de verdade, não só existem no código) -> clique real via elementFromPoint no botão
  // -> location.reload() confirmado (sessionStorage sobreviveu ao reload, estado em memória foi
  // limpo) -> cache antigo removido, só o novo sobrou (confirma o cleanup de self.clients.claim()
  // no activate). Nenhum elo quebrado — nada corrigido aqui, só travado contra regressão futura.
  assert(/const hadControllerBefore = !!navigator\.serviceWorker\.controller;/.test(appJs), "hadControllerBefore capturado SINCRONAMENTE (antes do register) — se isso regredir pra depois do register(), o gate perde sentido (controller já teria mudado antes da captura)");
  const hadControllerIdx = appJs.indexOf("const hadControllerBefore");
  const registerIdx = appJs.indexOf('.register("sw.js")');
  assert(hadControllerIdx > 0 && registerIdx > hadControllerIdx, "hadControllerBefore capturado ANTES de .register(\"sw.js\") no código-fonte (ordem importa pra correção do gate)");
  assert(/addEventListener\("controllerchange", \(\) => \{\s*if \(!hadControllerBefore\) return;\s*showUpdateToast\(\);\s*\}\);/.test(appJs), "listener de controllerchange gateado por hadControllerBefore antes de chamar showUpdateToast() — sem isso o toast apareceria já na 1ª instalação (nunca deveria)");
  assert(/addEventListener\("click", \(\) => location\.reload\(\)\);/.test(appJs), "botão Atualizar do toast chama location.reload() — fecha o último elo da cadeia (sem isso o clique funcionaria mas nunca aplicaria a versão nova)");
  assert(/self\.skipWaiting\(\)/.test(swJs), "sw.js: self.skipWaiting() no install — sem isso o SW novo ficaria preso em 'waiting', controllerchange nunca dispararia numa aba já aberta");
  assert(/self\.clients\.claim\(\)/.test(swJs), "sw.js: self.clients.claim() no activate — sem isso o SW novo ativaria em segundo plano mas NUNCA assumiria uma aba já aberta, controllerchange nunca dispararia nela");
  assert(/keys\.filter\(\(k\) => k !== CACHE_NAME\)\.map\(\(k\) => caches\.delete\(k\)\)/.test(swJs), "sw.js: activate limpa caches antigos (chave != CACHE_NAME atual) — confirmado ao vivo: só a cache nova sobrou depois do update real");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
