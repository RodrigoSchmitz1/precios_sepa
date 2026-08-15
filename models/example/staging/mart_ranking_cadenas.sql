SELECT
    id_comercio,
    razon_social,
    bandera_nombre,
    COUNT(DISTINCT id_producto) AS cantidad_productos,
    COUNT(DISTINCT id_sucursal) AS cantidad_sucursales,
    ROUND(AVG(precio), 2) AS precio_promedio,
    ROUND(MIN(precio), 2) AS precio_minimo,
    ROUND(MAX(precio), 2) AS precio_maximo
FROM {{ ref('fct_precios') }}
GROUP BY
    id_comercio,
    razon_social,
    bandera_nombre
ORDER BY precio_promedio DESC