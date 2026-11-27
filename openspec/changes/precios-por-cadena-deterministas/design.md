# Design

## Context

`int_precio_producto_cadena` agrupa `stg_productos` por fecha, producto y cadena
y saca `precio_mediano` y `cantidad_normalizada` con `APPROX_QUANTILES(x, 2)[OFFSET(1)]`.
Es incremental (insert_overwrite por `fecha_datos`, 3 días de expiración) y lo leen
`mart_mismo_producto`, `mart_quien_gana` y, a través de los históricos,
`mart_cambio_precio` y la historia de precios.

`APPROX_QUANTILES` usa un resumen aproximado: en grupos chicos coincide con el
exacto y, con cantidad par, devuelve el de abajo de los dos del medio (medido en
la auditoría del 2026-10-28, ver `macros/mediana.sql`). En grupos grandes (las
cadenas con cientos de sucursales) puede devolver otro valor, y no siempre el
mismo: es la fuente de los 123 precios que cambiaron el 26-11.

`mart_mismo_producto` ya usa una mediana exacta (macro `mediana`, promedio de los
dos del medio) para el precio por empresa y la referencia del mercado. Elige la
marca con `ORDER BY comercios DESC, LENGTH(marca) DESC LIMIT 1` y el tamaño con
`ORDER BY unidad = "unidad", empresas DESC, sucursales DESC LIMIT 1`: con empate
en todo, BigQuery devuelve cualquiera.

## Goals / Non-Goals

**Goals:**
- Mismo crudo, mismas filas en `int_precio_producto_cadena` y `mart_mismo_producto`.
- Que el cambio mueva lo menos posible las series ya publicadas.
- Mismo costo en bytes que hoy.

**Non-Goals:**
- Reescribir los históricos con la mediana nueva: las fechas viejas quedan como
  se publicaron. No se usa `--full-refresh`.
- Tocar los otros `APPROX_QUANTILES` del proyecto (ver "Fuera de alcance").
- Cambiar las medianas entre empresas de Mismo producto, que ya son exactas.

## Decisions

### 1. Mediana baja exacta, no el promedio de los dos del medio

Para el precio de una cadena se toma el valor del medio de los precios ordenados
y, con cantidad par, el de abajo (`ARRAY_AGG(x ORDER BY x)[OFFSET(DIV(n - 1, 2))]`).

Alternativa considerada: la macro `mediana` existente (promedio de los dos del
medio), como sugería el hallazgo. Se descarta para este nivel porque:

- **Salto en las series el día del deploy.** Hoy los grupos chicos con cantidad
  par ya publican el de abajo. El promedio cambiaría el precio de todos esos
  grupos a la vez (miles, a medir en 1.1), y `mart_cambio_precio` y la historia
  de precios los leerían como cambios de precio reales de ese día. La mediana
  baja solo cambia los grupos donde el aproximado se equivocaba.
- **Un precio que nadie cobra.** Con dos sucursales a $1.000 y $1.200, el
  promedio publica $1.100 como "el precio de la cadena", y ninguna lo cobra. La
  mediana baja publica un precio real.
- **El tamaño.** Para `cantidad_normalizada` el promedio puede inventar un envase
  (750 g entre 500 g y 1.000 g). La mediana baja no.

El costo es un sesgo leve hacia abajo con cantidad par, que ya existe hoy. El
promedio sigue siendo lo correcto donde se usa ahora: la referencia del mercado
entre empresas no se presenta como el precio de nadie.

Si la medición de 1.1 muestra que los grupos donde el exacto bajo difiere del
aproximado son muchos más que los ~123 esperados, se vuelve a presentar antes de
implementar.

### 2. Una macro agregada en la misma consulta

`mediana_baja(columna)` en `macros/mediana.sql`, al lado de `mediana`:

```sql
ARRAY_AGG(col IGNORE NULLS ORDER BY col)[SAFE_OFFSET(DIV(COUNT(col) - 1, 2))]
```

Es un agregado común, así que entra en el mismo `GROUP BY` sin la CTE extra que
necesita `mediana` (que opera sobre un array ya armado). `IGNORE NULLS` y
`COUNT(col)` descartan las cantidades no reconocidas; si no queda ninguna,
`ARRAY_AGG` devuelve NULL y `SAFE_OFFSET` da NULL, igual que hoy, sin cortar la
corrida. `precio` no es nulo en `stg_productos`, pero el mismo `IGNORE NULLS`
evita el error de `ARRAY_AGG` si alguna vez lo fuera.

Alternativa: `PERCENTILE_DISC(x, 0.5) OVER (PARTITION BY ...)`. Es analítica, no
agregada: obliga a una ventana sobre todas las filas de `stg_productos` y un
`DISTINCT` después. Más pesada y menos legible.

### 3. Desempates finales por el texto

- Marca: `ORDER BY comercios DESC, LENGTH(marca) DESC, marca`.
- Tamaño: `ORDER BY unidad = "unidad", empresas DESC, sucursales DESC, cantidad_normalizada, unidad_normalizada`.
  Entre dos tamaños igual de votados se toma el menor: no hay uno más cierto que
  otro, y lo que importa es que sea siempre el mismo.
