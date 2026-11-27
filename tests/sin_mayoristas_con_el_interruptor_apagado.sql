-- Falla si, con var('mayoristas_activos') apagada, algun mart que lee la API tiene
-- filas de mayoristas (openspec sumar-mayoristas).
--
-- La ingesta carga mayoristas desde el primer dia (crudo hermano, sucursales y
-- comercio en las tablas de siempre). El interruptor es lo que garantiza que el
-- sitio no los muestre antes de saber mostrarlos: sin el filtro de staging,
-- Makro apareceria en el mapa como un supermercado mas. Prendido, no chequea nada.
--
-- Lee la columna formato de tres marts: pocos MB.

{% if not var("mayoristas_activos") %}
SELECT 'mart_mismo_producto' AS mart, cadena, COUNT(*) AS filas
FROM {{ ref("mart_mismo_producto") }}
WHERE formato = 'mayorista'
GROUP BY cadena
UNION ALL
SELECT 'mart_mapa_sucursales', cadena, COUNT(*)
FROM {{ ref("mart_mapa_sucursales") }}
WHERE formato = 'mayorista'
GROUP BY cadena
UNION ALL
SELECT 'mart_promos_vigentes', cadena, COUNT(*)
FROM {{ ref("mart_promos_vigentes") }}
WHERE formato = 'mayorista'
GROUP BY cadena
{% else %}
SELECT CAST(NULL AS STRING) AS mart, CAST(NULL AS STRING) AS cadena, 0 AS filas
FROM UNNEST([1])
WHERE FALSE
{% endif %}
