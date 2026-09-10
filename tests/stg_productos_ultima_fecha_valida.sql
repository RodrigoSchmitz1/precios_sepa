-- Integridad de stg_productos sobre la ULTIMA fecha cargada: id y precio no
-- nulos, unidad dentro de g / cc / unidad, y que la fecha tenga filas.
--
-- Reemplaza a tres tests genericos del YAML (not_null de id_producto y de
-- precio, accepted_values de unidad_normalizada) que escaneaban las tres fechas
-- de la tabla en cada corrida: 1,12 GiB por dia entre los tres, medido sobre la
-- corrida del 2026-09-09. Mirar solo la ultima alcanza: la transformacion es la
-- misma para todas las fechas y el crudo de las anteriores no cambia, asi que
-- una fecha vieja ya se valido el dia que era la ultima.
--
-- No se resolvio con "config: where" en el YAML a proposito. Esa config se
-- renderiza al parsear el proyecto, cuando ultima_fecha todavia no consulta
-- nada y devuelve 1970-01-01: el test filtraria una fecha vacia y pasaria
-- siempre sin mirar un solo dato. Un test que no puede fallar es peor que no
-- tenerlo, porque da una confianza que no corresponde.
--
-- Una sola lectura de la particion: los cuatro chequeos salen del mismo
-- agregado en vez de cuatro consultas.

{% set fecha = ultima_fecha(ref("stg_productos")) %}

WITH conteos AS (
    SELECT
        COUNT(*) AS filas,
        COUNTIF(id_producto IS NULL) AS id_nulo,
        COUNTIF(precio IS NULL) AS precio_nulo,
        COUNTIF(
            unidad_normalizada IS NOT NULL
            AND unidad_normalizada NOT IN ("g", "cc", "unidad")
        ) AS unidad_invalida
    FROM {{ ref("stg_productos") }}
    WHERE fecha_datos = DATE('{{ fecha }}')
)

SELECT chequeo.problema, chequeo.cantidad
FROM conteos,
    UNNEST([
        STRUCT("la ultima fecha no tiene filas" AS problema, IF(filas = 0, 1, 0) AS cantidad),
        STRUCT("id_producto nulo", id_nulo),
        STRUCT("precio nulo", precio_nulo),
        STRUCT("unidad fuera de g / cc / unidad", unidad_invalida)
    ]) AS chequeo
WHERE chequeo.cantidad > 0
