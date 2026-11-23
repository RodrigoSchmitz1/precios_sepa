"""
Tests de la tarjeta de los links compartidos (openspec compartir-por-whatsapp), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_compartir -v

WhatsApp arma la vista previa leyendo el HTML inicial, sin JavaScript. La API
completa el <head> del index.html segun la pagina. Estos tests usan el
index.html REAL del frontend: si alguien cambia sus metadatos y el reemplazo
deja de encontrarlos, fallan.
"""

import os
import re
import shutil
import tempfile
import unittest

from fastapi.testclient import TestClient

import compartir
import main
from mismo_producto import armar_indice
from test_mismo_producto import producto

INDEX_REAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "index.html")
CLAVE_INDICE = ("_cargar_indice_mismo_producto", (), ())


def meta(html_texto, nombre):
    m = re.search(r'<meta (?:property|name)="' + re.escape(nombre) + r'" content="([^"]*)" />', html_texto)
    return m.group(1) if m else None


def titulo(html_texto):
    return re.search(r"<title>(.*?)</title>", html_texto).group(1)


class TestTextos(unittest.TestCase):
    def test_nombre_legible_igual_que_el_frontend(self):
        # Los mismos ejemplos que frontend/src/utils/texto.test.ts.
        self.assertEqual(compartir.nombre_legible("YERBA MATE PLAYADITO 1 KG", "PLAYADITO"), "Yerba mate Playadito 1 kg")
        self.assertEqual(compartir.nombre_legible("PAN ARABE CLASICO", "DELIP"), "Pan arabe clasico · Delip")
        self.assertEqual(compartir.nombre_legible("LECHE SERENISIMA 1L", "LA SERENISIMA"), "Leche Serenisima 1l")
        for marca in ("SIN MARCA", "s/m", "Generico", None, ""):
            self.assertEqual(compartir.nombre_legible("TOMATE PERITA", marca), "Tomate perita")
        self.assertEqual(compartir.nombre_legible("CHOCOLATE M&M'S 45G", "M&M'S"), "Chocolate M&m's 45g")

    def test_pesos_como_en_la_pagina(self):
        self.assertEqual(compartir.pesos(2490), "$ 2.490")
        self.assertEqual(compartir.pesos(1234567.6), "$ 1.234.568")
        self.assertEqual(compartir.pesos(999), "$ 999")

    def test_tarjeta_de_producto_con_rango_y_sin_cadena_mas_barata(self):
        p = armar_indice(producto("yerba", {"Dia": (2490, 90), "Coto": (2700, 40), "Vea": (2850, 30)}))["yerba"]
        t, d = compartir.tarjeta_producto(p)
        self.assertEqual(t, "Yerba mate Playadito 1 kg · de $ 2.490 a $ 2.850 en 3 cadenas")
        self.assertIn("Mirá dónde conviene en tu zona", d)
        for cadena in ("Dia", "Coto", "Vea"):
            self.assertNotIn(cadena, t + d)

    def test_el_origen_va_por_https_detras_del_proxy(self):
        self.assertEqual(compartir.origen_del_pedido("http://precios.run.app/", None), "https://precios.run.app")
        self.assertEqual(compartir.origen_del_pedido("http://precios.run.app/", "https"), "https://precios.run.app")
        self.assertEqual(compartir.origen_del_pedido("http://localhost:8000/", None), "http://localhost:8000")
        self.assertEqual(compartir.origen_del_pedido("http://changuito.com.ar/", None), "https://changuito.com.ar")


