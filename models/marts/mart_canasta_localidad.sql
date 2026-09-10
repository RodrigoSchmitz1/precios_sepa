-- Costo de la canasta basica por localidad, una fila por localidad y fecha.
--
-- Metodologia: composicion de la Canasta Basica Alimentaria (CBA) del INDEC,
-- adaptada a las categorias propias (seed composicion_canasta), valuada con
-- productos de gama economica para que la gama premium no infle una canasta que
-- busca representar lo accesible. Exclusiones documentadas del CBA original:
-- Dulces (cubierto por la categoria Dulces y mermeladas) y Menudencias (~0,5%
-- del peso total, sin categoria equivalente).
--
-- Todo el calculo vive en mart_canasta_detalle, que deja una fila por localidad
-- y categoria con el precio usado y su origen. Ahi estan documentados el umbral
-- de observaciones, el recorte de outliers, la exclusion de provincias
-- disfrazadas de localidad y la imputacion provincial. Este modelo solo suma, y
-- sobre una tabla chica.
--
-- Decisiones que se sostienen aca:
--
-- SOLO LOCALIDADES CON LA CANASTA COMPLETA (2026-09-08). Antes se sumaban las
-- categorias que cada localidad tuviera: con 20 de 32 la mediana daba $177.419 y
-- con 30, $388.726. El ranking media cuantas categorias faltaban, no precios.
--
-- COMPOSICION FIJA. Este modelo alimenta un historico permanente: si la canasta
-- cambiara de dia a dia, la serie mezclaria variaciones de precio con
-- variaciones de composicion.
--
-- categorias_imputadas cuenta cuantas de las 32 categorias se valuaron con la
-- mediana de la provincia por falta de observaciones locales (como mucho 2). Se
-- expone para que el ranking pueda decir sobre que se compara cada localidad.

SELECT
    localidad,
    provincia,
    fecha_datos,
    COUNT(DISTINCT categoria) AS categorias_en_canasta,
    COUNTIF(origen_precio = "provincia") AS categorias_imputadas,
    ROUND(SUM(costo_categoria), 2) AS costo_canasta_total
FROM {{ ref("mart_canasta_detalle") }}
GROUP BY localidad, provincia, fecha_datos
