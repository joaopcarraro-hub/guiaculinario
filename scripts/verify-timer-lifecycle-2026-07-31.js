// scripts/verify-timer-lifecycle-2026-07-31.js
//
// HOTFIX de produção, 2026-07-31 — 2 bugs reais reportados pelo dono em uso ao vivo no ciclo de
// vida do timer do modo cozinhar:
//
// BUG 1 (causa-raiz já diagnosticada) — TICKER ÓRFÃO: startTicking (setInterval) não era limpo
// ao sair da tela via barra inferior (só Sair/nome da receita/Cancelar/Pausar/Zerar limpavam,
// nunca a navegação genérica) — mesma classe de bug já documentada como pré-existente/fora de
// escopo em verify-preparos-indicadores-2026-07-30.js. Ao chegar no zero enquanto órfão, o
// interval persistia running:false/endsAt:null por conta própria — apagando o "Pronto!" que
// getActiveStepTimers/computeSentinelPlan (e por extensão a bolinha de Preparos + os chips)
// dependiam pra continuar acesos. O toast global escapava (a sentinela dispara antes, num
// setTimeout preciso), mas o estado persistido que a bolinha/chips leem era apagado logo depois.
// FIX: timerInterval promovido de variável local (dentro de renderCookMode) pra escopo de
// módulo, parado incondicionalmente no topo de handleRoute — MESMO padrão já usado por
// preparosTickInterval (Fase multi-timer, 2026-07-30).
//
// BUG 2 — ESTADO DE ZERO NO MODO COZINHAR: ao concluir NA PRÓPRIA TELA, o timer mostrava zero
// com o par Continuar/Cancelar em pé, e "Continuar" era um no-op silencioso (currentRemainingSeconds()
// já é 0, e o branch antigo só fazia `if (secs <= 0) return;`). FIX (design fechado): conclusão ao
// vivo NUNCA oferece Continuar — beep (existente) + marca breve "Pronto!" no mostrador + volta
// sozinho pro estado PARADO (roleta), pronto pra um novo timer. Guarda extra: qualquer caminho que
// caia em "Continuar" com 0 restante agora reseta pro parado, nunca mais um no-op silencioso.
//
// Técnicas: as já estabelecidas neste projeto (extractFunctionByName por casamento de chaves,
// compileWithDeps — factory com dependências como parâmetros, ver verify-preparos-indicadores) —
// relógio/setInterval/setTimeout 100% falsos, sem esperar nenhum ms de verdade, sem depender de
// ref de git (literais fixos, nunca HEAD).
//
// `node scripts/verify-timer-lifecycle-2026-07-31.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
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

// Mesma técnica de extractFunctionByName (verify-timer-tap-edit/verify-preparos-multitimer/
// verify-preparos-indicadores): casamento de chaves a partir do primeiro "{" após
// "function <nome>(" — robusto a nesting (funciona igual pra função top-level ou aninhada).
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

// Mesma técnica de compileWithDeps (verify-preparos-indicadores): factory recebe as dependências
// externas como PARÂMETROS de verdade (currentRemainingSeconds/persistStepTimer/playBeep/
// renderTimer/timerBox/setInterval/clearInterval/setTimeout) — necessário porque startTicking e
// renderTimerJustFinished são funções ANINHADAS dentro de renderCookMode, fechando sobre estado
// que só existe ali (timerInterval vira `preamble`, mesmo tratamento que completionSentinelTimeout
// recebeu na suíte anterior).
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

// Fila 100% falsa de setInterval/setTimeout — dispara manualmente, sem esperar nenhum ms real.
function makeFakeIntervalQueue() {
  let nextId = 1;
  const intervals = {};
  const timeouts = {};
  let lastIntervalId = null;
  let lastTimeoutId = null;
  return {
    setInterval: (cb) => {
      const id = nextId++;
      intervals[id] = cb;
      lastIntervalId = id;
      return id;
    },
    clearInterval: (id) => {
      delete intervals[id];
    },
    setTimeout: (cb, delay) => {
      const id = nextId++;
      timeouts[id] = { cb: cb, delay: delay };
      lastTimeoutId = id;
      return id;
    },
    clearTimeout: (id) => {
      delete timeouts[id];
    },
    fireLastInterval: () => {
      const cb = intervals[lastIntervalId];
      if (cb) cb();
    },
    fireLastTimeout: () => {
      const entry = timeouts[lastTimeoutId];
      if (entry) entry.cb();
    },
    lastTimeoutDelay: () => (timeouts[lastTimeoutId] ? timeouts[lastTimeoutId].delay : null),
    intervalCount: () => Object.keys(intervals).length,
    timeoutCount: () => Object.keys(timeouts).length,
  };
}
function makeRecorder() {
  const calls = [];
  const fn = function () {
    calls.push(Array.prototype.slice.call(arguments));
  };
  fn.calls = calls;
  return fn;
}
function makeFakeTimerBox() {
  const box = { _html: "", isConnected: true };
  Object.defineProperty(box, "innerHTML", {
    get: function () {
      return this._html;
    },
    set: function (v) {
      this._html = v;
    },
  });
  return box;
}

