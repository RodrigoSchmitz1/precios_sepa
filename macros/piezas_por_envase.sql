{#
  PAQUETES CARGADOS COMO "1 UNIDAD" (corregido 2026-09-26).

  En las categorias que se cotizan por pieza (var categorias_por_pieza: huevos,
  panales, toallitas...) muchas cadenas informan el paquete entero como "1 UN":
  "HUEVO BLANCO CARREFOUR CARTON X 30 UNI" llega con cantidad 1, asi que su
  precio "por huevo" es el del maple. Medido el 2026-09-24: 65 de 221 huevos,
  150 de 354 panales y 359 de 467 descartables venian asi. El premium de Huevos
  daba $2.250 por huevo.

  Y la categoria mezcla cosas que no se cuentan igual: en Higiene bebe, Tu
  canasta pide 100 unidades pensando en toallitas, pero la mediana por unidad
  incluia chupetes y mamaderas de $9.000. La toallita economica salia $2.520 y
  esa linea sola sumaba unos $250.000.

  LA REGLA, solo para esas categorias:
    - Si la fuente dice 1 y la descripcion dice cuantas piezas trae, se usa la
      descripcion ("X 30 UNI", "48U", "X20", "MAPLE" = 30, "DOCENA" = 12).
    - Solo cuentan envases de 3 a 200 piezas. Un paquete sin cantidad legible
      ("PAMPERS PANTS") no tiene precio por pieza, y lo que se vende suelto
      (un chupete, una mamadera) no es lo que se pide por pieza en esa
      categoria. Esos productos quedan fuera del precio por pieza, no se
      inventa cuantas trae.

  Revisado a mano sobre los 1.519 productos de las cuatro categorias del
  2026-09-24: la lectura evita medidas ("25X25 CM", "X 7.5 MTS", "45 X 55") y
  entran 217 de 221 huevos, 277 de 354 panales, 85 de 477 de higiene de bebe
  (toallitas, algodones, hisopos) y 279 de 467 descartables.
#}

{% macro piezas_en_descripcion(descripcion) -%}
    {%- set d = "UPPER(" ~ descripcion ~ ")" -%}
    CASE
        WHEN {{ d }} LIKE "%MEDIA DOCENA%" THEN 6
        WHEN {{ d }} LIKE "%DOCENA%" THEN 12
        ELSE COALESCE(
            -- Un numero seguido de una palabra de conteo: "30 UNI", "48U", "6 CU".
            SAFE_CAST(REGEXP_EXTRACT({{ d }},
                r"(?:^|[^0-9.,])(\d{1,3})\s*(?:UNIDADES|UNIDAD|UNIDS|UNID|UNI|UDS|UN|CU|U|PAÑOS|PANOS)(?:[^A-Z]|$)") AS INT64),
            -- "X 30" o "KITTYX8" al final o antes de una palabra. No toma "25X25",
            -- "45 X 55" (medidas) ni "X 900 CC", "X 7.5 MTS", "X 3 KG" (unidades).
            SAFE_CAST(REGEXP_EXTRACT({{ d }},
                r"(?:^|[^0-9X]\s|[A-Z])X\s*(\d{1,3})(?:\s*$|\s+[^0-9CMGKL\s]|\s+C\s*T)") AS INT64),
            IF({{ d }} LIKE "%MAPLE%", 30, NULL)
        )
    END
{%- endmacro %}


{#- Cantidad con la que se divide el precio. `envase` es un alias con las columnas
    por_pieza y piezas_descripcion (mart_gama_productos las expone). -#}
{% macro cantidad_efectiva(p, envase) -%}
    IF({{ p }}.unidad_normalizada = "unidad" AND {{ envase }}.por_pieza AND {{ p }}.cantidad_normalizada = 1,
       {{ envase }}.piezas_descripcion,
       {{ p }}.cantidad_normalizada)
{%- endmacro %}


{#- Rango de sanidad de las cantidades, el mismo en todos los modelos de precios. -#}
{% macro cantidad_razonable(p, envase) -%}
    (
        ({{ p }}.unidad_normalizada IN ("g", "cc") AND {{ p }}.cantidad_normalizada BETWEEN 5 AND 10000)
        OR ({{ p }}.unidad_normalizada = "unidad" AND NOT {{ envase }}.por_pieza
            AND {{ p }}.cantidad_normalizada BETWEEN 1 AND 60)
        OR ({{ p }}.unidad_normalizada = "unidad" AND {{ envase }}.por_pieza
            AND {{ cantidad_efectiva(p, envase) }} BETWEEN 3 AND 200)
    )
{%- endmacro %}
