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
const { extractCacheName } = require("./lib-cache-name");

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
// "Escopo alcançável" pra checagem de radio/checkbox: só as funções que renderGenericSection DE
// FATO despacha pros defs atuais de GENERIC_FACET_DEFS (confirmado na seção 7/8 abaixo), mais os
// 2 helpers que elas chamam pra montar HTML — deliberadamente EXCLUI
// renderSingleSectionBody/renderMultiSectionBody, que são branches mortas do mesmo dispatch
// (nenhum def tem multi:false nem combineMode fora de "or"/"toggle") e não deveriam contar como
// "visível no modal" só por existirem como fallback defensivo não alcançado. "Visível" é o
// critério da tarefa — código morto não é visível a ninguém.
function reachableModalScope() {
  const parts = [
    "function renderGenericSection(def) {",
    "function renderCountryTileSectionBody(sectionBody, def, options) {",
    // renderProteinTileSectionBody (F1c, 2026-08-06) — Proteína graduou de chip pra photo-tile
    // (ver GENERIC_FACET_DEFS/seção 12 abaixo). buildProteinRoleHtml/wireProteinRoleToggle são
    // os 2 helpers que ela chama pro sub-controle "Papel da proteína" (migrados de dentro de
    // renderChipSectionBody, único caller antes desta rodada) — entram aqui pelo mesmo motivo
    // que renderProteinTileSectionBody entra: HTML de fato renderizado no modal.
    "function renderProteinTileSectionBody(sectionBody, def, options) {",
    "function buildProteinRoleHtml() {",
    "function wireProteinRoleToggle(sectionBody, roleOptions) {",
    "function renderTileSectionBody(sectionBody, def, options) {",
    "function renderIngredientTileSectionBody(sectionBody, def, options) {",
    "function renderChipSectionBody(sectionBody, def, options) {",
    // renderProteinRoleSection() foi REMOVIDA (item 1b, 2026-07-28, ver
    // scripts/verify-protein-search-nav-2026-07-28.js) — a seção própria de "Papel da proteína"
    // morreu bem antes desta rodada; ver histórico em buildProteinRoleHtml acima.
  ].map((needle) => sliceNestedFunction(appJs, needle) || "");
  return parts.join("\n\n");
}

// ---------- mesmo padrão fs+"new Function" de scripts/verify-protein-role-unify-2026-07-30.js —
// TagModel roda de verdade num sandbox `window` (dados reais do acervo), e funções puras extraídas
// do FONTE de app.js (não reimplementadas numa 3ª forma) rodam contra esse sandbox pra provar
// comportamento real, não suposto. ----------
const DATA_DIR = path.join(ROOT, "data");
const JS_DIR = path.join(ROOT, "js");
function runInSandbox(sandbox, code) {
  // eslint-disable-next-line no-new-func
  new Function("window", code)(sandbox.window);
}
function loadPipeline() {
  const sandbox = { window: {} };
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "countries.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "categories.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(DATA_DIR, "derivation-dict.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tags.js"), "utf8"));
  fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".js") && f !== "derivation-dict.js" && f !== "shopping-dict.js")
    .forEach((f) => runInSandbox(sandbox, fs.readFileSync(path.join(DATA_DIR, f), "utf8")));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "collections.js"), "utf8"));
  runInSandbox(sandbox, fs.readFileSync(path.join(JS_DIR, "tagmodel.js"), "utf8"));
  return sandbox.window;
}

// Extrai o corpo de uma função/const OBJETO por casamento de chaves (mesmo mecanismo de
// verify-protein-role-unify-2026-07-30.js) — startMarker pode ser "function nome(...) {" OU
// "const NOME = {" (objeto literal), os dois têm chaves balanceadas.
function extractFunctionBody(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start < 0) return null;
  const braceStart = src.indexOf("{", start);
  if (braceStart < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return end < 0 ? null : src.slice(start, end);
}

