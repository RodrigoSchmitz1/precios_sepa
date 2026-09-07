-- Falla si algun producto tiene una combinacion (id_comercio, id_bandera) que
-- no existe en la dimension de comercio.
--
-- Los modelos unen productos con comercio por ESAS DOS claves. Usar solo
-- id_comercio replica cada fila una vez por bandera de la empresa (Coto tiene
-- 5, Cencosud 4), que fue justo el bug que inflaba el universo comparable de
-- mart_quien_gana un 35% en 2026-09. Este test verifica el otro lado del
-- mismo supuesto: que la clave compuesta siempre resuelva, asi el INNER JOIN
-- de los marts no descarta filas en silencio.
--
-- Se limita a la ultima fecha para no escanear la ventana entera en cada
-- corrida: si una bandera nueva aparece sin su fila de comercio, aparece ahi.

{% set fecha = ultima_fecha(ref("stg_productos")) %}

SELECT DISTINCT
    p.id_comercio,
    p.id_bandera
FROM {{ ref("stg_productos") }} AS p
LEFT JOIN {{ ref("stg_comercio") }} AS c
    ON p.id_comercio = c.id_comercio
    AND p.id_bandera = c.id_bandera
WHERE p.fecha_datos = DATE('{{ fecha }}')
  AND c.id_comercio IS NULL
