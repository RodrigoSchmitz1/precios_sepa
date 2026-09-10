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

WITH base AS (
    SELECT
        id_comercio,
        id_bandera,
        id_sucursal,
        id_producto,
        CAST(productos_precio_lista AS FLOAT64) AS precio,
        productos_cantidad_presentacion AS cantidad_presentacion_raw,
        productos_unidad_medida_presentacion AS unidad_presentacion_raw,
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
        UPPER(TRIM(REPLACE(unidad_presentacion_raw, ".", ""))) AS unidad_limpia
    FROM base
)

SELECT
    id_comercio,
    id_bandera,
    id_sucursal,
    id_producto,
    precio,
    fecha_datos,
    CASE
        WHEN unidad_limpia IN ("KG", "KGM", "KGR", "KILO") THEN cantidad_pres * 1000
        WHEN unidad_limpia IN ("GR", "GRM", "GRAMOS", "G") THEN cantidad_pres
        WHEN unidad_limpia IN ("LT", "LTR", "L", "LITRO", "DM3") THEN cantidad_pres * 1000
        WHEN unidad_limpia = "CL" THEN cantidad_pres * 10
        WHEN unidad_limpia IN ("ML", "CM3", "CMQ", "CC") THEN cantidad_pres
        WHEN unidad_limpia IN ("UNI", "UNIDAD", "UD", "UN", "EA", "CU") THEN cantidad_pres
        ELSE NULL
    END AS cantidad_normalizada,
    CASE
        WHEN unidad_limpia IN ("KG", "KGM", "KGR", "KILO", "GR", "GRM", "GRAMOS", "G") THEN "g"
        WHEN unidad_limpia IN ("LT", "LTR", "L", "LITRO", "DM3", "CL",
                               "ML", "CM3", "CMQ", "CC") THEN "cc"
        WHEN unidad_limpia IN ("UNI", "UNIDAD", "UD", "UN", "EA", "CU") THEN "unidad"
        ELSE NULL
    END AS unidad_normalizada
FROM con_unidad_limpia
