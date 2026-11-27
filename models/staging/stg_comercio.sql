WITH comercio_base AS (
    {{ limpiar_comercio(source("sepa", "comercio")) }}
)

SELECT
    cb.id_comercio,
    cb.id_bandera,
    cb.cuit,
    cb.razon_social,
    cb.bandera_nombre,
    COALESCE(m.nombre_comercial, TRIM(cb.bandera_nombre)) AS nombre_comercial,
    -- supermercado o farmacia (2026-11-19, openspec comercios-regionales-y-
    -- farmacity). Una farmacia compara sus productos pero compite solo en
    -- var('rubros_farmacia') y no cuenta como cadena cerca. Una bandera que no
    -- esta en el seed se trata como supermercado, salvo que su comercio sea
    -- mayorista (openspec sumar-mayoristas): un mayorista nuevo que SEPA empiece
    -- a publicar entra como mayorista aunque nadie lo haya cargado en el seed.
    COALESCE(
        m.formato,
        IF(cb.id_comercio IN ({{ comercios_mayoristas() }}), 'mayorista', 'supermercado')
    ) AS formato,
    -- false: el comercio no viene en todos los ZIP de SEPA (Farmacity faltó 1
    -- de 7 dias y La Agricola 2 de 7 en la semana del 13 al 19-11). El control
    -- cadenas_del_ultimo_dia_completas no lo cuenta.
    COALESCE(m.informe_diario, TRUE) AS informe_diario
FROM comercio_base AS cb
LEFT JOIN {{ ref("mapeo_cadenas") }} AS m
    ON cb.id_comercio = CAST(m.id_comercio AS STRING)
    AND cb.id_bandera = CAST(m.id_bandera AS STRING)
