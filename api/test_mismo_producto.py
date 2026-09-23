"""
Tests de El mismo producto, sin BigQuery.

    cd api && python -m unittest test_mismo_producto -v
"""

import unittest

from mismo_producto import armar_indice, buscar, destacados, detalle, normalizar


def producto(
    id_producto,
    precios,
    descripcion="YERBA MATE PLAYADITO 1 KG",
    marca="PLAYADITO",
    empresas=None,
    no_creibles=(),
):
    """Filas como las devuelve el mart: una por cadena, con los agregados del
    producto repetidos. precios = {cadena: (precio, sucursales)}.

    empresas por defecto es una por cadena; se pasa distinto para el caso en que
    varias banderas son de la misma empresa.

    no_creibles son las cadenas cuyo precio contradice a la mediana entre
    empresas. Se reproduce lo que hace el mart: esas cadenas siguen en la tabla,
    pero los extremos y la diferencia se calculan sin ellas."""
    valores = [precio for cadena, (precio, _) in precios.items() if cadena not in no_creibles]
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
            "empresas": empresas if empresas is not None else len(precios),
            "precio_mas_bajo": bajo,
            "precio_mas_alto": alto,
            "diferencia_pct": round((alto - bajo) / bajo * 100, 1),
            "cadenas_descartadas": len(no_creibles),
            "precio_creible": cadena not in no_creibles,
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

    def test_no_destaca_un_producto_de_una_sola_empresa(self):
        """Carrefour tiene cuatro banderas: contarlas como cuatro cadenas hacia
        pasar por "esta en todo el mercado" un producto que vende una sola
        empresa."""
        banderas = {
            "Carrefour": (3100, 40),
            "Carrefour Market": (3400, 30),
            "Carrefour Express": (4100, 20),
            "Carrefour Maxi": (5400, 25),
        }
        indice = armar_indice(producto("1", banderas, empresas=1))
        self.assertTrue(indice["1"]["extremos_respaldados"])
        self.assertEqual(destacados(indice), [])

    def test_exige_varias_cadenas_y_ordena_por_diferencia(self):
        dos_cadenas = {"Coto": (100, 50), "Dia": (900, 50)}
        mayor = dict(CUATRO_CADENAS, Vea=(6200, 8))
        indice = armar_indice(producto("1", CUATRO_CADENAS) + producto("2", dos_cadenas) + producto("3", mayor))
        self.assertEqual([p["id_producto"] for p in destacados(indice)], ["3", "1"])


class TestPreciosNoCreibles(unittest.TestCase):
    """El caso real del 2026-09-21: FANTA ZERO 1.75L figuraba a $309 en
    HiperChangomas (31 sucursales) y a $369 en Changomas (53), contra $4.939 a
    $5.190 en las otras once cadenas, SuperChangomas incluida. La seccion lo
    publicaba como 1.579% de diferencia."""

    FANTA = {
        "HiperChangomas": (309, 31),
        "Changomas": (369, 53),
        "SuperChangomas": (4939, 9),
        "Carrefour": (5150, 32),
        "Coto": (5150, 96),
        "Vea": (5190, 17),
    }

    def setUp(self):
        self.indice = armar_indice(
            producto(
                "1",
                self.FANTA,
                "FANTA GASEOSA ZERO NARANJA 1.75L",
                "FANTA",
                empresas=4,
                no_creibles=("HiperChangomas", "Changomas"),
            )
        )
        self.producto = self.indice["1"]

    def test_el_precio_descartado_sigue_estando(self):
        # Marcar y no esconder: el visitante tiene derecho a ver que la fuente
        # dice algo raro.
        cadenas = [p["cadena"] for p in self.producto["precios"]]
        self.assertIn("HiperChangomas", cadenas)

    def test_el_precio_descartado_viaja_marcado(self):
        por_cadena = {p["cadena"]: p for p in self.producto["precios"]}
        self.assertFalse(por_cadena["HiperChangomas"]["precio_creible"])
        self.assertTrue(por_cadena["SuperChangomas"]["precio_creible"])

    def test_la_brecha_se_calcula_sin_los_descartados(self):
        # 4939 -> 5190 es 5,1%, no 1579,6%.
        self.assertEqual(self.producto["precio_mas_bajo"], 4939)
        self.assertAlmostEqual(self.producto["diferencia_pct"], 5.1, places=1)

    def test_el_detalle_informa_cuantos_se_descartaron(self):
        self.assertEqual(detalle(self.indice, "1")["cadenas_descartadas"], 2)

    def test_un_precio_descartado_no_respalda_un_extremo(self):
        # Si un precio descartado coincide con un extremo, no puede ser el que lo
        # sostenga por mas sucursales que tenga: son 31, y aun asi no cuenta.
        indice = armar_indice(
            producto(
                "1",
                {"Mal": (100, 31), "Bien": (100, 1), "Otra": (4000, 9), "Tercera": (4100, 9)},
                empresas=4,
                no_creibles=("Mal",),
            )
        )
        self.assertFalse(indice["1"]["extremos_respaldados"])

    def test_si_se_destaca_es_con_la_brecha_corregida(self):
        # El producto no desaparece de destacados: sigue teniendo 4 empresas y
        # extremos respaldados. Lo que cambia es que encabeza con el 5,1% real y
        # no con el 1.579% que fabricaba el precio mal cargado. La correccion no
        # es esconder el producto, es dejar de mentir sobre el.
        (destacado,) = destacados(self.indice)
        self.assertAlmostEqual(destacado["diferencia_pct"], 5.1, places=1)
        self.assertEqual(destacado["cadenas_descartadas"], 2)


class TestTamano(unittest.TestCase):
    def test_el_tamano_viaja_al_resumen(self):
        filas = producto("1", CUATRO_CADENAS)
        for f in filas:
            f["cantidad_normalizada"] = 1000.0
            f["unidad_normalizada"] = "g"
        (resumen,) = buscar(armar_indice(filas), "playadito")
        self.assertEqual((resumen["cantidad_normalizada"], resumen["unidad_normalizada"]), (1000.0, "g"))

    def test_sin_la_columna_no_rompe(self):
        # La API puede desplegarse antes de que el mart tenga las columnas.
        (resumen,) = buscar(armar_indice(producto("1", CUATRO_CADENAS)), "playadito")
        self.assertIsNone(resumen["cantidad_normalizada"])


if __name__ == "__main__":
    unittest.main()
