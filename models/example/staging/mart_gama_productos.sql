-- Gama de cada producto (económico / medio / premium) según el tercil
-- de su precio mediano DENTRO de su categoría.
-- El precio mediano (entre cadenas, sucursales y días) hace la gama estable:
-- una promo puntual no mueve al producto de gama.

WITH precio_por_producto AS (
    -- Precio representativo de cada producto: la mediana de su precio de lista
    -- entre todas las cadenas, sucursales y días disponibles.
    SELECT
        id_producto,
        APPROX_QUANTILES(precio, 2)[OFFSET(1)] AS precio_mediano
    FROM {{ ref('stg_productos') }}
    GROUP BY id_producto
),

producto_con_categoria AS (
    -- Le sumamos la categoría y el rubro de cada producto.
    SELECT
        p.id_producto,
        p.precio_mediano,
        c.categoria,
        c.rubro
    FROM precio_por_producto AS p
    INNER JOIN {{ ref('stg_categorias') }} AS c
        ON p.id_producto = c.id_producto
    -- Excluimos productos sin categoría útil: no tiene sentido darles gama.
    WHERE c.categoria NOT IN ('Otros')
),

con_gama AS (
    -- Tercil de precio dentro de cada categoría: 1=económico, 2=medio, 3=premium.
    SELECT
        id_producto,
        categoria,
        rubro,
        precio_mediano,
        NTILE(3) OVER (
            PARTITION BY categoria
            ORDER BY precio_mediano
        ) AS tercil
    FROM producto_con_categoria
)

SELECT
    id_producto,
    categoria,
    rubro,
    precio_mediano,
    CASE tercil
        WHEN 1 THEN 'economico'
        WHEN 2 THEN 'medio'
        WHEN 3 THEN 'premium'
    END AS gama
FROM con_gama