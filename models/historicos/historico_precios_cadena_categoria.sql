{{
  config(
    materialized="incremental",
    incremental_strategy="insert_overwrite",
    on_schema_change="append_new_columns",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date"
    },
    partition_expiration_days=none
  )
}}

-- on_schema_change="append_new_columns": las columnas del indice encadenado se
-- agregaron cuando la tabla ya existia. Con el "ignore" que trae dbt por
-- defecto, las ignoraria en silencio y el historico se quedaria sin factores
-- para siempre. Append solo agrega; nunca borra ni reescribe las que ya estan.

-- Historico de precios por cadena x categoria, una foto por fecha_datos.
-- Base generica para comparar cadenas en el tiempo y calcular evolucion de
-- precios / inflacion por categoria a nivel nacional. La inflacion en si
-- NO se persiste aca -- se calcula al vuelo cuando se consulta, para poder
-- elegir cualquier rango de fechas sin quedar atado a un periodo fijo.
--
-- Guarda DOS cosas distintas y no hay que confundirlas:
--   * precio_mediano_unidad es el NIVEL de precios de esa cadena ese dia. Sirve
--     para comparar cadenas entre si y para mostrar importes.
--   * factor_vs_base es la VARIACION contra la fecha anterior, medida sobre los
--     productos presentes en ambas fechas. Es lo unico que hay que usar para
--     medir inflacion: restar dos niveles mezcla cambios de precio con cambios
--     de surtido (ver el detalle en mart_precios_cadena_categoria).
-- La variacion de un periodo se obtiene ENCADENANDO los factores diarios, y solo
-- si la cadena esta completa: fecha_base de cada eslabon tiene que coincidir con
-- fecha_datos del anterior.
--
-- Las filas anteriores al 2026-09-08 no tienen factor (la columna no existia) y
-- su crudo ya expiro, asi que no se pueden recalcular. La serie encadenada
-- arranca en la primera fecha que tenga factor.
-- IMPORTANTE: nunca correr con --full-refresh sobre este modelo -- los datos
-- crudos solo tienen unos pocos dias de ventana, asi que un full-refresh
-- reconstruiria la tabla desde cero y borraria TODA la historia acumulada.

SELECT
    categoria,
    cadena,
    unidad_normalizada,
    precio_mediano_unidad,
    muestras,
    fecha_base,
    factor_vs_base,
    muestras_pareadas,
    fecha_datos
FROM {{ ref("mart_precios_cadena_categoria") }}

-- Sin filtro incremental a proposito. Con insert_overwrite, dbt reemplaza
-- exactamente las particiones presentes en el resultado (las fechas que haya
-- hoy en el crudo) y deja intactas las demas. Un filtro
-- "fecha_datos > MAX(fecha_datos)" impediria recuperar una fecha perdida:
-- al ser anterior al maximo ya acumulado, nunca volveria a entrar.
