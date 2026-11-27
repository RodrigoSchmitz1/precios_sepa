"""
Mis gastos: lectura de tickets, cruce con SEPA y endpoint (openspec
mis-gastos-y-barra-nueva). Sin llamar a Gemini ni a BigQuery.

    cd api && python -m unittest test_tickets -v
"""

import base64
import json
import os
import unittest
from pathlib import Path
from unittest import mock

os.environ.setdefault("SIN_BIGQUERY", "1")

from fastapi.testclient import TestClient  # noqa: E402
from google.genai import errors  # noqa: E402

import main  # noqa: E402
import tickets  # noqa: E402
from mismo_producto import armar_indice  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures" / "tickets"


def fixture(nombre: str) -> dict:
    return json.loads((FIXTURES / f"{nombre}.json").read_text(encoding="utf-8"))


def fila(id_producto, descripcion, marca, categoria, cadena, precio):
    return {
        "id_producto": id_producto, "descripcion": descripcion, "marca": marca, "categoria": categoria,
        "cadena": cadena, "precio_mediano": precio, "precio_minimo": precio, "precio_maximo": precio,
        "sucursales": 10, "cadenas": 3, "empresas": 3, "precio_mas_bajo": precio, "precio_mas_alto": precio,
        "diferencia_pct": 0, "fecha_datos": "2026-11-18", "precio_creible": True,
    }


INDICE = armar_indice([
    fila("7790710334535", "YERBA MATE CON HIERBAS SERRANAS", "CBSE", "Yerba", "Carrefour", 1758),
    fila("7790150830444", "CACAO EN POLVO CHOCOLINO 180 G", "CHOCOLINO", "Cacao", "Carrefour", 1766),
    fila("7794396004522", "LECHE DESCREMADA UAT 1 L", "LA SUIPACHENSE", "Leche", "Carrefour", 1430),
    fila("7793147570187", "CERVEZA HEINEKEN LATA 473 ML X 6", "HEINEKEN", "Cerveza", "Coto", 515),
    fila("7790127000269", "ACEITUNAS VERDES 300 G", "VANOLI", "Conservas", "Coto", 39.9),
    fila("7790895012259", "GASEOSA COCA COLA ZERO 1,75 L", "COCA COLA", "Gaseosas", "Jumbo", 3100),
    fila("7790895067570", "GASEOSA COCA COLA SIN AZUCAR 2,25 L", "COCA COLA", "Gaseosas", "Dia", 3050),
    fila("7790895000997", "GASEOSA COCA COLA SABOR ORIGINAL 2,25 L", "COCA COLA", "Gaseosas", "Dia", 3300),
    fila("7790070012050", "FIDEOS SPAGHETTI 500 G", "LUCCHETTI", "Fideos", "Dia", 3080),
])

TABLA_CUIT = tickets.armar_tabla_cuit([
    {"cuit": "30687310434", "nombre_comercial": "Carrefour"},
    {"cuit": "30687310434", "nombre_comercial": "Market (Carrefour)"},
    {"cuit": "30548083156", "nombre_comercial": "Coto"},
    {"cuit": "30590360763", "nombre_comercial": "Jumbo"},
    {"cuit": "30590360763", "nombre_comercial": "Vea"},
    {"cuit": "30590360763", "nombre_comercial": "Disco"},
    {"cuit": "30685849751", "nombre_comercial": "Dia"},
])


def sin_elegir(_pendientes, _categorias):
    return {}


