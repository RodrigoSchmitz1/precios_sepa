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


class TestCanastaPorCadena(unittest.TestCase):
    """Tu canasta en cada cadena: totales comparables entre cadenas."""

    def setUp(self):
        from precios_por_sucursal import canasta_por_cadena

        self.calcular = canasta_por_cadena
        filas = [
            # Coto y Dia tienen todo; Vea no tiene arroz economico pero si medio.
            fila("1", "Arroz", "economico", 2.0, cadena="Coto"), fila("1", "Fideos", "economico", 3.0, cadena="Coto"),
            fila("1", "Yerba", "economico", 5.0, cadena="Coto"), fila("1", "Pollo", "economico", 6.0, cadena="Coto"),
            fila("2", "Arroz", "economico", 1.0, cadena="Dia"), fila("2", "Fideos", "economico", 2.0, cadena="Dia"),
            fila("2", "Yerba", "economico", 4.0, cadena="Dia"), fila("2", "Pollo", "economico", 7.0, cadena="Dia"),
            fila("3", "Arroz", "medio", 4.0, cadena="Vea"), fila("3", "Fideos", "economico", 3.0, cadena="Vea"),
            fila("3", "Yerba", "economico", 6.0, cadena="Vea"),
            # Sal en las tres: con cinco categorias, a Vea le falta una (80%) y entra.
            fila("1", "Sal", "economico", 0.5, cadena="Coto"), fila("2", "Sal", "economico", 0.5, cadena="Dia"),
            fila("3", "Sal", "economico", 0.5, cadena="Vea"),
            # Una sola categoria: no entra a comparar.
            fila("4", "Yerba", "economico", 4.5, cadena="Chica"),
        ]
        self.indice = armar_indice(filas)
        self.items = canasta("Arroz", "Fideos", "Yerba", "Pollo", "Sal")

    def test_compara_solo_lo_que_venden_todas_y_ordena_de_menor_a_mayor(self):
        r = self.calcular(self.indice, self.items)
        self.assertEqual([c["cadena"] for c in r["cadenas"]], ["Dia", "Coto", "Vea"])
        # Pollo no lo tiene Vea: queda afuera para las tres.
        self.assertEqual(r["categorias_afuera"], ["Pollo"])
        self.assertEqual(r["cadenas"][0]["total"], (1.0 + 2.0 + 4.0 + 0.5) * 1000)

    def test_sin_la_gama_pedida_usa_la_siguiente_y_lo_cuenta(self):
        r = self.calcular(self.indice, self.items)
        vea = next(c for c in r["cadenas"] if c["cadena"] == "Vea")
        self.assertEqual(vea["con_otra_gama"], 1)
        self.assertEqual(vea["total"], (4.0 + 3.0 + 6.0 + 0.5) * 1000)

    def test_un_precio_de_mas_del_doble_que_el_resto_no_cuenta(self):
        filas = [
            fila("1", "Leche", "economico", 2.0, cadena="Coto"), fila("1", "Arroz", "economico", 2.0, cadena="Coto"),
            fila("2", "Leche", "economico", 2.2, cadena="Dia"), fila("2", "Arroz", "economico", 2.1, cadena="Dia"),
            fila("3", "Leche", "economico", 1.9, cadena="Vea"), fila("3", "Arroz", "economico", 2.2, cadena="Vea"),
            # La leche de esta cadena esta a seis veces el resto: no cuenta.
            fila("4", "Leche", "economico", 12.5, cadena="Rara"), fila("4", "Arroz", "economico", 2.0, cadena="Rara"),
            fila("1", "Sal", "economico", 0.5, cadena="Coto"), fila("2", "Sal", "economico", 0.5, cadena="Dia"),
            fila("3", "Sal", "economico", 0.5, cadena="Vea"), fila("4", "Sal", "economico", 0.5, cadena="Rara"),
        ]
        r = self.calcular(armar_indice(filas), canasta("Leche", "Arroz", "Sal"))
        self.assertNotIn("Rara", [c["cadena"] for c in r["cadenas"]])
        self.assertEqual(r["cadenas_afuera"], [{"cadena": "Rara", "categorias_con_precio": 2}])

    def test_la_gama_de_respaldo_es_solo_la_vecina(self):
        from precios_por_sucursal import _gamas_de_respaldo

        self.assertEqual(_gamas_de_respaldo("economico"), ["economico", "medio"])
        self.assertEqual(_gamas_de_respaldo("medio"), ["medio", "premium", "economico"])

    def test_la_que_cubre_poco_queda_afuera_y_se_dice(self):
        r = self.calcular(self.indice, self.items)
        self.assertEqual(r["cadenas_afuera"], [{"cadena": "Chica", "categorias_con_precio": 1}])

    def test_con_zona_usa_sus_sucursales_si_hay_dos_cadenas(self):
        r = self.calcular(self.indice, self.items, [{"localidad": "CABA", "provincia": "AR-C"}])
        self.assertEqual(r["ambito"], "zona")
        r = self.calcular(self.indice, self.items, [{"localidad": "Rosario", "provincia": "AR-S"}])
        self.assertEqual(r["ambito"], "pais")


