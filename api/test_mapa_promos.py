"""
Tests del mapa de promos en memoria, sin BigQuery.

    cd api && python -m unittest test_mapa_promos -v
"""

import unittest

from mapa_promos import armar_indice, buscar


def sucursal(clave, latitud, longitud, provincia="AR-B", cadena="Coto"):
    return {
        "sucursal": clave,
        "cadena": cadena,
        "nombre_sucursal": f"Sucursal {clave}",
        "calle": "Calle",
        "numero": "1",
        "barrio": None,
        "localidad": "Localidad",
        "provincia": provincia,
        "latitud": latitud,
        "longitud": longitud,
    }


def promo(descripcion, descuento, sucursales, precio_lista=1000.0):
    return {
        "descripcion": descripcion,
        "marca": "MARCA",
        "categoria": "Lacteos",
        "rubro": "Almacen",
        "precio_lista": precio_lista,
        "precio_promo": round(precio_lista * (1 - descuento / 100), 2),
        "descuento_pct": descuento,
        "leyenda": "Promo",
        "sucursales": sucursales,
    }


SUCURSALES = [
    sucursal("10-1", -34.60, -58.40),
    sucursal("10-2", -34.70, -58.50),
    sucursal("15-1", -31.40, -64.18, provincia="AR-X", cadena="Dia"),
]
PROMOS = [
    promo("LECHE ENTERA 1 L", 20.0, ["15-1", "10-2", "10-1"]),
    promo("YERBA MATE 1 KG", 45.0, ["10-2"]),
    promo("Leche descremada", 30.0, ["15-1"]),
    promo("GASEOSA COLA 2 L", 15.0, ["10-1", "99-9"]),
    promo("PRODUCTO DE UNA SUCURSAL QUE YA NO ESTA", 60.0, ["99-9"]),
]


def resumen(filas):
    return [(f["descripcion"], f["nombre_sucursal"]) for f in filas]


class TestMapaPromos(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(SUCURSALES, PROMOS)

    def test_una_fila_por_sucursal_de_mayor_a_menor_descuento(self):
        filas, hay_mas = buscar(self.indice)
        self.assertEqual([f["descuento_pct"] for f in filas], [45.0, 30.0, 20.0, 20.0, 20.0, 15.0])
        self.assertFalse(hay_mas)
        # Con el mismo descuento, las sucursales salen siempre en el mismo orden.
        self.assertEqual(
            [f["nombre_sucursal"] for f in filas[2:5]], ["Sucursal 10-1", "Sucursal 10-2", "Sucursal 15-1"]
        )

    def test_devuelve_los_mismos_campos_que_la_consulta_que_reemplaza(self):
        filas, _ = buscar(self.indice, limite=1)
        self.assertEqual(
            list(filas[0]),
            [
                "descripcion", "marca", "categoria", "rubro", "cadena", "nombre_sucursal", "calle", "numero",
                "barrio", "localidad", "provincia", "latitud", "longitud", "precio_lista", "precio_promo",
                "descuento_pct", "leyenda",
            ],
        )
        self.assertEqual(filas[0]["cadena"], "Coto")

    def test_limite_y_hay_mas(self):
        filas, hay_mas = buscar(self.indice, limite=2)
        self.assertEqual([f["descuento_pct"] for f in filas], [45.0, 30.0])
        self.assertTrue(hay_mas)
        self.assertFalse(buscar(self.indice, limite=6)[1])

    def test_el_recuadro_incluye_los_bordes(self):
        filas, _ = buscar(self.indice, lat_min=-34.70, lat_max=-34.60, lng_min=-58.50, lng_max=-58.40)
        self.assertEqual(
            resumen(filas),
            [
                ("YERBA MATE 1 KG", "Sucursal 10-2"),
                ("LECHE ENTERA 1 L", "Sucursal 10-1"),
                ("LECHE ENTERA 1 L", "Sucursal 10-2"),
                ("GASEOSA COLA 2 L", "Sucursal 10-1"),
            ],
        )

    def test_un_eje_con_un_solo_limite_no_filtra(self):
        self.assertEqual(len(buscar(self.indice, lat_min=0.0)[0]), 6)

    def test_zona_sin_sucursales(self):
        self.assertEqual(buscar(self.indice, lat_min=10.0, lat_max=11.0, lng_min=10.0, lng_max=11.0), ([], False))

    def test_busqueda_sin_distinguir_mayusculas_y_combinada_con_el_recuadro(self):
        self.assertEqual([f["descuento_pct"] for f in buscar(self.indice, busqueda="leche")[0]], [30.0, 20.0, 20.0, 20.0])
        filas, _ = buscar(self.indice, busqueda="LECHE", lat_min=-35.0, lat_max=-34.0, lng_min=-59.0, lng_max=-58.0)
        self.assertEqual(resumen(filas), [("LECHE ENTERA 1 L", "Sucursal 10-1"), ("LECHE ENTERA 1 L", "Sucursal 10-2")])

    def test_con_y_sin_busqueda_dan_el_mismo_orden(self):
        # Son dos caminos distintos en buscar(); una letra que esta en todas las
        # descripciones tiene que devolver exactamente lo mismo que no buscar.
        for limite in (1, 3, 6, 100):
            self.assertEqual(buscar(self.indice, busqueda="e", limite=limite), buscar(self.indice, limite=limite))

    def test_provincia(self):
        filas, _ = buscar(self.indice, provincia="AR-X")
        self.assertEqual([(f["descuento_pct"], f["cadena"]) for f in filas], [(30.0, "Dia"), (20.0, "Dia")])

    def test_ignora_sucursales_que_no_estan_en_el_mart_de_sucursales(self):
        filas, _ = buscar(self.indice)
        self.assertNotIn("PRODUCTO DE UNA SUCURSAL QUE YA NO ESTA", [f["descripcion"] for f in filas])
        self.assertEqual(len([f for f in filas if f["descripcion"] == "GASEOSA COLA 2 L"]), 1)


if __name__ == "__main__":
    unittest.main()
