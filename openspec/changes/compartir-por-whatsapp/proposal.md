# Proposal

## Why

La difusión de un sitio de precios en la Argentina pasa por WhatsApp: el grupo del barrio, la familia, el "mirá dónde está más barata la yerba". Hoy un link de Changuito llega sin tarjeta: WhatsApp no ejecuta JavaScript y el `index.html` no trae `og:title`, `og:description` ni `og:image`. Además:
- **La URL desconfía sola:** `precios-sepa-api-803135877045.us-central1.run.app` parece un virus, y sin tarjeta no hay nada que la compense.
- **No hay cómo compartir:** ninguna página tiene un botón para hacerlo. Solo Tu canasta copia un link.
- **El sitio no se puede instalar bien en el celular:** no hay `apple-touch-icon` ni manifest. Al agregarlo a la pantalla de inicio queda una captura borrosa.
- **El favicon es el de Vite por defecto,** no el chango de la marca. Lo encontré al revisar el `<head>`.

Fue el candidato 7 del explore externo del 17-11.

## What Changes

- **Tarjeta para todo el sitio.** El HTML que sirve la API lleva `og:title`, `og:description`, `og:image` (una imagen de 1200x630 con la marca), `og:url` y `twitter:card`, con URLs absolutas armadas con el host del pedido. Así siguen andando el día que haya un dominio propio.
- **Tarjeta por producto.** Un link a `/mismo-producto?p=<código>` sale con el nombre del producto y el rango de precio del país. Por ejemplo: "Yerba Playadito 500 g · de $ 2.490 a $ 2.850 en 13 cadenas", y debajo "Mirá dónde conviene en tu zona · Changuito".
  - No nombra a la cadena más barata. Esa respuesta depende de la zona, y su regla vive en la página. Si la repitiera, el servidor sería un segundo lugar donde decidirla, y un link compartido desde Palermo podría nombrar a una cadena que en Palermo no está.
- **Tarjeta por sección.** Las secciones principales (Tu lista, Tu canasta, Más barato, Inflación y Mismo producto) tienen título y descripción propios. La portada, que es Promos, lleva la general.
- **Botón "Compartir"** en el detalle del producto.
  - En el celular abre el menú nativo para compartir (`navigator.share`). Donde no existe, copia el link y lo dice.
  - El texto es el titular que ya muestra la página, con la zona si la hay. El link lleva el producto y la zona.
- **Íconos de app.** El favicon pasa a ser el chango de la marca. Se suman `apple-touch-icon` (180 px), un manifest con íconos de 192 y 512 px, nombre "Changuito" y `theme-color`.

Fuera de alcance:
- **Dominio propio:** cuesta plata. El costo cero es de BigQuery, pero gastar es decisión de Rodrigo. Queda como pregunta abierta.
- **Una imagen distinta por producto:** necesita generar imágenes en el servidor.
- **Compartir Tu lista entera:** necesita decidir qué pasa al abrirla, si reemplaza o suma a la lista de quien la recibe.

## Capabilities

### New Capabilities
- `compartir`: cómo se ve un link del sitio al compartirlo (tarjeta general, por sección y por producto), el botón para compartir y los íconos para instalar el sitio en el celular.

### Modified Capabilities
<!-- Ninguna: el detalle suma un botón, pero sus requisitos actuales no cambian. -->

## Impact

- **API (`api/main.py`):** `servir_frontend` arma el `<head>` de cada página con sus metadatos sobre el `index.html` compilado, que se lee una vez y queda en memoria.
  - El producto sale del índice de Mismo producto si ya está cargado. Si no, va la tarjeta general: un crawler no espera 4 segundos.
  - Todo texto que viene de los datos se escapa.
  - Tests nuevos.
- **Frontend:**
  - `index.html` con los metadatos generales
  - en `public/`: `og-changuito.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest` y un `favicon.svg` nuevo
  - un util para compartir y el botón en `MismoProductoPage.tsx`, con tests
- **BigQuery:** nada. No hay consultas ni tablas nuevas.
- **Docs:** sección en `docs/DECISIONES.md`.
