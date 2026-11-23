"""
Tests de la reparacion de renglones partidos (2026-11-23), sin BigQuery.

    cd orquestacion/scripts && python -m unittest test_cargar_datos -v
"""

import os
import tempfile
import unittest
from unittest import mock
import sys
import types

# cargar_datos importa google.cloud al cargarse; para probar una funcion pura
# alcanza con reemplazarlo si no esta instalado.
try:
    import google.cloud.bigquery  # noqa: F401
except ImportError:  # pragma: no cover
    google = types.ModuleType("google")
    cloud = types.ModuleType("google.cloud")
    cloud.bigquery = types.ModuleType("google.cloud.bigquery")
    excepciones = types.ModuleType("google.cloud.exceptions")
    excepciones.NotFound = Exception
    sys.modules.update({"google": google, "google.cloud": cloud, "google.cloud.bigquery": cloud.bigquery,
                        "google.cloud.exceptions": excepciones})

from cargar_datos import reparar_renglones

ENCABEZADO = b"id_comercio|id_sucursal|nombre|latitud|observaciones|barrio|provincia"


def archivo(contenido: bytes) -> str:
    f = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    f.write(contenido)
    f.close()
    return f.name


def leer(ruta: str) -> list[bytes]:
    with open(ruta, "rb") as f:
        return f.read().split(b"\n")


class TestRepararRenglones(unittest.TestCase):
    def test_une_un_renglon_partido_en_observaciones(self):
        ruta = archivo(ENCABEZADO + b"\r\n"
                       b"6|1|Maxi Comodin|-24.24|abre a las 8\r\n"
                       b"y cierra a las 22|Centro|AR-Y\r\n"
                       b"6|2|Comodin 2|-24.19||Norte|AR-Y\r\n")
        reparado = reparar_renglones(ruta)
        self.assertNotEqual(reparado, ruta)
        lineas = [l for l in leer(reparado) if l.strip()]
        self.assertEqual(len(lineas), 3)
        self.assertEqual(lineas[1].count(b"|"), 6)
        self.assertIn(b"abre a las 8 y cierra a las 22|Centro|AR-Y", lineas[1])
        self.assertTrue(lineas[2].startswith(b"6|2|"))
        os.remove(reparado)
        os.remove(ruta)

    def test_sin_renglones_partidos_devuelve_el_mismo_archivo(self):
        ruta = archivo(ENCABEZADO + b"\n6|1|A|-24.2||Centro|AR-Y\n6|2|B|-24.1||Norte|AR-Y\n")
        self.assertEqual(reparar_renglones(ruta), ruta)
        os.remove(ruta)

    def test_no_une_la_fila_final_de_metadata(self):
        ruta = archivo(ENCABEZADO + b"\n6|1|A|-24.2||Centro|AR-Y\n\xdaltima actualizaci\xf3n: 2026-11-21\n")
        self.assertEqual(reparar_renglones(ruta), ruta)
        os.remove(ruta)

    def test_no_pasa_de_la_cantidad_de_campos(self):
        # Un renglon corto seguido de uno completo no se unen: quedarian con mas campos.
        ruta = archivo(ENCABEZADO + b"\n6|1|A\n6|2|B|-24.1||Norte|AR-Y\n")
        self.assertEqual(reparar_renglones(ruta), ruta)
        os.remove(ruta)

    def test_respeta_la_codificacion(self):
        ruta = archivo(ENCABEZADO + b"\n6|1|Comod\xedn|-24.2|nota\nsigue|Centro|AR-Y\n")
        reparado = reparar_renglones(ruta)
        self.assertIn(b"Comod\xedn|-24.2|nota sigue|Centro|AR-Y", leer(reparado)[1])
        os.remove(reparado)
        os.remove(ruta)


if __name__ == "__main__":
    unittest.main()
