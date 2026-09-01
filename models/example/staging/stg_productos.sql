-- Agrega cantidad_normalizada y unidad_normalizada a partir de las columnas
-- estructuradas de presentacion (cantidad_presentacion + unidad_medida_presentacion).
-- Se prefiere esto sobre parsear la descripcion (texto libre): el dato ya viene
-- estructurado en la fuente SEPA, es mas confiable que reconstruirlo con regex.
-- unidad_normalizada in ("g", "cc", "unidad"); NULL si la unidad no es reconocida.

WITH base AS (
    SELECT
        id_comercio,
        id_bandera,
        id_sucursal,
        id_producto,
        productos_descripcion AS descripcion,
        productos_marca AS marca,
        CAST(productos_precio_lista AS FLOAT64) AS precio,
        productos_cantidad_presentacion AS cantidad_presentacion_raw,
        productos_unidad_medida_presentacion AS unidad_presentacion_raw,
        fecha_datos
    FROM {{ source("sepa", "productos") }}
    WHERE productos_precio_lista IS NOT NULL
        AND CAST(productos_precio_lista AS FLOAT64) > 1
),

con_unidad_limpia AS (
    SELECT
        *,
        SAFE_CAST(REPLACE(cantidad_presentacion_raw, ",", ".") AS FLOAT64) AS cantidad_pres,
        UPPER(TRIM(REPLACE(unidad_presentacion_raw, ".", ""))) AS unidad_limpia
    FROM base
)

SELECT
    id_comercio,
    id_bandera,
    id_sucursal,
    id_producto,
    descripcion,
    marca,
    precio,
    fecha_datos,
    CASE
        WHEN unidad_limpia IN ("KG", "KGM", "KGR", "KILO") THEN cantidad_pres * 1000
        WHEN unidad_limpia IN ("GR", "GRM", "GRAMOS") THEN cantidad_pres
        WHEN unidad_limpia IN ("LT", "LTR", "L", "LITRO") THEN cantidad_pres * 1000
        WHEN unidad_limpia IN ("ML", "CM3", "CMQ", "CC") THEN cantidad_pres
        WHEN unidad_limpia IN ("UNI", "UNIDAD", "UD", "UN") THEN cantidad_pres
        ELSE NULL
    END AS cantidad_normalizada,
    CASE
        WHEN unidad_limpia IN ("KG", "KGM", "KGR", "KILO", "GR", "GRM", "GRAMOS") THEN "g"
        WHEN unidad_limpia IN ("LT", "LTR", "L", "LITRO", "ML", "CM3", "CMQ", "CC") THEN "cc"
        WHEN unidad_limpia IN ("UNI", "UNIDAD", "UD", "UN") THEN "unidad"
        ELSE NULL
    END AS unidad_normalizada
FROM con_unidad_limpia
