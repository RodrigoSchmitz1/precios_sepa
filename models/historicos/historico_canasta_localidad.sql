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

-- Historico de canasta basica (KPI 2), una foto por fecha_datos y localidad.
-- IMPORTANTE: nunca correr con --full-refresh sobre este modelo -- los datos
-- crudos solo tienen unos pocos dias de ventana, asi que un full-refresh
-- reconstruiria la tabla desde cero y borraria TODA la historia acumulada.
-- Ya no hace falta filtrar por cobertura: desde el 2026-09-08 el mart emite
-- unicamente localidades con la canasta COMPLETA, que son las unicas cuyo costo
-- se puede comparar contra otra localidad o contra si misma en otra fecha.
--
-- ATENCION: las filas anteriores al 2026-09-08 se calcularon con la metodologia
-- vieja (se sumaban las categorias que cada localidad tuviera, entre 20 y 30 de
-- 32) y NO son comparables con las nuevas. Una localidad podia figurar barata
-- solo porque le faltaban categorias.

SELECT
    localidad,
    provincia,
    categorias_en_canasta,
    costo_canasta_total,
    fecha_datos
FROM {{ ref("mart_canasta_localidad") }}

-- Sin filtro incremental a proposito. Con insert_overwrite, dbt reemplaza
-- exactamente las particiones presentes en el resultado (las fechas que haya
-- hoy en el crudo) y deja intactas las demas. Un filtro
-- "fecha_datos > MAX(fecha_datos)" impediria recuperar una fecha perdida:
-- al ser anterior al maximo ya acumulado, nunca volveria a entrar.
