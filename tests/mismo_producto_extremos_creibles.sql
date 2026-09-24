-- Ningun extremo de El mismo producto puede contradecir a la mediana entre
-- empresas sin que otra cadena lo confirme. Es la invariante que define la
-- seccion: la brecha que publica tiene que salir de precios que el mercado
-- respalde.
--
-- El 2026-09-21 no se cumplia y no habia forma de notarlo. FANTA ZERO 1.75L
-- encabezaba con 1.579% de diferencia porque dos banderas de ChangoMas la
-- informaban a $309 y $369 contra $5.150 del resto; revisados los 12 destacados
-- de ese dia, los 12 eran errores de la fuente. Los tests que habia miraban la
-- coherencia de cada cadena consigo misma, que es justo lo que un error de
-- cadena entera no rompe.
--
-- Desde el 2026-09-23 un extremo puede quedar fuera del rango si otra cadena lo
-- confirma (ver coincidencias en el modelo). El test lo verifica por su cuenta,
-- con el precio de las filas y no con la columna que calcula el modelo: un
-- extremo fuera de rango sin otra cadena a menos de la tolerancia es una falla.
--
-- No escanea nada: son columnas del mismo mart comparadas entre si.

WITH extremos_fuera_de_rango AS (
    SELECT id_producto, cadena, descripcion, precio_mediano, precio_referencia
    FROM {{ ref("mart_mismo_producto") }}
    WHERE precio_creible
        AND precio_referencia IS NOT NULL
        AND precio_mediano IN (precio_mas_bajo, precio_mas_alto)
        AND (
            precio_mediano < precio_referencia * {{ var("mismo_producto_piso_creible") }}
            OR precio_mediano > precio_referencia * {{ var("mismo_producto_techo_creible") }}
        )
)

SELECT e.id_producto, e.cadena, e.descripcion, e.precio_mediano, e.precio_referencia
FROM extremos_fuera_de_rango AS e
WHERE NOT EXISTS (
    SELECT 1
    FROM {{ ref("mart_mismo_producto") }} AS o
    WHERE o.id_producto = e.id_producto
        AND o.cadena != e.cadena
        AND ABS(o.precio_mediano - e.precio_mediano) <= e.precio_mediano * {{ var("mismo_producto_tolerancia_coincidencia") }}
)
