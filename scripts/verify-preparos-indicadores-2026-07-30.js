// scripts/verify-preparos-indicadores-2026-07-30.js
//
// Fase indicadores (2026-07-30, rodada 2 do multi-timer) — 3 entregas sobre o que a Fase
// multi-timer (ver scripts/verify-preparos-multitimer-2026-07-30.js) já deixou pronto:
// (1) sentinela global de conclusão (substitui polling: 1 setTimeout agendado pro MENOR endsAt
// entre TODOS os timers ativos de TODAS as sessões, independente de tela); (2) bolinha no ícone
// Preparos da barra inferior (regra DERIVADA do estado, sem flag nova); (3) toast de conclusão
// (1 linha, corpo clicável, substitui o anterior, nunca enfileira).
//
// Investigação prévia (relatório da tarefa): "Pronto!" hoje só é dispensado pelo MESMO × que já
// cancela um timer rodando (Storage.savePreparoStepTimer com running:false/endsAt:null) — não
// existe uma ação de "dispensar" separada nem um flag "acknowledged". getActiveStepTimers já
// filtra running && endsAt e calcula isDone (endsAt <= now); a bolinha reusa essa MESMA função
// (nunca reimplementa o cálculo de "terminou"). O modo cozinhar tem seu próprio sinal de zero
// (playBeep dentro do setInterval de startTicking), mas só enquanto a tela dele está aberta
// NAQUELE passo — por isso a sentinela precisa ser independente de tela. Todas as escritas de
// timer do modo cozinhar passam por 1 função (persistStepTimer) — ponto único de rearme.
//
// Técnicas: as 3 já estabelecidas (RELÓGIO INJETADO nas funções puras; execução REAL de
// storage.js sandboxado com localStorage falso; texto exato do código-fonte pro resto — wiring,
// template, whitelist) MAIS uma 4ª, nova nesta suíte: compileWithDeps injeta Storage/Router/
// bottomNavEl/showPreparoCompletionToast/setTimeout/clearTimeout/Date como PARÂMETROS de uma
// factory (em vez de depender de escopo léxico do eval, que não alcançaria variáveis locais de
// teste) — permite EXECUTAR DE VERDADE armCompletionSentinel/fireCompletionSentinel com um
// relógio e uma fila de timeouts 100% controlados pelo teste, sem esperar nenhum tempo real.
//
// `node scripts/verify-preparos-indicadores-2026-07-30.js` — sai com código != 0 se algo falhar.

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

// Mesma técnica de extractFunctionByName (verify-timer-tap-edit/verify-preparos-multitimer):
// casamento de chaves a partir do primeiro "{" após "function <nome>(" — robusto a mudança de
// assinatura, e a nesting (funciona igual pra função top-level ou aninhada, ex. persistStepTimer
// dentro de renderCookMode).
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