class TestPaginas(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        shutil.copy(INDEX_REAL, os.path.join(self.carpeta, "index.html"))
        self.estaticos, main.ESTATICOS = main.ESTATICOS, self.carpeta
        self.cache = main._cache.pop(CLAVE_INDICE, None)
        self.cliente = TestClient(main.app, base_url="https://changuito.test")

    def tearDown(self):
        main.ESTATICOS = self.estaticos
        main._cache.pop(CLAVE_INDICE, None)
        if self.cache:
            main._cache[CLAVE_INDICE] = self.cache
        shutil.rmtree(self.carpeta)

    def con_indice(self, filas):
        main._cache[CLAVE_INDICE] = (0, armar_indice(filas))

    def test_el_index_real_tiene_lo_que_se_reemplaza(self):
        with open(INDEX_REAL, encoding="utf-8") as archivo:
            texto = archivo.read()
        for nombre in ("description", "og:title", "og:description", "og:url", "og:image", "twitter:card"):
            self.assertIsNotNone(meta(texto, nombre), nombre)
        self.assertIn("__ORIGEN__", meta(texto, "og:image"))

    def test_portada_con_tarjeta_general_y_urls_absolutas(self):
        r = self.cliente.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["cache-control"], "no-cache")
        self.assertEqual(meta(r.text, "og:title"), compartir.TITULO_GENERAL)
        self.assertEqual(meta(r.text, "og:image"), "https://changuito.test/og-changuito.png")
        self.assertEqual(meta(r.text, "og:url"), "https://changuito.test/")
        self.assertNotIn("__ORIGEN__", r.text)
        # El HTML para el navegador sigue igual: el script de la app esta.
        self.assertIn('<div id="root"></div>', r.text)

    def test_otro_host(self):
        r = TestClient(main.app, base_url="https://otro.example").get("/inflacion")
        self.assertEqual(meta(r.text, "og:image"), "https://otro.example/og-changuito.png")

    def test_cada_seccion_su_tarjeta(self):
        r = self.cliente.get("/inflacion")
        self.assertEqual(meta(r.text, "og:title"), compartir.SECCIONES["inflacion"][0])
        # La pestaña conserva el titulo general: la app no lo cambia al navegar.
        self.assertEqual(titulo(r.text), compartir.TITULO_GENERAL)
        self.assertEqual(meta(r.text, "og:url"), "https://changuito.test/inflacion")
        self.assertEqual(meta(self.cliente.get("/no-existe").text, "og:title"), compartir.TITULO_GENERAL)

    def test_pagina_de_promos_de_un_rubro(self):
        r = self.cliente.get("/promos/verduleria-y-frutas")
        self.assertEqual(meta(r.text, "og:title"), "Promos de Verdulería y frutas · Changuito")
        self.assertEqual(meta(r.text, "og:url"), "https://changuito.test/promos/verduleria-y-frutas")
        r = self.cliente.get("/promos/limpieza")
        self.assertEqual(meta(r.text, "og:title"), "Promos de Limpieza · Changuito")
        # Algo que no es un slug lleva la tarjeta general.
        r = self.cliente.get("/promos/<script>")
        self.assertEqual(meta(r.text, "og:title"), compartir.TITULO_GENERAL)

    def test_mi_compra_y_mis_gastos(self):
        r = self.cliente.get("/lista")
        self.assertEqual(meta(r.text, "og:title"), "Mi compra · Changuito")
        r = self.cliente.get("/gastos")
        self.assertEqual(meta(r.text, "og:title"), "Mis gastos en el súper · Changuito")
        self.assertEqual(meta(r.text, "og:url"), "https://changuito.test/gastos")

    def test_link_viejo_de_tu_canasta_lleva_la_tarjeta_de_mi_compra(self):
        r = self.cliente.get("/canasta-personalizada?zona=AR-C%3APalermo")
        self.assertEqual(meta(r.text, "og:title"), "Mi compra · Changuito")
        self.assertEqual(meta(r.text, "og:url"), "https://changuito.test/lista")
        self.assertNotIn("Tu canasta", r.text)

    def test_producto_con_su_rango(self):
        self.con_indice(producto("7790387013006", {"Dia": (2490, 90), "Coto": (2700, 40)}))
        r = self.cliente.get("/mismo-producto?p=7790387013006&zona=AR-C%3APalermo")
        self.assertEqual(meta(r.text, "og:title"), "Yerba mate Playadito 1 kg · de $ 2.490 a $ 2.700 en 2 cadenas")
        self.assertEqual(meta(r.text, "og:url"), "https://changuito.test/mismo-producto?p=7790387013006")

    def test_producto_inexistente_lleva_la_general(self):
        self.con_indice(producto("yerba", {"Dia": (2490, 90), "Coto": (2700, 40)}))
        r = self.cliente.get("/mismo-producto?p=000")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(meta(r.text, "og:title"), compartir.SECCIONES["mismo-producto"][0])

    def test_caracteres_de_html_escapados(self):
        self.con_indice(producto("raro", {"Dia": (100, 90), "Coto": (120, 40)},
                                 descripcion='GALLETITA "X" <script>alert(1)</script>', marca=None))
        r = self.cliente.get('/mismo-producto?p=raro')
        self.assertNotIn("<script>alert", r.text)
        self.assertIn("&lt;script&gt;", meta(r.text, "og:title"))
        # Un codigo con comillas en la URL tampoco rompe el HTML.
        r = self.cliente.get('/mismo-producto?p=%22%3E%3Cscript%3E')
        self.assertNotIn('"><script>', r.text)

    def test_sin_indice_cargado_no_espera_y_lleva_la_de_la_seccion(self):
        llamadas = []
        original = main._precargar_mismo_producto
        main._precargar_mismo_producto = lambda: llamadas.append(1)
        try:
            r = self.cliente.get("/mismo-producto?p=7790387013006")
        finally:
            main._precargar_mismo_producto = original
        self.assertEqual(meta(r.text, "og:title"), compartir.SECCIONES["mismo-producto"][0])


if __name__ == "__main__":
    unittest.main()
