WITH sucursales_base AS (
    {{ limpiar_sucursales(source("sepa", "sucursales")) }}
)

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
    END AS localidad,
    sb.provincia,
    sb.codigo_postal,
    sb.latitud,
    sb.longitud
FROM sucursales_base AS sb
LEFT JOIN {{ ref("stg_sucursales_barrio") }} AS barrio_geo
    ON sb.id_comercio = barrio_geo.id_comercio
    AND sb.id_sucursal = barrio_geo.id_sucursal
