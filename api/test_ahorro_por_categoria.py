"""
Tests de cuanto conviene comparar (ahorro_por_categoria), sin BigQuery.

    cd api && python -m unittest test_ahorro_por_categoria -v

Los productos se arman directamente como los deja armar_indice, para poder
fijar el precio de referencia (la mediana entre empresas del mart).
"""

import unittest

from mismo_producto import MINIMO_PRODUCTOS_CATEGORIA, ahorro_por_categoria

EMPRESA_DE = {"Carrefour": 10, "Maxi": 10, "Changomas": 11, "SuperChangomas": 11, "Coto": 12, "Dia": 15}


def producto(i, precios, referencia, categoria="Yerba", empresas=3, respaldado=True, no_creibles=()):
    creibles = [v for c, v in precios.items() if c not in no_creibles]
    return str(i), {
        "id_producto": str(i),
        "categoria": categoria,
        "empresas": empresas,
        "extremos_respaldados": respaldado,
        "precio_referencia": referencia,
        "precio_mas_bajo": min(creibles),
        "fecha_datos": "2026-10-26",
        "precios": [
            {"cadena": c, "precio_mediano": v, "precio_creible": c not in no_creibles} for c, v in precios.items()
        ],
    }


def indice(*productos):
    return dict(productos)


class TestAhorro(unittest.TestCase):
    def test_ahorro_contra_el_precio_tipico(self):
        filas = [producto(i, {"Coto": 90, "Dia": 100, "Carrefour": 110}, 100) for i in range(MINIMO_PRODUCTOS_CATEGORIA)]
        r = ahorro_por_categoria(indice(*filas), EMPRESA_DE)
        self.assertEqual(r["productos"], MINIMO_PRODUCTOS_CATEGORIA)
        self.assertEqual(r["categorias"][0]["ahorro_mediano_pct"], 10.0)
        self.assertEqual(r["categorias"][0]["cadena_mas_barata"], "Coto")

    def test_un_empate_en_la_cadena_mas_barata_nombra_a_las_dos(self):
        # Auditoria 2026-10-28: el empate se resolvia por orden alfabetico y la
        # fila mostraba una sola cadena.
        filas = [producto(i, {"Coto": 90, "Dia": 90, "Carrefour": 110}, 100) for i in range(MINIMO_PRODUCTOS_CATEGORIA)]
        r = ahorro_por_categoria(indice(*filas), EMPRESA_DE)
        self.assertEqual(r["categorias"][0]["cadenas_mas_baratas"], ["Coto", "Dia"])

    def test_la_mediana_no_el_extremo(self):
        # Un producto con 60% de ahorro (un error de carga, probablemente) no mueve
        # la cifra de la categoria.
        filas = [producto(i, {"Coto": 95, "Dia": 100, "Carrefour": 105}, 100) for i in range(MINIMO_PRODUCTOS_CATEGORIA)]
        filas.append(producto(99, {"Coto": 40, "Dia": 100, "Carrefour": 105}, 100))
        r = ahorro_por_categoria(indice(*filas), EMPRESA_DE)
        self.assertEqual(r["categorias"][0]["ahorro_mediano_pct"], 5.0)

    def test_categoria_con_pocos_productos_no_se_publica(self):
        filas = [producto(i, {"Coto": 90, "Dia": 100}, 100) for i in range(MINIMO_PRODUCTOS_CATEGORIA - 1)]
        r = ahorro_por_categoria(indice(*filas), EMPRESA_DE)
        self.assertEqual(r["categorias"], [])
        # Pero cuenta para el total y para quien tiene el precio mas bajo.
        self.assertEqual(r["productos"], MINIMO_PRODUCTOS_CATEGORIA - 1)

    def test_solo_productos_comparables(self):
        filas = [
            producto(1, {"Coto": 50, "Dia": 100}, 100, empresas=2),
            producto(2, {"Coto": 50, "Dia": 100}, 100, respaldado=False),
            producto(3, {"Coto": 50, "Dia": 100}, None),
        ]
        self.assertEqual(ahorro_por_categoria(indice(*filas), EMPRESA_DE)["productos"], 0)

    def test_un_empate_cuenta_para_las_dos(self):
        filas = [producto(1, {"Coto": 90, "Dia": 90, "Carrefour": 100}, 100)]
        r = ahorro_por_categoria(indice(*filas), EMPRESA_DE)
        self.assertEqual({c["cadena"]: c["pct"] for c in r["mas_baratas"]}, {"Coto": 100.0, "Dia": 100.0})

    def test_un_precio_no_creible_no_es_el_mas_barato(self):
        filas = [producto(1, {"Coto": 10, "Dia": 95, "Carrefour": 100}, 100, no_creibles=("Coto",))]
        r = ahorro_por_categoria(indice(*filas), EMPRESA_DE)
        self.assertEqual([c["cadena"] for c in r["mas_baratas"]], ["Dia"])


