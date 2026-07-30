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
  assert(cardBody.includes('"recipe-card__row"'), "nome+chip moraram num sub-bloco próprio (recipe-card__row), pra descrição poder ficar abaixo sem quebrar o alinhamento deles");
  assert(cardBody.includes('"recipe-card__name"'), "card tem o nome (recipe-card__name)");
  assert(cardBody.includes("singleCardTagId("), "card usa a função central da regra de 1 chip (não duplica a lógica inline)");
  assert(
    !/recipe-meta|cat-chip|catLabel|recipe-card-context|recipe-header|recipe-thumb\b|"origin"|class="origin"/.test(cardBody),
    "sem meta/país-origem/cat-chip/contexto/thumb-antigo — teste NEGATIVO de conteúdo morto (descrição NÃO entra mais nesta lista — voltou, ver seção 2b)"
  );

  console.log("");
  console.log("==================================================");
  console.log("2b. Descrição — linha única condicional (ajuste de julgamento visual, 2026-07-25)");
  console.log("==================================================");
  assert(cardBody.includes("if (recipe.desc)"), "descrição só é criada quando recipe.desc existe — sem isso, linha fantasma vazia");
  assert(cardBody.includes('"recipe-card__desc"'), "descrição usa a classe nova recipe-card__desc");
  assert(cardBody.includes("desc.textContent = recipe.desc"), "descrição usa textContent (nunca innerHTML — recipe.desc é texto livre, não HTML)");
  // Teste estrutural: a criação do elemento de descrição precisa estar DENTRO do
  // `if (recipe.desc) { ... }` — não pode ser criada incondicionalmente e só populada depois.
  const descGuardMatch = cardBody.match(/if \(recipe\.desc\) \{[\s\S]*?\n {4}\}/);
  assert(!!descGuardMatch && descGuardMatch[0].includes('"recipe-card__desc"'), "a criação do elemento (não só o texto) fica dentro do guard condicional, indentação de 4 espaços fecha o if");

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
  // Higiene 2026-07-30: o motor unificado de busca (commit 8fee82c, 2026-07-29) reestruturou
  // renderGrupo pro mesmo padrão block1/block2 de resultado que renderBusca já usa (ver site4
  // logo abaixo, que já esperava "r.item") — o loop passou de "item" solto pra "r.item" (item
  // vira um wrapper {item, ...} do resultado de busca). Confirmado ao vivo (busca por "limão"
  // dentro do hub Proteínas, 80 resultados): card renderizado é .recipe-card padrão, ZERO
  // .cat-chip/"catLabel" no HTML — divergência zero preservada, só o nome da variável do loop
  // mudou. Sem relação com card/catLabel nenhuma.
  const site1 = 'recipeResultsEl.appendChild(renderRecipeCard(r.item, { fromHash: fromHash }));';
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
  // Ajuste de julgamento visual (2026-07-25): 16:9 -> 2:1. §5 do CONTRATO-IMAGENS-REDESIGN:
  // 2:1 mostra 67% da altura do master (4/(3*2)), ainda dentro da janela segura 1:1->2:1 — o
  // prato (y 25%-80% medido no master) cabe inteiro no recorte central de 67% (y 16,5%-83,5%
  // com object-position padrão/center, sem ajuste). Ver relatório da tarefa pra inspeção visual
  // de 3 fotos variadas confirmando isso na prática, não só na fórmula.
  assert(!styleCss.includes("aspect-ratio: 16 / 9;") || !/\.recipe-card__photo\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/.test(styleCss), "teste NEGATIVO: foto do card não é mais 16:9");
  assert(styleCss.includes(".recipe-card__photo {") && /\.recipe-card__photo\s*\{[^}]*aspect-ratio:\s*2\s*\/\s*1;/.test(styleCss), "foto do card é 2:1 (janela segura do recorte 4:3, §5 do contrato de imagens — 67% da altura do master)");
  assert(styleCss.includes(".recipe-card__body {") && /\.recipe-card__body\s*\{[^}]*padding:\s*var\(--space-4\)\s*var\(--space-5\);/.test(styleCss), "faixa de conteúdo herda o padding padrão de card (16px/20px, tokens)");
  assert(
    styleCss.includes(".recipe-card__row {") && /\.recipe-card__row\s*\{[^}]*display:\s*flex;/.test(styleCss) && /\.recipe-card__row\s*\{[^}]*align-items:\s*flex-start;/.test(styleCss),
    "nome+chip na mesma faixa (recipe-card__row), alinhados ao topo (chip acompanha a 1ª linha do nome) — extraído de recipe-card__body pra descrição poder ficar abaixo em bloco simples"
  );
  assert(/\.recipe-card__tag\s*\{[^}]*flex-shrink:\s*0;/.test(styleCss), "chip nunca encolhe/quebra (nowrap) — só o nome quebra por baixo");
  // Ajuste fino do dono (2026-07-25, mesmo dia): teto de 1 linha virou teto de 2 (clamp),
  // decisão definitiva em revisão visual. nowrap/text-overflow:ellipsis (1 linha) saem;
  // entra o mesmo padrão de clamp já usado em recipe-card__name (display:-webkit-box +
  // -webkit-line-clamp + -webkit-box-orient:vertical + overflow:hidden) — teto, não piso:
  // descrição curta que caiba em 1 linha ocupa só 1, sem altura reservada fantasma.
  assert(!/\.recipe-card__desc\s*\{[^}]*white-space:\s*nowrap;/.test(styleCss), "teste NEGATIVO: descrição não é mais nowrap de 1 linha só");
  assert(
    styleCss.includes(".recipe-card__desc {") &&
      /\.recipe-card__desc\s*\{[^}]*display:\s*-webkit-box;/.test(styleCss) &&
      /\.recipe-card__desc\s*\{[^}]*-webkit-line-clamp:\s*2;/.test(styleCss) &&
      /\.recipe-card__desc\s*\{[^}]*-webkit-box-orient:\s*vertical;/.test(styleCss) &&
      /\.recipe-card__desc\s*\{[^}]*overflow:\s*hidden;/.test(styleCss),
    "descrição: teto de 2 linhas por clamp (display:-webkit-box + -webkit-line-clamp:2 + -webkit-box-orient:vertical + overflow:hidden)"
  );
  assert(/\.recipe-card__desc\s*\{[^}]*line-height:\s*var\(--leading-snug\);/.test(styleCss), "descrição usa --leading-snug (token, mesma leitura apertada de legenda que o resto do card)");
  assert(
    /\.recipe-card__desc\s*\{[^}]*font-size:\s*var\(--text-sm\);/.test(styleCss) && /\.recipe-card__desc\s*\{[^}]*color:\s*var\(--color-text-secondary\);/.test(styleCss),
    "descrição em --text-sm / --color-text-secondary, conforme spec do ajuste"
  );
  assert(/\.recipe-card__desc\s*\{[^}]*margin-top:\s*var\(--space-1\);/.test(styleCss), "margem da descrição por token (--space-1), nunca valor literal");
  assert(styleCss.includes(".recipe-card__name {") && /\.recipe-card__name\s*\{[^}]*-webkit-line-clamp:\s*2;/.test(styleCss), "nome até 2 linhas (clamp)");
  assert(/\.recipe-card__name\s*\{[^}]*font-family:\s*var\(--font-display\);/.test(styleCss) && /\.recipe-card__name\s*\{[^}]*font-size:\s*var\(--text-md\);/.test(styleCss), "nome em --font-display 19px (--text-md), peso 400 (regra 0b)");
  assert(styleCss.includes(".recipe-card__heart {") && /\.recipe-card__heart\s*\{[^}]*background:\s*rgba\(15, 15, 14, 0\.55\);/.test(styleCss), "coração usa o mesmo véu do chrome-float");
  assert(/\.recipe-card__heart\s*\{[^}]*border:\s*1px solid var\(--color-border\);/.test(styleCss), "coração usa a mesma borda 1px do chrome-float");
  assert(/\.recipe-card__heart\s*\{[^}]*width:\s*36px;/.test(styleCss) && /\.recipe-card__heart\s*\{[^}]*height:\s*36px;/.test(styleCss), "coração ~36px visual, conforme spec");
  assert(/\.recipe-card__heart\s*\{[^}]*position:\s*absolute;/.test(styleCss), "coração flutua sobre a foto (position: absolute)");
  // Atualizado (item 1 de "Deixar pro Fable, depois", redesenho da página de receita): o
  // seletor virou uma lista combinada — .recipe-hero__heart (coração novo sobre a foto fixa da
  // receita) entrou no MESMO caso de contraste (sobre foto, fundo imprevisível) e foi
  // adicionado ao seletor em vez de duplicar a regra. O comportamento do coração do CARD
  // (--color-text-primary sobre o véu) é idêntico ao de antes — só o texto exato do seletor
  // mudou de single pra combinado.
  assert(
    styleCss.includes(".recipe-card__heart .recipe-heart-icon path,") && /\.recipe-card__heart \.recipe-heart-icon path,[\s\S]{0,80}\.recipe-hero__heart \.recipe-heart-icon path\s*\{[^}]*stroke:\s*var\(--color-text-primary\);/.test(styleCss),
    "contorno parado do coração usa --color-text-primary (não --color-text-disabled) SÓ no card — sobre foto, --color-text-disabled falha 3:1 WCAG (~1.2:1 a 1.6:1 calculado); .recipe-page-heart (sobre superfície sólida) fica com a regra base, não tocada — seletor agora combinado com .recipe-hero__heart (mesmo caso), ver mobile-recipe-ui/SKILL.md"
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
  // Atualizado (item 1 de "Deixar pro Fable, depois"): css/style.css e js/app.js mudaram de
  // novo no redesenho da página de receita, v26 -> v27 — esta asserção acompanha o bump MAIS
  // RECENTE, mesma regra das outras suítes desta família (nunca prender a versão no passado).
  // v29 -> v30: hotfix 2026-07-26 (pointer-events da whitelist de body), não uma rodada desta
  // feature — ver scripts/verify-filter-modal-pointer-events-2026-07-26.js.
  // v30 -> v31: leva final de sobras (2026-07-26) — header de ingredientes, js/app.js mudou de
  // novo, também fora desta feature.
  // v31 -> v32: fix pontual (2026-07-26) — centralização vertical do mesmo header de
  // ingredientes, css/style.css mudou de novo, também fora desta feature.
  // v33 -> v34: rumo novo de Países (2026-07-26) — mural de bandeiras extinto, tile de país
  // vira foto de receita-assinatura, css/style.css e js/app.js mudaram de novo, fora desta
  // feature. v34 -> v35: calibração final do banner de hub (2026-07-26) — blur/scale removidos
  // de .grupo-banner__img, só css/style.css, também fora desta feature.
  assert(swJs.includes('const CACHE_NAME = "cardapio-v53";'), "CACHE_NAME v36 -> ... -> v52 -> v53 (F1c 2026-07-30: mais um bump de feature externa, atualizado pro valor vigente)");
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
