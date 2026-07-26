#!/usr/bin/env python3
"""
scripts/exportar-bandeiras.py

Exporta as 20 bandeiras de imagens/bandeiras/<ISO2>.svg para <ISO2>.webp 600x600.

POR QUE RASTER E NÃO SVG (decisão da frente de design, 26/07/2026)
  O app serve WEBP, não SVG, e isso resolve dois problemas de uma vez:
  1. PESO / PARSING. Bandeira com brasão é centenas de nós de path: MX tinha 156 KB e PE 114 KB
     de SVG, que um celular modesto precisa parsear a cada render. Em webp 600px viram 16,6 KB e
     16,0 KB de bitmap. O acervo inteiro caiu de 349 KB para 138 KB.
     Exceção honesta: PT ficou MAIOR como webp (23,4 KB contra 11,3 KB) — a esfera armilar é
     detalhe fino que raster não comprime bem. Não muda a decisão; fica registrado.
  2. PROPORÇÃO. Cada bandeira tem sua proporção oficial e elas NÃO são uniformes: AT e TH são 3:2,
     Brasil 10:7, México 7:4, EUA 19:10. Num slot de tamanho fixo isso daria larguras diferentes
     ou letterbox, e exigiria caso especial no CSS. Cortando 1:1 no export, a uniformidade é
     garantida por construção e o CSS trata bandeira igual a imagem de categoria — mesmo contrato.

  Os SVG originais continuam no repo como INSUMO (ver .gitignore): são a única fonte para
  reexportar noutro tamanho, e a fonte externa pode sumir.

A EXCEÇÃO DOS EUA — NÃO REMOVER
  Crop 1:1 centralizado funciona para 19 das 20. Para os EUA, não: o cantão (as 50 estrelas) fica
  no canto SUPERIOR ESQUERDO, e um corte central o deixaria de fora — a bandeira viraria listras
  vermelhas e brancas, irreconhecível. Por isso ANCORA_X['US'] = 0.0, que ancora o corte na borda
  esquerda e preserva o cantão inteiro. Qualquer bandeira nova com emblema fora do centro precisa
  da mesma análise.

LOSSY OU LOSSLESS
  Decidido POR ARQUIVO, não por regra: gera os dois e fica o menor. Bandeira de faixa chapada
  (AT, DE, FR, IT, TH, HU) comprime melhor lossless — 0,2 KB. Bandeira com brasão comprime melhor
  lossy. Fixar um dos dois pro acervo todo desperdiçaria de um lado ou do outro.

DEPENDÊNCIAS (as únicas do projeto fora de Node — de propósito, é build step, não runtime)
  pip install cairosvg pillow

COMO RODAR (da raiz do repo)
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
LADO = 600

# 0.0 = ancora o corte na borda esquerda | 0.5 = centraliza (default)
ANCORA_X = {"US": 0.0}   # ver "A EXCEÇÃO DOS EUA" no topo


def exportar(svg):
    iso = os.path.basename(svg)[:-4]
    # renderiza a 2x o lado final: dá margem de reamostragem e evita serrilhado na diagonal
    png = cairosvg.svg2png(url=svg, output_height=LADO * 2)
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    im = Image.alpha_composite(Image.new("RGBA", im.size, (255, 255, 255, 255)), im).convert("RGB")

    w, h = im.size
    if w < h:                                    # bandeira mais alta que larga: escala pela largura
        im = im.resize((LADO * 2, int(h * LADO * 2 / w)), Image.LANCZOS)
        w, h = im.size

    lado = min(w, h)
    x0 = int((w - lado) * ANCORA_X.get(iso, 0.5))
    y0 = (h - lado) // 2
    quad = im.crop((x0, y0, x0 + lado, y0 + lado)).resize((LADO, LADO), Image.LANCZOS)

    a, b = io.BytesIO(), io.BytesIO()
    quad.save(a, "WEBP", quality=82, method=6)
    quad.save(b, "WEBP", lossless=True, method=6)
    sem_perda = b.tell() <= a.tell()

    destino = os.path.join(DIR, iso + ".webp")
    quad.save(destino, "WEBP", **({"lossless": True, "method": 6} if sem_perda else {"quality": 82, "method": 6}))
    return iso, os.path.getsize(destino) / 1024, "lossless" if sem_perda else "lossy", ANCORA_X.get(iso, 0.5)


def main():
    svgs = sorted(glob.glob(os.path.join(DIR, "*.svg")))
    if not svgs:
        sys.exit(f"nenhum .svg em {DIR}")
    total = 0.0
    for svg in svgs:
        iso, kb, modo, ax = exportar(svg)
        marca = "  <- ANCORA ESPECIAL" if ax != 0.5 else ""
        print(f"  {iso}.webp  {kb:6.1f} KB  {modo}{marca}")
        total += kb
    print(f"\n{len(svgs)} bandeiras, {total:.0f} KB no total.")


if __name__ == "__main__":
    main()
