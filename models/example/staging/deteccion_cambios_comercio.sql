WITH hoy AS (
    SELECT * FROM {{ ref('stg_comercio') }}
),

ayer AS (
    SELECT * FROM {{ ref('stg_comercio_anterior') }}
),

comparacion AS (
    SELECT
        'comercio' AS dimension,
        COALESCE(hoy.id_comercio, ayer.id_comercio) AS id_comercio,
        COALESCE(hoy.id_bandera, ayer.id_bandera) AS id_bandera,
        CAST(NULL AS STRING) AS id_sucursal,
        COALESCE(hoy.razon_social, ayer.razon_social) AS nombre,
        CASE
            WHEN ayer.id_comercio IS NULL THEN 'alta'
            WHEN hoy.id_comercio IS NULL THEN 'baja'
            WHEN TO_JSON_STRING(hoy) IS DISTINCT FROM TO_JSON_STRING(ayer) THEN 'modificacion'
            ELSE 'sin_cambio'
        END AS tipo_cambio
    FROM hoy
    FULL OUTER JOIN ayer
        ON  hoy.id_comercio = ayer.id_comercio
        AND hoy.id_bandera  = ayer.id_bandera
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