{{
  config(
    materialized="incremental",
    incremental_strategy="insert_overwrite",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date"
    },
    partition_expiration_days=none,
    on_schema_change="append_new_columns"
  )
}}

-- Historico de "quien gana" (KPI 3), una foto por fecha_datos.
-- IMPORTANTE: nunca correr con --full-refresh sobre este modelo -- los datos
-- crudos solo tienen unos pocos dias de ventana, asi que un full-refresh
-- reconstruiria la tabla desde cero y borraria TODA la historia acumulada,
-- reemplazandola por la foto de hoy. Es irreversible.
-- fecha_datos = fecha real de los precios (no la fecha de corrida del pipeline).
--
-- on_schema_change="append_new_columns": productos_ofrecidos y
-- pct_gana_cuando_compite se agregaron el 2026-09-09, con la tabla ya creada.
-- Con el "ignore" que trae dbt por defecto se ignorarian en silencio.
-- Las filas anteriores no las tienen y su crudo ya expiro, asi que la tasa
-- correcta ("cuando compite, gana X%") arranca en esa fecha. pct_victorias se
-- conserva justamente para no cortar la serie que ya venia.

SELECT
    categoria,
    rubro,
    cadena,
    productos_ganados,
    productos_ofrecidos,
    total_productos_categoria,
    pct_victorias,
    pct_gana_cuando_compite,
    fecha_datos
FROM {{ ref("mart_quien_gana") }}

-- Sin filtro incremental a proposito. Con insert_overwrite, dbt reemplaza
-- exactamente las particiones presentes en el resultado (las fechas que haya
-- hoy en el crudo) y deja intactas las demas. Un filtro
-- "fecha_datos > MAX(fecha_datos)" impediria recuperar una fecha perdida:
-- al ser anterior al maximo ya acumulado, nunca volveria a entrar.