class TestLimpiarLectura(unittest.TestCase):
    def test_solo_salen_los_campos_previstos(self):
        for nombre in ("carrefour", "coto", "jumbo", "dia"):
            with self.subTest(nombre):
                limpio = tickets.limpiar_lectura(fixture(nombre))
                texto = json.dumps(limpio)
                self.assertNotIn("12345678", texto)
                self.assertNotIn("5678", texto.replace("15678", ""))
                self.assertNotIn("INVENTADA", texto)
                self.assertEqual(set(limpio), {"legible", "cadena", "cuit_comercio", "sucursal", "fecha",
                                               "comprobante", "total", "lineas", "descuentos"})

    def test_dos_fotos_superpuestas_se_unen_sin_repetir(self):
        limpio = tickets.limpiar_lectura(fixture("coto"))
        descripciones = [x["descripcion"] for x in limpio["lineas"]]
        self.assertEqual(descripciones.count("VINO MALBEC MARCUS BOT 750 CC"), 1)
        self.assertEqual(len(limpio["lineas"]), 6)
        # El descuento con importe negativo queda en positivo.
        self.assertIn({"descripcion": "40% VINOS/CHAM COMU", "importe": 69.2}, limpio["descuentos"])

    def test_lineas_iguales_dentro_de_una_foto_son_dos_compras(self):
        linea = {"descripcion": "LECHE", "cantidad": 1, "precio_unitario": 1000, "importe": 1000, "codigo": None}
        limpio = tickets.limpiar_lectura({"total": 2000, "fotos": [{"lineas": [linea, linea]}]})
        self.assertEqual(len(limpio["lineas"]), 2)

    def test_no_es_ticket(self):
        self.assertEqual(tickets.limpiar_lectura({"es_ticket": False}), {"legible": False})
        self.assertEqual(tickets.limpiar_lectura({"fotos": [{"lineas": []}]}), {"legible": False})

    def test_comprobante_sin_espacios_alrededor_del_guion(self):
        limpio = tickets.limpiar_lectura({"total": 10, "comprobante": "04712 - 00116390", "fotos": []})
        self.assertEqual(limpio["comprobante"], "04712-00116390")

    def test_fecha_invalida_queda_vacia(self):
        limpio = tickets.limpiar_lectura({"total": 10, "fecha": "2025-02-30", "fotos": []})
        self.assertIsNone(limpio["fecha"])


class TestCadena(unittest.TestCase):
    def test_por_cuit(self):
        self.assertEqual(tickets.cadenas_del_ticket("COTO", "30548083156", TABLA_CUIT), ["Coto"])
        self.assertEqual(tickets.cadenas_del_ticket("Carrefour", "30687310434", TABLA_CUIT)[0], "Carrefour")
        self.assertIn("Market (Carrefour)", tickets.cadenas_del_ticket("Carrefour", "30687310434", TABLA_CUIT))

    def test_nombre_exacto_gana_el_empate(self):
        tabla = tickets.armar_tabla_cuit([
            {"cuit": "30687310434", "nombre_comercial": "Maxi (Carrefour)"},
            {"cuit": "30687310434", "nombre_comercial": "Carrefour"},
        ])
        self.assertEqual(tickets.cadenas_del_ticket("Carrefour", "30687310434", tabla)[0], "Carrefour")

    def test_el_nombre_elige_dentro_de_la_empresa(self):
        self.assertEqual(tickets.cadenas_del_ticket("Jumbo", "30590360763", TABLA_CUIT)[0], "Jumbo")
        self.assertEqual(tickets.cadenas_del_ticket("DISCO", "30590360763", TABLA_CUIT)[0], "Disco")

    def test_sin_cuit_por_nombre(self):
        self.assertEqual(tickets.cadenas_del_ticket("DIA", None, TABLA_CUIT), ["Dia"])
        self.assertEqual(tickets.cadenas_del_ticket("Carrefour Market", None, TABLA_CUIT)[0], "Market (Carrefour)")


