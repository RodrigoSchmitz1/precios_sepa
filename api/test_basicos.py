"""
Tests de los basicos del armado rapido de Tu lista (openspec lista-en-el-centro), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_basicos -v
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main
import mismo_producto
from mismo_producto import armar_indice, basicos
from test_mismo_producto import CUATRO_CADENAS, producto

PRUEBA = (
    ("Almacén", "Yerba", "yerba 1 kg"),
    ("Almacén", "Algo que no existe", "zzzz inexistente"),
    ("Lácteos", "Leche", "leche entera 1 litro"),
)


def indice():
    yerba = producto("1", CUATRO_CADENAS, descripcion="PLAYADITO YERBA MATE SUAVE 1KG")
    otra = producto("2", CUATRO_CADENAS, descripcion="YERBA MATE TARAGUI 500G")
    leche = producto("3", CUATRO_CADENAS, descripcion="LA SERENISIMA LECHE ENTERA 1L", marca="LA SERENISIMA")
    return armar_indice(yerba + otra + leche)


class TestBasicos(unittest.TestCase):
    def test_el_primer_resultado_de_cada_busqueda_en_orden_y_con_su_grupo(self):
        with mock.patch.object(mismo_producto, "BASICOS", PRUEBA):
            r = basicos(indice())
        self.assertEqual([(b["grupo"], b["nombre"], b["producto"]["id_producto"]) for b in r], [("Almacén", "Yerba", "1"), ("Lácteos", "Leche", "3")])

    def test_una_busqueda_sin_resultados_se_saltea(self):
        with mock.patch.object(mismo_producto, "BASICOS", PRUEBA):
            self.assertNotIn("Algo que no existe", [b["nombre"] for b in basicos(indice())])

    def test_la_lista_real_tiene_unos_40_en_6_grupos(self):
        self.assertGreaterEqual(len(mismo_producto.BASICOS), 35)
        self.assertEqual({g for g, _, _ in mismo_producto.BASICOS}, {"Almacén", "Desayuno", "Lácteos", "Bebidas", "Limpieza", "Higiene"})


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.original = main._indice_mismo_producto
        datos = indice()
        main._indice_mismo_producto = lambda: datos
        main._cache.pop(("_basicos", (), ()), None)

    def tearDown(self):
        main._indice_mismo_producto = self.original
        main._cache.pop(("_basicos", (), ()), None)

    def test_no_se_confunde_con_un_id(self):
        with mock.patch.object(mismo_producto, "BASICOS", PRUEBA):
            r = TestClient(main.app).get("/api/mismo-producto/basicos")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()[0]["nombre"], "Yerba")


if __name__ == "__main__":
    unittest.main()
