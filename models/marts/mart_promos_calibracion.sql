-- Umbrales del dia para validar promos, calculados con las promos cuya propia
-- leyenda confirma el descuento. Una fila por fecha.
--
-- Los umbrales no se eligen a mano: salen de lo que hacen las promos reales ese
-- mismo dia.
--
-- piso_cociente_mercado: percentil 0,1 de precio_promo / lista mas barata del
--   mismo producto en otra empresa, entre las verificadas. Una promo que queda
--   mas abajo es mas agresiva que el 99,9% de las promos que la cadena respalda
--   con su leyenda. Medido el 2026-09-09: 0,519.
--
-- techo_descuento_sin_verificar: percentil 99,9 del descuento de las
--   verificadas. Una promo que no se puede contrastar con nada no puede
--   prometer mas que el 99,9% de las que si se pueden. Medido el 2026-09-09: 50%.
--
-- Se guarda una fila por dia para poder auditar con que umbral se decidio. Si la
-- muestra del dia es chica, promos_validas usa los valores de respaldo de
-- dbt_project.yml, y el test calibracion_de_promos_con_muestra_suficiente avisa.

SELECT
    fecha_datos,
    COUNTIF(nivel_evidencia = "leyenda") AS promos_verificadas,
    COUNTIF(nivel_evidencia = "leyenda" AND cociente_mercado IS NOT NULL) AS promos_verificadas_con_mercado,
    APPROX_QUANTILES(
        IF(nivel_evidencia = "leyenda", cociente_mercado, NULL), 1000 IGNORE NULLS
    )[SAFE_OFFSET(1)] AS piso_cociente_mercado,
    APPROX_QUANTILES(
        IF(nivel_evidencia = "leyenda", descuento_pct, NULL), 1000 IGNORE NULLS
    )[SAFE_OFFSET(999)] AS techo_descuento_sin_verificar
FROM {{ ref("mart_promos_evidencia") }}
GROUP BY fecha_datos
