"""Genera los iconos PNG y la imagen de las tarjetas a partir del chango de la marca.

    python -I scripts/generar_iconos.py            (con playwright instalado)

Se corre a mano cuando cambia la marca; los PNG quedan commiteados en public/.
No va en el build: Playwright no es dependencia del frontend y los iconos casi
nunca cambian (openspec compartir-por-whatsapp).
"""
import os
from playwright.sync_api import sync_playwright

PUBLICO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
CHANGO = open(os.path.join(PUBLICO, "favicon.svg"), encoding="utf-8").read()

# El icono: el svg ocupa todo. iOS redondea las esquinas solo, pero un
# apple-touch-icon con transparencia queda con fondo negro: el degrade va de
# borde a borde (sin rx) en los PNG.
ICONO = """<html><body style="margin:0">{svg}</body></html>"""

TARJETA = """<html><head>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  body {{ margin:0; width:1200px; height:630px; font-family: Manrope, sans-serif;
         background: linear-gradient(120deg, #3b1fd6 0%, #5b3df5 50%, #1294c4 100%);
         color:white; display:flex; flex-direction:column; justify-content:center; padding:0 96px;
         box-sizing:border-box; }}
  .marca {{ display:flex; align-items:center; gap:28px; }}
  .marca svg {{ width:120px; height:120px; filter: drop-shadow(0 8px 24px rgb(0 0 0 / .25)); }}
  h1 {{ font-size:96px; font-weight:800; margin:0; letter-spacing:-2px; }}
  p {{ font-size:44px; font-weight:500; line-height:1.25; margin:44px 0 0; max-width:960px; opacity:.95; }}
  small {{ display:block; font-size:28px; margin-top:36px; opacity:.8; }}
</style></head><body>
  <div class="marca">{svg}<h1>Changuito</h1></div>
  <p>Dónde te conviene comprar: el mismo producto en cada súper de tu zona.</p>
  <small>Precios oficiales de SEPA, todos los días</small>
</body></html>"""


def main():
    with sync_playwright() as pw:
        b = pw.webkit.launch()
        for nombre, lado in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
            pg = b.new_page(viewport={"width": lado, "height": lado})
            svg = CHANGO.replace('rx="15" ', "").replace('width="64" height="64" viewBox', f'width="{lado}" height="{lado}" viewBox', 1)
            pg.set_content(ICONO.format(svg=svg))
            pg.screenshot(path=os.path.join(PUBLICO, nombre), omit_background=False)
            pg.close()
        pg = b.new_page(viewport={"width": 1200, "height": 630})
        pg.set_content(TARJETA.format(svg=CHANGO), wait_until="networkidle")
        pg.screenshot(path=os.path.join(PUBLICO, "og-changuito.png"))
        b.close()
    for nombre in ("apple-touch-icon.png", "icon-192.png", "icon-512.png", "og-changuito.png"):
        print(nombre, os.path.getsize(os.path.join(PUBLICO, nombre)), "bytes")


if __name__ == "__main__":
    main()
