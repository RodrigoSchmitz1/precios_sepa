-- Nivel de precios actual por cadena x categoria (foto actual).
-- Sirve de base para comparar cadenas entre si y, con su historico,
-- para calcular evolucion de precios / inflacion por categoria a nivel
-- nacional (sin desagregar por provincia -- no es el foco de este KPI).
-- Mismo criterio de calidad que mart_canasta_localidad: gama economica
-- (evita sesgo de productos premium), filtro de sanidad de gramaje,
-- outliers percentil 10-90, umbral minimo de 20 muestras.
-- A diferencia de la canasta, cubre TODAS las categorias (no solo las 29
-- de la composicion_canasta), porque el objetivo es comparar cadenas y
-- categorias en general, no calcular el costo de una canasta especifica.
--
-- LIMITACION CONOCIDA: se detecto que algunas combinaciones cadena x
-- categoria (ej. Dia en Gaseosas) tienen precios sistematicamente muy por
-- debajo del resto del mercado en toda la cadena (no un producto aislado,
-- sino replicado en cientos de sucursales) -- posible error en el maestro
-- de precios de esa cadena, no verificable sin acceso a la fuente original.
-- El filtro de sanidad de gramaje y outliers no lo detecta porque el
-- gramaje es correcto; solo el precio en si es sospechoso. No se investigo
-- exhaustivamente cada caso porque este KPI no es foco central del proyecto;
-- se documenta para no presentar el dato como si fuera 100% confiable.

WITH productos_filtrados AS (
    SELECT
        p.id_producto,
        p.precio,
        p.cantidad_normalizada,
        p.unidad_normalizada,
        p.fecha_datos,
        cat.categoria,
        c.nombre_comercial AS cadena
    FROM {{ ref("stg_productos") }} AS p
    JOIN {{ ref("stg_categorias") }} AS cat ON p.id_producto = cat.id_producto
    JOIN {{ ref("mart_gama_productos") }} AS gama ON p.id_producto = gama.id_producto
    JOIN {{ ref("stg_comercio") }} AS c ON p.id_comercio = c.id_comercio AND p.id_bandera = c.id_bandera
    WHERE p.fecha_datos = (SELECT MAX(fecha_datos) FROM {{ ref("stg_productos") }})
        AND gama.gama = "economico"
        AND cat.categoria != "Otros"
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
    FROM productos_filtrados
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
        cpu.categoria,
        cpu.cadena,
        cpu.unidad_normalizada,
        cpu.precio_por_unidad,
        cpu.fecha_datos
    FROM con_precio_unitario AS cpu
    JOIN limites_por_categoria AS lc ON cpu.categoria = lc.categoria
    WHERE cpu.precio_por_unidad >= lc.p10
        AND cpu.precio_por_unidad <= lc.p90
)

SELECT
    categoria,
    cadena,
    unidad_normalizada,
    fecha_datos,
    APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
    COUNT(*) AS muestras
FROM sin_outliers
GROUP BY categoria, cadena, unidad_normalizada, fecha_datos
HAVING COUNT(*) >= 20
