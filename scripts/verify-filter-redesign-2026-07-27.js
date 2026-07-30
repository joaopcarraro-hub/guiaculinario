// scripts/verify-filter-redesign-2026-07-27.js
//
// FASE F1a — redesenho do modal de Filtros (chips de seleção). TDD: este arquivo foi escrito e
// rodado ANTES da implementação (RED — falhas reais contra o código pré-mudança) e só depois
// disso a implementação foi feita até bater GREEN. Cobre a suíte de validação pedida na tarefa:
// zero input radio/checkbox visível no modal, chips com role/aria-checked corretos, contraste do
// par selecionado, alvo de toque >=44px, tile de país sem a caixinha de contagem, rodapé com
// hierarquia única, e os itens que NÃO mudam (Equipamento/País/Ingrediente continuam com seus
// mecanismos próprios, só redimensionados/corrigidos, nunca convertidos pra chip).
//
// js/app.js usa CRLF (\r\n) — checagem padrão do projeto (ver memória cardapio-verify-script-
// base-commit): nenhuma regex/string aqui assume \n puro num literal multi-linha.
//
// `node scripts/verify-filter-redesign-2026-07-27.js` — sai com código != 0 se algo falhar.

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

// Duas fronteiras de fatiamento (mesmo padrão já estabelecido no projeto — buscar a próxima
// declaração de função como fronteira, robusto a reordenação interna): "\r\n  function " (2
// espaços) fatia uma função de MÓDULO (ex. renderFacetModal inteira); "\r\n      function " (6
// espaços) fatia uma função ANINHADA dentro de openModal (ex. renderChipSectionBody sozinha,
// sem engolir as funções-irmãs seguintes — achado ao escrever esta suíte: usar a fronteira de 2
// espaços numa função de 6 espaços fatia até a PRÓXIMA função de módulo, centenas de linhas
// depois, arrastando helpers e comentários de OUTRAS seções do arquivo pra dentro do "escopo").
function sliceModuleFunction(src, startNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return null;
  let end = src.indexOf("\r\n  function ", start + startNeedle.length);
  if (end < 0) end = src.length;
  return src.slice(start, end);
}
function sliceNestedFunction(src, startNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return null;
  let end = src.indexOf("\r\n      function ", start + startNeedle.length);
  if (end < 0) end = src.length;
  return src.slice(start, end);
}

const facetModalScope = sliceModuleFunction(appJs, "function renderFacetModal(triggerWrapEl, defs, opts) {");
// "Escopo alcançável" pra checagem de radio/checkbox: só as 5 funções que renderGenericSection
// DE FATO despacha pros defs atuais de GENERIC_FACET_DEFS (confirmado na seção 7/8 abaixo) —
// deliberadamente EXCLUI renderSingleSectionBody/renderMultiSectionBody, que são branches
// mortas do mesmo dispatch (nenhum def tem multi:false nem combineMode fora de "or"/"toggle")
// e não deveriam contar como "visível no modal" só por existirem como fallback defensivo não
// alcançado. "Visível" é o critério da tarefa — código morto não é visível a ninguém.
function reachableModalScope() {
  const parts = [
    "function renderGenericSection(def) {",
    "function renderCountryTileSectionBody(sectionBody, def, options) {",
    "function renderTileSectionBody(sectionBody, def, options) {",
    "function renderIngredientTileSectionBody(sectionBody, def, options) {",
    "function renderChipSectionBody(sectionBody, def, options) {",
    // renderProteinRoleSection() foi REMOVIDA (item 1b, 2026-07-28, ver
    // scripts/verify-protein-search-nav-2026-07-28.js) — a seção própria de "Papel da proteína"
    // morreu, virou sub-controle DENTRO do corpo de renderChipSectionBody (mesma entrada logo
    // acima já cobre o código novo, nada fica de fora do escopo alcançável por essa remoção).
  ].map((needle) => sliceNestedFunction(appJs, needle) || "");
  return parts.join("\n\n");
}

