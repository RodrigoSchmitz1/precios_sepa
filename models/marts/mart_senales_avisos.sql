{{ config(enabled=var("senales_activas", false)) }}

-- Que productos se piden en los avisos de oferta (openspec senales-anonimas), por semana y provincia.
-- "Personas por dia": identificadores distintos por dia, sumados en la semana.
-- El telefono cambia el identificador cada dia, asi que no se puede contar a
-- la misma persona a lo largo de la semana: es el precio de no tener un perfil
-- de nadie. Un grupo con menos de var('umbral_personas_senales') no aparece.

SELECT
    DATE_TRUNC(fecha, WEEK(MONDAY)) AS semana,
    provincia,
    id_producto,
    ANY_VALUE(categoria) AS categoria,
    ANY_VALUE(rubro) AS rubro,
    COUNT(DISTINCT CONCAT(CAST(fecha AS STRING), id_dia)) AS personas_dia,
    COUNT(*) AS eventos
FROM {{ source("senales", "eventos") }}
WHERE tipo = "aviso_pedido" AND id_producto IS NOT NULL
GROUP BY semana, provincia, id_producto
HAVING personas_dia >= {{ var("umbral_personas_senales") }}
