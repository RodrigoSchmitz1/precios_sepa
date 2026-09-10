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
    -- Umbral bajado de 20 a 8 el 2026-09-09, con evidencia. Con 20 el ranking
    -- eran 27 localidades y 21 de ellas barrios de CABA: el interior quedaba
    -- afuera porque tiene 3,4 sucursales por localidad contra las 13,2 de los
    -- barrios portenos, y no llegaba a 20 observaciones en las 32 categorias.
    -- Medido sobre los datos del dia: bajar a 8 pasa de 27 a 78 localidades, la
    -- mediana del costo se mueve 0,9% ($365.943 -> $369.188), el percentil 10
    -- queda igual, y NINGUNA de las 51 localidades nuevas cae fuera del rango
    -- del grupo original. O sea que 20 era mucho mas conservador que necesario.
    -- El umbral es unico para todo el pais a proposito: uno distinto para CABA
    -- y para el interior haria que las cifras no sean comparables entre si, que
    -- es justamente lo que este modelo existe para garantizar.
    HAVING COUNT(*) >= 8
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
),

tamano_canasta AS (
    -- Una fila por categoria en la seed, asi que contarlas da el tamano de la
    -- canasta de referencia. Sale de la seed y no de un numero escrito aca para
    -- que cambiar la composicion no requiera acordarse de tocar dos lugares.
    SELECT COUNT(*) AS categorias FROM {{ ref("composicion_canasta") }}
),

completas AS (
    SELECT localidad, provincia, fecha_datos
    FROM costo_por_categoria
    GROUP BY localidad, provincia, fecha_datos
    HAVING COUNT(DISTINCT categoria) = (SELECT categorias FROM tamano_canasta)
)

SELECT
    c.localidad,
    c.provincia,
    c.fecha_datos,
    c.categoria,
    c.cantidad_necesaria,
    c.precio_mediano_unidad,
    ROUND(c.costo_categoria, 2) AS costo_categoria,
    c.muestras
FROM costo_por_categoria AS c
JOIN completas USING (localidad, provincia, fecha_datos)
