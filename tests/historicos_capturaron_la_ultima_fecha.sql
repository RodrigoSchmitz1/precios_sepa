-- Falla si la fecha mas reciente que hay en los marts no llego a alguno de
-- los historicos.
--
-- Este es el modo de falla que dejo huecos en la historia durante semanas: la
-- ingesta no corria (maquina apagada, portal caido) o dbt fallaba, y nadie se
-- enteraba porque el sitio seguia mostrando la ultima foto disponible. Como el
-- crudo retiene 3 dias, cada dia que pasaba sin detectarlo acercaba esa fecha
-- a volverse irrecuperable.
--
-- OJO CON LO QUE ESTE TEST NO VE
-- Compara contra "la ultima fecha disponible", que sale de los propios marts.
-- Eso alcanza para detectar que dbt no capturo algo que si estaba, pero NO para
-- detectar que no llego nada nuevo: si la ingesta se detiene, los marts dejan
-- de avanzar y la ultima disponible envejece con ellos, asi que la comparacion
-- sigue dando bien. Paso en septiembre de 2026: cinco dias sin ingesta y este
-- test verde todo el tiempo. Esa mitad la cubre crudo_al_dia, que se compara
-- contra el calendario.

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
