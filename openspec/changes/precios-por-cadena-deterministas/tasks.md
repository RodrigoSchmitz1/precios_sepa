# Tasks

Antes de cada tarea que consulta BigQuery: sumar lo gastado en el día con
`JOBS_BY_PROJECT` (ver DEPLOY.md) y no pasar de 32 GiB. Nada de commits, push ni
deploy sin el OK de Rodrigo.

## 1. Medir antes de tocar

- [x] 1.1 Sobre la última fecha de `stg_productos`, contar en una sola consulta (dry run primero) cuántos grupos producto × cadena cambian contra el `precio_mediano` publicado si se usa (a) la mediana baja exacta y (b) el promedio de los dos del medio, y lo mismo para `cantidad_normalizada`; verificar que (a) esté en el orden de los ~123 medidos y anotar los números en este change. Si (a) da miles, frenar y volver a presentar. Hecho 27-11 (25-11): (a) 98 de 258.562, 13 de 3% o más, máx. 27,9%; (b) 5.223, 1.490 de 3% o más; cantidad: 0 en los dos. 0,65 GiB.

## 2. Mediana baja en el precio por cadena

- [x] 2.1 Agregar la macro `mediana_baja` en `macros/mediana.sql`, con su comentario (por qué baja y no promedio, NULL, array vacío); verificar que `dbt compile -s int_precio_producto_cadena` genera el SQL esperado.
- [x] 2.2 Usarla en `int_precio_producto_cadena.sql` para `precio_mediano` y `cantidad_normalizada`, y actualizar el comentario del modelo; verificar que el test `precio_minimo <= precio_mediano <= precio_maximo` de `_intermedios.yml` sigue valiendo.
- [x] 2.3 Unit tests en `models/intermedios/_int_precio_producto_cadena_unit_tests.yml`: cantidad impar, cantidad par (el de abajo, no el promedio), una sola sucursal, cantidad NULL en todas las filas (tamaño NULL y precio calculado) y dos tamaños (500 y 1.000 dan 500); verificar que `dbt test -s int_precio_producto_cadena,test_type:unit` pasa.

## 3. Desempates en Mismo producto

- [x] 3.1 Agregar el desempate por texto en `marca_producto` y por cantidad y unidad en `tamano_producto` de `mart_mismo_producto.sql`, con el porqué en el comentario; verificar con `dbt compile`.
- [x] 3.2 Unit tests en `_mismo_producto_unit_tests.yml`: dos marcas empatadas en comercios y largo ("PUREZA D LAS SIERRAS" gana) y dos tamaños empatados en empresas y sucursales (gana el menor); verificar que `dbt test -s mart_mismo_producto,test_type:unit` pasa, incluidos los tests que ya existían.
- [x] 3.3 Ordenar `STRING_AGG(DISTINCT ...)` de `textos_busqueda` (hallado en 4.2: 124.606 filas distintas entre corridas); verificar con 4.2 y con los unit tests de `mart_mismo_producto`.

## 4. Verificar que es determinista

- [x] 4.1 Compilar `int_precio_producto_cadena` y `mart_mismo_producto` con el cambio y comparar sus dry runs contra los de antes (828.523.364 y 1.098.763.277 bytes para el 25-11, o los del día con el código de `main`); verificar que los bytes procesados son iguales. Hecho 26-11: 828.523.364 y 1.098.763.277 bytes, idénticos antes y después.
- [x] 4.2 En un dataset de prueba propio, construir dos veces seguidas `int_precio_producto_cadena` y `mart_mismo_producto` para la última fecha y comparar las dos copias con `EXCEPT DISTINCT` en los dos sentidos (sobre `TO_JSON_STRING` de la fila si alguna columna no es agrupable); verificar cero filas de diferencia y anotar los GiB facturados de cada paso (de `JOBS_BY_PROJECT`). Borrar el dataset de prueba al terminar. Hecho 27-11: 0 y 0 filas en el intermedio (258.562) y en el mart (225.409) tras 3.3; dataset borrado; 6,66 GiB en todo el día.

## 5. Documentar

- [x] 5.1 Anotar en `docs/DECISIONES.md` el hallazgo (123 precios, hasta 22%), la decisión de mediana baja con lo medido en 1.1, el costo medido en 4.1 y 4.2, y los `APPROX_QUANTILES` que quedan fuera; verificar que la entrada cita los números medidos.

## Workflow follow-up

- Presentar el resultado a Rodrigo y pedir OK para commitear.
- Con su OK, merge; la corrida diaria siguiente aplica el cambio. Revisar al día siguiente que `mart_cambio_precio` no muestre más cambios que los esperados por 1.1.
- Archivar el change.
- Proponer el change aparte para los otros `APPROX_QUANTILES` (índice, gama), si Rodrigo quiere.
