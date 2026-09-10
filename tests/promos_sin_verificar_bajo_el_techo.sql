-- En el mapa no puede aparecer una promo sin verificar con un descuento mayor al
-- techo del dia.
--
-- Es el caso que motivo todo el cambio: Carrefour informa en el mismo campo
-- promos reales y valores que no son precios (un movil de juguete de $184.990 "a
-- $1.900"), con la misma leyenda generica. Lo que no se puede contrastar ni con
-- la leyenda ni con otra cadena no puede prometer mas que el 99,9% de las promos
-- que si se pueden verificar.
--
-- El techo se vuelve a calcular aca a partir de mart_promos_calibracion y de las
-- variables, sin leer promos_validas: si alguien cambia la vista o hace que el
-- mart deje de leerla, el test lo detecta igual.

WITH techo AS (
    SELECT
        fecha_datos,
        IF(
            promos_verificadas >= {{ var("promos_muestra_minima") }},
            techo_descuento_sin_verificar,
            {{ var("promos_techo_descuento_respaldo") }}
        ) AS techo_descuento
    FROM {{ ref("mart_promos_calibracion") }}
)

SELECT
    p.id_producto,
    p.cadena,
    p.descuento_pct,
    t.techo_descuento
FROM {{ ref("mart_promos_por_sucursal") }} AS p
JOIN techo AS t USING (fecha_datos)
WHERE p.nivel_evidencia = "sin_verificar"
    AND p.descuento_pct > t.techo_descuento
