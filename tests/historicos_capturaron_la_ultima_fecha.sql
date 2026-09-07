-- Falla si la fecha mas reciente que hay en los marts no llego a alguno de
-- los historicos.
--
-- Este es el modo de falla que dejo huecos en la historia durante semanas: la
-- ingesta no corria (maquina apagada, portal caido) o dbt fallaba, y nadie se
-- enteraba porque el sitio seguia mostrando la ultima foto disponible. Como el
-- crudo retiene 3 dias, cada dia que pasaba sin detectarlo acercaba esa fecha
-- a volverse irrecuperable.

WITH ultima_disponible AS (
    SELECT MAX(fecha_datos) AS fecha FROM {{ ref("mart_quien_gana") }}
),

faltantes AS (
    SELECT "historico_quien_gana" AS historico, u.fecha
    FROM ultima_disponible u
    WHERE NOT EXISTS (
        SELECT 1 FROM {{ ref("historico_quien_gana") }} h
        WHERE h.fecha_datos = u.fecha
    )

    UNION ALL

    SELECT "historico_precios_cadena_categoria", u.fecha
    FROM ultima_disponible u
    WHERE NOT EXISTS (
        SELECT 1 FROM {{ ref("historico_precios_cadena_categoria") }} h
        WHERE h.fecha_datos = u.fecha
    )

    UNION ALL

    SELECT "historico_canasta_localidad", u.fecha
    FROM ultima_disponible u
    WHERE NOT EXISTS (
        SELECT 1 FROM {{ ref("historico_canasta_localidad") }} h
        WHERE h.fecha_datos = u.fecha
    )
)

SELECT * FROM faltantes
