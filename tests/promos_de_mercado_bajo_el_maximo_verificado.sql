-- En el listado no puede aparecer una promo de nivel mercado con un descuento
-- mayor al de la verificada mas agresiva.
--
-- El mercado respalda el precio promo, no la lista propia. El 2026-09-09
-- Carrefour informaba un jugo de limon Minerva de 250 cc con $2.209 de lista
-- (otra empresa: $293) "a $442": el precio promo pasaba el piso, pero el 80% de
-- descuento era falso y el listado ordena por descuento.
--
-- Lee la variable y no promos_validas, igual que promos_sin_verificar_bajo_el_techo.

SELECT
    id_producto,
    cadena,
    descuento_pct
FROM {{ ref("mart_promos_vigentes") }}
WHERE nivel_evidencia = "mercado"
    AND descuento_pct > {{ var("promos_descuento_maximo_mercado") }}
