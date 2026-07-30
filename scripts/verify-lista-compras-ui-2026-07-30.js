// scripts/verify-lista-compras-ui-2026-07-30.js
//
// F1c — passada visual da Lista de Compras. Fase A (inventário) achou o limiar de 10 receitas
// pro botão "Limpar lista" indescobrível e o próprio botão competindo como ação primária (pill
// cheia, borda+texto --color-error) — achado do dono, "quase tudo vermelho e redondo". Fase B
// (spec fechada): regra de aparição sem limiar, botão rebaixado a texto/ghost, guarda de
// desfazer via toast (reusa update-toast), ritmo (--space-*) no gap apertado da linha de
// receita. Nada de mudança funcional em checkboxes/linhas/abas/despensa/sub-produtos.
//
// Mesmas 3 técnicas já estabelecidas no projeto:
// - execução REAL de storage.js sandboxado com localStorage falso (mesmo truque de
//   verify-pesquisar-vitrine-2026-07-30.js seção 4) — pro snapshot/restore de verdade, com
//   valores literais, não só grep.
// - texto exato do código-fonte (.includes()/regex) — pro resto (visibilidade, estrutura,
//   whitelist, hierarquia).
// - scripts/verify-shopping-sections-2026-07-24.js continua sendo a suíte dona do
//   COMPORTAMENTO funcional (agrupamento, despensa, sub-produtos) — esta suíte NÃO duplica
//   nada de lá, só cobre o que é novo nesta rodada.
//
// `node scripts/verify-lista-compras-ui-2026-07-30.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const JS_DIR = path.join(ROOT, "js");

const appJs = fs.readFileSync(path.join(JS_DIR, "app.js"), "utf8");
const storageJs = fs.readFileSync(path.join(JS_DIR, "storage.js"), "utf8");
const styleCss = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

// Mesma técnica de sliceTopLevel (verify-pesquisar-vitrine-2026-07-30.js): extrai o corpo de
// uma função top-level (2 espaços de indentação) por marca de início; fim = a próxima
// declaração "  function " ou "  const " no mesmo nível. app.js usa CRLF.
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

