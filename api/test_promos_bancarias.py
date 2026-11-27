"""
Promos bancarias curadas (openspec promos-bancarias), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_promos_bancarias -v

El archivo datos/promos_bancarias.json se cura a mano: estos tests son lo que
impide que una promo mal cargada llegue a la app.
"""

import unittest
from datetime import date
from unittest import mock

from fastapi.testclient import TestClient

import main
import promos_bancarias as pb

HOY = date(2026, 11, 27)


def promo(**cambios):
    base = {
        "id": "dia-modo-miercoles",
        "cadenas": ["Dia"],
        "entidad": "MODO",
        "medio": "qr",
        "segmento": None,
        "dias": ["miercoles"],
        "porcentaje": 20,
        "tipo": "reintegro",
        "canal": "ambos",
        "tope": 20000,
        "tope_periodo": "mes",
        "compra_minima": 35000,
        "rubros": None,
        "acumula": "no_se_sabe",
        "vigente_desde": "2026-11-01",
        "vigente_hasta": "2026-11-30",
        "fuente": "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones",
        "revisada": "2026-11-27",
    }
    return {**base, **cambios}


class TestValidar(unittest.TestCase):
    def test_una_promo_completa_no_tiene_errores(self):
        self.assertEqual(pb.errores_de_promo(promo(), HOY), [])

    def test_campo_faltante(self):
        p = promo()
        del p["fuente"]
        self.assertIn("dia-modo-miercoles: falta fuente", pb.errores_de_promo(p, HOY))

    def test_porcentaje_fuera_de_rango(self):
        self.assertTrue(any("porcentaje" in e for e in pb.errores_de_promo(promo(porcentaje=120), HOY)))
        self.assertTrue(any("porcentaje" in e for e in pb.errores_de_promo(promo(porcentaje=0), HOY)))

    def test_vigencia_invertida(self):
        errores = pb.errores_de_promo(promo(vigente_desde="2026-12-01", vigente_hasta="2026-11-01"), HOY)
        self.assertTrue(any("termina antes de empezar" in e for e in errores))

    def test_cadena_mal_escrita(self):
        errores = pb.errores_de_promo(promo(cadenas=["Carefour"]), HOY)
        self.assertIn("dia-modo-miercoles: cadena desconocida Carefour", errores)

    def test_revision_en_el_futuro(self):
        errores = pb.errores_de_promo(promo(revisada="2026-12-15"), HOY)
        self.assertTrue(any("posterior a hoy" in e for e in errores))

    def test_dia_medio_y_fuente_invalidos(self):
        errores = pb.errores_de_promo(promo(dias=["miércoles"], medio="cheque", fuente="http://x"), HOY)
        self.assertEqual(len(errores), 3)

    def test_ids_repetidos(self):
        self.assertIn("dia-modo-miercoles: id repetido", pb.errores_del_archivo([promo(), promo()], HOY))


class TestArchivoReal(unittest.TestCase):
    def test_el_archivo_curado_es_valido(self):
        self.assertEqual(pb.errores_del_archivo(pb.leer(), date.today()), [])


class TestVigentes(unittest.TestCase):
    def test_una_promo_vencida_no_se_sirve(self):
        vencida = promo(id="vieja", vigente_hasta="2026-11-30")
        r = pb.vigentes([vencida, promo(id="nueva", vigente_hasta="2026-12-31")], date(2026, 12, 1))
        self.assertEqual([p["id"] for p in r["promos"]], ["nueva"])

    def test_la_revision_mas_vieja(self):
        r = pb.vigentes([promo(id="a", revisada="2026-11-20"), promo(id="b", revisada="2026-11-27")], HOY)
        self.assertEqual(r["revisadas_hasta"], "2026-11-20")

    def test_sin_acumula_queda_no_se_sabe(self):
        p = promo()
        del p["acumula"]
        self.assertEqual(pb.vigentes([p], HOY)["promos"][0]["acumula"], "no_se_sabe")


class TestEndpoint(unittest.TestCase):
    def test_sirve_las_vigentes_sin_bigquery(self):
        main._promos_bancarias.clear()
        with mock.patch.object(pb, "leer", return_value=[promo(vigente_hasta="2099-12-31", revisada="2026-11-01")]), \
                mock.patch.object(main, "cliente_bq", None, create=True):
            r = TestClient(main.app).get("/api/promos-bancarias")
        main._promos_bancarias.clear()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["promos"][0]["entidad"], "MODO")


if __name__ == "__main__":
    unittest.main()
