# Proposal

## Why

El 26-11-2026 se reconstruyó `int_precio_producto_cadena` dos veces con el mismo
crudo y 123 de las ~258 mil medianas por cadena cambiaron, hasta 22%: la mediana
sale de `APPROX_QUANTILES`, que no es determinista. El ruido llega a lo que se
publica: ~118 productos de Mismo producto con otra referencia, otros extremos u
otra brecha, un Yogur que pasó de ganarlo la Cooperativa a ganarlo Maxi en Quién
gana, y cambios de precio que nadie hizo en `mart_cambio_precio` y en la historia
de precios. Además, Mismo producto elige la marca y el tamaño con empates sin
desempate: ~150 productos cambian de nombre entre corridas ("PUREZA D LAS SIERRAS"
y "PUREZA DE LAS SIERRA") y ~10 alternan entre dos tamaños. Un precio o un nombre
que cambia solo, sin que cambie el dato, rompe la honestidad del dato.

## What Changes

- El precio de un producto en una cadena (`precio_mediano` de
  `int_precio_producto_cadena`) pasa a ser una mediana **exacta y determinista**
  entre los precios de sus sucursales. Con una cantidad par de precios es **el de
  abajo de los dos del medio** (mediana baja), que es lo que `APPROX_QUANTILES`
  ya devolvía en los grupos chicos: el precio publicado sigue siendo uno que
  alguna sucursal cobra, y la serie histórica no salta el día del deploy salvo en
  los grupos donde el aproximado se equivocaba. Ver design.md (Decisión 1) para la
  alternativa del promedio de los dos del medio y por qué no se elige.
- Lo mismo para el tamaño del envase por cadena (`cantidad_normalizada`): mediana
  baja, así el tamaño es siempre uno que alguna sucursal declaró (nunca 750 g
  entre una de 500 y una de 1.000).
- Una macro nueva en `macros/mediana.sql` para la mediana baja como agregado, en
  la misma consulta y sin CTE extra, al lado de la `mediana` exacta que ya existe.
- Desempates finales por el texto en Mismo producto: la marca (después de más
  comercios y más larga, la primera en orden alfabético) y el tamaño (después de
  no-"unidad", más empresas y más sucursales, el de menor cantidad y unidad en
  orden alfabético). El nombre ya terminaba en la descripción y no cambia.
- Unit tests de dbt que fijan la mediana baja con cantidad par e impar, con
  NULL en la cantidad, y los dos desempates.
- Verificación: dos reconstrucciones seguidas de los modelos tocados dan
  exactamente las mismas filas, con el costo medido en bytes.
- Fuera de alcance, para un change aparte si Rodrigo quiere: los otros
  `APPROX_QUANTILES` del proyecto (gama de productos, marts por categoría y la
  calibración de promos) y el `NTILE` de la gama sin desempate. Se listan en
  design.md con su efecto probable.

## Capabilities

### New Capabilities

- `precio-por-cadena`: cómo se calcula el precio y el tamaño de un producto en una
  cadena a partir de sus sucursales, y que el resultado sea el mismo con los mismos
  datos. Es la base de Mismo producto, Quién gana, la historia y los cambios de
  precio, y hasta hoy no tenía spec propia.

### Modified Capabilities

- `mismo-producto`: se agrega que el nombre, la marca y el tamaño que muestra un
  producto no cambian entre dos corridas con los mismos datos.

## Impact

- Código: `macros/mediana.sql`, `models/intermedios/int_precio_producto_cadena.sql`,
  `models/marts/mart_mismo_producto.sql`, unit tests nuevos en
  `models/intermedios/` y `models/marts/_mismo_producto_unit_tests.yml`,
  `docs/DECISIONES.md`.
- Datos: cambia `precio_mediano` solo en los grupos donde el aproximado difería del
  exacto (a medir antes de implementar; esperado del orden de los 123 medidos).
  Los históricos no se reescriben: el cambio entra con la próxima corrida y no se
  usa `--full-refresh`.
- Costo: los bytes leídos no cambian (mismas columnas); la mediana exacta usa más
  memoria y slots, que no se cobran en on-demand. Se confirma con dry run y con la
  corrida de verificación, dentro del tope de 32 GiB del día.
- Sin cambios en la API ni en el frontend.
