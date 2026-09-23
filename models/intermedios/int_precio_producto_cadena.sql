{{
  config(
    materialized="incremental",
    incremental_strategy="insert_overwrite",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date",
      "copy_partitions": true
    },
    partition_expiration_days=3
  )
}}

-- Precio de cada producto en cada cadena, por fecha: la mediana entre las
-- sucursales de la cadena, el rango y cuantas sucursales lo informan.
--
-- POR QUE ES UN MODELO APARTE (2026-09-10)
-- Era la primera CTE de mart_quien_gana. La necesita tambien
-- mart_mismo_producto, y BigQuery cobra por bytes LEIDOS: dos marts leyendo
-- stg_productos por su cuenta pagarian el mismo escaneo dos veces. Asi se lee
-- una vez, y los dos marts leen esta tabla, que tiene una fila por producto x
-- cadena en vez de una por sucursal.
--
-- Incremental con el mismo esquema que stg_productos: calcula las fechas que
-- todavia no estan mas la ultima, reemplaza particiones con copy jobs (que no
-- consumen cuota) y expira a los 3 dias, igual que su fuente. Se puede
-- reconstruir con --full-refresh: todo sale del crudo.
--
-- El join a stg_comercio va por id_comercio Y id_bandera. Solo por id_comercio
-- replica cada precio una vez por bandera de la empresa: es el bug del
-- 2026-09-06 que inflo el universo comparable de quien gana un 35%.

SELECT
    p.fecha_datos,
    p.id_producto,
    c.nombre_comercial AS cadena,
    -- La empresa dueña de la bandera. Carrefour tiene cuatro banderas (Hiper,
    -- Market, Express, Maxi) y Cencosud otras tantas: contar banderas y llamarlas
    -- "cadenas distintas" hace parecer que un producto compite en varias empresas
    -- cuando puede estar en una sola. Se lleva desde aca para no tener que volver
    -- a unir con stg_comercio aguas abajo.
    MIN(p.id_comercio) AS empresa,
    APPROX_QUANTILES(p.precio, 2)[OFFSET(1)] AS precio_mediano,
    MIN(p.precio) AS precio_minimo,
    MAX(p.precio) AS precio_maximo,
    COUNT(DISTINCT p.id_sucursal) AS sucursales,
    -- El tamaño del envase viaja desde aca porque este modelo YA escanea
    -- stg_productos: sumar dos columnas al agregado no cuesta un escaneo nuevo,
    -- y sacarlas despues obligaria a volver a leer la tabla grande.
    --
    -- Se toma la mediana y no un valor cualquiera: un mismo codigo de barras
    -- puede traer la cantidad mal cargada en alguna sucursal, igual que el
    -- precio, y la mediana lo aguanta. La unidad va con MIN, que es
    -- determinista; para un codigo de barras dado no deberia variar.
    -- SAFE_OFFSET y no OFFSET: cantidad_normalizada es NULL cuando la unidad
    -- no se reconoce, y APPROX_QUANTILES ignora los NULL. Si TODAS las filas de
    -- un producto x cadena la tienen nula, devuelve un array vacio y OFFSET(1)
    -- cortaria la corrida entera por un producto sin gramaje.
    APPROX_QUANTILES(p.cantidad_normalizada, 2)[SAFE_OFFSET(1)] AS cantidad_normalizada,
    MIN(p.unidad_normalizada) AS unidad_normalizada
FROM {{ ref("stg_productos") }} AS p
JOIN {{ ref("stg_comercio") }} AS c
    ON p.id_comercio = c.id_comercio
    AND p.id_bandera = c.id_bandera
{% if is_incremental() %}
WHERE p.fecha_datos IN ({{ fechas_a_calcular(ref("stg_productos"), this.identifier) }})
{% endif %}
GROUP BY p.fecha_datos, p.id_producto, c.nombre_comercial
