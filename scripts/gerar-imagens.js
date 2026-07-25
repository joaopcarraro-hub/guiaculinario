// scripts/gerar-imagens.js
//
// Gera as fotos de receita do Gusta chamando a API de imagem do Gemini direto por HTTP.
// NÃO usa skill, NÃO usa SDK, NÃO tem dependência npm — só `fetch` (Node 18+), no mesmo padrão
// zero-dependência de derive-tags-dry-run.js / derive-equipment-dry-run.js, e usando o mesmo shim
// de `window` pra ler as 398 receitas de data/*.js.
//
// COMO RODAR
//   export GEMINI_API_KEY=...                 (a chave nunca entra neste arquivo nem no git)
//   node scripts/gerar-imagens.js             -> DRY RUN. imprime prompts, não chama API, custo zero
//   node scripts/gerar-imagens.js --teste     -> gera só as 3 receitas de teste, 2 versões cada
//   node scripts/gerar-imagens.js --gerar     -> gera o que estiver faltando (GASTA DINHEIRO)
//   node scripts/gerar-imagens.js --exportar  -> só reprocessa master -> webp, sem chamar API
//   node scripts/gerar-imagens.js --aplicar   -> PRÉVIA do que muda em data/*.js
//   node scripts/gerar-imagens.js --aplicar --confirmar  -> escreve o caminho da foto na receita
//
//   --receita=paella   combina com qualquer modo acima e limita a UMA receita.
//                      ex: node scripts/gerar-imagens.js --teste --receita=paella  (2 imagens)
//
// O default é dry run de propósito: script que gasta dinheiro não deve gastar por descuido.
// IDEMPOTÊNCIA: só gera onde não existe master. Um `--gerar` distraído não custa nada.
//
// ---------------------------------------------------------------------------------------------
// DECISÃO DE ENQUADRAMENTO (rodada 3) — ler antes de mexer no template
//
// Duas rodadas tentaram controlar a POSIÇÃO VERTICAL do prato pelo prompt. Rodada 1 cortou o
// prato; rodada 2 ("clear empty space above it") empurrou a panela pro rodapé e encheu 45% do
// quadro de parede. Posicionamento é a instrução que modelo de imagem menos obedece.
//
// Então saiu do prompt. O prompt agora pede só: prato GRANDE, INTEIRO, e SÓ A MESA no quadro.
// O ajuste vertical acontece no CSS, que é de graça e reversível:
//
//     .recipe-hero img { object-fit: cover; object-position: center bottom; }
//
// Por quê `bottom`: o hero tem ~220px de altura e o conteúdo desliza por cima da metade de baixo,
// então só a metade SUPERIOR da caixa aparece antes da rolagem. Um master 4:3 numa caixa 16:9
// perde ~25% da altura. Com âncora no rodapé, a faixa visível do master vira y ∈ [25%, 62%] —
// que é onde um prato naturalmente centralizado está. Com a âncora default (center) a faixa é
// y ∈ [12%, 50%] e o prato fica na borda. É um número pra calibrar olhando a tela, não pra
// adivinhar aqui: mudar de `bottom` pra `center 65%` é um caractere, não US$ 13 de regeração.
//
// FIXAR aspectRatio E imageSize NÃO É OPCIONAL. Sem isso a API devolveu 2528x1696 (3:2, 4,3 MP),
// que cai numa faixa de preço acima de 1K — 1,5x a 2,3x mais caro por imagem, ~US$ 60 em vez de
// ~US$ 13 no lote inteiro. Por isso os dois vão explícitos no generationConfig.
// ---------------------------------------------------------------------------------------------
//
// MODELO: gemini-2.5-flash-image é MAIS BARATO (US$ 0,0195/img em batch) mas está DEPRECADO com
// desligamento em 02/10/2026. O default aqui é o sucessor GA, gemini-3.1-flash-image
// (US$ 0,0335/img em batch), porque o valor deste pipeline é justamente valer pras receitas novas —
// e receita nova acontece depois de outubro. Trocar é uma variável de ambiente.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DIR_MASTER = path.join(ROOT, "imagens", "master");   // full-res, fora do git (ver .gitignore)
const DIR_SAIDA = path.join(ROOT, "imagens", "receitas");  // o único arquivo que o app serve

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const ASPECT_RATIO = "4:3";
const IMAGE_SIZE = "1K";
const SAIDA_W = 1184;
const SAIDA_H = 888;
const WEBP_Q = 82;

// ---------------------------------------------------------------------------
// EIXO A — geometria do recipiente. Erro aqui QUEBRA a foto (louça errada, ângulo errado).
// `angulo` agora é sempre "graus ACIMA da mesa", pra não ficar ambíguo pro modelo.
// ---------------------------------------------------------------------------
const EIXO_A = {
  A1: { louca: "wide shallow serving pan", angulo: "50 degrees above the table", lente: "35mm f/2.8" },
  A2: { louca: "white porcelain plate with a thin rim", angulo: "35 degrees above the table", lente: "50mm f/2.5" },
  A3: { louca: "deep off-white ceramic bowl", angulo: "45 degrees above the table", lente: "50mm f/2.8" },
  A4: { louca: "rustic terracotta baking dish", angulo: "45 degrees above the table", lente: "35mm f/2.8" },
  A5: { louca: "wooden serving board", angulo: "40 degrees above the table", lente: "35mm f/2.8" },
  A6: { louca: "small dessert plate", angulo: "30 degrees above the table", lente: "85mm f/2.2" },
  // A7 existe por uma razão só: sobremesa líquida ou cremosa não fica em pé num pratinho raso.
  // Crème brûlée vive num ramequim, affogato e zabaglione num copo, risalamande e rødgrød numa
  // tigelinha. Eram 6 receitas indo pro A6 e as 6 sairiam obviamente erradas na foto.
  A7: { louca: "small deep dessert bowl", angulo: "30 degrees above the table", lente: "85mm f/2.2" },
};

// Nível 0 — as poucas exceções que ganham ATÉ do catId, e o critério pra entrar aqui é estreito de
// propósito: só entra o caso em que a louça da categoria CONTRADIZ FISICAMENTE o prato, não o caso
// em que ela é apenas menos idiomática. Schnitzel numa tábua é discutível; crème brûlée num pratinho
// raso e bourguignon num prato liso não são — o líquido não fica lá. São os dois únicos padrões que
// passam nesse teste, e ambos vinham errados porque `sobremesas-classicas`, `carnes-bovinas` e
// `cordeiro` decidem por catId e o catId não sabe que aquela receita específica é um creme ou um
// braseado.
//
// Estas testam SÓ o `recipe.name`, nunca o subgrupo — e essa restrição também já se pagou: o
// subgrupo "Braseados e Confits" fazia "Confit (Alho, Tomate e Cebola)", que é confit e não
// braseado, cair na tigela funda junto com os braseados de verdade. Exceção que vence a categoria
// tem que apontar pro prato, não pra prateleira onde ele foi guardado.
const REGRAS_FORTES = [
  [/\b(cr[èe]me br[ûu]l[ée]e|creme brulee)/i, "A7"],
  [/\b(bourguignon|coq au vin|osso ?buco|goulash|gulasch|jarrete|brasead|estufad|bisque|blanquette|navarin|rag[ùu])/i, "A3"],
];

