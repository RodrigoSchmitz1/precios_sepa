# Tasks

## 1. dbt: la historia y el cambio

- [x] 1.1 Variables `cambio_precio_minimo_pct: 3` y `cambio_precio_dias: 30` en `dbt_project.yml`, con el porqué medido
- [x] 1.2 `models/historicos/historico_precio_producto.sql`
  - incremental, `insert_overwrite` por `fecha_datos`, sin expiración
  - advertencia de no usar `--full-refresh`
  - solo precios creíbles del mart que difieren del último guardado antes de hoy
- [x] 1.3 `models/marts/mart_cambio_precio.sql`: las dos últimas filas por clave, con los filtros de 30 días, 3% y precio actual
- [x] 1.4 Tests en los `.yml`
  - unique `(id_producto, cadena, fecha_datos)` en la historia
  - unique `(id_producto, cadena)` en el mart
  - not_null
  - unit tests: un precio que no cambia, uno que cambia, la primera vez, uno no creíble, un cambio chico, uno viejo
- [x] 1.5 Dry run de las dos consultas. Después, `dbt run --select historico_precio_producto mart_cambio_precio` y `dbt test`, con los bytes procesados anotados
- [x] 1.6 Medir el tamaño de la historia después de la primera corrida (`__TABLES__`)
- [x] 1.7 Medir después de la segunda corrida y anotar las filas sumadas por día

## 2. API

- [x] 2.1 `armar_indice` acepta los cambios y los pega a cada precio (`cambio` o `None`); `detalle` los devuelve
- [x] 2.2 `cotizar_lista` copia el cambio en `zona.mas_barato`
- [x] 2.3 `_cargar_indice_mismo_producto` lee `mart_cambio_precio` con `leer_tabla`; si falta, cambios vacíos y un aviso en el log
- [x] 2.4 Tests
  - detalle con y sin cambio
  - lista con el cambio de la cadena más barata y sin el de otra cadena
  - mart ausente

## 3. Frontend

- [x] 3.1 Tipos: `cambio` en el precio del detalle y en `mas_barato`
- [x] 3.2 `utils/cambioPrecio.ts`: textos del detalle y de la lista, con tests (suba, baja, redondeo, sin cambio)
- [x] 3.3 Detalle de Mismo producto: la línea debajo de cada cadena con cambio
- [x] 3.4 Tu lista: la línea debajo del producto cuando la cadena más barata de la zona cambió; nada sin zona
- [x] 3.5 Tests de componente para el detalle y Tu lista. Después, lint, `tsc -b`, `vitest` y `build`

## 4. Verificación y docs

- [x] 4.1 E2E en WebKit a 414x896 contra la API local
  - un producto con cambio en el detalle y en Tu lista
  - sin cambios, nada
  - sin desborde
- [x] 4.2 `docs/DECISIONES.md`: sección "La historia del precio" con lo medido. En el README, los conteos de tests
- [x] 4.3 `openspec validate historia-de-precio --strict`
