{#
  Los id_comercio de SEPA mayoristas (openspec sumar-mayoristas), como subconsulta
  de una columna STRING.

  Un comercio es mayorista si el seed lo dice (mapeo_cadenas, formato
  'mayorista') o si declara sucursales de tipo "mayorista". Lo segundo es la red
  para un mayorista nuevo que SEPA empiece a publicar antes de que alguien lo
  cargue en el seed: sin ella entraria como supermercado y competiria en todo.

  Por que el tipo de sucursal y no "esta en el crudo de mayoristas": el crudo
  vence a los 3 dias y las dimensiones no. Unos dias sin ingesta vaciarian el
  crudo y los mayoristas pasarian a ser supermercados en el mapa. Medido el
  2026-11-26: ninguna de las ~2.900 sucursales minoristas declara tipo
  "mayorista" (son hipermercado, supermercado, autoservicio o web) y las 91
  mayoristas lo declaran todas. Maxi (Carrefour) declara hiper o super.

  Lee la dimension cruda de sucursales: una columna chica, unos KB.
#}
{% macro comercios_mayoristas() %}
    SELECT CAST(id_comercio AS STRING) AS id_comercio
    FROM {{ ref("mapeo_cadenas") }}
    WHERE formato = 'mayorista'
    UNION DISTINCT
    SELECT TRIM(id_comercio) AS id_comercio
    FROM {{ source("sepa", "sucursales") }}
    WHERE LOWER(TRIM(sucursales_tipo)) = 'mayorista'
        AND REGEXP_CONTAINS(id_comercio, r"^[0-9]+$")
{% endmacro %}


{#
  Filtro para staging: con var('mayoristas_activos') apagada, deja afuera las
  filas de comercios mayoristas. Sin esto, la carga combinada de sucursales y
  comercio pondria a Makro en el mapa como un supermercado mas apenas entrara la
  ingesta nueva, antes de que el sitio sepa mostrarlo.
#}
{% macro sin_mayoristas_si_apagado(columna_id_comercio) %}
    {%- if not var("mayoristas_activos") -%}
    AND {{ columna_id_comercio }} NOT IN ({{ comercios_mayoristas() }})
    {%- endif -%}
{% endmacro %}
