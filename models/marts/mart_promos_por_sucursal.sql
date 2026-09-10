-- Promos vigentes a nivel sucursal individual, con ubicacion geografica.
-- Complementa a mart_promos_vigentes (que agrupa por cadena+provincia para
-- listados legibles): este modelo mantiene el detalle por sucursal porque
-- el mapa SI necesita el punto exacto -- es un uso distinto del mismo dato,
-- no un cambio de opinion sobre el agrupado.
-- El join a stg_comercio usa id_comercio + id_bandera (no solo id_comercio)
-- para no multiplicar cada fila por cada bandera de la cadena.
--
-- Desde el 2026-09-10 las promos salen de promos_validas: ya no hay un tope fijo
-- de descuento, cada promo se muestra segun la evidencia que la respalda. El
-- analisis y los niveles estan en mart_promos_evidencia. Antes este modelo y
-- mart_promos_vigentes leian el crudo por separado (1,21 GiB cada uno); ahora el
-- crudo se lee una sola vez en mart_promos_evidencia.

SELECT
    d.id_producto,
    d.descripcion,
    d.marca,
    cat.categoria,
    cat.rubro,
    c.nombre_comercial AS cadena,
    s.nombre_sucursal,
    s.calle,
    s.numero,
    s.barrio,
    s.localidad,
    s.provincia,
    s.latitud,
    s.longitud,
    d.precio_lista,
    d.precio_promo,
    d.descuento_pct,
    d.leyenda,
    d.tipo_promo,
    d.fecha_datos,
    -- Al final, para no mover las columnas que ya consume la API.
    d.nivel_evidencia,
    d.requiere_compra_multiple
FROM {{ ref("promos_validas") }} AS d
LEFT JOIN {{ ref("stg_categorias") }} AS cat ON d.id_producto = cat.id_producto
LEFT JOIN {{ ref("stg_sucursales") }} AS s ON d.id_comercio = s.id_comercio AND d.id_sucursal = s.id_sucursal
LEFT JOIN {{ ref("stg_comercio") }} AS c ON d.id_comercio = c.id_comercio AND d.id_bandera = c.id_bandera
WHERE s.latitud IS NOT NULL
    AND s.longitud IS NOT NULL
