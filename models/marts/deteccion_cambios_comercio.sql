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
            -- Solo las columnas que vienen de SEPA. Comparar la fila entera marcaba
            -- los 21 comercios como modificados todos los dias: stg_comercio suma
            -- columnas propias (nombre_comercial del seed, y desde el 2026-11-19
            -- formato e informe_diario) que la foto de ayer no tiene.
            WHEN TO_JSON_STRING(STRUCT(hoy.cuit, hoy.razon_social, hoy.bandera_nombre))
                IS DISTINCT FROM TO_JSON_STRING(STRUCT(ayer.cuit, ayer.razon_social, ayer.bandera_nombre))
                THEN 'modificacion'
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