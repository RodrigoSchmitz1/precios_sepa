"""Mayoristas de SEPA (openspec sumar-mayoristas), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_mayoristas -v

Se muestran aparte, con el precio por unidad comprando el bulto: en el detalle
de un producto, en Tu lista, en las zonas ("mayoristas cerca") y en las promos.
No entran en la mas barata, los totales, Mas barato ni la portada.
"""
import unittest

from mapa_promos import armar_indice as armar_indice_mapa, lugares, vidriera
from mismo_producto import armar_indice, cotizar_lista, destacados, detalle, quien_gana_entre
from test_mapa_promos import sucursal_en
from test_mismo_producto import producto
from test_vidriera import CENTRO, HOY, SUCURSALES, TODAS_DIA, promo, suc


def mayorista(fila, unidades=12):
    return {**fila, "formato": "mayorista", "unidades_bulto": unidades,
            "precio_bulto": round(fila["precio_mediano"] * unidades, 2)}


def indice_con_maxiconsumo():
    # Maxiconsumo vende la yerba a $2.500 c/u comprando el bulto de 12 y el
    # aceite a $1.700; los super, entre $3.000 y $3.400 y entre $2.000 y $2.400.
    filas = (
        producto("yerba", {"Coto": (3000, 40), "Dia": (3400, 90), "Maxiconsumo": (2500, 38)})
        + producto("aceite", {"Coto": (2000, 40), "Dia": (2400, 90), "Maxiconsumo": (1700, 38)},
                   descripcion="ACEITE GIRASOL 1.5 L", marca="COCINERO")
        + producto("arroz", {"Coto": (1500, 40), "Dia": (1600, 90)}, descripcion="ARROZ 1 KG", marca="GALLO")
    )
    return armar_indice([mayorista(f) if f["cadena"] == "Maxiconsumo" else f for f in filas])


class TestMismoProductoConMayoristas(unittest.TestCase):
    def setUp(self):
        self.indice = indice_con_maxiconsumo()

    def test_el_mayorista_va_aparte_con_el_bulto(self):
        d = detalle(self.indice, "yerba")
        self.assertEqual([p["cadena"] for p in d["precios"]], ["Coto", "Dia"])
        self.assertEqual(len(d["mayoristas"]), 1)
        m = d["mayoristas"][0]
        self.assertEqual((m["cadena"], m["precio_mediano"], m["unidades_bulto"], m["precio_bulto"]),
                         ("Maxiconsumo", 2500, 12, 30000))
        self.assertTrue(m["precio_creible"])

    def test_sin_mayoristas_la_lista_viene_vacia(self):
        self.assertEqual(detalle(self.indice, "arroz")["mayoristas"], [])

    def test_la_lista_compara_solo_super_y_los_mayoristas_van_aparte(self):
        items = [{"id_producto": "yerba", "cantidad": 2}, {"id_producto": "aceite"}, {"id_producto": "arroz"}]
        r = cotizar_lista(self.indice, items, ["Coto", "Dia"], ["Maxiconsumo", "Makro"])
        # Los totales, la mas barata y la combinacion siguen entre super.
        self.assertEqual([c["cadena"] for c in r["cadenas"]], ["Coto", "Dia"])
        self.assertEqual(r["combinando_cadenas"], 3000 * 2 + 2000 + 1500)
        self.assertEqual([c["cadena"] for c in r["zona"]["cadenas"]], ["Coto", "Dia"])
        yerba = next(p for p in r["productos"] if p["id_producto"] == "yerba")
        self.assertEqual(yerba["mas_barato"]["cadena"], "Coto")
        # Maxiconsumo: 2 de 3 productos; Makro no vende nada de la lista y no aparece.
        self.assertEqual(r["mayoristas"], [
            {"cadena": "Maxiconsumo", "productos_con_precio": 2, "productos": 3, "total": 2500 * 2 + 1700},
        ])

    def test_sin_mayoristas_cerca_no_hay_seccion(self):
        r = cotizar_lista(self.indice, [{"id_producto": "yerba"}], ["Coto", "Dia"])
        self.assertNotIn("mayoristas", r)

    def test_un_mayorista_no_gana_mas_barato(self):
        ganadores = {f["cadena"] for f in quien_gana_entre(self.indice, {"Coto", "Dia", "Maxiconsumo"})}
        self.assertNotIn("Maxiconsumo", ganadores)

    def test_los_destacados_no_cambian_por_un_mayorista(self):
        sin = armar_indice([f for f in (
            producto("yerba", {"Coto": (3000, 40), "Dia": (3400, 90)})
            + producto("aceite", {"Coto": (2000, 40), "Dia": (2400, 90)}, descripcion="ACEITE GIRASOL 1.5 L", marca="COCINERO")
            + producto("arroz", {"Coto": (1500, 40), "Dia": (1600, 90)}, descripcion="ARROZ 1 KG", marca="GALLO")
        )])
        self.assertEqual(destacados(self.indice), destacados(sin))


