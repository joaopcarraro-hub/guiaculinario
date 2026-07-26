#!/usr/bin/env node
// scripts/exportar-bandeiras.js
//
// Equivalente Node/sharp de scripts/exportar-bandeiras.py — exporta as 20 bandeiras de
// imagens/bandeiras/<ISO2>.svg para <ISO2>.webp 600x400 (3:2, ver DECISÃO 3:2 abaixo).
//
// POR QUE EXISTE UM SIBLING .js (cross-lane, frente de design, 2026-07-26): a tarefa pediu pra
// ESTENDER scripts/exportar-bandeiras.py pro novo alvo 3:2. A lógica de crop foi de fato
// atualizada lá (é a versão canônica/legível da decisão). Mas rodar esse .py NESTA máquina
// esbarrou num bloqueio de ambiente real, não um bug do script: cairosvg precisa da biblioteca
// nativa libcairo (cairo-2.dll), que no Windows só vem via um instalador separado (GTK3
// runtime) — não é algo que `pip install` resolve sozinho, e instalar um runtime de sistema
// inteiro só pra rodar 1 script parecia desproporcional (e é uma mudança de sistema que não é
// claramente reversível). `sharp` (Node) faz o mesmo trabalho (rasteriza SVG via libvips, que
// JÁ vem embutido no binário pré-compilado do pacote — sem instalador de sistema separado) e
// este projeto já roda Node pra tudo mais. Este arquivo é o que RODOU de fato nesta tarefa; o
// .py continua a documentação/lógica de referência (portável pra qualquer ambiente com cairo
// já disponível) — os dois devem ficar sincronizados se o alvo mudar de novo.
//
// DECISÃO 3:2 (correção de causa raiz, revisão do dono 2026-07-26): o acervo 1:1 600x600
// (commit anterior) forçava TODA bandeira a um corte quadrado, cortando o design de propósito
// mesmo nas 14 (de 20) bandeiras cuja proporção OFICIAL já é exatamente 3:2 — corte
// desnecessário nessas, e ainda mais corte que o necessário nas outras 6. 600x400 (3:2) casa
// com a proporção mais comum do acervo real (medido: AT/CN/ES/FR/GR/IN/IT/JP/KR/LB/MA/PE/PT/TH
// = 14 bandeiras EXATAMENTE 1.5 de razão nativa — corte ZERO nessas). As 6 restantes, medidas
// (não assumidas) direto do SVG:
//   MAIS LARGA que 3:2 (corta LARGURA): DE 1.6667 (5:3) | MX 1.75 (7:4) | US 1.9 (19:10) |
//     HU 2.0 (2:1, a mais larga do acervo)
//   MAIS ESTREITA que 3:2 (corta ALTURA): BR 1.4286 (10:7) | DK 1.3214 (~28:37)
//
// A EXCEÇÃO DOS EUA — NÃO REMOVER (mesma razão do .py original, ver lá o detalhe completo): o
// cantão fica no canto SUPERIOR ESQUERDO; um corte centralizado da largura o cortaria pela
// metade. ANCORA['US'] = 'left' ancora o corte na borda esquerda, preservando o cantão inteiro
// e cortando só do lado das listras (direita). Nenhuma outra bandeira do acervo tem emblema
// fora do centro que precise do mesmo tratamento (BR e MX têm emblema centralizado
// horizontalmente; DK tem a cruz nórdica com a barra horizontal no centro vertical — os cortes
// de largura/altura das outras 5 são centralizados, `position: 'centre'`).
//
// ZOOM MÍNIMO (item 2 da rodada, regra nova em docs/DESIGN-TOKENS.md): a área de mídia do tile
// agora casa a proporção do asset (3:2), então o `fit: 'cover'` do sharp já é o corte mínimo
// que cobre a caixa — não precisa de scale(1.15) extra no CSS pra esconder bordas de blur forte
// (blur ficou leve nesta rodada, ver --flag-blur/--flag-mosaic-blur em css/style.css).
//
// DEPENDÊNCIA: npm install sharp (só esta, sem system installer separado — ver nota acima).
//
// COMO RODAR (da raiz do repo)
//   node scripts/exportar-bandeiras.js

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIR = path.join(__dirname, "..", "imagens", "bandeiras");
const TARGET_W = 600;
const TARGET_H = 400;
const TARGET_RATIO = TARGET_W / TARGET_H; // 1.5

// 'left' = ancora o corte na borda esquerda (preserva cantão) | 'centre' = default
const ANCORA = { US: "left" };

async function exportarUma(iso) {
  const svgPath = path.join(DIR, iso + ".svg");
  const nativa = await sharp(svgPath).metadata();
  const nativeRatio = nativa.width / nativa.height;

  // density fixa (ex.: 600) quebra pros 2 lados: SVG com viewBox pequeno (AT é só "9x6" de
  // unidades) rasteriza borrado/blocado; SVG com viewBox já grande (US é "7410x3900") explode
  // pro limite de pixels do sharp. Calibrado POR ARQUIVO a partir do próprio viewBox nativo,
  // mirando ~1600px no lado maior antes do corte/resize final — mesma ideia do "renderiza a 2x
  // o alvo, evita serrilhado" do .py original, só que a base de cálculo agora é o viewBox real
  // de cada SVG, não um valor de densidade fixo que ignora a escala interna de cada arquivo.
  const ladoMaiorNativo = Math.max(nativa.width, nativa.height);
  const density = 72 * (1600 / ladoMaiorNativo);

  // Renderiza no tamanho calibrado acima e já corta pro 3:2 num só passo via fit:'cover'.
  const buf2x = await sharp(svgPath, { density })
    .resize(TARGET_W * 2, TARGET_H * 2, { fit: "cover", position: ANCORA[iso] || "centre" })
    .flatten({ background: "#ffffff" })
    .toBuffer();

  const final = sharp(buf2x).resize(TARGET_W, TARGET_H, { kernel: sharp.kernel.lanczos3 });

  const [lossy, lossless] = await Promise.all([
    final.clone().webp({ quality: 82 }).toBuffer(),
    final.clone().webp({ lossless: true }).toBuffer(),
  ]);
  const usarLossless = lossless.length <= lossy.length;
  const escolhido = usarLossless ? lossless : lossy;

  const destino = path.join(DIR, iso + ".webp");
  fs.writeFileSync(destino, escolhido);

  return {
    iso,
    kb: escolhido.length / 1024,
    modo: usarLossless ? "lossless" : "lossy",
    nativeRatio,
    ancora: ANCORA[iso] || "centre",
    eixoCorte: nativeRatio > TARGET_RATIO ? "largura" : nativeRatio < TARGET_RATIO ? "altura" : "nenhum (já é 3:2)",
  };
}

async function main() {
  const svgs = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.slice(0, -4))
    .sort();
  if (!svgs.length) {
    console.error(`nenhum .svg em ${DIR}`);
    process.exit(1);
  }
  let total = 0;
  for (const iso of svgs) {
    const r = await exportarUma(iso);
    const marca = r.ancora !== "centre" ? "  <- ANCORA ESPECIAL (" + r.ancora + ")" : "";
    console.log(
      `  ${r.iso}.webp  ${r.kb.toFixed(1).padStart(6)} KB  ${r.modo.padEnd(9)} nativa ${r.nativeRatio.toFixed(4)}  corta ${r.eixoCorte}${marca}`
    );
    total += r.kb;
  }
  console.log(`\n${svgs.length} bandeiras, ${total.toFixed(0)} KB no total, 600x400 (3:2).`);
}

main().catch((e) => {
  console.error("falhou:", e.message);
  process.exit(1);
});
