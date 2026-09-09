-- KPI 2: Costo de la canasta basica por localidad.
-- Metodologia: composicion basada en la Canasta Basica Alimentaria (CBA) del
-- INDEC, adaptada a las categorias propias (ver seed composicion_canasta).
-- Solo se usan productos de gama economica (mart_gama_productos) para evitar
-- que productos premium (aceite de oliva, leches vegetales, etc.) inflen
-- artificialmente el costo de una canasta que busca representar lo accesible.
-- El precio por unidad de medida sale de columnas estructuradas de SEPA
-- (cantidad/unidad de presentacion), no de texto libre.
-- Exclusiones documentadas del CBA original: Dulces (330g, ya cubierto via
-- categoria propia Dulces y mermeladas) y Menudencias (270g, ~0.5% del peso
-- total, sin categoria equivalente).
-- Filtro de sanidad: se descartan cantidad_normalizada fuera de un rango
-- fisicamente razonable (5g-10000g / 5cc-10000cc / 1-60 unidades). Se
-- detecto que algunos comercios reportan la cantidad de presentacion en la
-- escala equivocada (ej. 0.21 en vez de 210 para un pan de 210g) -- error
-- de carga en la fuente SEPA, no de esta transformacion.
-- Umbral minimo de 20 muestras por categoria x localidad, y filtro de outliers
-- percentil 10-90: con pocas muestras, un solo producto mal cargado puede
-- contaminar el 100% de una categoria sin que el filtro estadistico tenga
-- margen de descartarlo. Se prioriza confiabilidad sobre cobertura.
-- fecha_datos = fecha real de los precios usados (no la fecha de corrida),
-- para que el historico se etiquete por validez del dato, no por ejecucion.
-- Devuelve UNA FILA POR LOCALIDAD Y FECHA: antes calculaba solo la fecha
-- maxima del crudo; ahora calcula cada fecha disponible por separado, para
-- que el historico pueda recuperar un dia perdido (backfill).
--
-- SOLO LOCALIDADES CON LA CANASTA COMPLETA (corregido 2026-09-08).
-- Antes se sumaban las categorias que cada localidad tuviera y se comparaban
-- esos totales entre si, lo cual no mide lo que dice medir: una localidad con
-- 20 de 32 categorias parece barata simplemente porque le faltan 12. Medido
-- sobre los datos del dia: mediana de $177.419 con 20 categorias contra
-- $388.726 con 30, o sea que el "ranking de canasta mas barata" era en realidad
-- un ranking de cuantas categorias le faltaban a cada localidad.
--
-- La composicion tiene que ser FIJA, no derivada de los datos de cada dia: este
-- modelo alimenta un historico permanente, y si la canasta cambia de dia a dia
-- la serie mezcla variaciones de precio con variaciones de composicion. Por eso
-- el conjunto sale de la seed y el HAVING exige tenerlo entero.
--
-- Cuesta cobertura: 31 localidades en vez de 127. Se evaluo achicar la canasta
-- para ganar alcance y no sirve: la unica categoria que ata es Huevos (38
-- localidades). Sacarla da 51, y sacar cualquier otra da +0. Un "nucleo de 8
-- basicos" da las mismas 31, porque incluye huevos. No hay termino medio que
-- compre cobertura sin romper el significado de la canasta.

-- El calculo pesado vive en mart_canasta_detalle, que ya deja una fila por
-- localidad y categoria. Aca solo se suma: es una tabla chica, asi que este
-- modelo practicamente no consume nada.

SELECT
    localidad,
    provincia,
    fecha_datos,
    COUNT(DISTINCT categoria) AS categorias_en_canasta,
    ROUND(SUM(costo_categoria), 2) AS costo_canasta_total
FROM {{ ref("mart_canasta_detalle") }}
GROUP BY localidad, provincia, fecha_datos
