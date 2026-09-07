-- Precio mediano por unidad de medida, para cada combinacion de
-- categoria x gama x unidad x localidad. Es la base de la canasta
-- personalizada ("Tu canasta").
--
-- POR QUE EXISTE: la API calculaba esto al vuelo, una query por cada categoria
-- de la canasta del usuario, escaneando stg_productos entero cada vez. Medido:
-- 2.51 GB por categoria, o sea ~37 GB por una sola canasta de 15 categorias.
-- Con eso, unos 27 usuarios agotaban el TB mensual gratuito de BigQuery.
-- Precalcularlo una vez por dia deja la consulta de la API en una busqueda
-- sobre unas pocas decenas de miles de filas.
--
-- Solo se calcula la fecha mas reciente: la API sirve precios actuales, no
-- historia. El filtro usa una fecha literal (ver macro ultima_fecha) porque
-- una subconsulta MAX() impide que BigQuery pode particiones.
--
-- Mantiene los mismos criterios de calidad que el resto de los marts de
-- precios: solo cantidades fisicamente razonables, recorte de outliers por
-- percentil 10-90 y un minimo de 10 muestras.
--
-- NOTA sobre combinar localidades: cuando el usuario elige varias, la API
-- promedia estas medianas ponderando por muestras. Antes se calculaba una
-- mediana unica sobre el pool de todas las localidades juntas. El recorte de
-- outliers ahora es relativo a cada localidad, lo que evita que una localidad
-- barata entera quede recortada por comparacion contra otra cara.

{% set fecha = ultima_fecha(ref("stg_productos")) %}

WITH productos_filtrados AS (
    SELECT
        cat.categoria,
        gama.gama,
        p.unidad_normalizada,
        s.localidad,
        s.provincia,
        p.fecha_datos,
        p.precio / p.cantidad_normalizada AS precio_por_unidad
    FROM {{ ref("stg_productos") }} AS p
    JOIN {{ ref("stg_categorias") }} AS cat ON p.id_producto = cat.id_producto
    JOIN {{ ref("mart_gama_productos") }} AS gama ON p.id_producto = gama.id_producto
    JOIN {{ ref("stg_sucursales") }} AS s
        ON p.id_comercio = s.id_comercio AND p.id_sucursal = s.id_sucursal
    WHERE p.fecha_datos = DATE('{{ fecha }}')
        AND s.localidad IS NOT NULL
        AND p.cantidad_normalizada IS NOT NULL
        AND (
            (p.unidad_normalizada IN ("g", "cc") AND p.cantidad_normalizada BETWEEN 5 AND 10000)
            OR (p.unidad_normalizada = "unidad" AND p.cantidad_normalizada BETWEEN 1 AND 60)
        )
),

limites AS (
    SELECT
        categoria,
        gama,
        unidad_normalizada,
        localidad,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(10)] AS p10,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(90)] AS p90
    FROM productos_filtrados
    GROUP BY categoria, gama, unidad_normalizada, localidad
),

sin_outliers AS (
    SELECT pf.*
    FROM productos_filtrados AS pf
    JOIN limites AS l
        ON pf.categoria = l.categoria
        AND pf.gama = l.gama
        AND pf.unidad_normalizada = l.unidad_normalizada
        AND pf.localidad = l.localidad
    WHERE pf.precio_por_unidad >= l.p10
      AND pf.precio_por_unidad <= l.p90
)

SELECT
    categoria,
    gama,
    unidad_normalizada,
    localidad,
    provincia,
    fecha_datos,
    APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
    COUNT(*) AS muestras
FROM sin_outliers
GROUP BY categoria, gama, unidad_normalizada, localidad, provincia, fecha_datos
HAVING COUNT(*) >= 10
