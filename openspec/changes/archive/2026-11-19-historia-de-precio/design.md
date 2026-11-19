# Design

## Context

- **Mismo producto** sale de `mart_mismo_producto`: una fila por producto y cadena, solo con el último día. Trae `precio_mediano`, `precio_creible` y `fecha_precio`, que es distinta de `fecha_datos` cuando la cadena viene arrastrada de un día anterior.
- **Lo que no vence:** solo los históricos (`historico_quien_gana`, `historico_precios_cadena_categoria`). Son incrementales con `insert_overwrite` por `fecha_datos`, sin expiración y sin `--full-refresh`. La fuente y `int_precio_producto_cadena` vencen a los 4 y 3 días.
- **Cómo carga la API:** lee los marts con `leer_tabla` (Storage Read API, sin cuota) y arma el índice en memoria (`armar_indice`). El detalle y `cotizar_lista` salen de ese índice.
- **Lo medido el 18-11,** sobre `int_precio_producto_cadena`, del 16 al 17-11:
  - 229.544 precios, de los cuales cambian 2.950 y aparecen 1.023 nuevos.
  - De los cambios, 1.539 vienen con otra cantidad de sucursales: 765 son menores al 3% y 17 superan el 50%.
  - Los 1.411 con las mismas sucursales son casi todos del 3 al 10% (887).
  - Una fila ocupa unos 44 bytes lógicos: id de 13 caracteres, cadena de 11, fecha y precio.

## Goals / Non-Goals

**Goals:**
- Empezar a guardar historia ya, en el menor espacio posible y sin poder perderla por accidente.
- Decir "subió" o "bajó" solo cuando el cambio es reciente, de la cadena y no ruido de la mediana.
- Que la regla de qué cuenta como cambio viva en un solo lugar (dbt), y que la API y el frontend solo la muestren.

**Non-Goals:**
- Verificar si una promo es real (necesita semanas de historia; change aparte).
- Gráficos de evolución y la historia por sucursal.
- Reconstruir el pasado: el crudo vence a los 4 días y no hay de dónde sacarlo.

## Decisions

### 1. Un registro de cambios, no una foto diaria
`historico_precio_producto` guarda una fila por `(id_producto, cadena)` solo cuando su precio creíble difiere en más de medio centavo del último guardado. También guarda la primera vez que aparece.

- **Columnas:**
  - `fecha_datos`: la partición y la fecha de corrida del mart
  - `fecha_precio`: cuándo informó la cadena ese precio
  - `id_producto`
  - `cadena`
  - `precio`
- **Espacio:** unos 10 MiB el primer día y unos 0,2 MiB por día después.
- **Alternativas descartadas:**
  - Foto diaria: unos 8,5 MiB por día, que llenan el gratuito en menos de un año.
  - Foto semanal: unos 440 MiB por año, y pierde el día del cambio.

### 2. La fuente es `mart_mismo_producto`, no `int_precio_producto_cadena`
- **Mismo precio que el sitio:** la historia queda con el mismo precio y el mismo filtro de creíble que muestra la página. Así los 17 saltos de más del 50% que son errores de carga no entran, y lo que dice "antes $ X" coincide con lo que la página mostró ese día.
- **Arrastre:** una cadena arrastrada trae el mismo precio que el día anterior, así que no genera filas. Una cadena ausente no está en el mart, así que tampoco.
- **Contra:** el mart tiene solo la última fecha. Si una corrida procesa varias fechas atrasadas, la historia registra el cambio en la última, con su `fecha_precio` real.

### 3. Incremental idempotente
Cada corrida compara el mart del día con la última fila de cada clave en la historia, tomando solo las fechas anteriores a la de hoy (`fecha_datos < fecha del mart`). Escribe con `insert_overwrite` la partición de hoy.

- **Correr dos veces el mismo día** da el mismo resultado.
- **Recuperar una fecha:** se puede con `recalcular_fechas`, como en los otros históricos.
- **Sin full refresh:** igual que los otros históricos, `partition_expiration_days=none` y una advertencia de nunca usar `--full-refresh`.
- **La primera corrida** guarda todo el mart creíble, que es el estado inicial.

### 4. `mart_cambio_precio`: la regla de qué se muestra
Se reconstruye cada día desde la historia. Por cada clave toma las dos últimas filas y se queda con las que cumplen todo esto:
- La última tiene `fecha_precio` dentro de `cambio_precio_dias`, que vale 30.
- `|precio / precio_anterior − 1|` es mayor o igual a `cambio_precio_minimo_pct`, que vale 3.
- La última fila es el precio actual: coincide con el mart del día.

**Columnas:**
- `id_producto`
- `cadena`
- `precio`
- `precio_anterior`
- `fecha_cambio`, que es la `fecha_precio` de la última fila
- `cambio_pct`, con signo

**Por qué un mart y no columnas en `mart_mismo_producto`:** la historia depende del mart de Mismo producto, así que el mart no puede leer la historia sin un ciclo.

**El umbral del 3%** sale de lo medido: deja afuera casi todos los cambios de mediana por sucursales que entran o salen (765 de 1.539 son menores al 3%) y conserva las remarcaciones típicas.

### 5. La API pega el cambio al índice
- **Carga:** `_cargar_indice_mismo_producto` lee también `mart_cambio_precio` con `leer_tabla`, unas miles de filas.
- **Índice:** `armar_indice` recibe los cambios como un dict por `(id_producto, cadena)`. Cada entrada de `precios` lleva `cambio: {precio_anterior, fecha, pct}` o `null`.
- **Lista:** `cotizar_lista` copia el cambio de la cadena elegida en `zona.mas_barato`.
- **Si el mart nuevo no existe todavía** (deploy antes de la corrida de dbt), los cambios quedan vacíos con un aviso en el log y la página funciona igual que hoy.

### 6. Frontend: un solo texto
`utils/cambioPrecio.ts` arma los textos:
- "Bajó 10% el 25/11 (antes $ 4.000)" para el detalle
- "Bajó 6% en Día el 25/11" para Tu lista

En los dos el porcentaje va redondeado a entero, la fecha con `fechaCorta` y el precio con el formato es-AR. Sin cambio, devuelve vacío y no se renderiza nada. Los colores siguen el sitio: verde para la baja y el tono neutro de alerta para la suba, sin rojo de error.

## Risks / Trade-offs

- **Historia irrecuperable:** un `--full-refresh` o un `DROP` la borra.
  - Mitigación: la misma advertencia y la misma config que los otros históricos, y una nota en DECISIONES.
- **Ruido de la mediana por encima del 3%:** queda algo (unos 770 cambios por día con otras sucursales son de 3% o más).
  - Mitigación: se dice "en Día", que es la mediana de la cadena, y el detalle muestra el precio anterior, que lo hace verificable.
  - Si se ve ruido, se sube el umbral en una variable.
- **Varias fechas en una corrida:** los cambios intermedios se pierden. Es raro: pasa solo tras días sin SEPA, y el tope es de 3 fechas por corrida.
- **Un producto que vuelve tras semanas ausente** se compara con su último precio guardado. Puede decir "subió 12%" sobre un precio de hace dos meses, pero `fecha_cambio` es la de hoy.
  - Aceptado: el porcentaje es real, y el texto muestra el precio anterior.
- **Memoria:** unas miles de filas suman menos de 1 MiB al índice. Se mide en el deploy, como siempre.
