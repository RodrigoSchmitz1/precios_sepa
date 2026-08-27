-- Promos vigentes (datos actuales) a nivel producto-cadena-provincia.
-- Una fila por cada promo activa y zona de precio (promo1 y promo2 se tratan por separado).
-- Se agrupa por cadena+provincia (no por sucursal individual) porque el precio de
-- promo suele repetirse entre sucursales de una misma zona; agrupar evita filas
-- duplicadas y conserva la variacion real entre regiones (ej. Buenos Aires vs Chubut).
-- El join a stg_comercio usa id_comercio + id_bandera (no solo id_comercio) porque
-- una cadena puede tener varias banderas (ej. Carrefour/Market/Express/Maxi) con
-- nombre_comercial distinto; sin id_bandera, cada promo se multiplicaria una vez
-- por cada bandera de la cadena.

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
),

enriquecido AS (
    SELECT
        d.id_producto,
        d.descripcion,
        d.marca,
        cat.categoria,
        cat.rubro,
        c.nombre_comercial AS cadena,
        s.provincia,
        d.precio_lista,
        d.precio_promo,
        d.descuento_pct,
        d.leyenda,
        d.tipo_promo,
        d.id_sucursal,
        d.fecha_datos
    FROM con_descuento AS d
    LEFT JOIN {{ ref("stg_categorias") }} AS cat ON d.id_producto = cat.id_producto
    LEFT JOIN {{ ref("stg_sucursales") }} AS s ON d.id_comercio = s.id_comercio AND d.id_sucursal = s.id_sucursal
    LEFT JOIN {{ ref("stg_comercio") }} AS c ON d.id_comercio = c.id_comercio AND d.id_bandera = c.id_bandera
    WHERE d.descuento_pct >= 10
),

agrupado AS (
    SELECT
        id_producto,
        descripcion,
        marca,
        categoria,
        rubro,
        cadena,
        provincia,
        precio_lista,
        precio_promo,
        descuento_pct,
        leyenda,
        tipo_promo,
        COUNT(DISTINCT id_sucursal) AS sucursales_con_esta_promo,
        fecha_datos
    FROM enriquecido
    GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,14
)

SELECT * FROM agrupado