// catId -> geometria. Cobre 100% das categorias que NÃO são de país. Corrige o que estava na
// spec: `dish_type:` não é campo de receita, é derivado da categoria em js/tagmodel.js
// (CATEGORY_BASE_TAGS) — então a chave certa é catId, que existe sempre.
const CAT_GEOMETRIA = {
  molhos: "A3", sopas: "A3", massas: "A3", risotos: "A3", arrozes: "A3",
  "entradas-frias": "A2", "entradas-quentes": "A2", "ovos-basicos": "A2", "ovos-classicos": "A2",
  contemporaneos: "A2", "tecnicas-contemporaneas-2": "A2",
  aves: "A5", "carnes-bovinas": "A2", cordeiro: "A5", suinos: "A5",
  peixes: "A2", "frutos-do-mar": "A1",
  padaria: "A5", "sobremesas-classicas": "A6",
};

// Fallback pras ~21 categorias de país (brasileiros, franca, italia, japao...). Ordem importa:
// primeira regra que casar ganha.
const REGRAS_NOME = [
  // As 21 categorias de país/Brasil não têm — nem devem ter — entrada em CAT_GEOMETRIA: "França" não
  // é uma louça, o mesmo data/franca.js tem foie gras (pratinho), bœuf bourguignon (tigela funda) e
  // crème brûlée (sobremesa). Nessas categorias o NOME e o SUBGROUP são o único sinal, e é esta lista
  // que decide a louça de ~193 das 398 receitas. Nas outras 21 categorias ela nem é consultada.
  //
  // DUAS REGRAS DE OURO PRA MEXER AQUI:
  // 1. A ORDEM DECIDE. Primeira que casar vence, então vai do mais específico pro mais genérico.
  // 2. CUIDADO COM O \\b FINAL. `/\\bsalada\\b/` NÃO casa "Saladas", e subgrupo quase sempre vem no
  //    plural ("Carnes", "Sobremesas", "Entradas e Acompanhamentos"). Era esse \\b que estava deixando
  //    124 receitas caírem no default. Por isso a maioria destas regras usa radical SEM \\b de fechar.
  // 3. MAS TIRAR O \\b TEM O PREÇO OPOSTO, e ele já cobrou três vezes: `bolo` casava "Bolonhesa" e
  //    mandava o Ragù pro pratinho de sobremesa; `p[ãa]o` casava "Kung Pao" e mandava frango salteado
  //    pra tábua de pão; `peru` casaria "Peruano". Radical curto que também é começo de outra palavra
  //    LEVA \\b de fechar (`bolos?\\b`, `peru\\b`). Radical longo o bastante pra ser único, não leva.

  // ---- 1. exceções nominais: pratos que uma regra genérica classificaria errado ----
  [/\b(carne de sol|galeto|brisket|porchetta|acaraj[ée]|p[ãa]o de queijo)/i, "A5"],
  [/\b(com natas|lagareiro|pastilla|de casaca|chiles? rellenos?|baeckeoffe)/i, "A4"],
  [/\b(mapo|rogan josh|biryani|masala|tikka|makhani|korma|vindaloo|paprikash|katsudon|donburi|gyudon|chawanmushi|bob[óo] |vatap[áa]|barreado)/i, "A3"],
  // `arroz (com|de|con)` é a família paella/arroz de pato/arroz con pollo — panela larga. O
  // `(?! sushi)` existe porque "Arroz de Sushi (Shari) e Nigiri" casava aqui e ia parar numa
  // panelona antes de chegar na linha do sushi logo abaixo.
  [/\b(sukiyaki|shabu|fondue|caldeir[ãa]o|caldeirada|jambalaya|fideu[áa]|paella|moqueca|cataplana|bouillabaisse|arroz (com|de|con)(?! sushi))/i, "A1"],
  [/\b(tandoori|tonkatsu|tempur[áa]|hommus|homus|hummus|babaganuche|baba ?ganoush|larb|som tam|lomo saltado|na brasa|carpaccio|ceviche|tiradito|sashimi|sushi|nigiri|crudo|tartar|causa|tabule|fattoush|dumpling|xiaolongbao|jiaozi|gyoza|terrine|pat[êe]|foie gras|caprese)/i, "A2"],

  // ---- 2. tipo de prato, pelo nome OU pelo subgrupo ----
  [/\b(sopa|caldo|creme de|consomm|ramen|pho|laksa|jjigae|tom yum|tom kha|chowder|gazpacho|salmorejo|harira|pozole|menudo|congee)/i, "A3"],
  [/\b(gratinad|ao forno|no forno|forno|lasanha|escondidinho|moussaka|tortilla de|enchilada|quiche|parmigiana|parmegiana|empad[ãa]o|cassoulet|tagine|tajine|ratatouille|shepherd)/i, "A4"],
  // padaria ANTES de sobremesa de propósito: o subgrupo dinamarquês "Pães e Doces de Padaria" casa
  // "Doces" e mandaria pãozinho pro pratinho de sobremesa se a ordem fosse a inversa.
  // "pão" acentuado de propósito: `p[ãa]o` sem acento casava "Kung Pao". No acervo o pão vem sempre
  // acentuado; o `pao de ` cobre quem digitar sem acento em composto ("pao de forma").
  [/\b(p[ãa]o de |pão|pães|pãezinho|pãozinho|focaccia|brioche|croissant|empanada|pastel(?!\s+de\s+nata)|past[ée]is(?!\s+de\s+nata)|coxinha|baguete|ciabatta|naan|pita|pretzel|bagel|arepa|sandu[íi]ch|hamb[úu]rguer|bruschetta|crostini|banh mi|gyro|shawarma|souvlaki|satay|yakitori|esfiha|l[áa]ngos|samosa|spanakopita|taco|quesadilla|tamale|burrito|fritura|petisco|rolinho de canela)/i, "A5"],
  // A7 (tigelinha) ANTES do A6 (pratinho): sobremesa líquida/cremosa é a exceção mais específica.
  [/\b(cr[èe]me br[ûu]l[ée]e|creme brulee|affogato|zabaglione|risalamande|r[øo]dgr[øo]d|leitelho|mousse|sorvete|gelato|arroz doce|natilla)/i, "A7"],
  [/\b(sobremesa|doce|bolos?\b|torta|pudim|pavl|tiramis|cannoli|brigadeir|sachertorte|strudel|baklava|churros|alfajor|flan|panna cotta|clafoutis|profiterole|[ée]clair|macaron|cheesecake|quindim|natas?\b|mochi|halva|kunafa|semifreddo|kaiserschmarrn|brunsviger|[æa]bleskiver|framboesa)/i, "A6"],
  [/\b(risoto|risotto|massa|macarr[ãa]o|pasta|spaghetti|rag[ùu]|talharim|nhoque|curr[yi]|dal\b|chili|estrogonofe)/i, "A3"],
  [/\b(assad|pernil|costela|frango inteiro|leit[ãa]o|peru\b|churrasc|kebab|espetin|anticucho|laquead)/i, "A5"],
  [/\b(grelhad|bife|steak|fil[ée]|escalope|schnitzel|milanesa|tornedor|entrada|aperitiv|tapas|mezze|antepast|salada|salteado|dolmades|quibe|kafta|saltimbocca)/i, "A2"],

  // ---- 3. panela e proteína: o degrau mais genérico, logo antes do default ----
  [/\b(panela|feij[ãa]o|feij[õo]es|guisad|ensopad|cozid|birria|mole poblano|sauerbraten|blanquette|navarin|bourguignon|coq au vin|ossobuco|osso buco|goulash|gulasch|bibimbap|dobradinha|rabada|tutu|vaca atolada|mani[çc]oba|tucupi|sarapatel|mojica|tacac[áa]|cuscuz|kimchi)/i, "A3"],
  [/\b(peixe|bacalhau|salm[ãa]o|arenque|linguado|polvo|camar[ãa]o|frutos do mar|carne|aves|pato|porco|vitela|cordeiro)/i, "A2"],
];
const GEOMETRIA_DEFAULT = "A3";

