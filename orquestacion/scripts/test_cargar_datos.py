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

import gzip

from datetime import date

from cargar_datos import (SALIDA_FALLO_MAYORISTAS, cargar_productos_mayoristas, carpetas_de_comercios, comercios_repetidos, columnas_mayoristas, consulta_reconstruccion,
                          escribir_csv_mayoristas, escribir_csv_productos, parsear_argumentos, reparar_renglones)

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


COLUMNAS = ["id_comercio", "id_sucursal", "id_producto", "productos_marca", "productos_precio_lista",
            "productos_leyenda_promo2", "fecha_datos"]


def productos(nombre: str, contenido: str) -> str:
    carpeta = tempfile.mkdtemp()
    ruta = os.path.join(carpeta, nombre)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(contenido)
    return ruta


def armar(archivos):
    salida = os.path.join(tempfile.mkdtemp(), "salida.csv.gz")
    escritas, descartadas, vacias = escribir_csv_productos(archivos, date(2026, 11, 21), COLUMNAS, salida)
    with gzip.open(salida, "rt", encoding="utf-8") as f:
        return escritas, f.read().splitlines()


class TestColumnasDeProductos(unittest.TestCase):
    def test_columna_opcional_que_falta_queda_vacia(self):
        a = productos("a.csv", "id_comercio|id_sucursal|id_producto|productos_marca|productos_precio_lista|productos_leyenda_promo2\n"
                               "2|1|779|Marca|100|2x1\n")
        b = productos("b.csv", "id_comercio|id_sucursal|id_producto|productos_marca|productos_precio_lista\n20|5|780|Otra|200\n")
        escritas, lineas = armar([a, b])
        self.assertEqual(escritas, 2)
        self.assertEqual(lineas[2], "20|5|780|Otra|200||2026-11-21")

    def test_nombres_con_espacios_o_mayusculas(self):
        a = productos("a.csv", " ID_Comercio |id_sucursal|id_producto|productos_marca|Productos_Precio_Lista |productos_leyenda_promo2\n"
                               "47|1|781|M|300|\n")
        escritas, lineas = armar([a])
        self.assertEqual(lineas[1], "47|1|781|M|300||2026-11-21")

    def test_sin_una_obligatoria_se_saltea_solo_ese_comercio(self):
        a = productos("a.csv", "id_comercio|id_sucursal|id_producto|productos_marca|productos_precio_lista|productos_leyenda_promo2\n"
                               "2|1|779|Marca|100|\n")
        b = productos("b.csv", "id_comercio|id_sucursal|id_producto|productos_marca\n20|5|780|Otra\n")
        escritas, lineas = armar([a, b])
        self.assertEqual(escritas, 1)
        self.assertEqual(len(lineas), 2)


# Encabezado real de SEPA mayoristas (Maxiconsumo, 2026-11-25), con BOM.
ENCABEZADO_MAYORISTA = (
    "﻿id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|id_dun_14|productos_descripcion|"
    "productos_marca|precio_unitario_bulto_por_unidad_venta_con_iva|precio_unitario_bulto_por_unidad_venta_sin_iva|"
    "unidad_venta|precio_bulto_con_iva|precio_bulto_sin_iva|productos_precio_unitario_con_iva_promo1|"
    "productos_precio_unitario_sin_iva_promo1|productos_leyenda_promo1|productos_precio_unitario_con_iva_promo2|"
    "productos_precio_unitario_sin_iva_promo2|productos_leyenda_promo2"
)


def armar_mayoristas(archivos):
    salida = os.path.join(tempfile.mkdtemp(), "salida.csv.gz")
    escritas, descartadas, vacias = escribir_csv_mayoristas(archivos, date(2026, 11, 25), salida)
    with gzip.open(salida, "rt", encoding="utf-8") as f:
        lineas = f.read().splitlines()
    encabezado = lineas[0].split("|")
    return escritas, descartadas, [dict(zip(encabezado, l.split("|"))) for l in lineas[1:]]