- Nombre: ya termina en `n.descripcion`, es determinista. Se deja igual.
- Textos de búsqueda (agregado en la verificación del 27-11): `STRING_AGG(DISTINCT ...)`
  sin `ORDER BY` salía distinto en 124.606 de 225.409 filas. Va ordenado por el
  mismo texto, que es lo que BigQuery exige con `DISTINCT`.

### 4. Cómo se verifica que es determinista

Con el modelo nuevo, en un dataset de prueba propio (no en `dbt_precios`):
construir dos veces `int_precio_producto_cadena` para la última fecha a partir de
su SQL compilado; construir dos veces `mart_mismo_producto` leyendo la primera
copia (así lo único que varía entre las dos es el propio mart), y comparar cada
par con `EXCEPT DISTINCT` en los dos sentidos. Cero filas en ambos = determinista. Una sola fecha alcanza: el cálculo
es por grupo y no depende de las otras fechas.

## Costo

- Bytes: iguales a hoy. BigQuery on-demand cobra por bytes leídos, y las columnas
  leídas no cambian. Medido el 26-11 por dry run (gratis) sobre el SQL compilado
  para el 25-11: `int_precio_producto_cadena` procesa 828.523.364 bytes (0,77 GiB)
  con `APPROX_QUANTILES` y exactamente lo mismo con la forma `ARRAY_AGG ...
  [SAFE_OFFSET(DIV(COUNT(x) - 1, 2))]`, que además BigQuery valida como agregado
  en la misma consulta. `mart_mismo_producto` procesa 1.098.763.277 bytes
  (1,02 GiB); los desempates no agregan columnas. La tarea 4.1 lo repite con el
  modelo ya cambiado.
- Slots y memoria: `ARRAY_AGG ... ORDER BY` arma un array por grupo; el más grande
  es un producto en Carrefour (~cientos de sucursales por fecha), chico para
  BigQuery. No se cobra en on-demand.
- Medición previa (1.1): 0,65 GiB por dry run, con la fecha escrita literal (con
  `MAX(fecha)` en subconsulta no poda particiones y sube a 1,92 GiB).
- Verificación (tarea 4.2): dos construcciones de una fecha de
  `int_precio_producto_cadena` (0,77 GiB cada una) y dos de `mart_mismo_producto`
  (1,02 GiB cada una), más las comparaciones sobre tablas chicas. Total estimado
  con 1.1: ~4,3 GiB. Cada construcción se hace como `CREATE TABLE ... AS` del SQL
  compilado con la fecha fija, en el dataset de prueba: así la primera no es un
  build completo de 3 días. Se suma lo gastado en el día con `JOBS_BY_PROJECT`
  antes de correr y no se pasa de 32 GiB; el 26-11 ya cerró en ~31,3 GiB, así que
  nada de esto corre antes del 27-11.

## Risks / Trade-offs

- [El día del deploy, los grupos que cambian aparecen como cambios de precio en
  `mart_cambio_precio` y la historia] → Son los que el aproximado tenía mal; se
  miden en 1.1 y se anotan en DECISIONES.md. Si son pocos (~cientos sobre
  ~258 mil) se acepta; si son miles, se vuelve a presentar.
- [Sesgo hacia abajo con cantidad par] → Existe hoy en los grupos chicos; queda
  igual, documentado.
- [Un error de carga en una sucursal entre dos] → Con dos sucursales la mediana
  baja es la más barata de las dos; si es un error de carga, lo agarra la regla de
  "precio creíble" de Mismo producto, igual que hoy.

## Migration Plan

1. Merge y deploy del pipeline: la próxima corrida diaria calcula la fecha nueva
   con la mediana baja. Las fechas que siguen en el crudo (3 días) y ya están en
   los históricos no se recalculan (`fechas_a_calcular`), así que el cambio entra
   de a un día, sin reescribir nada.
2. Rollback: revertir el commit. Las fechas calculadas con la mediana nueva quedan
   en los históricos; la diferencia es la de 1.1 y no hace falta repararlas.

## Fuera de alcance (posible change aparte)

Otros `APPROX_QUANTILES` con el mismo problema:

- `mart_precios_cadena_categoria`: `precio_unitario` por producto, cadena y día,
  que alimenta el pareo del índice de inflación, y `precio_mediano_unidad`, p10 y
  p90 por categoría. Es el más importante: ruido en el índice.
- `mart_gama_productos`: `precio_mediano` y `precio_por_unidad` sobre 3 días y
  todas las cadenas, y `NTILE(3)` sin desempate. Un producto en el borde puede
  cambiar de gama y entrar o salir de la canasta económica.
- `mart_precio_categoria_localidad` y `mart_precio_categoria_sucursal`: p10, p90 y
  mediana por categoría. Grupos grandes, efecto chico.
- `mart_promos_calibracion`: percentiles 0,1% y 99,9% de los umbrales de promos.
