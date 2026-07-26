// scripts/gerar-categorias.js
//
// Gera o ACERVO DE CATEGORIA — imagem de tile/banner de coleção e de hub.
// É um acervo SEPARADO do de receitas, de propósito. Ver §4 de docs/CONTRATO-IMAGENS-REDESIGN.md:
// não passa por slug(), não é lido por loadRecipeImage(), não mora em imagens/receitas/.
//
// COMO RODAR (sempre da RAIZ do repo, não de dentro de scripts/)
//   node scripts/gerar-categorias.js                  -> DRY RUN. imprime prompts, custo zero
//   node scripts/gerar-categorias.js --gerar          -> gera o que faltar (GASTA DINHEIRO)
//   node scripts/gerar-categorias.js --exportar       -> só master -> webp, sem API, custo zero
//   node scripts/gerar-categorias.js --id=massas      -> limita a UM item, combina com os modos acima
//
// IDEMPOTENTE: só gera onde não existe master. Um --gerar distraído não custa nada.
//
// ---------------------------------------------------------------------------------------------
// POR QUE ESTE PROMPT NÃO É O DE RECEITA
//
// A foto de receita responde "como este prato fica". A imagem de categoria responde "que
// território é este", e vai ser vista BORRADA, com texto por cima. São briefings opostos em
// três pontos, e cada um deles é uma decisão travada no §4 do contrato:
//
//  1. COMPOSIÇÃO SIMPLES. Foto de receita quer imperfeição, migalha, respingo, props ao fundo —
//     é o que dá verossimilhança. Aqui isso é ruído: borrado, vira sujeira; com texto por cima,
//     vira poluição. Aqui são POUCOS elementos GRANDES.
//
//  2. SEM DETALHE FINO — E ISSO NÃO SE PEDE POR POSIÇÃO.
//     RODADA 1 ERROU AQUI, e o erro é instrutivo. Tentando servir o "centro sem detalhe fino" do
//     §4, o prompt tinha TRÊS instruções empurrando pro vazio ao mesmo tempo: "a lot of bare
//     surface", "the elements sit towards the edges" e "the middle of the frame is mostly bare
//     surface". O modelo obedeceu as três e o assunto ficou com ~25% do quadro — como TILE, o
//     usuário via mesa vazia com um cantinho de comida. O agravante é que o próprio cabeçalho de
//     gerar-imagens.js já registra que instrução de POSIÇÃO é a que o modelo menos obedece, e
//     mesmo assim três delas entraram.
//     A correção não é compensar, é trocar de alavanca: instrução de TAMANHO ("together they fill
//     about half of the square"), que é o que o modelo obedece. E o "sem detalhe fino" sai do
//     prompt: quem tira detalhe é o BLUR na hora de renderizar o banner — é literalmente a função
//     dele. Pedir as duas coisas era pagar duas vezes pela mesma entrega e estragar o tile.
//
//  3. QUADRADO, NÃO 4:3. 1:1 600×600. O tile é quadrado e o banner de hub recorta do quadrado.
//
// O que NÃO muda são as âncoras do espectro: luz natural difusa, superfície clara, tons quentes,
// nada atrás da superfície. É isso que faz a imagem de categoria conversar com as 398 de receita
// em vez de parecer de outro app.
// ---------------------------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR_MASTER = path.join(ROOT, "imagens", "master-categorias"); // full-res, fora do git
const DIR_SAIDA = path.join(ROOT, "imagens", "categorias");         // o que o app serve

const MODEL = process.env.GUSTA_MODELO_IMAGEM || "gemini-3.1-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const ASPECT_RATIO = "1:1";   // travado: tile é quadrado (§4)
const IMAGE_SIZE = "1K";      // travado: sem isto a API devolve 4 MP e a faixa de preço sobe
const SAIDA_PX = 600;         // travado no spec do §4
const WEBP_Q = 82;
const PRECO_UNIT = 0.067;     // 1K síncrono. NÃO é o preço de batch: este script não usa batch.

