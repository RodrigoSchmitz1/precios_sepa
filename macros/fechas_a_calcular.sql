{% macro fechas_a_calcular(fuente, nombre_historico, incluir_anterior=false) %}
    {#
      Devuelve, como lista de literales DATE, las fechas que un mart tiene que
      calcular hoy: las que estan en el crudo pero todavia NO llegaron al
      historico, mas siempre la ultima disponible.

      POR QUE EXISTE
      Los marts se recalculan sobre las 3 fechas que retiene el crudo para que un
      dia de ingesta perdido se recupere solo. El problema es que en un dia
      normal eso significa recalcular dos fechas que YA estan en el historico y
      cuyo resultado no va a cambiar: trabajo tirado que se paga todos los dias.
      Medido: la corrida diaria escanea 15,6 GiB y el mes venia rozando el TB
      gratuito de BigQuery.

      POR QUE SIEMPRE SE INCLUYE LA ULTIMA
      Si un dia no hay nada pendiente (por ejemplo, si el pipeline corre dos
      veces), la lista quedaria vacia y el mart se reconstruiria sin filas. Los
      marts los lee la API, asi que el sitio se quedaria sin datos. Incluyendo
      siempre la ultima fecha, el mart nunca queda vacio.

      COSTO CERO
      Las dos listas de fechas salen de INFORMATION_SCHEMA.PARTITIONS, que es
      metadata y no consume cuota. Es el mismo mecanismo que usa ultima_fecha.

      OJO AL CAMBIAR UNA METODOLOGIA
      Con este filtro, una fecha que ya esta en el historico NO se vuelve a
      calcular. Si se cambia como se calcula algo y hay que rehacer fechas
      anteriores, primero hay que borrar esas filas del historico; despues la
      corrida siguiente las recalcula sola por estar pendientes.

      incluir_anterior=true agrega la fecha inmediatamente anterior a la primera
      pendiente. Lo necesita mart_precios_cadena_categoria, cuyo indice
      encadenado compara cada fecha contra la anterior: sin ese dia extra no
      tendria contra que parear.

      El historico se pasa por NOMBRE y no con ref(). Con ref() dbt agregaria una
      dependencia del mart hacia su propio historico, que ya depende del mart:
      un ciclo, y la corrida no compilaria. Aca solo se leen sus particiones, que
      no es una dependencia de datos real.
    #}
    {%- if not execute -%}
        {{ return("DATE('1970-01-01')") }}
    {%- endif -%}

    {%- set consulta_particiones -%}
        SELECT
            table_name,
            PARSE_DATE('%Y%m%d', partition_id) AS fecha
        FROM `{{ fuente.database }}.{{ fuente.schema }}`.INFORMATION_SCHEMA.PARTITIONS
        WHERE table_name IN ('{{ fuente.identifier }}', '{{ nombre_historico }}')
          AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
    {%- endset -%}

    {%- set filas = run_query(consulta_particiones) -%}
    {%- set en_crudo = [] -%}
    {%- set en_historico = [] -%}
    {%- for fila in filas.rows -%}
        {%- if fila[0] == fuente.identifier -%}
            {%- do en_crudo.append(fila[1]) -%}
        {%- else -%}
            {%- do en_historico.append(fila[1]) -%}
        {%- endif -%}
    {%- endfor -%}

    {%- if en_crudo | length == 0 -%}
        {#- Sin particiones en el crudo no hay nada que calcular; se devuelve una
            fecha imposible para que el modelo salga vacio en vez de fallar. -#}
        {{ return("DATE('1970-01-01')") }}
    {%- endif -%}

    {%- set ordenadas = en_crudo | sort -%}
    {%- set pendientes = [] -%}
    {%- for fecha in ordenadas -%}
        {%- if fecha not in en_historico -%}
            {%- do pendientes.append(fecha) -%}
        {%- endif -%}
    {%- endfor -%}

    {#- La ultima siempre entra, para que el mart nunca quede vacio. -#}
    {%- set ultima = ordenadas | last -%}
    {%- if ultima not in pendientes -%}
        {%- do pendientes.append(ultima) -%}
    {%- endif -%}

    {%- if incluir_anterior -%}
        {%- set primera_pendiente = (pendientes | sort) | first -%}
        {%- for fecha in ordenadas -%}
            {%- if fecha < primera_pendiente and fecha not in pendientes -%}
                {%- do pendientes.append(fecha) -%}
            {%- endif -%}
        {%- endfor -%}
        {#- Solo hace falta la inmediatamente anterior, no todas las previas. -#}
        {%- set previas = [] -%}
        {%- for fecha in (pendientes | sort) -%}
            {%- if fecha < primera_pendiente -%}
                {%- do previas.append(fecha) -%}
            {%- endif -%}
        {%- endfor -%}
        {%- if previas | length > 1 -%}
            {%- for fecha in previas[:-1] -%}
                {%- do pendientes.remove(fecha) -%}
            {%- endfor -%}
        {%- endif -%}
    {%- endif -%}

    {%- set literales = [] -%}
    {%- for fecha in (pendientes | sort) -%}
        {%- do literales.append("DATE('" ~ fecha ~ "')") -%}
    {%- endfor -%}
    {{ return(literales | join(", ")) }}
{% endmacro %}
