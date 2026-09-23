-- Las promos cuya leyenda confirma el descuento se muestran siempre, sea cual
-- sea el descuento.
--
-- Cuando la cadena declara el porcentaje y coincide con el precio no hay nada
-- que sospechar, aunque sea alto: "70% de descuento con cualquier medio de pago"
-- de La Anonima, "70% AGUA MICELAR" de Dia. Si alguien vuelve a poner un tope
-- para todas las cadenas por debajo de esas promos, este test falla.

SELECT
    e.id_producto,
    e.id_comercio,
    e.id_sucursal,
    e.tipo_promo,
    e.descuento_pct,
    e.leyenda
FROM {{ ref("mart_promos_evidencia") }} AS e
LEFT JOIN {{ ref("promos_validas") }} AS v
    ON v.id_producto = e.id_producto
    AND v.id_comercio = e.id_comercio
    AND v.id_bandera = e.id_bandera
    AND v.id_sucursal = e.id_sucursal
    AND v.tipo_promo = e.tipo_promo
WHERE e.nivel_evidencia = "leyenda"
    AND e.descuento_pct >= 10
    AND v.id_producto IS NULL
