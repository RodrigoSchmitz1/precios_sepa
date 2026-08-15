{% macro limpiar_sucursales(relacion) %}
SELECT
    id_comercio,
    id_bandera,
    id_sucursal,
    sucursales_nombre AS nombre_sucursal,
    sucursales_tipo AS tipo_sucursal,
    sucursales_calle AS calle,
    sucursales_numero AS numero,
    sucursales_barrio AS barrio,
    sucursales_localidad AS localidad,
    sucursales_provincia AS provincia,
    sucursales_codigo_postal AS codigo_postal,
    CAST(sucursales_latitud AS FLOAT64) AS latitud,
    CAST(sucursales_longitud AS FLOAT64) AS longitud
FROM {{ relacion }}
WHERE id_sucursal IS NOT NULL
{% endmacro %}