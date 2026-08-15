WITH hoy AS (
    SELECT * FROM {{ ref('stg_sucursales') }}
),

ayer AS (
    SELECT * FROM {{ ref('stg_sucursales_anterior') }}
),

comparacion AS (
    SELECT
        'sucursales' AS dimension,
        COALESCE(hoy.id_comercio, ayer.id_comercio) AS id_comercio,
        COALESCE(hoy.id_bandera, ayer.id_bandera) AS id_bandera,
        COALESCE(hoy.id_sucursal, ayer.id_sucursal) AS id_sucursal,
        COALESCE(hoy.nombre_sucursal, ayer.nombre_sucursal) AS nombre,
        CASE
            WHEN ayer.id_sucursal IS NULL THEN 'alta'
            WHEN hoy.id_sucursal IS NULL THEN 'baja'
            WHEN TO_JSON_STRING(hoy) IS DISTINCT FROM TO_JSON_STRING(ayer) THEN 'modificacion'
            ELSE 'sin_cambio'
        END AS tipo_cambio
    FROM hoy
    FULL OUTER JOIN ayer
        ON  hoy.id_comercio = ayer.id_comercio
        AND hoy.id_bandera  = ayer.id_bandera
        AND hoy.id_sucursal = ayer.id_sucursal
)

SELECT
    dimension,
    id_comercio,
    id_bandera,
    id_sucursal,
    nombre,
    tipo_cambio
FROM comparacion
WHERE tipo_cambio != 'sin_cambio'