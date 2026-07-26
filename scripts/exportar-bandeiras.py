#!/usr/bin/env python3
"""
scripts/exportar-bandeiras.py

Exporta as 20 bandeiras de imagens/bandeiras/<ISO2>.svg para <ISO2>.webp 600x400 (3:2).

NÃO RODOU NESTA MÁQUINA (2026-07-26) — ver scripts/exportar-bandeiras.js
  Esta rodada de calibração precisou regerar o acervo pro novo alvo 3:2 (ver "DECISÃO 3:2"
  abaixo). Rodar ESTE arquivo nesta máquina Windows esbarrou num bloqueio de ambiente real, não
  um bug do script: cairosvg precisa da biblioteca nativa libcairo (cairo-2.dll), que no Windows
  só vem via um instalador separado (GTK3 runtime) — `pip install cairosvg` sozinho não resolve,
  e instalar um runtime de sistema inteiro só pra rodar 1 script pareceu desproporcional (e não
  é uma mudança claramente reversível). A lógica abaixo FOI atualizada pro alvo 3:2 (é a versão
  canônica/legível da decisão, portável pra qualquer ambiente com cairo já disponível), mas quem
  efetivamente RODOU e gerou os 20 .webp desta rodada foi scripts/exportar-bandeiras.js (Node +
  sharp, que embute libvips pré-compilado, sem instalador de sistema separado). Os dois scripts
  devem ficar sincronizados se o alvo mudar de novo — o .js é quem tem a prova de execução real
  (números no relatório da tarefa), este .py é a referência de leitura.

DECISÃO 3:2 (correção de causa raiz, revisão do dono 2026-07-26)
  O acervo 1:1 600x600 (rodada anterior) forçava TODA bandeira a um corte quadrado — corte
  desnecessário nas 14 (de 20) bandeiras cuja proporção OFICIAL já é 3:2, e ainda mais corte que
  o necessário nas outras 6. 600x400 (3:2) casa com a proporção mais comum do acervo real,
  medida direto de cada SVG (não assumida da tabela de proporções oficiais de bandeiras, que às
  vezes diverge do desenho real do arquivo):
    JÁ É 3:2, corte ZERO (14): AT, CN, ES, FR, GR, IN, IT, JP, KR, LB, MA, PE, PT, TH
    MAIS LARGA que 3:2, corta LARGURA (4): DE 1,6667 (5:3) | MX 1,75 (7:4) | US 1,9 (19:10) |
      HU 2,0 (2:1, a mais larga do acervo)
    MAIS ESTREITA que 3:2, corta ALTURA (2): BR 1,4286 (10:7) | DK 1,3214 (~28:37)

A EXCEÇÃO DOS EUA — NÃO REMOVER
  Crop 3:2 centralizado funciona para 19 das 20. Para os EUA, não: o cantão (as 50 estrelas)
  fica no canto SUPERIOR ESQUERDO, e um corte central da largura o cortaria pela metade. Por
  isso ANCORA_X['US'] = 0.0, que ancora o corte na borda esquerda e preserva o cantão inteiro —
  o corte sai inteiro do lado das listras (direita). Confirmado visualmente no resultado real
  (scripts/exportar-bandeiras.js): as 50 estrelas saem intactas, só um pouco das listras do lado
  direito é cortado. Qualquer bandeira nova com emblema fora do centro precisa da mesma análise
  (BR e MX, os outros 2 casos com emblema, têm o emblema centralizado — corte simétrico é seguro
  pros dois, confirmado visualmente).

ZOOM/CORTE MÍNIMO (item 2 da rodada de calibração, regra nova em docs/DESIGN-TOKENS.md)
  A área de mídia do tile agora casa a proporção do próprio asset (3:2) — cover vira o corte
  MÍNIMO que cobre a caixa (zero extra), então o CSS não precisa mais de scale(1.15) pra
  esconder borda de blur forte; o blur também ficou bem mais leve nesta rodada (ver
  --flag-blur/--flag-mosaic-blur em css/style.css).

LOSSY OU LOSSLESS
  Decidido POR ARQUIVO, não por regra: gera os dois e fica o menor. Bandeira de faixa chapada
  comprime melhor lossless; bandeira com brasão comprime melhor lossy. Mesmo critério de sempre.

DEPENDÊNCIAS (as únicas do projeto fora de Node — de propósito, é build step, não runtime)
  pip install cairosvg pillow

COMO RODAR (da raiz do repo, num ambiente com libcairo disponível)
  python3 scripts/exportar-bandeiras.py
"""

