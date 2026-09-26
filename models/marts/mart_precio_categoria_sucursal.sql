-- Precio mediano por unidad para cada categoria x gama x unidad x SUCURSAL, con
-- la ubicacion de la sucursal. Es la base de la Fase 4: armar la compra de una
-- canasta entre las sucursales cercanas, eligiendo en cual conviene comprar
-- cada cosa.
--
-- Es el hermano por sucursal de mart_precio_categoria_localidad, que agrega por
-- localidad y alimenta "Tu canasta". Se calculan por separado y no uno a partir
-- del otro: la mediana de un conjunto no es la mediana de las medianas de sus
-- partes, asi que derivar la localidad de las sucursales cambiaria un numero ya
-- publicado (el costo de la canasta) sin ninguna necesidad.
--
-- Solo la fecha mas reciente, con literal y no con subconsulta: un MAX() impide
-- que BigQuery pode particiones (ver el macro ultima_fecha). La API lo carga
-- entero en memoria y optimiza en Python, asi que no hay una consulta por
-- visitante.
--
-- DOS DIFERENCIAS CON EL MART POR LOCALIDAD, Y LAS DOS IMPORTAN:
--
-- 1. El recorte de outliers se calcula por LOCALIDAD, no por sucursal. A nivel
--    sucursal cada combinacion tiene un punado de productos, asi que un recorte
--    p10-p90 dentro del grupo borraria justo el mas barato y el mas caro de cada
--    sucursal, que es exactamente lo que la Fase 4 necesita comparar. Recortar
--    contra el mercado local saca los precios absurdos sin aplanar las
--    diferencias entre sucursales vecinas.
--
-- 2. El minimo de muestras es mas bajo que las 10 del mart por localidad: una
--    sucursal ofrece unas decenas de productos por categoria, no miles. El valor
--    esta en la variable muestras_minimas_sucursal para poder calibrarlo cuando
--    se mida la cobertura real; con 3, una mediana ya resiste un precio suelto
--    mal cargado.

{% set fecha = ultima_fecha(ref("stg_productos")) %}

WITH productos_filtrados AS (
    SELECT
        cat.categoria,
        gama.gama,
        p.unidad_normalizada,
        p.id_comercio,
        p.id_sucursal,
        s.localidad,
        s.provincia,
        s.latitud,
        s.longitud,
        com.nombre_comercial AS cadena,
        s.nombre_sucursal,
        s.calle,
        s.numero,
        p.fecha_datos,
        p.precio / {{ cantidad_efectiva("p", "gama") }} AS precio_por_unidad
    FROM {{ ref("stg_productos") }} AS p
    JOIN {{ ref("stg_categorias") }} AS cat ON p.id_producto = cat.id_producto
    -- La gama se une por producto Y unidad, igual que en el mart por localidad:
    -- un mismo producto puede venir en gramos en una cadena y como "1 unidad"
    -- en otra, y cada unidad tiene su propia gama.
    JOIN {{ ref("mart_gama_productos") }} AS gama
        ON p.id_producto = gama.id_producto
        AND p.unidad_normalizada = gama.unidad_normalizada
    JOIN {{ ref("stg_sucursales") }} AS s
        ON p.id_comercio = s.id_comercio AND p.id_sucursal = s.id_sucursal
    -- El nombre de la cadena sale de stg_comercio, y el join va por id_comercio
    -- Y id_bandera: solo por id_comercio, cada fila se replica una vez por
    -- bandera de la empresa. Es el bug que inflo el universo comparable un 35%.
    JOIN {{ ref("stg_comercio") }} AS com
        ON s.id_comercio = com.id_comercio AND s.id_bandera = com.id_bandera
    WHERE p.fecha_datos = DATE('{{ fecha }}')
        AND s.localidad IS NOT NULL
        -- Sin coordenadas la sucursal no sirve para esta feature: no se puede
        -- saber si esta dentro del radio que elige el usuario.
        AND s.latitud IS NOT NULL
        AND s.longitud IS NOT NULL
        AND p.cantidad_normalizada IS NOT NULL
        -- Rango de sanidad y paquetes cargados como "1 unidad": ver el macro
        -- piezas_por_envase.
        AND {{ cantidad_razonable("p", "gama") }}
),

limites AS (
    -- Por localidad, no por sucursal: ver la nota 1 del encabezado.
    SELECT
        categoria,
        gama,
        unidad_normalizada,
        localidad,
        provincia,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(10)] AS p10,
        APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(90)] AS p90
    FROM productos_filtrados
    GROUP BY categoria, gama, unidad_normalizada, localidad, provincia
),

sin_outliers AS (
    SELECT pf.*
    FROM productos_filtrados AS pf
    JOIN limites AS l
        ON pf.categoria = l.categoria
        AND pf.gama = l.gama
        AND pf.unidad_normalizada = l.unidad_normalizada
        AND pf.localidad = l.localidad
        AND pf.provincia = l.provincia
    WHERE pf.precio_por_unidad >= l.p10
      AND pf.precio_por_unidad <= l.p90
)

SELECT
    categoria,
    gama,
    unidad_normalizada,
    id_comercio,
    id_sucursal,
    cadena,
    nombre_sucursal,
    calle,
    numero,
    localidad,
    provincia,
    latitud,
    longitud,
    fecha_datos,
    APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
    COUNT(*) AS muestras
FROM sin_outliers
GROUP BY
    categoria, gama, unidad_normalizada, id_comercio, id_sucursal, cadena,
    nombre_sucursal, calle, numero, localidad, provincia, latitud, longitud,
    fecha_datos
HAVING COUNT(*) >= {{ var("muestras_minimas_sucursal") }}
