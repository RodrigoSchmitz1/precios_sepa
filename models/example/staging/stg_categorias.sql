WITH fuente AS (
    SELECT
        id_producto,
        descripcion,
        categoria,
        -- Normalización robusta: minúsculas + sin espacios sobrantes + sin tildes.
        -- NFD descompone las letras acentuadas (á -> a + tilde suelta) y el
        -- REGEXP_REPLACE borra esas marcas de acento (rango Unicode U+0300–U+036F).
        LOWER(TRIM(
            REGEXP_REPLACE(NORMALIZE(categoria, NFD), r'\p{Mn}', '')
        )) AS categoria_norm
    FROM {{ source('sepa', 'producto_categoria') }}
)

SELECT
    id_producto,
    descripcion,
    CASE
        WHEN categoria_norm IN (
            'almacen', 'bebidas sin alcohol', 'bebidas con alcohol', 'lacteos',
            'carnes', 'frutas y verduras', 'panaderia', 'limpieza',
            'higiene y perfumeria', 'congelados', 'snacks y golosinas',
            'bebes', 'mascotas', 'otros'
        ) THEN categoria_norm
        ELSE 'otros'
    END AS categoria
FROM fuente