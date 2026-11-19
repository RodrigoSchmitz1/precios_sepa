"""
Tests del total de Tu lista con las promos cerca (openspec total-con-promos-cerca), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_promos_lista -v

El total de siempre sigue sin promos. Este es aparte: una sola sucursal por
cadena, la que deja la lista mas barata, con sus promos vigentes sin compra
multiple. Y dice que cadenas casi no informan promos.
"""

import unittest

from fastapi.testclient import TestClient

import main
from mapa_promos import armar_indice, poco_informan, promos_de_lista
from test_mapa_promos import sucursal
from test_promos_productos import CENTRO, HOY, promo

# Dos Dia cerca, un Carrefour cerca, un Coto cerca sin promos y un Dia lejos.
SUCURSALES = [
    sucursal("15-1", -34.584, -58.420, cadena="Dia"),
    sucursal("15-2", -34.598, -58.420, cadena="Dia"),
    sucursal("10-1", -34.582, -58.421, cadena="Carrefour"),
    sucursal("12-1", -34.583, -58.422, cadena="Coto"),
    sucursal("15-9", -34.680, -58.420, cadena="Dia"),
]
PRECIOS = {
    "yerba": {"Dia": 4000.0, "Carrefour": 3800.0, "Coto": 3900.0},
    "aceite": {"Dia": 3000.0, "Carrefour": 2900.0, "Coto": 2950.0},
    "leche": {"Dia": 1500.0, "Carrefour": 1450.0},  # Coto no la vende
}
PROMOS = [
    # El Dia 15-1 tiene la yerba y el aceite en promo; el 15-2 solo la yerba.
    promo("yerba", 3000.0, ["15-1", "15-2"]),
    promo("aceite", 2200.0, ["15-1"]),
    # Mas barata, pero en un Dia a mas de 3 km.
    promo("aceite", 1000.0, ["15-9"]),
    # Un 2x1 no cuenta.
    promo("yerba", 1500.0, ["10-1"], requiere_compra_multiple=True),
    # Vencida.
    promo("aceite", 1200.0, ["10-1"], leyenda="Promo A valida desde el 01/11/2026 hasta 10/11/2026"),
]
CADENAS = ["Dia", "Carrefour", "Coto"]


class TestPromosDeLista(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(SUCURSALES, PROMOS)

    def lista(self, items, precios=PRECIOS):
        return promos_de_lista(self.indice, items, precios, CADENAS, *CENTRO, HOY)

    def test_una_sola_sucursal_por_cadena_la_que_deja_la_lista_mas_barata(self):
        filas = self.lista([{"id_producto": "yerba", "cantidad": 2}, {"id_producto": "aceite", "cantidad": 1}])
        dia = next(f for f in filas if f["cadena"] == "Dia")
        self.assertEqual(dia["nombre_sucursal"], "Sucursal 15-1")
        self.assertEqual(dia["total_con_promos"], 3000 * 2 + 2200)
        self.assertEqual(dia["total_lista"], 4000 * 2 + 3000)
        self.assertEqual(dia["productos_en_promo"], 2)
        self.assertEqual(dia["vigente_hasta"], "2026-11-30")
        # Con promos Dia pasa a ser la mas barata.
        self.assertEqual(filas[0]["cadena"], "Dia")

    def test_ni_el_2x1_ni_la_vencida_ni_la_lejana_cuentan(self):
        filas = self.lista([{"id_producto": "yerba", "cantidad": 1}, {"id_producto": "aceite", "cantidad": 1}])
        carrefour = next(f for f in filas if f["cadena"] == "Carrefour")
        self.assertEqual(carrefour["total_con_promos"], carrefour["total_lista"])
        self.assertEqual(carrefour["productos_en_promo"], 0)
        dia = next(f for f in filas if f["cadena"] == "Dia")
        self.assertEqual(dia["total_con_promos"], 3000 + 2200)

    def test_una_cadena_que_no_vende_todo_no_compite(self):
        filas = self.lista([{"id_producto": "yerba", "cantidad": 1}, {"id_producto": "leche", "cantidad": 1}])
        self.assertNotIn("Coto", {f["cadena"] for f in filas})

    def test_una_cadena_sin_sucursal_cerca_no_aparece(self):
        lejos = armar_indice([sucursal("15-9", -34.680, -58.420, cadena="Dia")], PROMOS)
        self.assertEqual(promos_de_lista(lejos, [{"id_producto": "yerba", "cantidad": 1}], PRECIOS, ["Dia"], *CENTRO, HOY), [])

    def test_las_que_casi_no_informan_promos(self):
        # Coto y Carrefour tienen 0 promos por sucursal vigentes en este indice
        # (la de Carrefour es un 2x1 y una vencida, que igual cuentan como informadas).
        self.assertEqual(poco_informan(self.indice, ["Dia", "Coto"]), ["Coto", "Dia"])
        self.assertIn("Coto", poco_informan(self.indice, CADENAS))


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.mapa_original = main._indice_mapa
        self.mp_original = main._indice_mismo_producto
        indice = armar_indice(SUCURSALES, PROMOS)
        main._indice_mapa = lambda: indice
        mp = {i: {"id_producto": i, "precios": [{"cadena": c, "precio_mediano": v, "precio_creible": True} for c, v in pr.items()]} for i, pr in PRECIOS.items()}
        main._indice_mismo_producto = lambda: mp
        self.cliente = TestClient(main.app)

    def tearDown(self):
        main._indice_mapa = self.mapa_original
        main._indice_mismo_producto = self.mp_original

    def test_devuelve_cadenas_y_las_que_casi_no_informan(self):
        r = self.cliente.post("/api/promos/lista", json={
            "items": [{"id_producto": "yerba", "cantidad": 1}, {"id_producto": "aceite", "cantidad": 1}],
            "cadenas": CADENAS, "latitud": CENTRO[0], "longitud": CENTRO[1],
        })
        self.assertEqual(r.status_code, 200)
        datos = r.json()
        self.assertEqual(datos["cadenas"][0]["cadena"], "Dia")
        self.assertIn("Coto", datos["poco_informan"])
        self.assertEqual(datos["radio_km"], 3)

    def test_valida(self):
        muchos = [{"id_producto": str(i), "cantidad": 1} for i in range(51)]
        r = self.cliente.post("/api/promos/lista", json={"items": muchos, "cadenas": CADENAS, "latitud": 0, "longitud": 0})
        self.assertEqual(r.status_code, 422)
        r = self.cliente.post("/api/promos/lista", json={"items": [], "cadenas": CADENAS, "latitud": 100, "longitud": 0})
        self.assertEqual(r.status_code, 422)


if __name__ == "__main__":
    unittest.main()
