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
            {%- set desde_columna = run_query(respaldo).columns[0].values()[0] -%}
            {%- if desde_columna is none -%}
                {#- Ni particiones ni filas: la tabla esta vacia. Paso el
                    2026-09-18: la ingesta local no corrio durante cuatro dias y
                    BigQuery expiro las tres particiones que retiene el crudo.

                    Sin este chequeo el macro devuelve None y el modelo compila
                    "WHERE fecha_datos = DATE('None')", que BigQuery rechaza con
                    "Could not cast literal None to type TIMESTAMP": un error que
                    no dice nada de la causa real y costo tres dias de pipeline
                    en rojo hasta entenderlo.

                    Se corta con un error explicito y NO devolviendo una fecha
                    imposible como hace fechas_a_calcular. Son casos distintos:
                    alla el destino es un historico particionado, donde una fecha
                    vacia no toca las particiones ya escritas. Aca los que
                    llaman son marts materializados como table, asi que devolver
                    una fecha sin datos los reconstruiria VACIOS y el sitio se
                    quedaria sin nada que mostrar. Fallando, cada mart conserva
                    su ultimo contenido bueno y el workflow avisa por mail. -#}
                {{ exceptions.raise_compiler_error(
                    "La tabla " ~ relacion ~ " esta vacia: no tiene particiones ni filas. "
                    ~ "Casi siempre significa que la ingesta local no corrio y BigQuery "
                    ~ "expiro el crudo (retiene 3 dias). Corre ingesta_backfill.py antes de dbt."
                ) }}
            {%- endif -%}
            {{ return(desde_columna) }}
        {%- else -%}
            {{ return(resultado) }}
        {%- endif -%}
    {%- else -%}
        {#- En la fase de parseo dbt no ejecuta queries; el valor real se
            resuelve al compilar de verdad. -#}
        {{ return('1970-01-01') }}
    {%- endif -%}
{% endmacro %}
