-- La gama existe para separar por NIVEL DE PRECIO, asi que dentro de cada
-- categoria y unidad el "economico" tiene que ser mas barato por unidad de
-- medida que el "premium". Suena obvio, y sin embargo no se cumplia: mientras
-- el tercil se calculo sobre el precio del ENVASE, en 4 de 47 categorias el
-- economico salia mas caro por unidad que el premium, porque el envase grande
-- (el mas barato por kilo) tenia el precio de paquete mas alto y caia en
-- premium. En Alimento para mascotas la diferencia era de 3,5 veces.
--
-- Este test hace que ese error no pueda volver en silencio: si alguien vuelve a
-- ordenar por precio de paquete, la corrida falla.
--
-- Se piden 10 productos por gama para no comparar medianas de muestras
-- diminutas, que se cruzarian por ruido y no por un problema real.

WITH por_gama AS (
    SELECT
        categoria,
        unidad_normalizada,
        gama,
        APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
        COUNT(*) AS productos
    FROM {{ ref('mart_gama_productos') }}
    GROUP BY categoria, unidad_normalizada, gama
    HAVING COUNT(*) >= 10
)

SELECT
    e.categoria,
    e.unidad_normalizada,
    e.precio_mediano_unidad AS precio_economico,
    p.precio_mediano_unidad AS precio_premium
FROM por_gama AS e
JOIN por_gama AS p
    ON e.categoria = p.categoria
    AND e.unidad_normalizada = p.unidad_normalizada
WHERE e.gama = 'economico'
    AND p.gama = 'premium'
    AND e.precio_mediano_unidad >= p.precio_mediano_unidad