class TestVincular(unittest.TestCase):
    def vincular(self, nombre, elegir=sin_elegir):
        return tickets.vincular(tickets.limpiar_lectura(fixture(nombre)), INDICE, TABLA_CUIT, elegir)

    def test_carrefour_y_jumbo_por_codigo(self):
        for nombre in ("carrefour", "jumbo"):
            with self.subTest(nombre):
                ticket = self.vincular(nombre)
                self.assertTrue(all(x["vinculo"] == "codigo" for x in ticket["lineas"]))

    def test_coto_codigo_con_cero_adelante_y_pesable(self):
        ticket = self.vincular("coto")
        por_texto = {x["descripcion"]: x for x in ticket["lineas"]}
        self.assertEqual(por_texto["CERVEZA 473 ML X 6 UNIHEINEKEN PAK"]["id_producto"], "7793147570187")
        self.assertEqual(por_texto["CERVEZA 473 ML X 6 UNIHEINEKEN PAK"]["categoria"], "Cerveza")
        self.assertEqual(por_texto["ACEITUNAS VERDES VANOLI POU 300 GRM"]["vinculo"], "codigo")
        # El pesable (empieza con 2) no se vincula por codigo ni tiene candidatos (cantidad no entera).
        self.assertEqual(por_texto["MANI SIN SAL X KG"]["vinculo"], "ninguno")

    def test_dia_por_candidato(self):
        vistos = {}

        def elegir(pendientes, categorias):
            vistos["pendientes"] = pendientes
            coca = next(p for p in pendientes if p["descripcion"] == "GASEOSA COCA SIN AZU")
            return {"lineas": [{"n": coca["n"], "id_producto": coca["candidatos"][0]["id_producto"]},
                               {"n": 1, "id_producto": None, "categoria": "Inventada"}]}

        ticket = self.vincular("dia", elegir)
        coca = vistos["pendientes"][0]
        ids = [c["id_producto"] for c in coca["candidatos"]]
        # Mismas palabras y precio parecido en Dia; los fideos no comparten palabras.
        self.assertEqual(ids[0], "7790895067570")
        self.assertNotIn("7790070012050", ids)
        self.assertLessEqual(len(ids), tickets.CANDIDATOS_POR_LINEA)
        self.assertEqual(ticket["lineas"][0]["vinculo"], "candidato")
        self.assertEqual(ticket["lineas"][0]["categoria"], "Gaseosas")
        # Categoria fuera de la lista del sitio: queda en Otros.
        self.assertEqual(ticket["lineas"][1]["categoria"], "Otros")

    def test_no_se_acepta_un_id_que_no_era_candidato(self):
        ticket = self.vincular("dia", lambda p, c: {"lineas": [{"n": 0, "id_producto": "7790710334535"}]})
        self.assertEqual(ticket["lineas"][0]["vinculo"], "ninguno")

    def test_sin_lineas_pendientes_no_llama_al_paso_2(self):
        elegir = mock.Mock(return_value={})
        self.vincular("jumbo", elegir)
        elegir.assert_not_called()


class TestTopes(unittest.TestCase):
    def test_por_ip(self):
        topes = tickets.Topes(por_hora_por_ip=2, por_dia=100)
        self.assertIsNone(topes.permitir("1.1.1.1", 0))
        self.assertIsNone(topes.permitir("1.1.1.1", 10))
        self.assertEqual(topes.permitir("1.1.1.1", 20), "ip")
        self.assertIsNone(topes.permitir("2.2.2.2", 20))
        self.assertIsNone(topes.permitir("1.1.1.1", 3700))

    def test_por_dia(self):
        topes = tickets.Topes(por_hora_por_ip=100, por_dia=2)
        topes.permitir("a", 0)
        topes.permitir("b", 1)
        self.assertEqual(topes.permitir("c", 2), "dia")


FOTO = base64.b64encode(b"\xff\xd8 foto de prueba").decode()


