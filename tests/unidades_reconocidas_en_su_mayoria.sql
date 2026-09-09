-- Vigila que el mapeo de unidades de stg_productos siga cubriendo el catalogo.
--
-- Es el test que hubiera evitado el problema encontrado el 2026-09-09: la
-- fuente traia "EA" (el codigo GS1 de "each") en el 16,4% de los productos y el
-- CASE no lo contemplaba, asi que caian en unidad_normalizada = NULL. Como
-- todos los modelos que necesitan cantidad descartan las filas sin unidad, ese
-- 18,4% del catalogo quedaba fuera de la gama, de la canasta y del indice de
-- precios SIN QUE NADA FALLARA. Un dato que se pierde en silencio es peor que
-- uno que rompe la corrida.
--
-- Con el mapeo corregido el residuo es 0,18% de las filas: lo que queda son
-- unidades de largo y superficie (M, M2, MTR) y ambiguas (PAR, CJ, PIE), que no
-- se pueden convertir a masa, volumen ni conteo sin inventar.
--
-- El umbral de 2% deja margen de sobra sobre ese 0,18% y sigue siendo mucho
-- menor que cualquier unidad nueva que aparezca con volumen real.

WITH cobertura AS (
    SELECT
        COUNTIF(unidad_normalizada IS NULL) / COUNT(*) AS proporcion_sin_unidad
    FROM {{ ref('stg_productos') }}
)

SELECT proporcion_sin_unidad
FROM cobertura
WHERE proporcion_sin_unidad > 0.02
