-- Falla si El mismo producto publica como del ultimo dia un precio mas viejo
-- que dias_maximos_arrastre.
--
-- Cuando una cadena falta en el ultimo dia (el ZIP de SEPA llego sin su
-- empresa, como Cencosud el 2026-11-11), el mart usa su precio mas reciente y
-- lo marca con fecha_precio. Es aceptable porque de un dia al otro cambia el
-- 1% de los precios; con mas dias deja de ser el precio de hoy. El tope lo
-- aplica el propio mart, y este test lo verifica por su cuenta para que un
-- cambio en la ventana no lo saltee en silencio.
--
-- Lee dos columnas de fecha del mart: unos pocos MB.

SELECT
    cadena,
    fecha_datos,
    fecha_precio,
    COUNT(*) AS filas
FROM {{ ref("mart_mismo_producto") }}
WHERE fecha_precio > fecha_datos
    OR DATE_DIFF(fecha_datos, fecha_precio, DAY) > {{ var("dias_maximos_arrastre") }}
GROUP BY cadena, fecha_datos, fecha_precio
