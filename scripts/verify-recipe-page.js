// scripts/verify-recipe-page.js
//
// Suíte do item 1 de "Deixar pro Fable, depois" (CHECKLIST-GERAL.md): redesenho completo da
// página de receita. Efeito de foto fixa (position:fixed, z-index:-1, sem token — resolve pela
// ordem natural do fluxo, ver comentário do z-index no CSS) + folha que desliza por cima
// (.recipe-page vira o "sheet": full-bleed, cantos superiores arredondados, --radius-sheet) +
// coração novo sobre a foto (substitui Favoritar da linha de botões) + funil de informação
// reordenado (título > descrição > tags > metadados em blocos > CTA > secundários >
// ingredientes com porções realocadas + chevron discreto > modo de preparo).
//
// Escrita ANTES da implementação (TDD) — rodada 1 destas asserções falha contra o código
// pré-mudança de propósito; a implementação que se segue é o que faz virar verde.
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte,
// nunca por ref de git (regra do CLAUDE.md: só literais). CRLF (\r\n): sliceFn usa "\r\n  function "
// como fim de função (mesmo padrão de verify-back-float-2026-07-25.js).
//
// `node scripts/verify-recipe-page.js` — sai com código != 0 se algo falhar.

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

function sliceFn(src, startMarker, label) {
  const start = src.indexOf(startMarker);
  assert(start > 0, label + ": marca de início encontrada");
  let end = src.indexOf("\r\n  function ", start + startMarker.length);
  if (end < 0) end = src.length;
  assert(end > start, label + ": marca de fim encontrada (depois do início)");
  return src.slice(start, end);
}

// Extrai uma regra CSS simples "seletor { ... }" (sem chaves aninhadas — nenhuma regra deste
// arquivo usa @media aninhado dentro de um seletor de componente). fromIndex pula overrides
// de @media com o MESMO seletor que apareçam antes da regra base no arquivo (ex.: .recipe-page
// tem um override de margin-top dentro de @media (max-width: 700px) ANTES da regra base).
function sliceRule(source, selectorStart, label, fromIndex) {
  const start = source.indexOf(selectorStart, fromIndex || 0);
  assert(start > 0, label + ": seletor encontrado no CSS");
  const end = source.indexOf("}", start);
  assert(end > start, label + ": fim da regra encontrado");
  return source.slice(start, end);
}

