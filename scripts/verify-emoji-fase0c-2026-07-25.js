// scripts/verify-emoji-fase0c-2026-07-25.js
//
// Varredura de emoji ANTES (BASE_COMMIT, imediatamente anterior à Fase 0c) x DEPOIS (working
// tree atual) nos 8 arquivos do inventário original (2026-07-25) + js/countries.js (novo nesta
// leva, não existia no BASE_COMMIT). Mesmas faixas Unicode do inventário
// (\u{1F300}-\u{1FAFF} \u{2600}-\u{27BF} \u{FE0F} \u{1F1E6}-\u{1F1FF}), MAIS \u{23F0}-\u{23FF}
// (cronômetro ⏱, fora da faixa original — a ressalva de método do próprio inventário já
// previa isso e pedia pra incluir se fosse útil; aqui foi: achou um 9º caso de emoji renderizado
// que o inventário original não pegou, ver nota da linha 1776 abaixo).
//
// BASE_COMMIT é o commit imediatamente anterior ao primeiro commit da Fase 0c — fixo de
// propósito, nunca HEAD (ver scripts/../cardapio-verify-script-base-commit): HEAD drifta pra
// frente a cada commit novo e faria esta suíte comparar o estado errado.
//
// Cada bandeira conta 2 code points (par de regional indicator), não 1 — mesma ressalva já
// registrada no inventário original ("bandeiras contam 2 code points cada").
//
// `node scripts/verify-emoji-fase0c-2026-07-25.js` — sai com código != 0 se a expectativa falhar.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BASE_COMMIT = "4ef60c837948c5a9d5bf013259a939ab5283a2d9"; // fix(sw): bump v22 — commit imediatamente anterior à Fase 0c

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{23F0}-\u{23FF}]/gu;

function countEmoji(text) {
  if (text == null) return 0;
  const matches = text.match(EMOJI_RE);
  return matches ? matches.length : 0;
}

function readAtBase(relPath) {
  try {
    return execSync("git show " + BASE_COMMIT + ":" + relPath.split(path.sep).join("/"), {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return null; // arquivo não existia no BASE_COMMIT (ex.: js/countries.js, novo nesta leva)
  }
}

function readNow(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

const FILES = [
  "js/app.js",
  "js/categories.js",
  "js/collections.js",
  "js/countries.js",
  "css/style.css",
  "CHECKLIST-GERAL.md",
  "docs/DESIGN-TOKENS.md",
  ".claude/skills/mobile-recipe-ui/SKILL.md",
  ".claude/skills/product-navigation-ux/SKILL.md",
];

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

console.log("Varredura de emoji — ANTES (" + BASE_COMMIT.slice(0, 7) + ") x DEPOIS (working tree)");
console.log("==================================================");

const counts = FILES.map((f) => {
  const before = countEmoji(readAtBase(f));
  const after = countEmoji(readNow(f));
  console.log(f.padEnd(46) + "antes: " + String(before).padStart(3) + "   depois: " + String(after).padStart(3));
  return { file: f, before, after };
});
const byFile = Object.fromEntries(counts.map((c) => [c.file, c]));

const totalBefore = counts.reduce((s, c) => s + c.before, 0);
const totalAfter = counts.reduce((s, c) => s + c.after, 0);
console.log("--------------------------------------------------");
console.log("TOTAL".padEnd(46) + "antes: " + String(totalBefore).padStart(3) + "   depois: " + String(totalAfter).padStart(3));

console.log("");
console.log("==================================================");
console.log("EXPECTATIVAS — código de produto (js/*.js, css/style.css)");
console.log("==================================================");

assert(
  byFile["js/app.js"].after === 6,
  "js/app.js: sobram exatamente 6 code points — as 5 linhas do grid 'Mais Categorias' " +
    "(fundamentos/proteínas/países/tempo/dificuldade, L161-165; 'tempo' usa ⏱️ = 2 code points), " +
    "único resquício de categoria/hub (bucket que fica pro item 6 do roadmap). Zero bandeira " +
    "(saiu inteira pra js/countries.js) e zero do que morreu nesta leva."
);
assert(
  byFile["js/countries.js"].after === 40,
  "js/countries.js: 40 code points = 20 bandeiras x 2 code points cada — fonte única nova, " +
    "não existia no BASE_COMMIT"
);
assert(
  byFile["js/categories.js"].after === byFile["js/categories.js"].before - 40,
  "js/categories.js: caiu exatamente 40 code points (20 bandeiras x 2, viraram " +
    "window.COUNTRIES.X.emoji) — sobra só o emoji de categoria/hub (bucket que fica)"
);
assert(
  byFile["js/collections.js"].after === byFile["js/collections.js"].before - 40,
  "js/collections.js: caiu exatamente 40 code points (mesma migração de bandeira) — sobra só " +
    "categoria/hub"
);
assert(
  byFile["css/style.css"].after === byFile["css/style.css"].before + 1,
  "css/style.css: +1 sobre o BASE_COMMIT (não regressão) — era +2 até o redesenho completo do " +
    "card (item 2 do roadmap-mestre, 2026-07-25): esta leva REMOVEU `.recipe-thumb` inteira " +
    "(card antigo morreu), levando junto o comentário 'Fase 0c: substituiu o emoji 🍽' que " +
    "vivia em `.recipe-thumb.placeholder svg` — não é um caso novo de emoji cru, é a perda de UM " +
    "dos 2 comentários que geravam aquele +2. Sobram 2 code points (não regressão, código de " +
    "produto continua livre de emoji): `.recipe-hero.placeholder svg` (🍽, página da receita, " +
    "não tocada por este redesenho) e `.preparo-card__delete svg` (\"✕\", Preparos, não " +
    "relacionado a card de receita)."
);
assert(byFile["CHECKLIST-GERAL.md"].after === byFile["CHECKLIST-GERAL.md"].before, "CHECKLIST-GERAL.md: inalterado (não é escopo desta leva, teste negativo de que não foi tocado)");

console.log("");
console.log("==================================================");
console.log("DESCRITIVO — documentação (prosa livre, emoji aqui é só referência ao que mudou)");
console.log("==================================================");
console.log("docs/DESIGN-TOKENS.md: " + byFile["docs/DESIGN-TOKENS.md"].before + " -> " + byFile["docs/DESIGN-TOKENS.md"].after + " (nova seção Iconografia cita os emoji substituídos)");
console.log(".claude/skills/mobile-recipe-ui/SKILL.md: " + byFile[".claude/skills/mobile-recipe-ui/SKILL.md"].before + " -> " + byFile[".claude/skills/mobile-recipe-ui/SKILL.md"].after + " (nova seção Fase 0c documenta o que foi removido, mesmo padrão que o arquivo já usava pra features removidas antigas)");
console.log(".claude/skills/product-navigation-ux/SKILL.md: " + byFile[".claude/skills/product-navigation-ux/SKILL.md"].before + " -> " + byFile[".claude/skills/product-navigation-ux/SKILL.md"].after + " (removeu 1 do texto do botão citado, acrescentou 1 na nota explicando a remoção — wash)");

console.log("");
if (failures > 0) {
  console.log("FALHAS: " + failures);
  process.exit(1);
} else {
  console.log("TODAS AS EXPECTATIVAS BATERAM");
}
