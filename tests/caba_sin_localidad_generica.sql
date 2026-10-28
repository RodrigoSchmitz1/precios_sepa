-- Ninguna sucursal de CABA que cae dentro de un barrio puede quedar con una
-- localidad generica ("Ciudad Autonoma de Buenos Aires", "Capital Federal").
--
-- El 2026-10-28 habia 360: todas las de Carrefour, Market, Express y Maxi en la
-- ciudad. La lista de nombres genericos se comparaba sin normalizar tildes y
-- Carrefour escribe "Autónoma". Quedaban fuera de todos los barrios, asi que
-- quien elegia Palermo en Tu canasta no veia ninguna cadena de Carrefour, y
-- ningun test lo notaba porque cada sucursal tenia una localidad no nula.
--
-- Se compara normalizado, igual que el modelo, para que una grafia nueva
-- tampoco se escape. Lee dos tablas chicas de staging.

SELECT s.id_comercio, s.id_sucursal, s.localidad, b.barrio_calculado
FROM {{ ref("stg_sucursales") }} AS s
JOIN {{ ref("stg_sucursales_barrio") }} AS b
    USING (id_comercio, id_sucursal)
WHERE b.barrio_calculado IS NOT NULL
    AND REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(s.localidad, NFD), r"\p{Mn}", "") IN (
        "capital federal", "ciudad autonoma de buenos aires",
        "ciudad autonoma buenos aires", "ciudad autonoma de bs as", "caba"
    )
