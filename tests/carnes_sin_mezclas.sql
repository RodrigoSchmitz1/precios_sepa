-- "Carne vacuna" tiene que ser carne vacuna y "Pollo" tiene que ser pollo.
--
-- Hasta el 2026-09-10 no lo eran. La taxonomia no tenia categoria para el cerdo
-- y la clasificacion lo mandaba a Carne vacuna, junto con achuras, cordero y
-- milanesas; Pollo mezclaba presas con nuggets, patitas y rebozados. Medido con
-- estos mismos marcadores sobre la clasificacion vieja: 17,8% de los productos de
-- Carne vacuna mencionaban cerdo, y el 28% de los de Pollo eran elaborados. La
-- canasta comparaba una carne abaratada por el cerdo y las achuras contra un
-- pollo encarecido por los rebozados.
--
-- Se vigila con marcadores de texto porque la clasificacion la hace un modelo de
-- lenguaje, y un cambio de modelo o de prompt puede degradarla sin que ninguna
-- corrida falle. Los marcadores son inequivocos a proposito (CERDO, NUGGET,
-- REBOZADO): una "riñonada" o un "medallon de lomo" son cortes vacunos y no
-- deben marcar. El 2% tolera los casos ambiguos que quedan y falla con holgura
-- ante una mezcla como la que habia.

WITH marcadores AS (
    SELECT
        categoria,
        COUNT(*) AS productos,
        COUNTIF(REGEXP_CONTAINS(
            UPPER(descripcion),
            r"CERDO|PORCIN|BONDIOLA|CORDERO|OVINO|CHIVITO|CABRITO|\bPOLLO\b|PECHUGA|SUPREMA"
        )) AS ajenos_en_vacuna,
        COUNTIF(REGEXP_CONTAINS(
            UPPER(descripcion),
            r"NUGGET|HAMBURGUES|REBOZAD|BOCADITO|FORMITA|CHICKEN FINGER|PATITAS|CERDO|VACUN|NOVILL"
        )) AS ajenos_en_pollo
    FROM {{ ref("stg_categorias") }}
    WHERE categoria IN ("Carne vacuna", "Pollo")
    GROUP BY categoria
)

SELECT
    categoria,
    productos,
    IF(categoria = "Carne vacuna", ajenos_en_vacuna, ajenos_en_pollo) AS con_marcadores_ajenos
FROM marcadores
WHERE IF(categoria = "Carne vacuna", ajenos_en_vacuna, ajenos_en_pollo) > 0.02 * productos
