-- El ultimo cambio de precio que vale la pena contar, por producto y cadena
-- (openspec historia-de-precio). Lo lee la API y lo pega a cada precio de
-- Mismo producto; el detalle dice "Bajo 10% el 25/11" y Tu lista "Bajo 6% en
-- Dia el 25/11". La regla vive aca y en ningun otro lado.
--
-- Cuenta solo si:
--   * el ultimo cambio paso en los ultimos cambio_precio_dias (30) dias,
--   * movio el precio cambio_precio_minimo_pct (3%) o mas,
--   * y ese ultimo precio es el que el sitio muestra hoy.
-- La primera fila de un producto no tiene precio anterior: no es un cambio.
--
-- Es un mart aparte y no columnas de mart_mismo_producto porque la historia
-- depende de ese mart: leerla desde ahi seria un ciclo.

WITH numeradas AS (
    SELECT
        id_producto,
        cadena,
        fecha_precio,
        precio,
        ROW_NUMBER() OVER (PARTITION BY id_producto, cadena ORDER BY fecha_datos DESC) AS orden,
        LEAD(precio) OVER (PARTITION BY id_producto, cadena ORDER BY fecha_datos DESC) AS precio_anterior
    FROM {{ ref("historico_precio_producto") }}
),

actual AS (
    SELECT fecha_datos, id_producto, cadena, precio_mediano
    FROM {{ ref("mart_mismo_producto") }}
    WHERE precio_creible
        -- "Lo que mas subio" de la portada es entre supermercados
        -- (openspec sumar-mayoristas): sin mayoristas.
        AND COALESCE(formato, 'supermercado') != 'mayorista'
)

SELECT
    n.id_producto,
    n.cadena,
    n.precio,
    n.precio_anterior,
    n.fecha_precio AS fecha_cambio,
    ROUND((n.precio / n.precio_anterior - 1) * 100, 1) AS cambio_pct
FROM numeradas AS n
JOIN actual AS a
    ON a.id_producto = n.id_producto
    AND a.cadena = n.cadena
    AND ABS(a.precio_mediano - n.precio) <= 0.005
WHERE n.orden = 1
    AND n.precio_anterior > 0
    AND n.fecha_precio >= DATE_SUB(a.fecha_datos, INTERVAL {{ var("cambio_precio_dias") }} DAY)
    AND ABS(n.precio / n.precio_anterior - 1) * 100 >= {{ var("cambio_precio_minimo_pct") }}
