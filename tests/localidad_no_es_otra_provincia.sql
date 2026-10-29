{{ config(severity="warn") }}

-- Una localidad no puede llevar el nombre de OTRA provincia: "Córdoba" en
-- Mendoza, "Capital Federal" en Buenos Aires.
--
-- El 2026-10-29 habia 12: "Córdoba" en Mendoza, "CAPITAL FEDERAL" en Tigre,
-- seis Dia de Jujuy con el codigo de San Juan, Maxi de Santa Rosa y Neuquen
-- como Buenos Aires. stg_sucursales ahora corrige la provincia por coordenadas
-- (y la localidad, si nombra otra provincia). Avisa sin cortar la corrida: lo
-- que quede es un dato de la fuente que no se pudo deducir.
--
-- Lee una tabla chica de staging.

SELECT s.id_comercio, s.id_sucursal, s.localidad, s.provincia, n.provincia AS provincia_del_nombre
FROM {{ ref("stg_sucursales") }} AS s
JOIN {{ nombres_de_provincia() }} AS n
    ON REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(s.localidad, NFD), r"\p{Mn}", "") = n.nombre
WHERE s.provincia != n.provincia
