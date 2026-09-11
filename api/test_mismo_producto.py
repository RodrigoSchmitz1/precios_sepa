"""
Tests de El mismo producto, sin BigQuery.

    cd api && python -m unittest test_mismo_producto -v
"""

import unittest

from mismo_producto import armar_indice, buscar, destacados, detalle, normalizar


def producto(id_producto, precios, descripcion="YERBA MATE PLAYADITO 1 KG", marca="PLAYADITO"):
    """Filas como las devuelve el mart: una por cadena, con los agregados del
    producto repetidos. precios = {cadena: (precio, sucursales)}."""
    valores = [precio for precio, _ in precios.values()]
    bajo, alto = min(valores), max(valores)
    return [
        {
            "id_producto": id_producto,
            "descripcion": descripcion,
            "marca": marca,
            "categoria": "Yerba mate",
            "cadena": cadena,
            "precio_mediano": precio,
            "precio_minimo": precio,
            "precio_maximo": precio,
            "sucursales": sucursales,
            "cadenas": len(precios),
            "precio_mas_bajo": bajo,
            "precio_mas_alto": alto,
            "diferencia_pct": round((alto - bajo) / bajo * 100, 1),
            "fecha_datos": "2026-09-10",
        }
        for cadena, (precio, sucursales) in precios.items()
    ]


CUATRO_CADENAS = {"Coto": (3100, 40), "Dia": (3400, 90), "Jumbo": (4100, 12), "Vea": (5400, 8)}


class TestBuscar(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(
            producto("1", CUATRO_CADENAS)
            + producto("2", {"Coto": (9000, 5), "Dia": (9500, 5)}, "CAFÉ LA MORENITA 500 G", "LA MORENITA")
            + producto("3", {"Coto": (2000, 5), "Dia": (2100, 5)}, "YERBA MATE TARAGUI 1 KG", "TARAGUI")
        )

    def test_ignora_tildes_y_mayusculas_en_los_dos_sentidos(self):
        self.assertEqual(normalizar("CAFÉ Pañal"), "cafe panal")
        self.assertEqual([p["id_producto"] for p in buscar(self.indice, "cafe")], ["2"])
        self.assertEqual([p["id_producto"] for p in buscar(self.indice, "Café morenita")], ["2"])

    def test_todas_las_palabras_en_cualquier_orden_incluida_la_marca(self):
        self.assertEqual([p["id_producto"] for p in buscar(self.indice, "playadito yerba")], ["1"])
        self.assertEqual(buscar(self.indice, "yerba nescafe"), [])

    def test_primero_los_que_estan_en_mas_cadenas_y_respeta_el_limite(self):
        self.assertEqual([p["id_producto"] for p in buscar(self.indice, "yerba")], ["1", "3"])
        self.assertEqual(len(buscar(self.indice, "yerba", limite=1)), 1)

    def test_consulta_vacia_no_devuelve_todo_el_catalogo(self):
        self.assertEqual(buscar(self.indice, "   "), [])

    def test_el_resumen_no_expone_campos_internos(self):
        self.assertNotIn("_texto", buscar(self.indice, "yerba")[0])


class TestDetalle(unittest.TestCase):
    def test_precios_de_menor_a_mayor_y_id_como_texto(self):
        indice = armar_indice(producto(7790387000017, CUATRO_CADENAS))
        resultado = detalle(indice, "7790387000017")
        self.assertEqual([p["cadena"] for p in resultado["precios"]], ["Coto", "Dia", "Jumbo", "Vea"])
        self.assertEqual(resultado["id_producto"], "7790387000017")
        self.assertEqual(resultado["fecha_datos"], "2026-09-10")

    def test_producto_inexistente(self):
        self.assertIsNone(detalle(armar_indice([]), "123"))


class TestDestacados(unittest.TestCase):
    def test_no_destaca_una_diferencia_que_depende_de_una_sola_sucursal(self):
        # El caso que la regla evita: un precio mal cargado en una sucursal suelta
        # seria "la mayor diferencia del dia".
        con_error = dict(CUATRO_CADENAS, Vea=(54000, 1))
        indice = armar_indice(producto("1", CUATRO_CADENAS) + producto("2", con_error))
        self.assertFalse(indice["2"]["extremos_respaldados"])
        self.assertEqual([p["id_producto"] for p in destacados(indice)], ["1"])

    def test_con_empate_en_un_extremo_alcanza_una_cadena_respaldada(self):
        empate = dict(CUATRO_CADENAS, Dia=(3100, 1))
        self.assertTrue(armar_indice(producto("1", empate))["1"]["extremos_respaldados"])

    def test_exige_varias_cadenas_y_ordena_por_diferencia(self):
        dos_cadenas = {"Coto": (100, 50), "Dia": (900, 50)}
        mayor = dict(CUATRO_CADENAS, Vea=(6200, 8))
        indice = armar_indice(producto("1", CUATRO_CADENAS) + producto("2", dos_cadenas) + producto("3", mayor))
        self.assertEqual([p["id_producto"] for p in destacados(indice)], ["3", "1"])


if __name__ == "__main__":
    unittest.main()
