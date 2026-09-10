{{ config(materialized="view") }}

-- Las promos que se muestran: las que pasan su nivel de evidencia.
--
--   leyenda        se muestran siempre: la cadena declara el % y coincide.
--   mercado        se muestran si el precio promo no queda por debajo del piso
--                  calibrado frente al mismo producto en otra empresa.
--   sin_verificar  se muestran si el descuento no supera el techo calibrado.
--   leyenda_no_coincide  no se muestran.
--
-- El minimo de 10% se mantiene: por debajo no es una promo que valga destacar.
--
-- Es una vista y no una tabla: los dos marts de promos la leen, y materializarla
-- duplicaria en almacenamiento lo que ya guarda mart_promos_evidencia.

WITH umbrales AS (
    SELECT
        fecha_datos,
        IF(
            promos_verificadas_con_mercado >= {{ var("promos_muestra_minima") }},
            piso_cociente_mercado,
            {{ var("promos_piso_cociente_respaldo") }}
        ) AS piso_cociente_mercado,
        IF(
            promos_verificadas >= {{ var("promos_muestra_minima") }},
            techo_descuento_sin_verificar,
            {{ var("promos_techo_descuento_respaldo") }}
        ) AS techo_descuento_sin_verificar
    FROM {{ ref("mart_promos_calibracion") }}
)

SELECT
    e.*,
    u.piso_cociente_mercado,
    u.techo_descuento_sin_verificar
FROM {{ ref("mart_promos_evidencia") }} AS e
JOIN umbrales AS u USING (fecha_datos)
WHERE e.descuento_pct >= 10
    AND CASE e.nivel_evidencia
        WHEN "leyenda" THEN TRUE
        WHEN "mercado" THEN e.cociente_mercado >= u.piso_cociente_mercado
        WHEN "sin_verificar" THEN e.descuento_pct <= u.techo_descuento_sin_verificar
        ELSE FALSE
    END
