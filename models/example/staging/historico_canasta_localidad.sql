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
-- Solo incluye localidades con categorias_disponibles >= 20 (mismo umbral
-- de confiabilidad que aplica la API en /canasta), para no guardar fotos
-- de localidades con cobertura pobre.

SELECT
    localidad,
    provincia,
    categorias_disponibles,
    costo_canasta_total,
    fecha_datos
FROM {{ ref("mart_canasta_localidad") }}
WHERE categorias_disponibles >= 20

-- Sin filtro incremental a proposito. Con insert_overwrite, dbt reemplaza
-- exactamente las particiones presentes en el resultado (las fechas que haya
-- hoy en el crudo) y deja intactas las demas. Un filtro
-- "fecha_datos > MAX(fecha_datos)" impediria recuperar una fecha perdida:
-- al ser anterior al maximo ya acumulado, nunca volveria a entrar.
