// scripts/verify-preparos-multitimer-2026-07-30.js
//
// Fase multi-timer (2026-07-30) — 3 bugs reais reportados pelo dono no card de Preparos:
// (1) mostrava mm:ss, divergindo do hh:mm:ss do modo cozinhar; (2) não contava ao vivo (FOTO
// tirada no render, congelada); (3) com 2+ timers ativos em passos DIFERENTES da mesma sessão,
// só o do passo atual (session.currentStep) aparecia — o outro seguia rodando de verdade no
// Storage, invisível no card.
//
// Investigação prévia (relatório da tarefa): o MODELO já era {endsAt, remainingSeconds, running,
// started} por stepIndex, endsAt já absoluto, e nada impedia 2+ stepIndex com running:true ao
// mesmo tempo — o storage já suportava múltiplos timers concorrentes, o bug inteiro era na
// LEITURA (card só olhava 1 chave) e na EXIBIÇÃO (sem ticker, formatação ad-hoc). Por isso esta
// suíte não testa uma migração NOVA (não existe — schema inalterado) e sim confirma que os 2
// mecanismos de proteção PRÉ-EXISTENTES contra formato antigo continuam intactos (seção 1).
//
// 3 técnicas já estabelecidas no projeto, combinadas:
// - RELÓGIO INJETADO: getActiveStepTimers/formatBigTime são funções PURAS (sem DOM) — extraídas
//   do código-fonte real por casamento de chaves e EXECUTADAS de verdade (eval do texto isolado,
//   mesma classe de técnica de sandboxar storage.js abaixo) com `now` como parâmetro literal,
//   nunca Date.now() do relógio real da máquina que roda o teste.
// - execução REAL de storage.js sandboxado com localStorage falso (mesmo truque de
//   verify-lista-compras-ui-2026-07-30.js seção 4) — pra cancelar/desfazer com valores literais.
// - texto exato do código-fonte (.includes()/regex) — pro resto (wiring, ordem, whitelist).
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte
// (regra do CLAUDE.md: só literais, nunca ref de git).
//
// `node scripts/verify-preparos-multitimer-2026-07-30.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const storageJs = fs.readFileSync(path.join(ROOT, "js", "storage.js"), "utf8");
const styleCss = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

let failures = 0;
let currentSection = null;
const sectionCounts = {};
const sectionOrder = [];
function section(key, title) {
  currentSection = key;
  if (!sectionCounts[key]) {
    sectionCounts[key] = { ok: 0, fail: 0 };
    sectionOrder.push(key);
  }
  console.log("==================================================");
  console.log(key + ". " + title);
  console.log("==================================================");
}
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
    if (currentSection) sectionCounts[currentSection].ok++;
  } else {
    console.log("  FAIL " + label);
    failures++;
    if (currentSection) sectionCounts[currentSection].fail++;
  }
}

// Mesma técnica de extractFunctionByName (verify-timer-tap-edit-2026-07-30.js): casamento de
// chaves a partir do primeiro "{" após "function <nome>(" — robusto a mudança de assinatura.
function extractFunctionByName(src, fnName) {
  const idx = src.indexOf("function " + fnName + "(");
  if (idx < 0) return null;
  const braceStart = src.indexOf("{", idx);
  if (braceStart < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return end < 0 ? null : src.slice(idx, end);
}

// Mesma técnica de sliceTopLevel (verify-lista-compras-ui-2026-07-30.js): extrai o corpo de uma
// função top-level (2 espaços de indentação) por marca de início; fim = a próxima declaração
// "  function " ou "  const " no mesmo nível. app.js usa CRLF.
function sliceTopLevel(src, startMarker, label) {
  const start = src.indexOf(startMarker);
  assert(start >= 0, label + ": marca de início encontrada em app.js");
  if (start < 0) return "";
  let end = src.indexOf("\r\n  function ", start + startMarker.length);
  const endConst = src.indexOf("\r\n  const ", start + startMarker.length);
  if (endConst >= 0 && (end < 0 || endConst < end)) end = endConst;
  if (end < 0) end = src.length;
  return src.slice(start, end);
}

// Extrai 1+ funções PURAS por nome (em ordem de dependência — quem é chamado primeiro) e
// compila de verdade (eval do texto isolado, envolto numa IIFE só pra resolver as dependências
// entre si via escopo de função normal) — só usável pra funções sem closure sobre DOM/variáveis
// externas. Devolve a ÚLTIMA da lista (a que os testes chamam; as anteriores são só dependência,
// ex. formatBigTime chama pad2).
function compilePureFunction(src, fnNames) {
  const bodies = fnNames.map((name) => extractFunctionByName(src, name));
  if (bodies.some((b) => !b)) return null;
  try {
    const wrapped = "(function () {\n" + bodies.join("\n") + "\nreturn " + fnNames[fnNames.length - 1] + ";\n})()";
    // eslint-disable-next-line no-eval
    return eval(wrapped);
  } catch (e) {
    console.log("  ERRO ao compilar " + fnNames.join(", ") + ": " + e.message);
    return null;
  }
}

function makeFakeLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
}

