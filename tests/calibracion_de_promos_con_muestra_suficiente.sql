{{ config(severity="warn") }}

-- Avisa, sin frenar la corrida, si un dia no tuvo suficientes promos verificadas
-- para calibrar los umbrales.
--
-- Un dia normal tiene cientos de miles (el 2026-09-09: 965.175 verificadas por
-- leyenda, 805.041 con el producto en otra empresa). Si caen por debajo del
-- minimo, promos_validas usa los valores de respaldo de dbt_project.yml y la
-- corrida sigue: no mostrar promos por un problema de calibracion seria peor que
-- usar los umbrales de un dia normal. Pero conviene enterarse, porque una caida
-- asi casi siempre significa que algo se rompio en la carga o en la leyenda de
-- alguna cadena.

SELECT
    fecha_datos,
    promos_verificadas,
    promos_verificadas_con_mercado
FROM {{ ref("mart_promos_calibracion") }}
WHERE promos_verificadas < {{ var("promos_muestra_minima") }}
    OR promos_verificadas_con_mercado < {{ var("promos_muestra_minima") }}
