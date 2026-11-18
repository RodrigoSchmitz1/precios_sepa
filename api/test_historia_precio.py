"""
Tests del cambio de precio en Mismo producto (openspec historia-de-precio), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_historia_precio -v

La regla de que cambio se cuenta (reciente, de 3% o mas, el precio de hoy) vive
en mart_cambio_precio. La API solo lo pega a cada precio: el detalle dice
"Bajo 10% el 25/11" y Tu lista "Bajo 6% en Dia el 25/11" si cambio donde
conviene comprar.
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main
from mismo_producto import armar_cambios, armar_indice, cotizar_lista
from test_mismo_producto import producto

PALERMO = ["Dia", "Coto", "Carrefour"]

CAMBIOS = [
    # Dia bajo la yerba, y es la mas barata de la zona.
    {"id_producto": "yerba", "cadena": "Dia", "precio": 3600, "precio_anterior": 4000,
     "fecha_cambio": "2026-11-25", "cambio_pct": -10.0},
    # Carrefour subio el aceite, pero el aceite es mas barato en Coto.
    {"id_producto": "aceite", "cadena": "Carrefour", "precio": 2600, "precio_anterior": 2400,
     "fecha_cambio": "2026-11-24", "cambio_pct": 8.3},
]


def indice(cambios=CAMBIOS):
    return armar_indice(
        producto("yerba", {"Dia": (3600, 90), "Coto": (3900, 40), "Carrefour": (4100, 60)})
        + producto("aceite", {"Coto": (2000, 40), "Dia": (2100, 90), "Carrefour": (2600, 60)},
                   descripcion="ACEITE NATURA 1.5L"),
        armar_cambios(cambios),
    )


class TestCambioEnElIndice(unittest.TestCase):
    def test_el_detalle_lleva_el_cambio_de_cada_cadena(self):
        precios = {p["cadena"]: p["cambio"] for p in indice()["yerba"]["precios"]}
        self.assertEqual(precios["Dia"], {"precio_anterior": 4000, "fecha": "2026-11-25", "pct": -10.0})
        self.assertIsNone(precios["Coto"])
        self.assertIsNone(precios["Carrefour"])

    def test_sin_cambios_ninguna_cadena_tiene_cambio(self):
        for p in indice([])["yerba"]["precios"]:
            self.assertIsNone(p["cambio"])
        for p in armar_indice(producto("yerba", {"Dia": (3600, 90), "Coto": (3900, 40)}))["yerba"]["precios"]:
            self.assertIsNone(p["cambio"])


class TestCambioEnTuLista(unittest.TestCase):
    def test_la_cadena_mas_barata_de_la_zona_lleva_su_cambio(self):
        zona = cotizar_lista(indice(), [{"id_producto": "yerba", "cantidad": 1}], PALERMO)["zona"]
        self.assertEqual(zona["mas_barato"]["yerba"]["cadena"], "Dia")
        self.assertEqual(zona["mas_barato"]["yerba"]["cambio"]["pct"], -10.0)

    def test_el_cambio_de_otra_cadena_no_aparece(self):
        zona = cotizar_lista(indice(), [{"id_producto": "aceite", "cantidad": 1}], PALERMO)["zona"]
        self.assertEqual(zona["mas_barato"]["aceite"]["cadena"], "Coto")
        self.assertIsNone(zona["mas_barato"]["aceite"]["cambio"])

    def test_los_totales_no_cambian_por_el_cambio(self):
        items = [{"id_producto": "yerba", "cantidad": 2}, {"id_producto": "aceite", "cantidad": 1}]
        con, sin = cotizar_lista(indice(), items, PALERMO), cotizar_lista(indice([]), items, PALERMO)
        self.assertEqual(con["zona"]["cadenas"], sin["zona"]["cadenas"])
        self.assertEqual(con["cadenas"], sin["cadenas"])
        self.assertEqual(con["combinando_cadenas"], sin["combinando_cadenas"])


class TestCargaDelMart(unittest.TestCase):
    def test_sin_el_mart_mismo_producto_sigue_andando(self):
        def leer(tabla, campos=None):
            raise RuntimeError(f"Not found: {tabla}")
            yield  # generador, como leer_tabla

        with mock.patch.object(main, "leer_tabla", leer):
            self.assertEqual(main._cargar_cambios_de_precio(), {})

    def test_con_el_mart_indexa_por_producto_y_cadena(self):
        with mock.patch.object(main, "leer_tabla", lambda tabla, campos=None: iter(CAMBIOS)):
            cambios = main._cargar_cambios_de_precio()
        self.assertEqual(cambios[("yerba", "Dia")]["pct"], -10.0)
        self.assertEqual(cambios[("aceite", "Carrefour")]["fecha"], "2026-11-24")


class TestEndpoints(unittest.TestCase):
    def setUp(self):
        self.original = main._indice_mismo_producto
        datos = indice()
        main._indice_mismo_producto = lambda: datos
        self.cliente = TestClient(main.app)

    def tearDown(self):
        main._indice_mismo_producto = self.original

    def test_el_detalle_devuelve_el_cambio(self):
        r = self.cliente.get("/api/mismo-producto/yerba").json()
        dia = next(p for p in r["precios"] if p["cadena"] == "Dia")
        self.assertEqual(dia["cambio"]["precio_anterior"], 4000)

    def test_la_lista_devuelve_el_cambio_en_la_zona(self):
        r = self.cliente.post("/api/mismo-producto/lista", json={
            "items": [{"id_producto": "yerba", "cantidad": 1}], "cadenas": PALERMO,
        }).json()
        self.assertEqual(r["zona"]["mas_barato"]["yerba"]["cambio"]["fecha"], "2026-11-25")


if __name__ == "__main__":
    unittest.main()
