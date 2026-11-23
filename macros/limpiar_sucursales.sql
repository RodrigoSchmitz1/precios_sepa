{#
  RENGLONES PARTIDOS (2026-11-23). Desde el 20-11 Comodin y Carrefour publican
  sucursales con un salto de linea adentro de sucursales_observaciones, sin
  comillas. BigQuery partia el renglon en dos: la segunda mitad entraba como
  una fila sin id_comercio, con el horario ("08:00 a 22:00", "cerrado") en
  sucursales_latitud, y el CAST rompia stg_sucursales y todo lo que depende de
  el (mapa, promos, canasta por sucursal) cuatro dias seguidos.

  La carga ya vuelve a unir esos renglones (cargar_datos.reparar_renglones).
  Esto queda como red: una fila sin id_comercio numerico o sin provincia no es
  una sucursal, y una coordenada que no es un numero es NULL (esas sucursales
  ya se descartan aguas abajo por no tener coordenadas).
#}
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
    SAFE_CAST(sucursales_latitud AS FLOAT64) AS latitud,
    SAFE_CAST(sucursales_longitud AS FLOAT64) AS longitud
FROM {{ relacion }}
WHERE id_sucursal IS NOT NULL
    AND REGEXP_CONTAINS(id_comercio, r"^[0-9]+$")
    AND NULLIF(TRIM(sucursales_provincia), "") IS NOT NULL
{% endmacro %}