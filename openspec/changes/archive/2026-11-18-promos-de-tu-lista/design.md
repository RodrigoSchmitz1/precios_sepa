# Design

## Context

- Las promos del mapa ya están en memoria (`api/mapa_promos.py`, `IndiceMapa`). Son columnas paralelas ordenadas de mayor a menor descuento, con las sucursales de cada promo. `mart_mapa_promos` trae `id_producto`, pero el índice no lo guarda.
- Tu lista cotiza en `POST /mismo-producto/lista` con el índice de Mismo producto. Con zona, el bloque `zona.mas_barato` ya trae, por producto, la cadena más barata de la zona y su precio.
- El detalle calcula los extremos de la zona en el navegador (`titularDelProducto`, `extremos`).
- La zona del usuario es un lugar de `/api/zonas`: nombre, provincia, centro (mediana de sus sucursales) y cadenas.
- Promos ya muestra el nivel de evidencia con `utils/evidencia.ts`.

## Goals / Non-Goals

**Goals:**
- Que cada regla (qué es "cerca", qué es "vigente", qué promo conviene) viva en un solo lugar y tenga tests.
- Que la lista y el detalle sigan funcionando igual si el pedido de promos falla o tarda.

**Non-Goals:**
- No se toca dbt ni los marts. `id_producto` ya está en `mart_mapa_promos`.
- No se cambia la página Promos ni el mapa.

## Decisions

### Un endpoint aparte y no un campo más en la cotización de la lista
`GET /api/promos/productos?ids=…&latitud=…&longitud=…` devuelve, por producto, sus promos en sucursales cercanas. Lo usan Tu lista y el detalle.

- **Por qué:** cada índice queda con su dato. La cotización no depende del índice del mapa, y si las promos tardan o fallan la lista se ve igual.
- **Alternativa descartada:** sumar `latitud` y `longitud` al `POST` de la lista. Ataría los dos índices en un pedido, y el detalle, que no usa ese POST, necesitaría otro camino.
- **Límites:** hasta 100 productos por pedido, más que cualquier lista real; FastAPI devuelve 422 si se pasa. Sin `@cachear`, por la misma razón que `/promos/mapa`: cada combinación distinta quedaría guardada para siempre.

### "Cerca" es a 3 km del centro de la zona, en la API
La constante es `RADIO_PROMOS_KM = 3` y vive en `mapa_promos.py`.

- **Medido:** 3 km dan 12 sucursales con promos en Lomas de Zamora, 194 en Palermo y 2 en Rafaela.
- **Alternativa descartada: las sucursales del lugar** (las de su localidad o barrio). En un barrio chico serían una o dos, y una sucursal a cuatro cuadras pero en el barrio vecino quedaría afuera.
- **Alternativa descartada: el recuadro del mapa a zoom 14.** Depende de la pantalla.
- **Qué devuelve por promo:** la sucursal más cercana al centro, para la dirección, y cuántas otras sucursales cercanas la tienen.

### "Vigente" se lee de la leyenda, en la API
- Cada promo devuelve `vigente_hasta` (`AAAA-MM-DD` o `null`). Sale de "hasta dd/mm/aaaa", "al dd/mm/aaaa" o "hasta el aaaa-mm-dd" en la leyenda. Lo cumple el 98% de las promos del 17-11; el resto son de Día "hasta agotar stock" y van con `null`.
- **Se descarta una promo que venció.** Es la que tiene `vigente_hasta` anterior a la fecha de hoy en la Argentina. Los datos son del día anterior, así que una promo "hasta 17/11" leída el 18/11 ya no sirve.
- El frontend formatea la fecha sin `new Date("AAAA-MM-DD")`.

### Qué promo conviene se decide en el navegador, en una sola utilidad
`utils/promosCerca.ts` tiene `promosQueConvienen(promos, precioZona)` y la usan Tu lista y el detalle.

- **La regla:** se muestra una promo si su precio es menor al precio más bajo de la zona para ese producto.
- **De dónde sale ese precio:** en Tu lista, de `zona.mas_barato`; en el detalle, de los extremos de la zona que ya calcula el titular.
- **Por qué en el navegador:** el precio de la zona ya está ahí, y mandarlo a la API para filtrar sería duplicar la cotización.
- **Producto que no vende ninguna cadena de la zona:** no hay precio con qué comparar, así que cualquier promo cercana sirve.
- **Orden:** la API devuelve las promos de cada producto de la más barata a la más cara, hasta 3. Tu lista muestra la primera y el detalle, las tres.

### El total no incluye las promos
Los totales por cadena comparan el precio de cada cadena en todo el país, que es lo que la spec mismo-producto promete. Las promos son por sucursal y las publican sobre todo Cooperativa Obrera, Carrefour y Día: Coto informó 37 promos de productos comparables y Disco y Jumbo ninguna. Mezclarlas en el total haría ganar a quien más informa, no a quien cobra menos.

### Memoria
- El índice suma `id_producto` como columna, con el mismo diccionario de strings únicos del resto, y `por_producto`, un dict de `id_producto` a un `array("I")` de posiciones (unas 14 mil claves).
- Se mide con `tracemalloc` sobre las filas reales antes de desplegar. Hoy hay 1 GiB, y el índice de Mismo producto ocupa unos 113 MiB.

## Risks / Trade-offs

- [El dato de promos es de ayer y la promo pudo terminar hoy] → Se descartan las vencidas, se muestra "hasta el dd/mm" y se aclara, como en Promos, que lo informa la cadena.
- [Una promo "sin verificar" puede ser un error de la fuente] → Lleva el mismo sello que en Promos. `promos_validas` ya les pone techo de 50%.
- [Zonas con cadenas que no informan promos (Coto, Cencosud)] → El bloque simplemente no aparece. No se dice "0 promos", que sonaría a que no hay ofertas.
- [Un pedido más por cada vista de la lista] → Es en memoria y responde en milisegundos. Si falla, la lista se ve igual, sin promos.

## Migration Plan

Deploy normal con `--memory 1Gi`. Para volver atrás alcanza con redesplegar la revisión anterior: no hay datos nuevos ni cambios en dbt.
