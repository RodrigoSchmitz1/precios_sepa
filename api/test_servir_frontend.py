"""
Tests de como la API sirve el frontend compilado.

    cd api && python -m unittest test_servir_frontend -v

Usan una carpeta static/ temporal: la real solo existe dentro de la imagen.
"""

import os
import tempfile
import unittest

from fastapi.testclient import TestClient

import main


class TestServirFrontend(unittest.TestCase):
    def setUp(self):
        carpeta = tempfile.mkdtemp()
        os.makedirs(os.path.join(carpeta, "assets"))
        with open(os.path.join(carpeta, "index.html"), "w") as f:
            f.write("<html></html>")
        with open(os.path.join(carpeta, "assets", "index-abc123.js"), "w") as f:
            f.write("console.log(1)")
        self.original = main.ESTATICOS
        main.ESTATICOS = carpeta
        self.cliente = TestClient(main.app)

    def tearDown(self):
        main.ESTATICOS = self.original

    def test_la_pagina_se_revalida_en_cada_visita(self):
        # Sin esto un index.html de antes de un deploy seguia pidiendo el bundle viejo.
        for ruta in ("/", "/canasta-personalizada"):
            r = self.cliente.get(ruta)
            self.assertEqual(r.status_code, 200)
            self.assertIn("text/html", r.headers["content-type"])
            self.assertEqual(r.headers["cache-control"], "no-cache")

    def test_un_asset_con_hash_se_guarda_para_siempre(self):
        r = self.cliente.get("/assets/index-abc123.js")
        self.assertEqual(r.status_code, 200)
        self.assertIn("immutable", r.headers["cache-control"])

    def test_un_asset_que_no_existe_es_404_y_no_la_pagina(self):
        # Devolver index.html con 200 dejaba el sitio en blanco: el navegador
        # intentaba ejecutar HTML como JavaScript.
        r = self.cliente.get("/assets/index-viejo.js")
        self.assertEqual(r.status_code, 404)
        self.assertNotIn("text/html", r.headers["content-type"])

    def test_no_se_sale_de_la_carpeta_de_estaticos(self):
        r = self.cliente.get("/../main.py")
        self.assertNotIn("import", r.text)


if __name__ == "__main__":
    unittest.main()
