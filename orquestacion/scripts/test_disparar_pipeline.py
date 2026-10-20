"""
Pruebas del disparo de la transformacion, sin red.

    cd orquestacion/scripts && python -m unittest test_disparar_pipeline -v

Lo que importa probar es que un disparo fallido nunca rompa la ingesta: la
carga ya esta hecha y el cron la transforma igual mas tarde.
"""

import os
import tempfile
import unittest

import requests

from disparar_pipeline import RAMA, disparar, disparar_si_hay_token, leer_token


class Respuesta:
    def __init__(self, status_code, text=""):
        self.status_code = status_code
        self.text = text


class TestLeerToken(unittest.TestCase):
    def test_sin_archivo_no_hay_token(self):
        self.assertIsNone(leer_token(os.path.join(tempfile.gettempdir(), "no_existe_token.txt")))

    def test_archivo_vacio_no_es_token(self):
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as archivo:
            archivo.write("  \n")
        try:
            self.assertIsNone(leer_token(archivo.name))
        finally:
            os.remove(archivo.name)

    def test_se_recorta_el_salto_de_linea(self):
        # El Bloc de notas suele dejar un salto al final, y con el salto
        # GitHub responde 401.
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as archivo:
            archivo.write("github_pat_abc\r\n")
        try:
            self.assertEqual(leer_token(archivo.name), "github_pat_abc")
        finally:
            os.remove(archivo.name)


class TestDisparar(unittest.TestCase):
    def test_204_es_exito_y_pide_la_rama_principal(self):
        pedidos = []

        def post(url, **kwargs):
            pedidos.append(kwargs)
            return Respuesta(204)

        ok, _ = disparar("t", post)
        self.assertTrue(ok)
        self.assertEqual(pedidos[0]["json"], {"ref": RAMA})
        self.assertEqual(pedidos[0]["headers"]["Authorization"], "Bearer t")

    def test_un_rechazo_de_github_no_levanta(self):
        ok, detalle = disparar("t", lambda url, **kw: Respuesta(403, "Resource not accessible"))
        self.assertFalse(ok)
        self.assertIn("403", detalle)

    def test_sin_red_no_levanta(self):
        def post(url, **kwargs):
            raise requests.ConnectionError("sin red")

        ok, detalle = disparar("t", post)
        self.assertFalse(ok)
        self.assertIn("ConnectionError", detalle)

    def test_sin_token_no_llama_a_github(self):
        def post(url, **kwargs):
            raise AssertionError("no deberia llamar")

        ruta = os.path.join(tempfile.gettempdir(), "no_existe_token.txt")
        self.assertFalse(disparar_si_hay_token(ruta, post))


if __name__ == "__main__":
    unittest.main()
