"""
Tests del mapa de promos en memoria, sin BigQuery.

    cd api && python -m unittest test_mapa_promos -v
"""

import unittest

from mapa_promos import armar_indice, buscar, lugares, tabla_de_sucursales


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
        "nivel_evidencia": "mercado",
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


def resumen(filas, indice):
    """Promo y las sucursales de la zona donde vale. Desde 2026-09-23 buscar()
    devuelve una fila por PROMO, con los NUMEROS de sus sucursales."""
    return [(f["descripcion"], [indice.sucursales[s]["nombre_sucursal"] for s in f["sucursales"]]) for f in filas]


class TestMapaPromos(unittest.TestCase):
    def setUp(self):
        self.indice = armar_indice(SUCURSALES, PROMOS)

    def test_una_fila_por_promo_de_mayor_a_menor_descuento(self):
        # Una promo que esta en varias sucursales ocupa UNA fila, con la lista
        # de sucursales adentro. Antes ocupaba una por local y el listado se
        # llenaba con la misma promo repetida.
        filas, hay_mas = buscar(self.indice)
        self.assertEqual([f["descuento_pct"] for f in filas], [45.0, 30.0, 20.0, 15.0])
        self.assertFalse(hay_mas)
        # La leche entera esta en tres sucursales y ocupa una sola fila.
        self.assertEqual(
            resumen(filas, self.indice)[2],
            ("LECHE ENTERA 1 L", ["Sucursal 10-1", "Sucursal 10-2", "Sucursal 15-1"]),
        )

    def test_la_promo_informa_en_cuantas_sucursales_esta(self):
        filas, _ = buscar(self.indice)
        leche = next(f for f in filas if f["descripcion"] == "LECHE ENTERA 1 L")
        self.assertEqual(leche["total_sucursales"], 3)
        self.assertEqual(len(leche["sucursales"]), 3)

    def test_los_campos_sueltos_son_los_de_la_primera_sucursal(self):
        # La fila muestra una direccion sin abrir nada; tiene que ser la primera
        # de la zona y no una cualquiera, para que no cambie entre pedidos.
        filas, _ = buscar(self.indice)
        leche = next(f for f in filas if f["descripcion"] == "LECHE ENTERA 1 L")
        self.assertEqual(leche["nombre_sucursal"], self.indice.sucursales[leche["sucursales"][0]]["nombre_sucursal"])

    def test_la_tabla_trae_cada_sucursal_una_sola_vez(self):
        # La leche esta en tres sucursales y otras promos comparten algunas: la
        # tabla no las repite, que es lo que achica la respuesta.
        filas, _ = buscar(self.indice)
        tabla = tabla_de_sucursales(self.indice, filas)
        usadas = {s for f in filas for s in f["sucursales"]}
        self.assertEqual(set(tabla), {str(s) for s in usadas})
        self.assertEqual(tabla[str(filas[0]["sucursales"][0])]["nombre_sucursal"], filas[0]["nombre_sucursal"])

    def test_no_hay_tope_de_sucursales(self):
        filas, _ = buscar(self.indice)
        for f in filas:
            self.assertEqual(len(f["sucursales"]), f["total_sucursales"])

    def test_devuelve_los_mismos_campos_que_la_consulta_que_reemplaza(self):
        filas, _ = buscar(self.indice, limite=1)
        self.assertEqual(
            list(filas[0]),
            [
                "descripcion", "marca", "categoria", "rubro", "cadena", "nombre_sucursal", "calle", "numero",
                "barrio", "localidad", "provincia", "latitud", "longitud", "precio_lista", "precio_promo",
                "descuento_pct", "leyenda", "nivel_evidencia", "sucursales", "total_sucursales",
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
            resumen(filas, self.indice),
            [
                ("YERBA MATE 1 KG", ["Sucursal 10-2"]),
                ("LECHE ENTERA 1 L", ["Sucursal 10-1", "Sucursal 10-2"]),
                ("GASEOSA COLA 2 L", ["Sucursal 10-1"]),
            ],
        )

    def test_un_eje_con_un_solo_limite_no_filtra(self):
        self.assertEqual(len(buscar(self.indice, lat_min=0.0)[0]), 4)

    def test_zona_sin_sucursales(self):
        self.assertEqual(buscar(self.indice, lat_min=10.0, lat_max=11.0, lng_min=10.0, lng_max=11.0), ([], False))

    def test_busqueda_sin_distinguir_mayusculas_y_combinada_con_el_recuadro(self):
        self.assertEqual([f["descuento_pct"] for f in buscar(self.indice, busqueda="leche")[0]], [30.0, 20.0])
        filas, _ = buscar(self.indice, busqueda="LECHE", lat_min=-35.0, lat_max=-34.0, lng_min=-59.0, lng_max=-58.0)
        self.assertEqual(resumen(filas, self.indice), [("LECHE ENTERA 1 L", ["Sucursal 10-1", "Sucursal 10-2"])])

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


def sucursal_en(sucursal, localidad, provincia, lat, lng, barrio=None):
    return {
        "sucursal": sucursal, "cadena": "Coto", "nombre_sucursal": sucursal, "calle": "", "numero": "",
        "barrio": barrio, "localidad": localidad, "provincia": provincia, "latitud": lat, "longitud": lng,
    }


class TestLugares(unittest.TestCase):
    """Casos reales del 2026-09-23: las 8 sucursales de Moreno se repartian en
    10.745 km por una coordenada rota, "BUENOS AIRES" era una provincia cargada
    como localidad, y en CABA la localidad es "Capital Federal" para todo."""

    def indice(self, sucursales):
        return armar_indice(sucursales, [])

    def test_una_coordenada_rota_no_mueve_el_centro(self):
        moreno = [sucursal_en(f"m{i}", "Moreno", "AR-B", -34.65 + i * 0.001, -58.79) for i in range(7)]
        moreno.append(sucursal_en("m7", "Moreno", "AR-B", 40.0, 120.0))  # en otro continente
        (lugar,) = lugares(self.indice(moreno))
        self.assertAlmostEqual(lugar["latitud"], -34.647, places=2)
        self.assertEqual(lugar["sucursales"], 8)

    def test_una_provincia_disfrazada_de_localidad_no_se_ofrece(self):
        provincia = [sucursal_en(f"b{i}", "BUENOS AIRES", "AR-B", -34.0 - i * 0.8, -58.0 - i * 0.5) for i in range(6)]
        self.assertEqual(lugares(self.indice(provincia)), [])

    def test_en_caba_se_puede_buscar_el_barrio(self):
        caba = [sucursal_en(f"c{i}", "CAPITAL FEDERAL", "AR-C", -34.58, -58.42, barrio="PALERMO") for i in range(3)]
        nombres = {l["nombre"] for l in lugares(self.indice(caba))}
        self.assertIn("Palermo", nombres)
        self.assertIn("Capital Federal", nombres)

    def test_si_barrio_y_localidad_coinciden_no_cuenta_dos_veces(self):
        mismo = [sucursal_en(f"s{i}", "SALTA", "AR-A", -24.78, -65.41, barrio="SALTA") for i in range(4)]
        (lugar,) = lugares(self.indice(mismo))
        self.assertEqual(lugar["sucursales"], 4)

    def test_el_mismo_lugar_sin_provincia_se_fusiona(self):
        con = [sucursal_en(f"a{i}", "SALTA", "AR-A", -24.78, -65.41) for i in range(5)]
        sin = [sucursal_en(f"n{i}", "Salta", None, -24.79, -65.40) for i in range(2)]
        (lugar,) = lugares(self.indice(con + sin))
        self.assertEqual((lugar["provincia"], lugar["sucursales"]), ("AR-A", 7))

    def test_la_provincia_mal_cargada_se_corrige_por_la_mayoria(self):
        bien = [sucursal_en(f"x{i}", "Cordoba", "AR-X", -31.42, -64.18) for i in range(6)]
        mal = [sucursal_en(f"c{i}", "Cordoba", "AR-C", -31.41, -64.19) for i in range(2)]
        (lugar,) = lugares(self.indice(bien + mal))
        self.assertEqual(lugar["provincia"], "AR-X")

    def test_dos_lugares_con_el_mismo_nombre_lejos_no_se_fusionan(self):
        # San Martin hay en muchas provincias: no es el mismo lugar.
        mendoza = [sucursal_en("m", "San Martin", "AR-M", -33.08, -68.47)]
        pba = [sucursal_en("b", "San Martin", "AR-B", -34.57, -58.53)]
        self.assertEqual(len(lugares(self.indice(mendoza + pba))), 2)

    def test_los_articulos_van_en_minuscula(self):
        villa = [sucursal_en("v", "VILLA DEL PARQUE", "AR-C", -34.6, -58.49)]
        self.assertEqual(lugares(self.indice(villa))[0]["nombre"], "Villa del Parque")


if __name__ == "__main__":
    unittest.main()

