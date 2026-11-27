"""
Pruebas de que comercios baja cada dataset de SEPA (openspec sumar-mayoristas), sin red.

    cd orquestacion/scripts && python -m unittest test_descargar_sepa -v

Los ZIP se arman en memoria con la misma forma que publica el portal: un ZIP del
dia con una carpeta de fecha y, adentro, un ZIP por comercio.
"""

import io
import os
import tempfile
import unittest
import zipfile
from unittest import mock

import descargar_sepa
from descargar_sepa import debe_extraer, es_esquema_mayorista

ENCABEZADO_MAYORISTA = (
    "﻿id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|id_dun_14|productos_descripcion|"
    "productos_marca|precio_unitario_bulto_por_unidad_venta_con_iva|precio_unitario_bulto_por_unidad_venta_sin_iva|"
    "unidad_venta|precio_bulto_con_iva|precio_bulto_sin_iva|productos_precio_unitario_con_iva_promo1|"
    "productos_precio_unitario_sin_iva_promo1|productos_leyenda_promo1|productos_precio_unitario_con_iva_promo2|"
    "productos_precio_unitario_sin_iva_promo2|productos_leyenda_promo2"
)
# El 68 publica el esquema minorista y ninguna fila (semana del 20 al 26-11-2026).
ENCABEZADO_MINORISTA = (
    "﻿id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|productos_descripcion|"
    "productos_cantidad_presentacion|productos_unidad_medida_presentacion|productos_marca|productos_precio_lista"
)


def zip_comercio(encabezado, filas=""):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("productos.csv", encabezado + "\r\n" + filas)
        z.writestr("sucursales.csv", "id_comercio|id_bandera|id_sucursal\r\n")
        z.writestr("comercio.csv", "id_comercio|id_bandera\r\n")
    return buf.getvalue()


def zip_del_dia(comercios):
    """comercios: {id: bytes del ZIP del comercio}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("2026-11-25/", "")
        for id_comercio, contenido in comercios.items():
            z.writestr(f"2026-11-25/sepa_1_comercio-sepa-{id_comercio}_2026-11-25_09-05-10.zip", contenido)
    return buf.getvalue()


class TestEsquema(unittest.TestCase):
    def test_reconoce_el_esquema_mayorista_con_bom(self):
        self.assertTrue(es_esquema_mayorista(ENCABEZADO_MAYORISTA))

    def test_el_esquema_minorista_no_es_mayorista(self):
        self.assertFalse(es_esquema_mayorista(ENCABEZADO_MINORISTA))

    def test_sin_archivo_de_productos_no_es_mayorista(self):
        self.assertFalse(es_esquema_mayorista(None))


class TestDebeExtraer(unittest.TestCase):
    def test_minoristas_usa_la_lista_fija(self):
        self.assertTrue(debe_extraer("minoristas", 10, ENCABEZADO_MINORISTA)[0])
        self.assertFalse(debe_extraer("minoristas", 23, ENCABEZADO_MINORISTA)[0])

    def test_mayoristas_acepta_un_comercio_nuevo_con_el_esquema_del_bulto(self):
        # Sin lista fija: un mayorista que empieza a informar se baja solo.
        self.assertEqual(debe_extraer("mayoristas", 99, ENCABEZADO_MAYORISTA), (True, None))

    def test_mayoristas_saltea_el_68_con_motivo(self):
        extraer, motivo = debe_extraer("mayoristas", 68, ENCABEZADO_MINORISTA)
        self.assertFalse(extraer)
        self.assertIn("esquema mayorista", motivo)


class TestExtraer(unittest.TestCase):
    def setUp(self):
        self.destino = tempfile.mkdtemp()
        self.trabajo = tempfile.mkdtemp()
        parche = mock.patch.object(descargar_sepa, "CARPETA_DESTINO", self.destino)
        parche.start()
        self.addCleanup(parche.stop)

    def extraer(self, comercios, dataset):
        ruta = os.path.join(self.trabajo, "dia.zip")
        with open(ruta, "wb") as f:
            f.write(zip_del_dia(comercios))
        return descargar_sepa.extraer_comercios_objetivo(ruta, self.trabajo, dataset)

    def test_mayoristas_va_a_carpetas_propias_y_saltea_el_68(self):
        extraidos = self.extraer({
            61: zip_comercio(ENCABEZADO_MAYORISTA, "61|1|1|7790001|1|1779|X|Y|10|8|1|10|8||||||\r\n"),
            68: zip_comercio(ENCABEZADO_MINORISTA),
        }, "mayoristas")
        self.assertEqual(extraidos, [61])
        self.assertEqual(os.listdir(self.destino), ["mayorista61"])

    def test_la_limpieza_de_un_dataset_no_toca_al_otro(self):
        for carpeta in ("sepa10", "sepa2", "mayorista61", "sepa_notas"):
            os.makedirs(os.path.join(self.destino, carpeta))
        descargar_sepa.limpiar_carpetas_comercios("mayorista")
        self.assertEqual(sorted(os.listdir(self.destino)), ["sepa10", "sepa2", "sepa_notas"])
        descargar_sepa.limpiar_carpetas_comercios("sepa")
        # Solo sepaN/ con N numerico: otra carpeta que empiece con "sepa" no se borra.
        self.assertEqual(os.listdir(self.destino), ["sepa_notas"])

    def test_minoristas_sigue_extrayendo_a_sepa(self):
        extraidos = self.extraer({10: zip_comercio(ENCABEZADO_MINORISTA), 23: zip_comercio(ENCABEZADO_MINORISTA)},
                                 "minoristas")
        self.assertEqual(extraidos, [10])
        self.assertEqual(os.listdir(self.destino), ["sepa10"])


if __name__ == "__main__":
    unittest.main()
