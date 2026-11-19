"""Farmacity entra como farmacia (openspec comercios-regionales-y-farmacity).

Compara sus productos en El mismo producto, pero no cuenta como cadena cerca
ni compite en los totales de Tu lista: vende el shampoo, no la compra.
"""
import unittest

from mapa_promos import armar_indice as armar_indice_mapa, lugares
from mismo_producto import armar_indice, cotizar_lista
from test_mapa_promos import sucursal_en
from test_mismo_producto import producto


def farmacia(fila):
    return {**fila, "formato": "farmacia"}


class TestZonasConFarmacias(unittest.TestCase):
    def zonas(self, sucursales):
        return {l["nombre"]: l for l in lugares(armar_indice_mapa(sucursales, []), con_cadenas=True)}

    def test_una_farmacia_no_cuenta_como_cadena_cerca(self):
        # Una ciudad con La Anonima y un Farmacity: sigue siendo de una sola cadena.
        ciudad = [sucursal_en(f"a{i}", "Rafaela", "AR-S", -31.25 + i * 0.001, -61.49, cadena="La Anonima") for i in range(3)]
        ciudad.append(farmacia(sucursal_en("f1", "Rafaela", "AR-S", -31.251, -61.491, cadena="Farmacity")))
        santa_fe = [sucursal_en("c1", "Santa Fe", "AR-S", -31.63, -60.7, cadena="Coto")]
        zona = self.zonas(ciudad + santa_fe)["Rafaela"]
        self.assertEqual(zona["cadenas"], ["La Anonima"])
        self.assertEqual(zona["farmacias"], ["Farmacity"])
        # La otra cadena para viajar es un supermercado, no la farmacia de al lado.
        self.assertEqual(zona["otra_cadena_cerca"]["cadena"], "Coto")
        # La sucursal de la farmacia no suma a la zona.
        self.assertEqual(zona["sucursales"], 3)

    def test_un_lugar_con_solo_una_farmacia_no_es_una_zona(self):
        pueblo = [farmacia(sucursal_en("f1", "Pueblo Chico", "AR-B", -36.0, -60.0, cadena="Farmacity"))]
        ciudad = [sucursal_en("d1", "Olavarria", "AR-B", -36.89, -60.32, cadena="Dia")]
        zonas = self.zonas(pueblo + ciudad)
        self.assertNotIn("Pueblo Chico", zonas)
        self.assertNotIn("farmacias", zonas["Olavarria"])

    def test_sin_la_columna_formato_todo_es_supermercado(self):
        # Entre el deploy y la corrida siguiente el mart todavia no trae formato.
        zonas = self.zonas([sucursal_en("d1", "Palermo", "AR-C", -34.58, -58.42, cadena="Dia")])
        self.assertEqual(zonas["Palermo"]["cadenas"], ["Dia"])


class TestListaSinFarmacias(unittest.TestCase):
    def setUp(self):
        filas = (
            producto("yerba", {"Coto": (3000, 40), "Dia": (3400, 90)})
            + producto("shampoo", {"Coto": (5000, 40), "Dia": (5200, 90), "Farmacity": (4500, 300)}, descripcion="SHAMPOO 400ML")
        )
        self.indice = armar_indice([farmacia(f) if f["cadena"] == "Farmacity" else f for f in filas])

    def test_el_detalle_marca_la_farmacia(self):
        precios = {p["cadena"]: p for p in self.indice["shampoo"]["precios"]}
        self.assertTrue(precios["Farmacity"]["farmacia"])
        self.assertNotIn("farmacia", precios["Coto"])

    def test_la_lista_compara_solo_supermercados(self):
        r = cotizar_lista(self.indice, [{"id_producto": "yerba"}, {"id_producto": "shampoo"}], ["Coto", "Dia", "Farmacity"])
        self.assertEqual([c["cadena"] for c in r["cadenas"]], ["Coto", "Dia"])
        self.assertEqual(r["combinando_cadenas"], 3000 + 5000)
        shampoo = next(p for p in r["productos"] if p["id_producto"] == "shampoo")
        self.assertEqual(shampoo["mas_barato"]["cadena"], "Coto")
        self.assertEqual([c["cadena"] for c in r["zona"]["cadenas"]], ["Coto", "Dia"])


if __name__ == "__main__":
    unittest.main()
