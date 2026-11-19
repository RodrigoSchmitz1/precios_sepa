{#
  Donde compite una cadena segun su formato (2026-11-19, openspec
  comercios-regionales-y-farmacity). Un supermercado compite en todo; una
  farmacia (Farmacity) solo en var('rubros_farmacia'): vende shampoo y panales,
  no una compra de super, y unos chocolates sueltos no la hacen competir en
  Golosinas. formato NULL (particiones de antes de la columna) es supermercado.
#}
{% macro compite_en_rubro(formato, rubro) %}
    (COALESCE({{ formato }}, 'supermercado') = 'supermercado'
     OR {{ rubro }} IN ({% for r in var('rubros_farmacia') %}'{{ r }}'{% if not loop.last %}, {% endif %}{% endfor %}))
{% endmacro %}
