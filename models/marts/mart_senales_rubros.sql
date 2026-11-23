{{ config(enabled=var("senales_activas", false)) }}

-- Que categorias de promos se abren (openspec senales-anonimas), por semana y provincia.
-- "Personas por dia": identificadores distintos por dia, sumados en la semana.
-- El telefono cambia el identificador cada dia, asi que no se puede contar a
-- la misma persona a lo largo de la semana: es el precio de no tener un perfil
-- de nadie. Un grupo con menos de var('umbral_personas_senales') no aparece.

SELECT
    DATE_TRUNC(fecha, WEEK(MONDAY)) AS semana,
    provincia,
    rubro,
    COUNT(DISTINCT CONCAT(CAST(fecha AS STRING), id_dia)) AS personas_dia,
    COUNT(*) AS eventos
FROM {{ source("senales", "eventos") }}
WHERE tipo = "vista_rubro" AND rubro IS NOT NULL
GROUP BY semana, provincia, rubro
HAVING personas_dia >= {{ var("umbral_personas_senales") }}
