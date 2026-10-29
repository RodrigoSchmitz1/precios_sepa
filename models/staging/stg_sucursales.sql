WITH sucursales_base AS (
    {{ limpiar_sucursales(source("sepa", "sucursales")) }}
),

-- PROVINCIA MAL CARGADA (2026-10-28, generalizado el 2026-10-29). La provincia
-- que informa la cadena no siempre es la de la sucursal, y las coordenadas lo
-- delatan:
--   - 34 venian como CABA (AR-C) y no caen en ningun barrio: 20 en la ciudad
--     de Cordoba, una en Mendoza, otras en el conurbano y en Chubut.
--   - 6 de Dia en Jujuy venian con el codigo de San Juan (AR-J), una Maxi de
--     Jujuy como Salta, y las Maxi de Santa Rosa y de Neuquen como Buenos
--     Aires: la localidad nombra otra provincia.
--   - Una de Dia en Palermo traia "Buenos Aires" en vez de un codigo.
-- Una sospechosa toma la provincia de la sucursal no sospechosa mas cercana,
-- si esta a menos de 50 km (prefiriendo la provincia que nombra su localidad,
-- si nombra una); si no hay ninguna, se deja la cargada, porque no hay con que
-- deducirla. Una que cae dentro de un barrio de CABA es de CABA.
sospechosas AS (
    SELECT
        sb.id_comercio,
        sb.id_sucursal,
        ST_GEOGPOINT(sb.longitud, sb.latitud) AS punto,
        -- La provincia que nombra la localidad, si nombra una distinta de la
        -- cargada ("JUJUY" en una Dia cargada como San Juan). Manda sobre las
        -- vecinas: las otras Dia de Jujuy son sospechosas tambien, y la vecina
        -- limpia mas cercana de una de Perico estaba en Salta.
        IF(n.provincia != sb.provincia, n.provincia, NULL) AS provincia_nombrada
    FROM sucursales_base AS sb
    LEFT JOIN {{ ref("stg_sucursales_barrio") }} AS b
        ON sb.id_comercio = b.id_comercio
        AND sb.id_sucursal = b.id_sucursal
    LEFT JOIN {{ nombres_de_provincia() }} AS n
        ON n.nombre = REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(sb.localidad, NFD), r"\p{Mn}", "")
    WHERE sb.latitud IS NOT NULL
        AND sb.longitud IS NOT NULL
        AND b.barrio_calculado IS NULL
        AND (
            sb.provincia = "AR-C"
            OR NOT REGEXP_CONTAINS(sb.provincia, r"^AR-[A-Z]$")
            OR n.provincia != sb.provincia
        )
),

provincia_corregida AS (
    SELECT
        f.id_comercio,
        f.id_sucursal,
        ARRAY_AGG(
            STRUCT(v.provincia, v.localidad)
            -- Primero las de la provincia que nombra la localidad, si hay alguna
            -- a menos de 50 km; si no, manda la coordenada (la Express de
            -- Mendoza que dice "Córdoba" no tiene ninguna de Cordoba cerca).
            ORDER BY IF(v.provincia = f.provincia_nombrada, 0, 1),
                ST_DISTANCE(f.punto, ST_GEOGPOINT(v.longitud, v.latitud))
            LIMIT 1
        )[OFFSET(0)] AS cercana
    FROM sospechosas AS f
    CROSS JOIN sucursales_base AS v
    LEFT JOIN sospechosas AS otra
        ON v.id_comercio = otra.id_comercio
        AND v.id_sucursal = otra.id_sucursal
    WHERE otra.id_sucursal IS NULL
        AND v.provincia != "AR-C"
        AND REGEXP_CONTAINS(v.provincia, r"^AR-[A-Z]$")
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
        -- localidad aparte en Tu canasta.
        CASE
            WHEN barrio_geo.barrio_calculado IS NOT NULL THEN barrio_geo.barrio_calculado
            -- Una sospechosa toma la localidad de la sucursal mas cercana si la
            -- suya no dice donde esta: un nombre de provincia o un generico
            -- (2026-10-29). La Express de San Juan 1128, en Mendoza, venia como
            -- "Córdoba"; Carrefour usa "Córdoba" para Jesus Maria, Alta Gracia
            -- o Carlos Paz; Dia, "JUJUY" para toda la provincia. Un nombre
            -- propio ("Laferrere") se conserva: la mas cercana podia ser un
            -- generico como "BUENOS AIRES". El mismo nombre escrito distinto
            -- ("San Luis" y "SAN LUIS") tampoco se reemplaza: solo cambiaria la
            -- grafia que gana en forma_canonica.
            WHEN pc.cercana IS NOT NULL
                AND REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(sb.localidad, NFD), r"\p{Mn}", "")
                    IN (SELECT nombre FROM {{ nombres_de_provincia() }})
                AND REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(sb.localidad, NFD), r"\p{Mn}", "")
                    != REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(pc.cercana.localidad, NFD), r"\p{Mn}", "")
                THEN pc.cercana.localidad
            ELSE sb.localidad
        END AS localidad_cruda,
        CASE
            WHEN barrio_geo.barrio_calculado IS NOT NULL THEN "AR-C"
            ELSE COALESCE(pc.cercana.provincia, sb.provincia)
        END AS provincia,
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
