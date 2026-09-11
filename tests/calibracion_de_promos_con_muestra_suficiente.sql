{{ config(severity="warn") }}

-- Avisa, sin frenar la corrida, si un dia tuvo pocas promos verificadas por
-- leyenda.
--
-- Un dia normal tiene cientos de miles (el 2026-09-09: 965.175 verificadas, 805.041
-- con el producto en otra empresa). Una caida asi casi siempre significa que algo
-- se rompio en la carga o en la leyenda de alguna cadena.

SELECT
    fecha_datos,
    promos_verificadas,
    promos_verificadas_con_mercado
FROM {{ ref("mart_promos_calibracion") }}
WHERE promos_verificadas < {{ var("promos_muestra_minima") }}
    OR promos_verificadas_con_mercado < {{ var("promos_muestra_minima") }}