class TestReglas(unittest.TestCase):
    def armar(self, cociente_maxi):
        """200 productos: Maxi = Carrefour x cociente_maxi(i); Coto y Dia de relleno."""
        filas = []
        for i in range(200):
            carrefour = 1000 + i
            filas.append(
                producto(i, {"Carrefour": carrefour, "Maxi": round(carrefour * cociente_maxi(i)), "Coto": carrefour, "Dia": carrefour + 50}, carrefour)
            )
        return indice(*filas)

    def test_detecta_los_escalones_contra_la_hermana(self):
        # Mitad igual, un 30% a -5%, un 20% a -10%.
        r = ahorro_por_categoria(self.armar(lambda i: 1 if i < 100 else 0.95 if i < 160 else 0.90), EMPRESA_DE)
        regla = next(g for g in r["reglas"] if g["cadena"] == "Maxi")
        self.assertEqual(regla["referencia"], "Carrefour")
        self.assertEqual((regla["pct_igual"], regla["pct_mas_barata"], regla["pct_mas_cara"]), (50.0, 50.0, 0.0))
        self.assertEqual(
            regla["escalones"],
            [{"descuento_pct": 5, "pct_productos": 30.0}, {"descuento_pct": 10, "pct_productos": 20.0}],
        )

    def test_sin_regla_si_a_veces_es_mas_cara(self):
        r = ahorro_por_categoria(self.armar(lambda i: 0.95 if i % 2 else 1.10), EMPRESA_DE)
        self.assertEqual([g for g in r["reglas"] if g["cadena"] == "Maxi"], [])

    def test_las_reglas_solo_entre_banderas_de_la_misma_empresa(self):
        # Maxi mas barata que Coto siempre, pero Coto es otra empresa: no es regla.
        r = ahorro_por_categoria(self.armar(lambda i: 0.95), {"Maxi": 10, "Coto": 12, "Dia": 15})
        self.assertEqual(r["reglas"], [])


if __name__ == "__main__":
    unittest.main()


class TestNiveles(unittest.TestCase):
    def test_media_geometrica_de_los_cocientes(self):
        from mismo_producto import niveles_por_cadena

        # Coto: una vez al doble y una a la mitad del precio tipico -> nivel 1.
        filas = [producto(i, {"Coto": 200 if i % 2 else 50, "Dia": 100}, 100, empresas=2) for i in range(6)]
        n = niveles_por_cadena(indice(*filas))
        self.assertAlmostEqual(n["general"]["Coto"], 1.0)
        self.assertAlmostEqual(n["por_categoria"][("Dia", "Yerba")], 1.0)

    def test_pocos_productos_o_una_sola_empresa_no_alcanzan(self):
        from mismo_producto import MINIMO_PRODUCTOS_NIVEL, niveles_por_cadena

        pocos = [producto(i, {"Coto": 90, "Dia": 100}, 100, empresas=2) for i in range(MINIMO_PRODUCTOS_NIVEL - 1)]
        una = [producto(100 + i, {"Coto": 90}, 90, empresas=1) for i in range(10)]
        n = niveles_por_cadena(indice(*pocos, *una))
        self.assertNotIn("Coto", n["general"])

    def test_un_precio_no_creible_no_cuenta(self):
        from mismo_producto import niveles_por_cadena

        filas = [producto(i, {"Coto": 10, "Dia": 100}, 100, empresas=2, no_creibles=("Coto",)) for i in range(6)]
        self.assertNotIn("Coto", niveles_por_cadena(indice(*filas))["general"])