class TestEndpoint(unittest.TestCase):
    RUTA = "/api/gastos/leer-ticket"

    def setUp(self):
        self.cliente = TestClient(main.app, raise_server_exceptions=False)
        main._topes_tickets = tickets.Topes()
        self.parches = [
            mock.patch.dict(os.environ, {"FOTOS_DE_TICKETS": "1"}),
            mock.patch.object(main, "_indice_mismo_producto", return_value=INDICE),
            mock.patch.object(main, "_tabla_cuit", return_value=TABLA_CUIT),
            mock.patch.object(main, "_cliente_gemini_tickets", return_value=object()),
        ]
        for p in self.parches:
            p.start()

    def tearDown(self):
        for p in self.parches:
            p.stop()

    def test_lee_y_vincula(self):
        with mock.patch.object(tickets, "leer_con_gemini", return_value=fixture("jumbo")), \
             mock.patch.object(main.cliente_bq, "query", side_effect=AssertionError("consulta a BigQuery")) as query:
            respuesta = self.cliente.post(self.RUTA, json={"fotos": [FOTO]})
        self.assertEqual(respuesta.status_code, 200)
        cuerpo = respuesta.json()
        self.assertTrue(cuerpo["legible"])
        self.assertEqual(cuerpo["ticket"]["lineas"][0]["id_producto"], "7790895012259")
        self.assertEqual(cuerpo["constantes"]["cobertura_minima_comparacion"], tickets.COBERTURA_MINIMA_COMPARACION)
        self.assertNotIn("12345678", respuesta.text)
        query.assert_not_called()

    def test_foto_ilegible(self):
        with mock.patch.object(tickets, "leer_con_gemini", return_value={"es_ticket": False}):
            respuesta = self.cliente.post(self.RUTA, json={"fotos": [FOTO]})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), {"legible": False})

    def test_mas_de_tres_fotos(self):
        respuesta = self.cliente.post(self.RUTA, json={"fotos": [FOTO] * 4})
        self.assertEqual(respuesta.status_code, 422)

    def test_foto_que_no_es_base64(self):
        respuesta = self.cliente.post(self.RUTA, json={"fotos": ["esto no es base64 !!"]})
        self.assertEqual(respuesta.status_code, 422)

    def test_foto_demasiado_grande(self):
        grande = base64.b64encode(b"x" * (tickets.MAXIMO_BYTES_POR_FOTO + 1)).decode()
        respuesta = self.cliente.post(self.RUTA, json={"fotos": [grande]})
        self.assertEqual(respuesta.status_code, 413)

    def test_tope_por_ip(self):
        main._topes_tickets = tickets.Topes(por_hora_por_ip=1)
        with mock.patch.object(tickets, "leer_con_gemini", return_value=fixture("jumbo")):
            self.assertEqual(self.cliente.post(self.RUTA, json={"fotos": [FOTO]}).status_code, 200)
            respuesta = self.cliente.post(self.RUTA, json={"fotos": [FOTO]})
        self.assertEqual(respuesta.status_code, 429)
        self.assertIn("hora", respuesta.json()["detail"])

    def test_limite_de_gemini_es_503_con_mensaje(self):
        error = errors.ClientError(429, {"error": {"code": 429, "message": "x", "status": "X"}})
        with mock.patch.object(tickets, "leer_con_gemini", side_effect=error):
            respuesta = self.cliente.post(self.RUTA, json={"fotos": [FOTO]})
        self.assertEqual(respuesta.status_code, 503)
        self.assertIn("Probá de nuevo en un minuto", respuesta.json()["detail"])


class TestFotosApagadas(unittest.TestCase):
    """Sin FOTOS_DE_TICKETS=1 la API no lee fotos y la pagina lo sabe (2026-11-23)."""

    def setUp(self):
        self.cliente = TestClient(main.app, raise_server_exceptions=False)
        # El estado tambien trae los rubros (app-para-el-usuario): sin indice, vacios.
        parche = mock.patch.object(main, "_rubros_de_gastos", return_value={})
        parche.start()
        self.addCleanup(parche.stop)

    def test_apagadas_por_defecto(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("FOTOS_DE_TICKETS", None)
            self.assertIs(self.cliente.get("/api/gastos/estado").json()["fotos"], False)
            with mock.patch.object(tickets, "leer_con_gemini") as gemini:
                r = self.cliente.post("/api/gastos/leer-ticket", json={"fotos": [FOTO]})
                gemini.assert_not_called()
            self.assertEqual(r.status_code, 503)
            self.assertIn("anotar el monto", r.json()["detail"])

    def test_prendidas(self):
        with mock.patch.dict(os.environ, {"FOTOS_DE_TICKETS": "1"}):
            self.assertIs(self.cliente.get("/api/gastos/estado").json()["fotos"], True)


if __name__ == "__main__":
    unittest.main()
