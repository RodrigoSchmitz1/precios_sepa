"""
Tests del optimizador de compra entre sucursales.

Se corren con la libreria estandar, sin dependencias nuevas:
    cd api && python -m unittest test_optimizar_compra -v

La prueba central compara el optimizador contra una busqueda exhaustiva que NO
agrupa sucursales iguales ni descarta dominadas. Si alguna de esas podas
estuviera mal razonada, en algun caso aleatorio el optimizador devolveria algo
peor que la busqueda exhaustiva. Los casos se generan con pocos valores de precio
y de distancia a proposito, para forzar empates y sucursales identicas, que es
justamente donde las podas se pueden equivocar.
"""

import random
import time
import unittest
from itertools import combinations

from optimizar_compra import (
    INF,
    distancia_km,
    optimizar_compra,
    sucursales_en_radio,
)


def exhaustiva(items, sucursales, k):
    """Referencia: mejor combinacion de 1 a k sucursales, sin ninguna poda."""
    cantidades = {}
    for item in items:
        cantidades[item["clave"]] = cantidades.get(item["clave"], 0) + item["cantidad"]
    con_precio = {c for s in sucursales for c in s["precios"]}
    claves = [c for c in cantidades if c in con_precio]
    mejor = None
    for tamano in range(1, k + 1):
        for combo in combinations(sucursales, tamano):
            cubiertos, total = 0, 0.0
            for c in claves:
                costos = [s["precios"][c] * cantidades[c] for s in combo if c in s["precios"]]
                if costos:
                    cubiertos += 1
                    total += min(costos)
            if cubiertos == 0:
                continue
            clave = (-cubiertos, total, sum(s["distancia_km"] for s in combo))
            if mejor is None or clave < mejor:
                mejor = clave
    return mejor


def clave_de_opcion(opcion):
    return (-opcion["items_cubiertos"], opcion["total"], opcion["distancia_suma_km"])


class TestDistancia(unittest.TestCase):
    def test_obelisco_a_plaza_de_mayo(self):
        # Obelisco y Plaza de Mayo, en CABA: alrededor de 1,1 km en linea recta.
        d = distancia_km(-34.60373, -58.38157, -34.60832, -58.37030)
        self.assertAlmostEqual(d, 1.14, delta=0.05)

    def test_mismo_punto(self):
        self.assertEqual(distancia_km(-34.6, -58.4, -34.6, -58.4), 0.0)

    def test_radio_filtra_y_ordena(self):
        sucursales = [
            {"id": "lejos", "latitud": -34.70, "longitud": -58.38},
            {"id": "cerca", "latitud": -34.605, "longitud": -58.382},
            {"id": "medio", "latitud": -34.62, "longitud": -58.38},
        ]
        cercanas = sucursales_en_radio(sucursales, -34.60373, -58.38157, 3)
        self.assertEqual([s["id"] for s in cercanas], ["cerca", "medio"])
        self.assertTrue(all("distancia_km" in s for s in cercanas))


class TestContraExhaustiva(unittest.TestCase):
    def test_casos_aleatorios_con_empates(self):
        rng = random.Random(20260910)
        for caso in range(500):
            cantidad_items = rng.randint(1, 5)
            claves = [f"item{i}" for i in range(cantidad_items)]
            items = [{"clave": c, "cantidad": rng.choice([1, 2])} for c in claves]
            sucursales = []
            for s in range(rng.randint(1, 7)):
                precios = {c: rng.choice([1.0, 2.0, 3.0]) for c in claves if rng.random() > 0.25}
                sucursales.append({
                    "id": f"s{s}",
                    "distancia_km": rng.choice([0.5, 1.0, 1.5]),
                    "precios": precios,
                })
            for k in (1, 2, 3):
                with self.subTest(caso=caso, k=k):
                    esperado = exhaustiva(items, sucursales, k)
                    resultado = optimizar_compra(items, sucursales, max_sucursales=3)
                    if esperado is None:
                        self.assertEqual(resultado["opciones"], [])
                        continue
                    obtenido = clave_de_opcion(resultado["opciones"][k - 1])
                    self.assertEqual(obtenido[0], esperado[0], "cobertura")
                    self.assertAlmostEqual(obtenido[1], esperado[1], places=9, msg="total")
                    self.assertAlmostEqual(obtenido[2], esperado[2], places=9, msg="distancia")


