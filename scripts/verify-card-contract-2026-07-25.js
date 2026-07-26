// scripts/verify-card-contract-2026-07-25.js
//
// Suíte de verificação do REDESENHO COMPLETO do card de receita (item 2 de "DEIXAR PRO FABLE,
// DEPOIS", CHECKLIST-GERAL.md). O card antigo (foto 48x48 + título + origem + cat-chip +
// descrição + tags + meta de rodapé) morre por completo; nasce: foto 16:9 sangrando até as
// bordas + coração flutuante sobre a foto + faixa nome+1 chip, nada mais, em TODOS os 6 call
// sites (renderGrupo, renderCategory, renderBusca x3, renderMinhasReceitas).
//
// js/app.js é fortemente acoplado ao DOM sem UMD (mesma limitação de sempre, documentada em
// verify-recentes-ui-2026-07-25.js/verify-grupo-search-fromhash-2026-07-25.js) — verificado por
// texto exato do código-fonte (grep/.includes()/regex) para estrutura/CSS, MAS a regra da tag
// (tipo-de-prato > proteína; país só com 2+ filtros) é simulada de verdade: as duas funções
// puras hasMultiCountryFilter/singleCardTagId (sem closure sobre DOM/TagModel) são extraídas do
// texto-fonte e EXECUTADAS aqui com cenários fabricados — não é só grep, é comportamento real.
//
// Nenhuma comparação usa ref de git — só valores literais, regra do CLAUDE.md.
//
// `node scripts/verify-card-contract-2026-07-25.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
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

// Extrai "function NOME(...) { ... }" do texto-fonte (heurística já usada no projeto: fecha no
// primeiro "\n  }" de indentação 2 — nível de função top-level dentro da IIFE do app) e devolve
// a função de verdade, executável (via expressão, não declaração — eval("(" + src + ")") não
// depende de vazamento de escopo do eval, funciona igual em strict/non-strict).
function extractFn(src, name) {
  const re = new RegExp("function " + name + "\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\}");
  const m = src.match(re);
  if (!m) return { src: "", fn: null };
  let fn = null;
  try {
    fn = eval("(" + m[0] + ")");
  } catch (e) {
    fn = null;
  }
  return { src: m[0], fn: fn };
}