// ---------------------------------------------------------------------------
// EIXO B — a mesa. Erro aqui não quebra nada. É o que evita "398 fotos iguais".
//
// MUDANÇA DA RODADA 3: acabou o campo `fundo`. Nada de parede, janela, azulejo, cortina,
// cozinha. O quadro inteiro é mesa. O que era "fundo" virou `fundoMesa`: coisas mais ao fundo
// NA MESMA MESA, desfocadas.
//
// Isso cria um risco novo: mesa vazia + desfoque = exatamente o "fundo liso de IA" que a gente
// está combatendo. A defesa é `fundoMesa` ter objetos reconhecíveis, não borrão. Por isso cada
// opção tem 3 coisas atrás, não zero.
//
// Todas as opções são CLARAS e QUENTES: creme, marfim, aveia, carvalho mel, travertino.
// Nunca cinza-frio nem branco azulado — é assim que "arejado" deixa de virar "clínico".
// ---------------------------------------------------------------------------
const EIXO_B = [
  {
    mesa: "a pale natural oak dining table",
    props: "a half-full glass of white wine and a fork resting on a rumpled off-white linen napkin",
    fundoMesa: "a small bowl of herbs, a folded cloth and a second empty plate",
    luz: "bright diffused late morning daylight falling across the table from the left, gentle and even, casting a soft light-toned directional shadow to the right of the dish",
    tom: "warm white and honey tones",
  },
  {
    mesa: "a cream-toned marble table with a rumpled oatmeal linen runner",
    props: "a glass of water and a knife and fork already laid out on a folded napkin",
    fundoMesa: "a pepper mill, a small stack of plates and a bowl of coarse salt",
    luz: "bright soft daylight falling across the table from the upper right, casting a gentle light shadow from the dish across the table to the left",
    tom: "warm cream and ivory tones",
  },
  {
    mesa: "a worn whitewashed light wood table",
    props: "two plates with cutlery and a glass of water",
    fundoMesa: "a small side dish, a wooden board with bread and a striped cloth",
    luz: "bright warm daylight falling across the table from the right, casting a clear but soft light shadow to the left of the dish",
    tom: "warm white and honey tones",
  },
  {
    // B4 CORRIGIDO depois de ver a Paella auto: os props antigos (jarra pequena + colher de pau +
    // ramo de ervas solto) liam como MISE EN PLACE — cena de quem vai cozinhar. O briefing é o
    // oposto: mesa posta, prato pronto, alguém prestes a comer. Era o único dos cinco cenários que
    // escorregava pra esse lado; B1, B2 e B3 já traziam segundo prato / talher / copo.
    mesa: "a light wooden table covered with a rumpled raw linen cloth",
    props: "a tall glass of water and a knife and fork resting on the cloth",
    fundoMesa: "a second empty plate, a folded napkin and a small dish of fresh herbs",
    luz: "soft bright daylight coming from behind and to the left, casting a long gentle shadow forward from the dish",
    tom: "warm oatmeal and straw tones",
  },
  {
    mesa: "a pale beige travertine stone table",
    props: "a bottle of olive oil and a crumpled cloth napkin",
    fundoMesa: "half a lemon on a small saucer, a linen runner and a second glass",
    luz: "bright even daylight falling across the table from the left, casting a soft low-contrast shadow to the right of the dish",
    tom: "warm beige and ivory tones",
  },
];

// Deslocamento lateral. O prato NÃO precisa estar centralizado — só não pode ser cortado.
// Custo real de sair do centro: o thumb 1:1 descarta 12,5% de cada lado. Com o prato ocupando
// ~65% da largura, um deslocamento pequeno ainda cabe; e o thumb é 48x48px, onde aparar 3% da
// borda de uma panela é invisível. O card 16:9 corta só ALTURA, então lateralmente é de graça.
const DESLOCAMENTO = [
  "a little off to the left of centre",
  "roughly in the middle of the frame",
  "a little off to the right of centre",
];

// ---------------------------------------------------------------------------
// Prompts escritos à mão pras 3 receitas de teste. Se a receita tem entrada aqui, usa esta.
// O --teste gera A MESMA receita com prompt manual e com prompt automático, pra medir quanto o
// template perde em relação a um prompt bem escrito.
// ---------------------------------------------------------------------------
const PROMPTS_MANUAIS = {
  "Paella": `A photorealistic food photograph of a Spanish paella, just served and about to be eaten, seen from across a home dining table. The wide shallow paella pan is large in the frame and completely visible — no part of it is cut off by any edge of the picture — sitting a little off to the left of centre, with a margin of bare table showing all around it. Saffron rice with separate grains, shrimp, open black mussels, squid rings, peas and strips of roasted red pepper scattered unevenly across the pan, not arranged in any pattern, two lemon wedges resting off to one side, a golden socarrat crust at the rim. Muted natural saffron tones, warm and appetising, not oversaturated. The pale oak table surface fills the entire frame from edge to edge. There is nothing behind the table: no wall, no window, no room, no kitchen, no horizon line, no background scene of any kind — everything visible in the picture is an object sitting on this table. A half-full glass of white wine and a fork resting on a rumpled off-white linen napkin are near the front, and further back on the same table a small bowl of lemon wedges, a folded cloth and a second empty plate, all softly out of focus. A few grains of rice and a parsley leaf have fallen on the wood. Shot from close to the table, from about 50 degrees above it, 35mm f/2.8, shallow depth of field. Bright diffused late morning daylight falling across the table from the left, casting a soft light-toned directional shadow to the right of the pan. Bright, airy and warm: every surface is a warm white or honey tone, never cool grey or bluish, and the food is the darkest and most saturated thing in the frame. Natural imperfect home styling. No text, no watermarks, no frame or border, no hands, no people, no plain or gradient background, no studio backdrop, nothing arranged symmetrically, not dark or moody, not cold or clinical.`,

  "Tornedor Rossini": `A photorealistic food photograph of a Tornedor Rossini, just served and about to be eaten, seen from across a home dining table. The white porcelain plate with a thin rim is large in the frame and completely visible — no part of it is cut off by any edge of the picture — sitting a little off to the right of centre, with a margin of bare table showing all around it. On the plate, a seared medium-rare filet mignon medallion on a round of toasted brioche, topped with a seared lobe of foie gras, with a glossy dark Madeira sauce spooned around it in an uneven pool and one small drip running onto the rim. The cream-toned marble table surface, with a rumpled oatmeal linen runner, fills the entire frame from edge to edge. There is nothing behind the table: no wall, no window, no room, no kitchen, no horizon line, no background scene of any kind — everything visible in the picture is an object sitting on this table. A glass of red wine and a knife and fork already laid out on a folded napkin are near the front, and further back on the same table a pepper mill, a small stack of plates and a bowl of coarse salt, all softly out of focus. Shot from close to the table, from about 35 degrees above it, 50mm f/2.5, shallow depth of field. Bright soft daylight falling across the table from the upper right, casting a gentle light shadow from the plate across the table to the left. Bright, airy and warm: every surface is a warm cream or ivory tone, never cool grey or bluish, and the dark sauce and seared beef are the only deep saturated tones in an otherwise bright frame. Natural, slightly imperfect plating. No text, no watermarks, no frame or border, no hands, no people, no plain or gradient background, no studio backdrop, nothing arranged symmetrically, not dark or moody, not cold or clinical.`,

  "Escondidinho": `A photorealistic food photograph of a Brazilian escondidinho, just brought to the table and about to be eaten, seen from across a home dining table. The rustic terracotta baking dish is large in the frame and completely visible — no part of it is cut off by any edge of the picture — sitting roughly in the middle of the frame, with a margin of bare table showing all around it. The top layer of melted mozzarella is browned unevenly with a few dark blistered spots, one corner has been scooped out with a spoon still resting in it, revealing creamy cassava purée and shredded seasoned dried beef underneath, with chopped parsley scattered loosely on top. The worn whitewashed light wood table surface fills the entire frame from edge to edge. There is nothing behind the table: no wall, no window, no room, no kitchen, no horizon line, no background scene of any kind — everything visible in the picture is an object sitting on this table. Two plates with cutlery and a glass of water are near the front, and further back on the same table a small dish of farofa, a wooden board with bread and a striped cloth, all softly out of focus. A little melted cheese has dripped onto the table and there are a few crumbs. Shot from close to the table, from about 45 degrees above it, 35mm f/2.8, shallow depth of field. Bright warm daylight falling across the table from the right, casting a clear but soft light shadow to the left of the dish. Bright, airy and warm: every surface is a warm white or honey tone, never cool grey or bluish, and the browned cheese and dried beef are the darkest, most saturated elements in the frame. Home cooking, not styled in a studio. No text, no watermarks, no frame or border, no hands, no people, no plain or gradient background, no studio backdrop, nothing arranged symmetrically, not dark or moody, not cold or clinical.`,
};

