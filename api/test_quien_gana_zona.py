"""
Tests de quien gana entre las cadenas de una zona (quien_gana_entre), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_quien_gana_zona -v

Zona compartida (2026-11): filtrar las filas de mart_quien_gana a las cadenas de
la zona mentiria, porque cada porcentaje se calculo compitiendo contra todas las
cadenas del pais. Se recalcula producto por producto con las reglas del mart.
"""

import unittest

from fastapi.testclient import TestClient

import main
from mismo_producto import MINIMO_OFRECIDOS_QUIEN_GANA, quien_gana_entre


def producto(i, precios, categoria="Yerba", rubro="Almacen"):
    return str(i), {
        "id_producto": str(i),
        "categoria": categoria,
        "rubro": rubro,
        "precios": [{"cadena": c, "precio_mediano": v, "precio_creible": True} for c, v in precios.items()],
    }


def indice(*productos):
    return dict(productos)


N = MINIMO_OFRECIDOS_QUIEN_GANA


class TestQuienGanaEntre(unittest.TestCase):
    def test_cuenta_victorias_sobre_lo_que_cada_cadena_ofrece(self):
        # Dia gana los N productos; Coto ofrece los mismos N y no gana ninguno.
        filas = quien_gana_entre(indice(*[producto(i, {"Dia": 90, "Coto": 100}) for i in range(N)]), {"Dia", "Coto"})
        (dia,) = filas  # Coto no gano ninguno: no aparece, como en el mart
        self.assertEqual(
            (dia["cadena"], dia["productos_ganados"], dia["productos_ofrecidos"], dia["pct_gana_cuando_compite"]),
            ("Dia", N, N, 100.0),
        )
        self.assertEqual((dia["categoria"], dia["rubro"], dia["total_productos_categoria"]), ("Yerba", "Almacen", N))

    def test_un_empate_cuenta_para_las_dos(self):
        filas = quien_gana_entre(indice(*[producto(i, {"Dia": 90, "Coto": 90}) for i in range(N)]), {"Dia", "Coto"})
        self.assertEqual({(f["cadena"], f["productos_ganados"]) for f in filas}, {("Dia", N), ("Coto", N)})

    def test_una_cadena_con_menos_de_20_ofrecidos_no_se_mide(self):
        productos = [producto(i, {"Dia": 90, "Coto": 100}) for i in range(N)]
        productos += [producto(100 + i, {"Vea": 80, "Dia": 90}) for i in range(N - 1)]
        filas = quien_gana_entre(indice(*productos), {"Dia", "Coto", "Vea"})
        self.assertNotIn("Vea", {f["cadena"] for f in filas})

    def test_una_cadena_fuera_de_la_zona_no_compite(self):
        # Maxi es la mas barata en todo, pero no esta en la zona: gana Dia.
        productos = [producto(i, {"Maxi": 50, "Dia": 90, "Coto": 100}) for i in range(N)]
        filas = quien_gana_entre(indice(*productos), {"Dia", "Coto"})
        self.assertEqual([(f["cadena"], f["productos_ganados"]) for f in filas], [("Dia", N)])

    def test_un_producto_con_una_sola_cadena_de_la_zona_no_es_comparable(self):
        productos = [producto(i, {"Dia": 90, "Coto": 100}) for i in range(N)]
        productos += [producto(100 + i, {"Dia": 90, "Maxi": 50}) for i in range(5)]
        (dia,) = quien_gana_entre(indice(*productos), {"Dia", "Coto"})
        self.assertEqual((dia["productos_ofrecidos"], dia["total_productos_categoria"]), (N, N))

    def test_la_categoria_otros_no_cuenta(self):
        productos = [producto(i, {"Dia": 90, "Coto": 100}, categoria="Otros") for i in range(N)]
        self.assertEqual(quien_gana_entre(indice(*productos), {"Dia", "Coto"}), [])


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)
        self.original = main._indice_mismo_producto
        main._indice_mismo_producto = lambda: indice(*[producto(i, {"Dia": 90, "Coto": 100}) for i in range(N)])

    def tearDown(self):
        main._indice_mismo_producto = self.original

    def test_sin_cadenas_es_422(self):
        self.assertEqual(self.cliente.get("/api/quien-gana/zona").status_code, 422)

    def test_sin_ninguna_cadena_con_precios_es_422(self):
        r = self.cliente.get("/api/quien-gana/zona", params=[("cadenas", "Inventada"), ("cadenas", "Otra")])
        self.assertEqual(r.status_code, 422)

    def test_una_cadena_sin_precios_hoy_se_ignora(self):
        # El 2026-11-11 Vea, Disco y Jumbo no tuvieron precios: Palermo igual
        # tiene que poder comparar entre las demas.
        r = self.cliente.get("/api/quien-gana/zona", params=[("cadenas", "Dia"), ("cadenas", "Coto"), ("cadenas", "Jumbo")])
        self.assertEqual(r.status_code, 200)
        self.assertEqual([f["cadena"] for f in r.json()], ["Dia"])

    def test_con_cadenas_conocidas_responde_las_filas(self):
        r = self.cliente.get("/api/quien-gana/zona", params=[("cadenas", "Dia"), ("cadenas", "Coto")])
        self.assertEqual(r.status_code, 200)
        self.assertEqual([f["cadena"] for f in r.json()], ["Dia"])


if __name__ == "__main__":
    unittest.main()
