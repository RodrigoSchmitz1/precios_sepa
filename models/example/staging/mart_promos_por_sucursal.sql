-- Promos vigentes a nivel sucursal individual, con ubicacion geografica.
-- Complementa a mart_promos_vigentes (que agrupa por cadena+provincia para
-- listados legibles): este modelo mantiene el detalle por sucursal porque
-- el mapa SI necesita el punto exacto -- es un uso distinto del mismo dato,
-- no un cambio de opinion sobre el agrupado. No agrega costo de storage:
-- usa la misma ventana de 3 dias ya cargada.
-- El join a stg_comercio usa id_comercio + id_bandera (no solo id_comercio)
-- para no multiplicar cada fila por cada bandera de la cadena.

WITH base AS (
    SELECT
        p.id_producto,
        p.productos_descripcion AS descripcion,
        p.productos_marca AS marca,
        CAST(p.productos_precio_lista AS FLOAT64) AS precio_lista,
        CAST(p.productos_precio_unitario_promo1 AS FLOAT64) AS precio_promo1,
        p.productos_leyenda_promo1 AS leyenda_promo1,
        CAST(p.productos_precio_unitario_promo2 AS FLOAT64) AS precio_promo2,
        p.productos_leyenda_promo2 AS leyenda_promo2,
        p.id_comercio,
        p.id_bandera,
        p.id_sucursal,
        p.fecha_datos
    FROM {{ source("sepa", "productos") }} AS p
    WHERE p.fecha_datos = (SELECT MAX(fecha_datos) FROM {{ source("sepa", "productos") }})
      AND p.productos_precio_lista IS NOT NULL
),

promos_separadas AS (
    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo1 AS precio_promo,
        leyenda_promo1 AS leyenda,
        "promo1" AS tipo_promo,
        id_comercio, id_bandera, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo1 IS NOT NULL AND precio_promo1 > 0

    UNION ALL

    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo2 AS precio_promo,
        leyenda_promo2 AS leyenda,
        "promo2" AS tipo_promo,
        id_comercio, id_bandera, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo2 IS NOT NULL AND precio_promo2 > 0
),

con_descuento AS (
    SELECT
        *,
        ROUND((precio_lista - precio_promo) / precio_lista * 100, 1) AS descuento_pct
    FROM promos_separadas
    WHERE precio_promo < precio_lista
)

SELECT
    d.id_producto,
    d.descripcion,
    d.marca,
    cat.categoria,
    cat.rubro,
    c.nombre_comercial AS cadena,
    s.nombre_sucursal,
    s.calle,
    s.numero,
    s.barrio,
    s.localidad,
    s.provincia,
    s.latitud,
    s.longitud,
    d.precio_lista,
    d.precio_promo,
    d.descuento_pct,
    d.leyenda,
    d.tipo_promo,
    d.fecha_datos
FROM con_descuento AS d
LEFT JOIN {{ ref("stg_categorias") }} AS cat ON d.id_producto = cat.id_producto
LEFT JOIN {{ ref("stg_sucursales") }} AS s ON d.id_comercio = s.id_comercio AND d.id_sucursal = s.id_sucursal
LEFT JOIN {{ ref("stg_comercio") }} AS c ON d.id_comercio = c.id_comercio AND d.id_bandera = c.id_bandera
WHERE d.descuento_pct >= 10
  AND s.latitud IS NOT NULL
  AND s.longitud IS NOT NULL
