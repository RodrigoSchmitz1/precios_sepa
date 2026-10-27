"""
Tests del periodo mensual de inflacion, sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_inflacion -v

La consulta en si se valido contra el historico real con dry run; aca se cubre
lo que se puede romper sin mirar datos: el parametro de mes y que un mes mal
escrito no llegue a BigQuery.
"""

import datetime
import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main


class TestParametroMes(unittest.TestCase):
    def test_un_mes_es_su_primer_dia(self):
        parametro = main._parametro_mes("2026-10")
        self.assertEqual(parametro.name, "mes")
        self.assertEqual(parametro.type_, "DATE")
        self.assertEqual(parametro.value, datetime.date(2026, 10, 1))

    def test_sin_mes_la_consulta_usa_el_ultimo(self):
        self.assertIsNone(main._parametro_mes(None).value)

    def test_las_consultas_filtran_por_el_mes(self):
        sql = main._ctes_periodo_mensual("p.d.t")
        self.assertIn("@mes IS NULL OR DATE_TRUNC(fecha_datos, MONTH) = @mes", sql)
        # El eslabon que termina en el mes anterior es la base, no parte del mes.
        self.assertIn("c.fecha_base >= l.inicio_mes", sql)


class TestMesMalEscrito(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)

    def test_se_rechaza_antes_de_consultar(self):
        with mock.patch.object(main.cliente_bq, "query") as consulta:
            for malo in ("2026-13", "2026-1", "octubre", "2026-10-01", "2026-00"):
                for ruta in ("/api/inflacion/resumen", "/api/inflacion"):
                    respuesta = self.cliente.get(ruta, params={"mes": malo})
                    self.assertEqual(respuesta.status_code, 422, (ruta, malo))
            consulta.assert_not_called()


if __name__ == "__main__":
    unittest.main()