const RECEITAS_TESTE = ["Paella", "Tornedor Rossini", "Escondidinho"];

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
function loadRecipes() {
  const sandbox = { window: {} };
  fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".js") && f !== "derivation-dict.js" && f !== "shopping-dict.js")
    .forEach((f) => {
      const code = fs.readFileSync(path.join(DATA_DIR, f), "utf8");
      // eslint-disable-next-line no-new-func
      new Function("window", code)(sandbox.window);
    });
  const flat = [];
  Object.keys(sandbox.window.RECIPES || {}).forEach((catId) => {
    (sandbox.window.RECIPES[catId] || []).forEach((recipe) => flat.push({ catId, recipe }));
  });
  return flat;
}

function slug(nome) {
  return String(nome)
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acentos
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cap(str) { return String(str).charAt(0).toUpperCase() + String(str).slice(1); }

function temPromptManual(nome) {
  return Object.prototype.hasOwnProperty.call(PROMPTS_MANUAIS, nome);
}

// FNV-1a. Estável entre execuções e entre máquinas (Math.random e Date não servem: a mesma
// receita tem que receber sempre a mesma mesa, senão regerar troca a identidade da foto).
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

function escolherGeometria(catId, recipe) {
  const alvo = `${recipe.name} ${recipe.subgroup || ""}`;
  for (const [re, cod] of REGRAS_FORTES) if (re.test(recipe.name)) return cod;   // só o nome, ver comentário
  if (CAT_GEOMETRIA[catId]) return CAT_GEOMETRIA[catId];
  for (const [re, cod] of REGRAS_NOME) if (re.test(alvo)) return cod;
  return GEOMETRIA_DEFAULT;
}

// Ingredientes principais, em português, pro modelo saber o que tem no prato. O acervo é
// estruturado (items[].item), com fallback pro texto cru quando a receita é antiga.
// PONTO CEGO CORRIGIDO: cortar nos 7 primeiros perde a guarnição, que costuma estar no FIM da lista
// e é justamente o que aparece na foto. Caso real: a Paella tem 14 ingredientes e "rodelas de limão
// para servir" é o 14º — ficou fora do prompt e o modelo desenhou uma rodela esverdeada de palpite.
// Guarnição é barata em tokens e cara em verossimilhança, então ela entra mesmo passando do corte.
const RE_GUARNICAO = /(para servir|para decorar|para finalizar|para polvilhar|guarni)/i;
const RE_VISUAL = /(lim[ãa]o|laranja|salsinha|salsa|coentro|cebolinha|manjeric|hortel|alecrim|tomilho|parmes|gergelim|azeitona|raspas)/i;

function ingredientesPrincipais(recipe, n = 7) {
  const nomes = [];
  (recipe.ingredients || []).forEach((linha) => {
    if (typeof linha === "string") {
      const limpo = linha.replace(/^[\d\s/,.\-–]+/, "").replace(/\(.*?\)/g, "").split(",")[0].trim();
      if (limpo) nomes.push(limpo);
    } else if (linha && Array.isArray(linha.items)) {
      linha.items.forEach((it) => { if (it && it.item) nomes.push(it.item); });
    }
  });
  const vistos = new Set();
  const IGNORAR = /^(sal|pimenta|pimenta do reino|água|agua|azeite|óleo|oleo|manteiga|açúcar|acucar|farinha de trigo)$/i;
  const limpos = nomes
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s && !IGNORAR.test(s) && !vistos.has(s) && vistos.add(s));

  // no máximo 2 extras: guarnição é tempero visual, não pode virar metade do prompt
  const guarnicao = limpos.slice(n)
    .filter((s) => RE_GUARNICAO.test(s) || RE_VISUAL.test(s))
    .slice(0, 2);

  return { principais: limpos.slice(0, n), guarnicao };
}

