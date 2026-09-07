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

-- Historico de precios por cadena x categoria, una foto por fecha_datos.
-- Base generica para comparar cadenas en el tiempo y calcular evolucion de
-- precios / inflacion por categoria a nivel nacional. La inflacion en si
-- NO se persiste aca -- se calcula al vuelo (resta % entre dos fechas)
-- cuando se consulta, para poder elegir cualquier rango de fechas sin
-- quedar atado a un periodo fijo.
-- IMPORTANTE: nunca correr con --full-refresh sobre este modelo -- los datos
-- crudos solo tienen unos pocos dias de ventana, asi que un full-refresh
-- reconstruiria la tabla desde cero y borraria TODA la historia acumulada.

SELECT
    categoria,
    cadena,
    unidad_normalizada,
    precio_mediano_unidad,
    muestras,
    fecha_datos
FROM {{ ref("mart_precios_cadena_categoria") }}

-- Sin filtro incremental a proposito. Con insert_overwrite, dbt reemplaza
-- exactamente las particiones presentes en el resultado (las fechas que haya
-- hoy en el crudo) y deja intactas las demas. Un filtro
-- "fecha_datos > MAX(fecha_datos)" impediria recuperar una fecha perdida:
-- al ser anterior al maximo ya acumulado, nunca volveria a entrar.
