{#
  SUCURSALES REPETIDAS ENTRE BANDERAS (2026-11-24). Comodin (comercio 6) tiene
  dos banderas, Comodin y Maxi Comodin, que numeran sus sucursales desde 1 cada
  una: hay una "sucursal 1" de cada bandera. El resto del proyecto identifica
  una sucursal por comercio + sucursal (mart_mapa_sucursales arma "6-1"), asi
  que las dos chocaban y fallaban los tests de unicidad. No se veia antes porque
  esas filas llegaban partidas y se descartaban (ver limpiar_sucursales).

  Para los comercios de var('comercios_sucursal_por_bandera') la sucursal lleva
  la bandera adelante ("2b1"). Para los demas no cambia nada: sus claves, los
  historicos y las listas de sucursales de la API siguen igual. Se aplica en los
  tres lugares que leen id_sucursal del crudo: limpiar_sucursales, stg_productos
  y mart_promos_evidencia.
#}
{% macro id_sucursal_unica(id_comercio, id_bandera, id_sucursal) %}
    IF(
        {{ id_comercio }} IN ({% for c in var('comercios_sucursal_por_bandera') %}'{{ c }}'{% if not loop.last %}, {% endif %}{% endfor %}),
        CONCAT({{ id_bandera }}, 'b', {{ id_sucursal }}),
        {{ id_sucursal }}
    )
{% endmacro %}
