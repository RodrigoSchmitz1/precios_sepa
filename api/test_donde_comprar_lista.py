"""
Mi compra: donde comprar la lista cerca, con el precio de cada cadena
(openspec mi-compra). Sin BigQuery.

    cd api && python -m unittest test_donde_comprar_lista -v
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("SIN_BIGQUERY", "1")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
import mismo_producto  # noqa: E402
from mismo_producto import armar_indice, donde_comprar_lista  # noqa: E402


def fila(id_producto, cadena, precio, formato="supermercado"):
    return {
        "id_producto": id_producto, "descripcion": f"PRODUCTO {id_producto}", "marca": "M", "categoria": "C",
        "cadena": cadena, "precio_mediano": precio, "precio_minimo": precio, "precio_maximo": precio,
        "sucursales": 10, "cadenas": 3, "empresas": 3, "precio_mas_bajo": precio, "precio_mas_alto": precio,
        "diferencia_pct": 0, "fecha_datos": "2026-11-18", "precio_creible": True, "formato": formato,
    }


# Dia es mas barata en a y b; Coto en c y d; Vea (lejos) es la mas barata en todo.
INDICE = armar_indice([
    fila("a", "Dia", 100), fila("a", "Coto", 150), fila("a", "Vea", 50),
    fila("b", "Dia", 100), fila("b", "Coto", 150), fila("b", "Vea", 50),
    fila("c", "Dia", 300), fila("c", "Coto", 200), fila("c", "Vea", 50),
    fila("d", "Coto", 200), fila("d", "Vea", 50),
    fila("a", "Farmacity", 10, "farmacia"),
])

CENTRO = (-34.58, -58.42)


def sucursal(cadena, lat, lon, nombre="S"):
    return {"cadena": cadena, "nombre_sucursal": nombre, "calle": "Calle", "numero": 1, "barrio": None,
            "localidad": "Palermo", "provincia": "AR-C", "latitud": lat, "longitud": lon}


SUCURSALES = [
    sucursal("Dia", -34.581, -58.421, "Dia 1"),
    sucursal("Dia", -34.590, -58.430, "Dia 2"),
    sucursal("Coto", -34.582, -58.419, "Coto 1"),
    sucursal("Vea", -34.80, -58.80, "Vea lejos"),
    sucursal("Farmacity", -34.5801, -58.4201, "Farmacity"),
]
ES_FARMACIA = bytearray([0, 0, 0, 0, 1])
ITEMS = [{"id_producto": x, "cantidad": 1} for x in "abcd"]


class TestDondeComprarLista(unittest.TestCase):
    def resultado(self, items=ITEMS, radio=3):
        return donde_comprar_lista(INDICE, SUCURSALES, ES_FARMACIA, items, *CENTRO, radio)

    def test_una_y_dos_paradas(self):
        r = self.resultado()
        una, dos = r["opciones"][0], r["opciones"][1]
        # Con una parada, la cobertura manda: Coto tiene los 4 y Dia solo 3.
        self.assertEqual([s["cadena"] for s in una["sucursales"]], ["Coto"])
        self.assertEqual(una["productos_cubiertos"], 4)
        self.assertEqual(una["total"], 700)
        # Con dos, a y b en Dia y c y d en Coto.
        self.assertEqual(sorted(s["cadena"] for s in dos["sucursales"]), ["Coto", "Dia"])
        self.assertEqual(dos["total"], 600)
        dia = next(s for s in dos["sucursales"] if s["cadena"] == "Dia")
        self.assertEqual(dia["nombre_sucursal"], "Dia 1")  # la mas cercana de la cadena
        self.assertEqual({p["id_producto"] for p in dia["productos"]}, {"a", "b"})

    def test_cadena_sin_sucursal_en_el_radio_no_aparece(self):
        cadenas = {s["cadena"] for o in self.resultado()["opciones"] for s in o["sucursales"]}
        self.assertNotIn("Vea", cadenas)

    def test_las_farmacias_no_cuentan(self):
        cadenas = {s["cadena"] for o in self.resultado()["opciones"] for s in o["sucursales"]}
        self.assertNotIn("Farmacity", cadenas)

    def test_sin_sucursales_en_el_radio(self):
        r = donde_comprar_lista(INDICE, SUCURSALES, ES_FARMACIA, ITEMS, -38.0, -57.5, 1)
        self.assertEqual(r["opciones"], [])
        self.assertEqual(r["radio_km"], 1)


class TestEndpoint(unittest.TestCase):
    RUTA = "/api/mismo-producto/lista/donde-comprar"

    def setUp(self):
        self.cliente = TestClient(main.app, raise_server_exceptions=False)
        mapa = mock.Mock(sucursales=SUCURSALES, es_farmacia=ES_FARMACIA)
        self.parches = [
            mock.patch.object(main, "_indice_mismo_producto", return_value=INDICE),
            mock.patch.object(main, "_indice_mapa", return_value=mapa),
        ]
        for p in self.parches:
            p.start()

    def tearDown(self):
        for p in self.parches:
            p.stop()

    def test_responde_sin_consultar_bigquery(self):
        with mock.patch.object(main.cliente_bq, "query", side_effect=AssertionError("consulta")) as query:
            r = self.cliente.post(self.RUTA, json={"items": ITEMS, "latitud": CENTRO[0], "longitud": CENTRO[1]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["opciones"]), 3)
        query.assert_not_called()

    def test_lista_vacia(self):
        r = self.cliente.post(self.RUTA, json={"items": [], "latitud": 0, "longitud": 0})
        self.assertEqual(r.status_code, 422)

    def test_demasiados_productos(self):
        items = [{"id_producto": str(i), "cantidad": 1} for i in range(mismo_producto.MAXIMO_PRODUCTOS_LISTA + 1)]
        r = self.cliente.post(self.RUTA, json={"items": items, "latitud": 0, "longitud": 0})
        self.assertEqual(r.status_code, 422)


if __name__ == "__main__":
    unittest.main()
