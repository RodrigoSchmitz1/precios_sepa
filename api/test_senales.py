"""
Tests de las señales anonimas (openspec senales-anonimas), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_senales -v
"""

import json
import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main
import senales

ID = "0f8fad5b-d9cb-469f-a165-70867728950e"
OTRO_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
RUBROS = {"limpieza": "Limpieza", "almacen": "Almacen"}
PRODUCTOS = {"7790060023684": {"categoria": "Aceites", "rubro": "Almacen"}}
ZONAS = {("AR-C", "Caballito")}


def categoria_de(texto):
    return "Lavandina" if "lavandina" in texto.lower() else None


def validar(cuerpo):
    return senales.validar_tanda(cuerpo, rubros=RUBROS, productos=PRODUCTOS, zonas=ZONAS,
                                 categoria_de=categoria_de, hoy="2026-11-23")


def tanda(*eventos, zona={"provincia": "AR-C", "nombre": "Caballito"}, id_dia=ID):
    return {"id": id_dia, "zona": zona, "eventos": list(eventos)}


class TestValidar(unittest.TestCase):
    def test_vista_de_un_rubro_con_la_zona(self):
        filas = validar(tanda({"tipo": "vista_rubro", "rubro": "limpieza"}))
        self.assertEqual(filas, [{"fecha": "2026-11-23", "tipo": "vista_rubro", "id_dia": ID, "provincia": "AR-C",
                                  "localidad": "Caballito", "rubro": "Limpieza", "categoria": None, "id_producto": None}])

    def test_aviso_lleva_producto_categoria_y_rubro(self):
        fila = validar(tanda({"tipo": "aviso_pedido", "id_producto": "7790060023684"}))[0]
        self.assertEqual((fila["id_producto"], fila["categoria"], fila["rubro"]), ("7790060023684", "Aceites", "Almacen"))

    def test_la_busqueda_guarda_la_categoria_y_no_el_texto(self):
        filas = validar(tanda({"tipo": "busqueda", "texto": "lavandina ayudin"}))
        self.assertEqual(filas[0]["categoria"], "Lavandina")
        self.assertNotIn("lavandina ayudin", json.dumps(filas))
        self.assertNotIn("texto", filas[0])

    def test_busqueda_sin_resultado_no_guarda_nada(self):
        self.assertEqual(validar(tanda({"tipo": "busqueda", "texto": "zxqw"})), [])

    def test_descarta_lo_que_no_cumple(self):
        malos = [
            {"tipo": "clic"},  # tipo desconocido
            {"tipo": "vista_rubro", "rubro": "limpieza", "ip": "1.2.3.4"},  # campo de mas
            {"tipo": "vista_rubro", "rubro": "inventado"},  # rubro que no existe
            {"tipo": "aviso_pedido", "id_producto": "999"},  # producto que no existe
            {"tipo": "busqueda", "texto": "x" * 200},  # texto demasiado largo
            "no es un objeto",
        ]
        self.assertEqual(validar(tanda(*malos)), [])

    def test_identificador_invalido_o_campos_de_mas_descartan_la_tanda(self):
        self.assertEqual(validar(tanda({"tipo": "vista_rubro", "rubro": "limpieza"}, id_dia="usuario-42")), [])
        cuerpo = tanda({"tipo": "vista_rubro", "rubro": "limpieza"})
        cuerpo["nombre"] = "Rodrigo"
        self.assertEqual(validar(cuerpo), [])

    def test_zona_desconocida_queda_vacia(self):
        fila = validar(tanda({"tipo": "vista_rubro", "rubro": "limpieza"}, zona={"provincia": "AR-C", "nombre": "Mi casa"}))[0]
        self.assertEqual((fila["provincia"], fila["localidad"]), (None, None))

    def test_tope_de_eventos_por_tanda(self):
        eventos = [{"tipo": "vista_rubro", "rubro": "limpieza"}] * 50
        self.assertEqual(len(validar(tanda(*eventos))), senales.MAXIMO_POR_TANDA)


class TestTopes(unittest.TestCase):
    def test_por_identificador_y_por_dia(self):
        topes = senales.Topes(por_id=5, por_ip_por_hora=100, por_dia=8)
        self.assertEqual(topes.cuantos(ID, "ip", 3, ahora=1e9), 3)
        self.assertEqual(topes.cuantos(ID, "ip", 3, ahora=1e9), 2)  # llega a 5 por id
        self.assertEqual(topes.cuantos(OTRO_ID, "ip", 5, ahora=1e9), 3)  # llega a 8 en el dia
        self.assertEqual(topes.cuantos(OTRO_ID, "ip", 1, ahora=1e9 + 86400), 1)  # otro dia

    def test_por_ip_en_la_ultima_hora(self):
        topes = senales.Topes(por_id=100, por_ip_por_hora=4, por_dia=100)
        self.assertEqual(topes.cuantos(ID, "1.1.1.1", 4, ahora=1e9), 4)
        self.assertEqual(topes.cuantos(OTRO_ID, "1.1.1.1", 1, ahora=1e9 + 10), 0)
        self.assertEqual(topes.cuantos(OTRO_ID, "1.1.1.1", 1, ahora=1e9 + 3700), 1)


