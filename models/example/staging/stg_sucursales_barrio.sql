-- Clasifica cada sucursal de CABA en su barrio real usando geometria
-- (point-in-polygon), en vez de depender del texto de localidad que
-- reporta cada cadena -- que en CABA es inconsistente: algunas cadenas
-- reportan el barrio real (Belgrano, Caballito), otras agrupan todo
-- bajo "Capital Federal" generico, perdiendo la granularidad de barrio.
-- Fuente de los poligonos: datos abiertos GCBA (ver
-- orquestacion/scripts/descargar_barrios_caba.py).
-- IMPORTANTE: lee directo de la macro limpiar_sucursales (no de
-- stg_sucursales), porque stg_sucursales depende de este modelo para
-- corregir la localidad -- depender de stg_sucursales creo un ciclo.

WITH sucursales_base AS (
    {{ limpiar_sucursales(source("sepa", "sucursales")) }}
),

barrios AS (
    SELECT
        barrio,
        ST_GEOGFROMTEXT(geometria_wkt) AS geometria
    FROM {{ source("sepa", "barrios_caba") }}
),

sucursales_caba AS (
    SELECT
        id_comercio,
        id_sucursal,
        latitud,
        longitud
    FROM sucursales_base
    WHERE provincia = "AR-C"
        AND latitud IS NOT NULL
        AND longitud IS NOT NULL
)

SELECT
    s.id_comercio,
    s.id_sucursal,
    b.barrio AS barrio_calculado
FROM sucursales_caba AS s
LEFT JOIN barrios AS b
    ON ST_CONTAINS(b.geometria, ST_GEOGPOINT(s.longitud, s.latitud))
