"""
Tests de las promos de Tu lista y del detalle (openspec promos-de-tu-lista), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_promos_productos -v
"""

import unittest

from fastapi.testclient import TestClient

import main
from mapa_promos import MAXIMO_PRODUCTOS, armar_indice, buscar, promos_de_productos, vigencia_de
from test_mapa_promos import sucursal

# Palermo, y sucursales a ~0,5 km, ~2 km y ~11 km (fuera del radio de 3 km).
CENTRO = (-34.580, -58.420)
SUCURSALES = [
    sucursal("15-1", -34.584, -58.420, cadena="Dia"),
    sucursal("15-2", -34.598, -58.420, cadena="Dia"),
    sucursal("10-1", -34.582, -58.421, cadena="Carrefour"),
    sucursal("10-9", -34.680, -58.420, cadena="Carrefour"),
]
HOY = "2026-11-18"


def promo(id_producto, precio_promo, sucursales, leyenda="Vigencia desde el 10/11/2026 al 30/11/2026", **extra):
    return {
        "id_producto": id_producto,
        "descripcion": f"PRODUCTO {id_producto}",
        "marca": "MARCA",
        "categoria": "Bebidas",
        "rubro": "Almacen",
        "precio_lista": 3800.0,
        "precio_promo": precio_promo,
        "descuento_pct": round((1 - precio_promo / 3800) * 100, 1),
        "leyenda": leyenda,
        "nivel_evidencia": "leyenda",
        "sucursales": sucursales,
        **extra,
    }


PROMOS = [
    promo("levite", 2470.0, ["15-2", "15-1"]),
    promo("levite", 2900.0, ["10-1"], leyenda="Promo A valida desde el 12/11/2026 hasta 23/11/2026"),
    # Mas barata, pero solo en una sucursal lejana.
    promo("levite", 2000.0, ["10-9"]),
    # Otra promo de Dia mas cara para el mismo producto: queda la mas barata de la cadena.
    promo("levite", 3000.0, ["15-1"]),
    promo("cafe", 5000.0, ["10-1"], leyenda="Promo A valida desde el 12/11/2026 hasta 17/11/2026"),
    promo("galletitas", 1500.0, ["15-1"], leyenda="25% de descuento. Hasta agotar stock.", requiere_compra_multiple=True),
]


class TestVigencia(unittest.TestCase):
    def test_formatos_de_las_cadenas(self):
        self.assertEqual(vigencia_de("Promo A valida desde el 12/11/2026 hasta 17/11/2026"), "2026-11-17")
        self.assertEqual(vigencia_de("Descuentazo 20% - Vigencia desde el 16/11/2026 al 30/11/2026 hasta agotar"), "2026-11-30")
        self.assertEqual(vigencia_de("Vigente hasta el 2026-11-20"), "2026-11-20")
        self.assertEqual(vigencia_de("Llevando 2 paga $3350.00 hasta el 5/12/2026"), "2026-12-05")

    def test_sin_fecha(self):
        self.assertIsNone(vigencia_de("25% de descuento. Precio Promocional Exclusivo DIA. Hasta Agotar Stock"))
        self.assertIsNone(vigencia_de(None))
        # "desde" no es el fin, y una palabra que termina en "al" no cuenta.
        self.assertIsNone(vigencia_de("Precio promocional 12/11/2026"))


class TestPromosDeProductos(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(SUCURSALES, PROMOS)

    def promos(self, ids, hoy=HOY):
        return promos_de_productos(self.indice, ids, *CENTRO, hoy)

    def test_solo_sucursales_cercanas_una_por_cadena_de_la_mas_barata(self):
        filas = self.promos(["levite"])["levite"]
        self.assertEqual([(f["cadena"], f["precio_promo"]) for f in filas], [("Dia", 2470.0), ("Carrefour", 2900.0)])

    def test_la_sucursal_mas_cercana_y_cuantas_mas(self):
        dia = self.promos(["levite"])["levite"][0]
        self.assertEqual(dia["nombre_sucursal"], "Sucursal 15-1")
        self.assertEqual(dia["otras_sucursales_cerca"], 1)
        self.assertEqual(dia["distancia_km"], 0.4)

    def test_vigencia_y_vencidas(self):
        self.assertEqual(self.promos(["levite"])["levite"][1]["vigente_hasta"], "2026-11-23")
        # El cafe valia hasta el 17/11: el 18 ya no se muestra.
        self.assertNotIn("cafe", self.promos(["cafe"]))
        self.assertIn("cafe", self.promos(["cafe"], hoy="2026-11-17"))

    def test_sin_fecha_y_compra_multiple(self):
        galletitas = self.promos(["galletitas"])["galletitas"][0]
        self.assertIsNone(galletitas["vigente_hasta"])
        self.assertTrue(galletitas["requiere_compra_multiple"])
        self.assertFalse(self.promos(["levite"])["levite"][0]["requiere_compra_multiple"])

    def test_producto_sin_promos_o_repetido(self):
        r = self.promos(["levite", "inexistente", "levite"])
        self.assertEqual(list(r), ["levite"])

    def test_tope_por_producto(self):
        sucs = [sucursal(f"{n}-1", -34.581, -58.420, cadena=f"Cadena {n}") for n in range(5)]
        promos = [promo("x", 1000.0 + n, [f"{n}-1"]) for n in range(5)]
        r = promos_de_productos(armar_indice(sucs, promos), ["x"], *CENTRO, HOY)
        self.assertEqual([f["precio_promo"] for f in r["x"]], [1000.0, 1001.0, 1002.0])

    def test_zona_sin_sucursales_cerca(self):
        self.assertEqual(promos_de_productos(self.indice, ["levite"], -24.0, -65.0, HOY), {})

    def test_el_mapa_sigue_igual(self):
        # Sumar id_producto al indice no cambia lo que devuelve el mapa.
        filas, _ = buscar(self.indice)
        self.assertNotIn("id_producto", filas[0])
        self.assertEqual(len(filas), len(PROMOS))


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)
        self.original = main._indice_mapa
        indice = armar_indice(SUCURSALES, PROMOS)
        main._indice_mapa = lambda: indice

    def tearDown(self):
        main._indice_mapa = self.original

    def pedir(self, **params):
        return self.cliente.get("/api/promos/productos", params={"latitud": CENTRO[0], "longitud": CENTRO[1], **params})

    def test_responde_por_producto(self):
        r = self.pedir(ids="levite,galletitas,nada")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(sorted(r.json()["promos"]), ["galletitas", "levite"])
        self.assertEqual(r.json()["radio_km"], 3)

    def test_parametros_invalidos(self):
        self.assertEqual(self.pedir(ids=",".join(str(n) for n in range(MAXIMO_PRODUCTOS + 1))).status_code, 422)
        self.assertEqual(self.cliente.get("/api/promos/productos", params={"ids": "levite"}).status_code, 422)
        self.assertEqual(self.pedir(ids="levite", latitud=200).status_code, 422)


if __name__ == "__main__":
    unittest.main()
