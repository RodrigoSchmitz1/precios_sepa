# Design

## Context

- **Cómo se sirve el frontend:** lo sirve la misma app FastAPI. `servir_frontend` (`api/main.py`) devuelve los archivos de `static/` y, para cualquier otra ruta, `index.html` con `Cache-Control: no-cache`.
- **Qué recibe WhatsApp:** su crawler y los de Telegram, Facebook y X leen solo ese HTML inicial. Hoy reciben el título general y la descripción, sin `og:*`.
- **Mismo producto en memoria:** el índice de Mismo producto vive en memoria con `@cachear` (`_cargar_indice_mismo_producto`). Cargarlo en una instancia fría lleva unos 4 segundos, y el crawler de WhatsApp corta antes.
- **El titular con zona** ("En Palermo conviene en Día") lo arma el frontend (`utils/titularProducto.ts`). Las cadenas de cada zona salen de `/zonas` y se pasan por `cadenasVisibles`.
- **Íconos:** `frontend/public/` tiene `favicon.svg`, que es el logo por defecto de Vite, e `icons.svg`. El chango de la marca está dibujado en línea en `Layout.tsx`, en blanco sobre el degradé `fondo-marca` (`#3b1fd6 → #5b3df5 → #1294c4`).

## Goals / Non-Goals

**Goals:**
- Que cualquier link del sitio llegue con tarjeta a WhatsApp, sin costo y sin consultas.
- Que la tarjeta de un producto sea cierta para cualquiera que la abra, sea de donde sea.
- Compartir un producto en dos toques desde el celular.
- Ícono propio en la pestaña y en la pantalla de inicio.

**Non-Goals:**
- Dominio propio, imagen por producto y compartir Tu lista.
- Que el sitio funcione sin conexión (service worker).

## Decisions

### 1. El servidor completa el `<head>` sobre el `index.html` compilado
`index.html` lleva los metadatos generales con dos marcadores para las URLs absolutas: `__ORIGEN__` en `og:image` y en `og:url`, porque Vite no conoce el host.

- **Al servir,** `servir_frontend` lee el archivo una vez, lo guarda en memoria y reemplaza estos datos:
  - la descripción
  - `og:title`, `og:description` y `og:url`
  - `__ORIGEN__`
- **El origen** sale de `request.base_url`. Detrás del proxy de Cloud Run el esquema llega como http, así que se fuerza https salvo en localhost.
- **El `<title>` de la pestaña no se toca** (decidido al implementar): la app no lo actualiza al navegar, y entrar por un link de producto dejaría su nombre en la pestaña al pasar a otra sección.
- **Los textos van por `html.escape`.** El código del producto llega por la URL, y la descripción viene de SEPA.
- **Alternativas descartadas:**
  - Prerenderizar páginas no sirve para productos: son 47 mil.
  - Detectar crawlers por user agent devolvería un HTML distinto a cada cliente y es frágil. El HTML enriquecido es el mismo para todos, y el navegador no lo nota.

### 2. La tarjeta del producto dice el rango del país, no la cadena más barata
- **Título:** "{nombre legible} · de $ X a $ Y en N cadenas".
- **Descripción:** "Mirá dónde conviene en tu zona. Precios oficiales de SEPA del {fecha}."
- **Los datos** (`precio_mas_bajo`, `precio_mas_alto`, `cadenas`) son los mismos agregados del mart que muestra la página. No se recalcula nada.
- **Por qué no la cadena más barata:** la cadena que conviene depende de la zona. El servidor no tiene esa regla, y duplicarla rompería "una regla en un solo lugar". Además, un link de Palermo leído en Rosario nombraría una cadena equivocada.
- **El nombre:** se usa la descripción con el mismo saneado que el frontend (`nombreLegible`): mayúsculas a título y tamaño al final. Se porta como una función chica en Python con tests que comparan contra los mismos ejemplos.
  - Si portarla resulta frágil, va la descripción tal cual.
- **El precio:** se formatea en es-AR sin decimales ("$ 2.490") con una función propia. Python no tiene Intl.

### 3. Sin esperar al índice
Si el índice de Mismo producto no está cargado, la tarjeta del producto cae a la general y se dispara la carga en segundo plano. Así la siguiente vez ya está.

- **Implementación:** se mira si `_cache` tiene la clave de `_cargar_indice_mismo_producto` sin vencer, con una función `_indice_si_esta_cargado()`.
- **Por qué no esperar:** si se esperara, WhatsApp cortaría a los pocos segundos y no habría tarjeta.

### 4. Secciones con un diccionario
Un dict por ruta (`/lista`, `/canasta-personalizada`, `/quien-gana`, `/inflacion` y `/mismo-producto` sin `p`) con título y descripción. Cualquier otra ruta, incluida la portada, lleva la general.

### 5. Botón Compartir
`utils/compartir.ts` expone `compartir({titulo, texto, url})`:
- **Con `navigator.share`:** lo usa. Un `AbortError` es el usuario cancelando y se ignora.
- **Sin `navigator.share`:** usa `navigator.clipboard.writeText`. Si también falla, muestra el link para copiarlo a mano, como ya hace Tu canasta.

En el detalle, el texto es el nombre del producto más el titular que la página ya calculó, con "en tu zona" cambiado por la zona de quien comparte (`textoParaCompartir`). Para quien lo recibe, "tu zona" no es la suya. La URL es `location.href`, que ya lleva `p` y `zona`. El botón va junto a "+ Lista", con el mismo tamaño mínimo de toque.

### 6. Íconos generados una vez y versionados
- **El SVG fuente,** con el chango en blanco sobre el degradé, queda en `frontend/public/favicon.svg`, que reemplaza al de Vite.
- **Los PNG** (180, 192, 512 y la imagen `og-changuito.png` de 1200x630 con el chango, "Changuito" y la bajada) se generan con un script de Playwright: `frontend/scripts/generar_iconos.py`, que renderiza un HTML y saca la captura. Quedan commiteados en `public/`.
- **No se generan en el build:** Playwright no es dependencia del frontend, y los íconos casi nunca cambian.
- **`manifest.webmanifest`:**
  - `name` y `short_name`: "Changuito"
  - `display`: `standalone`
  - `theme_color`: `#5b3df5`
  - `background_color`: el del papel del sitio
  - los dos íconos

## Risks / Trade-offs

- **Caché de WhatsApp:** guarda la tarjeta de un link por un tiempo. Un precio de ayer puede verse en una tarjeta de hoy.
  - Aceptado: la descripción dice la fecha de los datos.
- **Instancia fría:** el primer link de un producto compartido justo después de un deploy sale con la tarjeta general.
- **Si cambia el `index.html` de Vite** (los marcadores o el orden de los metas), el reemplazo deja de encontrar lo que busca.
  - Mitigación: tests sobre el `index.html` real del repo, que fallan si un marcador desaparece.
- **Peso:** cinco PNG suman unos 150 KB a la imagen del contenedor. Ninguno se carga en la página salvo el favicon.
