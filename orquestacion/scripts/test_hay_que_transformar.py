"""
Pruebas de la decision de saltear la corrida de dbt.

    cd orquestacion/scripts && python -m unittest test_hay_que_transformar -v

Un falso "saltear" es el error caro: un dia de datos que no llega a los
historicos. Un falso "correr" solo gasta cuota. Por eso casi todos los casos
prueban que corra.
"""

import unittest
from datetime import date, datetime, timezone

from hay_que_transformar import ATRASO_MAXIMO_DIAS, decidir, dias_de_atraso


def hora(h, m=0):
    return datetime(2026, 9, 25, h, m, tzinfo=timezone.utc)


MODELOS_DE_AYER = {"stg_productos": hora(15, 55), "mart_canasta_localidad": hora(15, 56)}


class TestDecidir(unittest.TestCase):
    def test_sin_datos_ni_codigo_nuevo_saltea(self):
        # El 26-09: la ingesta no cargo nada y el crudo sigue siendo el de ayer.
        entradas = {"productos": hora(11, 52), "comercio": hora(11, 49)}
        correr, _ = decidir(entradas, MODELOS_DE_AYER, hay_commits=False, manual=False)
        self.assertFalse(correr)

    def test_crudo_nuevo_corre(self):
        entradas = {"productos": hora(16, 30), "comercio": hora(11, 49)}
        correr, motivo = decidir(entradas, MODELOS_DE_AYER, hay_commits=False, manual=False)
        self.assertTrue(correr)
        self.assertIn("productos", motivo)

    def test_un_mart_que_no_se_armo_hace_correr(self):
        # dbt murio a mitad (como el 22-09): un mart quedo del dia anterior y es
        # mas viejo que el crudo que los demas si alcanzaron a procesar.
        modelos = dict(MODELOS_DE_AYER, mart_quien_gana=hora(9, 0))
        entradas = {"productos": hora(11, 52)}
        correr, _ = decidir(entradas, modelos, hay_commits=False, manual=False)
        self.assertTrue(correr)

    def test_cambio_de_codigo_corre_sin_datos_nuevos(self):
        entradas = {"productos": hora(11, 52)}
        correr, _ = decidir(entradas, MODELOS_DE_AYER, hay_commits=True, manual=False)
        self.assertTrue(correr)

    def test_la_corrida_manual_siempre_corre(self):
        entradas = {"productos": hora(11, 52)}
        correr, _ = decidir(entradas, MODELOS_DE_AYER, hay_commits=False, manual=True)
        self.assertTrue(correr)

    def test_sin_modelos_armados_corre(self):
        correr, _ = decidir({"productos": hora(11, 52)}, {}, hay_commits=False, manual=False)
        self.assertTrue(correr)


class TestAtraso(unittest.TestCase):
    # Si la corrida se saltea, el test crudo_al_dia no corre: este chequeo es
    # el que manda el aviso.
    def test_un_dia_de_portal_caido_no_avisa(self):
        # El 26-09: el crudo llegaba al 24.
        atraso = dias_de_atraso(date(2026, 9, 24), date(2026, 9, 26))
        self.assertLessEqual(atraso, ATRASO_MAXIMO_DIAS)

    def test_tres_dias_sin_datos_avisa(self):
        atraso = dias_de_atraso(date(2026, 9, 24), date(2026, 9, 27))
        self.assertGreater(atraso, ATRASO_MAXIMO_DIAS)

    def test_crudo_vacio_avisa(self):
        self.assertGreater(dias_de_atraso(None, date(2026, 9, 27)), ATRASO_MAXIMO_DIAS)


if __name__ == "__main__":
    unittest.main()
