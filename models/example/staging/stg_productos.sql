SELECT
    id_comercio,
    id_bandera,
    id_sucursal,
    id_producto,
    productos_descripcion AS descripcion,
    productos_marca AS marca,
    CAST(productos_precio_lista AS FLOAT64) AS precio, 
    DATE('2026-07-31') AS fecha_datos
FROM {{ source('sepa', 'productos') }}
WHERE productos_precio_lista IS NOT NULL
    AND CAST(productos_precio_lista AS FLOAT64) > 1

