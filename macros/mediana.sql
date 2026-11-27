{#
    Mediana exacta de un ARRAY ya ordenado: con cantidad par de valores, el
    promedio de los dos del medio.

    APPROX_QUANTILES(x, 2)[OFFSET(1)] no lo es: con valores pares devuelve el
    de abajo. En El mismo producto eso bajaba la referencia del mercado en 2.149
    de 9.498 productos (auditoria 2026-10-28), y con dos banderas de una empresa
    el precio de la empresa era el de la mas barata.

    BigQuery no tiene una mediana exacta como agregado, y ARRAY_AGG no se puede
    usar adentro de un UNNEST en la misma consulta: el array se arma en una CTE
    (ARRAY_AGG(x IGNORE NULLS ORDER BY x)) y la mediana se saca en la siguiente.
    Un array vacio da NULL.
#}
{% macro mediana(arreglo) %}
    (
        SELECT AVG(v)
        FROM UNNEST({{ arreglo }}) AS v WITH OFFSET AS o
        WHERE o BETWEEN DIV(ARRAY_LENGTH({{ arreglo }}) - 1, 2) AND DIV(ARRAY_LENGTH({{ arreglo }}), 2)
    )
{% endmacro %}

{#
    Mediana BAJA exacta, como agregado: el valor del medio y, con cantidad par
    de valores, el de abajo de los dos del medio. Va directo en un SELECT con
    GROUP BY, sin la CTE que necesita `mediana`.

    POR QUE BAJA Y NO EL PROMEDIO (2026-11-26, change
    precios-por-cadena-deterministas)
    Es la que usa el precio de un producto en una cadena
    (int_precio_producto_cadena). Antes era APPROX_QUANTILES(x, 2)[OFFSET(1)],
    que no es determinista: dos reconstrucciones con el mismo crudo cambiaron
    123 de ~258 mil precios, hasta 22%. En los grupos chicos el aproximado ya
    daba el de abajo, asi que la mediana baja solo mueve los grupos donde se
    equivocaba; el promedio habria movido miles de precios el dia del deploy, y
    la historia y los cambios de precio los habrian leido como cambios reales.
    Ademas el resultado es siempre un valor que alguien informo: un precio que
    cobra alguna sucursal, un tamano que declaro alguna (nunca 750 g entre 500 y
    1.000).

    Los NULL se ignoran. Si todos lo son, ARRAY_AGG devuelve NULL y el
    resultado es NULL, sin cortar la corrida.
#}
{% macro mediana_baja(columna) %}
    ARRAY_AGG({{ columna }} IGNORE NULLS ORDER BY {{ columna }})[SAFE_OFFSET(DIV(COUNT({{ columna }}) - 1, 2))]
{% endmacro %}
