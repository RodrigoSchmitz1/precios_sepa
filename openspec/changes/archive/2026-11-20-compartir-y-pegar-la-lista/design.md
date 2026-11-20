# Design

## Context

- **Tu lista** vive en `localStorage` (`changuito.lista.v1`, `utils/lista.ts`).
  Tiene un tope de 50 productos y 99 unidades, y la reparte `ProveedorLista`.
  La cotiza `POST /api/mismo-producto/lista`, que devuelve los productos con su
  nombre.
- **Compartir** (`utils/compartir.ts`, `BotonCompartir`) existe para el detalle
  de un producto: usa el menú nativo y, si no hay, copia solo el link.
  `api/compartir.py` pone la tarjeta de cada ruta en el HTML inicial.
- **El buscador** (`mismo_producto.buscar`) normaliza unidades y plurales.
- **Los básicos** son 40 búsquedas fijas (`BASICOS`) que resuelve `basicos()`.
- **La medición del 2026-11-19** pasó 30 renglones típicos de una lista por el
  buscador actual:
  - 28 traen un producto razonable;
  - "2 leches" busca el "2" como 2% de grasa;
  - "1 docena de huevos" no trae nada, por el "1" y el "de";
  - "yerba" trae primero "Yerba Amanda P4 N Trad", cuando el básico es
    Playadito 1 kg.

## Goals / Non-Goals

**Goals:**
- Mandar la lista por WhatsApp en dos toques, con un texto que se entienda sin
  abrir el link.
- Que quien recibe el link vea la lista con los precios de su zona y no pierda
  la suya.
- Que pegar una lista de un chat dé el producto correcto en la mayoría de los
  renglones, y que el resto se arregle con un toque.

**Non-Goals:**
- Listas compartidas que se editen entre varios (necesitaría guardar en el
  servidor).
- IA para interpretar el texto. Rodrigo eligió el buscador del sitio.
- Reconocer fotos de tickets o listas escritas a mano.

## Decisions

1. **El link lleva la lista entera y no se guarda nada.** El formato es
   `/lista?l=<id>x<cant>-<id>x<cant>…`: hasta 50 códigos de unos 13 dígitos,
   alrededor de 800 caracteres. Se usan `x` y `-` porque WhatsApp y los
   navegadores no los escapan, y la coma sí (`%2C`). Una cantidad ausente es 1.
   Al leer:
   - se descarta lo que no sea un código de dígitos;
   - las cantidades se acotan a 1..99;
   - se cortan los productos a 50.

   Se descartó guardar la lista en el servidor con un id corto: necesita
   almacenamiento y rompe el costo cero.
2. **La lista recibida no se guarda sola.** `ListaPage` lee `l` y lo saca de la
   URL con `replaceState`, así recargar no repite la pregunta. Muestra un
   recuadro "Te compartieron una lista de N productos", con la cotización de
   esos productos en la zona propia (el mismo `cotizarLista`).
   - Sin lista propia, se guarda directo.
   - Con lista propia, aparecen "Sumar a mi lista" y "Reemplazar mi lista".

   Sumar está en `utils/lista.ts` (`sumarListas`): en un producto repetido
   queda la cantidad mayor, y se respeta el tope de 50. El nombre de cada
   producto sale de la cotización.
3. **El texto que se comparte se arma en el navegador** (`textoDeLista` en
   `utils/compartir.ts`), con la vista que ya muestra Tu lista
   (`vistaDeLista`):

   ```
   Mi lista del súper · 3 productos
   En Lomas de Zamora, en Día sale $ 24.300
   • 2 × Yerba Playadito suave 1 kg
   • 1 × Aceite Natura girasol 1,5 L
   Armala y comparala en tu zona:
   ```

   Va seguido del link.
   - Sin una cadena con la lista completa, la línea de precio se omite.
   - `compartir()` suma un modo que copia texto y link juntos, porque en una
     lista el texto es el contenido.
4. **El pegado se resuelve en la API**: `POST /api/mismo-producto/interpretar`
   con `{texto}`, de hasta 2.000 caracteres y 50 renglones. Se hace ahí porque
   ahí viven el buscador y los básicos, y así es un solo pedido en vez de
   cincuenta. Para cada renglón, en `mismo_producto.interpretar_renglon`:
   - **viñetas fuera** (`-`, `*`, `•`, `1.`, `1)`, emojis);
   - **la cantidad**: un número al principio ("2 leches", "2x leche") o
     "x3"/"(3)" al final. "Docena" queda como palabra a buscar;
   - **las palabras de relleno fuera** ("de", "del", "la", "el", "un", "una",
     "para");
   - **el básico primero**: si las palabras del renglón contienen el nombre
     de un básico ("yerba", "aceite") y nada que lo contradiga, el primer
     candidato es el producto de ese básico. Si no, va el buscador;
   - **hasta 3 candidatos** con el resumen del producto. Un renglón vacío no
     cuenta, y uno sin resultados devuelve `candidatos: []`.

   Un texto de una sola línea con comas se parte por comas. El endpoint no
   consulta BigQuery: usa el índice en memoria, como el buscador.
5. **La pantalla del pegado.** "Pegar una lista" abre un `textarea` de 16 px y
   "Buscar productos". Debajo, un renglón por línea:
   - el texto original en gris;
   - el producto elegido con un selector de las otras opciones;
   - la cantidad;
   - un botón para sacarlo.

   "Sumar a mi lista" usa `agregar` para cada uno, y si el producto ya estaba,
   deja la cantidad mayor.

## Risks / Trade-offs

- **Un renglón genérico puede traer otro producto** (otra marca u otro tamaño).
  Por eso siempre se muestra lo elegido y se puede cambiar: no hay suma ciega.
- **Un link de una lista vieja** puede tener productos que ya no están. Se
  omiten y se dice cuántos.
- **El link es largo**, unos 800 caracteres con 50 productos. WhatsApp lo
  acepta y lo muestra con su tarjeta.
- **Abuso del endpoint:** el texto está acotado y la búsqueda es en memoria,
  con el mismo costo que 50 búsquedas del buscador.
