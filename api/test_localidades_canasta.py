"""
Tests de las localidades que ofrece Tu canasta, sin BigQuery.

    cd api && python -m unittest test_localidades_canasta -v
"""

import datetime
import unittest

from main import armar_localidades, filtrar_localidades

HOY = datetime.date(2026, 9, 24)
AYER = datetime.date(2026, 9, 23)


def filas(localidad, provincia, categorias, fecha=HOY):
    return [
        {"localidad": localidad, "provincia": provincia, "categoria": f"cat{i}", "fecha_datos": fecha}
        for i in range(categorias)
    ]


class TestLocalidades(unittest.TestCase):
    def test_solo_las_que_tienen_suficientes_categorias(self):
        datos = filas("Palermo", "AR-C", 20) + filas("Pueblito", "AR-X", 3)
        self.assertEqual([l["localidad"] for l in armar_localidades(datos, 15)], ["Palermo"])

    def test_solo_cuenta_el_ultimo_dia(self):
        # Una localidad que ayer tenia datos y hoy no, no se ofrece.
        datos = filas("Palermo", "AR-C", 20) + filas("Ayerlandia", "AR-B", 20, fecha=AYER)
        self.assertEqual([l["localidad"] for l in armar_localidades(datos, 15)], ["Palermo"])

    def test_la_busqueda_no_distingue_tildes_ni_mayusculas(self):
        # Con LIKE en minusculas, "cordoba" no encontraba "Córdoba".
        locs = armar_localidades(filas("Córdoba", "AR-X", 20) + filas("Rosario", "AR-S", 20), 15)
        self.assertEqual(filtrar_localidades(locs, "cordoba", 50), [{"localidad": "Córdoba", "provincia": "AR-X"}])
        self.assertEqual(len(filtrar_localidades(locs, "CÓRDOBA", 50)), 1)

    def test_homonimas_en_provincias_distintas_son_dos(self):
        locs = armar_localidades(filas("San Martin", "AR-B", 20) + filas("San Martin", "AR-M", 20), 15)
        self.assertEqual(len(filtrar_localidades(locs, "san martin", 50)), 2)

    def test_sin_busqueda_devuelve_hasta_el_limite(self):
        datos = [f for i in range(10) for f in filas(f"Loc{i}", "AR-B", 20)]
        self.assertEqual(len(filtrar_localidades(armar_localidades(datos, 15), None, 3)), 3)

    def test_sin_provincia_no_se_ofrece(self):
        # Paso con los datos reales: calcular necesita la provincia.
        datos = filas("Palermo", "AR-C", 20) + filas("Sinprov", None, 20)
        self.assertEqual([l["localidad"] for l in armar_localidades(datos, 15)], ["Palermo"])

    def test_no_expone_el_texto_normalizado(self):
        locs = armar_localidades(filas("Palermo", "AR-C", 20), 15)
        self.assertNotIn("_texto", filtrar_localidades(locs, "", 5)[0])


if __name__ == "__main__":
    unittest.main()
