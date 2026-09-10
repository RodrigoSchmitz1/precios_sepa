"""
Tests de la interpretacion de Tu canasta, sin llamar a Gemini.

    cd api && python -m unittest test_interpretar_canasta -v
"""

import io
import os
import unittest

from interpretar_canasta import CATEGORIAS, construir_prompt, normalizar_items

RUTA_CATEGORIZAR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "orquestacion", "scripts", "categorizar.py"
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
        self.assertIn("Yogur: 300-600g", prompt)

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


if __name__ == "__main__":
    unittest.main()
