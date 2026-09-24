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
-- la mitad de la carne vacuna. Por si solo movia el total -1,7% (el pescado
-- de mas y la vacuna de menos se compensaban).
--
-- SALTO EN LA SERIE ENTRE EL 22 Y EL 23 DE SEPTIEMBRE. Ese dia entraron juntos
-- el reparto de carnes y las siete categorias nuevas (ver categorizar.py), que
-- sacaron de los basicos productos de otro precio por kilo: papas congeladas
-- de Papa, oliva de Aceite, edulcorantes de Azucar, premezclas de Harina,
-- pastas frescas de Fideos. Sobre las 63 localidades medidas los dos dias, la
-- canasta bajo 10,6% (mediana $243.291 -> $216.780): -1,7 de las carnes y el
-- resto de los basicos limpios (papa economica $1.690/kg, aceite $3.830/L,
-- harina $1.200/kg). Es una correccion, no un cambio de precios: comparar a
-- traves de esa fecha mide el cambio de metodologia. La cobertura bajo de 88 a
-- 68 localidades: con categorias mas acotadas, 25 dejaron de juntar precios
-- locales de aceite, azucar o papa y pasaron el tope de 2 imputadas. Ese
-- mismo dia el tope subio a 4 (ver mart_canasta_detalle) y volvieron 19.
--
-- EXCLUSION: Menudencias (270 g de higado). El higado se compra sobre todo en
-- carnicerias, que SEPA no cubre: en supermercados es un producto puntual, y
-- su precio ahi no representa lo que paga quien lo compra. Medido el
-- 2026-09-24: 23 de las 88 localidades no tenian precio local de achuras y
-- Mendoza y Rio Negro ni siquiera provincial. Es el 0,2% del costo.
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
-- mediana de la provincia por falta de observaciones locales (como mucho
-- canasta_maximo_imputadas, en dbt_project.yml). Se
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