// -------------------------------------------------------------------------------------------------
// O TEMPLATE
// -------------------------------------------------------------------------------------------------
const ANCORA_NEGATIVA =
  " No text, no letters, no numbers, no labels, no lettering, no printed or handwritten text on" +
  " anything, no watermarks, no logos, no frame or border, no hands, no people, no floor, no wall," +
  " no window, no room, no plain or gradient background, no studio backdrop, not dark or moody," +
  " not cold or clinical, nothing crowded, no scattered small items, no busy pattern, no confetti" +
  " of ingredients, no dense garnish, nothing arranged in a grid or symmetrically.";

function montarPrompt(item) {
  return (
    `A photorealistic overhead food photograph, seen straight down from directly above, of ${item.assunto},` +
    ` on a pale warm ${item.superficie}.` +
    // ENQUADRAMENTO ENDURECIDO (rodada 3). O tile de categoria é o QUADRADO INTEIRO — ao contrário
    // do hero de receita, que recorta 25% do topo e come justamente onde parede e janela vazam.
    // Aqui não existe recorte que salve, então fundo não pode ser escondido: tem que ser
    // IMPOSSÍVEL DE ENQUADRAR. A câmera perpendicular e perto resolve na raiz — sem horizonte
    // enquadrável, não há parede a gerar. Comparando com o prompt de receita achei a lacuna: lá
    // existe a frase "everything visible in the picture is an object sitting on this table", que é
    // a formulação forte (define o conjunto INTEIRO do que pode existir, em vez de listar o que
    // não pode). Aqui ela não existia — só havia a lista de negativos, que acerta ~metade das
    // vezes. Agora existe.
    ` The camera is perpendicular to the surface and close to it, so the surface is the ONLY thing` +
    ` in the picture: it fills the entire square frame from edge to edge, and EVERY PART OF THE` +
    ` PICTURE is either that surface or something resting on it. The edge of the table is never` +
    ` visible, there is no horizon line, and there is nothing beyond the surface — no room, no` +
    ` wall, no window, no floor, nothing in the distance.` +
    ` VERY SIMPLE COMPOSITION: only two or three elements, but they are LARGE and TOGETHER THEY` +
    ` FILL ABOUT HALF OF THE SQUARE FRAME, grouped near the centre, with bare surface as a margin` +
    ` around them. Every element is COMPLETELY VISIBLE — no part of any of them is cut off by any` +
    ` edge of the picture. Big bold shapes — but THE FOOD ITSELF IS RICH AND TEXTURED: crust, crumb, char,` +
    ` glaze, visible layers, a glossy surface are all wanted. This is THE picture of the whole` +
    ` category, so the dish must look genuinely delicious and worth cooking, cooked and presented` +
    ` at its best, not raw and not plain. What stays uncluttered is the FRAME around it: this` +
    ` picture is also shown blurred with text on top, so it must read as a few big appetising` +
    ` shapes and colour, never as a busy scene.` +
    ` Even, medium contrast across the whole frame — no bright hotspot, no deep shadow pocket.` +
    ` Bright diffused natural daylight from the left, casting soft light-toned shadows.` +
    ` The surface is warm white, honey and cream, never cool grey or bluish; the food may be` +
    ` deeper and richer in colour than the surface, and should be the most saturated thing in the` +
    ` frame. Natural colour, appetising, not artificially oversaturated. Shot with a 50mm lens,` +
    ` everything in focus, no shallow depth of field.` +
    ANCORA_NEGATIVA
  );
}

