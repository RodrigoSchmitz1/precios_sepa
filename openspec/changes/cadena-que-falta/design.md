# Design

## Context

Ver proposal.md (Why). Estado actual relevante:

- `int_precio_producto_cadena` tiene una fila por producto × cadena × fecha,
  retiene 3 días (`partition_expiration_days=3`) y no completa nada.
- `mart_mismo_producto` es una tabla que lee solo la última fecha de esa tabla
  (`ultima_fecha`, sin cuota). Toma nombres y marcas del crudo
  `sepa.productos` de esa misma fecha, y cae a `stg_categorias` si no hay.
- `mart_quien_gana` calcula varias fechas y alimenta `historico_quien_gana`.
  Si arrastrara precios, la historia quedaría con datos que SEPA no publicó.
- La API arma en memoria el índice de Mismo producto con `leer_tabla`, sin
  cuota. De ese índice salen Mismo producto, la portada (ahorro, destacados) y
  `/quien-gana/zona`. `mismo_producto.quien_gana_entre` se midió el 2026-11-12:
  con todas las cadenas da el mismo ganador, los mismos porcentajes y los
  mismos comparables que `mart_quien_gana` en las 66 categorías.
- `/quien-gana` y `/quien-gana/categorias` hoy consultan `mart_quien_gana` en
  BigQuery, con caché de 6 horas.
- Medido sin cuota el 2026-11-12: de un día al siguiente cambia de precio el
  1,0% de los pares producto × cadena, y la mediana del cambio entre los que
  cambian es 2,6%.

## Goals / Non-Goals

**Goals:**
- Que Mismo producto, Más barato y la portada usen el mismo conjunto de cadenas
  y precios, con la cadena que falta arrastrada y avisada.
- Que la historia siga siendo lo que SEPA publicó.
- Cero consultas nuevas a BigQuery desde el sitio. El costo extra en dbt queda
  medido con un dry run.

**Non-Goals:**
- Arrastrar cargas parciales (una cadena con menos de la mitad de sus
  productos). No pasó nunca en 66 fechas, y el test ya avisa si pasa.
- Que la ingesta vuelva a bajar la fecha.
- Completar históricos, inflación, promos o Tu canasta.

## Decisions

### 1. El arrastre vive en `mart_mismo_producto`, no en `int_precio_producto_cadena`

La tabla intermedia alimenta a `mart_quien_gana` y, por él, a la historia.
Completarla ahí escribiría precios arrastrados en `historico_quien_gana`. En el
mart, la CTE `precios` pasa a ser:

- las filas de la última fecha (como hoy), más
- para cada cadena sin filas en la última fecha, sus filas de la fecha más
  reciente entre `ultima - dias_maximos_arrastre` y `ultima - 1`.

`fecha_datos` sigue siendo la última fecha en todas las filas. La columna nueva
`fecha_precio` dice de qué fecha sale cada precio. El filtro va entre literales
(`DATE('{{ fecha }}')`), así que BigQuery poda particiones.

Se descartó un modelo intermedio aparte: lo usaría un solo mart, y sería otra
tabla para leer y mantener.

### 2. El tope es una variable de dbt: `dias_maximos_arrastre: 2`

Lo leen el mart y el test singular. Ni la API ni el frontend necesitan el
número: el mart ya no publica nada más viejo, y el aviso muestra la fecha
concreta. Va comentado junto a la retención de 3 días de la tabla intermedia:
un tope de 3 o más no tendría filas de dónde salir.

Por qué 2: alcanza para el caso real (un día de hueco) y para un fin de semana
largo de un solo día perdido. Con más días, el precio de "hoy" deja de serlo.

### 3. Nombres de productos arrastrados: se cae a `stg_categorias`

`nombres_crudos` lee el crudo solo de la última fecha. Un producto que el
último día vende solo una cadena arrastrada no tiene nombre ahí y toma el de
`stg_categorias`, que ya es el respaldo actual. Leer el crudo de 3 fechas para
el nombre triplicaría la parte más cara del mart. Esto afecta a pocos productos
(los que solo vende la cadena que falta) y son productos sin comparación: el
mart exige 2 precios creíbles.

### 4. Más barato nacional se calcula desde el índice

`/quien-gana` pasa a devolver `quien_gana_entre(indice, todas_las_cadenas)`,
filtrado por categoría si se pide, con las mismas columnas y el mismo orden.
`/quien-gana/categorias` sale de esas mismas filas. Así Más barato, Mismo
producto y la portada cuentan las mismas cadenas. El sitio deja de hacer dos
consultas por instancia, y la vista nacional y la de zona quedan con una sola
regla.

`mart_quien_gana` sigue existiendo porque lo necesita la historia. La
coincidencia en un día completo se cubre con un test de oráculo en `api/`, como
el que se usó al medirla.

### 5. La API expone las cadenas arrastradas

El índice guarda `fecha_precio` por precio. Una función de `mismo_producto.py`
devuelve las cadenas con `fecha_precio < fecha_datos`, cada una con su fecha. Un
endpoint cacheado, `/datos/cadenas-de-otro-dia`, devuelve
`{fecha_datos, cadenas: [{cadena, fecha_precio}]}`. El detalle de un producto
también trae `fecha_precio` en cada precio.

### 6. Un componente de aviso compartido

`AvisoCadenasDeOtroDia` pide el endpoint una vez y no muestra nada si la lista
viene vacía. Arma el texto con los nombres de `nombres.ts` y la fecha en es-AR
desde el string `AAAA-MM-DD`, sin `new Date`. Va en Mismo producto, Más barato y
la portada. En las filas de Mismo producto, "precio del 10/11" sale de la misma
función de formato.

### 7. Tests

- Unitario de dbt sobre `mart_mismo_producto` con filas de 3 fechas: una cadena
  que falta el último día y está el anterior se arrastra; una cuya última fecha
  tiene 3 días no; una presente el último día no se duplica.
- Singular de dbt `arrastre_dentro_del_tope.sql`: falla si alguna fila tiene
  `DATE_DIFF(fecha_datos, fecha_precio, DAY) > dias_maximos_arrastre`.
- API: cadenas arrastradas desde un índice armado a mano, y el oráculo de
  `/quien-gana` contra `mart_quien_gana`.
- Frontend: Vitest del formato de fecha y del texto del aviso (una, dos y tres
  cadenas), y recorrido en WebKit a 414 px.

## Risks / Trade-offs

- [Un precio arrastrado puede estar viejo] → El 1% cambia de un día al otro, la
  fecha se muestra, y el tope corta a los 2 días.
- [El test `cadenas_del_ultimo_dia_completas` sigue fallando ese día] → Es lo
  buscado: el mail avisa del problema de la fuente aunque el sitio lo cubra.
- [El real del 11-11 no se puede reproducir después del 11-13] → La partición
  del 11-10 expira. El caso queda fijado en el test unitario con filas de
  prueba.
- [Más barato nacional depende ahora del índice en memoria] → Es el mismo
  índice del que ya dependen Mismo producto y la portada. Si no carga, falla
  todo junto, como hoy.

## Migration Plan

1. dbt: variable, mart, tests. Dry run del mart antes y después para comparar
   bytes. `dbt run --select mart_mismo_producto` y `dbt test` en local.
2. API y frontend sobre el mart nuevo, probados contra producción con
   `leer_tabla`.
3. Mostrar a Rodrigo, commit y deploy con su OK. Rollback: revertir el commit.
   La columna nueva no rompe a nadie que no la lea.
