-- "El mismo producto": cuanto cuesta el mismo codigo de barras en cada cadena.
--
-- Una fila por producto x cadena, solo del ultimo dia: responde "cuanto sale
-- hoy", no alimenta ningun historico. Mismo codigo de barras quiere decir misma
-- presentacion, asi que los precios se comparan directo, sin normalizar por
-- gramo ni litro.
--
-- El precio de cada cadena es la mediana entre sus sucursales, que resiste a
-- una sucursal con un precio mal cargado. Con pocas sucursales esa defensa se
-- debilita, por eso va la cantidad en cada fila: la pagina tiene que poder
-- decir "en 1 sucursal" y no destacar una diferencia que depende de un dato
-- suelto.
--
-- PRECIOS QUE NO SON PRECIOS (2026-09-22)
-- La mediana por cadena no alcanza cuando el error es de la cadena entera. El
-- 21/09, FANTA ZERO 1.75L figuraba a $309 en HiperChangomas (31 sucursales) y a
-- $369 en Changomas (53), mientras SuperChangomas -la misma empresa- y las otras
-- diez cadenas la informaban entre $4.939 y $5.190. La seccion lo publicaba como
-- "1.579% de diferencia". Revisados los 12 destacados de ese dia, los 12 eran
-- errores de la fuente, en dos formas: un minimo absurdo (FANTA a 0,06 de la
-- mediana del mercado) o un maximo absurdo (DONUT a $170 en dos empresas y a
-- $1.500 en una tercera).
--
-- Las dos guardas que ya habia no podian verlo. Exigir 3 sucursales detecta una
-- sucursal mal cargada, no una cadena entera equivocada: los $309 salian de 31
-- sucursales. Exigir 3 empresas distintas funcionaba bien y el producto las
-- tenia de verdad.
--
-- Lo que faltaba es que un extremo no contradiga al mercado. Cada precio se
-- compara ahora contra la mediana ENTRE EMPRESAS y, si se aparta mas de lo
-- creible, no entra en el calculo de la brecha. No se borra: viaja marcado para
-- que la pagina pueda mostrarlo como no verificado, igual que las promos por
-- evidencia. Esconder el dato seria decidir por el visitante; marcarlo le
-- permite ver que la fuente dice algo raro.
--
-- Los umbrales estan calibrados sobre el mart entero, en dbt_project.yml.
--
-- Lee int_precio_producto_cadena y no stg_productos: el escaneo grande ya lo
-- pago ese modelo, que comparte con mart_quien_gana.

{% set fecha = ultima_fecha(ref("int_precio_producto_cadena")) %}

WITH precios AS (
    SELECT
        fecha_datos,
        id_producto,
        cadena,
        empresa,
        precio_mediano,
        precio_minimo,
        precio_maximo,
        sucursales
    FROM {{ ref("int_precio_producto_cadena") }}
    WHERE fecha_datos = DATE('{{ fecha }}')
),

-- Un precio por empresa antes de sacar la referencia. Sin este paso, una
-- empresa con cuatro banderas aporta cuatro valores y la "mediana del mercado"
-- termina siendo la mediana de esa empresa.
por_empresa AS (
    SELECT
        id_producto,
        empresa,
        APPROX_QUANTILES(precio_mediano, 2)[OFFSET(1)] AS precio_empresa
    FROM precios
    GROUP BY id_producto, empresa
),

referencia AS (
    SELECT
        id_producto,
        COUNT(*) AS empresas_con_precio,
        -- Con menos de 3 empresas no hay mercado contra el cual contrastar: con
        -- dos, la mediana es el promedio de las dos y cualquiera de ellas puede
        -- ser la equivocada. En ese caso no se juzga a nadie (referencia NULL).
        IF(COUNT(*) >= 3, APPROX_QUANTILES(precio_empresa, 2)[OFFSET(1)], NULL) AS precio_referencia
    FROM por_empresa
    GROUP BY id_producto
),

evaluados AS (
    SELECT
        p.*,
        r.precio_referencia,
        -- Sin referencia no se puede juzgar, asi que se toma como creible: el
        -- filtro nunca inventa sospechas donde no hay con que compararlas.
        r.precio_referencia IS NULL
            OR p.precio_mediano BETWEEN r.precio_referencia * {{ var("mismo_producto_piso_creible") }}
                                    AND r.precio_referencia * {{ var("mismo_producto_techo_creible") }}
            AS precio_creible
    FROM precios AS p
    JOIN referencia AS r USING (id_producto)
),

por_producto AS (
    SELECT
        id_producto,
        COUNT(*) AS cadenas,
        -- Los extremos y la brecha salen SOLO de los precios creibles: es todo
        -- el punto del cambio.
        MIN(IF(precio_creible, precio_mediano, NULL)) AS precio_mas_bajo,
        MAX(IF(precio_creible, precio_mediano, NULL)) AS precio_mas_alto,
        -- Empresas distintas, que no es lo mismo que banderas: Carrefour tiene
        -- cuatro. Se cuentan solo las que aportan un precio creible, asi que un
        -- producto donde se descarto una empresa entera deja de figurar como si
        -- la tuviera.
        COUNT(DISTINCT IF(precio_creible, empresa, NULL)) AS empresas,
        COUNTIF(NOT precio_creible) AS cadenas_descartadas
    FROM evaluados
    GROUP BY id_producto
    -- Con una sola cadena creible no hay contra que comparar, igual que antes
    -- pero contando las que sirven.
    HAVING COUNTIF(precio_creible) >= 2
)

SELECT
    ev.fecha_datos,
    ev.id_producto,
    cat.descripcion,
    cat.marca,
    cat.categoria,
    cat.rubro,
    ev.cadena,
    ev.precio_mediano,
    ev.precio_minimo,
    ev.precio_maximo,
    ev.sucursales,
    ev.precio_creible,
    ev.precio_referencia,
    pp.cadenas,
    pp.empresas,
    pp.cadenas_descartadas,
    pp.precio_mas_bajo,
    pp.precio_mas_alto,
    -- stg_productos descarta precios <= 1, asi que no hay division por cero.
    ROUND((pp.precio_mas_alto - pp.precio_mas_bajo) / pp.precio_mas_bajo * 100, 1) AS diferencia_pct,
    ev.precio_creible AND ev.precio_mediano = pp.precio_mas_bajo AS es_el_mas_barato
FROM evaluados AS ev
JOIN por_producto AS pp
    ON ev.id_producto = pp.id_producto
JOIN {{ ref("stg_categorias") }} AS cat
    ON ev.id_producto = cat.id_producto
