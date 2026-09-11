-- Promos del mapa, una fila por promo con las sucursales donde vale. La API la carga
-- entera en memoria (api/mapa_promos.py): la misma promo se repite en cientos de sucursales.

{% set fecha = ultima_fecha(source("sepa", "productos")) %}

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
        p.id_sucursal,
        p.fecha_datos
    FROM {{ source("sepa", "productos") }} AS p
    -- Fecha literal, no subconsulta: con "= (SELECT MAX(...))" BigQuery no poda particiones.
    WHERE p.fecha_datos = DATE('{{ fecha }}')
        AND p.productos_precio_lista IS NOT NULL
),

promos_separadas AS (
    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo1 AS precio_promo,
        leyenda_promo1 AS leyenda,
        "promo1" AS tipo_promo,
        id_comercio, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo1 IS NOT NULL AND precio_promo1 > 0

    UNION ALL

    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo2 AS precio_promo,
        leyenda_promo2 AS leyenda,
        "promo2" AS tipo_promo,
        id_comercio, id_sucursal, fecha_datos
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
    d.precio_lista,
    d.precio_promo,
    d.descuento_pct,
    d.leyenda,
    d.tipo_promo,
    ARRAY_AGG(DISTINCT s.sucursal) AS sucursales,
    d.fecha_datos
FROM con_descuento AS d
JOIN {{ ref("mart_mapa_sucursales") }} AS s
    ON s.sucursal = CONCAT(d.id_comercio, "-", d.id_sucursal)
LEFT JOIN {{ ref("stg_categorias") }} AS cat
    ON d.id_producto = cat.id_producto
-- El techo descarta promos inverosimiles: ver descuento_maximo_plausible en dbt_project.yml.
WHERE d.descuento_pct BETWEEN 10 AND {{ var("descuento_maximo_plausible") }}
GROUP BY
    d.id_comercio, d.id_producto, d.descripcion, d.marca, cat.categoria, cat.rubro,
    d.precio_lista, d.precio_promo, d.descuento_pct, d.leyenda, d.tipo_promo, d.fecha_datos
