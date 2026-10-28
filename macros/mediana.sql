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