// -------------------------------------------------------------------------------------------------
// O ACERVO — 19 itens. Contagem fechada em 26/07/2026, ver §4 do contrato.
//
// FORA do lote, de propósito:
//   - os 20 países: usam bandeira SVG em imagens/bandeiras/<iso2>.svg, não imagem gerada.
//   - "Por tempo" (4) e "Por dificuldade" (3): ADIADO, ÓRFÃO. Nada no app linka para
//     #/grupo/tempo nem #/grupo/dificuldade — GRUPOS só é consultado por find(), nunca iterado
//     para renderizar tile, e nenhuma das 7 coleções tem link. O próprio js/app.js documenta:
//     "Único entry point real de qualquer coleção [...] renderCollectionCard (só chamado de dentro
//     da grade do grupo dono) OU o tile da própria Home". Hub inalcançável não renderiza banner.
//     Se um dia forem linkadas, são 2 imagens de custo marginal (R$ 0,68) — gera-se na hora.
// -------------------------------------------------------------------------------------------------
// RODADA 2 ERROU AQUI, e o erro foi de AMBIÇÃO, não de técnica. Os assuntos descreviam o
// ingrediente em repouso — "um bife inteiro numa tábua", "um bolo redondo com glacê liso". Sai
// correto e sai sem graça. Esta imagem é A IMAGEM da categoria inteira: se ela não der vontade
// de cozinhar, ela não está fazendo o trabalho dela.
// Regra dos assuntos abaixo: prato PRONTO, no auge, e sempre que possível já CORTADO/SERVIDO —
// é o corte que revela miolo, camada, ponto rosado, gema correndo. Foi exatamente o que faltou
// no bolo da rodada 2, que virou dois discos claros indistinguíveis de uma tampa de pote.
const ACERVO = [
  // ---------- Fundamentos (8) ----------
  { id: "molhos", label: "Molhos Clássicos", assunto: "a small ceramic jug pouring a thick ribbon of glossy dark demi-glace onto a white plate, the sauce catching the light, and a spoon coated in it", superficie: "limestone worktop" },
  { id: "sopas", label: "Sopas", assunto: "a wide shallow bowl of deep golden soup with a swirl of cream through it and a few green herb leaves, steam still rising, one spoon beside", superficie: "wooden worktop" },
  { id: "entradas", label: "Entradas", assunto: "three glossy bruschetta on a board, piled high with ripe red tomato and basil, olive oil shining on toasted bread", superficie: "wooden worktop" },
  { id: "massas", label: "Massas", assunto: "a deep bowl of tagliatelle twirled into a tall nest, coated in glossy tomato sauce, torn basil and a shaving of parmesan on top", superficie: "wooden worktop" },
  { id: "risotos-arroz", label: "Risotos/Arroz", assunto: "a wide shallow bowl of creamy saffron risotto, loose and glossy, with curls of shaved parmesan and a crack of pepper on top", superficie: "wooden worktop" },
  { id: "padaria", label: "Padaria", assunto: "a round sourdough loaf with a dark blistered crust, cut open, the open airy crumb turned up to the camera", superficie: "wooden worktop" },
  { id: "sobremesas-classicas", label: "Sobremesas", assunto: "a tall chocolate layer cake with glossy dark ganache, one thick wedge already cut and lifted slightly away, showing the dark sponge layers and cream between them", superficie: "limestone worktop" },
  // REPROVADA na rodada 4: três potes lado a lado transbordavam a largura e saíram cortados nas
  // duas laterais E embaixo, e o "spoon lifting" forçou ângulo em vez de perpendicular. Dois potes
  // e uma tigela baixa cabem; o que estava sendo mostrado por uma colher levantando vira o próprio
  // conteúdo visto de cima.
  { id: "tecnicas", label: "Técnicas", assunto: "two clear glass jars and one shallow bowl, holding vivid preparations — a golden infused oil, a bright green herb gel and a pale airy foam", superficie: "limestone worktop" },

  // ---------- Proteínas (8) ----------
  { id: "aves", label: "Aves", assunto: "a whole roast chicken with deep golden glossy skin on a board, one leg already carved away and the breast sliced and fanned, juices pooling", superficie: "wooden worktop" },
  { id: "carnes-bovinas", label: "Carnes Bovinas", assunto: "a thick ribeye steak with a dark seared crust, sliced across into thick slices and fanned out to show the rosy medium-rare centre, flaky salt scattered on the cut faces", superficie: "wooden worktop" },
  { id: "suinos", label: "Suínos", assunto: "a piece of roast pork belly with deep golden crisp crackling, sliced into thick fingers and fanned on a board, the tender layers visible", superficie: "wooden worktop" },
  { id: "peixes", label: "Peixes", assunto: "a whole roasted fish with crisp golden skin, herbs and lemon slices on top, one fillet lifted open to show the white flaking flesh", superficie: "wooden worktop" },
  // REPROVADA na rodada 4: camarões e mexilhões soltos direto na tábua viraram dezenas de peças
  // espalhadas — exatamente o "no scattered small items" que o próprio prompt proíbe. Borrada não
  // lia nada, virava papa laranja com pontos pretos. A correção é dar um RECIPIENTE: a mesma
  // comida dentro de uma panela larga é UMA forma grande, e a panela sobrevive ao blur.
  { id: "frutos-do-mar", label: "Frutos do Mar", assunto: "a wide shallow pan generously filled with glossy grilled prawns and open black mussels, lightly charred, with grilled lemon halves — the pan holding it all together as one shape", superficie: "wooden worktop" },
  { id: "col-ovo", label: "Ovos", assunto: "a poached egg cut open on a thick slice of toasted sourdough, the deep orange yolk running out over the bread, cracked pepper on top", superficie: "limestone worktop" },
  { id: "cordeiro", label: "Cordeiro", assunto: "a herb-crusted rack of lamb carved into chops and fanned on a board, the pink centres showing, a sprig of rosemary beside", superficie: "wooden worktop" },
  { id: "col-vegetariana", label: "Vegetarianas", assunto: "a platter of roasted vegetables at their best — charred courgette, blistered red pepper, caramelised tomato — glossy with olive oil and scattered herbs", superficie: "wooden worktop" },

  // ---------- Hubs (3) ----------
  // O assunto do hub é deliberadamente mais genérico que o das coleções: o hub não é nenhuma das
  // filhas, e usar o assunto de uma delas faria "Proteínas" parecer "Carnes Bovinas". Mas genérico
  // não pode virar sem graça — vale a mesma regra de prato no auge.
  { id: "hub-fundamentos", label: "Mais Categorias (hub)", assunto: "a stone mortar with fresh green pesto just ground in it, the pestle resting inside, and a whisk with glossy sauce clinging to the wires", superficie: "wooden worktop" },
  { id: "hub-proteinas", label: "Proteínas (hub)", assunto: "a board with three cooked proteins side by side and well spaced — sliced pink beef, a golden-skinned fish fillet and a glossy roast chicken thigh", superficie: "wooden worktop" },
  { id: "hub-cozinhas", label: "Países (hub)", assunto: "three small bowls of vivid whole spices — deep red paprika, golden saffron threads and green cardamom — well spaced apart", superficie: "limestone worktop" },
];

