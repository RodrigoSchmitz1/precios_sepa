-- Falla si la fecha mas reciente del crudo quedo demasiado atras respecto de
-- HOY. Es el aviso de que la ingesta local dejo de correr.
--
-- POR QUE HACE FALTA SI YA ESTA historicos_capturaron_la_ultima_fecha
-- Aquel test compara los historicos contra MAX(fecha_datos) de los marts, o
-- sea contra "la ultima fecha disponible". Sirve para detectar que dbt no
-- capturo algo que si estaba. No sirve para detectar que no llego nada nuevo:
-- cuando la ingesta se detiene, los marts tampoco avanzan, asi que la "ultima
-- disponible" envejece junto con todo lo demas y la comparacion sigue dando
-- bien. El pipeline no puede notar su propio atraso midiendose contra si mismo.
--
-- CURRENT_DATE es la unica referencia que no envejece con el pipeline. Por eso
-- este test se compara contra el calendario y no contra otra tabla.
--
-- ESTE ES EL TEST QUE FALTABA EN SEPTIEMBRE DE 2026
-- La maquina estuvo apagada del 16 al 19. La ultima carga buena fue el 15 (con
-- datos del 14). Nadie se entero hasta el 22, y para entonces el 15 y el 16 ya
-- no estaban en el crudo. Con este test el workflow se habria puesto en rojo el
-- 17 y GitHub habria mandado el mail: cinco dias antes, con las dos fechas
-- todavia publicadas en el portal y recuperables con un comando.
--
-- EL UMBRAL
-- En regimen el atraso es de 1 dia: SEPA publica lo de ayer y la ingesta corre
-- a las 07:00. Un atraso de 2 puede ser el portal demorado, que pasa, y no vale
-- un mail. Con 3 ya no hay ambiguedad: el crudo retiene 3 dias, asi que la mas
-- vieja de sus particiones esta expirando hoy y manana la tabla queda vacia.
-- Es el ultimo momento util para avisar.
--
-- La fecha sale de ultima_fecha, que lee INFORMATION_SCHEMA y no consume cuota;
-- el resto es aritmetica sobre constantes. El test no escanea una sola fila.

{% set ultima = ultima_fecha(source("sepa", "productos")) %}

WITH estado AS (
    SELECT
        DATE('{{ ultima }}') AS ultima_fecha_en_el_crudo,
        -- Zona horaria explicita: los datos, el portal y la tarea programada son
        -- argentinos. Con el default UTC el atraso se corre un dia cerca de la
        -- medianoche y el test avisaria tarde o temprano de mas.
        CURRENT_DATE("America/Argentina/Buenos_Aires") AS hoy,
        DATE_DIFF(
            CURRENT_DATE("America/Argentina/Buenos_Aires"),
            DATE('{{ ultima }}'),
            DAY
        ) AS dias_de_atraso
)

SELECT *
FROM estado
WHERE dias_de_atraso > 2
