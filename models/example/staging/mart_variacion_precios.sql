SELECT
    id_producto,
    descripcion,
    marca,
    COUNT(DISTINCT id_sucursal) AS cantidad_sucursales,
    MIN(precio) AS precio_minimo,
    MAX(precio) AS precio_maximo,
    ROUND(AVG(precio), 2) AS precio_promedio,
    ROUND(MAX(precio) - MIN(precio), 2) AS diferencia_precio
FROM {{ ref('fct_precios') }}
GROUP BY
    id_producto,
    descripcion,
    marca
HAVING COUNT(DISTINCT id_sucursal) > 1
ORDER BY diferencia_precio DESC