-- KPI 2: Costo de la canasta basica por localidad.
-- Metodologia: composicion basada en la Canasta Basica Alimentaria (CBA) del
-- INDEC, adaptada a las categorias propias (ver seed composicion_canasta).
-- Solo se usan productos de gama economica (mart_gama_productos) para evitar
-- que productos premium (aceite de oliva, leches vegetales, etc.) inflen
-- artificialmente el costo de una canasta que busca representar lo accesible.
-- El precio por unidad de medida sale de columnas estructuradas de SEPA
-- (cantidad/unidad de presentacion), no de texto libre.
-- Exclusiones documentadas del CBA original: Dulces (330g, ya cubierto via
-- categoria propia Dulces y mermeladas) y Menudencias (270g, ~0.5% del peso
-- total, sin categoria equivalente).
-- Filtro de sanidad: se descartan cantidad_normalizada fuera de un rango
-- fisicamente razonable (5g-10000g / 5cc-10000cc / 1-60 unidades). Se
-- detecto que algunos comercios reportan la cantidad de presentacion en la
-- escala equivocada (ej. 0.21 en vez de 210 para un pan de 210g) -- error
-- de carga en la fuente SEPA, no de esta transformacion.
-- Umbral minimo de 20 muestras por categoria x localidad, y filtro de outliers
-- percentil 10-90: con pocas muestras, un solo producto mal cargado puede
-- contaminar el 100% de una categoria sin que el filtro estadistico tenga
-- margen de descartarlo. Se prioriza confiabilidad sobre cobertura.
-- fecha_datos = fecha real de los precios usados (no la fecha de corrida),
-- para que el historico se etiquete por validez del dato, no por ejecucion.

WITH productos_canasta AS (
    SELECT
        p.id_producto,
        p.id_comercio,
        p.id_sucursal,
        p.precio,
        p.cantidad_normalizada,
        p.unidad_normalizada,
        p.fecha_datos,
        cat.categoria
    FROM {{ ref("stg_productos") }} AS p
    JOIN {{ ref("stg_categorias") }} AS cat ON p.id_producto = cat.id_producto
    JOIN {{ ref("mart_gama_productos") }} AS gama ON p.id_producto = gama.id_producto
    JOIN {{ ref("composicion_canasta") }} AS comp
        ON cat.categoria = comp.categoria
        AND p.unidad_normalizada = comp.unidad
    WHERE p.fecha_datos = (SELECT MAX(fecha_datos) FROM {{ ref("stg_productos") }})
        AND gama.gama = "economico"
        AND p.cantidad_normalizada IS NOT NULL
        AND (
            (p.unidad_normalizada IN ("g", "cc") AND p.cantidad_normalizada BETWEEN 5 AND 10000)
            OR (p.unidad_normalizada = "unidad" AND p.cantidad_normalizada BETWEEN 1 AND 60)
        )
),

con_precio_unitario AS (
    SELECT
        *,
        precio / cantidad_normalizada AS precio_por_unidad
    FROM productos_canasta
),

limites_por_categoria AS (
    SELECT
        categoria,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(10)] AS p10,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(90)] AS p90
    FROM con_precio_unitario
    GROUP BY categoria
),

sin_outliers AS (
    SELECT
        cpu.id_producto,
        cpu.id_comercio,
        cpu.id_sucursal,
        cpu.categoria,
        cpu.precio_por_unidad,
        cpu.fecha_datos
    FROM con_precio_unitario AS cpu
    JOIN limites_por_categoria AS lc ON cpu.categoria = lc.categoria
    WHERE cpu.precio_por_unidad >= lc.p10
        AND cpu.precio_por_unidad <= lc.p90
),

con_localidad AS (
    SELECT
        so.categoria,
        s.localidad,
        s.provincia,
        so.precio_por_unidad,
        so.fecha_datos
    FROM sin_outliers AS so
    JOIN {{ ref("stg_sucursales") }} AS s
        ON so.id_comercio = s.id_comercio AND so.id_sucursal = s.id_sucursal
    WHERE s.localidad IS NOT NULL
),

precio_mediano_categoria_localidad AS (
    SELECT
        categoria,
        localidad,
        provincia,
        fecha_datos,
        APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
        COUNT(*) AS muestras
    FROM con_localidad
    GROUP BY categoria, localidad, provincia, fecha_datos
    HAVING COUNT(*) >= 20
),

costo_por_categoria AS (
    SELECT
        pmc.localidad,
        pmc.provincia,
        pmc.categoria,
        pmc.precio_mediano_unidad,
        pmc.fecha_datos,
        comp.cantidad AS cantidad_necesaria,
        pmc.precio_mediano_unidad * comp.cantidad AS costo_categoria,
        pmc.muestras
    FROM precio_mediano_categoria_localidad AS pmc
    JOIN {{ ref("composicion_canasta") }} AS comp ON pmc.categoria = comp.categoria
)

SELECT
    localidad,
    provincia,
    fecha_datos,
    COUNT(DISTINCT categoria) AS categorias_disponibles,
    ROUND(SUM(costo_categoria), 2) AS costo_canasta_total
FROM costo_por_categoria
GROUP BY localidad, provincia, fecha_datos
