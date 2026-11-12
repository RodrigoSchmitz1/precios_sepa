"""
Tests de la cadena que falta en el ultimo dia y de Mas barato desde el indice.

    cd api && SIN_BIGQUERY=1 python -m unittest test_cadenas_de_otro_dia -v

El 2026-11-11 el ZIP de SEPA llego sin Cencosud. mart_mismo_producto usa desde
entonces el precio mas reciente de una cadena que falta (fecha_precio) y el sitio
lo avisa. Mas barato nacional se calcula del mismo indice para contar las mismas
cadenas.

El oraculo contra produccion (mismo ganador que mart_quien_gana en un dia
completo) lee las tablas sin cuota y corre solo a pedido:

    cd api && CONTRA_PRODUCCION=1 python -m unittest test_cadenas_de_otro_dia.TestOraculo -v
"""

import os
import unittest

if not os.getenv("CONTRA_PRODUCCION"):
    os.environ.setdefault("SIN_BIGQUERY", "1")

from fastapi.testclient import TestClient

import main
from mismo_producto import MINIMO_OFRECIDOS_QUIEN_GANA, armar_indice, cadenas_de_otro_dia, detalle

ULTIMO = "2026-11-11"


def filas(id_producto, precios, categoria="Yerba mate"):
    """precios = {cadena: (precio, fecha_precio)}; fecha_precio None = columna ausente."""
    valores = [p for p, _ in precios.values()]
    bajo, alto = min(valores), max(valores)
    salida = []
    for cadena, (precio, fecha_precio) in precios.items():
        fila = {
            "id_producto": id_producto,
            "descripcion": "YERBA",
            "marca": "PLAYADITO",
            "categoria": categoria,
            "rubro": "Almacen",
            "cadena": cadena,
            "precio_mediano": precio,
            "precio_minimo": precio,
            "precio_maximo": precio,
            "sucursales": 10,
            "cadenas": len(precios),
            "empresas": len(precios),
            "precio_mas_bajo": bajo,
            "precio_mas_alto": alto,
            "diferencia_pct": round((alto - bajo) / bajo * 100, 1),
            "precio_creible": True,
            "fecha_datos": ULTIMO,
        }
        if fecha_precio is not None:
            fila["fecha_precio"] = fecha_precio
        salida.append(fila)
    return salida


class TestCadenasDeOtroDia(unittest.TestCase):
    def test_dia_completo_no_hay_ninguna(self):
        indice = armar_indice(filas("1", {"Coto": (100, ULTIMO), "Dia": (90, ULTIMO)}))
        self.assertEqual(cadenas_de_otro_dia(indice), {"fecha_datos": ULTIMO, "cadenas": []})

    def test_una_cadena_arrastrada(self):
        indice = armar_indice(filas("1", {"Coto": (100, ULTIMO), "Jumbo": (120, "2026-11-10")}))
        self.assertEqual(cadenas_de_otro_dia(indice)["cadenas"], [{"cadena": "Jumbo", "fecha_precio": "2026-11-10"}])

    def test_tres_cadenas_en_varios_productos_sin_repetir(self):
        ayer = "2026-11-10"
        indice = armar_indice(
            filas("1", {"Coto": (100, ULTIMO), "Jumbo": (120, ayer), "Disco": (125, ayer)})
            + filas("2", {"Coto": (100, ULTIMO), "Vea": (110, ayer), "Jumbo": (130, ayer)})
        )
        self.assertEqual(
            [c["cadena"] for c in cadenas_de_otro_dia(indice)["cadenas"]], ["Disco", "Jumbo", "Vea"]
        )

    def test_sin_la_columna_todo_es_del_dia(self):
        # Ventana entre el deploy de la API y la corrida que agrega la columna.
        indice = armar_indice(filas("1", {"Coto": (100, None), "Dia": (90, None)}))
        self.assertEqual(cadenas_de_otro_dia(indice)["cadenas"], [])
        self.assertEqual({p["fecha_precio"] for p in indice["1"]["precios"]}, {ULTIMO})

    def test_el_detalle_trae_la_fecha_de_cada_precio(self):
        indice = armar_indice(filas("1", {"Coto": (100, ULTIMO), "Jumbo": (120, "2026-11-10")}))
        fechas = {p["cadena"]: p["fecha_precio"] for p in detalle(indice, "1")["precios"]}
        self.assertEqual(fechas, {"Coto": ULTIMO, "Jumbo": "2026-11-10"})

    def test_indice_vacio(self):
        self.assertEqual(cadenas_de_otro_dia({}), {"fecha_datos": None, "cadenas": []})