class TestProductosMayoristas(unittest.TestCase):
    def test_bulto_de_12(self):
        a = productos("productos.csv", ENCABEZADO_MAYORISTA + "\r\n"
                      "63|1|1|4005900130785|1|17319470075600|ANT.FEM NIVEA ROL.PRO.CAR 50 ml|NIVEA|1979.87|1636.26|12|"
                      "23758.44|19635.12||||||\r\n")
        escritas, _, filas = armar_mayoristas([a])
        self.assertEqual(escritas, 1)
        fila = filas[0]
        self.assertEqual(fila["productos_precio_lista"], "1979.87")
        self.assertEqual(fila["unidades_bulto"], "12")
        self.assertEqual(fila["precio_bulto"], "23758.44")
        self.assertEqual(fila["precio_unitario_sin_iva"], "1636.26")
        self.assertEqual(fila["id_dun_14"], "17319470075600")
        # Sin gramos en la fuente: "1 UNI" para que stg_productos lea el tamaño de la descripcion.
        self.assertEqual((fila["productos_cantidad_presentacion"], fila["productos_unidad_medida_presentacion"]),
                         ("1", "UNI"))
        self.assertEqual(fila["fecha_datos"], "2026-11-25")
        self.assertEqual(list(fila), columnas_mayoristas() + ["fecha_datos"])

    def test_venta_por_unidad(self):
        a = productos("productos.csv", ENCABEZADO_MAYORISTA + "\n"
                      "61|1|1|7794000006012|1|17794000006012|KETCHUP FANACOA|Sin marca|14900|12314.05|1|14900|12314.05||||||\n")
        _, _, filas = armar_mayoristas([a])
        self.assertEqual(filas[0]["productos_precio_lista"], filas[0]["precio_bulto"])

    def test_promo_en_cero_es_sin_promo_y_la_leyenda_en_blanco_queda_vacia(self):
        # La Agricola Regional publica 0.00 y una leyenda de un espacio en todos sus productos.
        a = productos("productos.csv", ENCABEZADO_MAYORISTA + "\n"
                      "70|1|1|7790900015909|1|07790900015909|ABSORBE OLORES|IBERIA|7250.00|5991.74|1|7250.00|5991.74|"
                      "0.00|0.00| |0.00|0.00| \n")
        _, _, filas = armar_mayoristas([a])
        fila = filas[0]
        for columna in ("productos_precio_unitario_promo1", "promo1_sin_iva", "productos_leyenda_promo1",
                        "productos_precio_unitario_promo2", "promo2_sin_iva", "productos_leyenda_promo2"):
            self.assertEqual(fila[columna], "", columna)

    def test_promo_de_verdad_se_conserva(self):
        a = productos("productos.csv", ENCABEZADO_MAYORISTA + "\n"
                      "64|1|2|7790001|1|1779|GALLETITAS|MARCA|1000|826.45|6|6000|4958.68|900|743.80|LLEVANDO 2|||\n")
        _, _, filas = armar_mayoristas([a])
        self.assertEqual(filas[0]["productos_precio_unitario_promo1"], "900")
        self.assertEqual(filas[0]["productos_leyenda_promo1"], "LLEVANDO 2")

    def test_el_pie_de_archivo_sin_salto_de_linea_no_entra(self):
        a = productos("productos.csv", ENCABEZADO_MAYORISTA + "\n"
                      "63|1|1|7793253005863|1|17805025697286|LAVAND. AYUDIN|AYUDIN|3719.88|3074.28|15|55798.20|46114.20||||||\n"
                      "\nÚltima actualización: 2026-11-24T20:40:06-03:00")
        escritas, descartadas, filas = armar_mayoristas([a])
        self.assertEqual((escritas, descartadas), (1, 1))

    def test_un_comercio_con_el_esquema_minorista_se_saltea(self):
        # El comercio 68: esquema minorista y sin filas; no corta la carga de los demas.
        a = productos("productos.csv", "id_comercio|id_bandera|id_sucursal|id_producto|productos_precio_lista\n")
        b = productos("productos.csv", ENCABEZADO_MAYORISTA + "\n"
                      "66|1|1|0000000081744|1|81744|FW canopla|FW|10647.99|8799.99|48|511103.52|422399.52||||||\n")
        escritas, _, filas = armar_mayoristas([a, b])
        self.assertEqual(escritas, 1)
        self.assertEqual(filas[0]["id_comercio"], "66")


class TestDimensionesConLosDosDatasets(unittest.TestCase):
    def test_entran_las_carpetas_de_mayoristas_que_hay_en_disco(self):
        base = tempfile.mkdtemp()
        for carpeta in ("mayorista61", "mayorista70", "mayorista_x", "sepa10"):
            os.makedirs(os.path.join(base, carpeta))
        carpetas = carpetas_de_comercios(base)
        self.assertIn(("sepa10", "10"), carpetas)
        self.assertEqual([c for c in carpetas if c[0].startswith("mayorista")],
                         [("mayorista61", "61"), ("mayorista70", "70")])

    def test_un_mayorista_con_numero_de_minorista_no_entra_y_la_carga_falla(self):
        base = tempfile.mkdtemp()
        for carpeta in ("mayorista10", "mayorista61"):
            os.makedirs(os.path.join(base, carpeta))
        self.assertEqual(comercios_repetidos(base), ["10"])
        self.assertNotIn(("mayorista10", "10"), carpetas_de_comercios(base))
        self.assertIn(("mayorista61", "61"), carpetas_de_comercios(base))
        with self.assertRaisesRegex(RuntimeError, "numero de minorista"):
            cargar_productos_mayoristas(None, date(2026, 11, 25), base=base)

    def test_la_reconstruccion_conserva_todo_comercio_numerico_que_no_vino(self):
        # No una lista fija: con la de minoristas, cargar un dataset borraria al otro.
        consulta = consulta_reconstruccion("p.sepa.sucursales", "p.sepa.sucursales_landing")
        self.assertIn("NOT IN UNNEST(@presentes)", consulta)
        self.assertIn("REGEXP_CONTAINS(id_comercio, r'^[0-9]+$')", consulta)
        self.assertNotIn("@ausentes", consulta)


class TestArgumentos(unittest.TestCase):
    def test_solo_mayoristas(self):
        fecha, args = parsear_argumentos(["--fecha", "2026-11-24", "--solo-mayoristas"])
        self.assertEqual(fecha, date(2026, 11, 24))
        self.assertTrue(args.solo_mayoristas)

    def test_por_defecto_carga_todo(self):
        _, args = parsear_argumentos(["--fecha", "2026-11-24"])
        self.assertFalse(args.solo_mayoristas)
        self.assertNotEqual(SALIDA_FALLO_MAYORISTAS, 1)

    def test_ingesta_backfill_lee_el_mismo_codigo_de_falla_de_mayoristas(self):
        # ingesta_backfill lo copia en vez de importarlo; si cambia uno solo,
        # una falla de mayoristas se leeria como falla de minoristas.
        import ingesta_backfill
        self.assertEqual(ingesta_backfill.SALIDA_FALLO_MAYORISTAS, SALIDA_FALLO_MAYORISTAS)


if __name__ == "__main__":
    unittest.main()
