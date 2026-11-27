# Tasks

## 1. Descarga de mayoristas

- [x] 1.1 `descargar_sepa.py --dataset mayoristas`: URL de `precios-claros-sepa-mayoristas`, extracción a `sepaN/` de todo comercio con `unidad_venta` en el encabezado y aviso para el que no (comercio 68), limpieza solo de las carpetas del dataset; verificar con un test de la función que decide qué comercios extraer (con el esquema minorista vacío del 68) y corriendo `--dataset mayoristas --fecha 2026-11-25`, que deja 6 carpetas
- [x] 1.2 Verificar que `descargar_sepa.py` sin `--dataset` sigue bajando minoristas igual: mismas carpetas que antes para la misma fecha

## 2. Carga a BigQuery

- [x] 2.1 Mapear las filas de mayoristas al esquema del crudo (decisión 2: precio de lista por unidad con IVA, promos en cero como vacías, presentación `1 UNI`, columnas extra del bulto y sin IVA); verificar con `test_cargar_datos.py`: bulto de 12, venta por unidad, promo `0.00`, pie de archivo sin salto de línea
- [x] 2.2 Crear `sepa.productos_mayoristas` si no existe (partición por `fecha_datos`, 3 días, clustering por comercio, producto y sucursal) y cargarla con *load job* `WRITE_TRUNCATE` por partición; verificar cargando dos veces el 25-11 y comparando `num_rows` de la partición (metadata)
- [x] 2.3 Cambiar la conservación de ausentes de sucursales y comercio a "comercios numéricos del destino que no vinieron hoy" y cargar los dos datasets en una sola pasada con una sola foto anterior; verificar con un test de la consulta armada y con una carga real de solo minoristas en una tabla de validación, que conserva las sucursales mayoristas
- [x] 2.4 Agregar `--solo-mayoristas` (carga solo productos de mayoristas, sin dimensiones); verificar con un test de los argumentos y una carga real de una fecha en la tabla de validación

## 3. Ingesta diaria

- [x] 3.1 En `ingesta_backfill.py`, por cada fecha faltante, bajar minoristas y mayoristas y cargar juntos, con la falla de mayoristas anotada sin frenar a minoristas; verificar con un test de la función que decide el resultado (minoristas ok + mayoristas error = sale con error, minoristas cargado)
- [x] 3.2 Calcular las fechas de mayoristas que faltan (en el crudo minorista, no en el mayorista) y recuperarlas con `--solo-mayoristas`; verificar con tests puros como los de `test_ingesta_backfill.py` (portal de mayoristas caído el 24, nada faltante)
- [x] 3.3 Sumar `sepa.productos_mayoristas` a `ajustar_retencion`; verificar con `--simular` y con un test de que las tablas ajustadas incluyen los dos crudos
- [x] 3.4 Correr la ingesta a mano sobre la semana publicada y verificar contra el relevamiento: ≈390 mil filas por día, 91 sucursales, 6 comercios; anotar `num_bytes` del crudo mayorista

## 4. Coordenadas

- [x] 4.1 Geocodificar una vez las 24 sucursales de Makro con Nominatim (1 consulta por segundo, User-Agent genérico) y guardar `seeds/coordenadas_sucursales.csv` con la fuente; verificar a mano cada una contra la localidad y la latitud que publica SEPA (diferencia menor a 0,05°)
- [x] 4.2 Usar el seed en `stg_sucursales` solo cuando SEPA no trae las dos coordenadas, y agregar un test que falla si una sucursal con precios queda sin coordenadas; verificar corriendo la macro compilada sobre las sucursales reales de validación (coordenada de SEPA gana, seed completa la que falta, apagado sin mayoristas) y con el test singular `sucursales_mayoristas_con_coordenadas`

## 5. dbt: fuente, formato y exclusiones

