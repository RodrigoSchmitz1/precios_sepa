{#
  Donde compite una cadena segun su formato (2026-11-19, openspec
  comercios-regionales-y-farmacity). Un supermercado compite en todo; una
  farmacia (Farmacity) solo en var('rubros_farmacia'): vende shampoo y panales,
  no una compra de super, y unos chocolates sueltos no la hacen competir en
  Golosinas. formato NULL (particiones de antes de la columna) es supermercado.

  Un mayorista no compite en ningun rubro (openspec sumar-mayoristas): su precio
  es por unidad comprando el bulto, no la compra de una persona, y ganaria todas
  las categorias. Antes de los mayoristas la segunda condicion no miraba el
  formato porque solo habia supermercados y farmacias; con un tercer formato,
  "cualquier cosa que no sea super compite en Higiene" lo habria colado ahi.
#}
{% macro compite_en_rubro(formato, rubro) %}
    (COALESCE({{ formato }}, 'supermercado') = 'supermercado'
     OR ({{ formato }} = 'farmacia'
         AND {{ rubro }} IN ({% for r in var('rubros_farmacia') %}'{{ r }}'{% if not loop.last %}, {% endif %}{% endfor %})))
{% endmacro %}
