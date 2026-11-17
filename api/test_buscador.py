"""
Tests del buscador de Mismo producto con los casos medidos, sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_buscador -v

buscador-que-encuentra (2026-11-17): medido contra el indice real, "leche"
traia Aguila, Actimel, Kinder y Cofler; "huevos" el huevo Kinder primero; "pan"
mantecas y tapas de empanada; "yerva" nada. Las filas de prueba reproducen esos
productos con sus nombres reales de SEPA.
"""

import unittest

from mismo_producto import armar_indice, buscar, fonetizar, normalizar, palabras
from test_mismo_producto import producto

CATORCE = {f"C{i}": (1000 + i, 10) for i in range(14)}
NUEVE = {f"C{i}": (1000 + i, 10) for i in range(9)}


def fila(id_producto, descripcion, categoria, cadenas=CATORCE, marca="", textos=""):
    filas = producto(id_producto, cadenas, descripcion=descripcion, marca=marca)
    for f in filas:
        f["categoria"] = categoria
        f["textos_busqueda"] = textos.lower()
    return filas


INDICE = armar_indice(
    fila("aguila", "AGUILA BANO REPOSTERO LECHE 150G", "Golosinas y chocolates")
    + fila("actimel", "Actimel  Frutilla 100g BOT-100-gr.", "Leche fluida", textos="LECHE FERMENTADA ACTIMEL")
    + fila("kinder", "CHOC. KINDER  X4", "Golosinas y chocolates", textos="CHOCOLATE CON LECHE KINDER")
    + fila("cofler", "CHOCOLATE COFLER CON MANI FWP 38 GRM", "Golosinas y chocolates", textos="CHOCOLATE CON LECHE")
    + fila("serenisima", "LECHE ENTERA LA SERENISIMA 1L", "Leche fluida", cadenas=NUEVE)
    + fila("descremada", "LA SERENISIMA LECHE DESCREMADA LIVIANA 1L", "Leche fluida")
    + fila("kinder_huevo", "KINDER HUEVO CHOCOLATE SORPRESA 20G", "Golosinas y chocolates")
    + fila("carnave", "CARNAVE HUEVOS BLANCOS MAPLE 30U", "Huevos", cadenas={"C1": (5000, 3), "C2": (5100, 3)})
    + fila("avicoper", "HUEVO BLANCO AVICOPER CARTON X 30 UNI", "Huevos", cadenas={"C1": (5000, 3), "C2": (5100, 3)})
    + fila("tapa", "TAPA EMPANADA HOJALDRE X12 U, LA SALTEÑA, 330 gr", "Pastas frescas y tapas")
    + fila("panal", "PAÑAL G ULTRASOFT HIPER, BABYSEC, 40 cu", "Panales")
    + fila("manteca", "MANTECA TONADITA PAN 200 GRM", "Manteca y margarina")
    + fila("lactal", "PAN LACTAL BIMBO 390G", "Pan", cadenas=NUEVE)
    + fila("rallado", "PREFERIDO PAN RALLADO 1KG", "Rebozadores y pan rallado")
    + fila("playadito", "PLAYADITO YERBA MATE SUAVE 1KG", "Yerba mate")
    + fila("chocolinas", "GALL CHOCOLINAS 250GRS", "Galletitas dulces")
    + fila("melba", "GALLETITAS MELBA X3", "Galletitas dulces")
    + fila("matarazzo", "FID MATARAZZO TALLARIN N5", "Fideos", textos="FIDEOS TALLARIN MATARAZZO")
    + fila("favorita", "FAVORITA FIDEOS SPAGHETTI 500G", "Fideos")
    + fila("cocinero", "COCINERO ACEITE DE GIRASOL 1.5L", "Aceite")
)


def ids(consulta, limite=20):
    return [p["id_producto"] for p in buscar(INDICE, consulta, limite)]


class TestFonetizar(unittest.TestCase):
    def test_iguala_lo_que_suena_igual(self):
        self.assertEqual(fonetizar("yerva"), fonetizar("yerba"))
        self.assertEqual(fonetizar("aseite"), fonetizar("aceite"))
        self.assertEqual(fonetizar("arina"), fonetizar("harina"))
        self.assertEqual(fonetizar("pollo"), fonetizar("poyo"))
        self.assertEqual(fonetizar("zapallo"), fonetizar("sapayo"))

    def test_la_ch_no_pierde_la_h(self):
        self.assertEqual(fonetizar("chocolate"), "chocolate")

    def test_los_tamanos_quedan_en_una_palabra(self):
        self.assertIn("1.5l", palabras("ACEITE 1.5 L"))
        self.assertIn("1,5l", palabras("ACEITE 1,5L"))
        self.assertEqual(normalizar("1 KG"), "1kg")


class TestBuscadorConCasosMedidos(unittest.TestCase):
    def test_leche_trae_leches_primero(self):
        primeros = ids("leche")[:2]
        self.assertEqual(set(primeros), {"serenisima", "descremada"})
        # Actimel es de Leche fluida pero no dice LECHE: va despues de las leches
        # y antes que los chocolates.
        orden = ids("leche")
        self.assertLess(orden.index("actimel"), orden.index("kinder"))
        self.assertLess(orden.index("descremada"), orden.index("actimel"))

    def test_huevos_trae_la_categoria_antes_que_kinder(self):
        orden = ids("huevos")
        self.assertEqual(set(orden[:2]), {"carnave", "avicoper"})
        self.assertEqual(orden[2], "kinder_huevo")

    def test_pan_no_es_empanada_y_el_panal_va_ultimo(self):
        # Sin tilde, PAÑAL empieza con "pan": no se puede sacar sin que "panales"
        # deje de encontrar pañales. Va despues de todo lo que dice PAN entero.
        # La categoria Pan va antes que "Rebozadores y pan rallado", aunque el
        # pan rallado lo vendan mas cadenas.
        self.assertEqual(ids("pan"), ["lactal", "rallado", "manteca", "panal"])

    def test_yerva_es_yerba(self):
        self.assertEqual(ids("yerva"), ids("yerba"))
        self.assertEqual(ids("yerva"), ["playadito"])

    def test_una_palabra_empezada(self):
        self.assertEqual(set(ids("gall")), {"chocolinas", "melba"})

    def test_fideos_sigue_igual(self):
        self.assertEqual(set(ids("fideos")), {"matarazzo", "favorita"})
        # Favorita dice FIDEOS en su nombre; Matarazzo solo en el de otra cadena.
        self.assertEqual(ids("fideos")[0], "favorita")

    def test_varias_palabras_y_tamano(self):
        self.assertEqual(ids("aceite girasol 1.5l"), ["cocinero"])
        self.assertEqual(ids("serenisima descremada"), ["descremada"])
        self.assertEqual(ids("yerba nescafe"), [])

    def test_el_singular_no_encuentra_de_mas(self):
        # "huevo" encuentra HUEVOS (prefijo) y HUEVO.
        self.assertEqual(set(ids("huevo")), {"carnave", "avicoper", "kinder_huevo"})


if __name__ == "__main__":
    unittest.main()
