"""
Tests de la vidriera de Promos y del filtro de rubro (openspec
promos-navegables-y-mes-en-gastos), sin BigQuery.

    cd api && SIN_BIGQUERY=1 python -m unittest test_vidriera -v
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient

import main
from mapa_promos import (
    MAXIMO_POR_CADENA_FUERTES,
    PROMOS_POR_FILA,
    armar_indice,
    buscar,
    slug_rubro,
    vidriera,
)
from test_mapa_promos import sucursal

CENTRO = (-34.580, -58.420)
HOY = "2026-11-23"


def suc(clave, cadena, lat=-34.582, formato=None):
    s = sucursal(clave, lat, -58.420, cadena=cadena)
    if formato:
        s["formato"] = formato
    return s


def promo(id_producto, descuento, sucursales, rubro="Almacen", evidencia="leyenda", **extra):
    return {
        "id_producto": id_producto,
        "descripcion": f"PRODUCTO {id_producto}",
        "marca": "MARCA",
        "categoria": "Aceites",
        "rubro": rubro,
        "precio_lista": 1000.0,
        "precio_promo": round(1000 * (1 - descuento / 100), 2),
        "descuento_pct": descuento,
        "leyenda": "Vigencia desde el 10/11/2026 al 30/11/2026",
        "nivel_evidencia": evidencia,
        "sucursales": sucursales,
        **extra,
    }


# Ocho sucursales de Dia cerca, una de Carrefour cerca, una de Carrefour lejos
# (~11 km) y una farmacia cerca.
DIAS = [suc(f"15-{n}", "Dia") for n in range(8)]
SUCURSALES = DIAS + [
    suc("10-1", "Carrefour"),
    suc("10-9", "Carrefour", lat=-34.680),
    suc("90-1", "Farmacity", formato="farmacia"),
]
TODAS_DIA = [s["sucursal"] for s in DIAS]


class TestPromosFuertes(unittest.TestCase):
    def test_la_crema_de_una_sucursal_no_le_gana_al_aceite_de_ocho(self):
        indice = armar_indice(SUCURSALES, [
            promo("crema", 70.0, ["10-1"], rubro="Perfumeria"),
            promo("aceite", 35.0, TODAS_DIA),
        ] + [promo(f"otro{n}", 20.0, TODAS_DIA[:2]) for n in range(2)])
        fuertes = [f["id_producto"] for f in vidriera(indice, *CENTRO, hoy=HOY)["fuertes"]]
        # La crema tiene el mayor descuento pero va despues de todas las que
        # estan en varias sucursales: solo completa si no alcanzan.
        self.assertEqual(fuertes, ["aceite", "otro0", "otro1", "crema"])

    def test_si_no_alcanzan_completan_las_de_una_sucursal(self):
        indice = armar_indice(SUCURSALES, [promo("crema", 70.0, ["10-1"]), promo("aceite", 35.0, TODAS_DIA)])
        fuertes = [f["id_producto"] for f in vidriera(indice, *CENTRO, hoy=HOY)["fuertes"]]
        self.assertEqual(fuertes, ["aceite", "crema"])

    def test_un_2x1_no_es_promo_fuerte(self):
        indice = armar_indice(SUCURSALES, [
            promo("2x1", 70.0, TODAS_DIA, requiere_compra_multiple=True),
            promo("aceite", 35.0, TODAS_DIA),
        ])
        fuertes = [f["id_producto"] for f in vidriera(indice, *CENTRO, hoy=HOY)["fuertes"]]
        self.assertEqual(fuertes, ["aceite"])

    def test_sin_verificar_no_es_promo_fuerte(self):
        indice = armar_indice(SUCURSALES, [promo("dudosa", 60.0, TODAS_DIA, evidencia="sin_verificar")])
        self.assertEqual(vidriera(indice, *CENTRO, hoy=HOY)["fuertes"], [])

    def test_una_cadena_no_copa_la_vidriera(self):
        sucs = [suc(f"10-{n}", "Carrefour") for n in range(2, 4)]
        indice = armar_indice(SUCURSALES + sucs, [
            promo(f"c{n}", 60.0 - n, ["10-2", "10-3"]) for n in range(10)
        ] + [promo("aceite", 10.0, TODAS_DIA)])
        fuertes = vidriera(indice, *CENTRO, hoy=HOY)["fuertes"]
        self.assertEqual(sum(f["cadena"] == "Carrefour" for f in fuertes), MAXIMO_POR_CADENA_FUERTES)
        self.assertIn("aceite", [f["id_producto"] for f in fuertes])

    def test_un_producto_una_sola_vez(self):
        indice = armar_indice(SUCURSALES, [promo("aceite", 35.0, TODAS_DIA), promo("aceite", 30.0, TODAS_DIA[:3])])
        fuertes = [f["id_producto"] for f in vidriera(indice, *CENTRO, hoy=HOY)["fuertes"]]
        self.assertEqual(fuertes, ["aceite"])

    def test_una_promo_vencida_no_aparece(self):
        vencida = promo("vencida", 50.0, TODAS_DIA, leyenda="Vigencia desde el 10/11/2026 al 20/11/2026")
        indice = armar_indice(SUCURSALES, [vencida])
        r = vidriera(indice, *CENTRO, hoy=HOY)
        self.assertEqual((r["fuertes"], r["total"]), ([], 0))

    def test_la_fila_trae_la_sucursal_mas_cercana_y_el_total(self):
        sucs = [suc("15-50", "Dia", lat=-34.590), suc("15-51", "Dia", lat=-34.5801)]
        indice = armar_indice(sucs, [promo("aceite", 35.0, ["15-50", "15-51"])])
        f = vidriera(indice, *CENTRO, hoy=HOY)["fuertes"][0]
        self.assertEqual(f["nombre_sucursal"], "Sucursal 15-51")
        self.assertEqual(f["total_sucursales"], 2)
        self.assertEqual(len(f["sucursales"]), 1)
        self.assertEqual(f["vigente_hasta"], "2026-11-30")


class TestFilas(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(SUCURSALES, [
            promo("aceite", 35.0, TODAS_DIA),
            promo("arroz", 20.0, TODAS_DIA[:2]),
            promo("lavandina", 25.0, ["10-1"], rubro="Limpieza"),
            promo("lejos", 40.0, ["10-9"], rubro="Limpieza"),
            promo("shampoo", 30.0, ["90-1"], rubro="Perfumeria"),
            promo("sin rubro", 10.0, ["15-1"], rubro=None),
        ] + [promo(f"a{n}", 5.0 + n, ["15-2"]) for n in range(6)])

    def test_filas_por_rubro_de_mas_a_menos_promos(self):
        r = vidriera(self.indice, *CENTRO, hoy=HOY)
        rubros = [(c["rubro"], c["cantidad"]) for c in r["categorias"]]
        self.assertEqual(rubros[0], ("Almacen", 8))
        self.assertIn(("Limpieza", 1), rubros)
        self.assertIn(("Otros", 1), rubros)
        almacen = r["categorias"][0]
        self.assertEqual(len(almacen["promos"]), PROMOS_POR_FILA)
        # El mismo orden que la pagina: en mas sucursales primero.
        self.assertEqual([p["id_producto"] for p in almacen["promos"]][:2], ["aceite", "arroz"])
        self.assertEqual(almacen["slug"], "almacen")

    def test_filas_por_cadena_sin_farmacias(self):
        r = vidriera(self.indice, *CENTRO, hoy=HOY)
        self.assertNotIn("Farmacity", [c["cadena"] for c in r["cadenas"]])

    def test_las_que_casi_no_informan_se_nombran_y_no_tienen_fila(self):
        # Carrefour tiene 1 promo cerca y casi no informa (menos de 50 por sucursal).
        r = vidriera(self.indice, *CENTRO, hoy=HOY)
        self.assertIn("Carrefour", r["poco_informan"])
        self.assertNotIn("Carrefour", [c["cadena"] for c in r["cadenas"]])

    def test_sin_zona_usa_todo_el_pais(self):
        r = vidriera(self.indice, hoy=HOY)
        self.assertFalse(r["con_zona"])
        self.assertIn(("Limpieza", 2), [(c["rubro"], c["cantidad"]) for c in r["categorias"]])

    def test_la_tabla_trae_las_sucursales_de_las_filas(self):
        r = vidriera(self.indice, *CENTRO, hoy=HOY)
        for f in r["fuertes"]:
            self.assertIn(str(f["sucursales"][0]), r["sucursales"])


class TestFiltroDeRubro(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(SUCURSALES, [
            promo("aceite", 35.0, TODAS_DIA),
            promo("lavandina", 25.0, ["10-1"], rubro="Limpieza"),
            promo("lechuga", 15.0, ["15-1"], rubro="Verduleria y frutas"),
            promo("sin rubro", 10.0, ["15-1"], rubro=None),
        ])

    def test_slug(self):
        self.assertEqual(slug_rubro("Verduleria y frutas"), "verduleria-y-frutas")
        self.assertEqual(slug_rubro("Almacén"), "almacen")

    def test_solo_el_rubro_pedido(self):
        filas, _ = buscar(self.indice, rubro="limpieza")
        self.assertEqual([f["id_producto"] for f in filas], ["lavandina"])
        filas, _ = buscar(self.indice, rubro="verduleria-y-frutas")
        self.assertEqual([f["id_producto"] for f in filas], ["lechuga"])
        filas, _ = buscar(self.indice, rubro="Otros")
        self.assertEqual([f["id_producto"] for f in filas], ["sin rubro"])

    def test_sin_rubro_no_cambia_nada(self):
        filas, _ = buscar(self.indice)
        self.assertEqual(len(filas), 4)

    def test_cerca_de_es_el_circulo_de_la_vidriera_y_sin_vencidas(self):
        sucs = SUCURSALES + [suc("15-90", "Dia", lat=-34.555)]  # ~2,8 km al norte: adentro
        vencida = promo("vencida", 50.0, ["15-1"], rubro="Limpieza", leyenda="Vigencia desde el 10/11/2026 al 20/11/2026")
        indice = armar_indice(sucs, [
            promo("lavandina", 25.0, ["10-1"], rubro="Limpieza"),
            promo("lejos", 40.0, ["10-9"], rubro="Limpieza"),
            promo("norte", 30.0, ["15-90"], rubro="Limpieza"),
            vencida,
        ])
        filas, _ = buscar(indice, rubro="limpieza", cerca_de=CENTRO, hoy=HOY)
        self.assertEqual(sorted(f["id_producto"] for f in filas), ["lavandina", "norte"])
        fila = next(c for c in vidriera(indice, *CENTRO, hoy=HOY)["categorias"] if c["slug"] == "limpieza")
        self.assertEqual(fila["cantidad"], len(filas))

    def test_rubro_con_busqueda(self):
        filas, _ = buscar(self.indice, rubro="almacen", busqueda="aceite")
        self.assertEqual([f["id_producto"] for f in filas], ["aceite"])
        filas, _ = buscar(self.indice, rubro="limpieza", busqueda="aceite")
        self.assertEqual(filas, [])


class TestEndpoint(unittest.TestCase):
    def setUp(self):
        self.cliente = TestClient(main.app)
        self.original = main._indice_mapa
        indice = armar_indice(SUCURSALES, [promo("aceite", 35.0, TODAS_DIA), promo("lavandina", 25.0, ["10-1"], rubro="Limpieza")])
        main._indice_mapa = lambda: indice
        main._vidriera_nacional.clear()

    def tearDown(self):
        main._indice_mapa = self.original

    def test_vidriera_con_zona_sin_bigquery(self):
        with mock.patch.object(main, "cliente_bq") as bq:
            r = self.cliente.get("/api/promos/vidriera", params={"latitud": CENTRO[0], "longitud": CENTRO[1]})
            bq.query.assert_not_called()
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["con_zona"])
        self.assertEqual(r.json()["fuertes"][0]["id_producto"], "aceite")

    def test_vidriera_sin_zona(self):
        r = self.cliente.get("/api/promos/vidriera")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["con_zona"])

    def test_mapa_con_rubro(self):
        r = self.cliente.get("/api/promos/mapa", params={"rubro": "limpieza"})
        self.assertEqual([p["id_producto"] for p in r.json()["promos"]], ["lavandina"])


if __name__ == "__main__":
    unittest.main()
