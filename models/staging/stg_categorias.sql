-- Categoria VIGENTE de cada producto.
--
-- sepa.producto_categoria es de solo agregado desde el 2026-09-10: cuando un
-- producto se reclasifica (por ejemplo, al agregar categorias a la taxonomia)
-- se suma una fila nueva con la fecha en categorizado_en, en vez de pisar la
-- anterior. Asi no se pierde el resultado de las corridas de Gemini previas y
-- queda rastro de que clasificacion tenia cada producto antes. Aca se toma la
-- mas reciente; las filas anteriores a ese cambio tienen categorizado_en en NULL
-- y cuentan como las mas viejas.
--
-- Sin esta deduplicacion, un producto reclasificado apareceria dos veces y todos
-- los marts que unen por id_producto multiplicarian sus filas en silencio. El
-- test unique de id_producto lo vigila.

WITH vigente AS (
    SELECT
        id_producto,
        descripcion,
        marca,
        categoria,
        rubro
    FROM {{ source('sepa', 'producto_categoria') }}
    WHERE TRUE
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY id_producto
        ORDER BY categorizado_en DESC NULLS LAST
    ) = 1
)

SELECT
    id_producto,
    descripcion,
    marca,
    categoria,
    rubro
FROM vigente
