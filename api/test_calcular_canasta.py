"""
Tests de como se cotiza cada item de Tu canasta, sin BigQuery.

    cd api && python -m unittest test_calcular_canasta -v
"""

import unittest

from calcular_canasta import MIN_MUESTRAS, armar_resultado


def item(categoria="Pollo", cantidad=1000, unidad="g", gama="economico"):
    return {"categoria": categoria, "cantidad": cantidad, "unidad": unidad, "gama": gama, "razon": "x"}


def precio(valor, muestras=MIN_MUESTRAS):
    return {"precio_mediano_unidad": valor, "muestras": muestras}


class TestArmarResultado(unittest.TestCase):
    def test_con_precio_en_la_zona_se_usa_ese(self):
        clave = ("Pollo", "economico", "g")
        r = armar_resultado([item()], {clave: precio(4.0)}, {clave: precio(5.0)})
        self.assertEqual(r["items"][0]["origen_precio"], "zona")
        self.assertEqual(r["items"][0]["costo_categoria"], 4000)
        self.assertEqual(r["categorias_provinciales"], 0)

    def test_sin_precio_en_la_zona_se_usa_el_de_la_provincia(self):
        # El caso que lo motivo: pollo economico en Palermo, sin datos locales.
        clave = ("Pollo", "economico", "g")
        r = armar_resultado([item()], {}, {clave: precio(5.0)})
        self.assertEqual(r["items"][0]["origen_precio"], "provincia")
        self.assertEqual(r["costo_total"], 5000)
        self.assertEqual(r["categorias_provinciales"], 1)

    def test_pocas_muestras_en_la_zona_cuentan_como_sin_precio(self):
        clave = ("Pollo", "economico", "g")
        r = armar_resultado([item()], {clave: precio(1.0, muestras=MIN_MUESTRAS - 1)}, {clave: precio(5.0)})
        self.assertEqual(r["items"][0]["origen_precio"], "provincia")

    def test_sin_precio_en_ningun_lado_queda_fuera_del_total(self):
        r = armar_resultado([item(), item("Pan")], {("Pan", "economico", "g"): precio(2.0)}, {})
        self.assertEqual([i["categoria"] for i in r["items"]], ["Pan"])
        self.assertEqual((r["categorias_calculadas"], r["categorias_pedidas"]), (1, 2))

    def test_la_provincia_tampoco_sirve_con_pocas_muestras(self):
        clave = ("Pollo", "economico", "g")
        r = armar_resultado([item()], {}, {clave: precio(5.0, muestras=MIN_MUESTRAS - 1)})
        self.assertEqual(r["items"], [])

    def test_la_gama_y_la_unidad_son_parte_de_la_clave(self):
        # Un precio "medio" o en "unidad" no puede cubrir un item economico en g.
        otro = {("Pollo", "medio", "g"): precio(9.0), ("Pollo", "economico", "unidad"): precio(9.0)}
        r = armar_resultado([item()], otro, otro)
        self.assertEqual(r["items"], [])


if __name__ == "__main__":
    unittest.main()