class TestCanastaPorCadenaProductosIdenticos(unittest.TestCase):
    """Con niveles, las cadenas se comparan en productos identicos (2026-10-28)."""

    def setUp(self):
        from precios_por_sucursal import canasta_por_cadena

        self.calcular = canasta_por_cadena
        # El caso de Jumbo: su "carne economica" son los cortes mas baratos del
        # mercado (mediana 7), la de Maxi un surtido mas amplio (mediana 13).
        filas = []
        for cadena, carne, arroz in (("Jumbo", 7.0, 2.2), ("Maxi", 13.0, 1.8), ("Dia", 10.0, 2.0)):
            filas += [
                fila(cadena, "Carne", "economico", carne, cadena=cadena),
                fila(cadena, "Arroz", "economico", arroz, cadena=cadena),
                fila(cadena, "Sal", "economico", 0.5, cadena=cadena),
            ]
        self.indice = armar_indice(filas)
        self.items = canasta("Carne", "Arroz", "Sal")
        # En productos identicos Jumbo es 10% mas cara y Maxi 10% mas barata.
        # Carne no tiene productos identicos: va el nivel general.
        self.niveles = {
            "por_categoria": {("Jumbo", "Arroz"): 1.1, ("Maxi", "Arroz"): 0.9, ("Dia", "Arroz"): 1.0},
            "general": {"Jumbo": 1.1, "Maxi": 0.9, "Dia": 1.0},
        }

    def test_la_mediana_de_la_gama_favorece_al_que_tiene_menos_surtido(self):
        r = self.calcular(self.indice, self.items)
        self.assertEqual(r["metodo"], "mediana_de_la_gama")
        self.assertEqual(r["cadenas"][0]["cadena"], "Jumbo")

    def test_con_productos_identicos_ordena_por_nivel(self):
        r = self.calcular(self.indice, self.items, niveles=self.niveles)
        self.assertEqual(r["metodo"], "productos_identicos")
        self.assertEqual([c["cadena"] for c in r["cadenas"]], ["Maxi", "Dia", "Jumbo"])
        # Cada item vale la mediana entre cadenas por el nivel de la cadena.
        dia = next(c for c in r["cadenas"] if c["cadena"] == "Dia")
        self.assertAlmostEqual(dia["total"], (10.0 + 2.0 + 0.5) * 1000)

    def test_sin_identicos_en_la_categoria_usa_el_nivel_general_y_lo_cuenta(self):
        r = self.calcular(self.indice, self.items, niveles=self.niveles)
        # Carne y Sal no tienen nivel propio: dos categorias con el general.
        self.assertTrue(all(c["con_nivel_general"] == 2 for c in r["cadenas"]))

    def test_sin_ningun_nivel_usa_su_propio_precio(self):
        niveles = {"por_categoria": {}, "general": {"Maxi": 0.9, "Dia": 1.0}}
        r = self.calcular(self.indice, self.items, niveles=niveles)
        jumbo = next(c for c in r["cadenas"] if c["cadena"] == "Jumbo")
        self.assertAlmostEqual(jumbo["total"], (7.0 + 2.2 + 0.5) * 1000)