function main() {
  console.log("==================================================");
  console.log("1. TOKENS NOVOS — --radius-sheet (20px) e --hero-h (rodada 2: revisão do dono, foto maximizada)");
  console.log("==================================================");
  assert(css.includes("--radius-sheet: 20px;"), "--radius-sheet: 20px declarado em :root");
  assert(
    /--hero-h:\s*clamp\(\s*50vw\s*,\s*52vh\s*,\s*125vw\s*\);/.test(css),
    "--hero-h: clamp(50vw, 52vh, 125vw) declarado em :root — janela travada entre 2:1 (50vw) e 4:5 (125vw), a faixa segura do §5 do contrato de imagens"
  );

  console.log("");
  console.log("==================================================");
  console.log("2. HERO FIXO E MAXIMIZADO — position:fixed + z-index:-1, altura via --hero-h (rodada 2) — CONTRATO §6.2 PRESERVADO, §6.1/§5 ATUALIZADOS (ver docs)");
  console.log("==================================================");
  const heroRule = sliceRule(css, ".recipe-hero {", "regra .recipe-hero");
  assert(heroRule.includes("position: fixed;"), ".recipe-hero agora é position:fixed (foto de topo fixa)");
  assert(/z-index:\s*-1;/.test(heroRule), ".recipe-hero usa z-index negativo — ABAIXO do conteúdo que desliza por cima, sem novo token na escala");
  assert(heroRule.includes("top: 0;") && heroRule.includes("left: 0;"), ".recipe-hero ancorado no topo-esquerda do viewport (largura total, ignora padding de #main)");
  // Rodada 2 (revisão do dono, "FOTO MAXIMIZADA"): aspect-ratio:16/9 fixo foi SUBSTITUÍDO por
  // height:var(--hero-h) (clamp proporcional ao viewport) — a intenção original era uma foto
  // BEM maior que 16:9. object-position:center bottom continua intocado (checado abaixo) —
  // só a ALTURA da caixa mudou de mecanismo, não o enquadramento vertical dentro dela.
  assert(/height:\s*var\(--hero-h\);/.test(heroRule), "altura via var(--hero-h) — clamp proporcional ao viewport, substitui aspect-ratio:16/9 fixo (rodada 2)");
  assert(!/aspect-ratio:\s*16\s*\/\s*9/.test(heroRule), "TESTE NEGATIVO: aspect-ratio:16/9 fixo não sobra na regra (substituído por --hero-h)");
  assert(!/border-radius:\s*var\(--radius\);/.test(heroRule), "raio do card antigo removido do hero (agora bleed total, o raio visível é o da FOLHA por cima, --radius-sheet)");
  const heroImgRule = sliceRule(css, ".recipe-hero img {", "regra .recipe-hero img");
  assert(/object-position:\s*center bottom/.test(heroImgRule), "CONTRATO §6.2 PRESERVADO: object-position: center bottom intocado (esconde parede/janela em ~metade das fotos, ver CONTRATO-IMAGENS-REDESIGN.md)");
  assert(heroImgRule.includes("object-fit: cover;"), "object-fit: cover preservado");

  console.log("");
  console.log("2b. VÉU DEGRADÊ NO TOPO — mitigação nova pro §6.2 (a caixa mais alta re-expõe parede/janela do topo do master)");
  console.log("==================================================");
  const heroBeforeRule = sliceRule(css, ".recipe-hero::before {", "regra .recipe-hero::before (véu degradê)");
  assert(
    /background:\s*linear-gradient\(to bottom,\s*rgba\(15,\s*15,\s*14,\s*0\.55\),\s*transparent 30%\);/.test(heroBeforeRule),
    "gradiente linear-gradient(to bottom, rgba(15,15,14,0.55), transparent 30%)"
  );
  assert(/pointer-events:\s*none;/.test(heroBeforeRule), "pointer-events:none — véu é só visual, não intercepta clique (coração/back-float continuam funcionando através dele)");
  assert(/position:\s*absolute;/.test(heroBeforeRule) && /inset:\s*0;/.test(heroBeforeRule), "cobre a caixa inteira do hero (position:absolute + inset:0, containing block é o próprio .recipe-hero, que é position:fixed)");

  console.log("");
  console.log("==================================================");
  console.log("3. FOLHA — .recipe-page vira o sheet: full-bleed, fundo --color-bg, cantos superiores --radius-sheet, margem calculada");
  console.log("==================================================");
  // fromIndex a partir do comentário "A FOLHA" (marca única, só existe uma vez) — pula o
  // override de margin-top pro MESMO seletor .recipe-page dentro de @media (max-width: 700px),
  // que aparece mais cedo no arquivo que a regra base.
  const folhaComment = css.indexOf("/* A FOLHA");
  assert(folhaComment > 0, "comentário 'A FOLHA' encontrado (âncora pra regra base de .recipe-page)");
  const pageRule = sliceRule(css, ".recipe-page {", "regra .recipe-page", folhaComment);
  assert(pageRule.includes("background: var(--color-bg);"), "folha com fundo var(--color-bg) (mesmo tom do body — some visualmente, só o raio+sombra da foto por trás denuncia a borda)");
  assert(pageRule.includes("border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;"), "cantos SUPERIORES arredondados com --radius-sheet, base reta (raio só faz sentido no topo, onde cobre a foto)");
  assert(/margin-left:\s*calc\(50% - 50vw\)/.test(pageRule), "folha em bleed total (escapa do padding/max-width de #main) via a técnica 50vw, não depende de rastrear o padding de #main por breakpoint");
  // Rodada 2 (revisão do dono): a folha deixou de cobrir 50% do hero antes de rolar — agora
  // começa quase no fim dele (só os últimos 24px cobertos), pra "foto grande + beirada
  // arredondada da folha com o começo do título" ficar visível antes de qualquer scroll.
  // Substitui a fórmula antiga (100vw*9/32, calibração do CONTRATO na época do hero 16:9).
  assert(/margin-top:\s*calc\(var\(--hero-h\)\s*-\s*24px/.test(pageRule), "margin-top = var(--hero-h) - 24px (rodada 2: folha começa quase no fim do hero, não mais na metade)");
  assert(!/margin-top:\s*calc\(100vw \* 9 \/ 32/.test(pageRule), "TESTE NEGATIVO: fórmula antiga (50% do hero 16:9) não sobra na regra base");
  assert(!/position:\s*(relative|absolute|fixed|sticky)/.test(pageRule), ".recipe-page continua sem position (static por padrão, sem contexto de empilhamento novo) — hero/coração (z-index negativo) escapam corretamente pra trás de TODO o conteúdo da folha, não só dela");
  // Rodada 3 (revisão do dono, "moldura consistente"): título estava colado na borda
  // esquerda/superior arredondada da folha (padding era só horizontal, 0 no topo). Padding-top
  // novo cria respiro entre a curva do raio e o início do conteúdo.
  assert(/padding:\s*var\(--space-6\)\s*var\(--space-5\)\s*0;/.test(pageRule), "padding: --space-6 (24px) no topo, --space-5 (20px) nas laterais, 0 embaixo (rodada 3)");

  console.log("");
  console.log("==================================================");
  console.log("4. CORAÇÃO SOBRE A FOTO — novo, mesmo componente visual do card, camada entre foto e folha");
  console.log("==================================================");
  const heartRule = sliceRule(css, ".recipe-hero__heart {", "regra .recipe-hero__heart");
  assert(heartRule.includes("position: fixed;"), "coração da receita é fixed (acompanha a foto, não o scroll)");
  assert(/z-index:\s*-1;/.test(heartRule), "coração no MESMO bucket negativo do hero — acima da foto (depois no DOM), abaixo da folha (que é bucket positivo/normal)");
  assert(heartRule.includes("width: 36px;") && heartRule.includes("height: 36px;"), "36px visual — mesmo tamanho do coração do card, não o de 44px do back-float");
  assert(heartRule.includes("border-radius: 50%;"), "círculo, mesma forma do coração do card");
  assert(heartRule.includes("background: rgba(15, 15, 14, 0.55);"), "mesmo véu do chrome-float/coração do card");
  assert(/env\(safe-area-inset-top\)/.test(heartRule) && /env\(safe-area-inset-right\)/.test(heartRule), "respeita safe-area (notch/ilha dinâmica), topo-DIREITA (espelha o back-float, que é topo-esquerda)");
  assert(css.includes(".recipe-hero__heart::after"), "hit-padding invisível (::after) — mesma técnica do coração do card/portion-stepper");
  assert(
    css.includes(".recipe-card__heart .recipe-heart-icon path,\r\n.recipe-hero__heart .recipe-heart-icon path {"),
    "contorno --color-text-primary (não --color-text-disabled) sobre a foto — seletor combinado com o coração do card (mesmo motivo de contraste WCAG, reaproveitado sem recalcular)"
  );

  console.log("");
  console.log("==================================================");
  console.log("5. JS renderReceita — coração é elemento IRMÃO do hero, NUNCA filho (applyImage/loadRecipeImage fazem el.innerHTML=\"\" async e apagariam um coração aninhado)");
  console.log("==================================================");
  const receitaFnBody = sliceFn(appJs, "function renderReceita(id, fromHash) {", "renderReceita");
  assert(/page\.appendChild\(hero\);[\s\S]{0,400}?page\.appendChild\(heart\)/.test(receitaFnBody) || /const heart = document\.createElement/.test(receitaFnBody), "elemento heart construído em renderReceita, adicionado como filho de page (irmão do hero) — não de hero");
  assert(!/hero\.appendChild\(heart\)/.test(receitaFnBody), "TESTE NEGATIVO: heart NUNCA é filho de hero (applyImage/loadRecipeImage fariam hero.innerHTML=\"\" apagar o coração assim que a foto resolvesse)");
  assert(receitaFnBody.includes('"recipe-hero__heart"') || receitaFnBody.includes("recipe-hero__heart"), "classe recipe-hero__heart usada na construção do coração da receita");

  console.log("");
  console.log("==================================================");
  console.log("6. FAVORITAR SAI DA LINHA DE BOTÕES — actions só tem 2 (Já fiz + Adicionar à lista de compras)");
  console.log("==================================================");
  assert(!/actions\.appendChild\(favBtn\)/.test(receitaFnBody), "TESTE NEGATIVO: favBtn não é mais filho de actions");
  assert(receitaFnBody.includes("actions.appendChild(madeBtn)"), "madeBtn (Já fiz / Marcar como feita) continua em actions");
  assert(receitaFnBody.includes("actions.appendChild(shoppingBtn)"), "shoppingBtn (Adicionar à lista de compras) continua em actions");
  const actionsAppendCount = (receitaFnBody.match(/actions\.appendChild\(/g) || []).length;
  assert(actionsAppendCount === 2, "exatamente 2 appendChild em actions (madeBtn + shoppingBtn) — Favoritar não é o 3º, " + actionsAppendCount + " encontrados");

  console.log("");
  console.log("==================================================");
  console.log("7. FUNIL — ordem exata: título/desc > tags > metadados > CTA > secundários > ingredientes > modo de preparo");
  console.log("==================================================");
  const iTitle = receitaFnBody.indexOf("page.appendChild(titleBlock)");
  const iTags = receitaFnBody.indexOf("buildTagChipsEl(pageTagIds");
  const iMeta = receitaFnBody.indexOf("page.appendChild(metaRow)");
  const iCookBtn = receitaFnBody.indexOf("page.appendChild(cookBtn)");
  const iActions = receitaFnBody.indexOf("page.appendChild(actions)");
  const iIngSection = receitaFnBody.indexOf("page.appendChild(ingSection)");
  const iStepsSection = receitaFnBody.indexOf("page.appendChild(stepsSection)");
  assert(iTitle > 0, "titleBlock apendado");
  assert(iTags > iTitle, "tags DEPOIS do título/descrição (era antes dos metadados, spec 3c)");
  assert(iMeta > iTags, "metadados DEPOIS das tags (spec 3d)");
  assert(iCookBtn > iMeta, "CTA 'Começar preparo' DEPOIS dos metadados");
  assert(iCookBtn > 0 && iActions > 0 && iCookBtn < iActions, "CTA primário (e) vem ANTES dos 2 secundários (f) — era o inverso antes desta rodada");
  assert(iIngSection > iActions, "Ingredientes DEPOIS das ações (spec g)");
  assert(iStepsSection > iIngSection, "Modo de preparo DEPOIS de Ingredientes (spec h)");

  console.log("");
  console.log("==================================================");
  console.log("8. METADADOS EM BLOCOS ROTULADOS — grade 2x2 FIXA (rodada 2: revisão do dono, DIFICULDADE truncava em flex-de-4 a 390px)");
  console.log("==================================================");
  const metaRowRule = sliceRule(css, ".recipe-page-meta {", "regra .recipe-page-meta");
  assert(/display:\s*grid;/.test(metaRowRule), "grade FIXA 2x2 (display:grid) — TESTE NEGATIVO implícito: não é mais flex-de-4 com fallback condicional");
  assert(/grid-template-columns:\s*1fr 1fr;|grid-template-columns:\s*repeat\(2,\s*1fr\);/.test(metaRowRule), "2 colunas iguais — sempre 2x2, nunca tenta 4 numa linha só");
  assert(css.includes(".recipe-meta-block {"), "classe .recipe-meta-block declarada");
  const metaBlockRule = sliceRule(css, ".recipe-meta-block {", "regra .recipe-meta-block");
  assert(metaBlockRule.includes("background: var(--color-surface);"), "fundo --color-surface");
  assert(/border-radius:\s*var\(--radius\);/.test(metaBlockRule), "raio var(--radius) — o token de card padrão, não o --radius-sheet novo (esse é só da folha)");
  assert(css.includes(".recipe-meta-block__label {"), "sub-classe de rótulo declarada");
  const metaLabelRule = sliceRule(css, ".recipe-meta-block__label {", "regra .recipe-meta-block__label");
  assert(/font-size:\s*var\(--text-xs\);/.test(metaLabelRule) && /var\(--color-text-disabled\)/.test(metaLabelRule), "rótulo --text-xs + --color-text-disabled, uppercase");
  // Rodada 2 (revisão do dono): DIFICULDADE (11 caracteres, palavra única sem espaço) truncava
  // fora da tela no layout flex-de-4 a 390px — CSS não quebra uma palavra sem espaço por
  // padrão. overflow-wrap:break-word é uma rede de segurança ESTRUTURAL (some independente da
  // largura real do bloco) — a grade 2x2 (acima) já resolve na prática, isto é defesa extra.
  assert(/overflow-wrap:\s*break-word;/.test(metaLabelRule), "overflow-wrap:break-word no rótulo — rede de segurança contra palavra única mais larga que o bloco (achado: DIFICULDADE truncava)");
  assert(css.includes(".recipe-meta-block__value {"), "sub-classe de valor declarada");
  const metaValueRule = sliceRule(css, ".recipe-meta-block__value {", "regra .recipe-meta-block__value");
  assert(/font-size:\s*var\(--text-sm\);/.test(metaValueRule) && /var\(--color-text-primary\)/.test(metaValueRule), "valor --text-sm + --color-text-primary");
  assert(/overflow-wrap:\s*break-word;/.test(metaValueRule), "overflow-wrap:break-word no valor também (mesma rede de segurança, ex. 'Média-alta' ou valores futuros mais longos)");
  assert(receitaFnBody.includes('"recipe-meta-block"'), "renderReceita monta blocos .recipe-meta-block (não mais <span> soltos)");
  assert(!receitaFnBody.includes('metaHtml += "<span>"'), "TESTE NEGATIVO: construção antiga por concatenação de <span> solto não sobra");
  assert(!receitaFnBody.includes("metaRow.appendChild(stepperWrap)"), "TESTE NEGATIVO: porções NÃO entra mais em metaRow (saiu pra perto de Ingredientes, spec 3d/3g)");

  console.log("");
  console.log("==================================================");
  console.log("8b. RITMO DO FUNIL — --space-6 (24px) consistente entre seções (rodada 2: revisão do dono, 'passada de ritmo')");
  console.log("==================================================");
  const titleBlockRule = sliceRule(css, ".recipe-page-title {", "regra .recipe-page-title");
  assert(/margin-bottom:\s*var\(--space-6\);/.test(titleBlockRule), "título (bloco inteiro, cobre o caso sem descrição/origem também) — espaço até as tags: --space-6");
  const tagsRhythmRule = sliceRule(css, ".recipe-page-tags {", "regra .recipe-page-tags (ritmo)");
  // Rodada 3 (revisão do dono): REVERTE o gap de 24px da rodada 2 — "correção errada", o bloco
  // de tags virou itens espalhados em vez de ler como um GRUPO. gap volta a ser pequeno
  // (calc(--space-2 + 2px) = 10px) — o respiro entre SEÇÕES continua --space-6 (não mudou),
  // só o espaçamento INTERNO das tags reverteu.
  assert(/gap:\s*calc\(var\(--space-2\)\s*\+\s*2px\);/.test(tagsRhythmRule), "gap calc(--space-2 + 2px) = 10px (rodada 3: reverte os 24px da rodada 2, chips voltam a parecer grupo)");
  assert(/margin:\s*0 0 var\(--space-6\);/.test(tagsRhythmRule), "margin-bottom --space-6 até os metadados (ritmo ENTRE seções mantido — só o gap INTERNO das tags reverteu)");
  assert(/margin-bottom:\s*var\(--space-6\);/.test(metaRowRule), "metadados: espaço até o CTA — --space-6");
  const ctaRule = sliceRule(css, ".primary-cta {", "regra .primary-cta");
  assert(/margin-bottom:\s*var\(--space-6\);/.test(ctaRule), "CTA: espaço até os 2 secundários — --space-6 (era --space-5)");
  const actionsRhythmRule = sliceRule(css, ".recipe-page-actions {", "regra .recipe-page-actions (ritmo)");
  assert(/margin-bottom:\s*var\(--space-6\);/.test(actionsRhythmRule), "secundários: espaço até Ingredientes — --space-6 (já estava correto antes desta rodada)");
  // Higiene 2026-07-30 (commit 2f5fe83, pente-fino pós-Busca): o tratamento calibrado (36px +
  // hit-area -6px), antes escopado só a ".recipe-page-tags .tag-chip-link", foi hoisted pra
  // regra BASE ".tag-chip-link" — o mesmo card em busca/hub/categoria/Minhas Receitas
  // (.recipe-card__tag) media ~22px sem hit-area nenhuma com a classe base sozinha, e os 2
  // únicos consumidores reais da classe precisavam do mesmo alvo de toque. Valores IDÊNTICOS
  // (confirmado ao vivo: 36px, padding 8px/14px, inset -6px, nenhuma mudança visual na página
  // da receita) — só a regra escopada específica foi removida por ficar 100% redundante.
  const tagChipRhythmRule = sliceRule(css, ".tag-chip-link::after {", "regra ::after das tags (inset recalibrado, rodada 3 — hoisted pra base no commit 2f5fe83)");
  // -6px, não -5px: .tag-chip-link (base) tem border:1px, que "come" 1px do inset (mesma causa
  // raiz da Fase 0a pro .portion-stepper__btn) — sem compensar, o alcance efetivo media ~4-4,5px
  // ao vivo, não os 5px pretendidos. Achado ao vivo via elementFromPoint nesta rodada.
  assert(/inset:\s*-6px;/.test(tagChipRhythmRule), "inset -6px = 5px pretendido + 1px de compensação de borda (rodada 3, achado ao vivo)");

  console.log("");
  console.log("==================================================");
  console.log("9. PORÇÕES REALOCADA — perto de Ingredientes, chevron discreto substitui o botão grande");
  console.log("==================================================");
  const iIngHeader = receitaFnBody.indexOf("ingredients-header");
  const iStepperWrapDecl = receitaFnBody.indexOf("stepperWrap.className");
  assert(iIngHeader > 0, "novo header de ingredientes construído (ingredients-header)");
  assert(iStepperWrapDecl > iTags, "portion-stepper construído DEPOIS das tags (perto do bloco de ingredientes agora, não mais logo após o título)");
  assert(!css.includes(".ingredients-toggle {"), "TESTE NEGATIVO: .ingredients-toggle (botão-pílula grande, borda 2px accent) foi removido — vira chevron discreto");
  assert(!receitaFnBody.includes('"filter-section__header ingredients-toggle"'), "TESTE NEGATIVO: header de ingredientes não usa mais a classe ingredients-toggle");
  assert(css.includes(".ingredients-collapse-btn"), "novo botão discreto de colapso declarado no CSS");
  assert(/\.filter-section\.is-open \.filter-section__chevron \{ transform: rotate\(180deg\); \}/.test(css), "mecânica do chevron reaproveitada sem alteração (acordeão do filter-section)");
  assert(receitaFnBody.includes('ingSection.classList.toggle("is-open")'), "toggle continua sendo classList.toggle is-open no ingSection (mesmo acordeão)");

  console.log("");
  console.log("==================================================");
  console.log("10. TAGS >=44px — fecha a exceção documentada da Fase 0a (.recipe-page-tags .tag-chip-link, 37-38px). Dimensões revertidas/recalibradas na rodada 3 (revisão do dono) — aqui a MATEMÁTICA final");
  console.log("==================================================");
  // Higiene 2026-07-30 (commit 2f5fe83): mesmo hoist do bullet 8 acima — ".recipe-page-tags
  // .tag-chip-link" não existe mais como regra própria, os valores vivem na base ".tag-chip-link"
  // agora (idênticos, confirmado ao vivo: 36px/padding/inset — zero mudança visual nesta tela).
  const tagChipRule = sliceRule(css, ".tag-chip-link {", "regra .tag-chip-link (base — hoisted de .recipe-page-tags .tag-chip-link no commit 2f5fe83)");
  const minHeightMatch = tagChipRule.match(/min-height:\s*(\d+)px/);
  // Rodada 3: REVERTE a direção da rodada 1 (que pedia chip mais baixo que 30px) — agora é
  // maior, 36px, pra ler como um chip "cheio" outra vez, não um item espalhado.
  assert(!!minHeightMatch && parseInt(minHeightMatch[1], 10) === 36, "chip 36px (rodada 3: reverte a redução da rodada 1 — era 28px, spec agora pede maior/mais próximo) — " + (minHeightMatch && minHeightMatch[1]));
  assert(/padding:\s*var\(--space-2\)\s*14px;/.test(tagChipRule), "padding ~8px var(--space-2) / 14px (rodada 3)");
  const tagChipAfterRule = sliceRule(css, ".tag-chip-link::after {", "regra ::after do hit-padding das tags (base, hoisted no commit 2f5fe83)");
  const insetMatch = tagChipAfterRule.match(/inset:\s*(-?\d+)px;/);
  assert(!!insetMatch, "inset uniforme declarado no ::after");
  if (minHeightMatch && insetMatch) {
    const total = parseInt(minHeightMatch[1], 10) + 2 * Math.abs(parseInt(insetMatch[1], 10));
    assert(total >= 44, "alvo DECLARADO >= 44px: " + minHeightMatch[1] + "px chip + 2x" + Math.abs(parseInt(insetMatch[1], 10)) + "px inset = " + total + "px (nota: o alvo EFETIVO ao vivo é menor que o declarado — border:1px da base .tag-chip-link come parte do inset, ver comentário do CSS; medido ao vivo via elementFromPoint, não só esta conta estática)");
    // Teto = metade do gap (5px) + 1px de compensação de borda (mesma regra da Fase 0a) = 6px.
    assert(Math.abs(parseInt(insetMatch[1], 10)) <= 6, "inset não excede metade do gap de 10px (5px) + 1px de compensação de borda = 6px teto — evita colisão com o chip da linha seguinte, mesma regra de segurança já documentada na Fase 0a");
  }

  console.log("");
  console.log("==================================================");
  console.log("10b. CHIP DE PAÍS SAI da fileira de tags DA PÁGINA (rodada 3, revisão do dono — decisão REVERSÍVEL, só nesta tela)");
  console.log("==================================================");
  assert(
    receitaFnBody.includes('.filter((t) => t.indexOf("country:") !== 0)'),
    "renderReceita filtra tags country: ANTES de montar pageTagIds (a origem já aparece na linha abaixo do título — chip duplicaria)"
  );
  assert(receitaFnBody.includes("priorityTagIds(nonCountryTags, 8)"), "priorityTagIds chamado com a lista JÁ FILTRADA (nonCountryTags), não item.tags direto");
  assert(
    appJs.includes('const TAG_CHIP_PRIORITY = ["country:", "dish_type:", "protein:", "course:", "ingredient:"];'),
    "TESTE NEGATIVO: TAG_CHIP_PRIORITY (compartilhado com o card e outras telas) NÃO foi alterado — o filtro é só no INPUT de renderReceita, nunca na função/constante compartilhada"
  );
  const priorityFnBody = sliceFn(appJs, "function priorityTagIds(tags, maxCount) {", "priorityTagIds");
  assert(!priorityFnBody.includes("country"), "TESTE NEGATIVO: priorityTagIds() em si não sabe nada sobre country — busca/filtros em outras telas continuam vendo o tag normalmente");

  console.log("");
  console.log("==================================================");
  console.log("11. CARONA — tap-highlight nativo morto globalmente + user-select:none em controles (não em texto)");
  console.log("==================================================");
  assert(/-webkit-tap-highlight-color:\s*transparent;/.test(css), "-webkit-tap-highlight-color: transparent declarado");
  const universalRule = sliceRule(css, "* {", "regra universal *");
  assert(universalRule.includes("-webkit-tap-highlight-color: transparent;"), "aplicado GLOBALMENTE (seletor *, não um componente isolado)");
  const buttonRule = sliceRule(css, "\nbutton {", "regra global de button (user-select)");
  assert(/user-select:\s*none;/.test(buttonRule), "user-select: none em button (controles), nunca em texto de conteúdo");
  assert(!/\.page-desc\s*\{[^}]*user-select/.test(css), "TESTE NEGATIVO: user-select:none NÃO aplicado a texto de conteúdo (.page-desc)");
  assert(!/\.ingredients-list\s*\{[^}]*user-select/.test(css), "TESTE NEGATIVO: user-select:none NÃO aplicado à lista de ingredientes (texto de conteúdo)");

  console.log("");
  console.log("==================================================");
  console.log("12. SERVICE WORKER — bump (rodada 3 muda css/js de novo, revisão do dono: proporção)");
  console.log("==================================================");
  // v29 -> v30: literal ficou stale por causa do hotfix 2026-07-26 (whitelist de pointer-events
  // ganhou .filter-modal-overlay/.update-toast, ver scripts/verify-filter-modal-pointer-events-
  // 2026-07-26.js), não por uma nova rodada desta feature — CACHE_NAME é global ao sw.js.
  // v30 -> v31: mesma situação, desta vez pela leva final de sobras (header de ingredientes,
  // seção 14 abaixo) — essa sim é desta suíte/feature (.recipe-page), a diferença é só que
  // CACHE_NAME sobe 1x só por commit, então a asserção sempre acompanha o valor MAIS recente.
  // v31 -> v32: fix pontual de centralização vertical do mesmo header (seção 15) — css/style.css
  // mudou de novo, mesma regra de sempre (todo push que toca APP_SHELL bumpa CACHE_NAME).
  // v32 -> v33: item final do redesenho visual. v33 -> v34: rumo novo de Países. v34 -> v35:
  // calibração final do banner de hub (blur/scale removidos) — todos fora desta feature.
  assert(/const CACHE_NAME = "cardapio-v51";/.test(swJs), "CACHE_NAME v33 -> ... -> v50 -> v51 (higiene F1b 2026-07-30: mais um bump de feature externa, atualizado pro valor vigente)");

  console.log("");
  console.log("==================================================");
  console.log("13. DOCS — DESIGN-TOKENS.md, mobile-recipe-ui/SKILL.md e CONTRATO-IMAGENS-REDESIGN.md refletem o redesenho");
  console.log("==================================================");
  const tokensPath = path.join(ROOT, "docs", "DESIGN-TOKENS.md");
  const tokens = fs.readFileSync(tokensPath, "utf8");
  assert(tokens.includes("--radius-sheet"), "DESIGN-TOKENS.md documenta --radius-sheet");
  assert(tokens.includes("recipe-hero__heart"), "DESIGN-TOKENS.md documenta o coração novo sobre a foto (classe específica, não só a palavra 'coração' — essa já aparece pro coração do CARD)");
  assert(tokens.includes("--hero-h"), "DESIGN-TOKENS.md documenta --hero-h (rodada 2: foto maximizada)");
  const skillPath = path.join(ROOT, ".claude", "skills", "mobile-recipe-ui", "SKILL.md");
  const skill = fs.readFileSync(skillPath, "utf8");
  assert(skill.includes("recipe-meta-block"), "mobile-recipe-ui/SKILL.md documenta os metadados em blocos (classe específica — 'blocos' sozinho já aparece na prosa/'Bloco 2' etc.)");
  assert(tokens.includes("nonCountryTags") || tokens.toLowerCase().includes("chip de país"), "DESIGN-TOKENS.md documenta a decisão (reversível) de tirar o chip de país da fileira de tags da página (rodada 3)");
  const contratoPath = path.join(ROOT, "docs", "CONTRATO-IMAGENS-REDESIGN.md");
  const contrato = fs.readFileSync(contratoPath, "utf8");
  assert(contrato.includes("--hero-h"), "CONTRATO-IMAGENS-REDESIGN.md (§5/§6.1, cross-front com ciência do dono) documenta a caixa proporcional ao viewport (--hero-h), substitui a calibração 16/9 fixa");

  console.log("");
  console.log("==================================================");
  console.log("14. HEADER DE INGREDIENTES — contador sai do estado expandido (desalinhava \"INGREDIENTES\" com porções+chevron), passa a existir só no colapsado (\"Ver ingredientes (N)\", aria do chevron). Leva final de sobras, 2026-07-26.");
  console.log("==================================================");
  assert(
    receitaFnBody.includes("<h4>Ingredientes</h4>"),
    "header expandido: <h4>Ingredientes</h4> sem contador — alinha limpo com porções+chevron na mesma linha"
  );
  assert(
    !/<h4>Ingredientes\s*<span class=\\?"filter-section__count\\?">/.test(receitaFnBody),
    "TESTE NEGATIVO: o span .filter-section__count não sobra colado no <h4> — a contagem saiu de vez do estado expandido"
  );
  assert(
    /collapseBtn\.setAttribute\("aria-label", isOpen \? "Ocultar ingredientes" : "Ver ingredientes \(" \+ ingredientsList\.length \+ "\)"\);/.test(receitaFnBody),
    "estado colapsado: aria-label do chevron vira \"Ver ingredientes (N)\" — só aqui a contagem sobrevive"
  );
  assert(
    /collapseBtn\.setAttribute\("aria-label", "Ocultar ingredientes"\);/.test(receitaFnBody),
    "estado expandido inicial (is-open por padrão): aria-label continua só \"Ocultar ingredientes\", sem contador (contador é exclusivo do colapsado)"
  );

  console.log("");
  console.log("==================================================");
  console.log("15. CENTRALIZAÇÃO VERTICAL DO HEADER DE INGREDIENTES — fix pontual, 2026-07-26 (h4 renderizava mais ALTO que porções+chevron, achado do dono via print). Causa raiz: empate de especificidade (0,1,1) entre .ingredients-header h4 e .recipe-page-section h4 — em empate, quem vem DEPOIS no arquivo vence, e a regra de margin-bottom:var(--space-3) vem depois, deixando 12px residual só no h4 (medido ao vivo: 6px de offset = metade do residual, exatamente como a matemática de align-items:center prevê para um box com margem assimétrica).");
  console.log("==================================================");
  const ingHeaderRuleAlign = sliceRule(css, ".ingredients-header {", "regra .ingredients-header");
  assert(/align-items:\s*center;/.test(ingHeaderRuleAlign), "align-items:center no container do header — centraliza a CAIXA de cada item direto (h4, .ingredients-header__controls) no eixo cruzado");
  const ingControlsRuleAlign = sliceRule(css, ".ingredients-header__controls {", "regra .ingredients-header__controls");
  assert(/align-items:\s*center;/.test(ingControlsRuleAlign), "align-items:center também no sub-container de controles — centraliza stepper/yield-text CONTRA o chevron dentro dele, mesma lógica um nível abaixo");
  assert(
    css.includes(".recipe-page-section .ingredients-header h4 { margin: 0; }"),
    "fix: seletor do zero-margin do h4 leva o prefixo .recipe-page-section — eleva a especificidade pra (0,2,1), vence .recipe-page-section h4 (0,1,1) SEMPRE, não só quando por acaso vem depois no arquivo (causa raiz do bug)"
  );
  const sharedH4Rule = sliceRule(css, ".recipe-page-section h4 {", "regra compartilhada .recipe-page-section h4 (Modo de preparo, Dicas etc.)");
  assert(/margin:\s*0 0 var\(--space-3\);/.test(sharedH4Rule), "TESTE NEGATIVO: a regra COMPARTILHADA (.recipe-page-section h4, usada por outros headers como 'Modo de preparo') não foi tocada — o fix é local ao ingredients-header, não muda o espaçamento de mais ninguém");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
