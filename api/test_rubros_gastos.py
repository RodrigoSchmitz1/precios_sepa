"""
Rubros de Mis gastos (openspec app-para-el-usuario), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_rubros_gastos -v

Mis gastos agrupaba por categoria de SEPA y "Otras" se llevaba el 50%. La API
manda el mapa categoria -> rubro en /api/gastos/estado, armado del indice en
memoria: la taxonomia sigue teniendo un solo duenio (categorizar.py).
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main
import mismo_producto

INDICE = {
    "1": {"categoria": "Yerba mate", "rubro": "Infusiones y azucares"},
    "2": {"categoria": "Leche fluida", "rubro": "Lacteos"},
    "3": {"categoria": "Leche fluida", "rubro": "Lacteos"},
    # Un producto mal clasificado no cambia el rubro de su categoria.
    "4": {"categoria": "Leche fluida", "rubro": "Almacen"},
    "5": {"categoria": "Sin rubro", "rubro": None},
}


class TestRubrosDeGastos(unittest.TestCase):
    def test_cada_categoria_con_su_rubro_mas_comun(self):
        rubros = mismo_producto.rubros_por_categoria(INDICE, lambda r: r.upper())
        self.assertEqual(rubros, {"Leche fluida": "LACTEOS", "Yerba mate": "INFUSIONES Y AZUCARES"})

    def test_el_estado_trae_los_rubros_con_tilde_sin_bigquery(self):
        main._rubros_armados.clear()
        with mock.patch.object(main, "_indice_mismo_producto", return_value=INDICE), \
                mock.patch.object(main, "cliente_bq", None, create=True):
            r = TestClient(main.app).get("/api/gastos/estado")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["rubros"]["Leche fluida"], "Lácteos")
        self.assertEqual(r.json()["rubros"]["Yerba mate"], "Infusiones y azúcares")

    def test_sin_indice_los_rubros_quedan_vacios(self):
        main._rubros_armados.clear()
        with mock.patch.object(main, "_indice_mismo_producto", side_effect=RuntimeError("sin datos")):
            r = TestClient(main.app).get("/api/gastos/estado")
        self.assertEqual(r.json()["rubros"], {})


if __name__ == "__main__":
    unittest.main()
