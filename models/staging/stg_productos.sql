{{
  config(
    materialized="incremental",
    incremental_strategy="insert_overwrite",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date",
      "copy_partitions": true
    },
    partition_expiration_days=3
  )
}}

-- INCREMENTAL DESDE EL 2026-09-10. Antes se reconstruia entera todos los dias:
-- leer las tres fechas del crudo costaba 2,14 GiB, cuando dos de ellas ya
-- estaban calculadas y no cambian. Medido con dry run, una sola fecha cuesta
-- 0,72 GiB.
--
-- - Se calculan las fechas del crudo que todavia no estan aca, mas siempre la
--   ultima (macro fechas_a_calcular, que lee metadata y no gasta cuota).
-- - copy_partitions: dbt reemplaza cada particion con un copy job, que no
--   consume cuota. Con el MERGE por defecto se volveria a leer la particion
--   destino y se perderia buena parte del ahorro.
-- - Expira a los 3 dias, igual que el crudo: esta tabla tiene que tener las
--   mismas fechas que su fuente. Sin expiracion acumularia fechas para siempre,
--   y mart_gama_productos, que calcula medianas sobre todas, se encareceria
--   solo y cambiaria de ventana sin que nadie lo decida.
--
-- A diferencia de los historicos, esta tabla SI se puede reconstruir con
-- --full-refresh: todo lo que tiene sale del crudo.
-- Particionada por fecha_datos a proposito: sin particion, cualquier consulta
-- que quiera un solo dia escanea las 57 millones de filas igual. La API de
-- canasta personalizada hacia exactamente eso, una vez por categoria.
-- No lleva descripcion ni marca: ningun modelo ni endpoint las consume desde
-- aca (las promos las toman del crudo), y pesaban 2.19 GB.
--
-- Agrega cantidad_normalizada y unidad_normalizada a partir de las columnas
-- estructuradas de presentacion (cantidad_presentacion + unidad_medida_presentacion).
-- Se prefiere esto sobre parsear la descripcion (texto libre): el dato ya viene
-- estructurado en la fuente SEPA, es mas confiable que reconstruirlo con regex.
-- unidad_normalizada in ("g", "cc", "unidad"); NULL si la unidad no es reconocida.
--
-- EL MAPEO SE AMPLIO EL 2026-09-09. Faltaban unidades que cubren el 18,4% del
-- catalogo, y como todo lo que necesita cantidad (gama, canasta, indice de
-- precios) descarta las filas sin unidad, ese 18% quedaba afuera de los
-- calculos sin que nada lo avisara. Las que faltaban, verificadas contra las
-- descripciones de la fuente:
--   EA  (16,4% de los productos): codigo GS1/UN-CEFACT de "each". 16.136 de
--       17.313 traen cantidad=1 y el resto son conteos ("ALWAYS TOALLAS XTRA
--       NOCTURNAS 16U", "ACEITE PESCADO 60 UN").
--   CU  (1,7%): "cada uno" ("PAAL G DERMACARE AP, HUGGIES, 48 cu").
--   G   (0,1%): gramos a secas ("YERBA E500G" con cantidad 500).
--   DM3 y CL: decimetro cubico (un litro) y centilitro. Poquisimos productos,
--       pero son unidades estandar sin ambiguedad.
--
-- Quedan sin mapear A PROPOSITO, porque no se pueden convertir a masa, volumen
-- ni conteo sin inventar: M, M2, MTR, MT, CMT, DMQ (largo y superficie, como
-- rollos de aluminio o textiles), y PAR, CJ, PIE, HJS, MI, que son ambiguas.
-- Entre todas suman menos del 0,3% de los productos.
--
-- EL TAMAÑO EN LA DESCRIPCION (2026-10-14). Carrefour (id_comercio 10, sus
-- cuatro banderas, Maxi incluido) informa TODO como "1 UNI" y pone el tamaño
-- solo en el texto: "ARROZ PARBOIL GALLO ORO BOLSA X 500 GRS" llega con
-- cantidad 1 y unidad UNI. Asi su arroz, sus fideos y sus galletitas quedaban
-- en la unidad "unidad", y todo lo que se cotiza por gramo o por litro (Tu
-- canasta, Donde comprarla, la gama) no los veia: en el indice por sucursal
-- Carrefour tenia 12 de las 32 categorias de la canasta basica y Maxi 9,
-- mientras en Mas barato, que compara por codigo de barras, Maxi ganaba 56 de
-- 66. Se detecto armando la comparacion de la canasta por cadena.
--
-- Cencosud (id_comercio 9: Vea, Disco, Jumbo) tiene el problema al reves:
-- escribe la cantidad en kilos o litros con la etiqueta de gramos o
-- mililitros. "LECHE UAT DESC 1% TREGAR 1L" llega como "1.00 ml." y un sobre
-- de 150 g como ".15 gr.". Esos tamaños (menos de 5 g o 5 cc) no pasan el
-- rango de sanidad y el producto quedaba afuera: en una sucursal de Vea,
-- 2.557 de unos 6.500 productos. Vea salia sin leche ni verdura economica y
-- su canasta, al doble que la de Dia.
--
-- La regla: si la fuente dice "1 unidad", o gramos o cc con menos de 5, y la
-- descripcion trae un tamaño en
-- gramos, kilos, litros o cc, se usa la descripcion. Primero el multipack
-- ("6 X 50 GRS" = 300 g) y si no el tamaño suelto ("X 1 KG", "1,5 LT",
-- "YERBA E500G"). "1.000 GR" es mil gramos, no uno: en gramos y cc un punto
-- seguido de tres cifras es separador de miles. MG no cuenta (una vitamina de
-- 500 mg no pesa medio kilo en la gondola), ni M, ni CM. Lo que la fuente ya
-- informa en una unidad de masa o volumen no se toca: la columna estructurada
-- sigue siendo la fuente principal.

WITH base AS (
    SELECT
        id_comercio,
        id_bandera,
        id_sucursal,
        id_producto,
        CAST(productos_precio_lista AS FLOAT64) AS precio,
        productos_cantidad_presentacion AS cantidad_presentacion_raw,
        productos_unidad_medida_presentacion AS unidad_presentacion_raw,
        -- Solo para leer el tamaño cuando la fuente dice "1 unidad"; no sale
        -- del modelo (ver el encabezado: la descripcion pesaba 2,19 GB).
        UPPER(productos_descripcion) AS descripcion,
        fecha_datos
    FROM {{ source("sepa", "productos") }}
    WHERE productos_precio_lista IS NOT NULL
        AND CAST(productos_precio_lista AS FLOAT64) > 1
        {% if is_incremental() %}
        AND fecha_datos IN ({{ fechas_a_calcular(source("sepa", "productos"), this.identifier, dataset_historico=this.schema) }})
        {% endif %}
),

con_unidad_limpia AS (
    SELECT
        *,
        SAFE_CAST(REPLACE(cantidad_presentacion_raw, ",", ".") AS FLOAT64) AS cantidad_pres,
        UPPER(TRIM(REPLACE(unidad_presentacion_raw, ".", ""))) AS unidad_limpia,
        -- El tamaño escrito en la descripcion: primero un multipack, si no uno
        -- suelto. Ver "EL TAMAÑO EN LA DESCRIPCION" arriba.
        COALESCE(
            REGEXP_EXTRACT(descripcion,
                r"(?:^|[^0-9.,])(\d{1,2}\s*X\s*\d+(?:[.,]\d+)?\s*(?:KGS?|KILOS?|GRS?|GRM|GRAMOS|G|LTS?|LITROS?|L|ML|CC|CM3))(?:[^A-Z0-9]|$)"),
            REGEXP_EXTRACT(descripcion,
                r"(?:^|[^0-9.,])(\d+(?:[.,]\d+)?\s*(?:KGS?|KILOS?|GRS?|GRM|GRAMOS|G|LTS?|LITROS?|L|ML|CC|CM3))(?:[^A-Z0-9]|$)")
        ) AS tamano_texto
    FROM base
),

tamano_descripcion AS (
    SELECT
        *,
        IFNULL(SAFE_CAST(REGEXP_EXTRACT(tamano_texto, r"^(\d{1,2})\s*X") AS FLOAT64), 1) AS tamano_veces,
        REGEXP_EXTRACT(tamano_texto, r"(\d+(?:[.,]\d+)?)\s*[A-Z]+3?$") AS tamano_numero_texto,
        REGEXP_EXTRACT(tamano_texto, r"([A-Z]+3?)$") AS tamano_unidad
    FROM con_unidad_limpia
),

tamano_normalizado AS (
    SELECT
        *,
        CASE
            WHEN tamano_unidad IN ("KG", "KGS", "KILO", "KILOS") THEN "g"
            WHEN tamano_unidad IN ("GR", "GRS", "GRM", "GRAMOS", "G") THEN "g"
            WHEN tamano_unidad IN ("LT", "LTS", "LITRO", "LITROS", "L", "ML", "CC", "CM3") THEN "cc"
        END AS tamano_unidad_normalizada,
        tamano_veces * SAFE_CAST(
            -- En gramos y cc, "1.000" es mil: un punto seguido de tres cifras
            -- es separador de miles. En kilos y litros, "1.5" es uno y medio.
            IF(tamano_unidad IN ("GR", "GRS", "GRM", "GRAMOS", "G", "ML", "CC", "CM3")
                   AND REGEXP_CONTAINS(tamano_numero_texto, r"^\d{1,3}\.\d{3}$"),
               REPLACE(tamano_numero_texto, ".", ""),
               REPLACE(tamano_numero_texto, ",", "."))
            AS FLOAT64)
        * IF(tamano_unidad IN ("KG", "KGS", "KILO", "KILOS", "LT", "LTS", "LITRO", "LITROS", "L"), 1000, 1)
            AS tamano_cantidad
    FROM tamano_descripcion
),

presentacion AS (
    SELECT
        *,
        CASE
            WHEN unidad_limpia IN ("KG", "KGM", "KGR", "KILO") THEN cantidad_pres * 1000
            WHEN unidad_limpia IN ("GR", "GRM", "GRAMOS", "G") THEN cantidad_pres
            WHEN unidad_limpia IN ("LT", "LTR", "L", "LITRO", "DM3") THEN cantidad_pres * 1000
            WHEN unidad_limpia = "CL" THEN cantidad_pres * 10
            WHEN unidad_limpia IN ("ML", "CM3", "CMQ", "CC") THEN cantidad_pres
            WHEN unidad_limpia IN ("UNI", "UNIDAD", "UD", "UN", "EA", "CU") THEN cantidad_pres
            ELSE NULL
        END AS cantidad_fuente,
        CASE
            WHEN unidad_limpia IN ("KG", "KGM", "KGR", "KILO", "GR", "GRM", "GRAMOS", "G") THEN "g"
            WHEN unidad_limpia IN ("LT", "LTR", "L", "LITRO", "DM3", "CL",
                                   "ML", "CM3", "CMQ", "CC") THEN "cc"
            WHEN unidad_limpia IN ("UNI", "UNIDAD", "UD", "UN", "EA", "CU") THEN "unidad"
            ELSE NULL
        END AS unidad_fuente
    FROM tamano_normalizado
),

con_descripcion AS (
    SELECT
        *,
        -- La descripcion manda solo si la fuente dice "1 unidad" o un peso o
        -- volumen imposible, y el tamaño leido es razonable (el mismo rango
        -- que cantidad_razonable).
        ((unidad_fuente = "unidad" AND cantidad_pres = 1)
            OR (unidad_fuente IN ("g", "cc") AND cantidad_fuente < 5))
            AND tamano_unidad_normalizada IS NOT NULL
            AND tamano_cantidad BETWEEN 5 AND 10000 AS usa_descripcion
    FROM presentacion
)

SELECT
    id_comercio,
    id_bandera,
    id_sucursal,
    id_producto,
    precio,
    fecha_datos,
    IF(usa_descripcion, tamano_cantidad, cantidad_fuente) AS cantidad_normalizada,
    IF(usa_descripcion, tamano_unidad_normalizada, unidad_fuente) AS unidad_normalizada
FROM con_descripcion
