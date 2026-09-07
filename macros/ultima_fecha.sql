{% macro ultima_fecha(relacion) %}
    {#
      Devuelve la fecha maxima cargada en una tabla particionada por fecha_datos,
      como literal, para poder filtrar con DATE('...') en vez de con una
      subconsulta.

      Por que importa: BigQuery NO poda particiones cuando el filtro es una
      subconsulta como "WHERE fecha_datos = (SELECT MAX(fecha_datos) ...)".
      Con ese patron se escanea la tabla entera aunque solo se quiera un dia
      (medido: 3.9 GB contra 1.3 GB, 67% de diferencia).

      Se lee de INFORMATION_SCHEMA.PARTITIONS, que es metadata y no consume
      cuota. Consultar MAX(fecha_datos) directamente costaria escanear esa
      columna en cada modelo que lo necesite.
    #}
    {%- set consulta -%}
        SELECT MAX(PARSE_DATE('%Y%m%d', partition_id)) AS fecha
        FROM `{{ relacion.database }}.{{ relacion.schema }}`.INFORMATION_SCHEMA.PARTITIONS
        WHERE table_name = '{{ relacion.identifier }}'
          AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
    {%- endset -%}

    {%- if execute -%}
        {%- set resultado = run_query(consulta).columns[0].values()[0] -%}
        {%- if resultado is none -%}
            {#- La tabla todavia no esta particionada (por ejemplo, la primera
                corrida despues de agregarle particion). Se cae a consultar la
                columna, que si consume cuota pero solo en ese caso. -#}
            {%- set respaldo -%}
                SELECT MAX(fecha_datos) AS fecha FROM {{ relacion }}
            {%- endset -%}
            {{ return(run_query(respaldo).columns[0].values()[0]) }}
        {%- else -%}
            {{ return(resultado) }}
        {%- endif -%}
    {%- else -%}
        {#- En la fase de parseo dbt no ejecuta queries; el valor real se
            resuelve al compilar de verdad. -#}
        {{ return('1970-01-01') }}
    {%- endif -%}
{% endmacro %}
