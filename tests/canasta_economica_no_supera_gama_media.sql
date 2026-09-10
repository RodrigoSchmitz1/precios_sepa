-- La canasta se arma con productos de gama ECONOMICA, asi que su precio por
-- unidad no puede superar al de un producto tipico de gama MEDIA de la misma
-- categoria y unidad. Si lo supera, la gama se esta aplicando mal.
--
-- Es el test que hubiera detectado el problema del 2026-09-10: la gama se unia
-- solo por producto, y un producto que viene en gramos en una cadena y como
-- "1 unidad" en otra quedaba clasificado con la unidad equivocada. Milanesas y
-- nuggets entraban como pollo economico y la canasta publicaba el pollo a
-- $18.323/kg, mas caro que la carne vacuna. Ningun test fallaba, porque cada
-- tabla por separado era consistente: el error estaba en como se unian.
--
-- Se compara la mediana nacional de la canasta (entre localidades, ultima
-- fecha) contra la mediana de la gama media. Las dos son medianas de muchas
-- observaciones, asi que no se cruzan por ruido de una localidad cara.

WITH ultima AS (
    SELECT MAX(fecha_datos) AS fecha FROM {{ ref("mart_canasta_detalle") }}
),

canasta AS (
    SELECT
        d.categoria,
        comp.unidad,
        APPROX_QUANTILES(d.precio_mediano_unidad, 2)[OFFSET(1)] AS precio_canasta
    FROM {{ ref("mart_canasta_detalle") }} AS d
    JOIN {{ ref("composicion_canasta") }} AS comp USING (categoria)
    WHERE d.fecha_datos = (SELECT fecha FROM ultima)
    GROUP BY d.categoria, comp.unidad
),

gama_media AS (
    SELECT
        categoria,
        unidad_normalizada,
        APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_medio
    FROM {{ ref("mart_gama_productos") }}
    WHERE gama = "medio"
    GROUP BY categoria, unidad_normalizada
)

SELECT
    c.categoria,
    c.precio_canasta,
    g.precio_medio
FROM canasta AS c
JOIN gama_media AS g
    ON c.categoria = g.categoria
    AND c.unidad = g.unidad_normalizada
WHERE c.precio_canasta > g.precio_medio
