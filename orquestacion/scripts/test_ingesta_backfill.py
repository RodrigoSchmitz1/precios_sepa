"""
Pruebas de las dos decisiones que toma la ingesta y que no dependen de BigQuery:
que fechas estan en riesgo y cuanto tiene que retener el crudo por ellas.

    cd orquestacion/scripts && python -m unittest test_ingesta_backfill -v

Se prueban estas dos y no el resto del script a proposito: el resto es
orquestacion (bajar, cargar, imprimir) y se valida corriendolo. Aca vive la
aritmetica, que es donde una equivocacion no se nota hasta que falta un dia en
el historico y ya no se puede recuperar.
"""

import unittest
from datetime import date

from ingesta_backfill import (
    MARGEN_DBT_DIAS,
    RETENCION_BASE_DIAS,
    dias_de_retencion,
    fechas_en_riesgo,
)


class TestFechasEnRiesgo(unittest.TestCase):
    def test_lo_que_esta_en_el_historico_no_esta_en_riesgo(self):
        # El historico es permanente: esa fecha puede caerse del crudo tranquila.
        en_crudo = {date(2026, 9, 19), date(2026, 9, 20)}
        en_historico = {date(2026, 9, 19), date(2026, 9, 20)}
        self.assertEqual(fechas_en_riesgo(en_crudo, en_historico), set())

    def test_cargada_pero_sin_transformar_esta_en_riesgo(self):
        en_crudo = {date(2026, 9, 20), date(2026, 9, 21)}
        en_historico = {date(2026, 9, 20)}
        self.assertEqual(
            fechas_en_riesgo(en_crudo, en_historico), {date(2026, 9, 21)}
        )

    def test_las_entrantes_cuentan_aunque_todavia_no_esten_cargadas(self):
        # Es el punto del asunto: la ventana se abre ANTES de cargar, asi que hay
        # que contar lo que esta por entrar o se abriria tarde.
        entrantes = [date(2026, 9, 15), date(2026, 9, 16)]
        en_riesgo = fechas_en_riesgo({date(2026, 9, 21)}, set(), entrantes)
        self.assertEqual(
            en_riesgo, {date(2026, 9, 15), date(2026, 9, 16), date(2026, 9, 21)}
        )

    def test_una_entrante_ya_capturada_no_cuenta(self):
        en_riesgo = fechas_en_riesgo(set(), {date(2026, 9, 15)}, [date(2026, 9, 15)])
        self.assertEqual(en_riesgo, set())


class TestDiasDeRetencion(unittest.TestCase):
    def test_sin_nada_en_riesgo_vuelve_al_piso(self):
        # La mitad que cierra la ventana sola despues de un backfill.
        self.assertEqual(dias_de_retencion(set(), date(2026, 9, 22)), RETENCION_BASE_DIAS)

    def test_un_dia_normal_no_levanta_la_retencion(self):
        # La corrida de todos los dias no tiene que mover nada: ayer ya esta
        # cubierta por la ventana normal. Si esto sube, el piso de
        # almacenamiento sube con el y nadie se entera.
        ayer = {date(2026, 9, 21)}
        self.assertEqual(dias_de_retencion(ayer, date(2026, 9, 22)), RETENCION_BASE_DIAS)

    def test_ninguna_fecha_dentro_de_la_ventana_normal_la_levanta(self):
        hoy = date(2026, 9, 22)
        for atras in range(RETENCION_BASE_DIAS):
            with self.subTest(atras=atras):
                fecha = {date.fromordinal(hoy.toordinal() - atras)}
                self.assertEqual(dias_de_retencion(fecha, hoy), RETENCION_BASE_DIAS)

    def test_justo_afuera_de_la_ventana_si_la_levanta(self):
        # Una fecha de hace exactamente RETENCION_BASE_DIAS expira hoy mismo:
        # es el primer caso donde no alcanza con el piso.
        hoy = date(2026, 9, 22)
        borde = {date.fromordinal(hoy.toordinal() - RETENCION_BASE_DIAS)}
        self.assertEqual(
            dias_de_retencion(borde, hoy), RETENCION_BASE_DIAS + MARGEN_DBT_DIAS
        )

    def test_nunca_baja_del_piso(self):
        hoy = date(2026, 9, 22)
        self.assertGreaterEqual(dias_de_retencion({hoy}, hoy), RETENCION_BASE_DIAS)

    def test_el_caso_real_del_22_de_septiembre(self):
        # Backfill del 15, 16 y 17 con el 21 tambien sin capturar. La mas vieja
        # es el 15: 7 dias de distancia + el margen para que dbt corra.
        hoy = date(2026, 9, 22)
        en_riesgo = {date(2026, 9, d) for d in (15, 16, 17, 21)}
        self.assertEqual(dias_de_retencion(en_riesgo, hoy), 7 + MARGEN_DBT_DIAS)

    def test_manda_la_mas_vieja_no_la_cantidad(self):
        hoy = date(2026, 9, 22)
        una = {date(2026, 9, 16)}
        muchas = {date(2026, 9, d) for d in (16, 17, 18, 19, 20)}
        self.assertEqual(dias_de_retencion(una, hoy), dias_de_retencion(muchas, hoy))

    def test_el_margen_sobrevive_a_varias_corridas_fallidas_de_dbt(self):
        # El 18, 19 y 20 de septiembre de 2026 fallaron tres corridas seguidas.
        # Una fecha recuperada tiene que aguantar al menos dos fallas, o sea
        # llegar viva a la corrida de pasado manana.
        hoy = date(2026, 9, 22)
        vieja = date(2026, 9, 15)
        vence = vieja.toordinal() + dias_de_retencion({vieja}, hoy)
        self.assertGreaterEqual(vence, hoy.toordinal() + 3)


if __name__ == "__main__":
    unittest.main()
