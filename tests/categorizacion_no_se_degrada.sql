-- Vigila las dos formas en que la categorizacion puede degradarse EN SILENCIO,
-- sin que ninguna corrida falle.
--
-- 1. Todo a "Otros". categorizar.py valida la respuesta del modelo contra la
--    lista de categorias y, si no reconoce la que devolvio, la convierte en
--    "Otros". Es lo correcto, pero hace que una degradacion del modelo (que
--    empiece a devolver nombres con otra grafia, o basura) se vea igual que un
--    producto que genuinamente no encaja. Sin este test, el catalogo se iria
--    vaciando de categorias utiles sin que nada avise.
--    Medido el 2026-09-09: 2,15%. El umbral de 8% deja margen de sobra.
--
-- 2. Productos sin categorizar acumulandose. Un producto sin categoria
--    desaparece de la canasta, de la gama y de "quien gana", porque todos
--    hacen JOIN contra stg_categorias. La categorizacion es incremental y se
--    recupera sola en la corrida siguiente, asi que un backlog chico es normal;
--    uno que crece significa que el paso de Gemini viene fallando.
--    Medido el 2026-09-09: 0,15%. El umbral de 5% distingue el atraso normal de
--    un problema real.

WITH otros AS (
    SELECT
        "demasiados productos en Otros" AS problema,
        COUNTIF(categoria = "Otros") / COUNT(*) AS proporcion
    FROM {{ ref("stg_categorias") }}
),

sin_categoria AS (
    SELECT
        "demasiados productos sin categorizar" AS problema,
        COUNTIF(c.id_producto IS NULL) / COUNT(*) AS proporcion
    FROM (
        SELECT DISTINCT id_producto FROM {{ ref("stg_productos") }}
    ) AS p
    LEFT JOIN {{ ref("stg_categorias") }} AS c USING (id_producto)
)

SELECT problema, proporcion FROM otros WHERE proporcion > 0.08
UNION ALL
SELECT problema, proporcion FROM sin_categoria WHERE proporcion > 0.05
