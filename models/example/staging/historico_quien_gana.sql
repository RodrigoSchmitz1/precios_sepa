{{
  config(
    materialized="incremental",
    incremental_strategy="insert_overwrite",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date"
    },
    partition_expiration_days=none
  )
}}

-- Historico de "quien gana" (KPI 3), una foto por fecha_datos.
-- IMPORTANTE: nunca correr con --full-refresh sobre este modelo -- los datos
-- crudos solo tienen unos pocos dias de ventana, asi que un full-refresh
-- reconstruiria la tabla desde cero y borraria TODA la historia acumulada,
-- reemplazandola por la foto de hoy. Es irreversible.
-- fecha_datos = fecha real de los precios (no la fecha de corrida del pipeline).

SELECT
    categoria,
    rubro,
    cadena,
    productos_ganados,
    total_productos_categoria,
    pct_victorias,
    fecha_datos
FROM {{ ref("mart_quien_gana") }}

{% if is_incremental() %}
WHERE fecha_datos > (SELECT MAX(fecha_datos) FROM {{ this }})
{% endif %}
