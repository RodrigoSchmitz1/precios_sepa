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
-- Devuelve UNA FILA POR LOCALIDAD Y FECHA: antes calculaba solo la fecha
-- maxima del crudo; ahora calcula cada fecha disponible por separado, para
-- que el historico pueda recuperar un dia perdido (backfill).
--
-- SOLO LOCALIDADES CON LA CANASTA COMPLETA (corregido 2026-09-08).
-- Antes se sumaban las categorias que cada localidad tuviera y se comparaban
-- esos totales entre si, lo cual no mide lo que dice medir: una localidad con
-- 20 de 32 categorias parece barata simplemente porque le faltan 12. Medido
-- sobre los datos del dia: mediana de $177.419 con 20 categorias contra
-- $388.726 con 30, o sea que el "ranking de canasta mas barata" era en realidad
-- un ranking de cuantas categorias le faltaban a cada localidad.
--
-- La composicion tiene que ser FIJA, no derivada de los datos de cada dia: este
-- modelo alimenta un historico permanente, y si la canasta cambia de dia a dia
-- la serie mezcla variaciones de precio con variaciones de composicion. Por eso
-- el conjunto sale de la seed y el HAVING exige tenerlo entero.
--
-- Cuesta cobertura: 31 localidades en vez de 127. Se evaluo achicar la canasta
-- para ganar alcance y no sirve: la unica categoria que ata es Huevos (38
-- localidades). Sacarla da 51, y sacar cualquier otra da +0. Un "nucleo de 8
-- basicos" da las mismas 31, porque incluye huevos. No hay termino medio que
-- compre cobertura sin romper el significado de la canasta.

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
)

SELECT
    localidad,
    provincia,
    fecha_datos,
    COUNT(DISTINCT categoria) AS categorias_en_canasta,
    ROUND(SUM(costo_categoria), 2) AS costo_canasta_total
FROM costo_por_categoria
GROUP BY localidad, provincia, fecha_datos
-- Solo localidades donde se puede medir la canasta ENTERA. Ver el encabezado:
-- sumar las categorias que cada localidad tenga hace que el total no sea
-- comparable entre localidades.
HAVING COUNT(DISTINCT categoria) = (SELECT categorias FROM tamano_canasta)
