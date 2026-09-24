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
        sucursales,
        cantidad_normalizada,
        unidad_normalizada
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

en_rango AS (
    SELECT
        p.*,
        r.precio_referencia,
        -- Sin referencia no se puede juzgar, asi que se toma como creible: el
        -- filtro nunca inventa sospechas donde no hay con que compararlas.
        r.precio_referencia IS NULL
            OR p.precio_mediano BETWEEN r.precio_referencia * {{ var("mismo_producto_piso_creible") }}
                                    AND r.precio_referencia * {{ var("mismo_producto_techo_creible") }}
            AS precio_en_rango
    FROM precios AS p
    JOIN referencia AS r USING (id_producto)
),

-- UN PRECIO FUERA DE RANGO QUE OTRO CONFIRMA (2026-09-23)
--
-- El rango contra la mediana trataba igual a un precio aislado que a uno que
-- otra cadena repite, y cortaba en seco. PARMESANA SALSA JALAPENO 180G: las tres
-- banderas de Changomas a $1.590 (0,48 de la mediana, 93 sucursales) quedaban
-- "sin verificar", mientras Carrefour a $1.695 (0,51) contaba. Dos empresas que
-- no comparten sistemas informando casi el mismo precio no son un error de
-- carga: es un precio. Y SEMILLA SESAMO FOR GOOD: Vea a $1.900 (0,49) afuera y
-- Jumbo a $1.999, la misma empresa, adentro.
--
-- Un precio fuera de rango se acepta si hay otro a menos de la tolerancia que
-- sea de OTRA empresa, o de la misma pero dentro del rango. La condicion sobre
-- la misma empresa es la que mantiene afuera a FANTA ZERO: $309 en
-- HiperChangomas y $369 en Changomas son el mismo error en dos banderas, y
-- ninguna de las dos lo confirma. El 23-09 esto rescata 7 de 79 descartes, y
-- los 7 se ven reales (ver dbt_project.yml).
coincidencias AS (
    SELECT
        a.id_producto,
        a.cadena,
        LOGICAL_OR(o.empresa != a.empresa OR o.precio_en_rango) AS confirmado
    FROM en_rango AS a
    JOIN en_rango AS o
        ON o.id_producto = a.id_producto
        AND o.cadena != a.cadena
        AND ABS(o.precio_mediano - a.precio_mediano) <= a.precio_mediano * {{ var("mismo_producto_tolerancia_coincidencia") }}
    WHERE NOT a.precio_en_rango
    GROUP BY a.id_producto, a.cadena
),

evaluados AS (
    SELECT
        e.*,
        e.precio_en_rango OR IFNULL(c.confirmado, FALSE) AS precio_creible
    FROM en_rango AS e
    LEFT JOIN coincidencias AS c USING (id_producto, cadena)
),

-- UN tamano por producto, votado entre empresas.
--
-- Cada cadena informa el tamano a su manera y para el mismo codigo de barras no
-- coinciden. FANTA ZERO 1.75L el 22/09: Coto, Changomas, La Anonima y la
-- Cooperativa decian 1750 cc; Vea, Disco y Jumbo (Cencosud) decian "1,7 cc",
-- que son litros cargados como centimetros cubicos; las cuatro banderas de
-- Carrefour decian "1 unidad". Tomar el de una fila cualquiera mostraba uno u
-- otro al azar.
--
-- La regla: "unidad" pierde contra cualquier g o cc, porque "1 unidad" es lo
-- que carga una cadena cuando no informa el peso. Entre los demas gana el que
-- declaran mas EMPRESAS, no mas banderas: con banderas, el error de Cencosud
-- valia tres votos. Empate: mas sucursales.
tamanos AS (
    SELECT
        id_producto,
        cantidad_normalizada,
        unidad_normalizada,
        COUNT(DISTINCT empresa) AS empresas_que_lo_dicen,
        SUM(sucursales) AS sucursales_que_lo_dicen
    FROM precios
    WHERE cantidad_normalizada IS NOT NULL AND unidad_normalizada IS NOT NULL
    GROUP BY id_producto, cantidad_normalizada, unidad_normalizada
),

tamano_producto AS (
    SELECT
        id_producto,
        ARRAY_AGG(
            STRUCT(cantidad_normalizada, unidad_normalizada)
            ORDER BY unidad_normalizada = "unidad", empresas_que_lo_dicen DESC, sucursales_que_lo_dicen DESC
            LIMIT 1
        )[OFFSET(0)] AS tamano
    FROM tamanos
    GROUP BY id_producto
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
    -- El tamaño del envase, para que la pagina pueda decir "1 kg" aunque la
    -- descripcion que manda SEPA venga cortada: "PLAYADITO YERBA CON" es la
    -- descripcion completa de un paquete de 500 g, y "AMAND" es Amanda. Es el
    -- mismo en todas las filas del producto: ver tamano_producto.
    tp.tamano.cantidad_normalizada AS cantidad_normalizada,
    tp.tamano.unidad_normalizada AS unidad_normalizada,
    ev.precio_creible,
    ev.precio_en_rango,
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
LEFT JOIN tamano_producto AS tp
    ON ev.id_producto = tp.id_producto
