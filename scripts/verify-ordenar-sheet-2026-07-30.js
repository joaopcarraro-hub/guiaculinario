// scripts/verify-ordenar-sheet-2026-07-30.js
//
// COMMIT 1 da rodada "Ordenar + respiro das superfícies de busca" (2026-07-30): o <select>
// nativo de "Ordenar por" (.sort-control, existia em renderCategory e renderBusca desde o
// commit 7368c1ed, 2026-07-04 — a rescrita do motor de busca nunca tocou nele) morre por
// completo. No lugar, uma pill "Ordenar: X" ao lado da pill "Filtros" (mesma família visual —
// .sort-trigger compartilha a regra base de .filter-trigger, não duplica valores), que abre um
// mini-sheet inferior reusando a infra do modal de filtros: mesmo slot global
// closeActiveFilterModal, mesmo z-token (--z-modal), mesmo padrão de saída simétrica (classe
// --closing + setTimeout antes de remover o nó), e a whitelist de pointer-events:auto em body
// (scripts/verify-filter-modal-pointer-events-2026-07-26.js já audita isso automaticamente —
// qualquer document.body.appendChild sem classe correspondente na whitelist falha aquele teste,
// não precisa duplicar a lógica aqui). Cada opção do sheet reusa .filter-chip/.is-selected (o
// "chip-radio" já calibrado do modal de filtros — 36px, hit-area ::after de -6px, :active/
// :focus-visible já cobertos pelas listas compartilhadas), só reempacotado num radiogroup
// vertical (role="radio", seleção única).
//
// Opções e comparador (TagModel.SORT_OPTIONS/sortRecipeItems) continuam INTOCADOS — só a
// apresentação muda. CACHE_NAME NÃO bumpa nesta rodada (bump único fica pro commit 2, junto do
// respiro de espaçamento — ver spec da tarefa).
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte,
// nunca por ref de git (regra do CLAUDE.md: só literais).
//
// `node scripts/verify-ordenar-sheet-2026-07-30.js` — sai com código != 0 se algo falhar.

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
  console.log("1. SELECT NATIVO MORTO — zero <select> de ordenação, zero .sort-control");
  console.log("==================================================");
  assert(!/<span>Ordenar por<\/span><select>/.test(appJs), "template do <select> nativo de Ordenar não existe mais em app.js");
  assert(!/class="sort-control"/.test(appJs), "nenhum elemento com className sort-control é criado em app.js");
  assert(!/\.sort-control\s*\{/.test(css), "regra CSS .sort-control removida (dead code, zero consumidor)");
  assert(!/\.sort-control select/.test(css), "regra CSS .sort-control select removida");

  console.log("");
  console.log("==================================================");
  console.log("2. PILL 'ORDENAR' — rótulo fixo + ícone + badge condicional, gêmea da pill Filtros");
  console.log("==================================================");
  assert(/function renderSortTrigger\(wrapEl, currentKey, defaultKey, onSelect\)/.test(appJs), "renderSortTrigger(wrapEl, currentKey, defaultKey, onSelect) existe");
  // Ajuste do dono (2026-07-30, ainda antes do push): o rótulo deixou de mostrar a escolha atual
  // ("Ordenar: X") — vira fixo "Ordenar", gêmeo do rótulo fixo "Filtros". A escolha atual sai do
  // texto visível e vira aria-label (a11y) + o badge condicional abaixo.
  assert(!/<span>Ordenar: /.test(appJs), "TESTE NEGATIVO: rótulo NÃO mostra mais a escolha atual (\"Ordenar: X\") — era assim antes deste ajuste");
  assert(/<span>Ordenar<\/span>/.test(appJs), "pill renderiza rótulo FIXO 'Ordenar' (sem a escolha atual, gêmeo do rótulo fixo 'Filtros')");
  assert(/iconSvg\("sort", "sort-trigger__icon"\)/.test(appJs), "pill usa iconSvg(\"sort\", ...) — mesmo sistema de ícone compartilhado da pill Filtros (iconSvg(\"filter\", ...))");
  assert(/sort: '<path d="M8 6v13"\/><path d="M5 9l3-3 3 3"\/><path d="M16 18V5"\/><path d="M13 15l3 3 3-3"\/>',/.test(appJs), "ICONS.sort existe no sistema compartilhado (setas verticais, mesmo estilo outline/stroke dos outros ícones)");
  assert(/aria-label="Ordenar: ' \+/.test(appJs), "aria-label dinâmico continua expondo a escolha atual pra leitor de tela, mesmo com o texto visível fixo");
  // 2ª correção do dono (mesmo dia, ainda antes do push): o badge NÃO compara mais contra o
  // literal fixo "relevance" — compara contra o default DA PRÓPRIA TELA (defaultKey, parâmetro
  // novo). Sem isso, renderBusca (default real "recipe-az") mostraria o badge sempre ligado por
  // padrão, já achado ao vivo na rodada anterior e sinalizado como não-intencional.
  assert(/const isCustom = currentKey !== defaultKey;/.test(appJs), "condição do badge: ativo quando a ordenação != defaultKey (default DA TELA, não um literal fixo)");
  assert(!/const isCustom = currentKey !== "relevance";/.test(appJs), "TESTE NEGATIVO: badge não compara mais contra o literal fixo \"relevance\" — era assim antes desta 2ª correção");
  assert(/\(isCustom \? '<span class="sort-trigger__badge" aria-hidden="true"><\/span>' : ""\)/.test(appJs), "badge é um span vazio (sem número) quando isCustom, ausente quando não");
  // Fiação dos 2 call sites: cada tela passa o PRÓPRIO default (mesma assimetria já documentada
  // — renderCategory usa "relevance" de verdade, renderBusca usa "recipe-az" hardcoded).
  assert(/renderSortTrigger\(sortBarEl, sortKey, "relevance", \(newKey\) => \{\s*\n\s*sortKey = newKey;\s*\n\s*TagModel\.setCollectionSort/.test(appJs), "renderCategory passa defaultKey=\"relevance\" (default real da tela)");
  assert(/renderSortTrigger\(sortBarEl, sortKey, "recipe-az", \(newKey\) => \{\s*\n\s*sortKey = newKey;\s*\n\s*renderSort\(\);\s*\n\s*renderResults\(\);/.test(appJs), "renderBusca passa defaultKey=\"recipe-az\" (default real hardcoded da tela, != \"relevance\")");
  // Lógica em isolamento — mesma técnica já usada em verify-card-contract pra funções puras:
  // reimplementação idêntica da condição, testada nos 4 estados reais (2 telas x default/custom).
  function isCustomLogic(currentKey, defaultKey) {
    return currentKey !== defaultKey;
  }
  assert(isCustomLogic("relevance", "relevance") === false, "estado 1/4 — renderCategory no default (relevance): badge OFF");
  assert(isCustomLogic("recipe-az", "relevance") === true, "estado 2/4 — renderCategory customizada (recipe-az): badge ON");
  assert(isCustomLogic("recipe-az", "recipe-az") === false, "estado 3/4 — renderBusca no default (recipe-az): badge OFF (achado ao vivo da rodada anterior, agora corrigido)");
  assert(isCustomLogic("relevance", "recipe-az") === true, "estado 4/4 — renderBusca customizada (relevance, escolhida explicitamente no sheet): badge ON");
  const sharedTriggerRule = /\.filter-trigger,\s*\n\.sort-trigger\s*\{/.test(css);
  assert(sharedTriggerRule, ".filter-trigger e .sort-trigger compartilham a MESMA regra base (border/altura/família) — não duplicada");
  const sharedBadgeRule = /\.filter-trigger__badge,\s*\n\.sort-trigger__badge\s*\{/.test(css);
  assert(sharedBadgeRule, ".filter-trigger__badge e .sort-trigger__badge compartilham a MESMA regra CSS — mesmo padrão visual, não duplicada");
  const sharedIconSizeRule = /\.filter-trigger__icon,\s*\n\.sort-trigger__icon\s*\{/.test(css);
  assert(sharedIconSizeRule, ".filter-trigger__icon e .sort-trigger__icon compartilham o MESMO tamanho (18px)");
  assert(/\.toolbar-pills\s*\{[^}]*display:\s*flex/.test(css), ".toolbar-pills é um flex row (container que junta Filtros + Ordenar lado a lado)");
  // Os 2 call sites (renderCategory/renderBusca) devem montar facetBarEl e sortBarEl como
  // irmãos dentro do MESMO pillsRow/.toolbar-pills, nunca em containers separados como antes.
  const pillsRowSites = appJs.match(/pillsRow\.className = "toolbar-pills";[\s\S]{0,500}?pillsRow\.appendChild\(sortBarEl\);/g) || [];
  assert(pillsRowSites.length === 2, "exatamente 2 call sites (renderCategory + renderBusca) montam facetBarEl + sortBarEl dentro do mesmo pillsRow — " + pillsRowSites.length + " encontrados");
  pillsRowSites.forEach((block, i) => {
    assert(block.indexOf('facetBarEl.className = "filter-trigger-wrap"') < block.indexOf('sortBarEl.className = "sort-trigger-wrap"'), "call site " + (i + 1) + ": Filtros vem antes de Ordenar no DOM (ordem visual esperada)");
  });

  console.log("");
  console.log("==================================================");
  console.log("3. MINI-SHEET REUSA A INFRA DO MODAL DE FILTROS (overlay/z-token/fechamento)");
  console.log("==================================================");
  assert(/function openSortSheet\(currentKey, onSelect\)/.test(appJs), "openSortSheet(currentKey, onSelect) existe");
  assert(/overlay\.className = "sort-sheet-overlay";[\s\S]{0,900}document\.body\.appendChild\(overlay\)/.test(appJs), "sort-sheet-overlay é appendado direto em document.body (mesmo padrão do filter-modal-overlay)");
  assert(/\.sort-sheet-overlay\s*\{[^}]*z-index:\s*var\(--z-modal\)/.test(css), ".sort-sheet-overlay usa var(--z-modal), MESMO token do modal de filtros (não um z-index novo)");
  const whitelistMatch = css.match(/#bottom-nav,\s*#category-header,\s*#recipes-content(?:,\s*\.[\w-]+)*\s*\{\s*pointer-events:\s*auto;\s*\}/);
  assert(!!whitelistMatch && whitelistMatch[0].includes(".sort-sheet-overlay"), ".sort-sheet-overlay está na whitelist de pointer-events:auto (senão clique morto — mesmo bug que já matou o modal e o toast)");
  assert(/closeActiveFilterModal = closeSheet;/.test(appJs), "openSortSheet registra seu closeSheet no MESMO slot global closeActiveFilterModal — handleRoute já força fechamento dele na troca de rota, sem mecanismo novo");
  assert(/window\.setTimeout\(\(\) => \{\s*overlay\.remove\(\);\s*document\.body\.classList\.remove\("sort-sheet-open"\);/.test(appJs), "closeSheet só remove o nó DEPOIS do timeout da animação (saída simétrica, mesmo padrão do closeModal do filtro)");
  assert(/body\.sort-sheet-open \{ overflow: hidden; \}/.test(css), "body.sort-sheet-open existe — classe PRÓPRIA (não reaproveita body.filter-modal-open), evita colisão de estado entre os 2 mecanismos");
  assert(css.indexOf("body.sort-sheet-open") !== css.indexOf("body.filter-modal-open"), "TESTE NEGATIVO: as 2 classes de body são regras distintas, não a mesma reaproveitada");

  console.log("");
  console.log("==================================================");
  console.log("4. A11Y — radiogroup, role=radio, aria-checked, foco, chip-radio calibrado (>=44px efetivo)");
  console.log("==================================================");
  assert(/role="radiogroup" aria-label="Ordenar por"/.test(appJs), "container do sheet tem role=radiogroup");
  assert(/role="radio" aria-checked="/.test(appJs), "cada opção tem role=radio + aria-checked dinâmico");
  assert(/const firstFocus = overlay\.querySelector\("\.filter-chip\.is-selected"\) \|\| overlay\.querySelector\("\.filter-chip"\);\s*\n\s*if \(firstFocus\) firstFocus\.focus\(\);/.test(appJs), "foco move pra dentro do sheet ao abrir (pousa na opção já selecionada)");
  assert(/class="filter-chip' \+\s*\n\s*\(selected \? " is-selected" : ""\)/.test(appJs), "cada opção reusa .filter-chip/.is-selected — o chip-radio JÁ calibrado do modal de filtros (36px, hit-area, :active/:focus-visible já cobertos), não um componente novo");
  assert(/\.filter-chip \{[^}]*min-height:\s*36px/.test(css), "TESTE NEGATIVO (não regride): .filter-chip continua 36px de altura visual");
  assert(/\.filter-chip::after \{ content: ""; position: absolute; inset: -6px; \}/.test(css), "TESTE NEGATIVO (não regride): hit-area ::after de -6px do .filter-chip continua intacta (36+6+6=48px efetivos, acima do mínimo 44px)");
  assert(/\.sort-sheet__list \.filter-chip \{[^}]*width:\s*100%/.test(css), ".sort-sheet__list força o chip a 100% de largura (lista vertical, não linha horizontal como no modal)");

  console.log("");
  console.log("==================================================");
  console.log("5. COMPORTAMENTO PRESERVADO — mesmas opções, mesmo comparador, mesma persistência por tela");
  console.log("==================================================");
  assert(/TagModel\.SORT_OPTIONS\.map\(\(o\) => \{/.test(appJs), "openSortSheet lê as opções de TagModel.SORT_OPTIONS (fonte única, não duplica a lista)");
  assert(/TagModel\.sortRecipeItems\(items, sortKey, collection\)/.test(appJs), "TESTE NEGATIVO: renderCategory.renderList continua chamando sortRecipeItems com a MESMA assinatura de antes");
  assert(/TagModel\.sortRecipeItems\(items, sortKey, null\)/.test(appJs), "TESTE NEGATIVO: renderBusca.renderResults continua chamando sortRecipeItems com a MESMA assinatura de antes (collection=null)");
  assert(/sortKey = newKey;\s*\n\s*TagModel\.setCollectionSort\(collection\.id, sortKey\);\s*\n\s*renderSort\(\);\s*\n\s*renderList\(\);/.test(appJs), "renderCategory: seleção nova persiste via TagModel.setCollectionSort (comportamento preservado)");
  assert(/let sortKey = "recipe-az";/.test(appJs), "renderBusca: sortKey continua com default 'recipe-az' hardcoded (mesma assimetria documentada de antes — não persiste em localStorage)");
  assert(!/setCollectionSort[\s\S]{0,400}recipe-az/.test(appJs.slice(appJs.indexOf("function renderBusca("), appJs.indexOf("function renderPlaceholder("))), "TESTE NEGATIVO: renderBusca continua SEM chamar setCollectionSort (não ganhou persistência nova nesta rodada)");

  console.log("");
  console.log("==================================================");
  console.log("6. SERVICE WORKER — CACHE_NAME (bump único combinado, ver commit 2)");
  console.log("==================================================");
  // v49 -> v50: bump único da rodada, feito no commit 2 (respiro de espaçamento) por decisão da
  // spec da tarefa — este commit (1) não alterava sw.js sozinho, mas o literal aqui precisa
  // acompanhar o valor FINAL depois dos 2 commits (mesmo padrão de literal-encadeado de sempre:
  // toda suíte pina a versão vigente, não a de quando foi escrita).
  assert(/const CACHE_NAME = "cardapio-v53";/.test(swJs), "CACHE_NAME v49 -> ... -> v52 -> v53 (F1c 2026-07-30: mais um bump de feature externa, atualizado pro valor vigente)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
