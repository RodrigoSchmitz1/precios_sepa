{% macro limpiar_comercio(relacion) %}
SELECT
    id_comercio,
    id_bandera,
    comercio_cuit AS cuit,
    comercio_razon_social AS razon_social,
    comercio_bandera_nombre AS bandera_nombre
FROM {{ relacion }}
WHERE id_comercio IS NOT NULL
    AND TRIM(id_comercio) != ''
    AND id_bandera IS NOT NULL
    AND TRIM(id_bandera) != ''
{% endmacro %}