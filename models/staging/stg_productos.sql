{{
  config(
    materialized="table",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date"
    }
  )
}}

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
