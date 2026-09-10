"""El mismo producto: busqueda, detalle y destacados sobre mart_mismo_producto.

La tabla se carga entera una vez cada 6 horas (la cache de main.py) y se busca
en memoria. Buscar con LIKE en BigQuery escanearia la tabla en cada busqueda, y
esta pagina invita justamente a buscar muchas veces seguidas: un rato de uso
podia comerse la cuota diaria. Asi cada instancia paga una lectura cada 6 horas,
se busque lo que se busque.

Este modulo no conoce BigQuery: recibe filas y devuelve diccionarios, para
poder testearlo sin credenciales.
"""

import unicodedata

# Para DESTACAR una diferencia, el precio mas bajo y el mas alto tienen que
# salir de al menos 3 sucursales. El precio de una cadena es la mediana entre
# sus sucursales: con 3 o mas, una sola sucursal con el precio mal cargado no
# puede mover la mediana, asi que no puede fabricar "la mayor diferencia del
# dia". Con 2, la mediana aproximada es uno de los dos valores, y un error pasa.
# Es la misma idea que la validacion de promos por evidencia: en vez de un tope
# arbitrario a la diferencia, exigir que el dato este respaldado.
SUCURSALES_MINIMAS_EXTREMO = 3

# Un producto en 2 cadenas dice poco del mercado. Los destacados salen de los
# que se venden en varias, que ademas son los que la gente reconoce.
CADENAS_MINIMAS_DESTACADO = 4

CAMPOS_RESUMEN = (
    "id_producto",
    "descripcion",
    "marca",
    "categoria",
    "cadenas",
    "precio_mas_bajo",
    "precio_mas_alto",
    "diferencia_pct",
    "extremos_respaldados",
)


def normalizar(texto: str | None) -> str:
    """Minusculas y sin tildes: "Café" y "CAFE" tienen que encontrarse igual."""
    descompuesto = unicodedata.normalize("NFD", texto or "")
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn").lower()


def _extremos_respaldados(producto: dict) -> bool:
    """Si el precio mas bajo y el mas alto tienen cada uno alguna cadena que los
    informe desde SUCURSALES_MINIMAS_EXTREMO o mas sucursales.

    Con empates alcanza con que UNA de las cadenas empatadas este respaldada: el
    precio sigue siendo real aunque otra cadena lo informe desde una sola.
    """

    def respaldado(precio: float) -> bool:
        return any(
            p["sucursales"] >= SUCURSALES_MINIMAS_EXTREMO
            for p in producto["precios"]
            if p["precio_mediano"] == precio
        )

    return respaldado(producto["precio_mas_bajo"]) and respaldado(producto["precio_mas_alto"])


def armar_indice(filas) -> dict:
    """Agrupa las filas del mart (una por producto x cadena) por producto.

    Los agregados por producto (cadenas, extremos, diferencia) se toman del mart
    tal cual y no se recalculan: la definicion vive en un solo lugar y la
    vigilan los tests de dbt.
    """
    productos: dict = {}
    for fila in filas:
        # El id se guarda como texto: llega por la URL como texto y un codigo de
        # barras no es un numero (los ceros a la izquierda importan).
        clave = str(fila["id_producto"])
        producto = productos.get(clave)
        if producto is None:
            producto = productos[clave] = {
                "id_producto": clave,
                "descripcion": fila["descripcion"],
                "marca": fila["marca"],
                "categoria": fila["categoria"],
                "cadenas": fila["cadenas"],
                "precio_mas_bajo": fila["precio_mas_bajo"],
                "precio_mas_alto": fila["precio_mas_alto"],
                "diferencia_pct": fila["diferencia_pct"],
                "fecha_datos": str(fila["fecha_datos"]),
                "precios": [],
                "_texto": normalizar(f"{fila['descripcion']} {fila['marca'] or ''}"),
            }
        producto["precios"].append(
            {
                "cadena": fila["cadena"],
                "precio_mediano": fila["precio_mediano"],
                "precio_minimo": fila["precio_minimo"],
                "precio_maximo": fila["precio_maximo"],
                "sucursales": fila["sucursales"],
            }
        )

    for producto in productos.values():
        producto["precios"].sort(key=lambda p: (p["precio_mediano"], p["cadena"]))
        producto["extremos_respaldados"] = _extremos_respaldados(producto)
    return productos


def _resumen(producto: dict) -> dict:
    return {campo: producto[campo] for campo in CAMPOS_RESUMEN}


def buscar(indice: dict, consulta: str, limite: int = 20) -> list[dict]:
    """Productos cuya descripcion o marca contienen TODAS las palabras buscadas,
    en cualquier orden. Primero los que estan en mas cadenas: son los mas
    conocidos y los que mas informacion dan."""
    palabras = normalizar(consulta).split()
    if not palabras:
        return []
    encontrados = [p for p in indice.values() if all(w in p["_texto"] for w in palabras)]
    encontrados.sort(key=lambda p: (-p["cadenas"], p["descripcion"]))
    return [_resumen(p) for p in encontrados[:limite]]


def detalle(indice: dict, id_producto: str) -> dict | None:
    producto = indice.get(str(id_producto))
    if producto is None:
        return None
    return {**_resumen(producto), "fecha_datos": producto["fecha_datos"], "precios": producto["precios"]}


def destacados(indice: dict, limite: int = 12) -> list[dict]:
    """Las mayores diferencias del dia entre productos respaldados y en varias
    cadenas. Ver SUCURSALES_MINIMAS_EXTREMO y CADENAS_MINIMAS_DESTACADO."""
    candidatos = [
        p
        for p in indice.values()
        if p["cadenas"] >= CADENAS_MINIMAS_DESTACADO and p["extremos_respaldados"]
    ]
    candidatos.sort(key=lambda p: (-p["diferencia_pct"], p["descripcion"]))
    return [_resumen(p) for p in candidatos[:limite]]
