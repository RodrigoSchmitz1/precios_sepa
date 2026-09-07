WITH fuente AS (
    SELECT
        id_producto,
        descripcion,
        marca,
        categoria,
        rubro
    FROM {{ source('sepa', 'producto_categoria') }}
)
SELECT
    id_producto,
    descripcion,
    marca,
    categoria,
    rubro
FROM fuente