N = MINIMO_OFRECIDOS_QUIEN_GANA


class TestEndpoints(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)
        self.original = main._indice_mismo_producto
        # Jumbo falto el ultimo dia y se arrastra: es la mas barata en Yerba.
        productos = []
        for i in range(N):
            productos += filas(f"y{i}", {"Coto": (100, ULTIMO), "Jumbo": (80, "2026-11-10")})
            productos += filas(f"a{i}", {"Coto": (100, ULTIMO), "Dia": (90, ULTIMO)}, categoria="Arroz")
        indice = armar_indice(productos)
        main._indice_mismo_producto = lambda: indice
        main._quien_gana_nacional_guardado.clear()

    def tearDown(self):
        main._indice_mismo_producto = self.original
        main._quien_gana_nacional_guardado.clear()

    def test_cadenas_de_otro_dia(self):
        r = self.cliente.get("/api/datos/cadenas-de-otro-dia")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"fecha_datos": ULTIMO, "cadenas": [{"cadena": "Jumbo", "fecha_precio": "2026-11-10"}]})

    def test_quien_gana_cuenta_la_cadena_arrastrada(self):
        r = self.cliente.get("/api/quien-gana")
        self.assertEqual(r.status_code, 200)
        ganadores = {(f["categoria"], f["cadena"]) for f in r.json()}
        self.assertEqual(ganadores, {("Yerba mate", "Jumbo"), ("Arroz", "Dia")})
        columnas = {
            "categoria", "rubro", "cadena", "productos_ganados", "productos_ofrecidos",
            "total_productos_categoria", "pct_gana_cuando_compite", "pct_victorias",
        }
        self.assertEqual(set(r.json()[0]), columnas)

    def test_quien_gana_filtra_por_categoria(self):
        r = self.cliente.get("/api/quien-gana", params={"categoria": "Arroz"})
        self.assertEqual([f["cadena"] for f in r.json()], ["Dia"])

    def test_categorias(self):
        self.assertEqual(self.cliente.get("/api/quien-gana/categorias").json(), ["Arroz", "Yerba mate"])


@unittest.skipUnless(os.getenv("CONTRA_PRODUCCION"), "lee produccion; correr con CONTRA_PRODUCCION=1")
class TestOraculo(unittest.TestCase):
    """En un dia sin cadenas arrastradas, /quien-gana desde el indice tiene que
    dar lo mismo que mart_quien_gana. Si difieren, la regla cambio de un lado y
    no del otro. Lee con leer_tabla (Storage Read API): no consume cuota."""

    def test_coincide_con_mart_quien_gana(self):
        indice = main._indice_mismo_producto()
        if cadenas_de_otro_dia(indice)["cadenas"]:
            self.skipTest("hoy hay cadenas arrastradas: el mart no las tiene")
        fecha = cadenas_de_otro_dia(indice)["fecha_datos"]
        mart = {
            (f["categoria"], f["cadena"]): f
            for f in main.leer_tabla(f"{main.PROYECTO}.dbt_precios.mart_quien_gana")
            if str(f["fecha_datos"]) == fecha
        }
        self.assertTrue(mart, f"mart_quien_gana no tiene {fecha}")
        api = {(f["categoria"], f["cadena"]): f for f in main._quien_gana_nacional()}
        self.assertEqual(set(api), set(mart))
        for clave, fila in api.items():
            for campo in ("productos_ganados", "productos_ofrecidos", "total_productos_categoria"):
                self.assertEqual(fila[campo], mart[clave][campo], f"{clave} {campo}")
            # Una decima de tolerancia: ROUND de BigQuery redondea los ,x5 hacia
            # afuera y round de Python al par (Cerveza/Dia: 26,2 contra 26,3).
            # Los conteos de arriba son exactos, asi que la tasa es la misma.
            self.assertAlmostEqual(
                fila["pct_gana_cuando_compite"], float(mart[clave]["pct_gana_cuando_compite"]),
                delta=0.11, msg=f"{clave} pct_gana_cuando_compite",
            )


if __name__ == "__main__":
    unittest.main()
