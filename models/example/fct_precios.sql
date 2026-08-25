SELECT
    p.id_comercio,
    p.id_sucursal,
    p.id_producto,
    c.razon_social,
    c.bandera_nombre,
    s.provincia,
    s.localidad,
    s.barrio,
    s.latitud,
    s.longitud,
    p.descripcion,
    p.marca,
    p.precio,
    p.fecha_datos,
    COALESCE(cat.categoria, 'Sin categoria') AS categoria,
    COALESCE(cat.rubro, 'Sin rubro') AS rubro
FROM {{ ref('stg_productos') }} AS p
LEFT JOIN {{ ref('stg_sucursales') }} AS s
    ON p.id_comercio = s.id_comercio
    AND p.id_sucursal = s.id_sucursal
LEFT JOIN {{ ref('stg_comercio') }} AS c
    ON p.id_comercio = c.id_comercio
    AND p.id_bandera = c.id_bandera
LEFT JOIN {{ ref('stg_categorias') }} AS cat
    ON p.id_producto = cat.id_producto