// Mesma técnica de compilePureFunction (verify-preparos-multitimer), generalizada: em vez de uma
// IIFE sem parâmetros (só serve pra função 100% pura, sem closure sobre nada externo), monta uma
// FACTORY que recebe as dependências externas (Storage, Router, bottomNavEl, ...) como
// PARÂMETROS de verdade. Necessário porque um eval() direto só enxerga o escopo léxico de ONDE
// ele está ESCRITO no código-fonte (dentro desta função, no nível do módulo) — nunca o escopo de
// quem CHAMA a função ao redor dele; sem isso não daria pra injetar um Storage/Router/relógio
// diferente por cenário. `preamble` cobre estado de módulo que não é função (ex. o
// `let completionSentinelTimeout = null;` que armCompletionSentinel fecha por cima).
function compileWithDeps(src, fnNames, depNames, preamble) {
  const bodies = fnNames.map((name) => extractFunctionByName(src, name));
  if (bodies.some((b) => !b)) return null;
  try {
    const wrapped =
      "(function (" + depNames.join(", ") + ") {\n" +
      (preamble || "") +
      bodies.join("\n") +
      "\nreturn { " + fnNames.join(", ") + " };\n" +
      "})";
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
function freshStorage() {
  return sandboxStorage(makeFakeLocalStorage());
}

// Fila de setTimeout/clearTimeout 100% falsa (nunca Node real) — permite provar "agenda pro
// menor endsAt" e "reagenda após disparo" disparando manualmente, sem esperar nenhum ms de
// verdade (determinístico, sem flakiness de timing real).
function makeFakeTimerQueue() {
  let nextId = 1;
  const scheduled = []; // [{id, delay}], ordem de chamada de setTimeout
  const callbacks = {};
  return {
    scheduled: scheduled,
    fakeSetTimeout: (cb, delay) => {
      const id = nextId++;
      scheduled.push({ id: id, delay: delay });
      callbacks[id] = cb;
      return id;
    },
    fakeClearTimeout: (id) => {
      const idx = scheduled.findIndex((s) => s.id === id);
      if (idx !== -1) scheduled.splice(idx, 1);
      delete callbacks[id];
    },
    fire: (id) => {
      const cb = callbacks[id];
      const idx = scheduled.findIndex((s) => s.id === id);
      if (idx !== -1) scheduled.splice(idx, 1);
      delete callbacks[id];
      if (cb) cb();
    },
  };
}
function makeFakeDate(initialNow) {
  let current = initialNow;
  return { now: () => current, set: (v) => { current = v; } };
}
function makeFakeRouter(initialName) {
  let name = initialName;
  return { current: () => ({ name: name }), setRoute: (n) => { name = n; } };
}
function makeFakeBottomNav() {
  const classes = new Set();
  const tab = {
    classList: {
      toggle: (cls, force) => {
        const on = force === undefined ? !classes.has(cls) : !!force;
        if (on) classes.add(cls);
        else classes.delete(cls);
        return on;
      },
      contains: (cls) => classes.has(cls),
    },
  };
  return {
    el: { querySelector: (sel) => (sel.indexOf('data-route="preparos"') !== -1 ? tab : null) },
    hasBadge: () => classes.has("has-badge"),
  };
}
function makeFakeToastRecorder() {
  const calls = [];
  return { fn: (doneTimer) => calls.push(doneTimer), calls: calls };
}

function main() {
  section("1", "MODELO — sem flag nova; regra da bolinha é DERIVADA do que getActiveStepTimers já calcula");
  assert(
    appJs.includes("function collectAllRunningTimers(now) {"),
    "collectAllRunningTimers existe"
  );
  assert(
    appJs.includes("getActiveStepTimers(session.stepTimers, now).forEach((t) => {"),
    "collectAllRunningTimers deriva de getActiveStepTimers (a mesma função da Fase multi-timer) — nunca recalcula running/endsAt/isDone por conta própria"
  );
  assert(
    !/isAcknowledged|dismissed\s*:|acknowledgedAt/.test(appJs),
    "TESTE NEGATIVO: nenhum flag novo de 'dispensado/reconhecido' foi introduzido — a investigação da tarefa confirmou que dispensar É cancelar (mesmo × de sempre)"
  );
  assert(
    storageJs.includes("const PREPARO_SCHEMA_VERSION = 1;"),
    "PREPARO_SCHEMA_VERSION continua 1 — esta fase não mudou o schema de gusta-preparos-v1"
  );

  console.log("");
  section("2", "FONTE PURA — collectAllRunningTimers/computeSentinelPlan, execução REAL com relógio injetado e Storage sandboxado");
  const pureFactory = compileWithDeps(
    appJs,
    ["getActiveStepTimers", "collectAllRunningTimers", "computeSentinelPlan"],
    ["Storage"]
  );
  assert(typeof pureFactory === "function", "getActiveStepTimers+collectAllRunningTimers+computeSentinelPlan encontradas, isoladas por casamento de chaves e compiladas de verdade (eval)");

  if (pureFactory) {
    const NOW = 1700000000000; // literal fixo — nunca Date.now() da máquina que roda o teste
    const St = freshStorage();
    St.startPreparoSession("bolo-de-fuba", 1);
    St.startPreparoSession("torta-de-limao", 1);
    St.savePreparoStepTimer("bolo-de-fuba", 0, { endsAt: NOW + 30000, remainingSeconds: 999, running: true, started: true }); // futuro, 30s
    St.savePreparoStepTimer("bolo-de-fuba", 2, { endsAt: NOW - 5000, remainingSeconds: 0, running: true, started: true }); // já vencido
    St.savePreparoStepTimer("torta-de-limao", 1, { endsAt: NOW + 90000, remainingSeconds: 999, running: true, started: true }); // futuro, 90s (o mais distante)
    St.savePreparoStepTimer("torta-de-limao", 3, { endsAt: null, remainingSeconds: 40, running: false, started: true }); // PAUSADO -> excluído

    const { collectAllRunningTimers, computeSentinelPlan } = pureFactory(St);
    const all = collectAllRunningTimers(NOW);
    assert(all.length === 3, "3 timers ATIVOS coletados através de 2 sessões DIFERENTES (o pausado da torta fica de fora) — obtido " + all.length);
    assert(all.some((t) => t.recipeId === "bolo-de-fuba" && t.stepIndex === 0) && all.some((t) => t.recipeId === "torta-de-limao" && t.stepIndex === 1), "cada timer carrega o recipeId da SUA sessão — a sentinela precisa saber de qual receita/passo é cada 1, não só o stepIndex isolado");

    const plan = computeSentinelPlan(NOW);
    assert(plan.done.length === 1 && plan.done[0].recipeId === "bolo-de-fuba" && plan.done[0].stepIndex === 2, "plan.done contém só o timer vencido (bolo-de-fuba passo 2) — obtido " + JSON.stringify(plan.done.map((t) => t.recipeId + "#" + t.stepIndex)));
    assert(plan.hasPending === true, "plan.hasPending true — existe >=1 Pronto! não dispensado");
    assert(plan.nextEndsAt === NOW + 30000, "plan.nextEndsAt é o MENOR endsAt FUTURO (30s do bolo, não os 90s da torta, e não o já vencido) — obtido " + (plan.nextEndsAt - NOW) + "ms");

    // TESTE NEGATIVO: sessão "concluido" com stepTimers residual não deveria nunca aparecer —
    // Storage.getActivePreparoSessions já filtra por status, e collectAllRunningTimers só itera
    // essa lista (nunca lê preparoState.sessions bruto), então herda a exclusão de graça.
    St.startPreparoSession("mousse", 1);
    St.savePreparoStepTimer("mousse", 0, { endsAt: NOW - 1000, remainingSeconds: 0, running: true, started: true });
    St.finishPreparoSession("mousse");
    const afterFinish = collectAllRunningTimers(NOW);
    assert(afterFinish.length === 3, "TESTE NEGATIVO: sessão 'concluido' (mousse) com timer residual não entra na coleta mesmo tendo um timer 'running:true' esquecido — continua 3, não 4");

    assert(computeSentinelPlan(NOW).nextEndsAt === computeSentinelPlan(NOW).nextEndsAt, "TESTE DE ESTABILIDADE: 2 chamadas com o MESMO now dão o MESMO nextEndsAt");
  }

  console.log("");
  section("3", "SENTINELA DINÂMICA — agenda pro MENOR endsAt, dispara na hora certa, reagenda após disparo (execução REAL, setTimeout/Date falsos)");
  assert(appJs.includes("let completionSentinelTimeout = null;"), "estado de módulo completionSentinelTimeout existe (preamble desta suíte reconstrói a MESMA declaração)");
  assert(appJs.includes("let completionSentinelLastProcessedAt = null;"), "estado de módulo completionSentinelLastProcessedAt existe — marca d'água que distingue 'recém-vencido' (toast) de 'vencido e ainda de pé' (bolinha, que quer TODOS)");
  const dynFactory = compileWithDeps(
    appJs,
    ["getActiveStepTimers", "collectAllRunningTimers", "computeSentinelPlan", "updatePreparosNavBadge", "armCompletionSentinel", "fireCompletionSentinel"],
    ["Storage", "Router", "bottomNavEl", "showPreparoCompletionToast", "setTimeout", "clearTimeout", "Date"],
    "let completionSentinelTimeout = null;\nlet completionSentinelLastProcessedAt = null;\n"
  );
  assert(typeof dynFactory === "function", "armCompletionSentinel+fireCompletionSentinel (+ cadeia inteira de dependências) encontradas, isoladas e compiladas de verdade (eval)");

  if (dynFactory) {
    const BASE = 1700000000000;
    const St = freshStorage();
    St.startPreparoSession("bolo-de-fuba", 1);
    St.startPreparoSession("torta-de-limao", 1);
    St.savePreparoStepTimer("bolo-de-fuba", 0, { endsAt: BASE + 30000, remainingSeconds: 999, running: true, started: true }); // A: 30s
    St.savePreparoStepTimer("torta-de-limao", 1, { endsAt: BASE + 90000, remainingSeconds: 999, running: true, started: true }); // B: 90s

    const clock = makeFakeDate(BASE);
    const queue = makeFakeTimerQueue();
    const nav = makeFakeBottomNav();
    const toastRec = makeFakeToastRecorder();
    const router = makeFakeRouter("home"); // tela atual != Preparos, toast deve aparecer

    const api = dynFactory(St, router, nav.el, toastRec.fn, queue.fakeSetTimeout, queue.fakeClearTimeout, clock);

    api.armCompletionSentinel();
    assert(queue.scheduled.length === 1, "1º arme agenda exatamente 1 setTimeout — obtido " + queue.scheduled.length);
    assert(queue.scheduled[0] && queue.scheduled[0].delay === 30000, "agenda pro MENOR endsAt (A, 30s) e NÃO pro B (90s) — obtido " + (queue.scheduled[0] && queue.scheduled[0].delay) + "ms");
    assert(nav.hasBadge() === false, "bolinha apagada antes de qualquer timer vencer");
    assert(toastRec.calls.length === 0, "nenhum toast dado nenhum timer ter vencido ainda");

    // Dispara EXATAMENTE na hora certa: avança o relógio falso pro endsAt de A e simula o
    // setTimeout real disparando (fire manual, sem esperar 30000ms de verdade).
    clock.set(BASE + 30000);
    const idA = queue.scheduled[0].id;
    queue.fire(idA);
    assert(toastRec.calls.length === 1 && toastRec.calls[0].recipeId === "bolo-de-fuba" && toastRec.calls[0].stepIndex === 0, "CENÁRIO 'zera com app aberto em outra tela': ao vencer, mostra toast pro timer certo (bolo-de-fuba passo 0) — tela atual era 'home', não 'preparos'");
    assert(nav.hasBadge() === true, "bolinha acende assim que A vence (Pronto! ainda não dispensado)");
    assert(queue.scheduled.length === 1, "REAGENDA pro próximo (B) logo após processar A — obtido " + queue.scheduled.length + " timeout(s) agendado(s)");
    assert(queue.scheduled[0].delay === 60000, "novo delay é o RESTANTE até B (90s - 30s já passados = 60s), não os 90s originais — obtido " + queue.scheduled[0].delay + "ms");

    // 2º disparo: avança pro endsAt de B.
    clock.set(BASE + 90000);
    const idB = queue.scheduled[0].id;
    queue.fire(idB);
    assert(toastRec.calls.length === 2 && toastRec.calls[1].recipeId === "torta-de-limao" && toastRec.calls[1].stepIndex === 1, "2º disparo mostra o toast de B (torta-de-limao passo 1)");
    assert(queue.scheduled.length === 0, "nada mais pendente no futuro -> NÃO agenda um 3º timeout órfão (early-return de computeSentinelPlan.nextEndsAt === null)");
    assert(nav.hasBadge() === true, "bolinha continua acesa: A e B venceram, nenhum dos 2 foi dispensado ainda");

    // CENÁRIO 'a tela atual É Preparos': novo timer, mesmo mecanismo, mas sem toast.
    router.setRoute("preparos");
    St.savePreparoStepTimer("bolo-de-fuba", 5, { endsAt: BASE + 95000, remainingSeconds: 999, running: true, started: true });
    api.armCompletionSentinel();
    clock.set(BASE + 95000);
    queue.fire(queue.scheduled[0].id);
    assert(toastRec.calls.length === 2, "TESTE NEGATIVO: com a tela atual = Preparos, o 3º timer vencer NÃO mostra toast (os chips já comunicam) — contagem de chamadas continua 2");
    assert(nav.hasBadge() === true, "bolinha continua correta independente da tela atual — ela não é suprimida em Preparos, só o toast");
    router.setRoute("home");

    // CENÁRIOS 'dispensa parcial' / 'dispensa total' (dot cai pro estado real após cada ×).
    St.savePreparoStepTimer("bolo-de-fuba", 0, { endsAt: null, remainingSeconds: 0, running: false, started: false }); // dispensa A
    api.armCompletionSentinel();
    assert(nav.hasBadge() === true, "CENÁRIO 'dispensa parcial mantém acesa': dispensar só A (2 de 3 Prontos ainda de pé: torta#1 e bolo#5) mantém a bolinha acesa");
    St.savePreparoStepTimer("torta-de-limao", 1, { endsAt: null, remainingSeconds: 0, running: false, started: false }); // dispensa B
    api.armCompletionSentinel();
    assert(nav.hasBadge() === true, "dispensar B (2 de 3) ainda mantém acesa — falta bolo#5");
    St.savePreparoStepTimer("bolo-de-fuba", 5, { endsAt: null, remainingSeconds: 0, running: false, started: false }); // dispensa o 3º e último
    api.armCompletionSentinel();
    assert(nav.hasBadge() === false, "CENÁRIO 'dispensa total apaga': dispensado o ÚLTIMO Pronto! pendente, a bolinha apaga");
  }

  console.log("");
  section("4", "BOLINHA NO BOOT — timer que venceu com o app fechado acende a bolinha, SEM toast retroativo");
  if (dynFactory) {
    const BASE = 1800000000000;
    const St = freshStorage();
    St.startPreparoSession("risoto", 1);
    St.savePreparoStepTimer("risoto", 0, { endsAt: BASE - 3600000, remainingSeconds: 0, running: true, started: true }); // venceu 1h "atrás" (app fechado)

    const clock = makeFakeDate(BASE);
    const queue = makeFakeTimerQueue();
    const nav = makeFakeBottomNav();
    const toastRec = makeFakeToastRecorder();
    const router = makeFakeRouter("home");
    const api = dynFactory(St, router, nav.el, toastRec.fn, queue.fakeSetTimeout, queue.fakeClearTimeout, clock);

    api.armCompletionSentinel(); // simula a chamada de boot (Inicialização, fim do arquivo)
    assert(nav.hasBadge() === true, "CENÁRIO 'zera com app fechado e boot': bolinha já acende no PRIMEIRO arme, sem precisar disparar nada");
    assert(toastRec.calls.length === 0, "TESTE NEGATIVO: nenhum toast retroativo pro que já tinha vencido antes do boot — só a bolinha comunica isso");
    assert(queue.scheduled.length === 0, "nada FUTURO pra agendar (o único timer já venceu) — nenhum setTimeout órfão criado no boot");
  }

  console.log("");
  section("5", "TOAST DE CONCLUSÃO — texto exato, corpo clicável com deep-link, substitui o anterior, auto-dismiss ~8s");
  assert(appJs.includes("function showPreparoCompletionToast(doneTimer) {"), "showPreparoCompletionToast existe");
  const toastBody = extractFunctionByName(appJs, "showPreparoCompletionToast");
  assert(!!toastBody, "corpo de showPreparoCompletionToast extraído por casamento de chaves");
  if (toastBody) {
    assert(toastBody.includes("if (!recipeItem) return;"), "guarda defensiva: receita renomeada/removida entre o agendamento e o disparo não quebra nem mostra toast quebrado");
    assert(toastBody.includes('toast.className = "update-toast preparo-completion-toast";'), "toast usa as 2 classes: update-toast (visual de graça) + preparo-completion-toast (marcador/whitelist)");
    assert(toastBody.includes("Pronto: ") && toastBody.includes(" · Passo "), 'texto é "Pronto: <Receita> · Passo N" — 1 linha seca, sem prosa');
    assert(/class="preparo-completion-toast__body"/.test(toastBody), "corpo do toast é 1 <button> próprio (preparo-completion-toast__body), não um <span> só de leitura");
    const idxReplace = toastBody.indexOf("if (preparoCompletionToastEl) {");
    const idxAppend = toastBody.indexOf("document.body.appendChild(toast);");
    assert(idxReplace !== -1 && idxAppend !== -1 && idxReplace < idxAppend, "SUBSTITUIÇÃO: remove o toast anterior (se existir) ANTES de criar o novo — nunca enfileira/empilha 2 ao mesmo tempo");
    const idxSaveStep = toastBody.indexOf("Storage.savePreparoStep(recipeId, stepIndex);");
    const idxNavigate = toastBody.indexOf('Router.toCozinhar(recipeId, "preparos");');
    assert(idxSaveStep !== -1 && idxNavigate !== -1 && idxSaveStep < idxNavigate, "DEEP-LINK: grava o passo ALVO (savePreparoStep) ANTES de navegar — mesma ordem/mesmo destino do chip da Fase multi-timer, senão renderCookMode abriria no passo errado");
    assert(
      /setTimeout\(\(\) => \{\s*\n\s*toast\.remove\(\);\s*\n\s*preparoCompletionToastEl = null;\s*\n\s*\}, 8000\);/.test(toastBody),
      "auto-dismiss em 8000ms (~8s, diferente dos 6s do toast de desfazer — valor pedido nesta fase) e limpa a referência do módulo ao remover"
    );
  }
  assert(
    /#bottom-nav, #category-header, #recipes-content, \.filter-modal-overlay, \.update-toast, \.sort-sheet-overlay, \.shopping-undo-toast, \.preparo-timer-undo-toast, \.preparo-completion-toast \{ pointer-events: auto; \}/.test(styleCss),
    ".preparo-completion-toast entrou na whitelist de pointer-events do body, como última classe da linha — sem isso o toast novo renderiza mas fica com clique morto (mesma causa raiz já documentada pra .preparo-timer-undo-toast/.shopping-undo-toast/.filter-modal-overlay)"
  );
  assert(
    styleCss.includes(".preparo-completion-toast__body {") && styleCss.includes("flex: 1;"),
    ".preparo-completion-toast__body tem regra visual própria (ocupa o corpo inteiro do toast, já que não há um botão de ação separado como no toast de desfazer)"
  );

  console.log("");
  section("6", "WIRING — rearme nos 4 gatilhos da tarefa (iniciar/cancelar/desfazer/dispensar) + boot");
  const persistBody = extractFunctionByName(appJs, "persistStepTimer");
  assert(!!persistBody, "persistStepTimer extraído");
  if (persistBody) {
    assert(persistBody.includes("Storage.savePreparoStepTimer(id, stepIndex, merged);"), "TESTE DE REGRESSÃO: a escrita original de persistStepTimer continua intacta — esta fase só ACRESCENTA, nunca substitui");
    const idxSave = persistBody.indexOf("Storage.savePreparoStepTimer(id, stepIndex, merged);");
    const idxArm = persistBody.indexOf("armCompletionSentinel();");
    assert(idxSave !== -1 && idxArm !== -1 && idxSave < idxArm, "iniciar/pausar/continuar/zerar/editar/auto-completar no modo cozinhar passam TODOS por persistStepTimer -> 1 hook cobre todo mutador de timer de lá, rearmado DEPOIS de persistir");
  }

  const renderPreparosBody = extractFunctionByName(appJs, "renderPreparosList");
  assert(!!renderPreparosBody, "renderPreparosList extraído");
  if (renderPreparosBody) {
    const idxCancelSave = renderPreparosBody.indexOf("Storage.savePreparoStepTimer(session.recipeId, stepIndex, {");
    const idxCancelArm = renderPreparosBody.indexOf("armCompletionSentinel();", idxCancelSave);
    const idxCancelUndo = renderPreparosBody.indexOf("showPreparoTimerUndoToast(session.recipeId, stepIndex, snapshot)", idxCancelArm);
    assert(idxCancelSave !== -1 && idxCancelArm !== -1 && idxCancelUndo !== -1 && idxCancelSave < idxCancelArm && idxCancelArm < idxCancelUndo, "× do chip (mesmo caminho que dispensa um Pronto!) rearma ANTES de re-renderizar a lista/mostrar o toast de desfazer");

    const idxDeleteSave = renderPreparosBody.indexOf("Storage.deletePreparoSession(session.recipeId);");
    const idxDeleteArm = renderPreparosBody.indexOf("armCompletionSentinel();", idxDeleteSave);
    assert(idxDeleteSave !== -1 && idxDeleteArm !== -1 && idxDeleteSave < idxDeleteArm, "excluir a sessão inteira (lixeira do card) também rearma — não é 1 dos 4 gatilhos nomeados na tarefa, extensão deliberada pra regra derivada continuar correta (ver comentário no código)");
  }

  const undoBody = extractFunctionByName(appJs, "showPreparoTimerUndoToast");
  assert(!!undoBody, "showPreparoTimerUndoToast extraído");
  if (undoBody) {
    const idxUndoSave = undoBody.indexOf("Storage.savePreparoStepTimer(recipeId, stepIndex, originalState);");
    const idxUndoArm = undoBody.indexOf("armCompletionSentinel();");
    const idxUndoRender = undoBody.indexOf('if (Router.current().name === "preparos") renderPreparosList();');
    assert(idxUndoSave !== -1 && idxUndoArm !== -1 && idxUndoRender !== -1 && idxUndoSave < idxUndoArm && idxUndoArm < idxUndoRender, "Desfazer rearma logo após restaurar o originalState, antes do re-render condicional");
  }

  // lastIndexOf: existem 6 chamadas a armCompletionSentinel() no arquivo (ver seção 8) — a do
  // boot é a ÚLTIMA textualmente (fim do arquivo, dentro de Inicialização). CRLF-safe: não
  // depende de casar a quebra de linha exata entre as 2 chamadas anteriores.
  const idxBootArm = appJs.lastIndexOf("armCompletionSentinel();");
  const bootWindow = appJs.slice(Math.max(0, idxBootArm - 700), idxBootArm);
  assert(
    bootWindow.includes("renderBottomNav();") && bootWindow.includes("handleRoute(Router.current());"),
    "boot chama renderBottomNav() + handleRoute(...) pouco antes do armCompletionSentinel() final (a bolinha precisa do botão de Preparos já no DOM pra achar seu alvo)"
  );

  console.log("");
  section("7", "BOTTOM-NAV — bolinha só na aba Preparos, ancorada no ícone (não no botão inteiro)");
  const navBody = extractFunctionByName(appJs, "renderBottomNav");
  assert(!!navBody, "renderBottomNav extraído");
  if (navBody) {
    assert(navBody.includes('tab.id === "preparos"'), 'template ramifica só pra tab.id === "preparos" — as outras 4 abas (Home/Pesquisar/Minhas Receitas/Lista de Compras) continuam com o mesmo <ícone solto> de sempre');
    assert(navBody.includes('<span class="bottom-nav__icon-wrap">') && navBody.includes('<span class="bottom-nav__badge" aria-hidden="true"></span>'), "wrapper .bottom-nav__icon-wrap + .bottom-nav__badge (aria-hidden, é decorativo) só aparecem dentro do ramo condicional");
  }
  assert(styleCss.includes(".bottom-nav__icon-wrap { position: relative; display: inline-flex; }"), "wrapper do ícone vira âncora de posicionamento (position: relative) pro badge absoluto");
  assert(/\.bottom-nav__badge\s*\{[^}]*display:\s*none;/.test(styleCss), "bolinha some por padrão (display: none)");
  assert(/\.bottom-nav__tab\.has-badge \.bottom-nav__badge\s*\{\s*display:\s*block;\s*\}/.test(styleCss), "só aparece quando o BOTÃO da aba tem a classe has-badge (mesmo mecanismo de toggle que .is-active já usa via updateBottomNav, nunca reconstrução de innerHTML)");
  assert(/\.bottom-nav__badge\s*\{[^}]*width:\s*8px;[^}]*height:\s*8px;/.test(styleCss), "bolinha é um PONTO PEQUENO (8px) — bem menor que os 20px de .filter-trigger__badge/.sort-trigger__badge (que ficam ao lado de texto, não sobre um ícone de 22px)");
  assert(/\.bottom-nav__badge\s*\{[^}]*background:\s*var\(--color-accent-deep\);/.test(styleCss), "mesma cor (--color-accent-deep) dos badges de Filtros/Ordenar — mesma linguagem visual, escala reduzida");

  console.log("");
  section("8", "NEGATIVOS gerais — sem Notification API, sem <input> novo, modo cozinhar e chips da rodada 1 só ganharam os hooks pedidos");
  assert(!/\bNotification\s*\(/.test(appJs) && !appJs.includes(".showNotification("), "TESTE NEGATIVO: nenhuma Notification API / notificação de SO foi introduzida — decisão registrada de ficar in-app only");
  const inputCount = (appJs.match(/document\.createElement\("input"\)/g) || []).length;
  assert(inputCount === 4, "TESTE NEGATIVO: esta fase não cria nenhum <input> novo (o toast usa <button>) — continua em 4, mesmo invariante travado desde a Fase timer-tap-edit");
  assert(
    (appJs.match(/armCompletionSentinel\(\);/g) || []).length === 6,
    "exatamente 6 chamadas a armCompletionSentinel() no arquivo: os 4 gatilhos de mutação (persistStepTimer, × do chip, excluir sessão, Desfazer) + o auto-reagendamento dentro de fireCompletionSentinel + o boot — obtido " + ((appJs.match(/armCompletionSentinel\(\);/g) || []).length)
  );

  console.log("");
  section("9", "SERVICE WORKER");
  assert(/const CACHE_NAME = "cardapio-v56";/.test(swJs), "CACHE_NAME v54 -> v55 -> v56 (hotfix timer-lifecycle 2026-07-31: mais um bump de feature externa — modo cozinhar, não Preparos — atualizado pro valor vigente)");

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
