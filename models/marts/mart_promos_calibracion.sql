-- Colas de las promos verificadas por leyenda, una fila por fecha. Sirve para
-- vigilar y no decide que se muestra: promos_validas usa umbrales fijos porque
-- estas colas cambian de un dia a otro (ver dbt_project.yml).
--
-- piso_cociente_mercado: percentil 0,1 de precio_promo / lista mas barata del
--   mismo producto en otra empresa. 2026-09-09: 0,519; 09-10: 0,339.
-- techo_descuento_sin_verificar: percentil 99,9 del descuento. 09-09: 50; 09-10: 74,3.
-- descuento_maximo_verificado: el descuento mas alto. 09-09: 70; 09-10: 80,2.

SELECT
    fecha_datos,
    COUNTIF(nivel_evidencia = "leyenda") AS promos_verificadas,
    COUNTIF(nivel_evidencia = "leyenda" AND cociente_mercado IS NOT NULL) AS promos_verificadas_con_mercado,
    APPROX_QUANTILES(
        IF(nivel_evidencia = "leyenda", cociente_mercado, NULL), 1000 IGNORE NULLS
    )[SAFE_OFFSET(1)] AS piso_cociente_mercado,
    APPROX_QUANTILES(
        IF(nivel_evidencia = "leyenda", descuento_pct, NULL), 1000 IGNORE NULLS
    )[SAFE_OFFSET(999)] AS techo_descuento_sin_verificar,
    MAX(IF(nivel_evidencia = "leyenda", descuento_pct, NULL)) AS descuento_maximo_verificado
FROM {{ ref("mart_promos_evidencia") }}
GROUP BY fecha_datos
