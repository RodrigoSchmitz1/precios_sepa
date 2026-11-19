-- Falla si una cadena que el dia anterior tenia mas de 1.000 productos falta
-- en el ultimo dia, o llega con menos de la mitad.
--
-- EL CASO QUE LO MOTIVO
-- El ZIP que SEPA publico para el 2026-11-11 no traia a Cencosud (sepa9): ni
-- productos, ni sucursales, ni comercio. La ingesta lo anoto en el log como
-- "ese comercio no vino en el ZIP de esta fecha, se omite" y siguio, porque un
-- comercio ausente es normal (sepa16 no viene nunca). Jumbo, Disco y Vea, con
-- unos 10.000 productos cada una el 9 y el 10, quedaron fuera de
-- int_precio_producto_cadena, y El mismo producto, Mas barato y los historicos
-- de ese dia salieron con 11 cadenas en vez de 14. Todo en verde.
--
-- No fue la primera vez. En los historicos (66 fechas, 2026-09-07 a 11-11):
--   2026-09-29  falta Cooperativa Obrera (sepa13)
--   2026-11-08  falta Dia (sepa15)
--   2026-11-11  faltan Jumbo, Disco y Vea (sepa9)
-- Las tres por la misma causa: el comercio no vino en el ZIP de SEPA. Un
-- comercio puede tener varias banderas, asi que se pierden de a varias.
--
-- POR QUE CONTRA EL DIA ANTERIOR Y NO CONTRA UNA LISTA FIJA
-- Una lista fija de 14 cadenas habria que tocarla cada vez que SEPA suma o saca
-- una. El dia anterior ya es la referencia de "lo que deberia estar". Una cadena
-- nueva no falla (no estaba ayer) y una que vuelve tampoco.
--
-- LOS UMBRALES
-- 1.000 productos: la cadena mas chica de las 14 es Dia, con unos 4.000. Con
-- 1.000 entra cualquier cadena real y queda afuera una bandera marginal que
-- aparezca con un puñado de filas.
-- La mitad: en las 66 fechas ninguna cadena perdio mas del 50% de sus productos
-- de un dia para otro sin desaparecer del todo, asi que el corte no da falsas
-- alarmas y atrapa una carga parcial, que seria el mismo problema a medias.
--
-- COMERCIOS INTERMITENTES (2026-11-19): ver el filtro de informe_diario al final.
--
-- SEVERIDAD: error, como crudo_al_dia. Un warn no lo lee nadie; el error pone
-- el workflow en rojo y GitHub manda el mail. Como los tests corren despues de
-- dbt run (no con build), fallar no impide que el dia entre a los historicos.
--
-- COSTO
-- La ultima fecha sale de INFORMATION_SCHEMA (ultima_fecha, sin cuota) y el
-- filtro es entre literales, asi que BigQuery poda particiones. Lee dos
-- columnas de la tabla intermedia: unos 13 MB en el dry run del 2026-11-12.
--
-- PARA PROBARLO SOBRE OTRO DIA
--   dbt test --select cadenas_del_ultimo_dia_completas --vars '{control_cadenas_fecha: "2026-11-10"}'
-- El 2026-11-10 pasa y el 2026-11-11 falla con las tres cadenas de Cencosud.

{% set ultima = var("control_cadenas_fecha", none) or ultima_fecha(ref("int_precio_producto_cadena")) %}

WITH por_dia AS (
    SELECT fecha_datos, cadena, COUNT(*) AS productos
    FROM {{ ref("int_precio_producto_cadena") }}
    -- Una semana de ventana para encontrar el dia anterior aunque falten fechas
    -- en el medio. Hoy la tabla retiene 3 dias, asi que lee lo que haya.
    WHERE fecha_datos BETWEEN DATE_SUB(DATE('{{ ultima }}'), INTERVAL 7 DAY)
        AND DATE('{{ ultima }}')
    GROUP BY fecha_datos, cadena
),

dia_anterior AS (
    SELECT MAX(fecha_datos) AS fecha
    FROM por_dia
    WHERE fecha_datos < DATE('{{ ultima }}')
)

SELECT
    DATE('{{ ultima }}') AS fecha,
    a.fecha_datos AS fecha_anterior,
    a.cadena,
    a.productos AS productos_dia_anterior,
    COALESCE(u.productos, 0) AS productos_ultimo_dia
FROM por_dia AS a
JOIN dia_anterior AS d ON a.fecha_datos = d.fecha
LEFT JOIN por_dia AS u
    ON u.cadena = a.cadena
    AND u.fecha_datos = DATE('{{ ultima }}')
WHERE a.productos > 1000
    AND COALESCE(u.productos, 0) < a.productos * 0.5
    -- Los comercios que SEPA no publica todos los dias no cuentan
    -- (informe_diario en seeds/mapeo_cadenas.csv). En la semana del 13 al
    -- 19-11, Farmacity falto 1 dia y La Agricola Regional 2: con este control
    -- el pipeline quedaria en rojo cada vez, por algo que no es un error. Esos
    -- dias El mismo producto usa su precio mas reciente dentro de
    -- dias_maximos_arrastre, y arrastre_dentro_del_tope sigue vigilando el tope.
    AND a.cadena NOT IN (
        SELECT nombre_comercial FROM {{ ref("stg_comercio") }} WHERE NOT informe_diario
    )
