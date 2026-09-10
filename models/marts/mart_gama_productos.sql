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
-- POR QUE EL GRANO ES PRODUCTO x UNIDAD Y NO PRODUCTO (corregido 2026-09-10):
-- el modelo asumia que un producto tiene una sola unidad y tomaba
-- ANY_VALUE(unidad_normalizada). Ese supuesto dejo de valer el 2026-09-09,
-- cuando stg_productos empezo a reconocer EA ("each"): desde entonces el mismo
-- producto puede venir como "380 GR" en una cadena y como "1 EA" en otra.
-- Medido sobre el 2026-09-08: el 13,3% de los productos tiene mas de una
-- unidad, y esos productos son el 50,2% de las filas.
--
-- El efecto era perverso. "GDS MILA CYQ 380GR" (milanesas) quedaba con unidad
-- "unidad" pero con el precio dividido por los 380 gramos de la mediana de
-- cantidades, que mezclaba gramos con conteos: $20,57 "por unidad", baratisimo
-- entre los productos por unidad, asi que caia en ECONOMICO. Despues sus filas
-- en gramos entraban a la canasta de Pollo como pollo economico a $20.566/kg.
-- Resultado publicado: el pollo de la canasta costaba $18.323/kg, mas que la
-- carne vacuna, cuando el pollo economico con la gama bien calculada ronda los
-- $7.900/kg. Lo mismo inflaba Pan y Papa, que juntos pesan 43% de la canasta.
--
-- Con este grano cada fila de precio se clasifica con la gama de SU unidad, y
-- los modelos que consumen esta tabla la unen por producto y unidad.
--
-- Se restringe a productos con cantidad medible, con el mismo rango de sanidad
-- que aplican los tres modelos que consumen esta tabla. No cuesta cobertura:
-- esos modelos ya descartaban por su cuenta los productos sin cantidad.

WITH precio_por_producto AS (
    -- Precio representativo de cada producto EN CADA UNIDAD en que se vende: la
    -- mediana entre todas las cadenas, sucursales y dias disponibles.
    SELECT
        id_producto,
        unidad_normalizada,
        APPROX_QUANTILES(precio, 2)[OFFSET(1)] AS precio_mediano,
        -- La mediana del precio por unidad de cada fila, y no el cociente entre
        -- la mediana de precios y la de cantidades: si dos cadenas informan el
        -- envase distinto, el cociente de medianas combina el precio de una con
        -- la cantidad de otra. Es la misma cuenta que hacen, fila por fila, los
        -- modelos que consumen esta tabla.
        APPROX_QUANTILES(precio / cantidad_normalizada, 2)[OFFSET(1)] AS precio_por_unidad
    FROM {{ ref('stg_productos') }}
    WHERE cantidad_normalizada IS NOT NULL
        AND (
            (unidad_normalizada IN ('g', 'cc') AND cantidad_normalizada BETWEEN 5 AND 10000)
            OR (unidad_normalizada = 'unidad' AND cantidad_normalizada BETWEEN 1 AND 60)
        )
    GROUP BY id_producto, unidad_normalizada
),

producto_con_categoria AS (
    -- Le sumamos la categoria y el rubro de cada producto.
    SELECT
        p.id_producto,
        p.precio_mediano,
        p.unidad_normalizada,
        p.precio_por_unidad,
        c.categoria,
        c.rubro
    FROM precio_por_producto AS p
    INNER JOIN {{ ref('stg_categorias') }} AS c
        ON p.id_producto = c.id_producto
    -- Excluimos productos sin categoria util: no tiene sentido darles gama.
    -- No hace falta filtrar cantidades en cero: el rango de sanidad de arriba
    -- ya exige al menos 1.
    WHERE c.categoria NOT IN ('Otros')
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
