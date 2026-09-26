"""
Tests de la interpretacion de Tu canasta, sin llamar a Gemini.

    cd api && python -m unittest test_interpretar_canasta -v
"""

import io
import os
import unittest

from interpretar_canasta import BASE_INDEC, BEBIDAS_INDEC, CATEGORIAS, armar_canasta, construir_prompt, normalizar_items

RUTA_CATEGORIZAR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "orquestacion", "scripts", "categorizar.py"
)
RUTA_COMPOSICION = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "seeds", "composicion_canasta.csv"
)


def item(**campos):
    base = {"categoria": "Pan", "cantidad": 1500, "unidad": "g", "gama": "economico", "razon": "x"}
    base.update(campos)
    return base


class TestNormalizar(unittest.TestCase):
    def test_item_correcto_pasa_igual(self):
        r = normalizar_items({"items": [item()]})
        self.assertEqual(r["items"], [item()])

    def test_categoria_inventada_se_descarta(self):
        r = normalizar_items({"items": [item(categoria="Caviar")]})
        self.assertEqual(r["items"], [])

    def test_gama_invalida_se_descarta(self):
        self.assertEqual(normalizar_items({"items": [item(gama="lujo")]})["items"], [])

    def test_cantidad_no_positiva_o_no_numerica_se_descarta(self):
        for cantidad in (0, -5, "500", None, True):
            with self.subTest(cantidad=cantidad):
                self.assertEqual(normalizar_items({"items": [item(cantidad=cantidad)]})["items"], [])

    def test_cc_en_vez_de_gramos_se_corrige_sin_tocar_la_cantidad(self):
        # El caso real: el prompt viejo sugeria Yogur en cc y sus precios estan en gramos.
        r = normalizar_items({"items": [item(categoria="Yogur", unidad="cc", cantidad=450)]})
        self.assertEqual((r["items"][0]["unidad"], r["items"][0]["cantidad"]), ("g", 450))

    def test_unidad_incompatible_usa_la_cantidad_sugerida(self):
        r = normalizar_items({"items": [item(categoria="Huevos", unidad="g", cantidad=600)]})
        self.assertEqual((r["items"][0]["unidad"], r["items"][0]["cantidad"]), ("unidad", 12))

    def test_respuesta_malformada_no_rompe(self):
        for datos in (None, [], {"items": None}, {"items": ["texto", 3]}):
            with self.subTest(datos=datos):
                self.assertEqual(normalizar_items(datos)["items"], [])


class TestCatalogo(unittest.TestCase):
    def test_cada_categoria_tiene_unidad_valida_y_cantidad_positiva(self):
        for nombre, datos in CATEGORIAS.items():
            with self.subTest(categoria=nombre):
                self.assertIn(datos["unidad"], {"g", "cc", "unidad"})
                self.assertGreater(datos["cantidad"], 0)

    def test_el_prompt_lista_todas_las_categorias_con_su_unidad(self):
        prompt = construir_prompt("vivo solo")
        for nombre, datos in CATEGORIAS.items():
            self.assertIn(f"{nombre} ({datos['unidad']})", prompt)
        # Las referencias son las del INDEC, como Canasta basica: si no, el mismo
        # hogar costaba la mitad en Tu canasta.
        self.assertIn("Pan: 6750g", prompt)
        self.assertIn("ADULTOS EQUIVALENTES", prompt)

    def test_coincide_con_la_taxonomia_de_la_categorizacion(self):
        """Falla si esta lista y la taxonomia de categorizar.py se desincronizan.

        Paso el 2026-09-10: Huevos y Dulces y mermeladas estaban aca pero se
        habian perdido de la taxonomia, y los productos nuevos de esas
        categorias caian en otra sin que nada fallara. "Otros" queda afuera a
        proposito: no se puede pedir en una canasta.
        """
        fuente = io.open(RUTA_CATEGORIZAR, encoding="utf-8-sig").read()
        inicio = fuente.index("CATEGORIA_A_RUBRO = {")
        fin = fuente.index("CATEGORIAS = list")
        espacio = {}
        exec(fuente[inicio:fin], espacio)
        taxonomia = set(espacio["CATEGORIA_A_RUBRO"]) - {"Otros"}
        self.assertEqual(set(CATEGORIAS), taxonomia)

    def test_la_canasta_basica_se_puede_cotizar_en_tu_canasta(self):
        """Cada categoria de la canasta basica existe aca y con la misma unidad.

        "Empezar con la canasta basica" carga la seed tal cual en Tu canasta,
        que cotiza por categoria x gama x unidad. Con una unidad distinta (la
        seed tuvo Huevos en gramos y Aceite en gramos hasta el 2026-09-01) esa
        categoria quedaria sin precio, y la canasta saldria mas barata sin que
        nada lo avise.
        """
        import csv

        with io.open(RUTA_COMPOSICION, encoding="utf-8-sig", newline="") as f:
            filas = list(csv.DictReader(f))
        self.assertTrue(filas)
        for fila in filas:
            with self.subTest(categoria=fila["categoria"]):
                self.assertIn(fila["categoria"], CATEGORIAS)
                self.assertEqual(fila["unidad"], CATEGORIAS[fila["categoria"]]["unidad"])