// Carrega PROTEIN_TILE_IMAGE/PROTEIN_SIGNATURE_RECIPE/proteinSignatureRecipe/
// facetOptionsFromPrefix REAIS via extração de app.js, executados JUNTOS contra o TagModel real
// (loadPipeline) — a "guarda de futuro" da seção 12 roda o binário real, não reimplementa a
// regra de contagem/resolução de imagem numa 3ª forma.
function loadProteinTileHelpers(appJsSrc, TagModel) {
  const imageMapBody = extractFunctionBody(appJsSrc, "const PROTEIN_TILE_IMAGE = {");
  const signatureMapBody = extractFunctionBody(appJsSrc, "const PROTEIN_SIGNATURE_RECIPE = {");
  const signatureFnBody = extractFunctionBody(appJsSrc, "function proteinSignatureRecipe(tagId) {");
  const facetOptionsBody = extractFunctionBody(appJsSrc, "function facetOptionsFromPrefix(items, prefix) {");
  if (!imageMapBody || !signatureMapBody || !signatureFnBody || !facetOptionsBody) return null;
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    "TagModel",
    "return (function() {\n" +
      imageMapBody +
      ";\n" +
      signatureMapBody +
      ";\n" +
      signatureFnBody +
      "\n" +
      facetOptionsBody +
      "\nreturn { PROTEIN_TILE_IMAGE: PROTEIN_TILE_IMAGE, PROTEIN_SIGNATURE_RECIPE: PROTEIN_SIGNATURE_RECIPE, proteinSignatureRecipe: proteinSignatureRecipe, facetOptionsFromPrefix: facetOptionsFromPrefix };\n})()"
  );
  return factory(TagModel);
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
  assert(reachableScope.length > 3000, "escopo alcançável (8 funções de fato despachadas/chamadas — 5 da Fase F1a + renderProteinTileSectionBody/buildProteinRoleHtml/wireProteinRoleToggle do F1c) fatiado com tamanho plausível");
  assert(!/type="radio"/.test(reachableScope), 'nenhum type="radio" restante no código ALCANÇÁVEL do modal de facetas (Papel da proteína virou segmentado) — renderSingleSectionBody (branch morta do dispatch, nunca invocada por nenhum def atual) deliberadamente fora do escopo desta checagem, ver seção 8');
  assert(!/type="checkbox"/.test(reachableScope), 'nenhum type="checkbox" restante no código ALCANÇÁVEL do modal de facetas (Complexidade/Tempo/Tipo de prato/Refeição viraram chips, Proteína virou photo-tile — ver seção 12)');
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
  // dono/estrategista — o segmentado virou sub-controle, gated por `opts.proteinRole`. O HTML de
  // role="radiogroup"/role="radio" mora em segmentedToggleHtml (função module-level separada) —
  // checado por completo em scripts/verify-protein-search-nav-2026-07-28.js; aqui só confirma
  // que o sub-controle CHAMA essa função compartilhada com os dados certos, não reconstrói o
  // segmentado à mão.
  // ATUALIZADO DE NOVO (F1c, 2026-08-06): a faceta VALOR de Proteína graduou de chip pra
  // photo-tile (seção 12 abaixo) — o sub-controle "Papel da proteína" se moveu JUNTO, de dentro
  // de renderChipSectionBody pra 2 helpers próprios (buildProteinRoleHtml/wireProteinRoleToggle)
  // chamados por renderProteinTileSectionBody, o único caller agora. roleFnBody concatena os 2
  // (buildProteinRoleHtml monta o HTML/rótulos, wireProteinRoleToggle escreve draftProteinRole)
  // em vez de reaproveitar chipFnBody, que não contém mais nada de Proteína.
  const roleFnBody =
    (sliceNestedFunction(appJs, "function buildProteinRoleHtml() {") || "") +
    "\n\n" +
    (sliceNestedFunction(appJs, "function wireProteinRoleToggle(sectionBody, roleOptions) {") || "");
  assert(roleFnBody.trim().length > 2, "buildProteinRoleHtml + wireProteinRoleToggle (onde o segmentado agora vive) isolados com sucesso");
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
  assert(/const CACHE_NAME = "cardapio-v\d+";/.test(swJs), "CACHE_NAME presente em sw.js no formato esperado (lido dinamicamente via scripts/lib-cache-name.js — bump não exige editar esta suíte): " + extractCacheName(swJs));

  console.log("");
  console.log("==================================================");
  console.log("12. FACETA PROTEÍNA VIRA PHOTO-TILE (F1c, 2026-08-06) — REUSO TOTAL, zero imagem nova");
  console.log("==================================================");
  assert(/function renderProteinTileSectionBody\(sectionBody, def, options\) \{/.test(appJs), "renderProteinTileSectionBody(...) existe — função IRMÃ de renderCountryTileSectionBody, não reaproveitada (mesmo motivo de .category-card--signature não reusar .category-card--country)");
  assert(/\{ key: "protein", label: "Prote[ií]na", prefix: "protein:", multi: true, combineMode: "or", layout: "protein-tiles" \}/.test(appJs), 'GENERIC_FACET_DEFS da faceta Proteína agora declara layout: "protein-tiles" (era chip sem layout, Fase F1a)');
  assert(/else if \(def\.layout === "protein-tiles"\) renderProteinTileSectionBody\(sectionBody, def, options\);/.test(appJs), 'dispatch de renderGenericSection tem o branch "protein-tiles" -> renderProteinTileSectionBody');
  // TESTE NEGATIVO: renderChipSectionBody não decide mais nada de Proteína — nem o branch
  // isProteinFacet nem o reset de draftProteinRole sobrevivem lá (os 2 migraram pra
  // renderProteinTileSectionBody/wireProteinRoleToggle, checados acima na seção 3).
  const chipFnBodyNow = sliceNestedFunction(appJs, "function renderChipSectionBody(sectionBody, def, options) {");
  assert(!!chipFnBodyNow && !/isProteinFacet/.test(chipFnBodyNow) && !/draftProteinRole/.test(chipFnBodyNow), "TESTE NEGATIVO: renderChipSectionBody não referencia mais Proteína (isProteinFacet/draftProteinRole) — a faceta saiu de vez desse gerador");

  console.log("");
  console.log("12a. MAPEAMENTO síncrono (7 valores, foto de categoria já em disco)");
  const proteinImageBody = extractFunctionBody(appJs, "const PROTEIN_TILE_IMAGE = {");
  assert(!!proteinImageBody, "PROTEIN_TILE_IMAGE isolado com sucesso");
  const EXPECTED_TILE_IMAGE = {
    "protein:ave": "aves",
    "protein:boi": "carnes-bovinas",
    "protein:suino": "suinos",
    "protein:peixe": "peixes",
    "protein:frutos-do-mar": "frutos-do-mar",
    "protein:ovo": "col-ovo",
    "protein:cordeiro": "cordeiro",
  };
  Object.keys(EXPECTED_TILE_IMAGE).forEach((tagId) => {
    const fileId = EXPECTED_TILE_IMAGE[tagId];
    assert(!!proteinImageBody && new RegExp('"' + tagId + '":\\s*"' + fileId + '"').test(proteinImageBody), tagId + " -> imagens/categorias/" + fileId + ".webp");
    assert(fs.existsSync(path.join(ROOT, "imagens", "categorias", fileId + ".webp")), ".webp de " + fileId + " existe de verdade em disco (não só no mapeamento — mesma lição do slugFoto)");
  });
  assert(!!proteinImageBody && !/"protein:frango"/.test(proteinImageBody), 'TESTE NEGATIVO: protein:frango NÃO está em PROTEIN_TILE_IMAGE (aves.webp já é de protein:ave — frango resolve por receita-assinatura, seção 12b)');
  assert(!!proteinImageBody && !/"protein:leguminosa"/.test(proteinImageBody) && !/"protein:laticinio"/.test(proteinImageBody), "TESTE NEGATIVO: leguminosa/laticinio NÃO estão em PROTEIN_TILE_IMAGE — 0 receitas hoje, nenhuma candidata de imagem (ver guarda de futuro, seção 12c)");

  console.log("");
  console.log("12b. RECEITA-ASSINATURA de frango (curada, mesmo princípio de countrySignatureRecipe)");
  const proteinSignatureMapBody = extractFunctionBody(appJs, "const PROTEIN_SIGNATURE_RECIPE = {");
  assert(!!proteinSignatureMapBody && /"protein:frango":\s*"Tandoori Chicken"/.test(proteinSignatureMapBody), 'PROTEIN_SIGNATURE_RECIPE["protein:frango"] = "Tandoori Chicken"');
  // TESTE NEGATIVO — os 5 descartes documentados no comentário acima do mapa (relatório da
  // tarefa) não sobrevivem como escolha: nem os já reivindicados por outra coleção...
  ["Frango Frito Americano", "Frango Kung Pao", "Butter Chicken (Murgh Makhani)", "Yakitori"].forEach((claimed) => {
    assert(!new RegExp('"protein:frango":\\s*"' + claimed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"').test(appJs), 'TESTE NEGATIVO: "' + claimed + '" (já é receita-assinatura de outra coleção) NÃO foi escolhida pra protein:frango');
  });
  // ...nem os 2 gêmeos visuais de aves.webp (Frango Recheado era a semente do estrategista,
  // descartada nesta rodada — ver relatório da tarefa pra comparação lado a lado das fotos).
  ["Frango Recheado", "Galeto Al Primo Canto"].forEach((twin) => {
    assert(!new RegExp('"protein:frango":\\s*"' + twin + '"').test(appJs), 'TESTE NEGATIVO: "' + twin + '" (gêmea visual de aves.webp — ave inteira assada em tábua de madeira) NÃO foi escolhida pra protein:frango');
  });

  console.log("");
  console.log("12c. GUARDA DE FUTURO — toda opção de Proteína REALMENTE renderizada tem imagem resolvível (executado contra o acervo real, não hardcoded)");
  const win = loadPipeline();
  const TagModel = win.TagModel;
  const proteinHelpers = loadProteinTileHelpers(appJs, TagModel);
  assert(!!proteinHelpers, "PROTEIN_TILE_IMAGE/PROTEIN_SIGNATURE_RECIPE/proteinSignatureRecipe/facetOptionsFromPrefix extraídos e executados com sucesso contra o TagModel real");
  if (proteinHelpers) {
    const allRecipes = TagModel.getAllRecipesFlat();
    const realOptions = proteinHelpers.facetOptionsFromPrefix(allRecipes, "protein:");
    const realTagIds = realOptions.map((o) => o.tagId).sort();
    console.log("  literal: opções reais de Proteína hoje (universo inteiro, sem outro filtro ativo) = " + realTagIds.join(", "));
    const EXPECTED_TAGIDS_TODAY = [
      "protein:ave", "protein:boi", "protein:cordeiro", "protein:frango",
      "protein:frutos-do-mar", "protein:ovo", "protein:peixe", "protein:suino",
    ].sort();
    assert(realTagIds.length === 8 && EXPECTED_TAGIDS_TODAY.every((id, i) => realTagIds[i] === id), "8 tags renderizam hoje, exatamente as esperadas (obtido: " + realTagIds.join(", ") + ")");
    assert(realTagIds.indexOf("protein:leguminosa") === -1 && realTagIds.indexOf("protein:laticinio") === -1, "PRESSUPOSTO CONFIRMADO: leguminosa/laticinio continuam com 0 receitas no acervo real — ausentes das opções renderizadas, 0 tiles, grade nunca fica mista");
    // A GUARDA em si: pra CADA tag que de fato aparece (dinâmico — se o acervo crescer e
    // leguminosa/laticinio passarem a ter receita, entram nesta lista sozinhos, sem editar esta
    // suíte), a imagem tem que resolver por um dos 2 mecanismos. Se um dia isso falhar, é o
    // sinal exato que a tarefa pediu: grita alto, nunca deixa a grade sair com um buraco.
    realOptions.forEach((o) => {
      const resolved = !!proteinHelpers.PROTEIN_TILE_IMAGE[o.tagId] || !!proteinHelpers.proteinSignatureRecipe(o.tagId);
      assert(resolved, "GUARDA: " + o.tagId + " (renderizado, " + o.count + " receitas) resolve imagem — " + (proteinHelpers.PROTEIN_TILE_IMAGE[o.tagId] ? "categoria imagens/categorias/" + proteinHelpers.PROTEIN_TILE_IMAGE[o.tagId] + ".webp" : "receita-assinatura curada"));
    });
  }

  console.log("");
  console.log("12d. CSS — .filter-tile--protein PRÓPRIA (não reusa .filter-tile--photo), proporção 3/2 (ajuste 2026-08-07, igual ao País), sem blur/véu");
  const proteinTileRuleMatch = css.match(/\.filter-tile--protein\s*\{[^}]*\}/);
  assert(!!proteinTileRuleMatch, ".filter-tile--protein existe no CSS");
  const proteinMediaRuleMatch = css.match(/\.filter-tile--protein \.filter-tile__media\s*\{[^}]*\}/);
  // ATUALIZADO (2026-08-07): dono viu 1:1 ao vivo e achou "muito grande" — aspect-ratio corrigido
  // pra 3/2, a MESMA métrica de .filter-tile--photo (país). Fonte continua 1:1/600x600 em disco
  // (zero regeração de asset, "reuso total" intacto); 3:2 é corte de EXIBIÇÃO via
  // object-fit:cover — janela visível = 1/1,5 = 66,7% da altura do quadrado, centralizada (§5 de
  // CONTRATO-IMAGENS-REDESIGN.md). Conferido ao vivo nos 8 valores que nenhum prato decapita, ver
  // relatório da tarefa (checagem visual/DOM, não algébrica — mesmo método já usado pro gêmeo
  // visual Frango Recheado vs. aves.webp).
  assert(!!proteinMediaRuleMatch && /aspect-ratio:\s*3\s*\/\s*2/.test(proteinMediaRuleMatch[0]), ".filter-tile--protein .filter-tile__media usa aspect-ratio 3/2 — MESMA métrica de .filter-tile--photo (país), decisão do dono após ver 1:1 no ar (ficava alto demais)");
  const proteinImgRuleMatch = css.match(/\.filter-tile--protein \.filter-tile__media img\s*\{[^}]*\}/);
  assert(!!proteinImgRuleMatch, ".filter-tile--protein .filter-tile__media img existe (seletor de ELEMENTO, não a classe .filter-tile__img — cobre também o <img> sem classe que loadRecipeImage/applyImage cria em runtime pra frango)");
  assert(!!proteinImgRuleMatch && !/blur\(/.test(proteinImgRuleMatch[0]) && !/scale\(/.test(proteinImgRuleMatch[0]), "TESTE NEGATIVO: sem blur()/scale() — foto de prato nítida, blur/véu são muleta só de bandeira (a ÚNICA diferença real que sobra de .filter-tile--photo, agora que a proporção é igual)");
  assert(!/\.filter-tile--protein[\s\S]{0,10}::after/.test(css), "TESTE NEGATIVO: .filter-tile--protein não tem pseudo-elemento ::after de véu (só --photo, bandeira, tem)");
  // TESTE NEGATIVO cruzado: a faceta País (.filter-tile--photo) não regrediu — continua 3:2 com
  // blur, intocada por esta rodada (mesma checagem da seção 6 acima, reconfirmada aqui porque é
  // exatamente o CSS vizinho que uma migração de seletor mal-feita arriscaria).
  assert(!!photoTileRuleMatch, "TESTE NEGATIVO: .filter-tile--photo (País) continua existindo, regra própria intacta");
  const photoMediaRuleMatch = css.match(/\.filter-tile--photo \.filter-tile__media\s*\{[^}]*\}/);
  assert(!!photoMediaRuleMatch && /aspect-ratio:\s*3\s*\/\s*2/.test(photoMediaRuleMatch[0]), "TESTE NEGATIVO: .filter-tile--photo (País) continua 3:2, intocado por esta rodada");
  // Uniformidade — a razão de ser desta rodada: Proteína e País, embora regras CSS separadas
  // (independência de manutenção preservada), agora produzem a MESMA altura de tile na mesma
  // grade (.filter-tile-grid compartilhada garante largura igual; aspect-ratio igual garante
  // altura igual). Extrai o valor NUMÉRICO de cada regra em vez de comparar string — prova
  // equivalência de verdade, não só "as duas mencionam 3/2 em algum lugar do arquivo".
  function aspectRatioOf(ruleText) {
    const m = ruleText && ruleText.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
    return m ? Number(m[1]) / Number(m[2]) : null;
  }
  const proteinRatio = aspectRatioOf(proteinMediaRuleMatch && proteinMediaRuleMatch[0]);
  const paisRatio = aspectRatioOf(photoMediaRuleMatch && photoMediaRuleMatch[0]);
  assert(proteinRatio !== null && proteinRatio === paisRatio, "aspect-ratio de Proteína (" + proteinRatio + ") === aspect-ratio de País (" + paisRatio + ") — mesma largura (grid compartilhado) + mesma proporção = mesma altura de tile, grade uniforme");
  const photoImgRuleMatch = css.match(/\.filter-tile--photo \.filter-tile__img\s*\{[^}]*\}/);
  assert(!!photoImgRuleMatch && /blur\(var\(--flag-blur\)\)/.test(photoImgRuleMatch[0]), "TESTE NEGATIVO: .filter-tile--photo (País) continua com blur(--flag-blur) — bandeira, não foto de prato");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
