-- Nivel de precios por cadena x categoria, UNA FILA POR FECHA.
-- Antes calculaba solo la fecha maxima del crudo; ahora calcula cada fecha
-- disponible por separado, para que el historico pueda recuperar un dia
-- perdido (backfill) y no unicamente el mas reciente.
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
    WHERE gama.gama = "economico"
        -- Fechas pendientes MAS la anterior: el indice encadenado compara cada
        -- fecha contra la previa, asi que sin ese dia extra no habria contra
        -- que parear y el factor quedaria nulo. Ver el macro.
        AND p.fecha_datos IN ({{ fechas_a_calcular(ref("stg_productos"), "historico_precios_cadena_categoria", incluir_anterior=true) }})
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
        cpu.categoria,
        cpu.cadena,
        cpu.unidad_normalizada,
        cpu.precio_por_unidad,
        cpu.fecha_datos
    FROM con_precio_unitario AS cpu
    JOIN limites_por_categoria AS lc
        ON cpu.categoria = lc.categoria
        AND cpu.fecha_datos = lc.fecha_datos
    WHERE cpu.precio_por_unidad >= lc.p10
        AND cpu.precio_por_unidad <= lc.p90
),

nivel_por_fecha AS (
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
),

-- ---------------------------------------------------------------------------
-- Indice encadenado sobre muestra pareada
--
-- precio_mediano_unidad sirve para saber el NIVEL de precios de una cadena, pero
-- no para medir su VARIACION: es la mediana de los productos que hubiera ese
-- dia, asi que cambia cuando cambia el surtido aunque ningun precio se haya
-- movido. Medido entre dos fechas del crudo sobre 1100 combinaciones: en la
-- mediana no cambia nada, pero 23 casos se desvian mas de 1 punto y el peor
-- daba -12,17% cuando la muestra pareada daba exactamente 0,00%, o sea que la
-- caida entera era surtido. Y empeora con el tiempo: a dos dias la rotacion de
-- productos es baja, a semanas no.
--
-- Por eso se calcula aparte un factor contra la fecha anterior usando SOLO los
-- productos presentes en las dos fechas, como media geometrica de los relativos
-- por producto (indice de Jevons). La variacion de un periodo largo se obtiene
-- encadenando (multiplicando) los factores diarios, que es como se construyen
-- los indices de precios de verdad.
--
-- No cuesta un escaneo extra: sale de las mismas columnas que este modelo ya
-- lee, y BigQuery cobra por bytes leidos, no por el trabajo de agregar.
-- ---------------------------------------------------------------------------

precio_producto_dia AS (
    -- Un precio por producto y dia. Sin este paso, un producto listado en
    -- cientos de sucursales entraria cientos de veces al pareo y ademas el
    -- join se multiplicaria.
    SELECT
        categoria,
        cadena,
        unidad_normalizada,
        id_producto,
        fecha_datos,
        APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_unitario
    FROM con_precio_unitario
    GROUP BY categoria, cadena, unidad_normalizada, id_producto, fecha_datos
),

pares_de_fechas AS (
    -- Cada fecha contra la anterior DISPONIBLE, no contra "el dia anterior" del
    -- calendario: si falto un dia de ingesta, la cadena se arma igual saltando
    -- el hueco, y fecha_base deja constancia de contra que se comparo.
    SELECT
        fecha_datos AS fecha,
        LAG(fecha_datos) OVER (ORDER BY fecha_datos) AS fecha_base
    FROM (SELECT DISTINCT fecha_datos FROM con_precio_unitario)
),

relativos AS (
    -- Se parea sobre con_precio_unitario y no sobre sin_outliers a proposito: el
    -- recorte p10-p90 es por nivel de precio y por fecha, asi que un producto
    -- puede caer dentro de la banda un dia y fuera al siguiente. Eso lo sacaria
    -- del pareo por una razon que no tiene que ver con su precio.
    SELECT
        hoy.categoria,
        hoy.cadena,
        hoy.unidad_normalizada,
        hoy.fecha_datos,
        par.fecha_base,
        hoy.precio_unitario / base.precio_unitario AS relativo
    FROM precio_producto_dia AS hoy
    JOIN pares_de_fechas AS par ON hoy.fecha_datos = par.fecha
    JOIN precio_producto_dia AS base
        ON base.fecha_datos = par.fecha_base
        AND base.id_producto = hoy.id_producto
        AND base.categoria = hoy.categoria
        AND base.cadena = hoy.cadena
        AND base.unidad_normalizada = hoy.unidad_normalizada
    WHERE base.precio_unitario > 0
),

factores AS (
    -- MEDIA GEOMETRICA de los relativos por producto (indice de Jevons), que es
    -- la formula estandar para agregados elementales de un indice de precios.
    --
    -- Se probo primero con la mediana, por consistencia con el resto del
    -- proyecto, y estaba MAL: los cambios de precio son esporadicos. Medido
    -- entre el 09-06 y el 09-07 sobre 56.974 productos pareados, el 97,9% no
    -- cambio de precio (0,7% subio, 1,3% bajo). Con esa distribucion la mediana
    -- de los relativos vale exactamente 1,0 por construccion, y efectivamente
    -- daba 0,00% en 563 de 564 series: tiraba toda la señal. La media
    -- geometrica de ese mismo dia da -0,028%, que si tiene contenido.
    --
    -- El recorte es lo que la media geometrica necesita y la mediana no: un solo
    -- relativo disparatado (de los errores de carga conocidos de la fuente)
    -- arrastra el promedio de un grupo chico. Se excluyen los relativos fuera de
    -- [0.5, 2]: son el 0,01% de las observaciones (3 de 56.974), asi que el
    -- sesgo por descartar una suba real que duplique el precio en un dia es
    -- despreciable frente al riesgo de meter un dato roto.
    SELECT
        categoria,
        cadena,
        unidad_normalizada,
        fecha_datos,
        fecha_base,
        EXP(AVG(LN(relativo))) AS factor_vs_base,
        COUNT(*) AS muestras_pareadas
    FROM relativos
    WHERE relativo BETWEEN 0.5 AND 2
    GROUP BY categoria, cadena, unidad_normalizada, fecha_datos, fecha_base
    HAVING COUNT(*) >= 20
)

SELECT
    n.categoria,
    n.cadena,
    n.unidad_normalizada,
    n.fecha_datos,
    n.precio_mediano_unidad,
    n.muestras,
    -- Nulos cuando no hay fecha anterior en la ventana del crudo o cuando no
    -- quedaron suficientes productos pareados. La API tiene que tratar una
    -- cadena con un eslabon faltante como cadena rota, no multiplicar saltando.
    f.fecha_base,
    f.factor_vs_base,
    f.muestras_pareadas
FROM nivel_por_fecha AS n
LEFT JOIN factores AS f
    USING (categoria, cadena, unidad_normalizada, fecha_datos)
