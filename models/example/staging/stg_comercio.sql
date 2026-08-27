WITH comercio_base AS (
    {{ limpiar_comercio(source("sepa", "comercio")) }}
)

SELECT
    cb.id_comercio,
    cb.id_bandera,
    cb.cuit,
    cb.razon_social,
    cb.bandera_nombre,
    COALESCE(m.nombre_comercial, cb.bandera_nombre) AS nombre_comercial
FROM comercio_base AS cb
LEFT JOIN {{ ref("mapeo_cadenas") }} AS m
    ON cb.id_comercio = CAST(m.id_comercio AS STRING)
    AND cb.id_bandera = CAST(m.id_bandera AS STRING)
