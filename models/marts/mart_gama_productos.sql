-- Gama de cada producto (economico / medio / premium) segun el tercil de su
-- PRECIO POR UNIDAD DE MEDIDA dentro de su categoria y unidad.
-- El precio mediano (entre cadenas, sucursales y dias) hace la gama estable:
-- una promo puntual no mueve al producto de gama. Medido: entre dos dias solo
-- el 1,5% de los productos cambia de tercil, con flujos balanceados.
--
-- POR QUE POR UNIDAD Y NO POR PRECIO DE PAQUETE (corregido 2026-09-09):
-- antes el tercil se calculaba sobre el precio de lista del envase, asi que en
-- las categorias donde los tamanos varian mucho terminaba ordenando por TAMANO
-- DE ENVASE y no por nivel de precio. La bolsa grande, que es la mas barata por
-- kilo, caia en "premium" por tener el precio de paquete mas alto.
--
-- Medido sobre 47 categorias con envase medible: en 4 el "economico" resultaba
-- MAS CARO por unidad que el "premium", y en 14 no se cumplia el orden
-- economico < medio < premium. El caso extremo era Alimento para mascotas, con
-- economico a $17,65 por unidad contra premium a $5,02: 3,5 veces mas caro.
-- Dos de las invertidas, Otros condimentos y Jugos, estan en la canasta basica,
-- asi que el filtro gama="economico" que usa esa canasta estaba encareciendola
-- justo donde pretendia abaratarla.
--
-- Se particiona tambien por unidad_normalizada: no tiene sentido ordenar un
-- precio por gramo contra uno por centimetro cubico o por unidad.
--
-- Se restringe a productos con cantidad medible, con el mismo rango de sanidad
-- que aplican los tres modelos que consumen esta tabla. No cuesta cobertura:
-- esos modelos ya descartaban por su cuenta los productos sin cantidad.

WITH precio_por_producto AS (
    -- Precio y tamano representativos de cada producto: la mediana entre todas
    -- las cadenas, sucursales y dias disponibles.
    SELECT
        id_producto,
        APPROX_QUANTILES(precio, 2)[OFFSET(1)] AS precio_mediano,
        APPROX_QUANTILES(cantidad_normalizada, 2)[OFFSET(1)] AS cantidad_mediana,
        -- Un producto tiene una sola unidad; se toma una cualquiera de sus
        -- filas para no romper el grano de una fila por id_producto.
        ANY_VALUE(unidad_normalizada) AS unidad_normalizada
    FROM {{ ref('stg_productos') }}
    WHERE cantidad_normalizada IS NOT NULL
        AND (
            (unidad_normalizada IN ('g', 'cc') AND cantidad_normalizada BETWEEN 5 AND 10000)
            OR (unidad_normalizada = 'unidad' AND cantidad_normalizada BETWEEN 1 AND 60)
        )
    GROUP BY id_producto
),

producto_con_categoria AS (
    -- Le sumamos la categoria y el rubro de cada producto.
    SELECT
        p.id_producto,
        p.precio_mediano,
        p.cantidad_mediana,
        p.unidad_normalizada,
        p.precio_mediano / p.cantidad_mediana AS precio_por_unidad,
        c.categoria,
        c.rubro
    FROM precio_por_producto AS p
    INNER JOIN {{ ref('stg_categorias') }} AS c
        ON p.id_producto = c.id_producto
    -- Excluimos productos sin categoria util: no tiene sentido darles gama.
    WHERE c.categoria NOT IN ('Otros')
        AND p.cantidad_mediana > 0
),

con_gama AS (
    -- Tercil de precio por unidad dentro de cada categoria y unidad de medida:
    -- 1=economico, 2=medio, 3=premium.
    SELECT
        id_producto,
        categoria,
        rubro,
        precio_mediano,
        precio_por_unidad,
        unidad_normalizada,
        NTILE(3) OVER (
            PARTITION BY categoria, unidad_normalizada
            ORDER BY precio_por_unidad
        ) AS tercil
    FROM producto_con_categoria
)

SELECT
    id_producto,
    categoria,
    rubro,
    precio_mediano,
    precio_por_unidad,
    unidad_normalizada,
    CASE tercil
        WHEN 1 THEN 'economico'
        WHEN 2 THEN 'medio'
        WHEN 3 THEN 'premium'
    END AS gama
FROM con_gama
