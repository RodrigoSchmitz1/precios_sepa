{{
  config(
    materialized="incremental",
    incremental_strategy="insert_overwrite",
    partition_by={
      "field": "fecha_datos",
      "data_type": "date"
    },
    partition_expiration_days=none,
    on_schema_change="append_new_columns"
  )
}}

-- Historia del precio de cada producto en cada cadena (openspec historia-de-precio).
--
-- IMPORTANTE: nunca correr con --full-refresh sobre este modelo. El crudo vence
-- a los 4 dias: un full-refresh borraria toda la historia y la reemplazaria por
-- la foto de hoy. Es irreversible, igual que en los otros historicos.
--
-- UN REGISTRO DE CAMBIOS, NO UNA FOTO DIARIA (medido el 2026-11-18)
-- Una foto diaria de los ~229 mil precios ocupa ~8,5 MiB por dia y llenaria lo
-- que queda de los 10 GiB gratuitos en menos de un año. De un dia al otro
-- cambian ~2.950 precios (1,3%) y aparecen ~1.000 productos: guardando solo
-- los cambios son ~10 MiB el primer dia y ~0,2 MiB por dia despues.
--
-- Una fila por producto x cadena cuando su precio creible difiere del ultimo
-- guardado (o es la primera vez que aparece). Un dia sin cambio, o una cadena
-- que no vino (no esta en el mart), no suma filas.
--
-- LA FUENTE ES mart_mismo_producto, el mismo precio que muestra el sitio: lo
-- que la pagina diga como "antes $ X" es lo que mostro ese dia, y los precios
-- no creibles (errores de carga, saltos de 10x) no entran. Una cadena
-- arrastrada trae el mismo precio que el dia anterior, asi que no genera fila.
-- El mart tiene solo la ultima fecha: si una corrida procesa varias fechas
-- atrasadas, el cambio queda en la ultima, con su fecha_precio real.
--
-- IDEMPOTENTE: se compara contra lo guardado ANTES de la fecha del mart, asi
-- que correr dos veces el mismo dia escribe la misma particion.

WITH hoy AS (
    SELECT
        fecha_datos,
        fecha_precio,
        id_producto,
        cadena,
        precio_mediano AS precio
    FROM {{ ref("mart_mismo_producto") }}
    WHERE precio_creible
        AND precio_mediano IS NOT NULL
)

{% if is_incremental() %}
, ultimo AS (
    SELECT id_producto, cadena, precio
    FROM {{ this }}
    WHERE fecha_datos < (SELECT MAX(fecha_datos) FROM hoy)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY id_producto, cadena ORDER BY fecha_datos DESC) = 1
)
{% endif %}

SELECT
    h.fecha_datos,
    h.fecha_precio,
    h.id_producto,
    h.cadena,
    h.precio
FROM hoy AS h
{% if is_incremental() %}
LEFT JOIN ultimo AS u
    ON u.id_producto = h.id_producto
    AND u.cadena = h.cadena
-- Medio centavo de tolerancia: la mediana es un FLOAT64 y dos precios iguales
-- pueden diferir en el ultimo decimal.
WHERE u.precio IS NULL
    OR ABS(h.precio - u.precio) > 0.005
{% endif %}