function main() {
  console.log("==================================================");
  console.log("1. APARICAO DO 'LIMPAR LISTA' — sem limiar, so com lista vazia some");
  console.log("==================================================");
  const renderListaBody = sliceTopLevel(appJs, "function renderListaCompras() {", "renderListaCompras");
  assert(!/recipeEntries\.length > 10/.test(renderListaBody), "TESTE NEGATIVO: limiar de 10 removido — nao sobra 'recipeEntries.length > 10' em lugar nenhum da funcao");
  assert(/if \(recipeEntries\.length\) \{[\s\S]*?shopping-list__clear/.test(renderListaBody), "botao aparece dentro de 'if (recipeEntries.length)' — qualquer lista nao-vazia, sem piso de 10");
  assert(renderListaBody.includes('empty.textContent = "Sua lista de compras está vazia. Adicione receitas pela tela de cada receita.";'), "empty-state padrao preservado, texto identico ao de antes");

  console.log("");
  console.log("==================================================");
  console.log("2. HIERARQUIA — Limpar lista virou texto/ghost, nunca mais pill cheia");
  console.log("==================================================");
  const clearRuleMatch = styleCss.match(/\.shopping-list__clear \{[\s\S]*?\n\}/);
  const clearRule = clearRuleMatch ? clearRuleMatch[0] : "";
  assert(clearRule.length > 0, ".shopping-list__clear: regra CSS localizada");
  assert(!/border-radius:\s*999px/.test(clearRule), "TESTE NEGATIVO: sem border-radius:999px (pill) — era o formato que competia como acao primaria");
  assert(!/border:\s*1px solid/.test(clearRule), "TESTE NEGATIVO: sem borda propria — visual ghost puro, so cor de texto");
  assert(/background:\s*none/.test(clearRule), "sem fundo (background: none)");
  assert(/color:\s*var\(--color-error\)/.test(clearRule), "mantem a cor de erro — ainda sinaliza 'destrutivo', so nao grita mais em formato de pill");
  assert(!/--color-accent-deep/.test(clearRule) && !/--color-accent\b/.test(clearRule), "TESTE NEGATIVO: Limpar lista nao usa nenhuma variante de --color-accent — nunca compete como PRIMARIO da tela");
  assert(/min-height:\s*44px/.test(clearRule), "alvo de toque >=44px direto (sem precisar de ::after agora que nao ha borda pra preservar)");

  console.log("");
  console.log("--- 2b. Abas e acao por-receita: confirmadas SEM MUDANCA (ja eram o padrao certo) ---");
  const tabRuleMatch = styleCss.match(/\.shopping-list__tab \{[\s\S]*?\n\}/);
  const tabRule = tabRuleMatch ? tabRuleMatch[0] : "";
  assert(!/border-radius:\s*999px/.test(tabRule), "TESTE NEGATIVO: abas continuam SEM pill (var(--radius), padrao de aba) — item 2 do briefing pedia pra nao mexer");
  assert(renderListaBody.includes('deleteBtn.className = "preparo-card__delete";') || appJs.includes('deleteBtn.className = "preparo-card__delete";'), "'x' por receita continua reaproveitando .preparo-card__delete (ja era ghost/icone, confirmado sem mudanca)");
  // \n ancora início de linha — sem isso, ".preparo-card__delete {" também casa como SUFIXO de
  // ".shopping-list__recipe-row .preparo-card__delete {" (achado real ao rodar: pegava a regra
  // composta errada, "cursor: pointer" só, não a regra base com a cor).
  const deleteRuleMatch = styleCss.match(/\n\.preparo-card__delete \{[\s\S]*?\n\}/);
  const deleteRule = deleteRuleMatch ? deleteRuleMatch[0] : "";
  assert(/color:\s*var\(--color-text-disabled\)/.test(deleteRule), "'x' por receita continua neutro por padrao (so --color-error no :hover) — confirmado sem mudanca");

  console.log("");
  console.log("==================================================");
  console.log("3. ESTRUTURA — cabecalho vira 1 linha (abas + Limpar lista no canto)");
  console.log("==================================================");
  assert(renderListaBody.includes('headerRow.className = "shopping-list__header";'), "headerRow (.shopping-list__header) criado");
  assert(renderListaBody.includes("headerRow.appendChild(toggleEl);"), "abas entram no headerRow");
  assert(renderListaBody.includes("headerRow.appendChild(clearBtn);"), "Limpar lista entra no MESMO headerRow (corner do cabecalho, nao mais bloco solto)");
  assert(renderListaBody.includes("content.appendChild(headerRow);"), "headerRow (unico) e o que vai pro content — nao mais 2 appendChild separados");
  const headerRuleMatch = styleCss.match(/\.shopping-list__header \{[\s\S]*?\n\}/);
  const headerRule = headerRuleMatch ? headerRuleMatch[0] : "";
  assert(/display:\s*flex/.test(headerRule), ".shopping-list__header e flex (abas + botao lado a lado)");

  console.log("");
  console.log("==================================================");
  console.log("4. DESFAZER — execucao REAL: snapshot/clear/restore contra storage.js sandboxado");
  console.log("==================================================");
  assert(storageJs.includes("snapshotShoppingList:"), "Storage.snapshotShoppingList exportado");
  assert(storageJs.includes("restoreShoppingListSnapshot:"), "Storage.restoreShoppingListSnapshot exportado");

  function makeFakeLocalStorage() {
    const store = {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  }
  let Storage = null;
  try {
    const sandbox = { window: {} };
    const fakeLS = makeFakeLocalStorage();
    // eslint-disable-next-line no-new-func
    new Function("window", "localStorage", storageJs)(sandbox.window, fakeLS);
    Storage = sandbox.window.Storage;
  } catch (e) {
    console.log("  ERRO ao sandboxar storage.js: " + e.message);
  }
  assert(!!Storage, "storage.js sandboxa e roda com localStorage falso (sem tocar localStorage real)");
  if (Storage) {
    Storage.addRecipeToShoppingList("bechamel", 2, [0, 1, 2]);
    Storage.addRecipeToShoppingList("carbonara", 1, [0]);
    Storage.toggleShoppingItemBought("manteiga", "grama");
    Storage.toggleShoppingItemBought("leite", "ml");

    const before = {
      recipes: JSON.parse(JSON.stringify(Storage.getShoppingListRecipes())),
      bought: { manteiga: Storage.isShoppingItemBought("manteiga", "grama"), leite: Storage.isShoppingItemBought("leite", "ml") },
    };
    assert(before.recipes.length === 2, "estado ANTES: 2 receitas na lista — obtido " + before.recipes.length);
    assert(before.bought.manteiga === true && before.bought.leite === true, "estado ANTES: 2 itens marcados como comprados");

    const snapshot = Storage.snapshotShoppingList();
    assert(typeof snapshot === "object" && !!snapshot.recipes && !!snapshot.boughtKeys, "snapshot tem o formato {recipes, boughtKeys}");

    Storage.clearShoppingList();
    assert(Storage.getShoppingListRecipes().length === 0, "APOS limpar: lista vazia — obtido " + Storage.getShoppingListRecipes().length);
    assert(Storage.isShoppingItemBought("manteiga", "grama") === false, "APOS limpar: comprados tambem zerados (boughtKeys junto, nao so recipes)");

    Storage.restoreShoppingListSnapshot(snapshot);
    const after = {
      recipes: JSON.parse(JSON.stringify(Storage.getShoppingListRecipes())),
      bought: { manteiga: Storage.isShoppingItemBought("manteiga", "grama"), leite: Storage.isShoppingItemBought("leite", "ml") },
    };
    assert(after.recipes.length === 2, "APOS desfazer: 2 receitas de volta — obtido " + after.recipes.length);
    assert(
      JSON.stringify(after.recipes.slice().sort((a, b) => a.recipeId.localeCompare(b.recipeId))) ===
        JSON.stringify(before.recipes.slice().sort((a, b) => a.recipeId.localeCompare(b.recipeId))),
      "APOS desfazer: receitas restauradas byte a byte identicas ao ANTES (mesmo recipeId/portionMultiplier/selectedEntries) — valores literais, nao so contagem"
    );
    assert(after.bought.manteiga === true && after.bought.leite === true, "APOS desfazer: os 2 itens comprados voltam marcados — boughtKeys restaurado junto");

    // Independencia do snapshot: mutar o estado ATUAL depois de tirar o snapshot nao pode
    // vazar pro snapshot guardado (prova que e clone de verdade, nao referencia).
    const snap2 = Storage.snapshotShoppingList();
    Storage.addRecipeToShoppingList("terceira-receita", 1, [0]);
    assert(snap2.recipes["terceira-receita"] === undefined, "TESTE NEGATIVO: snapshot e clone independente — mutar o estado real DEPOIS do snapshot nao aparece nele");
  }

  console.log("");
  console.log("==================================================");
  console.log("5. WIRING — clique em Limpar lista faz snapshot+clear+toast, na ordem certa");
  console.log("==================================================");
  const clearBtnHandlerMatch = renderListaBody.match(/clearBtn\.addEventListener\("click", \(\) => \{[\s\S]*?\n      \}\);/);
  const clearBtnHandler = clearBtnHandlerMatch ? clearBtnHandlerMatch[0] : "";
  assert(clearBtnHandler.length > 0, "handler de click do Limpar lista localizado");
  const idxSnapshot = clearBtnHandler.indexOf("Storage.snapshotShoppingList()");
  const idxClear = clearBtnHandler.indexOf("Storage.clearShoppingList()");
  const idxToast = clearBtnHandler.indexOf("showShoppingUndoToast(");
  assert(idxSnapshot !== -1 && idxClear !== -1 && idxToast !== -1, "as 3 chamadas presentes: snapshot, clear, toast");
  assert(idxSnapshot < idxClear && idxClear < idxToast, "ORDEM certa: snapshot ANTES de limpar (senao seria snapshot do estado ja vazio), toast DEPOIS (senao mostraria antes do clear acontecer)");
  // window.confirm( com parênteses — checa a CHAMADA de verdade, não a palavra em prosa (o
  // comentário do próprio handler MENCIONA "window.confirm" pra explicar a troca, o que faria
  // uma checagem sem parênteses falhar num falso positivo).
  assert(!clearBtnHandler.includes("window.confirm("), "TESTE NEGATIVO: sem chamada a window.confirm( no fluxo de limpar — acao silenciosa, guarda e o toast");

  console.log("");
  console.log("==================================================");
  console.log("6. TOAST DE DESFAZER — reusa update-toast, entra na whitelist, nao vaza pra outra tela");
  console.log("==================================================");
  assert(appJs.includes("function showShoppingUndoToast(snapshot) {"), "showShoppingUndoToast existe");
  const toastBody = sliceTopLevel(appJs, "function showShoppingUndoToast(snapshot) {", "showShoppingUndoToast");
  assert(toastBody.includes('toast.className = "update-toast shopping-undo-toast";'), "toast usa as 2 classes: update-toast (visual de graca) + shopping-undo-toast (marcador/whitelist)");
  assert(/setTimeout\(\(\) => \{\s*\n\s*toast\.remove\(\);\s*\n\s*\}, 6000\);/.test(toastBody), "auto-dismiss em 6000ms (~6s, como pedido)");
  assert(toastBody.includes('Router.current().name === "lista-compras"') , "TESTE DE REGRESSAO: Desfazer clicado de OUTRA tela restaura o DADO mas so re-renderiza se Lista de Compras ainda estiver aberta — nunca troca o conteudo visivel de uma tela diferente por baixo do usuario");
  assert(toastBody.includes("Storage.restoreShoppingListSnapshot(snapshot)"), "Desfazer chama restoreShoppingListSnapshot com o snapshot capturado no momento do clique em Limpar");
  assert(
    /#bottom-nav, #category-header, #recipes-content, \.filter-modal-overlay, \.update-toast, \.sort-sheet-overlay, \.shopping-undo-toast \{ pointer-events: auto; \}/.test(styleCss),
    ".shopping-undo-toast entrou na whitelist de pointer-events do body (causa conhecida — sem isso o toast novo renderiza mas fica com clique morto)"
  );

  console.log("");
  console.log("==================================================");
  console.log("7. ESCOPO — nada de mudanca funcional alem do item 1 (agrupamento/despensa/sub-produtos intocados)");
  console.log("==================================================");
  assert(appJs.includes("function buildShoppingListGroups() {"), "buildShoppingListGroups continua existindo, sem renomear");
  const groupsBody = sliceTopLevel(appJs, "function buildShoppingListGroups() {", "buildShoppingListGroups");
  assert(groupsBody.includes("PANTRY_SET"), "TESTE NEGATIVO: logica de despensa (PANTRY_SET) presente e intocada dentro de buildShoppingListGroups");
  assert(appJs.includes("boughtKeys[key]") || storageJs.includes("boughtKeys[key]"), "TESTE NEGATIVO: chave compartilhada boughtKeys continua existindo (comprado nao virou por-receita)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERCOES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
