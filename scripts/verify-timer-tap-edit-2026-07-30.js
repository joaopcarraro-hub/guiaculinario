// scripts/verify-timer-tap-edit-2026-07-30.js
//
// Suíte da tarefa "timer do modo cozinhar — valor digitado reverte em milissegundos", 2026-07-30.
// Bug real reportado pelo dono (produção v48): tocar o mostrador digital do timer, digitar um
// número e confirmar faz o valor aparecer e REVERTER logo em seguida. Causa: a digitação nunca
// virava fonte de verdade no ato — ficava 100% refém do listener de "settle" do scroll
// (bindColumnScroll), que podia ler a roleta no MEIO da animação de positionWheelColumn(...,
// animate=true) e persistir um valor intermediário, re-escrevendo o mostrador por cima da
// digitação. Agravante: updateTimerDisplay usava textContent puro nas 3 parts, destruindo um
// input de edição aberto se rodasse durante a digitação.
//
// Mesmo padrão de scripts/verify-tecnicas-particao-2026-07-30.js: js/app.js inspecionado como
// TEXTO (fs, sem vm/document — o bloco do timer depende de DOM real), extractFunctionByName
// isola cada função por casamento de chaves (robusto a mudança de lista de parâmetros, ao
// contrário de pinar a assinatura inteira como marcador). Literais, sem ref de git.
//
// `node scripts/verify-timer-tap-edit-2026-07-30.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const JS_DIR = path.join(ROOT, "js");

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

// ---------- extrai o corpo de uma função pelo NOME (casamento de chaves a partir do primeiro
// "{" após "function <nome>(") — não pina a lista de parâmetros inteira como marcador, porque
// esta tarefa MUDA a assinatura de enableDisplayTapToEdit (ganha um 5º parâmetro) ----------
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