function sandboxStorage(fakeLS) {
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", "localStorage", storageJs)(sandbox.window, fakeLS);
  return sandbox.window.Storage;
}

function main() {
  section("1", "MODELO — sem migração NOVA (schema inalterado); guardas PRÉ-EXISTENTES contra formato antigo continuam intactas");
  assert(storageJs.includes("const PREPARO_SCHEMA_VERSION = 1;"), "PREPARO_SCHEMA_VERSION continua 1 — esta fase NÃO mudou o schema de gusta-preparos-v1 (endsAt absoluto por stepIndex já suportava múltiplos timers concorrentes ANTES desta tarefa; o bug estava só na leitura/exibição do card)");
  assert(storageJs.includes("!!s.stepTimers") && storageJs.includes('typeof s.stepTimers === "object"'), "isValidPreparoSession continua exigindo stepTimers objeto — guarda pré-existente intacta, não tocada por esta fase");
  assert(
    appJs.includes("return t.started === undefined ? Object.assign({}, t, { started: !!t.running }) : t;"),
    "TESTE DE REGRESSÃO: o shim de migração leve pré-existente (sessões sem campo 'started') continua intacto em getStepTimerState — não tocado por esta fase"
  );

  // Guarda de versão em ação de verdade: sessão corrompida (sem stepTimers) misturada com uma
  // válida no MESMO localStorage — isValidPreparoSession precisa descartar só a corrompida.
  const fakeLS1 = makeFakeLocalStorage();
  fakeLS1.setItem(
    "gusta-preparos-v1",
    JSON.stringify({
      version: 1,
      sessions: {
        "receita-valida": { recipeId: "receita-valida", startedAt: 1, currentStep: 0, portionMultiplier: 1, stepTimers: {}, status: "em-andamento" },
        "receita-corrompida": { recipeId: "receita-corrompida", startedAt: 1, currentStep: 0, status: "em-andamento" }, // falta stepTimers
      },
    })
  );
  const StorageGuard = sandboxStorage(fakeLS1);
  assert(!!StorageGuard.getPreparoSession("receita-valida"), "sessão válida sobrevive à carga");
  assert(!StorageGuard.getPreparoSession("receita-corrompida"), "TESTE NEGATIVO: sessão sem stepTimers é descartada sozinha ao carregar, sem derrubar a outra — guarda pré-existente, ainda intacta depois desta tarefa");

  console.log("");
  section("2", "FONTE PURA — getActiveStepTimers, execução REAL com relógio injetado");
  const getActiveStepTimers = compilePureFunction(appJs, ["getActiveStepTimers"]);
  assert(typeof getActiveStepTimers === "function", "getActiveStepTimers encontrada, isolada por casamento de chaves e compilada de verdade (eval)");

  if (getActiveStepTimers) {
    const NOW = 1700000000000; // literal fixo — nunca Date.now() da máquina que roda o teste
    const fixture = {
      0: { endsAt: NOW + 90000, remainingSeconds: 999, running: true, started: true }, // termina em 90s (3º)
      2: { endsAt: NOW + 30000, remainingSeconds: 999, running: true, started: true }, // termina em 30s (2º)
      3: { endsAt: NOW - 5000, remainingSeconds: 0, running: true, started: true }, // já vencido (1º — Pronto!)
      5: { endsAt: NOW, remainingSeconds: 999, running: true, started: true }, // vence EXATAMENTE agora (empata com o de cima na borda)
      1: { endsAt: null, remainingSeconds: 45, running: false, started: false }, // PARADO -> excluído
      4: { endsAt: null, remainingSeconds: 60, running: false, started: true }, // PAUSADO -> excluído
    };
    const result = getActiveStepTimers(fixture, NOW);
    assert(Array.isArray(result) && result.length === 4, "4 timers ATIVOS retornados (2 PARADO/PAUSADO excluídos) — obtido " + (result && result.length));
    const order = result.map((r) => r.stepIndex).join(",");
    assert(order === "3,5,2,0", "ordenados por endsAt ASCENDENTE (quem termina primeiro vem primeiro) — obtido [" + order + "], esperado [3,5,2,0]");
    assert(result[0].isDone === true && result[0].remainingSeconds === 0, "passo 3 (vencido há 5s): isDone=true, remainingSeconds=0 — obtido isDone=" + result[0].isDone + " remainingSeconds=" + result[0].remainingSeconds);
    assert(result[1].isDone === true && result[1].remainingSeconds === 0, "passo 5 (endsAt === now, fronteira <=): também isDone=true — obtido isDone=" + result[1].isDone);
    assert(result[2].isDone === false && result[2].remainingSeconds === 30, "passo 2: isDone=false, remainingSeconds=30 (literal) — obtido " + result[2].remainingSeconds);
    assert(result[3].isDone === false && result[3].remainingSeconds === 90, "passo 0: isDone=false, remainingSeconds=90 (literal) — obtido " + result[3].remainingSeconds);
    assert(getActiveStepTimers(fixture, NOW).map((r) => r.stepIndex).join(",") === order, "TESTE DE ESTABILIDADE: chamar de novo com o MESMO now devolve a MESMA ordem — nunca precisa reordenar a cada tick, só quando a lista é reconstruída");

    assert(Array.isArray(getActiveStepTimers(null, NOW)) && getActiveStepTimers(null, NOW).length === 0, "TESTE NEGATIVO: stepTimers null não quebra, devolve lista vazia");
    assert(Array.isArray(getActiveStepTimers({}, NOW)) && getActiveStepTimers({}, NOW).length === 0, "TESTE NEGATIVO: stepTimers vazio devolve lista vazia");
    assert(Array.isArray(getActiveStepTimers(undefined, NOW)) && getActiveStepTimers(undefined, NOW).length === 0, "TESTE NEGATIVO: stepTimers undefined não quebra, devolve lista vazia");
  }

  console.log("");
  section("3", "FONTE PURA — formatBigTime, execução REAL — SEMPRE hh:mm:ss (decisão do dono, nunca cai pra mm:ss)");
  const formatBigTime = compilePureFunction(appJs, ["pad2", "formatBigTime"]);
  assert(typeof formatBigTime === "function", "formatBigTime encontrada, isolada por casamento de chaves e compilada de verdade (eval)");
  if (formatBigTime) {
    assert(formatBigTime(0) === "00:00:00", 'formatBigTime(0) === "00:00:00" — obtido "' + formatBigTime(0) + '"');
    assert(formatBigTime(30) === "00:00:30", 'formatBigTime(30) === "00:00:30" (30s — o caso que ANTES virava mm:ss "00:30" no card) — obtido "' + formatBigTime(30) + '"');
    assert(formatBigTime(90) === "00:01:30", 'formatBigTime(90) === "00:01:30" — obtido "' + formatBigTime(90) + '"');
    assert(formatBigTime(3661) === "01:01:01", 'formatBigTime(3661) === "01:01:01" (com hora) — obtido "' + formatBigTime(3661) + '"');
    assert(/^\d{2}:\d{2}:\d{2}$/.test(formatBigTime(5)), "TESTE NEGATIVO: mesmo 5 segundos continua no formato hh:mm:ss completo (3 partes), nunca encurta pra mm:ss");
  }

  console.log("");
  section("4", "STORAGE REAL sandboxado — cancelar 1 timer NÃO afeta o outro (valores literais)");
  const fakeLS2 = makeFakeLocalStorage();
  const Storage = sandboxStorage(fakeLS2);
  assert(!!Storage, "storage.js sandboxa e roda com localStorage falso (sem tocar localStorage real)");
  let ENDS_A, ENDS_B, originalStep0;
  if (Storage) {
    Storage.startPreparoSession("bolo-de-fuba", 1);
    ENDS_A = 5000000000000;
    ENDS_B = 5000000090000;
    Storage.savePreparoStepTimer("bolo-de-fuba", 0, { endsAt: ENDS_A, remainingSeconds: 999, running: true, started: true });
    Storage.savePreparoStepTimer("bolo-de-fuba", 2, { endsAt: ENDS_B, remainingSeconds: 999, running: true, started: true });

    let session = Storage.getPreparoSession("bolo-de-fuba");
    assert(session.stepTimers[0].endsAt === ENDS_A && session.stepTimers[2].endsAt === ENDS_B, "2 timers independentes coexistem na MESMA sessão, cada 1 com seu endsAt literal — confirma o storage já suporta multi-timer");

    // Mesma forma que o handler real do × do chip usa: snapshot ANTES, depois zera.
    originalStep0 = Object.assign({}, session.stepTimers[0]);
    Storage.savePreparoStepTimer("bolo-de-fuba", 0, { endsAt: null, remainingSeconds: 0, running: false, started: false });

    session = Storage.getPreparoSession("bolo-de-fuba");
    assert(session.stepTimers[0].running === false && session.stepTimers[0].endsAt === null, "cancelar o passo 0 zera SÓ o estado do passo 0");
    assert(
      session.stepTimers[2].endsAt === ENDS_B && session.stepTimers[2].running === true,
      "TESTE NEGATIVO: cancelar o passo 0 NÃO afeta o passo 2 — endsAt idêntico (" + ENDS_B + "), running continua true"
    );
  }

  console.log("");
  section("5", "STORAGE REAL sandboxado — desfazer restaura endAt IDÊNTICO (valores literais)");
  if (Storage) {
    Storage.savePreparoStepTimer("bolo-de-fuba", 0, originalStep0); // mesma chamada que o clique em "Desfazer" faz
    const session = Storage.getPreparoSession("bolo-de-fuba");
    assert(session.stepTimers[0].endsAt === ENDS_A, "desfazer restaura endsAt IDÊNTICO ao original (" + ENDS_A + ") — obtido " + session.stepTimers[0].endsAt);
    assert(
      JSON.stringify(session.stepTimers[0]) === JSON.stringify(originalStep0),
      "desfazer restaura o objeto INTEIRO byte a byte (endsAt/remainingSeconds/running/started), não só endsAt isolado"
    );
    assert(session.stepTimers[2].endsAt === ENDS_B, "TESTE NEGATIVO: desfazer o passo 0 não mexeu no passo 2, que nunca tinha sido tocado");

    // Independência do snapshot: mutar o estado ATUAL depois de tirar o snapshot não pode vazar
    // pro objeto snapshot já guardado (prova que Object.assign({}, ...) tira cópia de verdade).
    const snap2 = Object.assign({}, Storage.getPreparoSession("bolo-de-fuba").stepTimers[2]);
    Storage.savePreparoStepTimer("bolo-de-fuba", 2, { endsAt: 999, remainingSeconds: 0, running: false, started: false });
    assert(snap2.endsAt === ENDS_B, "TESTE NEGATIVO: snapshot é cópia independente — mutar o estado real DEPOIS do snapshot não aparece nele (obtido snap2.endsAt=" + snap2.endsAt + ", continua " + ENDS_B + ")");
  }

  console.log("");
  section("6", "ESTRUTURA — renderPreparosList lê a pilha inteira, chip com 2 botões IRMÃOS (nunca aninhados)");
  const renderBody = sliceTopLevel(appJs, "function renderPreparosList() {", "renderPreparosList");
  assert(renderBody.includes("getActiveStepTimers(session.stepTimers, Date.now())"), "renderPreparosList deriva a pilha via getActiveStepTimers — não lê mais só 1 chave");
  assert(!/session\.stepTimers\[session\.currentStep\]/.test(renderBody), "TESTE NEGATIVO: o bug original (só olhar o timer do passo ATUAL) não sobrevive em nenhuma forma");
  assert(!/mm \+ ":" \+ ss/.test(renderBody), "TESTE NEGATIVO: a formatação ad-hoc mm:ss antiga foi removida");
  const formatCallCount = (renderBody.match(/formatBigTime\(/g) || []).length;
  assert(formatCallCount >= 2, "chip usa formatBigTime (hh:mm:ss compartilhado com o modo cozinhar) em pelo menos 2 pontos (render inicial + ticker) — obtido " + formatCallCount);

  assert((renderBody.match(/<button type="button" class="preparo-timer-chip/g) || []).length === 2, "exatamente 2 <button> por chip (corpo + cancelar) — nenhum 3º, nenhum duplicado");
  const bodyBtnOpenIdx = renderBody.indexOf('<button type="button" class="preparo-timer-chip__body">');
  const bodyBtnCloseIdx = renderBody.indexOf("</span></button>");
  const cancelBtnOpenIdx = renderBody.indexOf('<button type="button" class="preparo-timer-chip__cancel"');
  assert(
    bodyBtnOpenIdx !== -1 && bodyBtnCloseIdx !== -1 && cancelBtnOpenIdx !== -1 && bodyBtnCloseIdx < cancelBtnOpenIdx,
    "os 2 <button> do chip são IRMÃOS no template (o corpo FECHA antes do cancelar ABRIR) — nunca aninhados, mesmo padrão de .busca-recente-chip__label/__remove"
  );

  const bodyHandlerIdx = renderBody.indexOf('chip.querySelector(".preparo-timer-chip__body")');
  const cancelHandlerIdx = renderBody.indexOf('chip.querySelector(".preparo-timer-chip__cancel")');
  assert(bodyHandlerIdx !== -1 && cancelHandlerIdx !== -1 && bodyHandlerIdx < cancelHandlerIdx, "os 2 listeners de click (corpo e cancelar) existem, em ordem");
  const bodyHandlerSlice = renderBody.slice(bodyHandlerIdx, cancelHandlerIdx);
  assert(bodyHandlerSlice.includes("e.stopPropagation();"), "corpo do chip chama stopPropagation — não vaza clique pro onclick do card");
  assert(
    bodyHandlerSlice.indexOf("Storage.savePreparoStep(session.recipeId, stepIndex)") !== -1 &&
      bodyHandlerSlice.indexOf("Storage.savePreparoStep(") < bodyHandlerSlice.indexOf("Router.toCozinhar("),
    "ORDEM: corpo do chip grava o passo ALVO (savePreparoStep) ANTES de navegar (Router.toCozinhar) — senão renderCookMode abriria no passo antigo"
  );
  const cancelHandlerSlice = renderBody.slice(cancelHandlerIdx);
  assert(cancelHandlerSlice.includes("e.stopPropagation();"), "× do chip também chama stopPropagation");
  assert(cancelHandlerSlice.includes("showPreparoTimerUndoToast(session.recipeId, stepIndex, snapshot)"), "× do chip mostra o toast de desfazer com o snapshot ORIGINAL (pré-cancelamento)");

  console.log("");
  section("7", "TICKER — 1 por tela, só existe se houver timer ativo, sem interval órfão");
  assert(
    renderBody.indexOf("clearInterval(preparosTickInterval);") < renderBody.indexOf("const sessions = Storage.getActivePreparoSessions();"),
    "ticker é limpo NO TOPO de renderPreparosList, antes de tudo — idempotente contra re-render (ex.: depois de cancelar 1 timer)"
  );
  assert(renderBody.includes("if (anyActiveTimer) {") && renderBody.includes("preparosTickInterval = setInterval("), "ticker só é criado se houver >=1 timer ativo — nunca interval rodando à toa");
  assert(renderBody.includes("}, 1000);"), "cadência de 1s, mesma do modo cozinhar");

  const handleRouteBody = sliceTopLevel(appJs, "function handleRoute(route) {", "handleRoute");
  const idxCloseModal = handleRouteBody.indexOf("if (closeActiveFilterModal) closeActiveFilterModal();");
  const idxClearTicker = handleRouteBody.indexOf("clearInterval(preparosTickInterval);");
  const idxDispatch = handleRouteBody.indexOf('if (route.name === "busca")');
  assert(
    idxCloseModal !== -1 && idxClearTicker !== -1 && idxDispatch !== -1 && idxCloseModal < idxClearTicker && idxClearTicker < idxDispatch,
    "handleRoute limpa o ticker de Preparos INCONDICIONALMENTE, junto do fechamento do modal de filtro, ANTES de decidir a rota nova — sair de #/preparos por qualquer caminho nunca deixa o interval de 1s órfão"
  );

  console.log("");
  section("8", "TOAST DE DESFAZER — reusa update-toast, entra na whitelist, não vaza pra outra tela");
  assert(appJs.includes("function showPreparoTimerUndoToast(recipeId, stepIndex, originalState) {"), "showPreparoTimerUndoToast existe");
  const toastBody = sliceTopLevel(appJs, "function showPreparoTimerUndoToast(recipeId, stepIndex, originalState) {", "showPreparoTimerUndoToast");
  assert(toastBody.includes('toast.className = "update-toast preparo-timer-undo-toast";'), "toast usa as 2 classes: update-toast (visual de graça) + preparo-timer-undo-toast (marcador/whitelist)");
  assert(/setTimeout\(\(\) => \{\s*\n\s*toast\.remove\(\);\s*\n\s*\}, 6000\);/.test(toastBody), "auto-dismiss em 6000ms (~6s), mesmo padrão de showShoppingUndoToast (F1c)");
  assert(
    toastBody.includes('Router.current().name === "preparos"'),
    "Desfazer só re-renderiza se a tela de Preparos ainda estiver aberta — nunca troca conteúdo de outra tela por baixo do usuário"
  );
  assert(toastBody.includes("Storage.savePreparoStepTimer(recipeId, stepIndex, originalState)"), "Desfazer restaura o originalState (objeto INTEIRO capturado no momento do cancelamento), nunca recalcula um endsAt novo");
  assert(
    /#bottom-nav, #category-header, #recipes-content, \.filter-modal-overlay, \.update-toast, \.sort-sheet-overlay, \.shopping-undo-toast, \.preparo-timer-undo-toast(?:, \.[\w-]+)* \{ pointer-events: auto; \}/.test(styleCss),
    ".preparo-timer-undo-toast entrou na whitelist de pointer-events do body — sem isso o toast novo renderiza mas fica com clique morto (mesma causa raiz já documentada pra .shopping-undo-toast/.filter-modal-overlay). Regex aceita classes extras DEPOIS dela (grupo opcional não-capturante, mesmo tratamento que verify-lista-compras-ui-2026-07-30.js já deu à dela) — Fase indicadores, 2026-07-30, acrescentou .preparo-completion-toast na mesma linha; esta suíte não é a dona dessa classe, só confirma que .preparo-timer-undo-toast (a dela) continua coberta"
  );

  console.log("");
  section("9", "CSS — chip novo, estado Pronto!, CSS morto do .preparo-card__timer removido");
  assert(/\.preparo-timer-chip\.is-done \{\s*background:\s*var\(--color-accent-deep\);\s*\}/.test(styleCss), ".preparo-timer-chip.is-done usa --color-accent-deep (mesmo par de contraste já calibrado em DESIGN-TOKENS.md pra chip selecionado/em destaque)");
  assert(!/\n\.preparo-card__timer \{/.test(styleCss), "TESTE NEGATIVO: a regra CSS antiga .preparo-card__timer (mm:ss, só o passo atual) foi removida — sem CSS morto");
  assert(!renderBody.includes("preparo-card__timer"), "TESTE NEGATIVO: renderPreparosList não referencia mais .preparo-card__timer em lugar nenhum");

  console.log("");
  section("10", "NEGATIVOS gerais e SERVICE WORKER");
  const inputCount = (appJs.match(/document\.createElement\("input"\)/g) || []).length;
  assert(inputCount === 4, "TESTE NEGATIVO: esta fase não cria nenhum <input> novo em app.js — continua em 4 (mesmo invariante travado por verify-timer-tap-edit-2026-07-30.js)");
  assert(/const CACHE_NAME = "cardapio-v58";/.test(swJs), "CACHE_NAME v53 -> v54 -> v55 -> v56 -> v57 -> v58 (coleções abstratas de tempo/dificuldade ilustradas, 2026-07-31: mais um bump de feature externa, atualizado pro valor vigente; +v58 passada desktop tier largo 2026-08-05, css/style.css+js/app.js)");

  console.log("");
  console.log("==================================================");
  console.log("RESUMO POR SEÇÃO");
  console.log("==================================================");
  sectionOrder.forEach((key) => {
    const c = sectionCounts[key];
    console.log("  " + key + ": " + c.ok + " OK, " + c.fail + " FAIL");
  });
  const totalOk = sectionOrder.reduce((s, key) => s + sectionCounts[key].ok, 0);
  const totalFail = sectionOrder.reduce((s, key) => s + sectionCounts[key].fail, 0);
  console.log("TOTAL: " + totalOk + " OK, " + totalFail + " FAIL");

  if (failures > 0) {
    console.log("\n" + failures + " FALHA(S)");
    process.exit(1);
  } else {
    console.log("\nTODAS AS ASSERÇÕES PASSARAM");
  }
}

main();
