"""
Tests del indice de precios por sucursal, sin BigQuery.

    cd api && python -m unittest test_precios_por_sucursal -v
"""

import unittest

from precios_por_sucursal import RADIO_MAXIMO_KM, armar_indice, optimizar

# Tres sucursales sobre la misma avenida. Un grado de latitud son ~111 km, asi
# que 0,01 grados son ~1,1 km: alcanza para separarlas dentro y fuera del radio.
OBELISCO = (-34.6037, -58.3816)


def fila(id_sucursal, categoria, gama, precio, lat=-34.6037, lon=-58.3816, cadena="Coto"):
    return {
        "categoria": categoria,
        "gama": gama,
        "unidad_normalizada": "g",
        "id_comercio": "10",
        "id_sucursal": id_sucursal,
        "cadena": cadena,
        "nombre_sucursal": f"Sucursal {id_sucursal}",
        "calle": "Av. Corrientes",
        "numero": id_sucursal,
        "localidad": "CABA",
        "provincia": "AR-C",
        "latitud": lat,
        "longitud": lon,
        "precio_mediano_unidad": precio,
        "fecha_datos": "2026-09-11",
    }


def canasta(*categorias, cantidad=1000):
    return [{"categoria": c, "gama": "economico", "unidad": "g", "cantidad": cantidad} for c in categorias]


class TestIndice(unittest.TestCase):
    def test_agrupa_por_sucursal_y_arma_la_direccion(self):
        indice = armar_indice([fila("1", "Pan", "economico", 2.0), fila("1", "Arroz", "economico", 1.5)])
        self.assertEqual(len(indice["sucursales"]), 1)
        sucursal = indice["sucursales"][0]
        self.assertEqual(sucursal["id"], "10-1")
        self.assertEqual(sucursal["direccion"], "Av. Corrientes 1")
        self.assertEqual(len(sucursal["precios"]), 2)
        self.assertEqual(indice["fecha_datos"], "2026-09-11")


class TestOptimizar(unittest.TestCase):
    def setUp(self):
        # Cerca: barata en Pan, cara en Arroz. Cerca2: al reves. Lejos: la mas
        # barata en todo, pero a ~3,3 km.
        self.indice = armar_indice(
            [
                fila("1", "Pan", "economico", 3.0),
                fila("1", "Arroz", "economico", 9.0),
                fila("2", "Pan", "economico", 8.0, lat=-34.6137),
                fila("2", "Arroz", "economico", 2.0, lat=-34.6137),
                fila("3", "Pan", "economico", 1.0, lat=-34.6337, cadena="Dia"),
                fila("3", "Arroz", "economico", 1.0, lat=-34.6337, cadena="Dia"),
            ]
        )

    def test_dividir_la_compra_sale_mas_barato_que_una_sola_sucursal(self):
        r = optimizar(self.indice, canasta("Pan", "Arroz"), *OBELISCO, radio_km=2)
        una, dos = r["opciones"][0], r["opciones"][1]
        self.assertEqual(una["max_sucursales"], 1)
        # En una sola gana la segunda: 8+2=10 por mil gramos de cada uno, contra
        # los 3+9=12 de la primera.
        self.assertEqual(una["total"], 10000.0)
        self.assertEqual([s["id"] for s in una["sucursales"]], ["10-2"])
        # En dos: pan en la primera y arroz en la segunda, 3+2.
        self.assertEqual(dos["total"], 5000.0)
        self.assertEqual({s["id"] for s in dos["sucursales"]}, {"10-1", "10-2"})

    def test_el_radio_deja_afuera_lo_que_esta_lejos(self):
        cerca = optimizar(self.indice, canasta("Pan"), *OBELISCO, radio_km=2)
        lejos = optimizar(self.indice, canasta("Pan"), *OBELISCO, radio_km=5)
        self.assertEqual(cerca["sucursales_en_zona"], 2)
        self.assertEqual(lejos["sucursales_en_zona"], 3)
        # Con el radio grande entra la mas barata de todas.
        self.assertEqual(lejos["opciones"][0]["total"], 1000.0)

    def test_los_items_traducidos_vuelven_legibles(self):
        r = optimizar(self.indice, canasta("Pan"), *OBELISCO, radio_km=2)
        item = r["opciones"][0]["sucursales"][0]["items"][0]
        self.assertEqual(item["categoria"], "Pan")
        self.assertEqual(item["gama"], "economico")
        self.assertEqual(item["unidad"], "g")
        self.assertEqual(item["cantidad"], 1000)
        sucursal = r["opciones"][0]["sucursales"][0]
        self.assertEqual(sucursal["cadena"], "Coto")
        self.assertIn("distancia_km", sucursal)

    def test_lo_que_nadie_vende_en_la_zona_se_informa_aparte(self):
        r = optimizar(self.indice, canasta("Pan", "Caviar"), *OBELISCO, radio_km=2)
        self.assertEqual(r["items_sin_precio"], [{"categoria": "Caviar", "gama": "economico", "unidad": "g"}])
        self.assertEqual(r["opciones"][0]["items_cubiertos"], 1)

    def test_el_radio_y_la_cantidad_de_sucursales_se_acotan(self):
        r = optimizar(self.indice, canasta("Pan"), *OBELISCO, radio_km=999, max_sucursales=9)
        self.assertEqual(r["radio_km"], RADIO_MAXIMO_KM)
        self.assertEqual(len(r["opciones"]), 3)

    def test_zona_sin_sucursales_no_rompe(self):
        r = optimizar(self.indice, canasta("Pan"), -31.4, -64.2, radio_km=2)
        self.assertEqual(r["sucursales_en_zona"], 0)
        self.assertEqual(r["opciones"], [])


if __name__ == "__main__":
    unittest.main()
