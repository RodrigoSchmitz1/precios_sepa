SELECT
    id_producto,
    COUNT(DISTINCT id_comercio) AS cantidad_cadenas,
    MIN(precio) AS precio_minimo,
    MAX(precio) AS precio_maximo,
    ROUND(AVG(precio), 2) AS precio_promedio,
    ROUND(MAX(precio) - MIN(precio), 2) AS diferencia_precio,
    ROUND((MAX(precio) - MIN(precio)) / MIN(precio) * 100, 1) AS variacion_porcentual
FROM {{ ref('fct_precios') }}
GROUP BY id_producto
HAVING COUNT(DISTINCT id_comercio) > 1
ORDER BY diferencia_precio DESC