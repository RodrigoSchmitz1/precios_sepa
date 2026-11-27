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
{#
  COORDENADAS QUE FALTAN (2026-11-26, openspec sumar-mayoristas). Makro publica
  sus 24 sucursales con latitud y sin longitud. seeds/coordenadas_sucursales.csv
  trae su ubicacion, sacada una vez de OpenStreetMap y revisada a mano. Se usa
  SOLO cuando SEPA no trae las dos coordenadas: una correccion nunca pisa un
  punto completo que publica la cadena, y se toma el punto entero del seed (no
  la latitud de SEPA con la longitud del seed) para que sea un lugar coherente.

  MAYORISTAS CON EL INTERRUPTOR APAGADO. Con var('mayoristas_activos') en false
  las sucursales de comercios mayoristas no salen de aca (ver
  sin_mayoristas_si_apagado).
#}
{% macro limpiar_sucursales(relacion) %}
SELECT
    s.id_comercio,
    s.id_bandera,
    {{ id_sucursal_unica('s.id_comercio', 's.id_bandera', 's.id_sucursal') }} AS id_sucursal,
    s.sucursales_nombre AS nombre_sucursal,
    s.sucursales_tipo AS tipo_sucursal,
    s.sucursales_calle AS calle,
    s.sucursales_numero AS numero,
    s.sucursales_barrio AS barrio,
    s.sucursales_localidad AS localidad,
    s.sucursales_provincia AS provincia,
    s.sucursales_codigo_postal AS codigo_postal,
    -- TRIM: Comodin manda las coordenadas con un espacio al final.
    IF(SAFE_CAST(TRIM(s.sucursales_latitud) AS FLOAT64) IS NULL OR SAFE_CAST(TRIM(s.sucursales_longitud) AS FLOAT64) IS NULL,
       COALESCE(c.latitud, SAFE_CAST(TRIM(s.sucursales_latitud) AS FLOAT64)),
       SAFE_CAST(TRIM(s.sucursales_latitud) AS FLOAT64)) AS latitud,
    IF(SAFE_CAST(TRIM(s.sucursales_latitud) AS FLOAT64) IS NULL OR SAFE_CAST(TRIM(s.sucursales_longitud) AS FLOAT64) IS NULL,
       COALESCE(c.longitud, SAFE_CAST(TRIM(s.sucursales_longitud) AS FLOAT64)),
       SAFE_CAST(TRIM(s.sucursales_longitud) AS FLOAT64)) AS longitud
FROM {{ relacion }} AS s
LEFT JOIN {{ ref("coordenadas_sucursales") }} AS c
    ON s.id_comercio = CAST(c.id_comercio AS STRING)
    AND s.id_bandera = CAST(c.id_bandera AS STRING)
    AND s.id_sucursal = CAST(c.id_sucursal AS STRING)
WHERE s.id_sucursal IS NOT NULL
    AND REGEXP_CONTAINS(s.id_comercio, r"^[0-9]+$")
    AND NULLIF(TRIM(s.sucursales_provincia), "") IS NOT NULL
    {{ sin_mayoristas_si_apagado("s.id_comercio") }}
{% endmacro %}