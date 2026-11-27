"""
Tests de Tu lista con la zona del usuario (cotizar_lista con cadenas), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_lista_zona -v

lista-en-tu-zona (2026-11): con Lomas de Zamora elegida, Tu lista decia
"ahorras 11%" contra la Cooperativa Obrera, que no tiene sucursal ahi. Con las
cadenas de la zona, la API suma un bloque "zona" con la misma cuenta entre esas
cadenas y deja las filas nacionales como estaban.
"""

import unittest

from fastapi.testclient import TestClient

import main
from mismo_producto import armar_indice, cotizar_lista
from test_mismo_producto import producto

LOMAS = ["Coto", "Dia", "Carrefour"]


def indice_de_prueba():
    return armar_indice(
        producto("yerba", {"Coto": (3000, 40), "Dia": (3400, 90), "Cooperativa Obrera": (5000, 30)})
        + producto("aceite", {"Coto": (2000, 40), "Dia": (1800, 90), "Cooperativa Obrera": (2600, 30)},
                   descripcion="ACEITE NATURA 1.5L")
        # La mas barata del pais esta afuera de la zona.
        + producto("leche", {"Coto": (1500, 40), "Dia": (1400, 90), "Maxi": (1000, 20)}, descripcion="LECHE 1L")
        # Solo la vende una cadena de otra region.
        + producto("alfajor", {"La Anonima": (900, 60), "Cooperativa Obrera": (950, 30)},
                   descripcion="ALFAJOR REGIONAL")
    )


def items(*ids):
    return [{"id_producto": i, "cantidad": 1} for i in ids]


class TestListaEnZona(unittest.TestCase):
    def setUp(self):
        self.indice = indice_de_prueba()

    def test_sin_cadenas_la_respuesta_no_cambia(self):
        r = cotizar_lista(self.indice, items("yerba", "aceite"))
        self.assertNotIn("zona", r)
        self.assertEqual(r, cotizar_lista(self.indice, items("yerba", "aceite"), None))
        self.assertEqual(r, cotizar_lista(self.indice, items("yerba", "aceite"), []))

    def test_cada_producto_trae_su_precio_en_cada_cadena(self):
        # Mi compra muestra el precio de cada producto en la cadena que conviene (app-para-el-usuario).
        r = cotizar_lista(self.indice, items("yerba"), LOMAS)
        self.assertEqual(r["productos"][0]["precios"], {"Coto": 3000, "Dia": 3400, "Cooperativa Obrera": 5000})

    def test_una_cadena_de_afuera_no_entra_en_la_zona(self):
        r = cotizar_lista(self.indice, items("yerba", "aceite"), LOMAS)
        self.assertEqual([c["cadena"] for c in r["zona"]["cadenas"]], ["Coto", "Dia"])
        # La nacional sigue teniendo a la Cooperativa Obrera.
        self.assertIn("Cooperativa Obrera", {c["cadena"] for c in r["cadenas"]})

    def test_un_producto_que_no_se_consigue_en_la_zona_no_anula_la_completa(self):
        r = cotizar_lista(self.indice, items("yerba", "aceite", "alfajor"), LOMAS)
        zona = r["zona"]
        self.assertEqual(zona["no_en_zona"], ["alfajor"])
        coto = next(c for c in zona["cadenas"] if c["cadena"] == "Coto")
        self.assertEqual((coto["completa"], coto["productos_con_precio"], coto["total"]), (True, 2, 5000))
        # En el pais la unica completa es la Cooperativa Obrera: sin la zona, el
        # titular hablaria de una cadena que en Lomas no existe.
        self.assertEqual([c["cadena"] for c in r["cadenas"] if c["completa"]], ["Cooperativa Obrera"])

    def test_combinando_cadenas_usa_la_mas_barata_de_la_zona(self):
        r = cotizar_lista(self.indice, items("yerba", "leche"), LOMAS)
        self.assertEqual(r["zona"]["mas_barato"]["leche"], {"cadena": "Dia", "precio": 1400, "cambio": None})
        self.assertEqual(r["zona"]["combinando_cadenas"], 3000 + 1400)
        self.assertEqual(r["combinando_cadenas"], 3000 + 1000)  # la nacional, con Maxi

    def test_zona_de_una_sola_cadena(self):
        r = cotizar_lista(self.indice, items("yerba", "alfajor"), ["La Anonima"])
        zona = r["zona"]
        self.assertEqual([(c["cadena"], c["completa"]) for c in zona["cadenas"]], [("La Anonima", True)])
        self.assertEqual(zona["no_en_zona"], ["yerba"])

    def test_ningun_producto_en_la_zona(self):
        zona = cotizar_lista(self.indice, items("alfajor"), LOMAS)["zona"]
        self.assertEqual((zona["cadenas"], zona["no_en_zona"], zona["combinando_cadenas"]), ([], ["alfajor"], 0))

    def test_las_cantidades_cuentan_en_la_zona(self):
        r = cotizar_lista(self.indice, [{"id_producto": "yerba", "cantidad": 3}], LOMAS)
        self.assertEqual({c["cadena"]: c["total"] for c in r["zona"]["cadenas"]}, {"Coto": 9000, "Dia": 10200})


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)
        self.original = main._indice_mismo_producto
        main._indice_mismo_producto = indice_de_prueba

    def tearDown(self):
        main._indice_mismo_producto = self.original

    def test_con_una_cadena_sin_precios_hoy_responde(self):
        # El 2026-11-11 no hubo Cencosud: Jumbo esta en la zona y no en el indice.
        r = self.cliente.post("/api/mismo-producto/lista", json={"items": items("yerba"), "cadenas": ["Coto", "Jumbo"]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([c["cadena"] for c in r.json()["zona"]["cadenas"]], ["Coto"])

    def test_sin_cadenas_no_hay_bloque_zona(self):
        r = self.cliente.post("/api/mismo-producto/lista", json={"items": items("yerba")})
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("zona", r.json())

    def test_cadenas_que_no_son_texto_es_422(self):
        r = self.cliente.post("/api/mismo-producto/lista", json={"items": items("yerba"), "cadenas": [{"x": 1}]})
        self.assertEqual(r.status_code, 422)


if __name__ == "__main__":
    unittest.main()