function main() {
  section("1", "CAUSA-RAIZ 1 — timerInterval promovido a escopo de módulo, parado incondicionalmente em handleRoute");
  const cookModeBody = extractFunctionByName(appJs, "renderCookMode");
  assert(!!cookModeBody, "renderCookMode encontrada e isolada por casamento de chaves");
  if (cookModeBody) {
    assert(
      !cookModeBody.includes("let timerInterval"),
      "renderCookMode NÃO redeclara timerInterval localmente — a variável agora é de módulo (mesmo padrão de preparosTickInterval), senão a promoção não teria efeito nenhum"
    );
  }
  const idxModuleDecl = appJs.indexOf("let timerInterval = null;");
  const idxRenderCookModeFn = appJs.indexOf("function renderCookMode(");
  assert(
    idxModuleDecl !== -1 && idxRenderCookModeFn !== -1 && idxModuleDecl < idxRenderCookModeFn,
    "let timerInterval = null; declarado em escopo de MÓDULO, ANTES de renderCookMode (mesma posição relativa de preparosTickInterval, que fica antes de todo o resto que o usa)"
  );

  const handleRouteBody = extractFunctionByName(appJs, "handleRoute");
  assert(!!handleRouteBody, "handleRoute encontrada e isolada por casamento de chaves");
  if (handleRouteBody) {
    assert(
      handleRouteBody.includes("clearInterval(timerInterval);") && handleRouteBody.includes("timerInterval = null;"),
      "handleRoute para o ticker do modo cozinhar incondicionalmente (clearInterval + reset da referência)"
    );
    const idxClear = handleRouteBody.indexOf("clearInterval(timerInterval);");
    const idxDispatch = handleRouteBody.indexOf('if (route.name === "busca")');
    assert(
      idxClear !== -1 && idxDispatch !== -1 && idxClear < idxDispatch,
      "ORDEM (indexOf): parado ANTES de decidir a rota nova — mesma ordem/mesmo princípio de preparosTickInterval logo acima, nunca dentro de um ramo condicional específico"
    );
    const idxPreparosClear = handleRouteBody.indexOf("clearInterval(preparosTickInterval);");
    assert(
      idxPreparosClear !== -1 && idxPreparosClear < idxClear,
      "a parada do ticker de cozinhar vem logo DEPOIS da de preparosTickInterval (mesmo bloco/mesma seção de handleRoute, não espalhado)"
    );
  }

  console.log("");
  section("2", "MECANISMO — por que o ticker órfão apagava a bolinha/chips (getActiveStepTimers, já pura e testada)");
  const activeFactory = (function () {
    const body = extractFunctionByName(appJs, "getActiveStepTimers");
    if (!body) return null;
    try {
      // eslint-disable-next-line no-eval
      return eval("(function () {\n" + body + "\nreturn getActiveStepTimers;\n})")();
    } catch (e) {
      console.log("  ERRO ao compilar getActiveStepTimers: " + e.message);
      return null;
    }
  })();
  assert(typeof activeFactory === "function", "getActiveStepTimers isolada e compilada de verdade (eval) — mesma função pura que a bolinha/chips de Preparos já usam, nenhuma reimplementação nova");
  if (activeFactory) {
    const NOW = 1700000000000;
    const stillActive = activeFactory({ 0: { endsAt: NOW - 5000, remainingSeconds: 0, running: true, started: true } }, NOW);
    assert(stillActive.length === 1 && stillActive[0].isDone === true, "timer vencido mas AINDA running:true (comportamento correto quando o ticker NÃO chega a rodar órfão) continua reportado como Pronto! — é isso que alimenta a bolinha/chips");
    const erased = activeFactory({ 0: { endsAt: null, remainingSeconds: 0, running: false, started: false } }, NOW);
    assert(
      erased.length === 0,
      "TESTE DE MECANISMO: exatamente o payload que o ticker ÓRFÃO persistia (running:false/endsAt:null) some da lista de ativos — é ISSO que apagava a bolinha/chips antes do fix da Seção 1 impedir o órfão de sequer existir"
    );
  }

  console.log("");
  section("3", "BUG 2 — conclusão ao vivo: beep + marca breve \"Pronto!\" + started:false + volta ao PARADO (nunca Continuar/Cancelar)");
  const factory = compileWithDeps(
    appJs,
    ["startTicking", "renderTimerJustFinished"],
    ["currentRemainingSeconds", "persistStepTimer", "playBeep", "updateTimerDisplay", "renderTimer", "timerBox", "setInterval", "clearInterval", "setTimeout"],
    "let timerInterval = null;\n"
  );
  assert(typeof factory === "function", "startTicking + renderTimerJustFinished (NOVA) encontradas, isoladas e compiladas de verdade (eval)");

  if (factory) {
    const queue = makeFakeIntervalQueue();
    let remaining = 10;
    const currentRemainingSeconds = function () {
      return remaining;
    };
    const persistStepTimer = makeRecorder();
    const playBeep = makeRecorder();
    const updateTimerDisplay = makeRecorder();
    const renderTimer = makeRecorder();
    const timerBox = makeFakeTimerBox();

    const api = factory(
      currentRemainingSeconds,
      persistStepTimer,
      playBeep,
      updateTimerDisplay,
      renderTimer,
      timerBox,
      queue.setInterval,
      queue.clearInterval,
      queue.setTimeout
    );

    api.startTicking();
    assert(queue.intervalCount() === 1, "startTicking arma exatamente 1 interval");

    remaining = 5;
    queue.fireLastInterval();
    assert(
      persistStepTimer.calls.length === 0 && playBeep.calls.length === 0 && updateTimerDisplay.calls.length === 1,
      "tick NORMAL (ainda contando, 5s restantes): só atualiza o mostrador — não persiste, não beepa, não conclui"
    );
    assert(queue.intervalCount() === 1, "interval continua vivo após um tick normal");

    remaining = 0;
    queue.fireLastInterval();
    assert(queue.intervalCount() === 0, "ao chegar em 0, o interval se auto-limpa (clearInterval dentro do próprio callback)");
    assert(playBeep.calls.length === 1, "beep toca na conclusão — comportamento EXISTENTE, preservado");
    assert(
      persistStepTimer.calls.length === 1 &&
        JSON.stringify(persistStepTimer.calls[0][0]) === JSON.stringify({ endsAt: null, remainingSeconds: 0, running: false, started: false }),
      "FIX: conclusão persiste started:false (além de running:false/endsAt:null, que já existiam) — sem started:false, renderTimer() cairia no ramo RODANDO/PAUSADO de novo, nunca no PARADO — obtido " +
        JSON.stringify(persistStepTimer.calls[0] && persistStepTimer.calls[0][0])
    );
    assert(
      updateTimerDisplay.calls.length === 1,
      "TESTE NEGATIVO: updateTimerDisplay NÃO roda de novo no tick de conclusão (contagem ficou só o 1 do tick normal anterior) — o caminho de conclusão usa renderTimerJustFinished, não o patch genérico de texto"
    );
    assert(timerBox.innerHTML.includes("Pronto!"), 'renderTimerJustFinished marca a conclusão no mostrador ("Pronto!", mesma palavra já usada pelo chip de Preparos — .preparo-timer-chip.is-done)');
    assert(
      !/Continuar|Cancelar|timer-toggle|timer-cancel/.test(timerBox.innerHTML),
      "TESTE NEGATIVO — BUG 2: a marca de conclusão NUNCA inclui o par Continuar/Cancelar (nem os botões, nem os textos) — acabou o estado 'zerado com botões mortos' que o dono reportou"
    );
    assert(renderTimer.calls.length === 0, "renderTimer ainda NÃO foi chamado nesse instante — a marca é BREVE, a transição pro PARADO é DIFERIDA (setTimeout), nunca instantânea");
    assert(queue.timeoutCount() === 1, "exatamente 1 setTimeout agendado pra transição diferida pro PARADO");

    queue.fireLastTimeout();
    assert(renderTimer.calls.length === 1, "após o setTimeout disparar, renderTimer() finalmente roda — com started:false já persistido, cai no ramo PARADO (roleta) — pronto pra iniciar um novo timer, nunca um 'continuar' morto");
  }

  console.log("");
  section("4", "GUARDA DE DESCONEXÃO — transição diferida não chama renderTimer se timerBox já saiu do DOM (mesmo princípio de isConnected do settle, ver verify-timer-tap-edit)");
  if (factory) {
    const queue2 = makeFakeIntervalQueue();
    const remaining2 = 0; // nasce já zerado nesta rodada
    const renderTimer2 = makeRecorder();
    const timerBox2 = makeFakeTimerBox();
    const api2 = factory(
      function () {
        return remaining2;
      },
      makeRecorder(),
      makeRecorder(),
      makeRecorder(),
      renderTimer2,
      timerBox2,
      queue2.setInterval,
      queue2.clearInterval,
      queue2.setTimeout
    );
    api2.startTicking();
    queue2.fireLastInterval(); // conclui na hora (tick único, já nasce com 0 restante)
    timerBox2.isConnected = false; // simula navegação embora ANTES do setTimeout de 1500ms disparar
    queue2.fireLastTimeout();
    assert(
      renderTimer2.calls.length === 0,
      "TESTE NEGATIVO: com timerBox desconectado, o setTimeout diferido NÃO chama renderTimer() — mesma guarda defensiva já usada em bindColumnScroll/settle (verify-timer-tap-edit) pra elemento desanexado"
    );
  }

  console.log("");
  section("5", "GUARDA \"CONTINUAR\" — nenhum caminho com 0 restante vira no-op silencioso (renderTimerActive)");
  const activeBody = extractFunctionByName(appJs, "renderTimerActive");
  assert(!!activeBody, "renderTimerActive encontrada e isolada por casamento de chaves");
  if (activeBody) {
    assert(
      !/if \(secs <= 0\) return;/.test(activeBody),
      "TESTE NEGATIVO — BUG 2: o branch Continuar não retorna mais silenciosamente (no-op) quando secs<=0 — guarda antiga removida"
    );
    const idxGuard = activeBody.search(/if \(secs <= 0\) \{/);
    assert(idxGuard !== -1, "branch Continuar ganha um bloco condicional pra secs<=0 (reseta, em vez de só ignorar)");
    const guardWindow = idxGuard !== -1 ? activeBody.slice(idxGuard, idxGuard + 600) : "";
    assert(
      /running:\s*false,\s*started:\s*false/.test(guardWindow) && guardWindow.includes("renderTimer();"),
      "guarda reseta pro estado PARADO (running:false, started:false) e chama renderTimer() — nunca um no-op silencioso, mesmo resultado da conclusão ao vivo normal"
    );
  }

  console.log("");
  section("6", "CSS — marca de conclusão reusa a MESMA linguagem visual do chip de Preparos (--color-accent-deep)");
  assert(styleCss.includes(".cook-timer-display--done"), ".cook-timer-display--done existe em css/style.css");
  const doneRuleMatch = styleCss.match(/\.cook-timer-display--done\s*\{([^}]*)\}/);
  const doneRuleBody = doneRuleMatch ? doneRuleMatch[1] : "";
  assert(
    /background:\s*var\(--color-accent-deep\)/.test(doneRuleBody),
    "fundo --color-accent-deep — MESMO token que .preparo-timer-chip.is-done já usa pro estado Pronto!, nenhuma cor nova inventada"
  );

  console.log("");
  section("7", "NEGATIVOS gerais — nenhum <input> novo, as 5 funções/assinaturas travadas por verify-timer-tap-edit continuam intactas");
  const inputCount = (appJs.match(/document\.createElement\("input"\)/g) || []).length;
  assert(inputCount === 4, "TESTE NEGATIVO: document.createElement(\"input\") continua em EXATAMENTE 4 — este hotfix não cria nenhum <input> novo (obtido " + inputCount + ")");

  const lockedFns = ["enableDisplayTapToEdit", "positionWheelColumn", "bindColumnScroll", "updateTimerDisplay", "renderTimerStopped"];
  lockedFns.forEach((name) => {
    assert(!!extractFunctionByName(appJs, name), name + " continua existindo e extraível — travada por verify-timer-tap-edit-2026-07-30.js, este hotfix não a toca");
  });
  const sigMatch = appJs.match(/function enableDisplayTapToEdit\(([^)]*)\)/);
  const sigParams = (sigMatch ? sigMatch[1] : "").split(",").map((p) => p.trim()).filter(Boolean);
  assert(
    sigParams.length === 5 && sigParams[4] === "onCommitValue",
    "TESTE NEGATIVO: assinatura de enableDisplayTapToEdit continua com 5 parâmetros terminando em onCommitValue — inalterada por este hotfix"
  );

  console.log("");
  section("8", "SERVICE WORKER");
  assert(/const CACHE_NAME = "cardapio-v57";/.test(swJs), "CACHE_NAME v55 -> v56 -> v57 (coleções abstratas de tempo/dificuldade ilustradas, 2026-07-31: mais um bump de feature externa, atualizado pro valor vigente)");

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