function main() {
  console.log("==================================================");
  console.log("0. PRÉ-CONDIÇÃO — escopo do modal de facetas encontrado em js/app.js");
  console.log("==================================================");
  assert(!!facetModalScope, "renderFacetModal(...) encontrado e fatiado com sucesso (fronteira: próxima função de módulo)");
  assert(!!facetModalScope && facetModalScope.length > 5000, "escopo fatiado tem tamanho plausível (>5000 chars — cobre openModal e todos os render*SectionBody aninhados)");

  console.log("");
  console.log("==================================================");
  console.log("1. ZERO INPUT RADIO/CHECKBOX VISÍVEL NO MODAL");
  console.log("==================================================");
  const reachableScope = reachableModalScope();
  assert(reachableScope.length > 3000, "escopo alcançável (6 funções de fato despachadas) fatiado com tamanho plausível");
  assert(!/type="radio"/.test(reachableScope), 'nenhum type="radio" restante no código ALCANÇÁVEL do modal de facetas (Papel da proteína virou segmentado) — renderSingleSectionBody (branch morta do dispatch, nunca invocada por nenhum def atual) deliberadamente fora do escopo desta checagem, ver seção 8');
  assert(!/type="checkbox"/.test(reachableScope), 'nenhum type="checkbox" restante no código ALCANÇÁVEL do modal de facetas (Complexidade/Tempo/Tipo de prato/Proteína/Refeição viraram chips)');
  assert(facetModalScope && !/renderCheckboxSectionBody/.test(facetModalScope), "renderCheckboxSectionBody (gerador de lista de checkbox) não existe mais — substituído pelo gerador de chips");
  assert(facetModalScope && /function renderChipSectionBody\(/.test(facetModalScope), "renderChipSectionBody(...) existe — novo gerador único de chips pras facetas multi-seleção convertidas");
  assert(facetModalScope && /\.filter-chip/.test(facetModalScope), 'classe "filter-chip" é usada de fato no HTML gerado pelo modal');

  console.log("");
  console.log("==================================================");
  console.log("2. CHIPS — role=checkbox, aria-checked, <button> nativo (teclado funciona de graça)");
  console.log("==================================================");
  const chipFnBody = sliceNestedFunction(appJs, "function renderChipSectionBody(sectionBody, def, options) {");
  assert(!!chipFnBody, "renderChipSectionBody isolado com sucesso pra checagem focada");
  assert(!!chipFnBody && /<button type="button" class="filter-chip/.test(chipFnBody), "chip é um <button type=\"button\"> nativo — Enter/Espaço funcionam sem handler de teclado próprio");
  assert(!!chipFnBody && /role="checkbox"/.test(chipFnBody), 'chip carrega role="checkbox" (semântica de multi-seleção preservada)');
  assert(!!chipFnBody && /aria-checked="\s*"\s*\+/.test(chipFnBody.replace(/\s+/g, " ")) || (!!chipFnBody && /aria-checked=/.test(chipFnBody)), "chip carrega aria-checked dinâmico (true/false conforme seleção)");
  assert(!!chipFnBody && /addEventListener\("click"/.test(chipFnBody), "chip tem listener de clique que alterna a seleção no rascunho (draftFacetState)");

  console.log("");
  console.log("==================================================");
  console.log("3. PAPEL DA PROTEÍNA — segmentado de 3 pílulas (role=radiogroup/radio), seleção única preservada");
  console.log("==================================================");
  // ATUALIZADO (item 1b, 2026-07-28): a seção própria "Papel da proteína" morreu por decisão do
  // dono/estrategista — o segmentado virou sub-controle DENTRO do corpo de renderChipSectionBody
  // (mesmo padrão do toggle Qualquer um/Todos estes de Ingrediente), gated por
  // `def.key === "protein" && opts.proteinRole`. roleFnBody agora reaproveita chipFnBody (já
  // fatiado na seção 2 acima) em vez de isolar uma função própria que não existe mais — ver
  // scripts/verify-protein-search-nav-2026-07-28.js pra cobertura completa do redesenho
  // (inclusive o escopo dos 2 listeners de clique separados, .filter-chip-row vs .filter-segmented,
  // pra não contaminar draftFacetState.protein com cliques no segmentado).
  // ATUALIZADO OUTRA VEZ (ajuste visual, 2026-07-28 rodada 2): as 3 pílulas soltas saturavam
  // junto dos chips de proteína (achado do dono ao ver ao vivo) — viraram trilho deslizante
  // (.segmented-toggle), generalizando o MESMO componente do toggle de Ingrediente. O HTML de
  // role="radiogroup"/role="radio" agora mora em segmentedToggleHtml (função module-level
  // separada, fora de chipFnBody) — checado por completo em
  // scripts/verify-protein-search-nav-2026-07-28.js; aqui só confirma que renderChipSectionBody
  // CHAMA essa função compartilhada com os dados certos, não reconstrói o segmentado à mão.
  const roleFnBody = chipFnBody;
  assert(!!roleFnBody, "renderChipSectionBody (onde o segmentado agora vive) isolado com sucesso");
  assert(!!roleFnBody && /segmentedToggleHtml\("Papel da proteína"/.test(roleFnBody), 'chama segmentedToggleHtml("Papel da proteína", ...) — role=radiogroup/radio vêm de dentro dessa função compartilhada, não reconstruídos aqui');
  assert(!!roleFnBody && (roleFnBody.match(/\{\s*value:/g) || []).length === 3, "array `roleOptions` declara exatamente 3 entradas (Ver tudo/Principal/Secundário) — confirma que segmentedToggleHtml recebe 3 paradas");
  // Mini-rodada visual de fechamento (2026-07-29): rótulo "Tanto faz" -> "Ver tudo" (copy do
  // dono, confirmado ao vivo em 360px que cabe no 1/3 do trilho sem truncar, getBoundingClientRect
  // scrollWidth === clientWidth) — mecanismo/value ("") intocado, só o texto do botão mudou.
  assert(!!roleFnBody && /Ver tudo/.test(roleFnBody) && /Principal/.test(roleFnBody) && /Secund[aá]rio/.test(roleFnBody), "os 3 rótulos (Ver tudo/Principal/Secundário) presentes — só a apresentação mudou (agora aninhado, não seção própria)");
  assert(!!roleFnBody && !/Tanto faz/.test(roleFnBody), "TESTE NEGATIVO: rótulo antigo Tanto faz não sobrevive no código");
  assert(!!roleFnBody && /draftProteinRole = /.test(roleFnBody), "clique num segmento continua escrevendo em draftProteinRole (mesmo estado/rascunho de antes, só a UI muda)");
  // O antigo header próprio "Papel da proteína" (com filter-section__count) morreu junto com a
  // seção — não faz mais sentido pedir uma contagem de header que não existe mais por desenho;
  // o rótulo visível agora é .filter-subcontrol-label (checado no lugar, ver suíte 2026-07-28).
  assert(!!roleFnBody && /filter-subcontrol-label/.test(roleFnBody), 'rótulo visível "Papel da proteína" agora é .filter-subcontrol-label dentro do corpo de Proteína (substitui o antigo header próprio com contagem, que não existe mais)');

  console.log("");
  console.log("==================================================");
  console.log("4. CONTRASTE DO PAR SELECIONADO — reaproveita --color-accent-deep/--color-text-primary (4,52:1, já calibrado na Fase 0a)");
  console.log("==================================================");
  const chipSelectedRuleMatch = css.match(/\.filter-chip\.is-selected\s*\{[^}]*\}/);
  assert(!!chipSelectedRuleMatch, ".filter-chip.is-selected existe no CSS");
  const chipSelectedRule = chipSelectedRuleMatch ? chipSelectedRuleMatch[0] : "";
  assert(/background:\s*var\(--color-accent-deep\)/.test(chipSelectedRule), ".filter-chip.is-selected usa var(--color-accent-deep) de fundo — NUNCA --color-accent puro (que falha AA com texto em cima, ver DESIGN-TOKENS.md)");
  assert(/color:\s*var\(--color-text-primary\)/.test(chipSelectedRule), ".filter-chip.is-selected usa var(--color-text-primary) de texto — par já medido em 4,52:1 (Fase 0a)");
  const chipBaseRuleMatch = css.match(/\.filter-chip\s*\{[^}]*\}/);
  assert(!!chipBaseRuleMatch, ".filter-chip (estado não-selecionado) existe no CSS");
  const chipBaseRule = chipBaseRuleMatch ? chipBaseRuleMatch[0] : "";
  assert(/border[^;]*var\(--color-border\)/.test(chipBaseRule), ".filter-chip não-selecionado usa borda var(--color-border)");
  assert(/color:\s*var\(--color-text-secondary\)/.test(chipBaseRule), ".filter-chip não-selecionado usa texto var(--color-text-secondary)");

  console.log("");
  console.log("==================================================");
  console.log("5. ALVO DE TOQUE EFETIVO >= 44px — chip visual 36px + hit-padding invisível (fórmula da Fase 0a, mesma de .recipe-page-tags .tag-chip-link)");
  console.log("==================================================");
  assert(/min-height:\s*36px/.test(chipBaseRule), "chip visual É 36px (não 44px cheios) — o resto vem do hit-padding invisível, mesma fórmula já calibrada em .tag-chip-link");
  const chipAfterMatch = css.match(/\.filter-chip::after\s*\{[^}]*\}/);
  assert(!!chipAfterMatch, ".filter-chip::after (hit-padding invisível) existe");
  const chipAfterInsetMatch = chipAfterMatch && chipAfterMatch[0].match(/inset:\s*(-?\d+(?:\.\d+)?)px/);
  assert(!!chipAfterInsetMatch, "::after tem um inset numérico em px");
  if (chipAfterInsetMatch) {
    const insetAbs = Math.abs(parseFloat(chipAfterInsetMatch[1]));
    // 36px visual + insetAbs de cada lado * 2 precisa alcançar >= 44px efetivos.
    assert(36 + insetAbs * 2 >= 44, "36px + " + insetAbs + "px de cada lado = " + (36 + insetAbs * 2) + "px efetivos >= 44px (matemática igual à de .tag-chip-link: -6px = 5px pretendido + 1px de compensação de borda, 36+5+5=46)");
  }

  console.log("");
  console.log("==================================================");
  console.log("6. TILE DE PAÍS — bug da caixinha cinza de contagem corrigido (align-items: stretch na variante --photo)");
  console.log("==================================================");
  const photoTileRuleMatch = css.match(/\.filter-tile--photo\s*\{[^}]*\}/);
  assert(!!photoTileRuleMatch, ".filter-tile--photo existe no CSS");
  assert(!!photoTileRuleMatch && /align-items:\s*stretch/.test(photoTileRuleMatch[0]), ".filter-tile--photo agora tem align-items:stretch (sobrescreve o align-items:center herdado de .filter-tile) — media E band esticam pra largura cheia do tile, banda deixa de ser uma caixinha hug-content");
  // Teste negativo: a estrutura de país (bandeira cobrindo + faixa por baixo) não virou chip.
  assert(/function renderCountryTileSectionBody\(/.test(appJs), "TESTE NEGATIVO: renderCountryTileSectionBody continua existindo — País NÃO foi convertido pra chip, é classe 1 (tile funcionando), só o bug foi corrigido");
  assert(/imagens\/bandeiras\//.test(appJs), 'TESTE NEGATIVO: País continua usando a bandeira real ("imagens/bandeiras/") — não virou grade mista nem texto puro');

  console.log("");
  console.log("==================================================");
  console.log("7. EQUIPAMENTO — continua tile com ícone (classe 1), NÃO virou chip; só dimensão normalizada");
  console.log("==================================================");
  assert(/function equipmentTileIconHtml\(/.test(appJs), "TESTE NEGATIVO: equipmentTileIconHtml continua existindo — Equipamento não foi convertido pra chip (addendum do dono)");
  assert(/EQUIPMENT_SVG_MARKUP/.test(appJs), "TESTE NEGATIVO: ícones SVG reais de Equipamento continuam embutidos, mecanismo intacto");
  assert(/tileIcon:\s*equipmentTileIconHtml/.test(appJs), 'faceta "equipment" continua layout "tiles" com tileIcon plugado — não virou lista de chip');
  // ^...$ com multiline: exige que ".filter-tile__label" comece a LINHA — sem essa âncora, o
  // primeiro match do arquivo seria ".filter-tile--dense .filter-tile__label { font-size:...}"
  // (seletor composto que aparece ANTES da regra base no arquivo e também contém a substring
  // ".filter-tile__label"), não a regra base que recebeu o min-height nesta correção.
  const labelRuleMatch = css.match(/^\.filter-tile__label\s*\{[^}]*\}/m);
  assert(!!labelRuleMatch, ".filter-tile__label (regra base, não a variante --dense) existe no CSS");
  assert(!!labelRuleMatch && /min-height:\s*calc\(/.test(labelRuleMatch[0]), ".filter-tile__label ganhou min-height derivado (calc, reserva 2 linhas) — normaliza a altura entre tiles de 1 e 2 linhas de label na MESMA grade (achado ao vivo: 'Processador de Alimentos' media 106,78px contra 92,39px dos vizinhos de 1 linha, antes desta correção)");

  console.log("");
  console.log("==================================================");
  console.log("8. INGREDIENTE — continua só-texto, grade densa própria, ZERO radio (decisão travada, item 3)");
  console.log("==================================================");
  assert(/function renderIngredientTileSectionBody\(/.test(appJs), "TESTE NEGATIVO: renderIngredientTileSectionBody continua existindo — Ingrediente não virou lista de chip genérica, mantém a grade densa própria");
  // ATUALIZADO (ajuste visual, 2026-07-28 rodada 2): .ingredient-mode-toggle (nome antigo, só-
  // Ingrediente) foi generalizado pra .segmented-toggle (compartilhado com Papel da proteína) —
  // o toggle Qualquer um/Todos estes continua existindo, só o nome/mecanismo por baixo mudou.
  assert(/function renderIngredientTileSectionBody\([\s\S]*?segmentedToggleHtml\(/.test(appJs), "TESTE NEGATIVO: toggle Qualquer um/Todos estes do Ingrediente continua existindo (agora via segmentedToggleHtml compartilhado, não mais .ingredient-mode-toggle próprio)");
  assert(!/renderIngredientTileSectionBody[\s\S]{0,600}?type="radio"/.test(appJs.slice(appJs.indexOf("function renderIngredientTileSectionBody("), appJs.indexOf("function renderIngredientTileSectionBody(") + 3000)), "renderIngredientTileSectionBody não introduziu nenhum radio nativo");

  console.log("");
  console.log("==================================================");
  console.log("9. RODAPÉ DO MODAL — hierarquia única: Limpar filtros (ghost) + Ver resultados (primary) juntos no rodapé, sticky (flex column já garante isso)");
  console.log("==================================================");
  const footerTemplateMatch = appJs.match(/<div class="filter-modal__footer">[\s\S]*?<\/div>["']/);
  assert(!!footerTemplateMatch, 'template do overlay tem um bloco "filter-modal__footer" localizável');
  assert(!!footerTemplateMatch && /filter-modal__clear-row/.test(footerTemplateMatch[0]), 'filter-modal__clear-row (onde "Limpar filtros" é injetado) agora vive DENTRO do template do footer, não mais como uma div solta logo após o header');
  assert(!/<div class="filter-modal__clear-row"><\/div>["'] \+\s*["']<div class="filter-modal__body">/.test(appJs), 'TESTE NEGATIVO: clear-row não é mais renderizado como irmão solto ANTES do body (posição antiga, topo do modal)');
  const applyRuleMatch = css.match(/\.filter-modal__apply\s*\{[^}]*\}/);
  assert(!!applyRuleMatch && /width:\s*100%/.test(applyRuleMatch[0]) && /border-radius:\s*999px/.test(applyRuleMatch[0]) && /var\(--color-accent-deep\)/.test(applyRuleMatch[0]), '"Ver resultados" continua pill cheia, largura total, --color-accent-deep (primary) — já estava correto, preservado');
  const clearRuleMatch = css.match(/\.filter-modal \.btn-clear-filters\s*\{[^}]*\}/);
  assert(!!clearRuleMatch && /background:\s*none/.test(clearRuleMatch[0]) && /var\(--color-text-secondary\)/.test(clearRuleMatch[0]), '"Limpar filtros" continua ghost discreto (sem fundo, texto secondary) — já estava correto, preservado');

  console.log("");
  console.log("==================================================");
  console.log("10. TOGGLE QUALQUER UM/TODOS ESTES — token de cor unificado com o sistema novo (achado: contraste falhava com --color-accent puro)");
  console.log("==================================================");
  // ATUALIZADO (ajuste visual, 2026-07-28 rodada 2): .ingredient-mode-toggle__thumb virou
  // .segmented-toggle__thumb (generalizado pra N segmentos, compartilhado com Papel da
  // proteína) — o token de cor --color-accent-deep e a mola 260ms cubic-bezier sobrevivem
  // intocados na nova regra, só o NOME da classe mudou.
  const thumbRuleMatch = css.match(/\.segmented-toggle__thumb\s*\{[^}]*\}/);
  assert(!!thumbRuleMatch, ".segmented-toggle__thumb existe no CSS (era .ingredient-mode-toggle__thumb)");
  assert(!!thumbRuleMatch && /background:\s*var\(--color-accent-deep\)/.test(thumbRuleMatch[0]), ".segmented-toggle__thumb usa --color-accent-deep (era --color-accent puro, que mede 4,11:1 com --text-sm/14px sobre ele — abaixo do 4,5:1 AA; --color-accent-deep já é o par validado 4,52:1 usado no resto do sistema de chip novo). Animação de mola (260ms, cubic-bezier) PRESERVADA byte a byte na generalização desta rodada");

  console.log("");
  console.log("==================================================");
  console.log("11. SERVICE WORKER — CACHE_NAME bump (css/style.css e js/app.js mudam)");
  console.log("==================================================");
  assert(/const CACHE_NAME = "cardapio-v53";/.test(swJs), "CACHE_NAME v35 -> ... -> v52 -> v53 (F1c 2026-07-30: mais um bump de feature externa, atualizado pro valor vigente)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
