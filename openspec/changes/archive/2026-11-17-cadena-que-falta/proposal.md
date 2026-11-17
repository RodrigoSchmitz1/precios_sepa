# Proposal

## Why

Algunos días el ZIP de SEPA llega sin una de las empresas, y el sitio publica
el día sin ella y sin avisar. Pasó 3 veces en 66 días (Cooperativa Obrera el
2026-09-29, Dia el 11-08, y Jumbo, Disco y Vea el 11-11), siempre por la
fuente. El 11-11, sin Cencosud, los productos comparables de Mismo producto
bajaron un 9% (de 18.219 a 16.536). Además, en el 25,6% de ellos la cadena más
cara era de Cencosud, así que las brechas publicadas se achicaron por la cadena
que faltaba y no por el mercado.

Ya hay un test que avisa por mail (`cadenas_del_ultimo_dia_completas`). Falta
que el sitio no publique un mercado incompleto como si estuviera completo.
Rodrigo eligió, el 2026-11-12, usar el precio del día anterior para la cadena
que falta y avisarlo en la página. Lo sostiene una medición: de un día al
siguiente cambia de precio el 1,0% de los pares producto × cadena (1,2% en
Cencosud).

## What Changes

- `mart_mismo_producto` completa el último día: si una cadena que tenía
  precios en alguno de los 2 días anteriores falta en el último, toma sus
  precios de su fecha más reciente. Cada fila lleva `fecha_precio`, la fecha de
  la que sale ese precio. El tope de días vive en una variable de dbt.
- Los históricos no cambian: siguen guardando lo que SEPA publicó.
  `mart_quien_gana` y los históricos no arrastran nada.
- La API expone qué cadenas se muestran con precios de otro día y de qué fecha.
  Lo calcula del índice de Mismo producto que ya tiene en memoria.
- Más barato nacional (`/quien-gana` y `/quien-gana/categorias`) pasa a
  calcularse desde ese mismo índice, con todas las cadenas, como ya hace la
  vista de la zona. Así incluye las cadenas arrastradas y coincide con Mismo
  producto. Se dejan de hacer dos consultas a BigQuery por instancia.
- Mismo producto, Más barato y la portada muestran un aviso cuando hay cadenas
  arrastradas ("SEPA no publicó hoy los precios de Jumbo, Disco y Vea: se
  muestran los del 10/11"). En Mismo producto, la fila de esas cadenas dice de
  qué fecha es su precio.
- Un test de dbt verifica que ningún precio arrastrado tenga más de 2 días.

Fuera de alcance:
- Que la ingesta vuelva a bajar una fecha incompleta (no se sabe si SEPA
  corrige el ZIP durante la semana).
- Completar los históricos o el índice de inflación.
- Promos y Tu canasta, que son por sucursal y salen de otros marts.

## Capabilities

### New Capabilities
- `datos-del-dia`: qué se publica cuando la fuente llega incompleta: el
  arrastre de una cadena que falta, su tope, el aviso y lo que no se toca.

### Modified Capabilities
- `mismo-producto`: cada precio dice de qué fecha es cuando no es del día.
- `mas-barato`: la vista nacional se calcula con las mismas cadenas que Mismo
  producto, incluidas las arrastradas.

## Impact

- dbt: `mart_mismo_producto` (CTE `precios` y columna `fecha_precio`), una
  variable nueva en `dbt_project.yml`, un test unitario y un test singular. Lee
  hasta 3 particiones de `int_precio_producto_cadena` en vez de 1. Se mide con
  un dry run, pero son decenas de MB. `mart_quien_gana` y los históricos no
  cambian.
- API: `mismo_producto.py` (índice con `fecha_precio`, cadenas arrastradas) y
  `main.py` (`/quien-gana`, `/quien-gana/categorias` y el endpoint del aviso).
  Ninguna consulta nueva, y dos menos.
- Frontend: un componente de aviso compartido en Mismo producto, Más barato y
  la portada, y la fecha en las filas arrastradas.
- docs/DECISIONES.md: cómo quedó implementado.
