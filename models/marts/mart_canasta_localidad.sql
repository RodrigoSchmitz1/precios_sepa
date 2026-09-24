-- Costo de la canasta basica por localidad, una fila por localidad y fecha.
--
-- Metodologia: composicion de la Canasta Basica Alimentaria (CBA) del INDEC
-- para Gran Buenos Aires, en gramos por adulto equivalente y por mes (INDEC, "La
-- medicion de la pobreza y la indigencia en la Argentina", Metodologia 22,
-- cuadro de composicion por region), adaptada a las categorias propias (seed
-- composicion_canasta) y valuada con productos de gama economica para que la
-- gama premium no infle una canasta que busca representar lo accesible.
--
-- CARNES (corregido el 2026-09-24). El INDEC publica "Carnes 6.270 g" como un
-- total y su detalle por corte da 4.440 g de vacuna (asado, carnaza, hueso con
-- carne, paleta, picada, nalga), 1.650 de pollo y 180 de pescado. La seed los
-- repartia en tercios iguales, 2.090 cada uno: 11 veces el pescado del INDEC y
-- la mitad de la carne vacuna. El total casi no cambio (-1,7%, porque el
-- pescado de mas y la vacuna de menos se compensaban), pero la serie historica
-- tiene ese salto entre los datos del 22 y del 23 de septiembre, la primera
-- fecha calculada con la composicion nueva.
--
-- EXCLUSION: Menudencias (270 g de higado). Hay categoria (Achuras y
-- menudencias), pero el higado economico se vende en pocas sucursales: medido
-- el 2026-09-24, 23 de las 88 localidades no tienen precio local y unas 10
-- dejarian de tener la canasta completa, entre ellas Bahia Blanca, Tandil,
-- Cipolletti y Viedma (Mendoza y Rio Negro ni siquiera tienen precio
-- provincial). Perder un tercio del interior por el 0,2% del costo no compensa.
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
