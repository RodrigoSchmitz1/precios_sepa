{{ config(materialized="view") }}

-- Las promos que se muestran: las que pasan su nivel de evidencia, con los
-- umbrales fijos de dbt_project.yml (ahi esta por que no se recalculan a diario).
--
--   leyenda        siempre: la cadena declara el % y coincide.
--   mercado        si el precio promo no queda por debajo del piso frente al
--                  mismo producto en otra empresa, y el descuento no supera el
--                  maximo: el mercado respalda el precio promo, no la lista propia.
--   sin_verificar  si el descuento no supera el techo.
--
-- El minimo de 10% se mantiene: por debajo no es una promo que valga destacar.
-- Es una vista: materializarla duplicaria lo que ya guarda mart_promos_evidencia.

SELECT *
FROM {{ ref("mart_promos_evidencia") }}
WHERE descuento_pct >= 10
    AND CASE nivel_evidencia
        WHEN "leyenda" THEN TRUE
        WHEN "mercado" THEN cociente_mercado >= {{ var("promos_piso_cociente_mercado") }}
            AND descuento_pct <= {{ var("promos_descuento_maximo_mercado") }}
        WHEN "sin_verificar" THEN descuento_pct <= {{ var("promos_techo_descuento_sin_verificar") }}
        ELSE FALSE
    END
