"""
Tests del periodo mensual de inflacion, sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_inflacion -v

La consulta en si se valido contra el historico real con dry run; aca se cubre
lo que se puede romper sin mirar datos: el parametro de mes y que un mes mal
escrito no llegue a BigQuery.
"""

import datetime
import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main


class TestParametroMes(unittest.TestCase):
    def test_un_mes_es_su_primer_dia(self):
        parametro = main._parametro_mes("2026-10")
        self.assertEqual(parametro.name, "mes")
        self.assertEqual(parametro.type_, "DATE")
        self.assertEqual(parametro.value, datetime.date(2026, 10, 1))

    def test_sin_mes_la_consulta_usa_el_ultimo(self):
        self.assertIsNone(main._parametro_mes(None).value)

    def test_las_consultas_filtran_por_el_mes(self):
        sql = main._ctes_periodo_mensual("p.d.t")
        self.assertIn("@mes IS NULL OR DATE_TRUNC(fecha_datos, MONTH) = @mes", sql)
        # El eslabon que termina en el mes anterior es la base, no parte del mes.
        self.assertIn("c.fecha_base >= l.inicio_mes", sql)


class TestMinimoDeEmpresas(unittest.TestCase):
    """El indice de mercado pide 3 EMPRESAS por dia, no 3 cadenas (auditoria
    2026-10-28): Verduras se media con Carrefour, Market, Maxi y Coto, que son
    2 empresas. La consulta se valido contra el historico real; aca se fija que
    el minimo no vuelva a contar banderas."""

    def setUp(self):
        self.sql = " ".join(main._ctes_mercado("p.d.t").split())

    def test_la_empresa_sale_de_la_seed(self):
        self.assertIn(f"LEFT JOIN `{main.MAPEO_CADENAS}` AS e ON e.nombre_comercial = h.cadena", self.sql)

    def test_una_cadena_fuera_de_la_seed_cuenta_como_empresa_propia(self):
        self.assertIn("COUNT(DISTINCT COALESCE(CAST(e.id_comercio AS STRING), h.cadena)) AS empresas", self.sql)

    def test_el_minimo_es_de_empresas(self):
        self.assertIn("HAVING empresas >= 3", self.sql)
        self.assertNotIn("HAVING COUNT(DISTINCT h.cadena)", self.sql)


def fila(categoria, gasto, factor, cadenas=5):
    return {"categoria": categoria, "gasto": gasto, "factor": factor, "cadenas": cadenas}


class TestIncidencia(unittest.TestCase):
    def test_un_ejemplo_a_mano(self):
        # Carne pesa 3/4 y sube 4%; pan pesa 1/4 y baja 2%: la canasta sube 2,5%.
        r = main.armar_incidencia([fila("Carne", 300, 1.04), fila("Pan", 100, 0.98)])
        self.assertAlmostEqual(r["variacion_canasta_pct"], 2.5)
        por = {c["categoria"]: c for c in r["categorias"]}
        self.assertAlmostEqual(por["Carne"]["incidencia_pp"], 3.0)
        self.assertAlmostEqual(por["Pan"]["incidencia_pp"], -0.5)
        self.assertEqual([c["categoria"] for c in r["categorias"]], ["Carne", "Pan"])

    def test_las_incidencias_suman_la_variacion(self):
        # Es lo que permite dibujarla como cascada. Se prueba sobre tablas al azar
        # con semilla fija, con subas y bajas mezcladas.
        import random

        azar = random.Random(20261027)
        for _ in range(200):
            filas = [fila(f"C{i}", azar.uniform(1, 1000), azar.uniform(0.9, 1.15)) for i in range(azar.randint(1, 32))]
            r = main.armar_incidencia(filas)
            suma = sum(c["incidencia_pp"] for c in r["categorias"])
            self.assertAlmostEqual(suma, r["variacion_canasta_pct"], delta=0.005 + 0.0001 * len(filas))

    def test_sin_indice_no_se_inventa_y_baja_la_cobertura(self):
        r = main.armar_incidencia([fila("Carne", 300, 1.04), fila("Aceite", 100, None)])
        self.assertEqual(r["sin_indice"], ["Aceite"])
        self.assertAlmostEqual(r["cobertura_pct"], 75.0)
        # Los pesos se reparten entre las medidas: la canasta es la carne sola.
        self.assertAlmostEqual(r["variacion_canasta_pct"], 4.0)
        self.assertEqual(r["categorias"][0]["peso_pct"], 100.0)

    def test_sin_precio_no_tiene_peso(self):
        r = main.armar_incidencia([fila("Carne", 300, 1.04), fila("Hielo", None, 1.5)])
        self.assertEqual([c["categoria"] for c in r["categorias"]], ["Carne"])
        self.assertIn("Hielo", r["sin_indice"])

    def test_sin_nada_medido(self):
        r = main.armar_incidencia([fila("Carne", 300, None)])
        self.assertIsNone(r["variacion_canasta_pct"])
        self.assertEqual(r["categorias"], [])


class TestMesMalEscrito(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)

    def test_se_rechaza_antes_de_consultar(self):
        with mock.patch.object(main.cliente_bq, "query") as consulta:
            for malo in ("2026-13", "2026-1", "octubre", "2026-10-01", "2026-00"):
                for ruta in ("/api/inflacion/resumen", "/api/inflacion", "/api/inflacion/incidencia"):
                    respuesta = self.cliente.get(ruta, params={"mes": malo})
                    self.assertEqual(respuesta.status_code, 422, (ruta, malo))
            consulta.assert_not_called()


if __name__ == "__main__":
    unittest.main()
