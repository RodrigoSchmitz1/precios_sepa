-- Detalle de la canasta basica: UNA FILA POR LOCALIDAD, FECHA Y CATEGORIA.
--
-- Existe por dos motivos. El primero es de producto: un total de seis cifras sin
-- nada detras es un numero que hay que creer. Con el desglose el lector ve de
-- que esta hecho, cuanto pesa cada categoria y sobre cuantas observaciones se
-- calculo, y puede juzgar por su cuenta si le cierra. En un dato publico eso no
-- es un extra, es lo que lo hace creible.
--
-- El segundo es de costo: antes este calculo vivia dentro de
-- mart_canasta_localidad y se tiraba despues de sumar. Ahora se materializa una
-- vez y el total sale de agregarlo, que es una tabla chica. El escaneo pesado
-- del crudo se hace una sola vez igual que antes.
--
-- Solo incluye localidades con la canasta COMPLETA, el mismo criterio que el
-- total: si el detalle mostrara localidades incompletas, alguien podria sumarlo
-- y obtener un numero que no es comparable con el del ranking.

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
    -- La gama se une por producto Y unidad: un mismo producto puede venir en
    -- gramos en una cadena y como "1 unidad" en otra, y cada unidad tiene su
    -- propia gama. Unir solo por producto metia milanesas en el pollo
    -- economico. Ver mart_gama_productos.
    JOIN {{ ref("mart_gama_productos") }} AS gama
        ON p.id_producto = gama.id_producto
        AND p.unidad_normalizada = gama.unidad_normalizada
    JOIN {{ ref("composicion_canasta") }} AS comp
        ON cat.categoria = comp.categoria
        AND p.unidad_normalizada = comp.unidad
    WHERE gama.gama = "economico"
        -- Solo las fechas que faltan en el historico, mas la ultima: recalcular
        -- las que ya estan da identico y se paga todos los dias. Ver el macro.
        AND p.fecha_datos IN ({{ fechas_a_calcular(ref("stg_productos"), "historico_canasta_localidad") }})
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
    -- Los limites se calculan por categoria Y fecha: mezclar fechas dejaria que
    -- un dia contamine el recorte de outliers de otro.
    SELECT
        categoria,
        fecha_datos,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(10)] AS p10,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(90)] AS p90
    FROM con_precio_unitario
    GROUP BY categoria, fecha_datos
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
    JOIN limites_por_categoria AS lc
        ON cpu.categoria = lc.categoria
        AND cpu.fecha_datos = lc.fecha_datos
    WHERE cpu.precio_por_unidad >= lc.p10
        AND cpu.precio_por_unidad <= lc.p90
),

localidades_reales AS (
    -- Descarta las "localidades" que en realidad son provincias enteras.
    -- Algunas cadenas llenan el campo localidad con el nombre de la provincia,
    -- y como esas filas agrupan cientos de sucursales SUPERAN el umbral de
    -- muestras con comodidad: el filtro de calidad las premiaba en vez de
    -- descartarlas. Medido: "BUENOS AIRES" juntaba 425 sucursales repartidas en
    -- 555 km, "ENTRE RIOS" 66 en 311 km, "CORRIENTES" 17 en 322 km. Comparar
    -- eso contra un barrio de CABA no significa nada.
    --
    -- El criterio es geografico y no una lista de nombres: una localidad real es
    -- compacta. Medio grado (~55 km) deja pasar cualquier ciudad con su area
    -- metropolitana (San Miguel de Tucuman abarca 0,1 grados) y corta las bolsas
    -- provinciales, que arrancan en 1,1 grados. Al ser una regla y no una lista,
    -- tambien atrapa las que aparezcan mas adelante.
    SELECT localidad, provincia
    FROM {{ ref("stg_sucursales") }}
    WHERE localidad IS NOT NULL AND latitud IS NOT NULL AND longitud IS NOT NULL
    GROUP BY localidad, provincia
    HAVING MAX(latitud) - MIN(latitud) <= 0.5
       AND MAX(longitud) - MIN(longitud) <= 0.5
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
    JOIN localidades_reales AS lr
        ON s.localidad = lr.localidad AND s.provincia = lr.provincia
    WHERE s.localidad IS NOT NULL
),