class TestArmarCanasta(unittest.TestCase):
    """La base la pone el codigo: el modelo armaba solo lo que el usuario
    nombraba ("como mucha carne y tomo mate" -> carne, huevos y yerba)."""

    def categorias(self, canasta):
        return {i["categoria"]: i for i in canasta["items"]}

    def test_la_base_es_la_canasta_del_indec_sin_bebidas(self):
        import csv

        with io.open(RUTA_COMPOSICION, encoding="utf-8-sig", newline="") as f:
            seed = {fila["categoria"]: int(fila["cantidad"]) for fila in csv.DictReader(f)}
        self.assertEqual({**BASE_INDEC, **BEBIDAS_INDEC}, seed)

    def test_lo_que_nombra_el_usuario_se_suma_a_la_base(self):
        canasta = self.categorias(armar_canasta({
            "adultos_equivalentes": 0.9, "quitar": [],
            "items": [item(categoria="Carne vacuna", cantidad=6000, razon="come mucha carne")],
        }))
        self.assertEqual(set(canasta), set(BASE_INDEC))
        self.assertEqual(canasta["Carne vacuna"]["cantidad"], 6000)
        self.assertEqual(canasta["Pan"]["cantidad"], 6080)  # 6750 x 0,9, redondeado a 10 g
        self.assertEqual(canasta["Huevos"]["cantidad"], 10)  # 11 x 0,9, piezas enteras

    def test_quitar_saca_de_la_base(self):
        canasta = self.categorias(armar_canasta({
            "adultos_equivalentes": 0.9, "quitar": ["Carne vacuna", "Pollo", "Pescado", "Fiambres"], "items": [],
        }))
        self.assertNotIn("Carne vacuna", canasta)
        self.assertIn("Leche fluida", canasta)

    def test_solo_lo_mencionado_no_agrega_la_base(self):
        canasta = armar_canasta({"solo_lo_mencionado": True, "items": [item(categoria="Yerba mate", cantidad=1000)]})
        self.assertEqual([i["categoria"] for i in canasta["items"]], ["Yerba mate"])

    def test_adultos_y_gama_invalidos_usan_una_persona_economica(self):
        for adultos in (None, "3", 0, 40, True):
            with self.subTest(adultos=adultos):
                canasta = self.categorias(armar_canasta({"adultos_equivalentes": adultos, "gama": "lujo"}))
                self.assertEqual(canasta["Pan"]["cantidad"], 6080)
                self.assertEqual(canasta["Pan"]["gama"], "economico")

    def test_el_factor_se_aplica_sobre_la_base_del_hogar(self):
        # "Tomamos mucha leche" con dos adultos y un bebe (2,15): el modelo daba
        # 15.000 cc, menos que la base. Con factor la cuenta la hace el codigo.
        canasta = self.categorias(armar_canasta({
            "adultos_equivalentes": 2.15,
            "items": [{"categoria": "Leche fluida", "factor": 1.5, "unidad": "cc", "gama": "economico", "razon": "x"}],
        }))
        self.assertEqual(canasta["Leche fluida"]["cantidad"], 29900)  # 9270 x 2,15 x 1,5

    def test_factor_invalido_deja_la_base(self):
        for factor in (0, -1, 50, "2", True):
            with self.subTest(factor=factor):
                canasta = self.categorias(armar_canasta({
                    "adultos_equivalentes": 0.9,
                    "items": [{"categoria": "Pan", "factor": factor, "unidad": "g", "gama": "economico"}],
                }))
                self.assertEqual(canasta["Pan"]["cantidad"], 6080)

    def test_una_cantidad_absurdamente_baja_fuera_de_la_base_usa_la_sugerida(self):
        # El modelo contaba paquetes: 5 toallitas por mes para un bebe.
        canasta = self.categorias(armar_canasta({
            "adultos_equivalentes": 2.15,
            "items": [item(categoria="Higiene bebe", cantidad=5, unidad="unidad"),
                      item(categoria="Panales", cantidad=150, unidad="unidad")],
        }))
        self.assertEqual(canasta["Higiene bebe"]["cantidad"], CATEGORIAS["Higiene bebe"]["cantidad"])
        self.assertEqual(canasta["Panales"]["cantidad"], 150)

    def test_respuesta_malformada_da_la_base(self):
        for datos in (None, [], {"quitar": "Pan", "items": None}):
            with self.subTest(datos=datos):
                self.assertEqual(set(self.categorias(armar_canasta(datos))), set(BASE_INDEC))


if __name__ == "__main__":
    unittest.main()
