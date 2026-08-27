-- KPI 3: Quien gana por categoria (metodo honesto, EAN comun).
-- Compara SOLO productos que existen en 2+ cadenas -- evita el sesgo de
-- marca propia, donde una cadena "ganaria" solo por vender commodities
-- baratos que otras ni ofrecen. Los empates cuentan a favor de todas las
-- cadenas empatadas (no se fuerza un desempate arbitrario).

WITH precio_por_producto_cadena AS (
    SELECT
        p.id_producto,
        c.nombre_comercial AS cadena,
        APPROX_QUANTILES(p.precio, 2)[OFFSET(1)] AS precio_mediano
    FROM {{ ref("stg_productos") }} AS p
    LEFT JOIN {{ ref("stg_comercio") }} AS c ON p.id_comercio = c.id_comercio
    GROUP BY p.id_producto, c.nombre_comercial
),

productos_comparables AS (
    SELECT id_producto
    FROM precio_por_producto_cadena
    GROUP BY id_producto
    HAVING COUNT(DISTINCT cadena) >= 2
),

con_precio_minimo AS (
    SELECT
        ppc.id_producto,
        ppc.cadena,
        ppc.precio_mediano,
        MIN(ppc.precio_mediano) OVER (PARTITION BY ppc.id_producto) AS precio_minimo_producto
    FROM precio_por_producto_cadena AS ppc
    INNER JOIN productos_comparables AS pc ON ppc.id_producto = pc.id_producto
),

ganadores AS (
    SELECT
        id_producto,
        cadena
    FROM con_precio_minimo
    WHERE precio_mediano = precio_minimo_producto
),

con_categoria AS (
    SELECT
        g.id_producto,
        g.cadena,
        cat.categoria,
        cat.rubro
    FROM ganadores AS g
    LEFT JOIN {{ ref("stg_categorias") }} AS cat ON g.id_producto = cat.id_producto
    WHERE cat.categoria IS NOT NULL AND cat.categoria != "Otros"
),

total_por_categoria AS (
    SELECT
        cat.categoria,
        COUNT(DISTINCT pc.id_producto) AS total_productos_categoria
    FROM productos_comparables AS pc
    LEFT JOIN {{ ref("stg_categorias") }} AS cat ON pc.id_producto = cat.id_producto
    WHERE cat.categoria IS NOT NULL AND cat.categoria != "Otros"
    GROUP BY cat.categoria
)

SELECT
    cc.categoria,
    cc.rubro,
    cc.cadena,
    COUNT(DISTINCT cc.id_producto) AS productos_ganados,
    tpc.total_productos_categoria,
    ROUND(COUNT(DISTINCT cc.id_producto) / tpc.total_productos_categoria * 100, 1) AS pct_victorias
FROM con_categoria AS cc
LEFT JOIN total_por_categoria AS tpc ON cc.categoria = tpc.categoria
GROUP BY cc.categoria, cc.rubro, cc.cadena, tpc.total_productos_categoria
ORDER BY cc.categoria, pct_victorias DESC
