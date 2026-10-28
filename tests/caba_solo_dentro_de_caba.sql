{{ config(severity="warn") }}

-- Una sucursal que queda con la provincia de CABA tiene que estar en CABA: sus
-- coordenadas tienen que caer en algun barrio.
--
-- El 2026-10-28 habia 34 que no: Carrefour las informaba como AR-C y estaban en
-- Cordoba, Mendoza, Chubut y el conurbano. stg_sucursales ahora les asigna la
-- provincia de la sucursal mas cercana de otra provincia (hasta 50 km). Este
-- test avisa si aparece una que no se pudo corregir, sin cortar la corrida: es
-- un dato mal cargado de la fuente, no un error del modelo.
--
-- Lee dos tablas chicas de staging.

SELECT s.id_comercio, s.id_sucursal, s.localidad, s.latitud, s.longitud
FROM {{ ref("stg_sucursales") }} AS s
JOIN {{ ref("stg_sucursales_barrio") }} AS b
    USING (id_comercio, id_sucursal)
WHERE s.provincia = "AR-C"
    AND b.barrio_calculado IS NULL