class ClienteFalso:
    """Solo acepta cargas: si alguien hiciera una consulta, el test falla."""

    def __init__(self):
        self.cargas = []
        self.datasets = []

    def create_dataset(self, dataset, exists_ok=False):
        self.datasets.append(dataset)

    def load_table_from_file(self, archivo, destino, job_config=None):
        self.cargas.append((destino, archivo.read().decode("utf-8"), job_config))
        return mock.Mock(result=lambda: None)

    def query(self, *a, **k):  # pragma: no cover
        raise AssertionError("las señales no pueden consultar BigQuery")


class TestBuffer(unittest.TestCase):
    def test_sube_con_un_load_job_y_sin_consultas(self):
        cliente = ClienteFalso()
        buffer = senales.Buffer("proyecto", lambda: cliente)
        buffer._filas = validar(tanda({"tipo": "vista_rubro", "rubro": "limpieza"}, {"tipo": "vista_rubro", "rubro": "almacen"}))
        self.assertEqual(buffer.vaciar(), 2)
        destino, ndjson, config = cliente.cargas[0]
        self.assertEqual(destino, "proyecto.sepa_senales.eventos")
        self.assertEqual(len(ndjson.splitlines()), 2)
        self.assertEqual(config.time_partitioning.field, "fecha")
        self.assertEqual(cliente.datasets[0].default_partition_expiration_ms, senales.EXPIRACION_DIAS * 86400 * 1000)
        self.assertEqual(buffer.pendientes(), 0)

    def test_si_falla_la_carga_las_filas_vuelven(self):
        def roto():
            raise RuntimeError("sin red")
        buffer = senales.Buffer("proyecto", roto)
        buffer._filas = [{"fecha": "2026-11-23"}]
        self.assertEqual(buffer.vaciar(), 0)
        self.assertEqual(buffer.pendientes(), 1)

    def test_vacia_al_llegar_al_tamano(self):
        buffer = senales.Buffer("proyecto", lambda: None)
        with mock.patch.object(senales.threading, "Thread") as hilo:
            buffer.agregar([{}] * (senales.VACIAR_CON_FILAS - 1), ahora=buffer._ultimo + 1)
            hilo.assert_not_called()
            buffer.agregar([{}], ahora=buffer._ultimo + 1)
            hilo.assert_called_once()


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)
        main._topes_senales = senales.Topes()
        self.agregadas = []
        self.parches = [
            mock.patch.object(main, "_rubros_para_senales", return_value=RUBROS),
            mock.patch.object(main, "_indice_mismo_producto", return_value=PRODUCTOS),
            mock.patch.object(main, "obtener_zonas", return_value=[{"provincia": "AR-C", "nombre": "Caballito"}]),
            mock.patch.object(main, "_categoria_de_busqueda", side_effect=categoria_de),
            mock.patch.object(main._buffer_senales, "agregar", side_effect=self.agregadas.extend),
        ]
        for p in self.parches:
            p.start()

    def tearDown(self):
        for p in self.parches:
            p.stop()

    def mandar(self, cuerpo):
        # Como sendBeacon: texto plano.
        return self.cliente.post("/api/senales", content=json.dumps(cuerpo), headers={"Content-Type": "text/plain"})

    def test_apagadas_por_defecto(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SENALES_ACTIVAS", None)
            self.assertEqual(self.cliente.get("/api/senales/estado").json(), {"activas": False})
            r = self.mandar(tanda({"tipo": "vista_rubro", "rubro": "limpieza"}))
        self.assertEqual(r.status_code, 503)
        self.assertEqual(self.agregadas, [])

    def test_prendidas_guardan_lo_valido_sin_la_ip(self):
        with mock.patch.dict(os.environ, {"SENALES_ACTIVAS": "1"}):
            self.assertEqual(self.cliente.get("/api/senales/estado").json(), {"activas": True})
            r = self.cliente.post("/api/senales", content=json.dumps(tanda({"tipo": "vista_rubro", "rubro": "limpieza"},
                                                                          {"tipo": "clic"})),
                                  headers={"Content-Type": "text/plain", "X-Forwarded-For": "200.1.2.3"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual(len(self.agregadas), 1)
        self.assertNotIn("200.1.2.3", json.dumps(self.agregadas))

    def test_cuerpo_invalido(self):
        with mock.patch.dict(os.environ, {"SENALES_ACTIVAS": "1"}):
            r = self.cliente.post("/api/senales", content="no es json", headers={"Content-Type": "text/plain"})
            self.assertEqual(r.status_code, 422)
            r = self.cliente.post("/api/senales", content="x" * 9000, headers={"Content-Type": "text/plain"})
            self.assertEqual(r.status_code, 413)


if __name__ == "__main__":
    unittest.main()
