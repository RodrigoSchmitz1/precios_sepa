-- Todas las promos del ultimo dia del crudo, con la evidencia disponible para
-- decidir si el descuento es creible. Es la base de mart_promos_vigentes y
-- mart_promos_por_sucursal (a traves de promos_validas).
--
-- POR QUE EXISTE (2026-09-10). Hasta entonces las promos se filtraban con un
-- tope fijo: se mostraban las de 10% a 70% de descuento, sin importar la cadena.
-- El tope salio de mirar colchones a "98,8% OFF" y fallaba en las dos
-- direcciones. Analisis sobre los CSV completos del 2026-09-09 (1,2 millones de
-- filas de promo):
--
-- - El problema es solo de Carrefour (sus 4 banderas). Dia, La Anonima y
--   Cooperativa Obrera declaran el porcentaje en la leyenda ("50% de descuento.
--   2X1 TANG", "Descuentazo 30%") y coincide con el calculado en el 99,5% al
--   100% de 965.175 promos. La mas agresiva de esas promos es de 70%.
-- - Carrefour pone la misma leyenda generica en todas ("Promo A valida desde...")
--   y mezcla promos reales (Kolynos $2.400 -> $1.440, verificada en su web) con
--   valores que no son precios (una notebook de $1.439.000 "a $214.900", un
--   movil de juguete de $184.990 "a $1.900"). El tope de 70% dejaba pasar ~15.500
--   filas de Carrefour entre 50% y 70%, casi todas de ese segundo tipo.
-- - Se probaron y descartaron dos heuristicas sobre el propio dato (valor de
--   promo repetido entre productos de precio muy distinto, lista/promo igual a
--   una cantidad entera de cuotas): marcaban como falsas promos reales, como la
--   leche de marca propia o fruta de Coto.
--
-- El nivel de evidencia de cada promo, del mas firme al mas debil:
--   leyenda        la cadena declara el % y coincide (+-3 puntos)
--   mercado        el mismo producto tiene precio en otra empresa; se compara
--                  contra la lista mas barata de esa otra empresa
--   sin_verificar  no hay con que contrastarla
-- Una leyenda con un % que no coincide no confirma ni desmiente el precio, y la
-- promo pasa al nivel siguiente. Son compras multiples de Dia ("75% de
-- descuento. LLEVANDO 2" con el precio unitario 25% abajo): el 2026-09-09 eran
-- 3.941 filas de 7 productos, todas creibles frente a otra empresa, y
-- descartarlas las sacaba del sitio.
-- La decision de mostrar o no esta en promos_validas, con los umbrales fijos de
-- dbt_project.yml.

{% set fecha = ultima_fecha(source("sepa", "productos")) %}

WITH base AS (
    SELECT
        id_producto,
        productos_descripcion AS descripcion,
        productos_marca AS marca,
        SAFE_CAST(productos_precio_lista AS FLOAT64) AS precio_lista,
        SAFE_CAST(productos_precio_unitario_promo1 AS FLOAT64) AS precio_promo1,
        productos_leyenda_promo1 AS leyenda_promo1,
        SAFE_CAST(productos_precio_unitario_promo2 AS FLOAT64) AS precio_promo2,
        productos_leyenda_promo2 AS leyenda_promo2,
        id_comercio,
        id_bandera,
        id_sucursal,
        fecha_datos
    FROM {{ source("sepa", "productos") }}
    -- Fecha literal, no subconsulta: con "= (SELECT MAX(...))" BigQuery no poda
    -- particiones y escanea los tres dias.
    WHERE fecha_datos = DATE('{{ fecha }}')
        AND SAFE_CAST(productos_precio_lista AS FLOAT64) > 1
),

lista_por_empresa AS (
    -- Precio de lista mas bajo de cada producto en cada empresa, con TODAS las
    -- filas del dia y no solo las que tienen promo. id_comercio agrupa las
    -- banderas de una misma empresa (Carrefour, Market, Express y Maxi comparten
    -- id_comercio): la referencia tiene que salir de otra empresa, no de otra
    -- bandera de la misma, que suele tener el mismo maestro de precios.
    SELECT
        id_producto,
        id_comercio,
        MIN(precio_lista) AS lista_minima
    FROM base
    GROUP BY id_producto, id_comercio
),

dos_mas_baratas AS (
    -- Las dos empresas con la lista mas baja de cada producto. Si la mas barata
    -- es la misma empresa de la promo, la referencia es la segunda.
    SELECT
        id_producto,
        ARRAY_AGG(STRUCT(id_comercio, lista_minima) ORDER BY lista_minima LIMIT 2) AS top
    FROM lista_por_empresa
    GROUP BY id_producto
),

promos AS (
    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo1 AS precio_promo,
        leyenda_promo1 AS leyenda,
        "promo1" AS tipo_promo,
        id_comercio, id_bandera, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo1 > 0 AND precio_promo1 < precio_lista

    UNION ALL

    SELECT
        id_producto, descripcion, marca, precio_lista,
        precio_promo2 AS precio_promo,
        leyenda_promo2 AS leyenda,
        "promo2" AS tipo_promo,
        id_comercio, id_bandera, id_sucursal, fecha_datos
    FROM base
    WHERE precio_promo2 > 0 AND precio_promo2 < precio_lista
),

evidencia AS (
    SELECT
        p.*,
        ROUND((p.precio_lista - p.precio_promo) / p.precio_lista * 100, 1) AS descuento_pct,
        -- El primer porcentaje de la leyenda: "50% de descuento. 2X1 TANG" -> 50.
        SAFE_CAST(
            REPLACE(REGEXP_EXTRACT(p.leyenda, r"(\d{1,2}(?:[.,]\d+)?)\s*%"), ",", ".")
            AS FLOAT64
        ) AS descuento_declarado,
        -- Promos que solo valen comprando varias unidades: el precio es por
        -- unidad, pero la condicion tiene que llegar al que lo lee.
        REGEXP_CONTAINS(
            LOWER(IFNULL(p.leyenda, "")),
            r"llevando|\b\d\s*x\s*\d\b|\b\d\s*x\s*\$|\b\d\s*(?:da|do)\b[^%]*\bal\b"
        ) AS requiere_compra_multiple,
        CASE
            WHEN d.top[SAFE_OFFSET(0)].id_comercio != p.id_comercio THEN d.top[SAFE_OFFSET(0)].lista_minima
            ELSE d.top[SAFE_OFFSET(1)].lista_minima
        END AS lista_referencia_mercado
    FROM promos AS p
    LEFT JOIN dos_mas_baratas AS d USING (id_producto)
)

SELECT
    *,
    CASE
        WHEN descuento_declarado IS NOT NULL AND ABS(descuento_declarado - descuento_pct) <= 3 THEN "leyenda"
        WHEN lista_referencia_mercado IS NOT NULL THEN "mercado"
        ELSE "sin_verificar"
    END AS nivel_evidencia,
    SAFE_DIVIDE(precio_promo, lista_referencia_mercado) AS cociente_mercado
FROM evidencia
