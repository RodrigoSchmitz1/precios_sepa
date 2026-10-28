-- El indice de inflacion tiene que medir los basicos. Falla si, en la ultima
-- fecha del historico, menos de 30 de las 32 categorias de la canasta tienen
-- factor en al menos 3 empresas (lo que pide la API para publicar una
-- categoria). Hasta el 2026-10-28 contaba cadenas, y las cuatro banderas de
-- Carrefour sumaban como cuatro; la API paso a pedir empresas y el test con
-- ella. Medido ese dia: 31 de 32 con empresas, 32 con cadenas.
--
-- Es el test que faltaba el 2026-10-27: con el factor solo sobre la gama
-- economica y 20 productos pareados, azucar, manteca y papa no tenian indice en
-- ninguna cadena y leche, arroz y pan en 1 o 2. La pagina de inflacion los
-- omitia sin error, y ningun test lo veia porque cada serie que SI tenia factor
-- estaba bien calculada: lo que faltaba eran series. Medido ese dia, con todas
-- las gamas y 10 productos quedan las 32.
--
-- Se mide en la ultima fecha y no en todo el periodo: un dia sin factor es un
-- problema de ese dia, y este test corre todos los dias.
--
-- Lee una particion del historico y dos seeds: unos pocos MB.

{% set minimo_categorias = 30 %}

WITH ultima AS (
    SELECT MAX(fecha_datos) AS fecha FROM {{ ref("historico_precios_cadena_categoria") }}
),

con_indice AS (
    SELECT s.categoria
    FROM {{ ref("composicion_canasta") }} AS s
    JOIN {{ ref("historico_precios_cadena_categoria") }} AS h
        ON h.categoria = s.categoria
        AND h.unidad_normalizada = s.unidad
    -- Las banderas de una empresa comparten id_comercio; una cadena que no
    -- esta en la seed cuenta como empresa propia (igual que en la API).
    LEFT JOIN {{ ref("mapeo_cadenas") }} AS e
        ON e.nombre_comercial = h.cadena
    WHERE h.fecha_datos = (SELECT fecha FROM ultima)
        AND h.factor_vs_base IS NOT NULL
    GROUP BY s.categoria
    HAVING COUNT(DISTINCT COALESCE(CAST(e.id_comercio AS STRING), h.cadena)) >= 3
)

SELECT
    (SELECT fecha FROM ultima) AS fecha,
    (SELECT COUNT(*) FROM con_indice) AS categorias_con_indice,
    ARRAY(
        SELECT s.categoria FROM {{ ref("composicion_canasta") }} AS s
        WHERE s.categoria NOT IN (SELECT categoria FROM con_indice)
        ORDER BY s.categoria
    ) AS sin_indice
FROM (SELECT 1)
WHERE (SELECT COUNT(*) FROM con_indice) < {{ minimo_categorias }}
