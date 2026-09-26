"""
Cuando Gemini corta por limite de pedidos, el usuario recibe un mensaje y no un
error 500. Sin llamar a Gemini.

    cd api && python -m unittest test_limite_gemini -v

Paso el 2026-09-26 probando los ejemplos de Tu canasta: el plan gratuito admite
15 pedidos por minuto y el 16 devolvio 429, que la API convertia en 500.
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("SIN_BIGQUERY", "1")

from fastapi.testclient import TestClient  # noqa: E402
from google.genai import errors  # noqa: E402

import main  # noqa: E402

RUTA = "/api/canasta-personalizada/interpretar"


def falla(codigo):
    def interpretar(_descripcion):
        raise errors.ClientError(codigo, {"error": {"code": codigo, "message": "x", "status": "X"}})
    return interpretar


class TestLimiteGemini(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app, raise_server_exceptions=False)

    def test_limite_de_pedidos_es_503_con_mensaje(self):
        with mock.patch.object(main, "interpretar_descripcion", falla(429)):
            respuesta = self.cliente.post(RUTA, json={"descripcion": "vivo solo"})
        self.assertEqual(respuesta.status_code, 503)
        self.assertIn("Proba de nuevo en un minuto", respuesta.json()["detail"])

    def test_otro_error_de_gemini_no_se_disfraza(self):
        with mock.patch.object(main, "interpretar_descripcion", falla(400)):
            respuesta = self.cliente.post(RUTA, json={"descripcion": "vivo solo"})
        self.assertEqual(respuesta.status_code, 500)


if __name__ == "__main__":
    unittest.main()
