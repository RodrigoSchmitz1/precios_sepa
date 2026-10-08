{% macro fechas_a_calcular(fuente, nombre_historico, incluir_anterior=false, dataset_historico=none) %}
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
      calcular. Si se corrige como se calcula algo y hay que rehacer fechas
      anteriores, se fuerzan con la variable recalcular_fechas:

        dbt run --select <modelos> --vars '{recalcular_fechas: ["2026-09-07", "2026-09-08"]}'

      insert_overwrite reemplaza exactamente esas particiones del historico. No
      hace falta borrar filas a mano, que era la alternativa: un DELETE sobre la
      unica data irrecuperable del proyecto. Una fecha forzada que ya no esta en
      la fuente se ignora, asi que el historico conserva lo que tenia.

      incluir_anterior=true agrega la fecha inmediatamente anterior a la primera
      pendiente. Lo necesita mart_precios_cadena_categoria, cuyo indice
      encadenado compara cada fecha contra la anterior: sin ese dia extra no
      tendria contra que parear.

      dataset_historico hace falta cuando la tabla destino no esta en el mismo
      dataset que la fuente. Es el caso de stg_productos: lee del crudo en sepa
      y vive en dbt_precios. Sin el parametro se asume el dataset de la fuente.

      El historico se pasa por NOMBRE y no con ref(). Con ref() dbt agregaria una
      dependencia del mart hacia su propio historico, que ya depende del mart:
      un ciclo, y la corrida no compilaria. Aca solo se leen sus particiones, que
      no es una dependencia de datos real.
    #}
    {%- if not execute -%}
        {{ return("DATE('1970-01-01')") }}
    {%- endif -%}

    {%- set esquema_historico = dataset_historico or fuente.schema -%}
    {%- set consulta_particiones -%}
        SELECT
            'fuente' AS origen,
            PARSE_DATE('%Y%m%d', partition_id) AS fecha
        FROM `{{ fuente.database }}.{{ fuente.schema }}`.INFORMATION_SCHEMA.PARTITIONS
        WHERE table_name = '{{ fuente.identifier }}'
          AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
        UNION ALL
        SELECT
            'historico' AS origen,
            PARSE_DATE('%Y%m%d', partition_id) AS fecha
        FROM `{{ fuente.database }}.{{ esquema_historico }}`.INFORMATION_SCHEMA.PARTITIONS
        WHERE table_name = '{{ nombre_historico }}'
          AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
    {%- endset -%}

    {%- set filas = run_query(consulta_particiones) -%}
    {%- set en_crudo = [] -%}
    {%- set en_historico = [] -%}
    {%- for fila in filas.rows -%}
        {%- if fila[0] == 'fuente' -%}
            {%- do en_crudo.append(fila[1]) -%}
        {%- else -%}
            {%- do en_historico.append(fila[1]) -%}
        {%- endif -%}
    {%- endfor -%}

    {%- if en_crudo | length == 0 -%}
        {#- SIN FECHAS EN LA FUENTE SE CORTA CON ERROR (2026-10-08). Hasta ese dia
            se devolvia una fecha imposible "para que el modelo salga vacio en vez
            de fallar", pensando en los historicos, donde una fecha vacia no toca
            nada. Pero tambien llaman a este macro mart_canasta_detalle,
            mart_quien_gana y mart_precios_cadena_categoria, que son tablas que se
            reconstruyen enteras: SEPA no publico del 2 al 6 de octubre,
            stg_productos (3 dias de retencion) se vacio, la corrida del 7 las
            rearmo SIN FILAS y la canasta basica y Mas barato quedaron en blanco.
            Fallando, cada tabla conserva su ultimo contenido bueno y el workflow
            avisa, igual que ultima_fecha. -#}
        {{ exceptions.raise_compiler_error(
            "La fuente " ~ fuente ~ " no tiene particiones: no hay fechas que calcular. "
            ~ "Se corta para no reconstruir vacios los marts que dependen de ella."
        ) }}
    {%- endif -%}

    {%- set ordenadas = en_crudo | sort -%}
    {%- set pendientes = [] -%}
    {%- for fecha in ordenadas -%}
        {%- if fecha not in en_historico -%}
            {%- do pendientes.append(fecha) -%}
        {%- endif -%}
    {%- endfor -%}

    {#- TOPE DE FECHAS POR CORRIDA (2026-10-08). Cada fecha pendiente suma unos 5
        GiB a la corrida (el 01-10, tres fechas costaron 21,8 GiB) y la cuota
        diaria es de 27: despues de varios dias sin publicacion, SEPA largo seis
        fechas juntas y una sola corrida las habria cortado a mitad de camino. Se
        procesan las mas viejas primero y el resto al dia siguiente; como las
        pendientes se calculan contra los historicos, la corrida siguiente sigue
        sola desde donde quedo. La retencion dinamica de la ingesta mantiene esas
        fechas en el crudo mientras tanto. -#}
    {%- set tope = var("maximo_fechas_por_corrida") -%}
    {%- if pendientes | length > tope -%}
        {%- set pendientes = pendientes[:tope] -%}
    {%- else -%}
        {#- La ultima siempre entra, para que el mart nunca quede vacio. Con el
            tope activo no hace falta: las pendientes ya traen fechas. -#}
        {%- set ultima = ordenadas | last -%}
        {%- if ultima not in pendientes -%}
            {%- do pendientes.append(ultima) -%}
        {%- endif -%}
    {%- endif -%}

    {#- Fechas forzadas para recalcular (ver OJO AL CAMBIAR UNA METODOLOGIA).
        Solo entran las que existen en la fuente. -#}
    {%- for texto in var("recalcular_fechas", []) -%}
        {%- set forzada = modules.datetime.date.fromisoformat(texto | string) -%}
        {%- if forzada in ordenadas and forzada not in pendientes -%}
            {%- do pendientes.append(forzada) -%}
        {%- endif -%}
    {%- endfor -%}

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