import glob
import io
import os
import sys

try:
    import cairosvg
    from PIL import Image
except ImportError:
    sys.exit("faltam dependências: pip install cairosvg pillow")

DIR = os.path.join(os.path.dirname(__file__), "..", "imagens", "bandeiras")
LARGURA = 600
ALTURA = 400
RAZAO_ALVO = LARGURA / ALTURA  # 1.5 (3:2)

# 0.0 = ancora o corte na borda esquerda | 0.5 = centraliza (default)
ANCORA_X = {"US": 0.0}   # ver "A EXCEÇÃO DOS EUA" no topo


def exportar(svg):
    iso = os.path.basename(svg)[:-4]
    # renderiza a 2x o lado final: dá margem de reamostragem e evita serrilhado na diagonal
    png = cairosvg.svg2png(url=svg, output_height=ALTURA * 2)
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    im = Image.alpha_composite(Image.new("RGBA", im.size, (255, 255, 255, 255)), im).convert("RGB")

    w, h = im.size
    razao_nativa = w / h

    if razao_nativa > RAZAO_ALVO:
        # mais larga que o alvo: corta LARGURA, altura já bate
        largura_final = int(h * RAZAO_ALVO)
        x0 = int((w - largura_final) * ANCORA_X.get(iso, 0.5))
        y0 = 0
        quad = im.crop((x0, y0, x0 + largura_final, h))
    elif razao_nativa < RAZAO_ALVO:
        # mais estreita que o alvo: corta ALTURA, largura já bate
        altura_final = int(w / RAZAO_ALVO)
        x0 = 0
        y0 = (h - altura_final) // 2
        quad = im.crop((x0, y0, w, y0 + altura_final))
    else:
        quad = im  # já é exatamente 3:2, corte zero

    quad = quad.resize((LARGURA, ALTURA), Image.LANCZOS)

    a, b = io.BytesIO(), io.BytesIO()
    quad.save(a, "WEBP", quality=82, method=6)
    quad.save(b, "WEBP", lossless=True, method=6)
    sem_perda = b.tell() <= a.tell()

    destino = os.path.join(DIR, iso + ".webp")
    quad.save(destino, "WEBP", **({"lossless": True, "method": 6} if sem_perda else {"quality": 82, "method": 6}))
    return iso, os.path.getsize(destino) / 1024, "lossless" if sem_perda else "lossy", razao_nativa, ANCORA_X.get(iso, 0.5)


def main():
    svgs = sorted(glob.glob(os.path.join(DIR, "*.svg")))
    if not svgs:
        sys.exit(f"nenhum .svg em {DIR}")
    total = 0.0
    for svg in svgs:
        iso, kb, modo, razao, ax = exportar(svg)
        marca = "  <- ANCORA ESPECIAL" if ax != 0.5 else ""
        eixo = "largura" if razao > RAZAO_ALVO else "altura" if razao < RAZAO_ALVO else "nenhum"
        print(f"  {iso}.webp  {kb:6.1f} KB  {modo:9s}  nativa {razao:.4f}  corta {eixo}{marca}")
        total += kb
    print(f"\n{len(svgs)} bandeiras, {total:.0f} KB no total, {LARGURA}x{ALTURA} (3:2).")


if __name__ == "__main__":
    main()
