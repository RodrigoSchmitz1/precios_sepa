-- Promos del mapa: una fila por promo, con el array de sucursales donde vale.
-- La API la carga entera en memoria (api/mapa_promos.py), asi que mover el mapa
-- no consulta BigQuery. Agregar las sucursales aca es lo que lo hace posible: la
-- misma promo se repite en cientos de sucursales.
--
-- Complementa a mart_promos_vigentes, que agrupa por cadena + provincia para
-- listados legibles. Son dos usos distintos del mismo dato, no un cambio de
-- opinion sobre el agrupado.
--
-- DE DONDE SALEN LAS PROMOS
-- De promos_validas y no del crudo. Ya no hay un tope fijo de descuento: cada
-- promo entra segun la evidencia que la respalda, y el analisis y los niveles
-- viven en mart_promos_evidencia. De paso se ahorra una lectura del crudo:
-- antes este modelo y mart_promos_vigentes lo leian por separado, 1,21 GiB cada
-- uno.
--
-- POR QUE NO HAY WHERE
-- Este modelo filtraba con "descuento_pct BETWEEN 10 AND
-- descuento_maximo_plausible". Las dos mitades quedaron redundantes:
-- promos_validas ya aplica el piso de 10% y el techo que le corresponde a cada
-- nivel de evidencia. La variable descuento_maximo_plausible directamente dejo
-- de existir cuando los umbrales pasaron a ser por nivel, asi que mantener ese
-- filtro no compilaria.
--
-- Tampoco hace falta filtrar por latitud ni unir con stg_comercio por bandera:
-- mart_mapa_sucursales ya deja afuera las sucursales sin coordenadas y ya
-- resuelve el join por id_comercio + id_bandera.

SELECT
    d.id_producto,
    d.descripcion,
    d.marca,
    cat.categoria,
    cat.rubro,
    d.precio_lista,
    d.precio_promo,
    d.descuento_pct,
    d.leyenda,
    d.tipo_promo,
    ARRAY_AGG(DISTINCT s.sucursal) AS sucursales,
    d.fecha_datos,
    -- Al final, para no mover las columnas que ya consume la API.
    d.nivel_evidencia,
    d.requiere_compra_multiple
FROM {{ ref("promos_validas") }} AS d
-- JOIN y no LEFT JOIN: una promo en una sucursal sin coordenadas no va al mapa.
JOIN {{ ref("mart_mapa_sucursales") }} AS s
    ON s.sucursal = CONCAT(d.id_comercio, "-", d.id_sucursal)
LEFT JOIN {{ ref("stg_categorias") }} AS cat
    ON d.id_producto = cat.id_producto
-- Se agrupa por id_comercio y no por id_bandera: el nombre de la cadena lo pone
-- el mapa por sucursal (viene en mart_mapa_sucursales), asi que separar por
-- bandera partiria la misma promo en varias filas sin agregar informacion.
GROUP BY
    d.id_comercio, d.id_producto, d.descripcion, d.marca, cat.categoria, cat.rubro,
    d.precio_lista, d.precio_promo, d.descuento_pct, d.leyenda, d.tipo_promo,
    d.fecha_datos, d.nivel_evidencia, d.requiere_compra_multiple
