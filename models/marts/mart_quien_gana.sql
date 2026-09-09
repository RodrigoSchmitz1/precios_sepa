-- KPI 3: Quien gana por categoria (metodo honesto, EAN comun).
-- Compara SOLO productos que existen en 2+ cadenas -- evita el sesgo de
-- marca propia, donde una cadena "ganaria" solo por vender commodities
-- baratos que otras ni ofrecen. Los empates cuentan a favor de todas las
-- cadenas empatadas (no se fuerza un desempate arbitrario).
--
-- DOS TASAS, Y LA QUE IMPORTA ES LA SEGUNDA (agregado 2026-09-09):
--   * pct_victorias = ganados / total comparables de la categoria. Mezcla
--     precio con AMPLITUD DE SURTIDO: una cadena que ofrece 20 de 148
--     comparables no puede pasar de 13,5% por barata que sea. Se conserva
--     porque es la serie que ya venia acumulando el historico.
--   * pct_gana_cuando_compite = ganados / ofrecidos. Responde la pregunta real:
--     cuando esta cadena tiene el producto, cuan seguido es la mas barata.
-- Medido sobre la fecha del 2026-09-08: la cadena tipica ofrece apenas el 36,9%
-- de los comparables de su categoria, y el lider cambia en 22 de 58 categorias
-- segun cual de las dos tasas se use. En Arroz, Express (Carrefour) pasa de
-- 4,7% a 20,6% y Dia de 2,0% a 10,0%: no eran caras, ofrecian pocos productos.
--
-- Umbral de 20 productos ofrecidos, el mismo que usan los otros marts. Sin el,
-- una cadena con un solo producto en la categoria y suerte figuraba con 100%
-- (paso literal: "Pescado / Dia, gana 1 de 1").
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

{% set fechas = fechas_a_calcular(ref("stg_productos"), "historico_quien_gana") %}

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
    -- Solo las fechas que faltan en el historico, mas la ultima. Recalcular las
    -- que ya estan da el mismo resultado y se paga todos los dias: el crudo
    -- retiene 3 fechas, asi que en un dia normal esto escanea un tercio.
    -- Ver el macro para el detalle y para que hacer si cambia una metodologia.
    WHERE p.fecha_datos IN ({{ fechas }})
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

ofrecidos_por_cadena AS (
    -- Denominador correcto: los comparables que ESTA cadena efectivamente
    -- ofrece. Sale de con_precio_minimo, que ya esta restringido a comparables,
    -- y no de los ganadores, para contar tambien los que la cadena ofrece y
    -- pierde.
    SELECT
        cpm.fecha_datos,
        cat.categoria,
        cpm.cadena,
        COUNT(DISTINCT cpm.id_producto) AS productos_ofrecidos
    FROM con_precio_minimo AS cpm
    JOIN {{ ref("stg_categorias") }} AS cat ON cpm.id_producto = cat.id_producto
    WHERE cat.categoria IS NOT NULL AND cat.categoria != "Otros"
    GROUP BY cpm.fecha_datos, cat.categoria, cpm.cadena
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
    opc.productos_ofrecidos,
    tpc.total_productos_categoria,
    ROUND(COUNT(DISTINCT cc.id_producto) / tpc.total_productos_categoria * 100, 1) AS pct_victorias,
    ROUND(COUNT(DISTINCT cc.id_producto) / opc.productos_ofrecidos * 100, 1) AS pct_gana_cuando_compite,
    cc.fecha_datos
FROM con_categoria AS cc
JOIN ofrecidos_por_cadena AS opc
    ON cc.categoria = opc.categoria
    AND cc.cadena = opc.cadena
    AND cc.fecha_datos = opc.fecha_datos
LEFT JOIN total_por_categoria AS tpc
    ON cc.categoria = tpc.categoria
    AND cc.fecha_datos = tpc.fecha_datos
WHERE opc.productos_ofrecidos >= 20
GROUP BY
    cc.fecha_datos, cc.categoria, cc.rubro, cc.cadena,
    opc.productos_ofrecidos, tpc.total_productos_categoria
ORDER BY cc.fecha_datos, cc.categoria, pct_gana_cuando_compite DESC