{#- Umbrales de la canasta. Ver la documentacion de mediana_local y grilla. -#}
{%- set muestras_minimas = 6 -%}
{%- set maximo_imputadas = 2 -%}

mediana_local AS (
    -- UMBRAL: 6 observaciones por categoria y localidad para usar su mediana.
    -- Historia: 20 hasta el 2026-09-09 (dejaba afuera al interior, que tiene 3,4
    -- sucursales por localidad contra 13,2 de los barrios portenos), 8 ese dia
    -- con evidencia, y 6 el 2026-09-10 tras corregir la gama: con 6 la mediana se
    -- movia 0,2% y de las localidades nuevas solo una caia fuera del rango del
    -- grupo original. El umbral es unico para todo el pais: uno distinto para
    -- CABA y el interior haria que las cifras no sean comparables entre si.
    SELECT
        categoria,
        localidad,
        provincia,
        fecha_datos,
        APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
        COUNT(*) AS muestras
    FROM con_localidad
    GROUP BY categoria, localidad, provincia, fecha_datos
),

mediana_provincial AS (
    -- La misma cuenta sobre todas las localidades reales de la provincia. Es el
    -- precio de reemplazo cuando una localidad no junta suficientes observaciones.
    SELECT
        categoria,
        provincia,
        fecha_datos,
        APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
        COUNT(*) AS muestras
    FROM con_localidad
    GROUP BY categoria, provincia, fecha_datos
),

grilla AS (
    -- IMPUTACION PROVINCIAL (2026-09-10). Al separar cerdo, achuras y elaborados
    -- de Carne vacuna y Pollo, esas categorias quedaron con pocos productos
    -- economicos, y el pollo y el pescado frescos se venden en pocas sucursales.
    -- Con precio estrictamente local solo 16 localidades completaban la canasta,
    -- 1 de CABA: sobre 423 localidades con datos, Pollo no llegaba a 6
    -- observaciones en 364 y Pescado en 324.
    --
    -- Cuando una localidad no junta 6 observaciones de una categoria se usa la
    -- mediana de su provincia, tambien con 6 o mas, como hacen los indices
    -- oficiales al imputar precios faltantes. Se admiten hasta 2 categorias
    -- imputadas por localidad. Medido sobre el 2026-09-09: 96 localidades (51 de
    -- CABA y 45 del interior) con mediana de $238.866, contra $230.810 del grupo
    -- estrictamente local. Con 4 se llegaba a 136, pero una canasta con cuatro
    -- precios provinciales deja de describir a su localidad. Cada fila dice de
    -- donde salio su precio (origen_precio) y el desglose del sitio lo muestra.
    --
    -- Se descarto ampliar la gama a economico + medio: daba 92 localidades sin
    -- imputar, pero la canasta pasaba a ~$375.000 porque dejaba de ser la
    -- economica.
    SELECT
        l.localidad,
        l.provincia,
        l.fecha_datos,
        comp.categoria,
        comp.cantidad
    FROM (SELECT DISTINCT localidad, provincia, fecha_datos FROM con_localidad) AS l
    CROSS JOIN {{ ref("composicion_canasta") }} AS comp
),

precio_por_categoria AS (
    SELECT
        g.localidad,
        g.provincia,
        g.fecha_datos,
        g.categoria,
        g.cantidad AS cantidad_necesaria,
        CASE
            WHEN ml.muestras >= {{ muestras_minimas }} THEN ml.precio_mediano_unidad
            WHEN mp.muestras >= {{ muestras_minimas }} THEN mp.precio_mediano_unidad
        END AS precio_mediano_unidad,
        CASE
            WHEN ml.muestras >= {{ muestras_minimas }} THEN ml.muestras
            WHEN mp.muestras >= {{ muestras_minimas }} THEN mp.muestras
        END AS muestras,
        CASE
            WHEN ml.muestras >= {{ muestras_minimas }} THEN "localidad"
            WHEN mp.muestras >= {{ muestras_minimas }} THEN "provincia"
        END AS origen_precio
    FROM grilla AS g
    LEFT JOIN mediana_local AS ml
        ON ml.localidad = g.localidad
        AND ml.provincia = g.provincia
        AND ml.fecha_datos = g.fecha_datos
        AND ml.categoria = g.categoria
    LEFT JOIN mediana_provincial AS mp
        ON mp.provincia = g.provincia
        AND mp.fecha_datos = g.fecha_datos
        AND mp.categoria = g.categoria
),

completas AS (
    -- La canasta tiene que estar entera: las 32 categorias con precio, local o
    -- provincial. Sumar solo las que haya haria parecer mas baratas a las
    -- localidades con menos datos. La grilla sale de la seed, asi que cambiar la
    -- composicion no requiere tocar este numero.
    SELECT localidad, provincia, fecha_datos
    FROM precio_por_categoria
    GROUP BY localidad, provincia, fecha_datos
    HAVING COUNTIF(precio_mediano_unidad IS NULL) = 0
        AND COUNTIF(origen_precio = "provincia") <= {{ maximo_imputadas }}
)

SELECT
    c.localidad,
    c.provincia,
    c.fecha_datos,
    c.categoria,
    c.cantidad_necesaria,
    c.precio_mediano_unidad,
    ROUND(c.precio_mediano_unidad * c.cantidad_necesaria, 2) AS costo_categoria,
    c.muestras,
    c.origen_precio
FROM precio_por_categoria AS c
JOIN completas USING (localidad, provincia, fecha_datos)
