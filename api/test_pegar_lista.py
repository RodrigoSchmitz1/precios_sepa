"""Pegar una lista escrita y compartir la lista (openspec compartir-y-pegar-la-lista)."""
import unittest

import compartir
from mismo_producto import (
    MAXIMO_RENGLONES_PEGADOS,
    armar_indice,
    interpretar,
    interpretar_renglon,
    renglones_pegados,
)
from test_mismo_producto import producto


class TestRenglon(unittest.TestCase):
    """Los casos de la medicion del 2026-11-19 sobre 30 renglones tipicos."""

    def test_la_cantidad_del_principio(self):
        self.assertEqual(interpretar_renglon("2 leches"), ("leches", 2))
        self.assertEqual(interpretar_renglon("2x leche"), ("leche", 2))
        self.assertEqual(interpretar_renglon("- 3 x atun"), ("atun", 3))

    def test_la_cantidad_del_final(self):
        self.assertEqual(interpretar_renglon("atun x3"), ("atun", 3))
        self.assertEqual(interpretar_renglon("yogur (4)"), ("yogur", 4))

    def test_un_tamano_no_es_cantidad(self):
        self.assertEqual(interpretar_renglon("1 kg de azucar"), ("1 kg azucar", 1))
        self.assertEqual(interpretar_renglon("harina 000"), ("harina 000", 1))
        self.assertEqual(interpretar_renglon("coca 2,25"), ("coca 2,25", 1))

    def test_vinetas_relleno_y_emojis_afuera(self):
        self.assertEqual(interpretar_renglon("1 docena de huevos"), ("docena huevos", 1))
        self.assertEqual(interpretar_renglon("* sal fina"), ("sal fina", 1))
        self.assertEqual(interpretar_renglon("1. yerba"), ("yerba", 1))
        self.assertEqual(interpretar_renglon("🥛 leche"), ("leche", 1))

    def test_la_cantidad_tiene_tope(self):
        self.assertEqual(interpretar_renglon("99 leches")[1], 99)


class TestRenglones(unittest.TestCase):
    def test_una_linea_con_comas_se_parte(self):
        self.assertEqual(renglones_pegados("yerba, aceite, fideos"), ["yerba", "aceite", "fideos"])

    def test_varias_lineas_no_se_parten_por_comas(self):
        self.assertEqual(renglones_pegados("coca 2,25\nyerba\n\n"), ["coca 2,25", "yerba"])

    def test_topes(self):
        self.assertEqual(len(renglones_pegados("\n".join(f"producto {i}" for i in range(80)))), MAXIMO_RENGLONES_PEGADOS)
        self.assertLessEqual(len("".join(renglones_pegados("a" * 5000))), 2000)


class TestInterpretar(unittest.TestCase):
    def setUp(self):
        filas = (
            producto("amanda", {"Coto": (3000, 40), "Dia": (3100, 90)}, descripcion="YERBA AMANDA P4 N TRAD", marca="AMANDA")
            + producto("playadito", {"Coto": (3400, 40), "Dia": (3500, 90)}, descripcion="PLAYADITO YERBA MATE SUAVE 1KG")
            + producto("leche", {"Coto": (1500, 40), "Dia": (1400, 90)}, descripcion="LECHE ENTERA LA SERENISIMA 1L", marca="LA SERENISIMA")
        )
        self.indice = armar_indice(filas)
        self.basicos = [{"grupo": "Almacén", "nombre": "Yerba", "producto": {"id_producto": "playadito", "descripcion": "PLAYADITO YERBA MATE SUAVE 1KG"}}]

    def test_un_basico_va_primero(self):
        (r,) = interpretar(self.indice, "yerba", self.basicos)
        self.assertEqual(r["candidatos"][0]["id_producto"], "playadito")
        self.assertEqual({c["id_producto"] for c in r["candidatos"]}, {"playadito", "amanda"})

    def test_si_dice_algo_mas_manda_el_buscador(self):
        (r,) = interpretar(self.indice, "yerba amanda", self.basicos)
        self.assertEqual([c["id_producto"] for c in r["candidatos"]], ["amanda"])

    def test_plural_y_cantidad(self):
        (r,) = interpretar(self.indice, "2 leches", self.basicos)
        self.assertEqual((r["cantidad"], r["candidatos"][0]["id_producto"]), (2, "leche"))

    def test_un_renglon_sin_resultado_no_frena_a_los_demas(self):
        r = interpretar(self.indice, "yerba, xzqw", self.basicos)
        self.assertEqual([x["texto"] for x in r], ["yerba", "xzqw"])
        self.assertTrue(r[0]["candidatos"])
        self.assertEqual(r[1]["candidatos"], [])


class TestTarjetaDeLista(unittest.TestCase):
    def test_dice_cuantos_productos(self):
        titulo, _, canonica = compartir.tarjeta("/lista", None, None, "7790387000014x2-7790742192301-7790742192301x3")
        self.assertEqual(titulo, "Lista del súper · 2 productos")
        self.assertEqual(canonica, "/lista?l=7790387000014x2-7790742192301-7790742192301x3")

    def test_sin_lista_valida_es_la_tarjeta_de_la_seccion(self):
        self.assertEqual(compartir.tarjeta("/lista", None, None, "<script>")[0], "Tu lista · Changuito")
        self.assertEqual(compartir.tarjeta("/lista", None, None)[0], "Tu lista · Changuito")


if __name__ == "__main__":
    unittest.main()
