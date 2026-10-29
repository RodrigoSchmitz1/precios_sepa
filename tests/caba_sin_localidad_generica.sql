-- Una sucursal de CABA que cae dentro de un barrio tiene que tener ese barrio
-- como localidad: ni un nombre generico ("Ciudad Autonoma de Buenos Aires",
-- "Capital Federal") ni uno que no es barrio ("Paternal", "Once", "V Illa
-- Lugano"; 23 sucursales el 2026-10-29), porque cada nombre distinto es una
-- localidad aparte en Tu canasta.
--
-- El 2026-10-28 habia 360: todas las de Carrefour, Market, Express y Maxi en la
-- ciudad. La lista de nombres genericos se comparaba sin normalizar tildes y
-- Carrefour escribe "Autónoma". Quedaban fuera de todos los barrios, asi que
-- quien elegia Palermo en Tu canasta no veia ninguna cadena de Carrefour, y
-- ningun test lo notaba porque cada sucursal tenia una localidad no nula.
--
-- Se compara sin mayusculas ni tildes: la forma visible la elige
-- forma_canonica entre las grafias del mismo nombre. Lee dos tablas chicas de
-- staging.

SELECT s.id_comercio, s.id_sucursal, s.localidad, b.barrio_calculado
FROM {{ ref("stg_sucursales") }} AS s
JOIN {{ ref("stg_sucursales_barrio") }} AS b
    USING (id_comercio, id_sucursal)
WHERE s.provincia = "AR-C"
    AND b.barrio_calculado IS NOT NULL
    AND REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(s.localidad, NFD), r"\p{Mn}", "")
        != REGEXP_REPLACE(NORMALIZE_AND_CASEFOLD(b.barrio_calculado, NFD), r"\p{Mn}", "")