// -------------------------------------------------------------------------------------------------
// API — mesmo padrão de gerar-imagens.js, incluindo a distinção de 429 que custou 5 horas lá.
// -------------------------------------------------------------------------------------------------
const STATUS_RETENTAVEL = new Set([408, 429, 500, 502, 503, 504]);
const ESPERAS_MS = [8000, 20000, 45000];
const RE_TETO = /spending cap|spend cap|RESOURCE_EXHAUSTED|quota|billing|exceeded your current/i;
const EXT_POR_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

class ErroTeto extends Error {
  constructor(corpo) {
    super(
      "TETO DE GASTO ATINGIDO — o projeto bateu o limite no AI Studio.\n" +
      "  Não é falta de crédito e não passa sozinho: levante o teto em https://ai.studio/spend\n" +
      "  Nada foi cobrado por esta chamada. Depois, rode o MESMO comando: pula o que já existe.\n" +
      "  Resposta da API: " + corpo.slice(0, 300)
    );
    this.abortarLote = true;
  }
}

async function gerar(prompt, destinoBase, aviso) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não está no ambiente.");
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
      if ((res.status === 429 || res.status === 403) && RE_TETO.test(corpo)) throw new ErroTeto(corpo);
      if (STATUS_RETENTAVEL.has(res.status) && !ultima) {
        if (aviso) aviso(`HTTP ${res.status}, esperando ${ESPERAS_MS[tentativa] / 1000}s e tentando de novo`);
        await dormir(ESPERAS_MS[tentativa]);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${corpo.slice(0, 600)}`);
    }

    const json = JSON.parse(corpo);
    const partes = ((json.candidates || [])[0] || {}).content ? json.candidates[0].content.parts || [] : [];
    const img = partes.find((p) => p.inlineData && p.inlineData.data);
    // Erro de CONTEÚDO (200 sem imagem) NÃO é retentado: é filtro de segurança, determinístico.
    if (!img) throw new Error("200 sem imagem (provável filtro de conteúdo)");
    const ext = EXT_POR_MIME[img.inlineData.mimeType] || ".png";
    const arquivo = destinoBase + ext;
    const bytes = Buffer.from(img.inlineData.data, "base64");
    fs.writeFileSync(arquivo, bytes);
    return { arquivo, bytes: bytes.length };
  }
}

// -------------------------------------------------------------------------------------------------
// Export master -> webp 600x600. Corta pro quadrado central ANTES de redimensionar: sem o corte,
// `-resize 600x600!` ESTICA a imagem se a API devolver algo que não seja exatamente 1:1 — foi o
// erro do acervo de receita e está registrado no §6.4 do contrato.
// -------------------------------------------------------------------------------------------------
function temBinario(bin) {
  try { execFileSync(bin, ["-version"], { stdio: "ignore" }); return true; } catch (e) { return false; }
}

function dimensoes(arquivo) {
  try {
    const out = execFileSync("identify", ["-format", "%w %h", arquivo], { encoding: "utf8" });
    const [w, h] = out.trim().split(/\s+/).map(Number);
    return w && h ? { w, h } : null;
  } catch (e) { return null; }
}

function exportar(master, destino, aviso) {
  const d = dimensoes(master);
  let corte = null;
  if (d && Math.abs(d.w / d.h - 1) > 0.01) {
    const lado = Math.min(d.w, d.h);
    corte = { x: Math.floor((d.w - lado) / 2), y: Math.floor((d.h - lado) / 2), w: lado, h: lado };
    if (aviso) aviso(`master ${d.w}x${d.h} não é 1:1 — recortado pro quadrado central antes do resize`);
  }
  if (temBinario("cwebp")) {
    const args = ["-q", String(WEBP_Q), "-m", "6"];
    if (corte) args.push("-crop", String(corte.x), String(corte.y), String(corte.w), String(corte.h));
    args.push("-resize", String(SAIDA_PX), String(SAIDA_PX), master, "-o", destino);
    execFileSync("cwebp", args, { stdio: "ignore" });
  } else if (temBinario("magick") || temBinario("convert")) {
    const bin = temBinario("magick") ? "magick" : "convert";
    const args = [master];
    if (corte) args.push("-crop", `${corte.w}x${corte.h}+${corte.x}+${corte.y}`, "+repage");
    args.push("-resize", `${SAIDA_PX}x${SAIDA_PX}!`, "-quality", String(WEBP_Q), destino);
    execFileSync(bin, args, { stdio: "ignore" });
  } else {
    if (!exportar._avisou) {
      exportar._avisou = true;
      console.warn(
        "\n  !! sem cwebp/magick: os masters foram salvos, mas nenhum webp foi gerado.\n" +
        "     windows: baixe libwebp em https://developers.google.com/speed/webp/download\n" +
        "     depois:  node scripts/gerar-categorias.js --exportar   (custo zero)\n"
      );
    }
    return null;
  }
  return fs.statSync(destino).size;
}

function acharMaster(base) {
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const p = path.join(DIR_MASTER, base + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// -------------------------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const modo = args.includes("--gerar") ? "gerar" : args.includes("--exportar") ? "exportar" : "dry";
  const argId = args.find((a) => a.startsWith("--id="));
  const filtro = argId ? argId.slice("--id=".length) : null;

  [DIR_MASTER, DIR_SAIDA].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  let alvo = ACERVO;
  if (filtro) {
    alvo = ACERVO.filter((i) => i.id === filtro);
    if (!alvo.length) {
      console.error(`nenhum item com id "${filtro}". ids válidos:\n  ${ACERVO.map((i) => i.id).join("  ")}`);
      process.exit(1);
    }
  }

  console.log(`modelo: ${MODEL}  |  ${ASPECT_RATIO} ${IMAGE_SIZE} -> ${SAIDA_PX}x${SAIDA_PX}  |  modo: ${modo}  |  itens: ${alvo.length}`);

  if (modo === "dry") {
    const faltando = alvo.filter((i) => !acharMaster(i.id));
    console.log(`\nacervo: ${ACERVO.length} itens (8 Fundamentos + 8 Proteínas + 3 hubs)`);
    console.log("FORA do lote: 20 países (bandeira SVG) e 7 de tempo/dificuldade (adiado, órfão)");
    console.log(`\nfaltam gerar: ${faltando.length} de ${alvo.length}`);
    console.log(`custo real (síncrono, ${MODEL}): US$ ${(faltando.length * PRECO_UNIT).toFixed(2)}`);
    console.log(`\nexemplo de prompt (${alvo[0].label}):\n\n${montarPrompt(alvo[0])}\n`);
    console.log("nada foi gerado. use --gerar.");
    return;
  }

  if (modo === "exportar") {
    let n = 0;
    for (const item of alvo) {
      const master = acharMaster(item.id);
      if (!master) continue;
      const bytes = exportar(master, path.join(DIR_SAIDA, item.id + ".webp"), (m) => console.log(`    ~ ${item.id}: ${m}`));
      if (bytes === null) continue;
      console.log(`  ${item.id}.webp  ${Math.round(bytes / 1024)} KB`);
      n++;
    }
    console.log(`\n${n} arquivos exportados.`);
    return;
  }

  let gerados = 0, pulados = 0, erros = 0, abortou = false;
  for (const item of alvo) {
    if (abortou) break;
    if (acharMaster(item.id)) { pulados++; console.log(`  = ${item.id} (já existe)`); continue; }
    try {
      const r = await gerar(montarPrompt(item), path.join(DIR_MASTER, item.id), (m) => console.log(`    ~ ${item.id}: ${m}`));
      const webp = path.join(DIR_SAIDA, item.id + ".webp");
      const bytes = exportar(r.arquivo, webp, (m) => console.log(`    ~ ${item.id}: ${m}`));
      console.log(`  + ${item.id}  master ${Math.round(r.bytes / 1024)} KB -> ${bytes === null ? "webp PENDENTE" : "webp " + Math.round(bytes / 1024) + " KB"}`);
      gerados++;
    } catch (e) {
      console.error(`  ! ${item.id}: ${e.message}`);
      erros++;
      if (e.abortarLote) {
        console.error(`\n>>> LOTE INTERROMPIDO. ${gerados} geradas. O que está em disco está seguro.\n`);
        abortou = true;
      }
    }
  }
  console.log(`\ngerados ${gerados}  |  pulados ${pulados}  |  erros ${erros}`);
  console.log(`custo desta rodada: US$ ${(gerados * PRECO_UNIT).toFixed(2)}`);
}

main().catch((e) => { console.error("\nfalhou:", e.message); process.exit(1); });
