-- Promos vigentes (datos actuales) a nivel producto-sucursal.
-- Una fila por cada promo activa (promo1 y promo2 se tratan por separado).
-- Alimenta la página de promos del dashboard: qué está en oferta, cuánto,
-- con qué mecánica (leyenda), en qué cadena/sucursal y dónde (lat/long).

WITH base AS (
    -- Traemos precio de lista + las dos promos + ubicación, del día más reciente.
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
    FROM {{ source('sepa', 'productos') }} AS p
    WHERE p.fecha_datos = (SELECT MAX(fecha_datos) FROM {{ source('sepa', 'productos') }})
      AND p.productos_precio_lista IS NOT NULL
),

-- Desarmamos las dos promos en filas separadas (una por promo)
promos_separadas AS (
    -- Promo 1
    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo1 AS precio_promo,
        leyenda_promo1 AS leyenda,
        'promo1' AS tipo_promo,
        id_comercio, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo1 IS NOT NULL AND precio_promo1 > 0

    UNION ALL

    -- Promo 2
    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo2 AS precio_promo,
        leyenda_promo2 AS leyenda,
        'promo2' AS tipo_promo,
        id_comercio, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo2 IS NOT NULL AND precio_promo2 > 0
),

-- Calculamos el descuento y filtramos las que valen la pena (>10%)
con_descuento AS (
    SELECT
        *,
        ROUND((precio_lista - precio_promo) / precio_lista * 100, 1) AS descuento_pct
    FROM promos_separadas
    WHERE precio_promo < precio_lista  -- descarta errores (promo >= lista)
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
    c.razon_social AS cadena,
    s.provincia,
    s.localidad,
    s.barrio,
    s.latitud,
    s.longitud,
    d.fecha_datos
FROM con_descuento AS d
LEFT JOIN {{ ref('stg_categorias') }} AS cat
    ON d.id_producto = cat.id_producto
LEFT JOIN {{ ref('stg_sucursales') }} AS s
    ON d.id_comercio = s.id_comercio
    AND d.id_sucursal = s.id_sucursal
LEFT JOIN {{ ref('stg_comercio') }} AS c
    ON d.id_comercio = c.id_comercio
WHERE d.descuento_pct >= 10  -- solo promos que valen la pena