function main() {
  console.log("==================================================");
  console.log("1. Funções puras da regra de tag — EXECUTADAS, não só grepadas");
  console.log("==================================================");
  const multi = extractFn(appJs, "hasMultiCountryFilter");
  const single = extractFn(appJs, "singleCardTagId");
  assert(multi.src.length > 0, "hasMultiCountryFilter localizada no código-fonte");
  assert(typeof multi.fn === "function", "hasMultiCountryFilter é executável isoladamente (sem closure sobre DOM)");
  assert(single.src.length > 0, "singleCardTagId localizada no código-fonte");
  assert(typeof single.fn === "function", "singleCardTagId é executável isoladamente (sem closure sobre DOM)");

  if (typeof multi.fn === "function") {
    assert(multi.fn([]) === false, "0 filtros de país -> sem override");
    assert(multi.fn(["protein:frango"]) === false, "filtro sem nenhum country: -> sem override");
    assert(multi.fn(["country:franca"]) === false, "1 país só -> sem override (precisa 2+)");
    assert(multi.fn(["country:franca", "country:franca"]) === false, "país repetido (mesmo id 2x) -> conta como 1 distinto, sem override");
    assert(multi.fn(["country:franca", "country:italia"]) === true, "2 países DISTINTOS -> override ativo");
    assert(multi.fn(["country:franca", "country:italia", "protein:frango"]) === true, "2 países + outra faceta -> override continua ativo (país não precisa ser o único filtro)");
  }

  if (typeof single.fn === "function") {
    assert(
      single.fn({ tags: ["dish_type:massa", "protein:frango", "country:italia"] }, {}) === "dish_type:massa",
      "sem override: tipo-de-prato vence proteína (prioridade documentada)"
    );
    assert(
      single.fn({ tags: ["protein:frango", "country:italia"] }, {}) === "protein:frango",
      "sem override e sem dish_type: cai pra proteína (fallback)"
    );
    assert(
      single.fn({ tags: ["country:italia"] }, {}) === null,
      "sem override, só país disponível na receita: NUNCA mostra país (retorna null, sem chip) — regra central do redesenho"
    );
    assert(single.fn({ tags: [] }, {}) === null, "receita sem nenhuma tag relevante: sem chip (null), não quebra");
    assert(
      single.fn({ tags: ["dish_type:massa", "protein:frango", "country:italia"] }, { countryOverride: true }) === "country:italia",
      "COM override (2+ filtros de país ativos): país SUBSTITUI tipo-de-prato/proteína — não soma, disciplina de 1 chip"
    );
    assert(
      single.fn({ tags: ["dish_type:massa"] }, { countryOverride: true }) === "dish_type:massa",
      "override ativo mas receita sem tag country: própria -> cai pro fallback normal (tipo-de-prato), degradação graciosa"
    );
    assert(
      single.fn({ tags: ["protein:frango"] }, { countryOverride: false }) === "protein:frango",
      "teste negativo: override explicitamente false nunca escolhe país mesmo se existisse (aqui nem há country: pra ambiguidade)"
    );
  }

  console.log("");
  console.log("==================================================");
  console.log("2. Conteúdo do card — só foto, coração, nome e 1 chip");
  console.log("==================================================");
  const cardMatch = appJs.match(/function renderRecipeCard\(item, opts\)\s*\{[\s\S]*?\n  \}/);
  const cardBody = cardMatch ? cardMatch[0] : "";
  assert(cardBody.length > 0, "corpo de renderRecipeCard localizado pra análise");
  assert(cardBody.includes('card.className = "recipe-card"'), "raiz do card mantém a classe recipe-card (mesma área de toque/estados de sempre)");
  assert(cardBody.includes('"recipe-card__photo'), "card tem container de foto novo (recipe-card__photo)");
  assert(cardBody.includes('"recipe-card__heart'), "card mantém o botão de coração (recipe-card__heart)");
  assert(cardBody.includes('"recipe-card__body"'), "card tem a faixa de conteúdo nova (recipe-card__body)");
  assert(cardBody.includes('"recipe-card__name"'), "card tem o nome (recipe-card__name)");
  assert(cardBody.includes("singleCardTagId("), "card usa a função central da regra de 1 chip (não duplica a lógica inline)");
  assert(
    !/recipe-meta|cat-chip|catLabel|recipe-card-desc|recipe-card-context|recipe-header|recipe-thumb\b|"origin"|class="origin"/.test(cardBody),
    "sem meta/país-origem/descrição/cat-chip/contexto/thumb-antigo — teste NEGATIVO de conteúdo morto"
  );

  console.log("");
  console.log("==================================================");
  console.log("3. Foto — reusa loadRecipeImage/applyImage, nunca recria lógica (CONTRATO-IMAGENS-REDESIGN.md §3)");
  console.log("==================================================");
  assert(cardBody.includes("applyImage(photo, recipe.image)"), "usa applyImage(el, url) pra recipe.image manual");
  assert(cardBody.includes("loadRecipeImage(recipe, photo)"), "usa loadRecipeImage(recipe, el) — assinatura do contrato, recebe a receita inteira");
  assert(cardBody.includes('iconSvg("photoOff"'), "placeholder photoOff da Fase 0c reaproveitado pro estado sem foto");

  console.log("");
  console.log("==================================================");
  console.log("4. Coração — handler preservado, hit-area >=44px, NUNCA filho do elemento de foto");
  console.log("==================================================");
  assert(cardBody.includes("e.stopPropagation();"), "coração para propagação do clique (não navega pra receita ao favoritar)");
  assert(cardBody.includes("Storage.toggleFavorite(item.id)"), "coração alterna favorito via Storage.toggleFavorite (mesma API de sempre)");
  assert(cardBody.includes('heartBtn.setAttribute("aria-label", now ? "Remover dos favoritos" : "Favoritar")'), "aria-label do coração atualiza dinamicamente nos 2 estados");
  assert(cardBody.includes("HEART_ICON_SVG"), "reaproveita o mesmo SVG multi-estado do coração (não recria ícone)");
  // Estrutural: heartBtn precisa ser appendChild em `card` (ou num wrapper que NÃO seja o `photo`
  // que loadRecipeImage/applyImage gerencia) — nunca "photo.appendChild(heartBtn)", senão um
  // innerHTML="" tardio do applyImage (a foto local já é resolvida de forma assíncrona, mesmo
  // no caminho "rápido") apagaria o botão depois de criado.
  assert(!/photo\.appendChild\(heartBtn\)/.test(cardBody), "teste NEGATIVO: coração não é filho do container de foto (applyImage faz innerHTML='' nele, apagaria o botão)");
  assert(styleCss.includes(".recipe-card__heart::after {") && /\.recipe-card__heart::after\s*\{[\s\S]{0,60}inset:\s*-10px;/.test(styleCss), "hit-area invisível ::after preservada (mesma técnica Fase 0a, ~10px)");

  console.log("");
  console.log("==================================================");
  console.log("5. Acessibilidade — preservada da Fase 0a");
  console.log("==================================================");
  assert(cardBody.includes("makeKeyboardClickable(card)"), "card inteiro operável por teclado (role=button/tabIndex=0/Enter-Espaço)");
  assert(cardBody.includes('card.setAttribute("aria-label", "Ver receita de " + recipe.name)'), "aria-label descritivo com o nome da receita");

  console.log("");
  console.log("==================================================");
  console.log("6. Call sites — estrutura IDÊNTICA nos 6, divergência zero do cat-chip");
  console.log("==================================================");
  const site1 = 'recipeResultsEl.appendChild(renderRecipeCard(item, { fromHash: fromHash }));';
  const site2 = 'sortedItems.forEach((item) => listEl.appendChild(renderRecipeCard(item, { fromHash: fromHash, countryOverride: countryOverride })));';
  const site3 = 'resultsEl.appendChild(renderRecipeCard(item, { fromHash: fromHash, countryOverride: countryOverride }));';
  const site4 = 'resultsEl.appendChild(renderRecipeCard(r.item, { fromHash: fromHash, countryOverride: countryOverride }));';
  const site6 = 'content.appendChild(renderRecipeCard(item, { fromHash: fromHash }));';
  assert(appJs.includes(site1), "renderGrupo (busca por ingrediente dentro de hub): call site sem catLabel");
  assert(appJs.includes(site2), "renderCategory: call site com countryOverride calculado (hasMultiCountryFilter dos filtros ativos da coleção)");
  assert(appJs.includes(site3), "renderBusca (renderResults): call site com countryOverride dos filtros ativos da busca");
  const site4Count = appJs.split(site4).length - 1;
  assert(site4Count === 2, "renderBusca (renderPreviewSection + fallback parcial): as outras 2 call sites, texto idêntico entre si (mesma construção de opts)");
  assert(appJs.includes(site6), "renderMinhasReceitas: call site sem catLabel");
  assert(!appJs.includes("catLabel"), "teste NEGATIVO GLOBAL: 'catLabel' não sobrevive em nenhum lugar do arquivo");
  assert(!appJs.includes("cat-chip"), "teste NEGATIVO GLOBAL: 'cat-chip' não sobrevive em nenhum lugar do app.js");
  const countryOverrideKeyCount = appJs.split("countryOverride:").length - 1;
  assert(countryOverrideKeyCount === 4, "countryOverride: aparece em exatamente 4 call sites (renderCategory 1 + renderBusca 3) — renderGrupo/renderMinhasReceitas não fabricam um filtro de país que não existe nessas telas");

  console.log("");
  console.log("==================================================");
  console.log("7. CSS — componente novo presente, componente antigo removido");
  console.log("==================================================");
  assert(/\.recipe-card\s*\{[^}]*position:\s*relative;/.test(styleCss), ".recipe-card é a base de posicionamento do coração flutuante (position: relative)");
  assert(/\.recipe-card\s*\{[^}]*overflow:\s*hidden;/.test(styleCss), ".recipe-card corta a foto nos cantos superiores pelo próprio raio (overflow: hidden), sem raio duplicado na foto");
  assert(!/\.recipe-card\s*\{[^}]*padding:\s*var\(--space-4\)\s*var\(--space-5\);/.test(styleCss), "teste NEGATIVO: .recipe-card não tem mais padding fixo (a foto sangra até a borda; o padding migrou pro recipe-card__body)");
  assert(styleCss.includes(".recipe-card__photo {") && /\.recipe-card__photo\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/.test(styleCss), "foto do card é 16:9 (janela segura do recorte 4:3, §5 do contrato de imagens)");
  assert(styleCss.includes(".recipe-card__body {") && /\.recipe-card__body\s*\{[^}]*padding:\s*var\(--space-4\)\s*var\(--space-5\);/.test(styleCss), "faixa de conteúdo herda o padding padrão de card (16px/20px, tokens)");
  assert(/\.recipe-card__body\s*\{[^}]*display:\s*flex;/.test(styleCss) && /\.recipe-card__body\s*\{[^}]*align-items:\s*flex-start;/.test(styleCss), "nome+chip na mesma faixa, alinhados ao topo (chip acompanha a 1ª linha do nome)");
  assert(/\.recipe-card__tag\s*\{[^}]*flex-shrink:\s*0;/.test(styleCss), "chip nunca encolhe/quebra (nowrap) — só o nome quebra por baixo");
  assert(styleCss.includes(".recipe-card__name {") && /\.recipe-card__name\s*\{[^}]*-webkit-line-clamp:\s*2;/.test(styleCss), "nome até 2 linhas (clamp)");
  assert(/\.recipe-card__name\s*\{[^}]*font-family:\s*var\(--font-display\);/.test(styleCss) && /\.recipe-card__name\s*\{[^}]*font-size:\s*var\(--text-md\);/.test(styleCss), "nome em --font-display 19px (--text-md), peso 400 (regra 0b)");
  assert(styleCss.includes(".recipe-card__heart {") && /\.recipe-card__heart\s*\{[^}]*background:\s*rgba\(15, 15, 14, 0\.55\);/.test(styleCss), "coração usa o mesmo véu do chrome-float");
  assert(/\.recipe-card__heart\s*\{[^}]*border:\s*1px solid var\(--color-border\);/.test(styleCss), "coração usa a mesma borda 1px do chrome-float");
  assert(/\.recipe-card__heart\s*\{[^}]*width:\s*36px;/.test(styleCss) && /\.recipe-card__heart\s*\{[^}]*height:\s*36px;/.test(styleCss), "coração ~36px visual, conforme spec");
  assert(/\.recipe-card__heart\s*\{[^}]*position:\s*absolute;/.test(styleCss), "coração flutua sobre a foto (position: absolute)");
  assert(
    styleCss.includes(".recipe-card__heart .recipe-heart-icon path {") && /\.recipe-card__heart \.recipe-heart-icon path\s*\{[^}]*stroke:\s*var\(--color-text-primary\);/.test(styleCss),
    "contorno parado do coração usa --color-text-primary (não --color-text-disabled) SÓ no card — sobre foto, --color-text-disabled falha 3:1 WCAG (~1.2:1 a 1.6:1 calculado); .recipe-page-heart (sobre superfície sólida) fica com a regra base, não tocada"
  );
  // Negativo: componente antigo inteiro removido do CSS.
  assert(!styleCss.includes(".recipe-header {"), "teste NEGATIVO: .recipe-header (grid antigo) removido");
  assert(!styleCss.includes(".recipe-thumb {"), "teste NEGATIVO: .recipe-thumb (foto 48x48 antiga) removida");
  assert(!styleCss.includes(".recipe-title {"), "teste NEGATIVO: .recipe-title removida");
  assert(!styleCss.includes(".recipe-title .cat-chip"), "teste NEGATIVO: .cat-chip removido — morre em TODOS os contextos");
  assert(!styleCss.includes(".recipe-card-desc {"), "teste NEGATIVO: .recipe-card-desc (descrição) removida");
  assert(!styleCss.includes(".recipe-card-context {"), "teste NEGATIVO: .recipe-card-context (badge morto de contextTagId) removida");
  assert(!styleCss.includes(".recipe-meta {") && !styleCss.includes(".recipe-meta-item {"), "teste NEGATIVO: .recipe-meta/.recipe-meta-item (tempo/dificuldade/porções) removidas");
  assert(!appJs.includes("opts.contextTagId"), "teste NEGATIVO: contextTagId (já era código morto, nenhum call site usava) removido junto");

  console.log("");
  console.log("==================================================");
  console.log("8. Service worker — CACHE_NAME v25 -> v26 no mesmo commit");
  console.log("==================================================");
  assert(swJs.includes('const CACHE_NAME = "cardapio-v26";'), "CACHE_NAME v26 (css/style.css e js/app.js mudaram)");
  assert(!swJs.includes('const CACHE_NAME = "cardapio-v25";'), "v25 não sobrevive — teste negativo");

  console.log("");
  console.log("==================================================");
  console.log("9. Docs e skills atualizadas no mesmo commit (regra do CLAUDE.md)");
  console.log("==================================================");
  const mobileSkill = fs.readFileSync(path.join(ROOT, ".claude", "skills", "mobile-recipe-ui", "SKILL.md"), "utf8");
  const tokensDoc = fs.readFileSync(path.join(ROOT, "docs", "DESIGN-TOKENS.md"), "utf8");
  assert(mobileSkill.includes("recipe-card__photo") || mobileSkill.includes("Redesenho completo"), "skill mobile-recipe-ui documenta o card novo");
  assert(/cat-chip/i.test(mobileSkill) && /morr/i.test(mobileSkill), "skill documenta explicitamente a morte do cat-chip");
  assert(mobileSkill.toLowerCase().includes("2+") || mobileSkill.includes("2 países") || mobileSkill.includes("2 filtros"), "skill documenta a regra do país com 2+ filtros ativos");
  assert(tokensDoc.includes("recipe-card__photo") || tokensDoc.includes("Card de receita — redesenho"), "DESIGN-TOKENS.md documenta o spec do componente novo");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