class TestZonasConMayoristas(unittest.TestCase):
    def zonas(self, sucursales):
        return {l["nombre"]: l for l in lugares(armar_indice_mapa(sucursales, []), con_cadenas=True)}

    def test_un_mayorista_cerca_se_lista_aparte(self):
        palermo = [sucursal_en("d1", "Palermo", "AR-C", -34.58, -58.42, cadena="Dia"),
                   sucursal_en("c1", "Palermo", "AR-C", -34.581, -58.421, cadena="Coto"),
                   {**sucursal_en("m1", "Palermo", "AR-C", -34.582, -58.422, cadena="Makro"), "formato": "mayorista"}]
        zona = self.zonas(palermo)["Palermo"]
        self.assertEqual(zona["cadenas"], ["Coto", "Dia"])
        self.assertEqual(zona["mayoristas"], ["Makro"])
        self.assertEqual(zona["sucursales"], 2)

    def test_un_lugar_con_solo_un_mayorista_no_es_una_zona(self):
        pueblo = [{**sucursal_en("m1", "Crespo", "AR-E", -32.04, -60.31, cadena="La Agricola Regional (mayorista)"),
                   "formato": "mayorista"}]
        ciudad = [sucursal_en("d1", "Parana", "AR-E", -31.73, -60.52, cadena="Dia")]
        zonas = self.zonas(pueblo + ciudad)
        self.assertNotIn("Crespo", zonas)
        self.assertNotIn("mayoristas", zonas["Parana"])


class TestPromosDeMayoristas(unittest.TestCase):
    def setUp(self):
        self.sucursales = SUCURSALES + [suc("64-1", "Yaguar", formato="mayorista")]
        # Dia informa muchas promos (si no, cae en "casi no informan" y no tiene fila).
        promos_dia = [promo(f"dia{n}", 20.0 + n % 10, TODAS_DIA) for n in range(60)]
        self.indice = armar_indice_mapa(self.sucursales, promos_dia + [
            # La mejor promo del dia es de Yaguar, por unidad comprando el bulto de 6.
            promo("galletitas", 60.0, ["64-1"], unidades_bulto=6),
        ])

    def test_la_promo_del_mayorista_tiene_su_fila_despues_de_los_super(self):
        v = vidriera(self.indice, *CENTRO, hoy=HOY)
        self.assertEqual([c["cadena"] for c in v["cadenas"]], ["Dia", "Yaguar"])
        fila = v["cadenas"][-1]
        self.assertTrue(fila["mayorista"])
        self.assertTrue(fila["promos"][0]["mayorista"])
        self.assertEqual(fila["promos"][0]["unidades_bulto"], 6)
        self.assertNotIn("mayorista", v["cadenas"][0])

    def test_no_compite_en_las_promos_fuertes_ni_en_los_rubros(self):
        v = vidriera(self.indice, *CENTRO, hoy=HOY)
        self.assertNotIn("galletitas", [p["id_producto"] for p in v["fuertes"]])
        self.assertNotIn("galletitas", [p["id_producto"] for c in v["categorias"] for p in c["promos"]])
        # No se nombra entre las cadenas que casi no informan promos.
        self.assertNotIn("Yaguar", v["poco_informan"])


if __name__ == "__main__":
    unittest.main()
