{#
    Los nombres que, usados como localidad, en realidad dicen una provincia:
    el de cada provincia y los genericos de CABA, normalizados sin mayusculas
    ni tildes. Una sucursal con uno de estos nombres como localidad y otra
    provincia cargada esta mal cargada (stg_sucursales la corrige por
    coordenadas, tests/localidad_no_es_otra_provincia.sql lo vigila).

    Devuelve una expresion para FROM: UNNEST de STRUCT(provincia, nombre).
#}
{% macro nombres_de_provincia() %}
    UNNEST([
        STRUCT("AR-C" AS provincia, "capital federal" AS nombre),
        ("AR-C", "ciudad autonoma de buenos aires"), ("AR-C", "ciudad autonoma buenos aires"),
        ("AR-C", "ciudad autonoma de bs as"), ("AR-C", "caba"),
        ("AR-B", "buenos aires"), ("AR-K", "catamarca"), ("AR-H", "chaco"),
        ("AR-U", "chubut"), ("AR-X", "cordoba"), ("AR-W", "corrientes"),
        ("AR-E", "entre rios"), ("AR-P", "formosa"), ("AR-Y", "jujuy"),
        ("AR-L", "la pampa"), ("AR-F", "la rioja"), ("AR-M", "mendoza"),
        ("AR-N", "misiones"), ("AR-Q", "neuquen"), ("AR-R", "rio negro"),
        ("AR-A", "salta"), ("AR-J", "san juan"), ("AR-D", "san luis"),
        ("AR-Z", "santa cruz"), ("AR-S", "santa fe"), ("AR-G", "santiago del estero"),
        ("AR-V", "tierra del fuego"), ("AR-T", "tucuman")
    ])
{% endmacro %}
