-- Ningun extremo de El mismo producto puede contradecir a la mediana entre
-- empresas. Es la invariante que define la seccion: la brecha que publica tiene
-- que salir de precios que el mercado respalde.
--
-- El 2026-09-21 no se cumplia y no habia forma de notarlo. FANTA ZERO 1.75L
-- encabezaba con 1.579% de diferencia porque dos banderas de ChangoMas la
-- informaban a $309 y $369 contra $5.150 del resto; revisados los 12 destacados
-- de ese dia, los 12 eran errores de la fuente. Los tests que habia miraban la
-- coherencia de cada cadena consigo misma, que es justo lo que un error de
-- cadena entera no rompe.
--
-- No escanea nada: son columnas del mismo mart comparadas entre si.

SELECT DISTINCT
    id_producto,
    descripcion,
    precio_referencia,
    precio_mas_bajo,
    precio_mas_alto
FROM {{ ref("mart_mismo_producto") }}
WHERE precio_referencia IS NOT NULL
    AND (
        precio_mas_bajo < precio_referencia * {{ var("mismo_producto_piso_creible") }}
        OR precio_mas_alto > precio_referencia * {{ var("mismo_producto_techo_creible") }}
    )
