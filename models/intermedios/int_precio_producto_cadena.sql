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
    APPROX_QUANTILES(p.precio, 2)[OFFSET(1)] AS precio_mediano,
    MIN(p.precio) AS precio_minimo,
    MAX(p.precio) AS precio_maximo,
    COUNT(DISTINCT p.id_sucursal) AS sucursales
FROM {{ ref("stg_productos") }} AS p
JOIN {{ ref("stg_comercio") }} AS c
    ON p.id_comercio = c.id_comercio
    AND p.id_bandera = c.id_bandera
{% if is_incremental() %}
WHERE p.fecha_datos IN ({{ fechas_a_calcular(ref("stg_productos"), this.identifier) }})
{% endif %}
GROUP BY p.fecha_datos, p.id_producto, c.nombre_comercial