// `ignorarManual: true` força a montagem pelo template mesmo quando existe prompt escrito à mão.
// Usado só no --teste, pra gerar a mesma receita das duas formas e comparar.
function montarPrompt(catId, recipe, { ignorarManual = false } = {}) {
  if (!ignorarManual && temPromptManual(recipe.name)) {
    return { texto: PROMPTS_MANUAIS[recipe.name], origem: "manual", A: "-", B: "-" };
  }

  const codA = escolherGeometria(catId, recipe);
  const A = EIXO_A[codA];
  const h = hash(recipe.name);
  const idxB = h % EIXO_B.length;
  const B = EIXO_B[idxB];
  // segundo hash pro deslocamento, senão mesa e posição andam sempre juntas
  const desloc = DESLOCAMENTO[hash(recipe.name + "|pos") % DESLOCAMENTO.length];
  const ingredientes = ingredientesPrincipais(recipe);
  const desc = (recipe.desc || "").replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");

  const texto = [
    `A photorealistic food photograph of "${recipe.name}"`,
    recipe.origin ? `, a dish from ${recipe.origin}` : "",
    `, just served and about to be eaten, seen from across a home dining table.`,
    desc ? ` The dish, described in Portuguese: "${desc}".` : "",
    ingredientes.principais.length ? ` Its main visible ingredients, in Portuguese: ${ingredientes.principais.join(", ")}. Show the dish as it really looks when cooked, faithful to those ingredients.` : "",
    ingredientes.guarnicao.length ? ` Garnished and served with, in Portuguese: ${ingredientes.guarnicao.join(", ")} — show these exactly as named, do not substitute a similar-looking ingredient.` : "",
    ` The ${A.louca} is large in the frame and completely visible — no part of it is cut off by any`,
    ` edge of the picture — sitting ${desloc}, with a margin of bare table showing all around it.`,
    ` The food is arranged loosely and unevenly, not in any pattern, with natural imperfections:`,
    ` a crumb or two fallen on the table, an uneven edge, a small smear or drip.`,
    ` Muted natural tones, warm and appetising, not oversaturated.`,
    ` The surface of ${B.mesa} fills the entire frame from edge to edge. There is nothing behind the`,
    ` table: no wall, no window, no room, no kitchen, no horizon line, no background scene of any`,
    ` kind — everything visible in the picture is an object sitting on this table.`,
    ` ${cap(B.props)} are near the front, and further back on the same table ${B.fundoMesa},`,
    ` all softly out of focus.`,
    ` Shot from close to the table, from about ${A.angulo}, ${A.lente}, shallow depth of field.`,
    ` ${cap(B.luz)}.`,
    ` Bright, airy and warm: every surface is in ${B.tom}, never cool grey or bluish, and the food`,
    ` is the darkest and most saturated thing in the frame. Natural imperfect home styling, not`,
    ` styled in a studio.`,
    // "no chair / no furniture / no floor": a versão auto da Paella deixou escapar um encosto de
    // cadeira e uma nesga de parede no canto. Negativo nomeado funciona (parede e janela sumiram
    // assim); o que NÃO funciona é instrução POSITIVA de posição — ver o bloco do cabeçalho.
    ` No text, no watermarks, no frame or border, no hands, no people, no chairs, no furniture other`,
    ` than the table itself, no floor, no plain or gradient background, no studio backdrop, nothing`,
    ` arranged symmetrically, not dark or moody, not cold or clinical.`,
  ].join("");

  return { texto, origem: "auto", A: codA, B: `B${idxB + 1}` };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
const EXT_POR_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

// destinoBase = caminho SEM extensão. A extensão vem do mimeType que a API devolver — na rodada
// anterior voltou JPEG, não PNG, e um .png com bytes de JPEG dentro quebra ferramenta downstream.
// RETENTATIVA. Não é luxo: a rodada de teste levou um 503 em 2 chamadas. Nessa taxa, 398 imagens dão
// dezenas de falhas, e cada uma exige rodar o comando de novo na mão.
// Retentar erro de HTTP é DE GRAÇA — 503/429 não devolvem imagem, então não há cobrança.
// Retentar erro de CONTEÚDO (200 sem inlineData) não: isso costuma ser filtro de segurança, que é
// determinístico. Insistir 4x num prompt bloqueado só queima tempo em 398 itens.
const STATUS_RETENTAVEL = new Set([408, 429, 500, 502, 503, 504]);
const ESPERAS_MS = [8000, 20000, 45000];   // 4 tentativas no total

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function gerar(prompt, destinoBase, aviso) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não está no ambiente. `export GEMINI_API_KEY=...`");

  const corpoReq = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: ASPECT_RATIO, imageSize: IMAGE_SIZE },
    },
  });

  for (let tentativa = 0; ; tentativa++) {
    const ultima = tentativa >= ESPERAS_MS.length;
    let res, corpo;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: corpoReq,
      });
      corpo = await res.text();
    } catch (e) {
      if (ultima) throw new Error(`falha de rede após ${tentativa + 1} tentativas: ${e.message}`);
      if (aviso) aviso(`rede caiu (${e.message}), esperando ${ESPERAS_MS[tentativa] / 1000}s`);
      await dormir(ESPERAS_MS[tentativa]);
      continue;
    }

    if (!res.ok) {
      if (STATUS_RETENTAVEL.has(res.status) && !ultima) {
        if (aviso) aviso(`HTTP ${res.status}, esperando ${ESPERAS_MS[tentativa] / 1000}s e tentando de novo`);
        await dormir(ESPERAS_MS[tentativa]);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${corpo.slice(0, 600)}`);
    }

    let json;
    try { json = JSON.parse(corpo); } catch (e) { throw new Error(`resposta não-JSON: ${corpo.slice(0, 300)}`); }

    const partes = ((json.candidates || [])[0]?.content?.parts) || [];
    const img = partes.find((p) => p.inlineData && p.inlineData.data);
    if (!img) {
      const motivo = (json.candidates || [])[0]?.finishReason || "sem inlineData";
      throw new Error(`API não devolveu imagem (${motivo}): ${corpo.slice(0, 400)}`);
    }
    const ext = EXT_POR_MIME[img.inlineData.mimeType] || ".png";
    const arquivo = destinoBase + ext;
    fs.writeFileSync(arquivo, Buffer.from(img.inlineData.data, "base64"));
    return { arquivo, bytes: fs.statSync(arquivo).size, tentativas: tentativa + 1 };
  }
}

// ---------------------------------------------------------------------------
// Export: master -> UM arquivo webp 4:3. Só um, de propósito.
// O card 16:9 e o thumb 1:1 saem do MESMO arquivo por `object-fit: cover` no CSS. Três exports
// por receita seriam 3x o peso do repo e 3x o cache do service worker pra ganhar nada.
// ---------------------------------------------------------------------------
// ARMADILHA DO WINDOWS, duas de uma vez:
//  1. `which` não existe no cmd/PowerShell — lá é `where`. Sem isso a detecção falhava sempre.
//  2. `convert` no Windows é o C:\Windows\System32\convert.exe, o utilitário de FAT->NTFS, que não
//     tem NADA a ver com ImageMagick. Chamar aquilo com argumentos de imagem é besteira na melhor
//     das hipóteses. No Windows a gente só aceita `magick` (ImageMagick 7) ou `cwebp`.
const EH_WINDOWS = process.platform === "win32";
function temBinario(bin) {
  if (EH_WINDOWS && bin === "convert") return false;
  try {
    execFileSync(EH_WINDOWS ? "where" : "which", [bin], { stdio: "ignore" });
    return true;
  } catch (e) { return false; }
}

function acharMaster(dir, base) {
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const p = path.join(dir, base + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Dimensões lidas direto do cabeçalho, PNG e JPEG, sem dependência e sem subprocesso.
// Existe porque `-resize L A` NÃO preserva proporção: se o master não vier 4:3, o resize simples
// ESTICA a foto. Não é hipotético — a API já devolveu 2528x1696 num pedido de 4:3.
function dimensoesImagem(arquivo) {
  const buf = fs.readFileSync(arquivo);
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      const ehSOF = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (ehSOF) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

// Recorte pra 4:3 antes do resize, centralizado nos dois eixos — que é onde o prato está agora
// que o prompt parou de tentar posicionar verticalmente.
function retanguloCorte(w, h) {
  const alvo = SAIDA_W / SAIDA_H;
  const atual = w / h;
  if (Math.abs(atual - alvo) < 0.01) return null;
  if (atual > alvo) {
    const nw = Math.round(h * alvo);
    return { x: Math.round((w - nw) / 2), y: 0, w: nw, h };
  }
  const nh = Math.round(w / alvo);
  return { x: 0, y: Math.round((h - nh) / 2), w, h: nh };
}

function exportar(master, destino, aviso) {
  const dim = dimensoesImagem(master);
  const corte = dim ? retanguloCorte(dim.w, dim.h) : null;
  if (corte && typeof aviso === "function") {
    aviso(`master ${dim.w}x${dim.h} não é 4:3 — recortado pra ${corte.w}x${corte.h} antes do resize`);
  }

  if (temBinario("cwebp")) {
    const args = ["-q", String(WEBP_Q), "-m", "6"];
    if (corte) args.push("-crop", String(corte.x), String(corte.y), String(corte.w), String(corte.h));
    args.push("-resize", String(SAIDA_W), String(SAIDA_H), master, "-o", destino);
    execFileSync("cwebp", args, { stdio: "ignore" });
  } else if (temBinario("magick")) {
    const args = [master];
    if (corte) args.push("-crop", `${corte.w}x${corte.h}+${corte.x}+${corte.y}`, "+repage");
    args.push("-resize", `${SAIDA_W}x${SAIDA_H}!`, "-quality", String(WEBP_Q), destino);
    execFileSync("magick", args, { stdio: "ignore" });
  } else if (temBinario("convert")) {
    const args = [master];
    if (corte) args.push("-crop", `${corte.w}x${corte.h}+${corte.x}+${corte.y}`, "+repage");
    args.push("-resize", `${SAIDA_W}x${SAIDA_H}!`, "-quality", String(WEBP_Q), destino);
    execFileSync("convert", args, { stdio: "ignore" });
  } else {
    // NÃO joga erro. O master já está em disco e já foi pago. Perder o lote inteiro por causa de um
    // binário que falta seria o pior desfecho possível. Avisa uma vez e segue; depois de instalar o
    // cwebp, `--exportar` gera todos os webp de uma vez, sem tocar na API.
    if (!exportar._avisou) {
      exportar._avisou = true;
      console.warn(
        "\n  !! sem cwebp/magick: os masters estão sendo salvos, mas nenhum webp foi gerado.\n" +
        "     windows: baixe libwebp em https://developers.google.com/speed/webp/download,\n" +
        "              descompacte e ponha a pasta bin\\ no PATH (o cwebp.exe é standalone).\n" +
        "     ubuntu:  sudo apt install webp\n" +
        "     mac:     brew install webp\n" +
        "     depois:  node scripts/gerar-imagens.js --exportar   (custo zero)\n"
      );
    }
    return null;
  }
  return fs.statSync(destino).size;
}

// ---------------------------------------------------------------------------
// APLICAR: escreve o caminho do webp de volta na receita em data/*.js
//
// Sem este passo o pipeline não fecha: os arquivos existem em imagens/receitas/ mas as 398 receitas
// continuam apontando pro link antigo da Wikipédia. Gerar as fotos e não apontar pra elas é gastar
// os US$ 13 pra nada.
//
// Por que edição de TEXTO e não JSON.stringify: data/*.js é arquivo mantido à mão, com comentários,
// ordem de campos e formatação que têm valor. Reserializar destruiria tudo isso e produziria um diff
// de 398 linhas ilegível. Aqui a cirurgia é mínima — troca ou insere UM campo por receita.
//
// Três travas, porque script que reescreve o acervo à mão erra caro:
//   1. `--aplicar` sozinho é PRÉVIA. Só escreve com `--aplicar --confirmar`.
//   2. Antes de escrever, salva <arquivo>.bak ao lado.
//   3. Depois de escrever, RECARREGA o arquivo com o mesmo shim de window. Se não parsear, ou se o
//      número de receitas mudar, restaura o original na hora e aborta. Vale mais do que revisar
//      regex no olho.
// ---------------------------------------------------------------------------

// Nomes de campo de imagem que já podem existir no acervo. O script detecta qual está em uso em vez
// de assumir "image" e criar um segundo campo órfão ao lado do que o app realmente lê.
const CAMPOS_IMAGEM = ["image", "img", "imagem", "foto", "photo", "thumb", "thumbnail"];
const CAMPO_IMAGEM_PADRAO = "image";

// Scanner que respeita string ('  "  `) e comentário (// e /* */), pra casar chave/colchete de
// verdade. Um regex ingênuo quebra no primeiro `desc` que contiver uma chave ou aspas escapadas.
function acharFechamento(texto, i) {
  const par = { "{": "}", "[": "]" };
  const abre = texto[i];
  const fecha = par[abre];
  if (!fecha) return -1;
  let dep = 0;
  for (let j = i; j < texto.length; j++) {
    const c = texto[j];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      j++;
      while (j < texto.length && texto[j] !== q) { if (texto[j] === "\\") j++; j++; }
      continue;
    }
    if (c === "/" && texto[j + 1] === "/") { while (j < texto.length && texto[j] !== "\n") j++; continue; }
    if (c === "/" && texto[j + 1] === "*") { j += 2; while (j < texto.length && !(texto[j] === "*" && texto[j + 1] === "/")) j++; j++; continue; }
    if (c === abre) dep++;
    else if (c === fecha) { dep--; if (dep === 0) return j; }
  }
  return -1;
}

function fimDaString(texto, i) {   // i = índice da aspa de abertura; devolve o índice da de fechamento
  const q = texto[i];
  let j = i + 1;
  while (j < texto.length && texto[j] !== q) { if (texto[j] === "\\") j++; j++; }
  return j;
}

// Objetos que são elemento DIRETO do array (nível 1). Isso é o que impede o script de confundir a
// receita com um objeto aninhado de ingredients/groups que por acaso também tenha `name`.
function objetosDoArray(texto, iAbre) {
  const iFecha = acharFechamento(texto, iAbre);
  const objs = [];
  if (iFecha < 0) return objs;
  let j = iAbre + 1;
  while (j < iFecha) {
    const c = texto[j];
    if (c === '"' || c === "'" || c === "`") { j = fimDaString(texto, j) + 1; continue; }
    if (c === "/" && texto[j + 1] === "/") { while (j < texto.length && texto[j] !== "\n") j++; continue; }
    if (c === "/" && texto[j + 1] === "*") { j += 2; while (j < texto.length && !(texto[j] === "*" && texto[j + 1] === "/")) j++; j += 2; continue; }
    if (c === "{") { const f = acharFechamento(texto, j); if (f < 0) break; objs.push({ ini: j, fim: f }); j = f + 1; continue; }
    j++;
  }
  return objs;
}

// Campos de nível 1 do objeto, com posição do valor. Aceita chave nua (name:) e chave entre aspas
// ("name":), porque as duas formas aparecem em acervo mantido à mão.
function camposNivel1(texto, ini, fim) {
  const campos = {};
  let dep = 0;
  for (let j = ini; j <= fim; j++) {
    const c = texto[j];
    if (c === "/" && texto[j + 1] === "/") { while (j <= fim && texto[j] !== "\n") j++; continue; }
    if (c === "/" && texto[j + 1] === "*") { j += 2; while (j <= fim && !(texto[j] === "*" && texto[j + 1] === "/")) j++; j++; continue; }

    let chave = null, iChave = j, apos = j, aspaChave = "";
    if (c === '"' || c === "'") {
      const f = fimDaString(texto, j);
      chave = texto.slice(j + 1, f);
      aspaChave = c;
      apos = f + 1;
      j = f;                                  // consome a string de qualquer jeito
    } else if (/[A-Za-z_$]/.test(c)) {
      let k = j; while (k <= fim && /[A-Za-z0-9_$]/.test(texto[k])) k++;
      chave = texto.slice(j, k);
      apos = k;
      j = k - 1;
    } else {
      if (c === "{" || c === "[") dep++;
      else if (c === "}" || c === "]") dep--;
      continue;
    }

    if (dep !== 1) continue;                  // só o nível 1 do objeto interessa
    let m = apos; while (m <= fim && /\s/.test(texto[m])) m++;
    if (texto[m] !== ":") continue;
    let v = m + 1; while (v <= fim && /\s/.test(texto[v])) v++;
    const ehString = texto[v] === '"' || texto[v] === "'";
    campos[chave] = {
      iChave,
      aspaChave,                              // "" = chave nua. usado pra inserir no mesmo estilo do arquivo
      aspaValor: ehString ? texto[v] : "",
      iValor: v,
      fimValor: ehString ? fimDaString(texto, v) : -1,
      valor: ehString ? texto.slice(v + 1, fimDaString(texto, v)) : null,
      ehString,
    };
  }
  return campos;
}

function detectarCampoImagem(todas) {
  const contagem = {};
  todas.forEach(({ recipe }) => {
    CAMPOS_IMAGEM.forEach((k) => {
      if (typeof recipe[k] === "string" && recipe[k].trim()) contagem[k] = (contagem[k] || 0) + 1;
    });
  });
  const usados = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
  return { campo: usados[0] || CAMPO_IMAGEM_PADRAO, contagem, detectado: !!usados[0] };
}

function caminhoWebp(nome) {
  return `imagens/receitas/${slug(nome)}.webp`;
}

// Aplica num arquivo. Devolve { texto, mudancas: [...] } SEM escrever nada — quem escreve é o main,
// depois de conferir. Trabalha de trás pra frente porque toda edição desloca os índices seguintes.
function aplicarNoArquivo(textoOriginal, nomesAlvo, campo) {
  let texto = textoOriginal;
  const mudancas = [];
  const edicoes = [];

  const reArray = /window\.RECIPES\s*\[\s*(["'])(.*?)\1\s*\]\s*=\s*\[/g;
  let m;
  while ((m = reArray.exec(texto)) !== null) {
    const iAbre = texto.indexOf("[", m.index + m[0].length - 1);
    objetosDoArray(texto, iAbre).forEach(({ ini, fim }) => {
      const campos = camposNivel1(texto, ini, fim);
      const nome = campos.name && campos.name.ehString ? campos.name.valor : null;
      if (!nome || !nomesAlvo.has(nome)) return;
      const alvo = caminhoWebp(nome);
      const atual = campos[campo];

      if (atual && atual.ehString) {
        if (atual.valor === alvo) return;                       // já está certo, não mexe
        edicoes.push({ ini: atual.iValor + 1, fim: atual.fimValor, novo: alvo });
        mudancas.push({ nome, de: atual.valor, para: alvo, tipo: "trocado" });
      } else if (atual) {
        mudancas.push({ nome, de: "(valor não-string)", para: alvo, tipo: "PULADO" });
      } else {
        // insere logo depois do `name`, que é onde um humano poria, copiando o estilo de aspas do
        // arquivo (chave nua vs. "chave") pra não deixar o diff com duas convenções na mesma linha
        const q = campos.name.aspaChave;
        const qv = campos.name.aspaValor || '"';
        const dep = campos.name.fimValor;
        edicoes.push({ ini: dep + 1, fim: dep + 1, novo: `, ${q}${campo}${q}: ${qv}${alvo}${qv}`, cru: true });
        mudancas.push({ nome, de: "(sem campo)", para: alvo, tipo: "inserido" });
      }
    });
  }

  edicoes.sort((a, b) => b.ini - a.ini).forEach((e) => {
    const conteudo = e.cru ? e.novo : e.novo.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    texto = texto.slice(0, e.ini) + conteudo + texto.slice(e.fim);
  });

  return { texto, mudancas };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const modo = args.includes("--gerar") ? "gerar"
    : args.includes("--teste") ? "teste"
    : args.includes("--exportar") ? "exportar"
    : args.includes("--aplicar") ? "aplicar" : "dry";
  const confirmar = args.includes("--confirmar");

  [DIR_MASTER, DIR_SAIDA].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  // --receita=paella  -> roda UMA receita só. É o modo mais barato de testar uma mudança de prompt:
  // compara acento/maiúscula por slug, então --receita="pao de queijo" acha "Pão de Queijo".
  const argReceita = args.find((a) => a.startsWith("--receita="));
  const filtro = argReceita ? slug(argReceita.slice("--receita=".length)) : null;

  const todas = loadRecipes();
  let alvo = modo === "teste"
    ? todas.filter(({ recipe }) => RECEITAS_TESTE.includes(recipe.name))
    : todas;
  if (filtro) {
    alvo = todas.filter(({ recipe }) => slug(recipe.name) === filtro);
    if (!alvo.length) {
      console.error(`nenhuma receita com slug "${filtro}". confira o nome exato em data/*.js`);
      process.exit(1);
    }
  }

  console.log(`modelo: ${MODEL}  |  ${ASPECT_RATIO} ${IMAGE_SIZE}  |  modo: ${modo}  |  receitas: ${alvo.length}\n`);

  if (modo === "dry") {
    // Conta ignorando os prompts manuais de propósito: o que interessa auditar é a distribuição
    // do TEMPLATE, que é o que vai rodar em 395 das 398.
    const contagem = {};
    const porFallback = { forte: 0, catId: 0, nome: 0, default: 0 };
    const orfas = [];                            // {catId, subgroup, nome} que caíram no default
    alvo.forEach(({ catId, recipe }) => {
      const p = montarPrompt(catId, recipe, { ignorarManual: true });
      const k = `${p.A} x ${p.B}`;
      contagem[k] = (contagem[k] || 0) + 1;
      // MESMA ORDEM do escolherGeometria(), senão o diagnóstico mente.
      if (REGRAS_FORTES.some(([re]) => re.test(recipe.name))) porFallback.forte++;
      else if (CAT_GEOMETRIA[catId]) porFallback.catId++;
      else if (REGRAS_NOME.some(([re]) => re.test(`${recipe.name} ${recipe.subgroup || ""}`))) porFallback.nome++;
      else {
        porFallback.default++;
        orfas.push({ catId, subgroup: recipe.subgroup || "(sem subgrupo)", nome: recipe.name });
      }
    });
    console.log("distribuição das combinações (o teste de 'não são 398 fotos iguais'):");
    Object.keys(contagem).sort().forEach((k) => console.log(`  ${k.padEnd(10)} ${contagem[k]}`));
    console.log(`\ncombinações distintas em uso: ${Object.keys(contagem).length} de ${Object.keys(EIXO_A).length * EIXO_B.length} possíveis`);
    console.log("\ncomo o eixo A foi decidido:");
    console.log(`  por exceção forte:            ${porFallback.forte}`);
    console.log(`  por catId (confiável):        ${porFallback.catId}`);
    console.log(`  por palavra no nome:          ${porFallback.nome}`);
    console.log(`  caiu no default ${GEOMETRIA_DEFAULT} (revisar):  ${porFallback.default}`);

    // Este bloco é o que permite escrever as regras que faltam. Sem ele, "159 caíram no default" é
    // um número sem ação: A3 é tigela funda, e servir bife, torta ou pão numa tigela funda é errado.
    //
    // Agrupa por catId + subgroup, NÃO só por catId, e imprime os NOMES. Motivo: quem cai aqui são
    // as 21 categorias de país/Brasil, e elas não podem ter entrada em CAT_GEOMETRIA — "França" não
    // é uma louça; o mesmo arquivo tem foie gras, bœuf bourguignon e crème brûlée. O conserto é
    // regra de NOME/SUBGROUP, e pra escrever regra de nome é preciso ver os nomes.
    if (orfas.length) {
      const baldes = {};
      orfas.forEach((o) => {
        const k = `${o.catId} / ${o.subgroup}`;
        (baldes[k] = baldes[k] || []).push(o.nome);
      });
      const chaves = Object.keys(baldes).sort((a, b) => baldes[b].length - baldes[a].length || a.localeCompare(b));
      console.log(`\nsem regra de geometria: ${orfas.length} receitas em ${chaves.length} baldes (catId / subgrupo)`);
      console.log("-".repeat(72));
      chaves.forEach((k) => {
        console.log(`${String(baldes[k].length).padStart(3)}  ${k}`);
        console.log(`     ${baldes[k].join(" | ")}`);
      });
      console.log("-".repeat(72));
      console.log("^ mande este bloco inteiro pro chat. Cada linha vira regra de nome/subgrupo,");
      console.log("  custo zero de API, e é a diferença entre a louça certa e tigela funda em tudo.");
    }

    console.log("\nexemplo de prompt gerado (primeira receita sem prompt manual):");
    const ex = alvo.find(({ recipe }) => !temPromptManual(recipe.name));
    if (ex) {
      const p = montarPrompt(ex.catId, ex.recipe);
      console.log(`\n--- ${ex.recipe.name} [${ex.catId}] ${p.A} x ${p.B} ---\n${p.texto}\n`);
    }
    const faltando = alvo.filter(({ recipe }) => !acharMaster(DIR_MASTER, slug(recipe.name)));
    console.log(`faltam gerar: ${faltando.length} de ${alvo.length}`);
    console.log(`custo estimado (batch, ${MODEL}): US$ ${(faltando.length * 0.0335).toFixed(2)}`);
    console.log("\nnada foi gerado. use --teste (3 receitas) ou --gerar (o lote).");
    return;
  }

  if (modo === "aplicar") {
    const det = detectarCampoImagem(todas);
    const campo = process.env.GUSTA_CAMPO_IMAGEM || det.campo;
    console.log(det.detectado
      ? `campo de imagem detectado no acervo: "${campo}" (${JSON.stringify(det.contagem)})`
      : `nenhum campo de imagem encontrado no acervo — vou usar "${campo}". se o app lê outro nome, ` +
        `rode com GUSTA_CAMPO_IMAGEM=<nome>.`);

    // Só aponta pro que EXISTE em disco. Apontar pra webp inexistente é pior que manter a Wikipédia:
    // troca uma foto feia por um quadrado quebrado.
    const comWebp = alvo.filter(({ recipe }) =>
      fs.existsSync(path.join(DIR_SAIDA, slug(recipe.name) + ".webp")));
    const nomes = new Set(comWebp.map(({ recipe }) => recipe.name));
    console.log(`receitas com webp em disco: ${comWebp.length} de ${alvo.length}\n`);
    if (!comWebp.length) {
      console.log("nada pra aplicar. gere as imagens primeiro (--gerar) ou exporte os masters (--exportar).");
      return;
    }

    const arquivos = fs.readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".js") && f !== "derivation-dict.js" && f !== "shopping-dict.js");
    let totalTrocado = 0, totalInserido = 0, totalPulado = 0;
    const paraEscrever = [];

    arquivos.forEach((f) => {
      const caminho = path.join(DATA_DIR, f);
      const original = fs.readFileSync(caminho, "utf8");
      const { texto, mudancas } = aplicarNoArquivo(original, nomes, campo);
      if (!mudancas.length) return;
      console.log(`${f}`);
      mudancas.slice(0, 6).forEach((c) =>
        console.log(`  ${c.tipo.padEnd(8)} ${c.nome}  ${c.de} -> ${c.para}`));
      if (mudancas.length > 6) console.log(`  ... e mais ${mudancas.length - 6}`);
      mudancas.forEach((c) => {
        if (c.tipo === "trocado") totalTrocado++;
        else if (c.tipo === "inserido") totalInserido++;
        else totalPulado++;
      });
      if (texto !== original) paraEscrever.push({ caminho, f, original, texto });
    });

    console.log(`\ntrocados ${totalTrocado}  |  inseridos ${totalInserido}  |  pulados ${totalPulado}`);

    if (!confirmar) {
      console.log("\nPRÉVIA — nada foi escrito. pra aplicar de verdade:");
      console.log("  node scripts/gerar-imagens.js --aplicar --confirmar");
      return;
    }

    paraEscrever.forEach(({ caminho, original, texto }) => {
      fs.writeFileSync(caminho + ".bak", original, "utf8");
      fs.writeFileSync(caminho, texto, "utf8");
    });

    // Verificação: recarrega tudo com o mesmo shim. Se não parsear ou se o número de receitas mudar,
    // restaura na hora. Barato de rodar e é a diferença entre um bug e um acervo corrompido.
    let ok = true, motivo = "";
    try {
      const depois = loadRecipes();
      if (depois.length !== todas.length) {
        ok = false;
        motivo = `o número de receitas mudou: ${todas.length} -> ${depois.length}`;
      } else {
        const faltou = depois.filter((r) => nomes.has(r.recipe.name) && r.recipe[campo] !== caminhoWebp(r.recipe.name));
        if (faltou.length) { ok = false; motivo = `${faltou.length} receitas não ficaram com o campo certo (ex: ${faltou[0].recipe.name})`; }
      }
    } catch (e) {
      ok = false;
      motivo = `data/*.js não parseia mais: ${e.message}`;
    }

    if (!ok) {
      paraEscrever.forEach(({ caminho, original }) => fs.writeFileSync(caminho, original, "utf8"));
      console.error(`\n!! REVERTIDO. ${motivo}`);
      console.error("   nenhum arquivo de data foi alterado. me mande esta mensagem.");
      process.exit(1);
    }

    console.log(`\nok. ${paraEscrever.length} arquivos alterados, backup em .bak ao lado de cada um.`);
    console.log("confira com `git diff data/` antes de commitar, e apague os .bak depois.");
    return;
  }

  if (modo === "exportar") {
    let n = 0;
    alvo.forEach(({ recipe }) => {
      const s = slug(recipe.name);
      for (const sufixo of ["", "-manual", "-auto"]) {
        const master = acharMaster(DIR_MASTER, s + sufixo);
        if (!master) continue;
        const bytes = exportar(master, path.join(DIR_SAIDA, s + sufixo + ".webp"),
          (m) => console.log(`    ~ ${s}${sufixo}: ${m}`));
        if (bytes === null) continue;
        console.log(`  ${s}${sufixo}.webp  ${Math.round(bytes / 1024)} KB`);
        n++;
      }
    });
    console.log(`\n${n} arquivos exportados.`);
    return;
  }

  // teste / gerar
  let gerados = 0, pulados = 0, erros = 0;
  for (const { catId, recipe } of alvo) {
    const s = slug(recipe.name);

    // no modo teste, gera as DUAS versões da mesma receita pra comparar manual vs. template
    const versoes = modo === "teste" && temPromptManual(recipe.name)
      ? [{ sufixo: "-manual", prompt: PROMPTS_MANUAIS[recipe.name], tag: "manual" },
         { sufixo: "-auto", prompt: montarPrompt(catId, recipe, { ignorarManual: true }).texto, tag: "auto" }]
      : [{ sufixo: "", prompt: montarPrompt(catId, recipe).texto, tag: "auto" }];

    for (const v of versoes) {
      const base = s + v.sufixo;
      const webp = path.join(DIR_SAIDA, base + ".webp");
      const jaTem = acharMaster(DIR_MASTER, base);
      if (jaTem) {
        pulados++;
        // master existe mas webp não: exporta sem chamar a API. Custo zero.
        if (!fs.existsSync(webp)) {
          const bytes = exportar(jaTem, webp, (m) => console.log(`    ~ ${base}: ${m}`));
          console.log(bytes === null
            ? `  = ${base} (master já existe, webp pendente)`
            : `  = ${base} (master já existe, webp reexportado ${Math.round(bytes / 1024)} KB)`);
        } else {
          console.log(`  = ${base} (já existe)`);
        }
        continue;
      }
      try {
        const r = await gerar(v.prompt, path.join(DIR_MASTER, base), (m) => console.log(`    ~ ${base}: ${m}`));
        const bytes = exportar(r.arquivo, webp, (m) => console.log(`    ~ ${base}: ${m}`));
        const destinoWebp = bytes === null ? "webp PENDENTE" : `webp ${Math.round(bytes / 1024)} KB`;
        console.log(`  + ${base} [${v.tag}]  master ${Math.round(r.bytes / 1024)} KB ${path.extname(r.arquivo)} -> ${destinoWebp}`);
        gerados++;
      } catch (e) {
        console.error(`  ! ${base}: ${e.message}`);
        erros++;
      }
    }
  }
  console.log(`\ngerados ${gerados}  |  pulados ${pulados}  |  erros ${erros}`);
  console.log(`custo desta rodada (normal): US$ ${(gerados * 0.067).toFixed(2)}`);
}

main().catch((e) => { console.error("\nfalhou:", e.message); process.exit(1); });
