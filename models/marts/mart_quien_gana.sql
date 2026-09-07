-- KPI 3: Quien gana por categoria (metodo honesto, EAN comun).
-- Compara SOLO productos que existen en 2+ cadenas -- evita el sesgo de
-- marca propia, donde una cadena "ganaria" solo por vender commodities
-- baratos que otras ni ofrecen. Los empates cuentan a favor de todas las
-- cadenas empatadas (no se fuerza un desempate arbitrario).
-- Devuelve UNA FILA POR FECHA: el crudo tiene varios dias conviviendo y cada
-- uno se calcula por separado, para que el historico pueda recuperar una
-- fecha que se haya perdido (backfill) y no solo la mas reciente.
--
-- CORTE DE METODOLOGIA (2026-09-06): hasta esta fecha el modelo (a) mezclaba
-- todos los dias del crudo en un solo agregado y lo etiquetaba con la fecha
-- maxima, y (b) unia stg_comercio solo por id_comercio, sin id_bandera. Ese
-- join replicaba cada observacion de precio una vez por bandera del comercio
-- (Coto tiene 5, Cencosud 4), atribuyendo un mismo producto a varias cadenas
-- distintas: el 26% del universo "comparable" eran productos de UNA sola
-- cadena que el join hacia pasar por comparables, inflandolo +35% y
-- favoreciendo a las cadenas con mas banderas. Las filas de
-- historico_quien_gana anteriores a esta fecha quedan calculadas con el
-- criterio viejo y no son comparables con las nuevas; no se pueden recalcular
-- porque el crudo de esos dias ya expiro.

WITH precio_por_producto_cadena AS (
    SELECT
        p.fecha_datos,
        p.id_producto,
        c.nombre_comercial AS cadena,
        APPROX_QUANTILES(p.precio, 2)[OFFSET(1)] AS precio_mediano
    FROM {{ ref("stg_productos") }} AS p
    JOIN {{ ref("stg_comercio") }} AS c
        ON p.id_comercio = c.id_comercio
        AND p.id_bandera = c.id_bandera
    GROUP BY p.fecha_datos, p.id_producto, c.nombre_comercial
),

productos_comparables AS (
    SELECT fecha_datos, id_producto
    FROM precio_por_producto_cadena
    GROUP BY fecha_datos, id_producto
    HAVING COUNT(DISTINCT cadena) >= 2
),

con_precio_minimo AS (
    SELECT
        ppc.fecha_datos,
        ppc.id_producto,
        ppc.cadena,
        ppc.precio_mediano,
        MIN(ppc.precio_mediano) OVER (
            PARTITION BY ppc.fecha_datos, ppc.id_producto
        ) AS precio_minimo_producto
    FROM precio_por_producto_cadena AS ppc
    INNER JOIN productos_comparables AS pc
        ON ppc.fecha_datos = pc.fecha_datos
        AND ppc.id_producto = pc.id_producto
),

ganadores AS (
    SELECT
        fecha_datos,
        id_producto,
        cadena
    FROM con_precio_minimo
    WHERE precio_mediano = precio_minimo_producto
),

con_categoria AS (
    SELECT
        g.fecha_datos,
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
        pc.fecha_datos,
        cat.categoria,
        COUNT(DISTINCT pc.id_producto) AS total_productos_categoria
    FROM productos_comparables AS pc
    LEFT JOIN {{ ref("stg_categorias") }} AS cat ON pc.id_producto = cat.id_producto
    WHERE cat.categoria IS NOT NULL AND cat.categoria != "Otros"
    GROUP BY pc.fecha_datos, cat.categoria
)

SELECT
    cc.categoria,
    cc.rubro,
    cc.cadena,
    COUNT(DISTINCT cc.id_producto) AS productos_ganados,
    tpc.total_productos_categoria,
    ROUND(COUNT(DISTINCT cc.id_producto) / tpc.total_productos_categoria * 100, 1) AS pct_victorias,
    cc.fecha_datos
FROM con_categoria AS cc
LEFT JOIN total_por_categoria AS tpc
    ON cc.categoria = tpc.categoria
    AND cc.fecha_datos = tpc.fecha_datos
GROUP BY cc.fecha_datos, cc.categoria, cc.rubro, cc.cadena, tpc.total_productos_categoria
ORDER BY cc.fecha_datos, cc.categoria, pct_victorias DESC