class TestEstructura(unittest.TestCase):
    def setUp(self):
        self.items = [
            {"clave": "fideos", "cantidad": 2},
            {"clave": "carne", "cantidad": 1},
            {"clave": "caviar", "cantidad": 1},
        ]
        self.sucursales = [
            {"id": "coto_a", "distancia_km": 0.8, "precios": {"fideos": 100, "carne": 900}},
            {"id": "coto_b", "distancia_km": 1.5, "precios": {"fideos": 100, "carne": 900}},
            {"id": "dia", "distancia_km": 0.3, "precios": {"fideos": 80}},
            {"id": "carni", "distancia_km": 2.0, "precios": {"carne": 700}},
            {"id": "caro", "distancia_km": 2.5, "precios": {"fideos": 120, "carne": 950}},
        ]

    def test_item_sin_precio_queda_afuera(self):
        r = optimizar_compra(self.items, self.sucursales)
        self.assertEqual(r["items_sin_precio"], ["caviar"])
        self.assertTrue(all(o["items_con_precio_en_zona"] == 2 for o in r["opciones"]))

    def test_sucursales_iguales_se_agrupan_en_la_mas_cercana(self):
        r = optimizar_compra(self.items, self.sucursales)
        self.assertEqual(r["sucursales_distintas"], 4)
        una = r["opciones"][0]["sucursales"][0]
        self.assertEqual(una["id"], "coto_a")
        self.assertEqual(una["equivalentes"], 1)

    def test_dominada_se_descarta(self):
        # "caro" es mas cara en todo y esta mas lejos que coto_a.
        r = optimizar_compra(self.items, self.sucursales)
        self.assertEqual(r["sucursales_candidatas"], 3)

    def test_opciones_por_cantidad_de_sucursales(self):
        r = optimizar_compra(self.items, self.sucursales)
        una, dos, tres = r["opciones"]
        # Una sola: coto_a trae todo por 2*100 + 900.
        self.assertEqual((una["total"], una["items_cubiertos"]), (1100, 2))
        # Dos: fideos en dia (160) y carne en carni (700).
        self.assertEqual(dos["total"], 860)
        self.assertEqual(sorted(s["id"] for s in dos["sucursales"]), ["carni", "dia"])
        # Tres no mejora: la opcion no suma una sucursal a la que no se le compra nada.
        self.assertEqual(tres["total"], 860)
        self.assertEqual(len(tres["sucursales"]), 2)

    def test_total_coincide_con_lo_asignado(self):
        r = optimizar_compra(self.items, self.sucursales)
        for opcion in r["opciones"]:
            asignado = sum(i["costo"] for s in opcion["sucursales"] for i in s["items"])
            self.assertAlmostEqual(asignado, opcion["total"])
            self.assertTrue(all(s["items"] for s in opcion["sucursales"]))

    def test_primero_la_cobertura(self):
        # Una sucursal muy barata que trae la mitad no gana a una que trae todo.
        items = [{"clave": "a", "cantidad": 1}, {"clave": "b", "cantidad": 1}]
        sucursales = [
            {"id": "barata_incompleta", "distancia_km": 0.1, "precios": {"a": 1}},
            {"id": "completa", "distancia_km": 3.0, "precios": {"a": 500, "b": 500}},
        ]
        una = optimizar_compra(items, sucursales)["opciones"][0]
        self.assertEqual(una["sucursales"][0]["id"], "completa")
        self.assertEqual(una["items_cubiertos"], 2)

    def test_sin_sucursales(self):
        r = optimizar_compra([{"clave": "a", "cantidad": 1}], [])
        self.assertEqual(r["opciones"], [])
        self.assertEqual(r["items_sin_precio"], ["a"])


class TestRendimiento(unittest.TestCase):
    def test_peor_caso_informado(self):
        """Mide el peor caso: 120 sucursales con precios todos distintos, 25 items.

        Con precios continuos al azar casi ninguna sucursal domina a otra, asi que
        las podas no ayudan y se enumeran C(120, 3) = 280.840 combinaciones. No se
        afirma un tiempo (depende de la maquina); se informa para decidir con un
        numero si hace falta vectorizar.
        """
        rng = random.Random(7)
        claves = [f"i{i}" for i in range(25)]
        items = [{"clave": c, "cantidad": 1} for c in claves]
        sucursales = [
            {
                "id": f"s{s}",
                "distancia_km": rng.uniform(0, 5),
                "precios": {c: rng.uniform(100, 1000) for c in claves if rng.random() > 0.1},
            }
            for s in range(120)
        ]
        inicio = time.perf_counter()
        r = optimizar_compra(items, sucursales)
        segundos = time.perf_counter() - inicio
        print(
            f"\n  peor caso: {r['sucursales_candidatas']} candidatas de "
            f"{r['sucursales_en_zona']}, {segundos:.2f} s"
        )
        self.assertEqual(len(r["opciones"]), 3)
        self.assertNotEqual(r["opciones"][2]["total"], INF)


if __name__ == "__main__":
    unittest.main()
