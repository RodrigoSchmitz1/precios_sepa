SELECT
    id_comercio,
    id_bandera,
    comercio_cuit AS cuit,
    comercio_razon_social AS razon_social,
    comercio_bandera_nombre AS bandera_nombre
FROM {{ source('sepa', 'comercio') }}
WHERE id_comercio IS NOT NULL