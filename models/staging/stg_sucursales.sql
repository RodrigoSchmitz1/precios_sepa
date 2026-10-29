WITH sucursales_base AS (
    {{ limpiar_sucursales(source("sepa", "sucursales")) }}
),

-- PROVINCIA MAL CARGADA (2026-10-28). 34 sucursales venian con la provincia de
-- CABA (AR-C) y coordenadas en otra parte: 20 en la ciudad de Cordoba, una en
-- Mendoza, otras en el conurbano y en Chubut. Aparecian como localidades de
-- CABA ("Cordoba, CABA") y la de verdad quedaba partida en dos. Las coordenadas
-- lo delatan: no caen en ningun barrio. Se les asigna la provincia de la
-- sucursal mas cercana de otra provincia, si esta a menos de 50 km; si no hay
-- ninguna, se deja la cargada, porque no hay con que deducirla.
fuera_de_caba AS (
    SELECT sb.id_comercio, sb.id_sucursal, ST_GEOGPOINT(sb.longitud, sb.latitud) AS punto
    FROM sucursales_base AS sb
    JOIN {{ ref("stg_sucursales_barrio") }} AS b
        ON sb.id_comercio = b.id_comercio
        AND sb.id_sucursal = b.id_sucursal
    WHERE b.barrio_calculado IS NULL
),

provincia_corregida AS (
    SELECT
        f.id_comercio,
        f.id_sucursal,
        ARRAY_AGG(v.provincia ORDER BY ST_DISTANCE(f.punto, ST_GEOGPOINT(v.longitud, v.latitud)) LIMIT 1)[OFFSET(0)] AS provincia
    FROM fuera_de_caba AS f
    CROSS JOIN sucursales_base AS v
    WHERE v.provincia != "AR-C"
        AND v.latitud IS NOT NULL
        AND v.longitud IS NOT NULL
        AND ST_DWITHIN(f.punto, ST_GEOGPOINT(v.longitud, v.latitud), 50000)
    GROUP BY f.id_comercio, f.id_sucursal
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
        -- En CABA la localidad es el barrio por coordenadas, siempre que caiga
        -- en uno (2026-10-29). Antes solo se reemplazaban los nombres genericos,
        -- comparados con una lista: el 28-10 la lista no veia "Autónoma" con
        -- tilde y 360 sucursales de Carrefour quedaban sin barrio, y despues de
        -- arreglarlo quedaban 23 en 11 nombres que no son barrios ("Paternal",
        -- "Once", "Pompeya", "V Illa Lugano", "Cdad. De Bs.As"), cada uno una
        -- localidad aparte en Tu canasta. Una sucursal de CABA que no cae en
        -- ningun barrio esta mal cargada: provincia_corregida le busca la suya
        -- y conserva el nombre de la fuente.
        IF(sb.provincia = "AR-C", COALESCE(barrio_geo.barrio_calculado, sb.localidad), sb.localidad) AS localidad_cruda,
        COALESCE(pc.provincia, sb.provincia) AS provincia,
        sb.codigo_postal,
        sb.latitud,
        sb.longitud
    FROM sucursales_base AS sb
    LEFT JOIN {{ ref("stg_sucursales_barrio") }} AS barrio_geo
        ON sb.id_comercio = barrio_geo.id_comercio
        AND sb.id_sucursal = barrio_geo.id_sucursal
    LEFT JOIN provincia_corregida AS pc
        ON sb.id_comercio = pc.id_comercio
        AND sb.id_sucursal = pc.id_sucursal
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
