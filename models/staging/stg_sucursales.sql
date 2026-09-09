WITH sucursales_base AS (
    {{ limpiar_sucursales(source("sepa", "sucursales")) }}
),

con_localidad_cruda AS (
    SELECT
        sb.id_comercio,
        sb.id_bandera,
        sb.id_sucursal,
        sb.nombre_sucursal,
        sb.tipo_sucursal,
        sb.calle,
        sb.numero,
        sb.barrio,
        CASE
            WHEN sb.provincia = "AR-C" AND UPPER(sb.localidad) IN (
                "CAPITAL FEDERAL", "CIUDAD AUTONOMA DE BUENOS AIRES",
                "CIUDAD AUTONOMA BUENOS AIRES", "CIUDAD AUTONOMA DE BS AS",
                "CABA", "BUENOS AIRES"
            ) THEN COALESCE(barrio_geo.barrio_calculado, sb.localidad)
            ELSE sb.localidad
        END AS localidad_cruda,
        sb.provincia,
        sb.codigo_postal,
        sb.latitud,
        sb.longitud
    FROM sucursales_base AS sb
    LEFT JOIN {{ ref("stg_sucursales_barrio") }} AS barrio_geo
        ON sb.id_comercio = barrio_geo.id_comercio
        AND sb.id_sucursal = barrio_geo.id_sucursal
),

forma_canonica AS (
    -- Una misma ciudad venia escrita de dos formas segun la cadena que la
    -- reporta, y eso la partia en dos localidades distintas: "Salta" y "SALTA"
    -- (38 sucursales entre ambas), "Mendoza" y "MENDOZA" (33), y lo mismo
    -- Corrientes, Neuquen y Comodoro Rivadavia. El efecto era doble: aparecia
    -- dos veces en los rankings con costos distintos, y ademas cada mitad tenia
    -- la mitad de las muestras, con lo que le costaba mas superar los umbrales
    -- de confiabilidad.
    --
    -- La clave de agrupamiento ignora mayusculas Y acentos (NFD descompone la
    -- tilde y el regexp saca la marca), asi que "Bahia Blanca" y "BAHIA BLANCA"
    -- caen juntas. Como forma visible se elige la grafia MAS FRECUENTE en los
    -- datos, en vez de imponer un formato: asi se respeta como escriben las
    -- cadenas y se conservan los acentos cuando estan.
    SELECT
        provincia,
        REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(localidad_cruda, NFD), r"\p{Mn}", "") AS clave,
        APPROX_TOP_COUNT(localidad_cruda, 1)[OFFSET(0)].value AS localidad
    FROM con_localidad_cruda
    WHERE localidad_cruda IS NOT NULL
    GROUP BY provincia, clave
)

SELECT
    c.id_comercio,
    c.id_bandera,
    c.id_sucursal,
    c.nombre_sucursal,
    c.tipo_sucursal,
    c.calle,
    c.numero,
    c.barrio,
    COALESCE(fc.localidad, c.localidad_cruda) AS localidad,
    c.provincia,
    c.codigo_postal,
    c.latitud,
    c.longitud
FROM con_localidad_cruda AS c
LEFT JOIN forma_canonica AS fc
    ON c.provincia = fc.provincia
    AND REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(c.localidad_cruda, NFD), r"\p{Mn}", "") = fc.clave
