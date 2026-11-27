{#
  Los productos del crudo, minoristas y (con var('mayoristas_activos')) mayoristas,
  con las mismas columnas (openspec sumar-mayoristas).

  sepa.productos_mayoristas tiene las 13 columnas de sepa.productos con el mismo
  nombre y significado (el precio de lista es por unidad comprando el bulto, con
  IVA) mas unidades_bulto y precio_bulto, que en minoristas van NULL. es_mayorista
  dice de que crudo viene cada fila.

  Se usa como subconsulta en el FROM. Los filtros por fecha_datos que pone cada
  modelo llegan a las dos ramas del UNION ALL, asi que BigQuery sigue podando
  particiones en las dos tablas.
#}
{% macro crudo_productos() %}
(
    SELECT
        id_comercio,
        id_bandera,
        id_sucursal,
        id_producto,
        productos_descripcion,
        productos_cantidad_presentacion,
        productos_unidad_medida_presentacion,
        productos_marca,
        productos_precio_lista,
        productos_precio_unitario_promo1,
        productos_leyenda_promo1,
        productos_precio_unitario_promo2,
        productos_leyenda_promo2,
        CAST(NULL AS STRING) AS unidades_bulto,
        CAST(NULL AS STRING) AS precio_bulto,
        FALSE AS es_mayorista,
        fecha_datos
    FROM {{ source("sepa", "productos") }}
    {%- if var("mayoristas_activos") %}
    UNION ALL
    SELECT
        id_comercio,
        id_bandera,
        id_sucursal,
        id_producto,
        productos_descripcion,
        productos_cantidad_presentacion,
        productos_unidad_medida_presentacion,
        productos_marca,
        productos_precio_lista,
        productos_precio_unitario_promo1,
        productos_leyenda_promo1,
        productos_precio_unitario_promo2,
        productos_leyenda_promo2,
        unidades_bulto,
        precio_bulto,
        TRUE AS es_mayorista,
        fecha_datos
    FROM {{ source("sepa", "productos_mayoristas") }}
    {%- endif %}
)
{% endmacro %}
