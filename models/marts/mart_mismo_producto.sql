-- "El mismo producto": cuanto cuesta el mismo codigo de barras en cada cadena.
--
-- Una fila por producto x cadena, solo del ultimo dia: responde "cuanto sale
-- hoy", no alimenta ningun historico. Mismo codigo de barras quiere decir misma
-- presentacion, asi que los precios se comparan directo, sin normalizar por
-- gramo ni litro.
--
-- Solo entran productos con precio en 2 o mas cadenas, igual que en
-- mart_quien_gana: con una sola cadena no hay contra que comparar.
--
-- El precio de cada cadena es la mediana entre sus sucursales, que resiste a
-- una sucursal con un precio mal cargado. Con pocas sucursales esa defensa se
-- debilita, por eso va la cantidad en cada fila: la pagina tiene que poder
-- decir "en 1 sucursal" y no destacar una diferencia que depende de un dato
-- suelto.
--
-- Lee int_precio_producto_cadena y no stg_productos: el escaneo grande ya lo
-- pago ese modelo, que comparte con mart_quien_gana.

{% set fecha = ultima_fecha(ref("int_precio_producto_cadena")) %}

WITH precios AS (
    SELECT
        fecha_datos,
        id_producto,
        cadena,
        precio_mediano,
        precio_minimo,
        precio_maximo,
        sucursales
    FROM {{ ref("int_precio_producto_cadena") }}
    WHERE fecha_datos = DATE('{{ fecha }}')
),

por_producto AS (
    SELECT
        id_producto,
        COUNT(*) AS cadenas,
        MIN(precio_mediano) AS precio_mas_bajo,
        MAX(precio_mediano) AS precio_mas_alto
    FROM precios
    GROUP BY id_producto
    HAVING COUNT(*) >= 2
)

SELECT
    pr.fecha_datos,
    pr.id_producto,
    cat.descripcion,
    cat.marca,
    cat.categoria,
    cat.rubro,
    pr.cadena,
    pr.precio_mediano,
    pr.precio_minimo,
    pr.precio_maximo,
    pr.sucursales,
    pp.cadenas,
    pp.precio_mas_bajo,
    pp.precio_mas_alto,
    -- stg_productos descarta precios <= 1, asi que no hay division por cero.
    ROUND((pp.precio_mas_alto - pp.precio_mas_bajo) / pp.precio_mas_bajo * 100, 1) AS diferencia_pct,
    pr.precio_mediano = pp.precio_mas_bajo AS es_el_mas_barato
FROM precios AS pr
JOIN por_producto AS pp
    ON pr.id_producto = pp.id_producto
JOIN {{ ref("stg_categorias") }} AS cat
    ON pr.id_producto = cat.id_producto
