-- Promos vigentes (datos actuales) a nivel producto-cadena-provincia.
-- Una fila por cada promo activa y zona de precio (promo1 y promo2 se tratan por separado).
-- Se agrupa por cadena+provincia (no por sucursal individual) porque el precio de
-- promo suele repetirse entre sucursales de una misma zona; agrupar evita filas
-- duplicadas y conserva la variacion real entre regiones (ej. Buenos Aires vs Chubut).
-- El join a stg_comercio usa id_comercio + id_bandera (no solo id_comercio) porque
-- una cadena puede tener varias banderas (ej. Carrefour/Market/Express/Maxi) con
-- nombre_comercial distinto; sin id_bandera, cada promo se multiplicaria una vez
-- por cada bandera de la cadena.
--
-- Desde el 2026-09-10 las promos salen de promos_validas: ya no hay un tope fijo
-- de descuento, cada promo se muestra segun la evidencia que la respalda. El
-- analisis y los niveles estan en mart_promos_evidencia.

WITH enriquecido AS (
    SELECT
        d.id_producto,
        d.descripcion,
        d.marca,
        cat.categoria,
        cat.rubro,
        c.nombre_comercial AS cadena,
        s.provincia,
        d.precio_lista,
        d.precio_promo,
        d.descuento_pct,
        d.leyenda,
        d.tipo_promo,
        d.id_sucursal,
        d.fecha_datos,
        d.nivel_evidencia,
        d.requiere_compra_multiple
    FROM {{ ref("promos_validas") }} AS d
    LEFT JOIN {{ ref("stg_categorias") }} AS cat ON d.id_producto = cat.id_producto
    LEFT JOIN {{ ref("stg_sucursales") }} AS s ON d.id_comercio = s.id_comercio AND d.id_sucursal = s.id_sucursal
    LEFT JOIN {{ ref("stg_comercio") }} AS c ON d.id_comercio = c.id_comercio AND d.id_bandera = c.id_bandera
)

-- Las columnas nuevas van al final para no mover las que ya consume la API.
SELECT
    id_producto,
    descripcion,
    marca,
    categoria,
    rubro,
    cadena,
    provincia,
    precio_lista,
    precio_promo,
    descuento_pct,
    leyenda,
    tipo_promo,
    COUNT(DISTINCT id_sucursal) AS sucursales_con_esta_promo,
    fecha_datos,
    nivel_evidencia,
    requiere_compra_multiple
FROM enriquecido
GROUP BY
    id_producto, descripcion, marca, categoria, rubro, cadena, provincia,
    precio_lista, precio_promo, descuento_pct, leyenda, tipo_promo,
    fecha_datos, nivel_evidencia, requiere_compra_multiple
