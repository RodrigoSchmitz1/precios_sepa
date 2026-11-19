# Design

## Context

- **Buscador de productos.** `mismo_producto.buscar` tokeniza la consulta con `PALABRA.findall(fonetizar(normalizar(...)))` y exige que cada palabra sea el comienzo de una palabra del producto. Los tamaños están indexados como "1l", "1lt", "500g" y "1kg" (`_tamanos_buscables`). "litro" no es el comienzo de ninguna palabra, y por eso "1 litro" da 0 resultados.
- **Buscador de zonas.** `buscarZonas` (`utils/zona.ts`) usa `normalizar(nombre).includes(texto)` sobre el texto entero.
- **Lugares.** `mapa_promos.lugares` agrupa las sucursales por nombre normalizado y provincia. Fusiona nombres idénticos a menos de 20 km. Un link `?zona=AR-B:Nombre` se resuelve contra `/zonas` por nombre y provincia.
- **El ejemplo de la portada.** `TarjetaEjemplo`, en `Presentacion.tsx`, toma la Coca Cola de 2,25 L y muestra la más barata, la del medio y la más cara entre todas las cadenas, sin mirar la zona.
- **Paso 4.** `DondeComprarla` calcula `mejor` como el menor `total` y `unaSola` como la opción con `max_sucursales === 1`, sin mirar `items_cubiertos`. La API (`optimizar_compra`) elige cada combinación por la clave (cobertura y costo). Los radios son `[1, 2, 5]`, y arranca en 2.

## Goals / Non-Goals

**Goals:** cerrar los ocho errores con el cambio más chico que los resuelva de raíz, y con tests que los fijen.

**Non-Goals:** sumar promos al total, cambiar la portada o la barra inferior, o tocar la IA de Tu canasta.

## Decisions

### 1. Las unidades se normalizan en la consulta, no en el índice
Antes de tokenizar, `buscar` reemplaza las unidades escritas por su abreviatura, pegada al número si lo hay:
- **Patrón con número:** `(\d+(?:[.,]\d+)?)\s*(litros?|lts?|kilos?|kilogramos?|gramos?|grs?)\b`, que da "1l", "1kg" o "500g".
- **La palabra suelta** ("leche litro") pasa a la abreviatura, aunque casi nunca aporta.
- **Por qué en la consulta:** el índice no cambia, así que no se toca la memoria, y la regla queda en un solo lugar.

### 2. Zonas: palabras y alias
- **`buscarZonas`** parte el texto en palabras normalizadas, saca las vacías y exige que cada una sea el comienzo de alguna palabra del nombre o de un alias.
- **El orden:** primero las zonas donde la primera palabra tipeada empieza el nombre, y después por sucursales, como hoy.
- **`lugares`:** después de la fusión actual, junta los lugares de la misma provincia con centros a menos de `DISTANCIA_ALIAS_KM = 2` cuyo conjunto de palabras (sin vacías y sin signos) está contenido en el del otro.
  - Se procesan de mayor a menor cantidad de sucursales, y el más grande se queda con el nombre.
  - Los demás nombres van a `alias`. Se emite solo con `con_cadenas`, que es la lista de zonas.
  - El centro se recalcula como la mediana de todas las sucursales.
- **Medido el 19-11:** 30 pares a menos de 2 km.
- **El frontend resuelve un link** por nombre o por alias en la misma provincia (`zonaDeParametro`). Un link viejo sigue andando.

### 3. El ejemplo de la portada con zona
`utils/ejemploPortada.ts` elige las filas:
- **Con zona:** los precios creíbles de las cadenas que están en `cadenasVisibles(zona)`, si son al menos dos. Si no, los del país, y el rótulo suma " · en todo el país".
- **Las filas:** la más barata, la del medio y la más cara, como hoy.
- **El porcentaje** pasa a ser la diferencia entre esas filas, no el `diferencia_pct` nacional, cuando es de la zona.
- **Tests** con Palermo y Rafaela.

### 4. Sucursales "en el país"
En `FilasDePrecios`, la línea de sucursales suma " en el país" cuando la lista es la del grupo de la zona. Para eso pasa un prop `deZona`. La lista nacional queda igual: ahí ya se lee como del país.

### 5. "Ninguna cadena cerca informa precio de"
Cambia el texto en `TuLista.tsx`, y también "Ninguna cadena de tu zona vende tus productos", que pasa a "Ninguna cadena cerca informa precios de tus productos". Se revisa el resto del frontend buscando "no se consigue", "no lo vende" y similares.

### 6. Paso 4: cobertura primero
- **`mejor`:** la opción con mayor `items_cubiertos` y, a igual cobertura, el menor `total`.
- **"Contra una sola":** solo si `unaSola.items_cubiertos === mejor.items_cubiertos`. Si no, la cifra se reemplaza por "cubre N de M" en la opción de una.
- **El "ahorrás"** de cada opción se calcula solo contra una referencia con la misma cobertura.
- **Cada `Opcion` con `items_cubiertos < total`** dice "Sin: X, Y" con las categorías que no cubre.
- **La lógica vive en `utils/opcionesCompra.ts`,** con tests.

### 7. Radio del paso 4
`RADIOS_KM = [1, 3, 5]` y arranca en 3, con un comentario que apunta a `RADIO_CERCA_KM` de la API. Es un número de la regla de "cerca"; queda en un solo lugar del frontend (`utils/zona.ts`, `RADIO_CERCA_KM = 3`).

## Risks / Trade-offs

- **La fusión con alias junta un barrio con su ciudad** (Nueva Córdoba con Córdoba). Aceptado: con las cadenas a 3 km la zona dice casi lo mismo, y el barrio se sigue encontrando por su nombre. Se listan los 30 pares en DECISIONES.
- **Cambian números visibles en producción:** el ejemplo de la portada con zona y el paso 4 con radio de 3 km (más sucursales).
- **El rótulo "en el país"** alarga la segunda línea de cada fila de la zona. Se mide a 375 px.
