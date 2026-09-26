"""
leer_tabla: la Storage Read API y su respaldo.

    cd api && python -m unittest test_leer_tabla -v

La lectura rapida se valido contra BigQuery el 2026-09-26 (mismas filas y
tipos que list_rows en mart_mapa_promos y mart_mismo_producto). Aca se prueba
lo que no se ve en ese chequeo: que una falla de la Storage API al arrancar no
deje al sitio sin datos, y que una a mitad de camino no duplique filas.
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("SIN_BIGQUERY", "1")

import pyarrow as pa  # noqa: E402

import main  # noqa: E402


def lote(*filas):
    return pa.RecordBatch.from_pylist(list(filas))


class FilasDeListRows(list):
    """Lo que devuelve list_rows: iterable de filas, y to_arrow_iterable."""

    def __init__(self, filas, lotes):
        super().__init__(filas)
        self._lotes = lotes

    def to_arrow_iterable(self, bqstorage_client=None):
        return self._lotes()


class TestLeerTabla(unittest.TestCase):
    def setUp(self):
        parche = mock.patch.object(main, "_cliente_storage", return_value=None)
        parche.start()
        self.addCleanup(parche.stop)

    def leer(self, lotes):
        filas_list_rows = [{"id": "lento"}]
        with mock.patch.object(main.cliente_bq, "list_rows",
                               return_value=FilasDeListRows(filas_list_rows, lotes)):
            return list(main.leer_tabla("proyecto.dataset.tabla"))

    def test_lee_todos_los_lotes_en_orden(self):
        filas = self.leer(lambda: iter([lote({"id": "1"}, {"id": "2"}), lote({"id": "3"})]))
        self.assertEqual([f["id"] for f in filas], ["1", "2", "3"])

    def test_si_la_storage_api_falla_al_arrancar_usa_list_rows(self):
        def sin_permiso():
            raise PermissionError("bigquery.readsessions.create")
            yield  # pragma: no cover

        self.assertEqual(self.leer(sin_permiso), [{"id": "lento"}])

    def test_una_falla_a_mitad_de_camino_no_duplica_filas(self):
        def se_corta():
            yield lote({"id": "1"})
            raise ConnectionError("stream cortado")

        with self.assertRaises(ConnectionError):
            self.leer(se_corta)

    def test_tabla_vacia(self):
        self.assertEqual(self.leer(lambda: iter([])), [])


if __name__ == "__main__":
    unittest.main()
