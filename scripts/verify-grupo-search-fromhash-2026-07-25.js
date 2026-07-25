// scripts/verify-grupo-search-fromhash-2026-07-25.js
//
// Suíte de verificação do 4º caminho do mecanismo "Voltar preservando contexto": busca inline
// da página de grupo (renderGrupo, hubs Fundamentos/Proteínas/Países/Tempo/Dificuldade). Os
// outros 3 caminhos (Coleção, Busca, Minhas Receitas) já passavam fromHash pro card de receita
// — este ficou de fora (CHECKLIST-GERAL.md item 5). Corrigido seguindo o MESMO padrão exato:
// fromHash = currentHashPath() + Router.toReceita(id, fromHash) no clique do card.
//
// Diferença importante: nos outros 3 caminhos, o ESTADO (filtro/tags/query) já vive na URL —
// currentHashPath() sozinho basta pra restaurar o conteúdo ao voltar. A busca inline de grupo
// NUNCA escreveu o texto digitado na URL, então fromHash sozinho só resolveria a NAVEGAÇÃO
// (Voltar para no grupo certo), não o CONTEÚDO (input vazio, resultados sumidos). Resolvido com
// o MESMO padrão já usado em Minhas Receitas pra esse exato problema (estado fora da URL):
// variável de módulo simples (grupoSearchQuery, mesmo papel de minhasReceitasTab) que sobrevive
// ao re-render e é lida de volta no próximo renderGrupo() da mesma sessão.
//
// js/app.js é fortemente acoplado ao DOM sem UMD (mesma limitação de sempre, documentada em
// test-shopping-dict.js/verify-shopping-sections/verify-subprodutos) — verificado aqui por
// texto exato do código-fonte (grep/`.includes()`), e ao vivo no navegador (ver report da
// tarefa: fromHash correto capturado em #/receita/paella?from=grupo%2Fproteinas, busca e
// resultados restaurados byte a byte ao voltar, os outros 3 caminhos confirmados intactos).
//
// Nenhuma comparação usa ref de git — só valores literais, regra do CLAUDE.md.
//
// `node scripts/verify-grupo-search-fromhash-2026-07-25.js` — sai com código != 0 se algo falhar.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");

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
  console.log("1. renderGrupo CALCULA fromHash (mesmo padrão de Coleção/Busca/Minhas Receitas)");
  console.log("==================================================");
  const grupoFnStart = appJs.indexOf("function renderGrupo(grupoId) {");
  assert(grupoFnStart > 0, "função renderGrupo encontrada");
  const grupoFnEnd = appJs.indexOf("\n  // ---------- Home ----------", grupoFnStart);
  assert(grupoFnEnd > grupoFnStart, "fim de renderGrupo localizado (antes do bloco Home)");
  const grupoFnBody = appJs.slice(grupoFnStart, grupoFnEnd);
  assert(grupoFnBody.includes("const fromHash = currentHashPath();"), "renderGrupo declara fromHash via currentHashPath()");

  console.log("");
  console.log("==================================================");
  console.log("2. CARD DE RESULTADO DA BUSCA INLINE PASSA fromHash (o bug relatado)");
  console.log("==================================================");
  assert(
    grupoFnBody.includes('recipeResultsEl.appendChild(renderRecipeCard(item, { catLabel: cat ? cat.label : item.catId, fromHash: fromHash }));'),
    "renderRecipeMatches passa fromHash pro renderRecipeCard (antes: só catLabel, sem fromHash)"
  );

  console.log("");
  console.log("==================================================");
  console.log("3. ESTADO DA BUSCA (fora da URL) PERSISTE EM VARIÁVEL DE MÓDULO, MESMO PADRÃO DE minhasReceitasTab");
  console.log("==================================================");
  const grupoSearchQueryDeclIdx = appJs.indexOf("const grupoSearchQuery = {};");
  assert(grupoSearchQueryDeclIdx > 0, "grupoSearchQuery declarada como variável de módulo (não dentro de renderGrupo — precisa sobreviver ao re-render)");
  assert(grupoSearchQueryDeclIdx < grupoFnStart, "grupoSearchQuery declarada ANTES de renderGrupo (escopo de módulo, não local)");
  assert(grupoFnBody.includes("search.value = grupoSearchQuery[grupoId] || \"\";"), "input da busca inicializa com o valor persistido (restaura ao voltar)");
  assert(grupoFnBody.includes("grupoSearchQuery[grupoId] = q;"), "listener de input GRAVA o valor digitado na variável de módulo");

  console.log("");
  console.log("==================================================");
  console.log("4. CARGA INICIAL REUSA renderGrid/renderRecipeMatches — SEM lógica duplicada/divergente");
  console.log("==================================================");
  // "function renderGrid(" (a declaração) também casa no regex — 1 declaração + 2 chamadas
  // reais (listener de input + carga inicial) = 3. Isso também confirma que não existe uma
  // SEGUNDA declaração duplicada em algum lugar.
  const renderGridMatches = (grupoFnBody.match(/renderGrid\(/g) || []).length;
  const renderMatchesMatches = (grupoFnBody.match(/renderRecipeMatches\(/g) || []).length;
  assert(renderGridMatches === 3, "renderGrid: 1 declaração + 2 chamadas (listener de input + carga inicial), nenhuma duplicada — obtido " + renderGridMatches);
  assert(renderMatchesMatches === 3, "renderRecipeMatches: 1 declaração + 2 chamadas, nenhuma duplicada — obtido " + renderMatchesMatches);
  assert(grupoFnBody.includes("const initialQuery = search.value;"), "carga inicial lê o MESMO search.value já restaurado (não reconstrói de outra fonte)");
  assert(!grupoFnBody.includes('renderGrid("");'), "carga inicial NÃO força string vazia (regressão do bug: sempre resetava a busca)");

  console.log("");
  console.log("==================================================");
  console.log("5. TESTE NEGATIVO — os outros 3 caminhos continuam EXATAMENTE iguais");
  console.log("==================================================");
  // Coleção (renderRecipeCard nos resultados de coleção)
  assert(appJs.includes("sortedItems.forEach((item) => listEl.appendChild(renderRecipeCard(item, { fromHash: fromHash })));"), "Coleção: fromHash intacto (linha idêntica à de antes desta tarefa)");
  // Busca
  assert(appJs.includes('resultsEl.appendChild(renderRecipeCard(item, { catLabel: cat ? cat.label : item.catId, fromHash: fromHash }));'), "Busca: fromHash intacto na lista principal");
  assert(appJs.includes("function renderPreviewSection(title, items, fromHash) {"), "Busca: renderPreviewSection continua recebendo fromHash como parâmetro");
  // Minhas Receitas
  assert(appJs.includes('content.appendChild(renderRecipeCard(item, { catLabel: cat ? cat.label : item.catId, fromHash: fromHash }));'), "Minhas Receitas: fromHash intacto");
  assert(appJs.includes('// fromHash aqui é só "minhas-receitas" (rota sem query)'), "Minhas Receitas: comentário/padrão original intacto (não reescrito)");

  console.log("");
  console.log("==================================================");
  console.log("6. BOTÃO PRÓPRIO DE VOLTAR DO GRUPO (Router.toHome) — fora do escopo desta tarefa, confirmado intacto");
  console.log("==================================================");
  assert(grupoFnBody.includes('back.addEventListener("click", () => Router.toHome());'), "botão '← Voltar' do topo do grupo continua indo pra Home direto — não fazia parte do bug relatado, não foi tocado");

  console.log("");
  console.log("==================================================");
  console.log("7. skill product-navigation-ux — regra de histórico real (nunca destino hardcoded) respeitada");
  console.log("==================================================");
  assert(fs.existsSync(path.join(ROOT, ".claude", "skills", "product-navigation-ux", "SKILL.md")), "skill product-navigation-ux existe");
  // O fix usa Router.toReceita(id, fromHash) — histórico real reconstruído via fromHash, não um
  // "#/grupo/X" cravado nesta função; a MESMA função renderRecipeCard/Router.toReceita de
  // sempre, sem novo caminho hardcoded criado por esta tarefa.
  assert(!/Router\.navigate\(["']grupo\//.test(grupoFnBody), "nenhum destino de grupo hardcoded introduzido (teste negativo)");

  console.log("");
  console.log("==================================================");
  console.log(failures === 0 ? "TODAS AS ASSERÇÕES PASSARAM" : "FALHAS: " + failures);
  console.log("==================================================");
  process.exit(failures === 0 ? 0 : 1);
}

main();
