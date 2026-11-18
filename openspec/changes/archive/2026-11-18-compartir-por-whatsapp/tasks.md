# Tasks

## 1. Íconos e imagen

- [x] 1.1 `frontend/public/favicon.svg` con el chango sobre el degradé de la marca, en lugar del logo de Vite
- [x] 1.2 `frontend/scripts/generar_iconos.py` (Playwright): `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` y `og-changuito.png` (1200x630), commiteados en `public/`
- [x] 1.3 `frontend/public/manifest.webmanifest` y los `<link>`/`<meta>` en `index.html` (apple-touch-icon, manifest, theme-color)

## 2. Metadatos en el HTML

- [x] 2.1 `index.html`: metadatos generales (`og:*`, `twitter:card`) con el marcador `__ORIGEN__`
- [x] 2.2 `api/compartir.py`
  - textos por sección
  - tarjeta del producto (nombre legible, pesos es-AR, rango y cadenas)
  - armado del `<head>` con `html.escape`
- [x] 2.3 `servir_frontend`
  - lee `index.html` una vez
  - completa el `<head>` según la ruta y `p`
  - toma el origen del pedido, con https detrás del proxy
  - sin el índice cargado, tarjeta general y carga en segundo plano
- [x] 2.4 Tests
  - portada
  - sección
  - producto existente y producto inexistente
  - caracteres de HTML escapados
  - otro host
  - índice no cargado
  - los marcadores del `index.html` real siguen ahí

## 3. Botón Compartir

- [x] 3.1 `utils/compartir.ts` con tests: share nativo, cancelación ignorada, portapapeles, falla de los dos
- [x] 3.2 Botón "Compartir" en el detalle de Mismo producto, con el titular de la página y la URL con zona; "Link copiado" en el respaldo
- [x] 3.3 Test de componente del botón. Después, lint, `tsc -b`, `vitest` y `build`

## 4. Verificación y docs

- [x] 4.1 Con la API local y el build: `curl` con user agent de WhatsApp a la portada, una sección, un producto y un código inexistente
- [x] 4.2 E2E en WebKit a 414x896
  - el botón con `navigator.share` simulado
  - el respaldo de portapapeles
  - sin desborde
- [x] 4.3 `docs/DECISIONES.md`: sección "Compartir por WhatsApp". README si cambia algún conteo
- [x] 4.4 `openspec validate compartir-por-whatsapp --strict`