- [x] 5.1 Fuente `productos_mayoristas`, var `mayoristas_activos` (falsa) y macro de unión del crudo usada por `stg_productos`, `mart_mismo_producto` y `mart_promos_evidencia`; `stg_productos` suma `unidades_bulto` y `precio_bulto`; verificar con unit tests de dbt con el interruptor apagado (sin filas mayoristas) y prendido
- [x] 5.2 `fechas_a_calcular` con segunda fuente y recálculo de la fecha cuya partición de mayoristas es más nueva que la del destino, usado en `stg_productos` e `int_precio_producto_cadena`; verificar con `dbt compile` en una fecha cargada tarde en validación, que la lista incluye esa fecha
- [x] 5.3 Formato por origen en `stg_comercio` (y en `stg_sucursales`), que con el interruptor apagado deja afuera las sucursales y comercios mayoristas, las 6 filas en `mapeo_cadenas.csv` y el chequeo de números de comercio repetidos en la ingesta (gratis: la lista de minoristas es fija; en dbt habría que recorrer los dos crudos); verificar con tests de `test_cargar_datos.py` y compilando con el interruptor prendido y apagado
- [x] 5.4 Corregir `compite_en_rubro` (solo farmacia compite en sus rubros) y filtrar mayoristas en `mart_gama_productos` y `mart_cambio_precio`; verificar con unit tests (un mayorista en Higiene no compite; la farmacia sigue compitiendo)
- [x] 5.5 `int_precio_producto_cadena` y `mart_mismo_producto` con `unidades_bulto` y `precio_bulto`, y referencia, credibilidad y brecha sin mayoristas; verificar con unit tests en `_mismo_producto_unit_tests.yml` (Nini más barato no gana; precio de $6 de Basualdo no creíble)
- [x] 5.6 Correr dbt con el interruptor apagado y verificar que Más barato, inflación, portada y Mismo producto quedan idénticos al día anterior (conteos y sumas de control sobre los marts con `list_rows`)
- [ ] 5.7 (hecho salvo el índice: Más barato sin mayoristas, Mismo producto con mayoristas aparte y súper intactos, 91 sucursales con coordenadas, promos de súper idénticas; falta `mart_precios_cadena_categoria` con dimensiones reales, ~2 GiB, por cuota del 26-11) Correr dbt en validación con el interruptor prendido y verificar: índice de inflación y `mart_quien_gana` iguales que apagado, mayoristas en `mart_mismo_producto` y `mart_mapa_sucursales`; medir los bytes del `dbt run` contra el día anterior

## 6. API

- [x] 6.1 `mapa_promos`: formato por sucursal, zonas que cuentan solo súper y listan `mayoristas` cerca aparte; verificar con `test_mayoristas.py` (zona con Makro cerca: 2 cadenas + Makro aparte; lugar con solo un mayorista no es zona)
- [x] 6.2 `mismo_producto`: `mayorista`, `unidades_bulto`, `precio_bulto` y diferencia contra el súper más barato; Tu lista y Dónde comprarla sin mayoristas en los totales y con resumen por mayorista cerca; verificar con tests en `test_mismo_producto.py` y `test_donde_comprar_lista.py`
- [x] 6.3 Vidriera y promos de producto con mayoristas marcados y bulto, filas de mayorista después de las de súper; verificar con tests en `test_vidriera.py` y `test_promos_productos.py`
- [x] 6.4 Titulares de la portada sin mayoristas; verificar con un test de portada con un mayorista cerca más barato

## 7. Frontend

- [x] 7.1 Tipos (`mayorista`, `unidades_bulto`, `precio_bulto`) y bloque "En mayoristas, comprando el bulto" en `MismoProductoPage` con cerca primero y diferencia contra el súper más barato; verificar con tests de Vitest (con y sin mayoristas, formato es-AR)
- [x] 7.2 Sección de mayoristas cerca en Tu lista y "mayoristas cerca" en el selector de zona; verificar con tests de Vitest
- [x] 7.3 Etiqueta "Mayorista · bulto de N" en promos y marcador distinto en el mapa; verificar con tests de Vitest
- [x] 7.4 Revisar en WebKit a 375 y 414 px una zona con Makro cerca (detalle de producto, Tu lista, Promos, mapa) sin desborde horizontal; verificar con capturas de Playwright

## 8. Informe y costo

- [ ] 8.1 Medir el costo después: almacenamiento (`num_bytes` de crudos y stg) y consultas (`JOBS_BY_PROJECT` de una semana con el interruptor prendido) contra lo de antes (7,18 GiB; ~13 GiB por día); verificar que sigue dentro del uso gratuito
- [ ] 8.2 (escrito en `docs/DECISIONES.md` con lo medido antes del deploy; falta completar el costo después con la tarea 8.1) Escribir el informe en `docs/DECISIONES.md`: mayoristas que entraron, sucursales y productos, cómo se resolvieron las unidades (bulto → unidad, tamaño desde la descripción y cuánto se reconoce), coordenadas corregidas y costo antes y después; verificar que los números coinciden con BigQuery

## 9. CI

- [x] 9.1 Sumar `test_descargar_sepa` y `test_cargar_datos` a `.github/workflows/tests.yml` y verificar que corren local (63 tests)

## Workflow follow-up

- Frenar y pedir el OK de Rodrigo antes de cada commit, del push (`git push` a secas), de cada deploy y de encender `mayoristas_activos`.
- Archivar el change después de una semana con el interruptor prendido sin fallas.
- Proponer aparte categorizar los productos que solo están en mayoristas y el perfil Comercio.