function main() {
  const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");

  section("A", "FONTE — digitação commita na hora (enableDisplayTapToEdit ganha onCommitValue)");
  const enableBody = extractFunctionByName(appJs, "enableDisplayTapToEdit") || "";
  assert(enableBody.length > 0, "enableDisplayTapToEdit encontrada e isolada por casamento de chaves");

  const sigMatch = appJs.match(/function enableDisplayTapToEdit\(([^)]*)\)/);
  const sig = sigMatch ? sigMatch[1] : "";
  console.log("  literal: assinatura = (" + sig + ")");
  const sigParams = sig.split(",").map((p) => p.trim()).filter(Boolean);
  assert(sigParams.length === 5 && sigParams[4] === "onCommitValue", "enableDisplayTapToEdit tem 5º parâmetro onCommitValue (obtido: [" + sigParams.join(", ") + "])");

  const idxOnCommit = enableBody.indexOf("onCommitValue(parsed)");
  const idxPosition = enableBody.indexOf("positionWheelColumn(wheelEl, values, parsed, true)");
  assert(idxOnCommit !== -1, "commit() chama onCommitValue(parsed) no caminho de valor válido");
  assert(idxPosition !== -1, "commit() ainda chama positionWheelColumn(wheelEl, values, parsed, true) no caminho de valor válido");
  assert(
    idxOnCommit !== -1 && idxPosition !== -1 && idxOnCommit < idxPosition,
    "ORDEM (indexOf): onCommitValue(parsed) roda ANTES de positionWheelColumn — o valor digitado já é fonte de verdade antes de a roleta sequer começar a animar"
  );

  const stoppedBody = extractFunctionByName(appJs, "renderTimerStopped") || "";
  assert(stoppedBody.length > 0, "renderTimerStopped encontrada e isolada por casamento de chaves");

  const callSitePatterns = [
    { unit: "h", re: /enableDisplayTapToEdit\(displayEl\.querySelector\('\[data-unit="h"\]'\), hoursWheel, TIMER_WHEEL_HOURS, \(\) => hVal, \(v\) => \{ hVal = v; commitCombined\(\); \}\);/ },
    { unit: "m", re: /enableDisplayTapToEdit\(displayEl\.querySelector\('\[data-unit="m"\]'\), minutesWheel, TIMER_WHEEL_MINUTES, \(\) => mVal, \(v\) => \{ mVal = v; commitCombined\(\); \}\);/ },
    { unit: "s", re: /enableDisplayTapToEdit\(displayEl\.querySelector\('\[data-unit="s"\]'\), secondsWheel, TIMER_WHEEL_SECONDS, \(\) => sVal, \(v\) => \{ sVal = v; commitCombined\(\); \}\);/ },
  ];
  let callSiteHits = 0;
  callSitePatterns.forEach((p) => {
    const hit = p.re.test(stoppedBody);
    if (hit) callSiteHits++;
    assert(hit, "call site de " + p.unit.toUpperCase() + " passa callback que atribui " + p.unit + "Val E chama commitCombined()");
  });
  console.log("  literal: call sites de enableDisplayTapToEdit com callback de commit imediato = " + callSiteHits + "/3");
  assert(callSiteHits === 3, "as 3 unidades (h/m/s) passam o callback de commit imediato — uma ocorrência por unidade (obtido " + callSiteHits + "/3)");

  console.log("");
  section("B", "FONTE — settle imune a leitura no meio de animação programática (dataset.progTarget)");
  const positionBody = extractFunctionByName(appJs, "positionWheelColumn") || "";
  assert(positionBody.length > 0, "positionWheelColumn encontrada e isolada por casamento de chaves");

  const idxProgTargetWrite = positionBody.indexOf("wheelEl.dataset.progTarget");
  const idxScrollTo = positionBody.indexOf("wheelEl.scrollTo(");
  assert(idxProgTargetWrite !== -1, "positionWheelColumn grava o alvo em wheelEl.dataset.progTarget");
  assert(idxScrollTo !== -1, "positionWheelColumn ainda chama wheelEl.scrollTo(...) no caminho animado");
  assert(
    idxProgTargetWrite !== -1 && idxScrollTo !== -1 && idxProgTargetWrite < idxScrollTo,
    "ORDEM (indexOf): wheelEl.dataset.progTarget é gravado ANTES de wheelEl.scrollTo(...) — o marcador existe antes de a animação começar"
  );

  const bindBody = extractFunctionByName(appJs, "bindColumnScroll") || "";
  assert(bindBody.length > 0, "bindColumnScroll encontrada e isolada por casamento de chaves");

  const idxIsConnected = bindBody.indexOf("wheelEl.isConnected");
  const idxProgTargetCheck = bindBody.indexOf("wheelEl.dataset.progTarget !== undefined");
  assert(idxIsConnected !== -1, "settle guarda !wheelEl.isConnected — coluna desanexada (Iniciar tocado durante a animação programática, renderTimer trocou o DOM) nunca re-arma timeout nem commita leitura de elemento morto");
  assert(
    idxIsConnected !== -1 && idxProgTargetCheck !== -1 && idxIsConnected < idxProgTargetCheck,
    "ORDEM (indexOf): a guarda isConnected roda ANTES da checagem de progTarget — elemento desanexado nunca chega a ler dataset/scrollTop de um rect zerado"
  );

  assert(/wheelEl\.dataset\.progTarget\s*!==\s*undefined/.test(bindBody), "settle checa wheelEl.dataset.progTarget !== undefined antes de decidir commitar");
  assert(
    /Math\.abs\(wheelEl\.scrollTop\s*-\s*parseFloat\(wheelEl\.dataset\.progTarget\)\)\s*>\s*2/.test(bindBody),
    "settle mede Math.abs(wheelEl.scrollTop - parseFloat(wheelEl.dataset.progTarget)) > 2 antes de aceitar o valor centralizado"
  );
  assert(
    /setTimeout\(settle,\s*150\)/.test(bindBody),
    "quando a distância é grande (animação ainda em curso), o settle RE-ARMA a si mesmo com o mesmo delay (150ms) — não commita valor intermediário"
  );
  assert(
    /delete wheelEl\.dataset\.progTarget/.test(bindBody),
    "quando o alvo é alcançado, progTarget é limpo (idempotente — o valor já foi commitado via onCommitValue em A, o settle só sincroniza a UI)"
  );
  ["pointerdown", "touchstart", "wheel"].forEach((evt) => {
    assert(bindBody.indexOf('"' + evt + '"') !== -1, "interação manual (" + evt + ") é escutada na coluna, para limpar progTarget e devolver o controle ao dedo do usuário");
  });
  assert(/passive:\s*true/.test(bindBody), "os listeners de interação manual usam { passive: true } (não bloqueiam o scroll nativo)");

  console.log("");
  section("C", "FONTE — updateTimerDisplay não destrói edição em curso");
  const updateBody = extractFunctionByName(appJs, "updateTimerDisplay") || "";
  assert(updateBody.length > 0, "updateTimerDisplay encontrada e isolada por casamento de chaves");
  assert(/\.querySelector\("input"\)/.test(updateBody), "updateTimerDisplay consulta part.querySelector(\"input\") antes de escrever texto");
  assert(
    /if\s*\(!parts\[i\]\.querySelector\("input"\)\)/.test(updateBody),
    "a checagem é feita POR PART (parts[i]) — só pula a escrita na part que está com um <input> de edição aberto, as outras 2 seguem atualizando normalmente"
  );

  console.log("");
  section("D", "NEGATIVOS");
  const inputCount = (appJs.match(/document\.createElement\("input"\)/g) || []).length;
  console.log("  literal: document.createElement(\"input\") aparece " + inputCount + "x em js/app.js");
  assert(inputCount === 4, "document.createElement(\"input\") continua aparecendo EXATAMENTE 4x em js/app.js — nenhum input novo criado por este conserto (obtido " + inputCount + ")");

  assert(
    enableBody.indexOf("persistStepTimer(") === -1,
    "TESTE NEGATIVO: persistStepTimer NÃO é chamado dentro de enableDisplayTapToEdit — a persistência continua tendo um caminho só, commitCombined()"
  );

  assert(/findCenteredWheelItem\(wheelEl\)/.test(bindBody), "TESTE NEGATIVO: o caminho de arrasto manual (settle) continua chamando findCenteredWheelItem — intacto");
  assert(/markSelectedWheelItem\(wheelEl, newValue\)/.test(bindBody), "TESTE NEGATIVO: ...continua chamando markSelectedWheelItem(wheelEl, newValue) — intacto");
  assert(/onSettle\(newValue\)/.test(bindBody), "TESTE NEGATIVO: ...continua chamando onSettle(newValue) — intacto");
  assert(/commitCombined\(\);/.test(bindBody), "TESTE NEGATIVO: ...continua chamando commitCombined() ao fim do settle normal — intacto");

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
