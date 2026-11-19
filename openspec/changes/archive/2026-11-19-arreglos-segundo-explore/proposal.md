# Proposal

## Why

El segundo explore externo, del 18-11, recorrió el sitio en producción como usuario de iPhone. Encontró ocho errores concretos, que verifiqué el 19-11 contra la API y el código. Se confirmaron todos.

1. **"leche la serenisima 1 litro" da 0 resultados.** Con "1l" o "1 l" trae cinco. "litro" no se reconoce como unidad.
2. **"lomas zamora" no encuentra la zona.** El buscador de zonas busca el texto entero dentro del nombre, así que sin el "de" no hay coincidencia.
3. **Laferrere aparece tres veces** ("Laferrere", "Gregorio de Laferrere" y "Gregorio Laferrere"), a menos de 1,5 km entre sí. La fusión de lugares solo junta nombres idénticos. Con la regla de contención de palabras a menos de 2 km hay 30 pares así. Casi todos son duplicados reales (Villa Lugano y Lugano, José C. Paz con y sin punto, Paternal y La Paternal); unos pocos son un barrio dentro de la ciudad (Nueva Córdoba y Córdoba).
4. **La tarjeta de la Coca Cola de la portada** sigue mostrando cadenas de todo el país con una zona elegida y no lo dice. Va contra el requisito "Lo nacional se dice como nacional".
5. **"En tu zona · Palermo" muestra "Día · 969 sucursales"**, que es el conteo nacional de la cadena. Se lee como si fueran las de la zona.
6. **Tu lista dice "No se consigue en tu zona" y "Ninguna cadena de tu zona vende tus productos".** SEPA es una lista de precios, no de stock (DECISIONES, "Disponibilidad por cadena"). Lo que se sabe es que ninguna cadena cercana informa precio.
7. **El paso 4 de Tu canasta elige el "Mejor total" por el monto más bajo,** sin mirar cuántas categorías cubre cada opción. La API ordena primero por cobertura. El explore vio "En 2 sucursales $ 146.661" más caro que "En una sucursal $ 144.427": la de una sucursal cubría 26 de 27 categorías y la pantalla no lo decía. Además, "Contra una sola" resta totales con distinta cobertura.
8. **Los radios no coinciden.** Las cadenas de una zona usan 3 km, y el paso 4 arranca con 2 km. El Maxi de Lomas está a 2,5 km: la portada lo presenta como "tu súper más barato cerca" y el paso 4 no lo encuentra.

## What Changes

- **El buscador entiende unidades escritas.** "1 litro", "2 litros", "1 kilo", "500 gramos" y "1,5 lts" se leen como "1l", "2l", "1kg", "500g" y "1,5l", que es como el índice guarda los tamaños.
- **El buscador de zonas busca por palabras.** Cada palabra tipeada tiene que ser el comienzo de una palabra del nombre o de uno de sus alias. Se ignoran "de", "del", "la", "las", "los" y "el": "lomas zamora" encuentra Lomas de Zamora.
- **Un mismo lugar con nombres parecidos es una sola zona.**
  - **La regla:** se juntan lugares de la misma provincia con centros a menos de 2 km cuando las palabras de un nombre están contenidas en las del otro, sin contar las vacías.
  - **El nombre:** la zona queda con el nombre de más sucursales y guarda los demás como alias.
  - **Los alias** se pueden buscar, y un link viejo con un alias sigue resolviendo a la zona.
- **La tarjeta del ejemplo de la portada, con zona, compara las cadenas de la zona** si al menos dos venden el producto. Si no, dice "en todo el país".
- **Las sucursales de la sección "En tu zona"** dicen "en el país": "969 sucursales en el país".
- **"Sin precio cerca" en vez de "no se consigue".** Tu lista dice "Ninguna cadena cerca informa precio de: X", y no afirma que no se consiga.
- **El paso 4 de Tu canasta compara lo comparable.**
  - El "Mejor total" es el de mayor cobertura y, entre los que cubren lo mismo, el más barato, igual que el orden de la API.
  - "Contra una sola" solo se calcula si cubren lo mismo.
  - Cada opción que no cubre todo dice "sin X" o "cubre N de M".
- **El radio del paso 4 arranca en 3 km,** el mismo de la zona y de las promos. Las opciones pasan a ser 1, 3 y 5 km.

Fuera de alcance:
- **Un total con las promos cercanas** (el caso de Tres Arroyos). Es la oportunidad grande del informe y va en un change aparte.
- **La IA de Tu canasta,** la portada y la barra inferior.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `mismo-producto`: el buscador entiende unidades escritas; las sucursales en "En tu zona" dicen que son del país; "sin precio cerca" en vez de "no se consigue".
- `zona-del-usuario`: buscar zona por palabras, y un lugar con nombres parecidos es una sola zona con alias.
- `portada`: el ejemplo de la portada con zona.
- `tu-canasta`: el paso 4 compara opciones con la misma cobertura y arranca en el radio de la zona.

## Impact

- **API:**
  - `api/mismo_producto.py`: unidades en la consulta.
  - `api/mapa_promos.py`: fusión de lugares con alias, en `lugares`.
  - Tests de los dos.
- **Frontend:**
  - `utils/zona.ts`: buscar por palabras y resolver alias.
  - `Presentacion.tsx` y su util: el ejemplo con zona.
  - `MismoProductoPage.tsx`: sucursales "en el país".
  - `TuLista.tsx`: el texto de "sin precio cerca".
  - `DondeComprarla.tsx`: la cobertura y el radio.
  - Tests.
- **BigQuery:** nada.
- **Docs:** sección en `docs/DECISIONES.md`.
