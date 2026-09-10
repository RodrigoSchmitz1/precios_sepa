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
-- Todas las filas actuales (2026-09-06 a 2026-09-08) se recalcularon el
-- 2026-09-10 con la gama corregida a producto x unidad (ver
-- mart_gama_productos), forzando las fechas con la variable recalcular_fechas.
-- La version anterior clasificaba como economicos productos caros que venian
-- en dos unidades distintas segun la cadena: inflaba pollo, pan y papa, y el
-- costo mediano de la canasta daba 34% mas alto.

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
