-- En el mapa no puede aparecer una promo sin verificar con un descuento mayor al
-- techo.
--
-- Es el caso que motivo todo el cambio: Carrefour informa en el mismo campo
-- promos reales y valores que no son precios (un movil de juguete de $184.990 "a
-- $1.900"), con la misma leyenda generica.
--
-- Lee la variable y no promos_validas: si alguien cambia la vista o hace que el
-- mart deje de leerla, el test lo detecta igual.

SELECT
    id_producto,
    leyenda,
    descuento_pct
FROM {{ ref("mart_mapa_promos") }}
WHERE nivel_evidencia = "sin_verificar"
    AND descuento_pct > {{ var("promos_techo_descuento_sin_verificar") }}
