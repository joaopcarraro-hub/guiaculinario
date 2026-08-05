// scripts/verify-busca-respiro-2026-07-30.js
//
// COMMIT 2 da rodada "Ordenar + respiro das superfícies de busca" (2026-07-30) — pente-fino
// geral pós-Busca (adendo do dono): varredura confirmou 3 achados reais com medição ao vivo
// (relatório da tarefa tem os números completos), todos QUEBRADO/APERTADO, todos reaplicação de
// régua já estabelecida (não design novo):
//
// 1. .category-card__band (título+contador do hub, ex. "Aves"/"47 receitas"): gap 2px literal,
//    medido ao vivo colado. Sobe pra var(--space-1) — empate exato na régua de tokens (2px vs
//    4px), arredonda pra cima (mesma regra já documentada em DESIGN-TOKENS.md). Espelhado em
//    .filter-tile--photo .filter-tile__band (os 2 eram deliberadamente iguais, ver comentário
//    no CSS) — os 2 sobem juntos, continuam iguais.
// 2. .tagsearch-suggestions (chips sugeridos/relacionados, usado em renderCategory/renderGrupo/
//    renderBusca): sem margin-bottom nenhum, media ao vivo 0px de gap pro bloco seguinte quando
//    populada (ex. chip "Limão" encostando no título "Com esses filtros em Proteínas (N)") — a
//    queixa "texto perto de tags" do dono. Ganha margin-bottom var(--space-5), escopado a
//    :not(:empty) pra não criar respiro fantasma no caso comum (sem sugestão nenhuma).
// 3. .tag-chip-link (a tag de CADA card de receita em toda superfície de listagem — busca, hub,
//    categoria, Minhas Receitas): base media ~22px de altura real, sem hit-area nenhuma — só o
//    escopo .recipe-page-tags (página da própria receita) tinha o tratamento calibrado (36px +
//    hit-area -6px). Hoisted pra base: os 2 únicos consumidores reais da classe (confirmado por
//    grep) ganham o mesmo alvo de toque calibrado de uma vez, sem duplicar valores — a regra
//    .recipe-page-tags .tag-chip-link específica foi removida (100% redundante depois do hoist).
//
// CACHE_NAME bump único desta rodada (v49 -> v50, combinado com o commit 1 por decisão da spec
// da tarefa — nenhum dos 2 commits altera sw.js sozinho além deste bump).
//
// Nenhum destes 3 achados mudou comportamento de busca/contagem — é CSS/rhythm puro, prova de
// comportamento idêntico fica no relatório da tarefa (teste negativo ao vivo).
//
// js/app.js é fortemente acoplado ao DOM sem UMD — verificado por texto exato do código-fonte,
// nunca por ref de git (regra do CLAUDE.md: só literais).
//
// `node scripts/verify-busca-respiro-2026-07-30.js` — sai com código != 0 se algo falhar.

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
  console.log("1. .category-card__band — título/contador do hub, gap 2px -> var(--space-1)");
  console.log("==================================================");
  assert(/\.category-card__band \{[^}]*gap:\s*var\(--space-1\)/.test(css), ".category-card__band usa var(--space-1) (4px), não mais 2px literal");
  assert(!/\.category-card__band \{[^}]*gap:\s*2px/.test(css), "TESTE NEGATIVO: nenhum 2px literal restante em .category-card__band");
  assert(/\.filter-tile--photo \.filter-tile__band \{[^}]*gap:\s*var\(--space-1\)/.test(css), "espelho .filter-tile--photo .filter-tile__band sobe JUNTO (os 2 eram deliberadamente iguais)");
  assert(!/\.filter-tile--photo \.filter-tile__band \{[^}]*gap:\s*2px/.test(css), "TESTE NEGATIVO: nenhum 2px literal restante em .filter-tile--photo .filter-tile__band");

  console.log("");
  console.log("==================================================");
  console.log("2. .tagsearch-suggestions — zero-gap seam quando populada (renderCategory/renderGrupo/renderBusca)");
  console.log("==================================================");
  assert(/\.tagsearch-suggestions:not\(:empty\) \{ margin-bottom: var\(--space-5\); \}/.test(css), ".tagsearch-suggestions:not(:empty) ganha margin-bottom var(--space-5)");
  assert(/\.tagsearch-suggestions \{ margin-top: var\(--space-3\); \}/.test(css), "TESTE NEGATIVO: regra base (margin-top, caso vazio) continua intocada — sem respiro fantasma quando não há sugestão nenhuma");
  const chipsWrapSites = (appJs.match(/chipsWrap\.className = "tagsearch-suggestions";/g) || []).length;
  assert(chipsWrapSites >= 2, "TESTE NEGATIVO: renderCategory E renderGrupo continuam usando .tagsearch-suggestions (mesmo container, fix é só CSS) — " + chipsWrapSites + " call sites encontrados");

  console.log("");
  console.log("==================================================");
  console.log("3. .tag-chip-link — chip-radio calibrado (36px + hit-area) hoisted pra base, cobre .recipe-card__tag");
  console.log("==================================================");
  assert(/\.tag-chip-link \{[^}]*min-height:\s*36px/.test(css), ".tag-chip-link base tem min-height:36px (era só padding pequeno, ~22px reais)");
  assert(/\.tag-chip-link \{[^}]*position:\s*relative/.test(css), ".tag-chip-link base tem position:relative (pré-requisito do ::after de hit-area)");
  assert(/\.tag-chip-link::after \{ content: ""; position: absolute; inset: -6px; \}/.test(css), ".tag-chip-link::after (hit-area, não mais escopado só a .recipe-page-tags) — 36+6+6=48px efetivo");
  assert(!/\.recipe-page-tags \.tag-chip-link \{/.test(css), "TESTE NEGATIVO: override específico de .recipe-page-tags removido (100% redundante depois do hoist pra base)");
  assert(!/\.recipe-page-tags \.tag-chip-link::after/.test(css), "TESTE NEGATIVO: ::after específico de .recipe-page-tags removido junto");
  assert(/\.recipe-page-tags \{[^}]*gap:\s*calc\(var\(--space-2\) \+ 2px\)/.test(css), "TESTE NEGATIVO: .recipe-page-tags mantém seu próprio gap de 10px (propriedade do CONTAINER, não do chip — não muda com o hoist)");
  const tagChipConsumers = (appJs.match(/chip\.className = "tag-chip-link";/g) || []).length;
  assert(tagChipConsumers === 1, "TESTE NEGATIVO: continua 1 único ponto de criação (buildTagChipsEl) — hoist não duplicou a função, só a régua CSS alcança mais contextos");

  console.log("");
  console.log("==================================================");
  console.log("4. SERVICE WORKER — CACHE_NAME bump único da rodada (v49 -> v50)");
  console.log("==================================================");
  assert(/const CACHE_NAME = "cardapio-v58";/.test(swJs), "CACHE_NAME v49 -> ... -> v56 -> v57 -> v58 (coleções abstratas de tempo/dificuldade ilustradas, 2026-07-31: bump de outra feature, atualizado pro valor vigente; +v58 passada desktop tier largo 2026-08-05, css/style.css+js/app.js)");
  assert(!/const CACHE_NAME = "cardapio-v49";/.test(swJs), "TESTE NEGATIVO: v49 não sobrevive");

  console.log("");
  console.log("==================================================");
  console.log("5. TESTE NEGATIVO GERAL — nenhuma mudança de comportamento de busca (só CSS/rhythm)");
  console.log("==================================================");
  assert(/TagModel\.sortRecipeItems\(items, sortKey, collection\)/.test(appJs), "sortRecipeItems (renderCategory) intocado");
  assert(/TagModel\.sortRecipeItems\(items, sortKey, null\)/.test(appJs), "sortRecipeItems (renderBusca) intocado");
  assert(/function renderRecipeCard\(item, opts\)/.test(appJs), "renderRecipeCard continua a única função de card (nenhuma duplicação pro fix de chip)");
  assert(/Router\.toBusca\(\[tagId\]\)/.test(appJs), "clique na tag do card continua navegando pra busca filtrada (comportamento do chip intocado, só o hit-area/tamanho mudou)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
