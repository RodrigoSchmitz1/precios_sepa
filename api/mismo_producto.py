"""El mismo producto: busqueda, detalle y destacados sobre mart_mismo_producto.

La tabla se lee entera con leer_tabla (main.py), que no consume cuota, se refresca cada 6
horas (la cache de main.py) y se busca en memoria. Buscar con LIKE en BigQuery
escanearia la tabla en cada busqueda, y esta pagina invita justamente a buscar
muchas veces seguidas: un rato de uso podia comerse la cuota diaria.

Este modulo no conoce BigQuery: recibe filas y devuelve diccionarios, para
poder testearlo sin credenciales.
"""

import bisect
import math
import re
import sys
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
# que se venden en varias EMPRESAS, no en varias banderas: Carrefour tiene
# cuatro banderas (Hiper, Market, Express, Maxi) y Cencosud otras tantas, asi
# que exigir "4 cadenas" lo cumplia un producto que vende una sola empresa. Con
# 3 empresas distintas el precio que se compara es el de tres companias que
# fijan precios por separado.
EMPRESAS_MINIMAS_DESTACADO = 3

CAMPOS_RESUMEN = (
    "id_producto",
    "descripcion",
    "marca",
    "categoria",
    "cadenas",
    "empresas",
    "precio_mas_bajo",
    "precio_mas_alto",
    "diferencia_pct",
    "extremos_respaldados",
    # Cuantos precios quedaron afuera por contradecir al mercado. La pagina lo
    # usa para decirlo en vez de callarlo.
    "cadenas_descartadas",
    # El tamano del envase, para poder decir "1 kg" aunque SEPA mande la
    # descripcion cortada ("PLAYADITO YERBA CON" es un paquete de 500 g).
    "cantidad_normalizada",
    "unidad_normalizada",
)


# El tamano pegado a su numero: "1 KG" y "1kg" se buscan igual. SEPA escribe
# de las dos formas y la gente tipea "playadito 1kg" (no encontraba nada).
TAMANO_SEPARADO = re.compile(r"(\d)\s+(kg|kgs|gr|grs|g|lt|lts|l|ml|cc|un|u)\b")


# Las unidades escritas con palabras, despues de un numero (arreglos-segundo-
# explore, 2026-11-19): "leche la serenisima 1 litro" no encontraba nada,
# porque los tamanos se indexan como "1l" y "1lt" y "litro" no es el comienzo
# de ninguna palabra. Se leen como su abreviatura antes de pegar el tamano.
UNIDAD_ESCRITA = re.compile(r"(\d)\s*(litros?|kilogramos?|kilos?|gramos?|mililitros?)\b")
_ABREVIATURA = {"litro": "l", "litros": "l", "kilo": "kg", "kilos": "kg", "kilogramo": "kg", "kilogramos": "kg",
                "gramo": "g", "gramos": "g", "mililitro": "ml", "mililitros": "ml"}


def normalizar(texto: str | None) -> str:
    """Minusculas, sin tildes y con el tamano pegado: "Café 1 KG", "cafe 1kg" y
    "cafe 1 kilo" tienen que encontrarse igual."""
    descompuesto = unicodedata.normalize("NFD", texto or "")
    plano = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn").lower()
    plano = UNIDAD_ESCRITA.sub(lambda m: m.group(1) + _ABREVIATURA[m.group(2)], plano)
    return TAMANO_SEPARADO.sub(r"\1\2", plano)


# ---------------------------------------------------------------------------
# Buscador (2026-11-17, openspec buscador-que-encuentra)
#
# Buscaba pedazos de texto y ordenaba por cantidad de cadenas: "leche" traia
# Kinder y Actimel, "pan" traia empanadas (y "panal", pañal sin tilde), "yerva"
# no traia nada. Ahora cada palabra buscada tiene que ser el comienzo de una
# palabra del producto, se toleran los errores foneticos del castellano y lo que
# se busco va primero (ver buscar).

# Una palabra: letras y numeros, con un decimal pegado ("1.5l", "1,5l").
PALABRA = re.compile(r"[a-z0-9]+(?:[.,][0-9]+)?[a-z]*")


def fonetizar(texto: str) -> str:
    """Iguala lo que en castellano suena igual, sobre un texto ya normalizado:
    b/v, s/z/c suave, y/ll, y la h muda (no la de "ch"). Se aplica al producto y a
    la busqueda por igual, asi que lo bien escrito encuentra lo mismo que antes."""
    t = texto.replace("ll", "y").replace("v", "b").replace("z", "s")
    t = re.sub(r"c(?=[ei])", "s", t)
    return re.sub(r"(?<!c)h", "", t)


def palabras(texto: str | None) -> set[str]:
    return set(PALABRA.findall(fonetizar(normalizar(texto))))


# Memoria (2026-11-17): con un set de palabras por producto el indice paso de
# 101 a 215 MiB (47.637 productos) y Cloud Run, con 512 MiB, empezo a cortar por
# memoria. Las palabras se guardan como tuplas de cadenas internadas (la misma
# palabra en miles de productos es un solo objeto), y las del texto completo,
# que solo sirven para armar el vocabulario, como un unico texto separado por
# espacios.
_CATEGORIAS: dict[str, tuple[str, ...]] = {}


def _tupla(texto: str | None) -> tuple[str, ...]:
    return tuple(sorted(sys.intern(w) for w in palabras(texto)))


def _tupla_categoria(categoria: str | None) -> tuple[str, ...]:
    clave = categoria or ""
    if clave not in _CATEGORIAS:
        _CATEGORIAS[clave] = _tupla(clave)
    return _CATEGORIAS[clave]


def _variantes(palabra: str) -> set[str]:
    """La palabra buscada y su singular: "huevos" tiene que encontrar "HUEVO"."""
    variantes = {palabra}
    if len(palabra) > 3 and palabra.endswith("es"):
        variantes.add(palabra[:-2])
    if len(palabra) > 3 and palabra.endswith("s"):
        variantes.add(palabra[:-1])
    return variantes


def _empieza_alguna(conjunto, variantes: set[str]) -> bool:
    return any(w.startswith(v) for w in conjunto for v in variantes)


def _es_alguna(conjunto, variantes: set[str]) -> bool:
    """La palabra entera, con su plural de cualquiera de los dos lados: "pan" es
    la categoria Pan pero no Panales."""
    return any(_variantes(w) & variantes for w in conjunto)


def _tamanos_buscables(cantidad, unidad) -> str:
    """El tamano del envase escrito como lo tipea la gente: "500g", "1kg", "1.5l".

    Muchas descripciones de SEPA no lo traen ("PLAYADITO YERBA CON" es un
    paquete de 500 g): esta en la cantidad informada, no en el texto. Sin esto
    "playadito 500g" no encontraba nada.
    """
    if not cantidad or unidad not in ("g", "cc", "unidad"):
        return ""
    if unidad == "unidad":
        return f"{int(cantidad)}u"

    def numero(valor: float) -> list[str]:
        texto = f"{valor:.2f}".rstrip("0").rstrip(".")
        return [texto, texto.replace(".", ",")] if "." in texto else [texto]

    chico, grande = ("g", "kg") if unidad == "g" else ("ml", "l")
    formas = [f"{n}{chico}" for n in numero(cantidad)]
    formas += [f"{n}gr" for n in numero(cantidad)] if unidad == "g" else [f"{n}cc" for n in numero(cantidad)]
    if cantidad >= 250:
        formas += [f"{n}{grande}" for n in numero(cantidad / 1000)]
        if unidad == "cc":
            formas += [f"{n}lt" for n in numero(cantidad / 1000)]
    return " ".join(formas)


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
            # Solo cuentan los precios creibles: si un precio descartado coincide
            # por casualidad con un extremo, no puede ser el que lo respalde.
            if p["precio_mediano"] == precio and p["precio_creible"]
        )

    return respaldado(producto["precio_mas_bajo"]) and respaldado(producto["precio_mas_alto"])


def armar_cambios(filas) -> dict:
    """Los cambios de precio de mart_cambio_precio, por (id_producto, cadena).

    La regla de que cambio se cuenta (reciente, de 3% o mas, el precio de hoy)
    vive en el mart; aca solo se indexa (openspec historia-de-precio)."""
    return {
        (str(f["id_producto"]), f["cadena"]): {
            "precio_anterior": f["precio_anterior"],
            "fecha": str(f["fecha_cambio"]),
            "pct": f["cambio_pct"],
        }
        for f in filas
    }


def armar_indice(filas, cambios: dict | None = None) -> dict:
    """Agrupa las filas del mart (una por producto x cadena) por producto.

    cambios (de armar_cambios) pega a cada precio su ultimo cambio para
    mostrar, o None: "subio 8% el 25/11" en el detalle y en Tu lista.

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
                # .get: el rubro se suma para Mas barato por zona (2026-11).
                "rubro": fila.get("rubro"),
                "cadenas": fila["cadenas"],
                "empresas": fila["empresas"],
                "precio_mas_bajo": fila["precio_mas_bajo"],
                "precio_mas_alto": fila["precio_mas_alto"],
                "diferencia_pct": fila["diferencia_pct"],
                # .get con default: la API y dbt se despliegan por separado, asi
                # que puede haber una ventana en la que el mart todavia no traiga
                # las columnas nuevas. Sin descartes, el comportamiento es el de
                # antes.
                "cadenas_descartadas": fila.get("cadenas_descartadas", 0),
                # La mediana entre empresas contra la que se juzga cada precio.
                # La pagina la usa para explicar con numeros por que un precio
                # queda fuera de la comparacion ("menos de la mitad de $3.316").
                "precio_referencia": fila.get("precio_referencia"),
                # .get por la misma razon que arriba: la columna llega al mart en
                # la corrida siguiente al deploy, y hasta entonces no hay tamano.
                "cantidad_normalizada": fila.get("cantidad_normalizada"),
                "unidad_normalizada": fila.get("unidad_normalizada"),
                "fecha_datos": str(fila["fecha_datos"]),
                "precios": [],
                # Se busca tambien en como lo llama cada cadena: el mismo codigo
                # puede llegar como "YERBA" de marca "PLAYA" en una y como
                # "PLAYADITO YERBA MATE SUAVE 500G" en otra (textos_busqueda los
                # junta a todos; .get porque llega en la corrida siguiente).
                "_palabras": " ".join(sorted(palabras(
                    f"{fila['descripcion']} {fila['marca'] or ''} "
                    f"{_tamanos_buscables(fila.get('cantidad_normalizada'), fila.get('unidad_normalizada'))} "
                    f"{fila.get('textos_busqueda') or ''}"
                ))),
                # Lo que muestra la pagina: un producto que tiene la palabra
                # en su propio nombre va antes que uno que la tiene solo en el
                # nombre que le da otra cadena.
                "_palabras_visibles": _tupla(
                    f"{fila['descripcion']} {fila['marca'] or ''} "
                    f"{_tamanos_buscables(fila.get('cantidad_normalizada'), fila.get('unidad_normalizada'))}"
                ),
                "_palabras_categoria": _tupla_categoria(fila.get("categoria")),
            }
        producto["precios"].append(
            {
                "cadena": fila["cadena"],
                "precio_mediano": fila["precio_mediano"],
                "precio_minimo": fila["precio_minimo"],
                "precio_maximo": fila["precio_maximo"],
                "sucursales": fila["sucursales"],
                # Un precio que contradice a la mediana entre empresas. Viaja
                # marcado en vez de desaparecer: la pagina lo muestra como no
                # verificado, pero no cuenta para la brecha (el mart ya lo dejo
                # afuera de los extremos).
                "precio_creible": fila.get("precio_creible", True),
                # De que dia es el precio: el ultimo, salvo una cadena que falto
                # y se arrastro (ver cadenas_de_otro_dia). .get porque el mart
                # puede no traer la columna hasta la corrida siguiente al deploy.
                "fecha_precio": str(fila.get("fecha_precio") or fila["fecha_datos"]),
                "cambio": cambios.get((clave, fila["cadena"])) if cambios else None,
                # Solo en las farmacias (openspec comercios-regionales-y-
                # farmacity): comparan el producto, pero Tu lista no las cuenta.
                # Va como clave opcional y no en cada precio: son unas 200 mil
                # filas en memoria y casi todas de supermercado.
                **({"farmacia": True} if fila.get("formato") == "farmacia" else {}),
            }
        )

    for producto in productos.values():
        producto["precios"].sort(key=lambda p: (p["precio_mediano"], p["cadena"]))
        producto["extremos_respaldados"] = _extremos_respaldados(producto)
    return productos


def cadenas_de_otro_dia(indice: dict) -> dict:
    """Las cadenas que se muestran con precios de otro dia, y de cual.

    Algunos dias el ZIP de SEPA llega sin una empresa (Cencosud el 2026-11-11).
    El mart usa entonces el precio mas reciente de sus cadenas, dentro de
    dias_maximos_arrastre, y lo marca con fecha_precio. Esta lista es lo que el
    sitio avisa. Vacia en un dia completo.
    """
    fecha_datos = None
    fechas: dict = {}
    for producto in indice.values():
        fecha_datos = fecha_datos or producto["fecha_datos"]
        for p in producto["precios"]:
            if p["fecha_precio"] != producto["fecha_datos"]:
                fechas[p["cadena"]] = p["fecha_precio"]
    return {
        "fecha_datos": fecha_datos,
        "cadenas": [{"cadena": c, "fecha_precio": f} for c, f in sorted(fechas.items())],
    }


def cadenas_con_precio(indice: dict) -> set:
    """Todas las cadenas con al menos un precio en el indice, incluidas las
    arrastradas de otro dia."""
    return {p["cadena"] for producto in indice.values() for p in producto["precios"]}


def _resumen(producto: dict) -> dict:
    return {campo: producto[campo] for campo in CAMPOS_RESUMEN}


def _vocabulario(indice: dict) -> tuple[list[str], dict[str, list[str]]]:
    """Las palabras de todos los productos, ordenadas, y que productos tiene
    cada una. Buscar un prefijo es entonces un bisect y no recorrer cada palabra
    de cada producto. Se arma una vez por indice (el indice se arma una vez por
    instancia y por dia)."""
    global _ULTIMO_VOCABULARIO
    if _ULTIMO_VOCABULARIO is not None and _ULTIMO_VOCABULARIO[0] is indice:
        return _ULTIMO_VOCABULARIO[1]
    por_palabra: dict[str, list[str]] = {}
    for clave, producto in indice.items():
        for w in producto["_palabras"].split():
            por_palabra.setdefault(sys.intern(w), []).append(clave)
    vocabulario = (sorted(por_palabra), por_palabra)
    _ULTIMO_VOCABULARIO = (indice, vocabulario)
    return vocabulario


_ULTIMO_VOCABULARIO = None


def _con_prefijo(vocabulario, variantes: set[str]) -> set[str]:
    ordenadas, por_palabra = vocabulario
    claves: set[str] = set()
    for v in variantes:
        i = bisect.bisect_left(ordenadas, v)
        while i < len(ordenadas) and ordenadas[i].startswith(v):
            claves.update(por_palabra[ordenadas[i]])
            i += 1
    return claves


def buscar(indice: dict, consulta: str, limite: int = 20) -> list[dict]:
    """Productos que tienen TODAS las palabras buscadas, en cualquier orden.

    Cada palabra buscada tiene que ser el comienzo de una palabra del producto
    (su nombre en cualquier cadena, su marca o su tamaño): "gall" encuentra
    galletitas y "pan" no encuentra empanadas. El orden pone primero lo que se
    busco:
      1. la categoria tiene alguna palabra buscada entera ("leche" -> Leche
         fluida; "pan" -> Pan, no Panales), y antes la que queda nombrada
         entera ("pan": Pan antes que Rebozadores y pan rallado);
      2. el nombre que muestra la pagina tiene todas las palabras;
      3. y las tiene enteras: "pan" pone "MANTECA TONADITA PAN" antes que
         "PAÑAL", que sin tilde empieza con "pan";
      4. mas cadenas, y la descripcion mas corta.
    """
    buscadas = [_variantes(w) for w in PALABRA.findall(fonetizar(normalizar(consulta)))]
    if not buscadas:
        return []
    vocabulario = _vocabulario(indice)
    claves: set[str] | None = None
    for variantes in buscadas:
        con_esta = _con_prefijo(vocabulario, variantes)
        claves = con_esta if claves is None else claves & con_esta
        if not claves:
            return []

    def nivel_categoria(p):
        # 0: lo buscado nombra la categoria entera ("pan" -> Pan); 1: nombra
        # una palabra ("pan" -> Rebozadores y pan rallado); 2: ninguna.
        nombradas = [w for w in p["_palabras_categoria"] if len(w) > 2]
        tocadas = [w for w in nombradas if any(_variantes(w) & v for v in buscadas)]
        return 2 if not tocadas else 0 if len(tocadas) == len(nombradas) else 1

    def orden(p):
        categoria = nivel_categoria(p)
        visible = all(_empieza_alguna(p["_palabras_visibles"], v) for v in buscadas)
        enteras = all(_es_alguna(p["_palabras_visibles"], v) for v in buscadas)
        return (categoria, not visible, not enteras, -p["cadenas"], len(p["descripcion"]), p["descripcion"])

    encontrados = sorted((indice[c] for c in claves), key=orden)
    return [_resumen(p) for p in encontrados[:limite]]


def detalle(indice: dict, id_producto: str) -> dict | None:
    producto = indice.get(str(id_producto))
    if producto is None:
        return None
    return {
        **_resumen(producto),
        "fecha_datos": producto["fecha_datos"],
        "precio_referencia": producto["precio_referencia"],
        "precios": producto["precios"],
    }


def destacados(indice: dict, limite: int = 12) -> list[dict]:
    """Las mayores diferencias del dia entre productos respaldados y vendidos por
    varias empresas. Ver SUCURSALES_MINIMAS_EXTREMO y EMPRESAS_MINIMAS_DESTACADO."""
    candidatos = [
        p
        for p in indice.values()
        if p["empresas"] >= EMPRESAS_MINIMAS_DESTACADO and p["extremos_respaldados"]
    ]
    candidatos.sort(key=lambda p: (-p["diferencia_pct"], p["descripcion"]))
    return [_resumen(p) for p in candidatos[:limite]]


# Los basicos del armado rapido de Tu lista (lista-en-el-centro, 2026-11-19).
# Busquedas y no categorias: medido ese dia, el producto "mas comun" de cada
# categoria de la canasta del INDEC daba una polenta para Harina, un endulzante
# para Azucar, una crema para Quesos y un postre para Yogur. El primer resultado
# del buscador, con el texto que tipea la gente, da lo esperable (Playadito 1 kg,
# Natura 1,5 L, Ala, Favorita...), casi siempre en 13 o 14 cadenas.
BASICOS = (
    ("Almacén", "Yerba", "yerba 1 kg"),
    ("Almacén", "Aceite", "aceite girasol 1,5 litros"),
    ("Almacén", "Azúcar", "azucar 1 kg"),
    ("Almacén", "Harina", "harina 000 1 kg"),
    ("Almacén", "Arroz", "arroz largo fino 1 kg"),
    ("Almacén", "Fideos", "fideos spaghetti 500 g"),
    ("Almacén", "Polenta", "polenta"),
    ("Almacén", "Puré de tomate", "pure de tomate"),
    ("Almacén", "Atún", "atun"),
    ("Almacén", "Arvejas", "arvejas"),
    ("Almacén", "Sal", "sal fina"),
    ("Almacén", "Vinagre", "vinagre"),
    ("Almacén", "Mayonesa", "mayonesa"),
    ("Desayuno", "Pan lactal", "pan lactal"),
    ("Desayuno", "Galletitas de agua", "galletitas de agua"),
    ("Desayuno", "Galletitas dulces", "galletitas dulces"),
    ("Desayuno", "Café", "cafe molido"),
    ("Desayuno", "Té", "te en saquitos"),
    ("Desayuno", "Mate cocido", "mate cocido"),
    ("Desayuno", "Dulce de leche", "dulce de leche"),
    ("Desayuno", "Mermelada", "mermelada"),
    ("Lácteos", "Leche", "leche entera 1 litro"),
    ("Lácteos", "Manteca", "manteca 200 g"),
    ("Lácteos", "Queso cremoso", "queso cremoso"),
    ("Lácteos", "Queso rallado", "queso rallado"),
    ("Lácteos", "Yogur", "yogur entero"),
    ("Lácteos", "Huevos", "huevos"),
    ("Bebidas", "Gaseosa", "gaseosa cola 2,25 litros"),
    ("Bebidas", "Agua", "agua mineral"),
    ("Bebidas", "Jugo en polvo", "jugo en polvo"),
    ("Bebidas", "Cerveza", "cerveza"),
    ("Bebidas", "Vino", "vino tinto"),
    ("Limpieza", "Papel higiénico", "papel higienico"),
    ("Limpieza", "Detergente", "detergente"),
    ("Limpieza", "Lavandina", "lavandina"),
    ("Limpieza", "Jabón en polvo", "jabon en polvo"),
    ("Higiene", "Shampoo", "shampoo"),
    ("Higiene", "Pasta dental", "pasta dental"),
    ("Higiene", "Desodorante", "desodorante"),
    ("Higiene", "Jabón de tocador", "jabon de tocador"),
)


def basicos(indice: dict) -> list[dict]:
    """El primer resultado del buscador para cada basico, en el orden de BASICOS.
    Una busqueda sin resultados se saltea."""
    resultado = []
    for grupo, nombre, consulta in BASICOS:
        encontrados = buscar(indice, consulta, limite=1)
        if encontrados:
            resultado.append({"grupo": grupo, "nombre": nombre, "producto": encontrados[0]})
    return resultado


# Pegar una lista escrita (2026-11-19, openspec compartir-y-pegar-la-lista).
# "- 2 leches / - yerba / - 1 docena de huevos" -> un producto por renglon, con el
# buscador del sitio y sin IA (lo decidio Rodrigo): gratis, instantaneo y sin
# nada que abusar. La persona ve lo elegido y lo puede cambiar antes de sumar.
MAXIMO_CARACTERES_PEGADOS = 2000
MAXIMO_RENGLONES_PEGADOS = 50
CANDIDATOS_POR_RENGLON = 3

_VINETA = re.compile(r"^(?:[\s\-\*•·>]+|\d{1,2}[.)]\s+)")
# Lo que no es letra, numero ni un signo de los que usa una cantidad o un tamano
# (emojis, flechas, comillas): afuera.
_SIMBOLOS = re.compile(r"[^\w\s,.%()/-]", re.UNICODE)
# Un numero al principio es la cantidad ("2 leches", "2x leche", "3 x atun")...
_CANTIDAD_ADELANTE = re.compile(r"^(\d{1,2})\s*(?:x|u|un|unid|unidades)?\s+(.+)$", re.IGNORECASE)
# ...salvo que lo siga una unidad: "1 kg de azucar" es el tamano, no la cantidad.
_UNIDAD_SIGUIENTE = re.compile(r"^(?:kg|kilo|kilos|g|gr|grs|gramos|l|lt|lts|litro|litros|ml|cc|cm3)\b", re.IGNORECASE)
_CANTIDAD_ATRAS = re.compile(r"^(.+?)\s*(?:\bx\s*(\d{1,2})|\((\d{1,2})\))\s*$", re.IGNORECASE)
# Palabras de relleno que no ayudan a buscar y si estorban: "1 docena DE huevos".
_RELLENO = {"de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "para", "y", "con"}


def _singular(palabra: str) -> str:
    if len(palabra) > 4 and palabra.endswith("es"):
        return palabra[:-2]
    if len(palabra) > 3 and palabra.endswith("s"):
        return palabra[:-1]
    return palabra


def _clave_basico(texto: str) -> frozenset:
    return frozenset(_singular(w) for w in palabras(texto) if w not in _RELLENO)


def renglones_pegados(texto: str) -> list[str]:
    """Los renglones de un texto pegado. Uno solo con comas se parte por comas
    ("yerba, aceite, fideos"). Se cortan los topes de largo y de renglones."""
    texto = (texto or "")[:MAXIMO_CARACTERES_PEGADOS]
    lineas = [l.strip() for l in re.split(r"[\r\n;]+", texto) if l.strip()]
    if len(lineas) == 1 and "," in lineas[0]:
        lineas = [l.strip() for l in lineas[0].split(",") if l.strip()]
    return lineas[:MAXIMO_RENGLONES_PEGADOS]


def interpretar_renglon(renglon: str) -> tuple[str, int]:
    """(lo que se busca, cantidad) de un renglon de lista."""
    t = _SIMBOLOS.sub(" ", renglon)
    t = _VINETA.sub("", t.strip()).strip()
    cantidad = 1
    m = _CANTIDAD_ADELANTE.match(t)
    if m and not _UNIDAD_SIGUIENTE.match(m.group(2)):
        cantidad, t = int(m.group(1)), m.group(2)
    else:
        m = _CANTIDAD_ATRAS.match(t)
        if m:
            cantidad, t = int(m.group(2) or m.group(3)), m.group(1)
    consulta = " ".join(w for w in t.split() if w.lower() not in _RELLENO)
    return consulta.strip(" ,.-"), max(1, min(cantidad, MAXIMO_UNIDADES_POR_PRODUCTO))


def interpretar(indice: dict, texto: str, basicos_resueltos: list[dict]) -> list[dict]:
    """Un resultado por renglon: el texto original, la cantidad y hasta
    CANDIDATOS_POR_RENGLON productos, el primero el elegido.

    Si el renglon nombra solo un basico ("yerba", "leches"), el primero es el de
    los basicos (Playadito 1 kg y no la primera yerba que traiga el buscador).
    Si dice algo mas ("yerba playadito 500"), manda el buscador. Medido el
    2026-11-19 sobre 30 renglones tipicos: ver DECISIONES.md."""
    por_basico = {_clave_basico(b["nombre"]): b["producto"] for b in basicos_resueltos}
    resultado = []
    for renglon in renglones_pegados(texto):
        consulta, cantidad = interpretar_renglon(renglon)
        candidatos: list[dict] = []
        if consulta:
            basico = por_basico.get(_clave_basico(consulta))
            if basico:
                candidatos.append(basico)
            for p in buscar(indice, consulta, limite=CANDIDATOS_POR_RENGLON + 1):
                if all(p["id_producto"] != c["id_producto"] for c in candidatos):
                    candidatos.append(p)
        resultado.append({
            "texto": renglon,
            "busqueda": consulta,
            "cantidad": cantidad,
            "candidatos": candidatos[:CANDIDATOS_POR_RENGLON],
        })
    return resultado


# De tu canasta a tu lista: Tu canasta cotiza categorias ("yerba, 2 kg por
# mes"); aca se elige la marca exacta de cada una.
MAXIMO_CATEGORIAS_SUGERIDAS = 80
MAXIMO_SUGERIDOS_POR_CATEGORIA = 12


def sugeridos_por_categoria(indice: dict, categorias: list, limite: int = 4) -> dict:
    """Los productos mas comunes de cada categoria, para elegir la marca de un toque.

    "Mas comun" es en cuantas sucursales tiene precio creible, sumando todas las
    cadenas: la Playadito de 500 g esta en miles y una yerba de una sola cadena
    en decenas. Es lo que mejor aproxima "la que compra la mayoria", y es la que
    mas se puede comparar.

    Primero una opcion por marca: la pregunta es "¿de que marca?", y tres
    fideos Lucchetti en distintos cortes no la responden. Si no alcanzan las
    marcas se completa con las que siguen.
    """
    pedidas = {str(c) for c in categorias[:MAXIMO_CATEGORIAS_SUGERIDAS] if isinstance(c, str)}
    limite = max(1, min(int(limite), MAXIMO_SUGERIDOS_POR_CATEGORIA))
    por_categoria: dict[str, list] = {c: [] for c in pedidas}
    for producto in indice.values():
        lista = por_categoria.get(producto["categoria"])
        if lista is None:
            continue
        sucursales = sum(p["sucursales"] for p in producto["precios"] if p["precio_creible"])
        lista.append((sucursales, producto))
    resultado = {}
    for categoria, candidatos in por_categoria.items():
        candidatos.sort(key=lambda x: (-x[0], x[1]["descripcion"]))
        marcas, primeros, resto = set(), [], []
        for sucursales, p in candidatos:
            marca = normalizar(p["marca"] or p["descripcion"])
            (resto if marca in marcas else primeros).append((sucursales, p))
            marcas.add(marca)
        resultado[categoria] = [{**_resumen(p), "sucursales": s} for s, p in (primeros + resto)[:limite]]
    return resultado


# Tu lista: cuanto cuesta en cada cadena una lista de productos exactos.
MAXIMO_PRODUCTOS_LISTA = 50
MAXIMO_UNIDADES_POR_PRODUCTO = 99


def cotizar_lista(indice: dict, items: list[dict], cadenas: list[str] | None = None) -> dict:
    """Cuanto sale una lista de productos exactos (codigo de barras) en cada cadena.

    Es la pregunta de uso diario que la pagina respondia de a un producto: "si
    compro siempre esto, ¿donde me conviene?". Se suma, por cadena, el precio de
    cada producto por su cantidad.

    Las cadenas no venden todas lo mismo, asi que un total solo se compara con
    otro si cubren los mismos productos. Por eso cada cadena dice cuantos tiene:
    primero van las que tienen la lista completa, de la mas barata a la mas
    cara, y despues las incompletas. "Combinando cadenas" es el piso: cada
    producto en la cadena donde esta mas barato.

    Solo cuentan los precios creibles: el que contradice a la mediana entre
    empresas tampoco entra aca (ver mart_mismo_producto).

    Con las cadenas de la zona del usuario se suma el bloque "zona", la misma
    cuenta entre esas cadenas (ver _lista_en_zona). Las filas nacionales no
    cambian.
    """
    pedidos: dict[str, int] = {}
    for item in items[:MAXIMO_PRODUCTOS_LISTA]:
        clave = str(item.get("id_producto", ""))
        cantidad = item.get("cantidad", 1)
        if isinstance(cantidad, bool) or not isinstance(cantidad, int):
            cantidad = 1
        pedidos[clave] = max(1, min(cantidad, MAXIMO_UNIDADES_POR_PRODUCTO))

    productos, no_encontrados = [], []
    for clave, cantidad in pedidos.items():
        producto = indice.get(clave)
        # Tu lista compara supermercados: una farmacia vende el shampoo, no la
        # compra (openspec comercios-regionales-y-farmacity). Se filtra aca y no
        # solo con las cadenas de la zona, para que la cuenta nacional tampoco
        # la cuente.
        cuentan = [p for p in producto["precios"] if p["precio_creible"] and not p.get("farmacia")] if producto else []
        precios = {p["cadena"]: p["precio_mediano"] for p in cuentan}
        if not precios:
            no_encontrados.append(clave)
            continue
        cambios = {p["cadena"]: p.get("cambio") for p in cuentan}
        cadena_barata = min(precios, key=lambda c: (precios[c], c))
        productos.append({
            **_resumen(producto),
            "cantidad": cantidad,
            "mas_barato": {"cadena": cadena_barata, "precio": precios[cadena_barata], "cambio": cambios.get(cadena_barata)},
            "_precios": precios,
            "_cambios": cambios,
        })

    por_cadena = _filas_por_cadena(productos, lambda p: p["_precios"])
    combinada = round(sum(p["mas_barato"]["precio"] * p["cantidad"] for p in productos), 2)
    zona = _lista_en_zona(productos, set(cadenas)) if cadenas else None
    for p in productos:
        # El precio de cada cadena viaja con el producto (app-para-el-usuario):
        # Mi compra muestra cuanto sale cada uno en la cadena que conviene.
        p["precios"] = p.pop("_precios")
        del p["_cambios"]
    return {
        "productos": productos,
        "no_encontrados": no_encontrados,
        "cadenas": por_cadena,
        "combinando_cadenas": combinada,
        "fecha_datos": next((indice[p["id_producto"]]["fecha_datos"] for p in productos), None),
        **({"zona": zona} if zona is not None else {}),
    }


def _filas_por_cadena(productos: list[dict], precios_de) -> list[dict]:
    """Total, cobertura y faltantes de cada cadena sobre una lista de productos.

    Primero las completas, de la mas barata a la mas cara; despues las
    incompletas, de la que tiene mas productos a la que tiene menos."""
    cadenas = sorted({c for p in productos for c in precios_de(p)})
    filas = []
    for cadena in cadenas:
        con_precio = [p for p in productos if cadena in precios_de(p)]
        filas.append({
            "cadena": cadena,
            "total": round(sum(precios_de(p)[cadena] * p["cantidad"] for p in con_precio), 2),
            "productos_con_precio": len(con_precio),
            "completa": len(con_precio) == len(productos),
            "faltan": [p["id_producto"] for p in productos if cadena not in precios_de(p)],
        })
    filas.sort(key=lambda c: (not c["completa"], -c["productos_con_precio"], c["total"], c["cadena"]))
    return filas


def _lista_en_zona(productos: list[dict], cadenas: set[str]) -> dict:
    """La misma cuenta de la lista, contando solo las cadenas de la zona (2026-11).

    Un producto que no vende ninguna cadena de la zona va a no_en_zona y queda
    afuera: si contara, un solo producto regional dejaria a la zona sin ninguna
    cadena completa y sin titular. "Completa" es entonces tener todo lo que se
    consigue en la zona. Las cadenas de la zona sin precio ese dia simplemente
    no aparecen (el 2026-11-11 falto Cencosud entero).
    """
    def en_zona(p):
        return {c: v for c, v in p["_precios"].items() if c in cadenas}

    conseguibles = [p for p in productos if en_zona(p)]
    mas_barato = {}
    for p in conseguibles:
        precios = en_zona(p)
        cadena = min(precios, key=lambda c: (precios[c], c))
        # El cambio de precio viaja con la cadena elegida: Tu lista dice "Bajo 6%
        # en Dia" solo si cambio donde conviene comprar (historia-de-precio).
        mas_barato[p["id_producto"]] = {"cadena": cadena, "precio": precios[cadena], "cambio": p["_cambios"].get(cadena)}
    return {
        "cadenas": _filas_por_cadena(conseguibles, en_zona),
        "combinando_cadenas": round(sum(mas_barato[p["id_producto"]]["precio"] * p["cantidad"] for p in conseguibles), 2),
        "no_en_zona": [p["id_producto"] for p in productos if not en_zona(p)],
        "mas_barato": mas_barato,
    }


# ---------------------------------------------------------------------------
# Cuanto conviene comparar (2026-10-27)
#
# Por producto, el ahorro de comprar donde esta mas barato frente al precio
# tipico, que es la mediana entre empresas del mart. Por categoria se publica la
# MEDIANA de ese ahorro y no el maximo: lo que titula con el extremo no resiste
# los errores de la fuente (ver destacados). Entran los mismos productos que los
# destacados: vendidos por 3 empresas o mas y con los extremos respaldados.
#
# Medido ese dia, el precio mas bajo lo tenia Maxi en 3.935 de 9.501 productos y
# SuperChangomas en 2.155, y muchas categorias daban un ahorro de exactamente
# 5,0%. No era un error de la fuente sino una regla de precios: las dos
# banderas cobran lo mismo que su hermana de la misma empresa o un escalon fijo
# menos (5%, 10%, 15% en Maxi; 4% o 5% en SuperChangomas), casi nunca mas. Esa
# regla explica buena parte del "ahorro por comparar", asi que se mide y se
# publica junto con el, en vez de dejar que el numero la esconda.
#
# El "5,0% exacto" era en parte un artefacto (2026-10-28): la referencia del
# mart era el valor de abajo con empresas pares y solia caer en Carrefour, asi
# que Maxi quedaba un escalon justo por debajo. Con la mediana exacta son 2 de
# 51 categorias en 5,0% y no 11. La regla no depende de eso: se mide bandera
# contra hermana, sin la referencia.
# ---------------------------------------------------------------------------

MINIMO_PRODUCTOS_CATEGORIA = 20
# El mismo umbral que mart_quien_gana: una cadena con menos productos ofrecidos
# en la categoria no se mide.
MINIMO_OFRECIDOS_QUIEN_GANA = 20


def quien_gana_entre(indice: dict, cadenas: set) -> list[dict]:
    """Quien tiene el precio mas bajo en cada categoria, compitiendo solo entre
    `cadenas` (las de la zona del usuario).

    Filtrar las filas de mart_quien_gana a esas cadenas daria un numero
    enganoso: cada porcentaje del mart se calculo contra todas las cadenas del
    pais, asi que una cadena de Palermo "perdia" contra Maxi aunque Maxi no
    este en Palermo. Aca se recalcula producto por producto con las reglas del
    mart: comparables los productos que venden al menos 2 de las cadenas, sin
    la categoria "Otros", un empate cuenta para todas las empatadas, y solo
    entran las cadenas con al menos MINIMO_OFRECIDOS_QUIEN_GANA productos
    ofrecidos que ganaron alguno. Como el mart, no filtra por precio creible.
    Devuelve filas con las mismas columnas que /quien-gana.

    Medido el 2026-11-12 contra produccion, sin cuota: con todas las cadenas da
    el mismo ganador que mart_quien_gana en las 66 categorias, con los mismos
    porcentajes y la misma cantidad de comparables. Si alguna vez difieren, la
    regla cambio de un lado y no del otro.
    """
    ofrecidos: dict = {}
    ganados: dict = {}
    totales: dict = {}
    rubros: dict = {}
    for producto in indice.values():
        categoria = producto.get("categoria")
        if not categoria or categoria == "Otros":
            continue
        precios = {p["cadena"]: p["precio_mediano"] for p in producto["precios"] if p["cadena"] in cadenas and p["precio_mediano"]}
        if len(precios) < 2:
            continue
        totales[categoria] = totales.get(categoria, 0) + 1
        rubros.setdefault(categoria, producto.get("rubro"))
        minimo = min(precios.values())
        for cadena, precio in precios.items():
            ofrecidos[(categoria, cadena)] = ofrecidos.get((categoria, cadena), 0) + 1
            if precio == minimo:
                ganados[(categoria, cadena)] = ganados.get((categoria, cadena), 0) + 1

    filas = []
    for (categoria, cadena), victorias in ganados.items():
        ofrece = ofrecidos[(categoria, cadena)]
        if ofrece < MINIMO_OFRECIDOS_QUIEN_GANA:
            continue
        total = totales[categoria]
        filas.append(
            {
                "categoria": categoria,
                "rubro": rubros[categoria],
                "cadena": cadena,
                "productos_ganados": victorias,
                "productos_ofrecidos": ofrece,
                "total_productos_categoria": total,
                "pct_victorias": round(victorias / total * 100, 1),
                "pct_gana_cuando_compite": round(victorias / ofrece * 100, 1),
            }
        )
    filas.sort(key=lambda f: (f["categoria"], -f["pct_gana_cuando_compite"], f["cadena"]))
    return filas
# Para medir la regla entre dos banderas hermanas hacen falta productos en comun.
MINIMO_PRODUCTOS_REGLA = 100
# Una bandera "tiene regla" si es mas barata que su hermana en la mayoria de
# los productos que comparten y casi nunca mas cara.
MINIMO_MAS_BARATA_REGLA = 0.5
MAXIMO_MAS_CARA_REGLA = 0.05
# Un precio "igual" al de la hermana admite el redondeo a pesos.
TOLERANCIA_IGUAL = 0.003


def _mediana(valores: list[float]) -> float:
    ordenados = sorted(valores)
    mitad = len(ordenados) // 2
    return ordenados[mitad] if len(ordenados) % 2 else (ordenados[mitad - 1] + ordenados[mitad]) / 2


def _precios_creibles(producto: dict) -> dict:
    return {p["cadena"]: p["precio_mediano"] for p in producto["precios"] if p["precio_creible"] and p["precio_mediano"]}


def _regla_entre(indice: dict, cadena: str, hermana: str) -> dict | None:
    """Como fija `cadena` sus precios respecto de `hermana`, sobre TODOS los
    productos que venden las dos (no solo los comparables entre empresas)."""
    cocientes = []
    for producto in indice.values():
        precios = _precios_creibles(producto)
        if cadena in precios and hermana in precios:
            cocientes.append(precios[cadena] / precios[hermana])
    if len(cocientes) < MINIMO_PRODUCTOS_REGLA:
        return None
    n = len(cocientes)
    mas_barata = [c for c in cocientes if c < 1 - TOLERANCIA_IGUAL]
    escalones: dict = {}
    for c in mas_barata:
        descuento = round((1 - c) * 100)
        escalones[descuento] = escalones.get(descuento, 0) + 1
    return {
        "cadena": cadena,
        "referencia": hermana,
        "productos": n,
        "pct_mas_barata": round(len(mas_barata) / n * 100, 1),
        "pct_igual": round(sum(abs(c - 1) <= TOLERANCIA_IGUAL for c in cocientes) / n * 100, 1),
        "pct_mas_cara": round(sum(c > 1 + TOLERANCIA_IGUAL for c in cocientes) / n * 100, 1),
        # Los descuentos mas comunes, en puntos enteros, sobre todos los productos.
        "escalones": [
            {"descuento_pct": d, "pct_productos": round(k / n * 100, 1)}
            for d, k in sorted(escalones.items(), key=lambda e: -e[1])[:3]
        ],
    }


def ahorro_por_categoria(indice: dict, empresa_de: dict, limite_cadenas: int = 5) -> dict:
    """Cuanto se ahorra comprando donde esta mas barato, por categoria; quien
    tiene el precio mas bajo; y las reglas de precio que lo explican.

    `empresa_de` mapea cada cadena a su empresa (seed mapeo_cadenas): las reglas
    se buscan entre banderas de la misma empresa, que es donde aparecen.

    Un producto con el minimo empatado cuenta para todas las cadenas empatadas,
    como en Mas barato: forzar un desempate seria inventar una diferencia. Por
    eso los porcentajes de "quien tiene el precio mas bajo" pueden sumar mas de
    100.
    """
    comparables = [
        p
        for p in indice.values()
        if p["empresas"] >= EMPRESAS_MINIMAS_DESTACADO and p["extremos_respaldados"] and p["precio_referencia"]
    ]
    if not comparables:
        return {"productos": 0, "ahorro_mediano_pct": None, "categorias": [], "mas_baratas": [], "reglas": []}

    ahorros: dict = {}
    ganadas: dict = {}
    ganadas_por_categoria: dict = {}
    for producto in comparables:
        ahorro = 1 - producto["precio_mas_bajo"] / producto["precio_referencia"]
        ahorros.setdefault(producto["categoria"], []).append(ahorro)
        precios = _precios_creibles(producto)
        for cadena, precio in precios.items():
            if precio == producto["precio_mas_bajo"]:
                ganadas[cadena] = ganadas.get(cadena, 0) + 1
                por_cadena = ganadas_por_categoria.setdefault(producto["categoria"], {})
                por_cadena[cadena] = por_cadena.get(cadena, 0) + 1

    total = len(comparables)
    categorias = []
    for categoria, valores in ahorros.items():
        if len(valores) < MINIMO_PRODUCTOS_CATEGORIA:
            continue
        # Las empatadas en el tope van todas: elegir una por orden alfabetico
        # inventaba una diferencia que no existe (auditoria 2026-10-28).
        por_cadena = ganadas_por_categoria[categoria]
        veces = max(por_cadena.values())
        empatadas = sorted(c for c, v in por_cadena.items() if v == veces)
        categorias.append(
            {
                "categoria": categoria,
                "productos": len(valores),
                "ahorro_mediano_pct": round(_mediana(valores) * 100, 1),
                "cadena_mas_barata": empatadas[0],
                "cadenas_mas_baratas": empatadas,
                "pct_mas_barata": round(veces / len(valores) * 100, 1),
            }
        )
    categorias.sort(key=lambda c: (-c["ahorro_mediano_pct"], c["categoria"]))

    mas_baratas = [
        {"cadena": cadena, "productos": veces, "pct": round(veces / total * 100, 1)}
        for cadena, veces in sorted(ganadas.items(), key=lambda e: (-e[1], e[0]))[:limite_cadenas]
    ]

    # Para cada cadena que suele tener el precio mas bajo, la regla contra la
    # hermana de su empresa con la que comparte mas productos.
    reglas = []
    for fila in mas_baratas:
        cadena = fila["cadena"]
        hermanas = [h for h, e in empresa_de.items() if e == empresa_de.get(cadena) and h != cadena]
        candidatas = [r for r in (_regla_entre(indice, cadena, h) for h in hermanas) if r]
        if not candidatas:
            continue
        regla = max(candidatas, key=lambda r: r["productos"])
        if regla["pct_mas_barata"] >= MINIMO_MAS_BARATA_REGLA * 100 and regla["pct_mas_cara"] <= MAXIMO_MAS_CARA_REGLA * 100:
            reglas.append(regla)

    return {
        "productos": total,
        "ahorro_mediano_pct": round(_mediana([a for v in ahorros.values() for a in v]) * 100, 1),
        "categorias": categorias,
        "mas_baratas": mas_baratas,
        "reglas": reglas,
        "fecha_datos": comparables[0]["fecha_datos"],
    }


# Nivel de precios de cada cadena en productos identicos (2026-10-28). Lo usa
# Tu canasta en cada cadena (precios_por_sucursal.canasta_por_cadena) para
# comparar cadenas sin el efecto de composicion de la gama. Con menos de estos
# productos en una categoria se usa el nivel general de la cadena.
MINIMO_PRODUCTOS_NIVEL = 5


def niveles_por_cadena(indice: dict) -> dict:
    """Cuanto mas cara o mas barata es cada cadena que el precio tipico del
    mercado (la mediana entre empresas), en los productos que vende: media
    geometrica de los cocientes, por categoria y en general.

    La media geometrica porque es un indice de precios (Jevons): un producto al
    doble y otro a la mitad se compensan. Entran los productos de 2 o mas
    empresas, con precio de referencia, y solo los precios creibles.
    """
    logs: dict = {}
    for producto in indice.values():
        referencia = producto.get("precio_referencia")
        if not referencia or producto["empresas"] < 2:
            continue
        for cadena, precio in _precios_creibles(producto).items():
            valor = math.log(precio / referencia)
            for clave in ((cadena, producto["categoria"]), (cadena, None)):
                suma, n = logs.get(clave, (0.0, 0))
                logs[clave] = (suma + valor, n + 1)
    niveles = {"por_categoria": {}, "general": {}}
    for (cadena, categoria), (suma, n) in logs.items():
        if n < MINIMO_PRODUCTOS_NIVEL:
            continue
        nivel = math.exp(suma / n)
        if categoria is None:
            niveles["general"][cadena] = nivel
        else:
            niveles["por_categoria"][(cadena, categoria)] = nivel
    return niveles


# ---------------------------------------------------------------------------
# Donde comprar la lista cerca (openspec mi-compra)
#
# La misma pregunta que "Donde comprarla cerca" de Tu canasta -en cuantas
# paradas conviene y en cuales-, pero con los productos exactos de la lista. El
# precio de un producto exacto es el de la cadena para todo el pais, asi que a
# cada sucursal cercana se le asigna el precio de su cadena: todas las de una
# cadena quedan iguales, optimizar_compra se queda con la mas cercana, y en la
# practica elige entre 1, 2 y 3 cadenas. La sucursal es para ubicarse en el
# mapa, no un precio de esa sucursal.
# ---------------------------------------------------------------------------
RADIO_MAXIMO_DONDE_COMPRAR_KM = 10.0


def donde_comprar_lista(indice: dict, sucursales: list, es_farmacia, items: list[dict], latitud: float,
                        longitud: float, radio_km: float, max_sucursales: int = 3) -> dict:
    """sucursales/es_farmacia: las del indice del mapa (mapa_promos)."""
    from optimizar_compra import optimizar_compra, sucursales_en_radio

    radio_km = min(max(float(radio_km), 0.1), RADIO_MAXIMO_DONDE_COMPRAR_KM)
    max_sucursales = min(max(int(max_sucursales), 1), 3)
    pedidos: dict[str, int] = {}
    for item in items[:MAXIMO_PRODUCTOS_LISTA]:
        clave = str(item.get("id_producto", ""))
        cantidad = item.get("cantidad", 1)
        if isinstance(cantidad, bool) or not isinstance(cantidad, int):
            cantidad = 1
        if clave in indice:
            pedidos[clave] = pedidos.get(clave, 0) + min(max(cantidad, 1), MAXIMO_UNIDADES_POR_PRODUCTO)

    # Precio creible de cada producto en cada cadena (las farmacias no cuentan, como en Tu lista).
    precios_por_cadena: dict[str, dict[str, float]] = {}
    for clave in pedidos:
        for precio in indice[clave]["precios"]:
            if precio.get("precio_creible", True) and not precio.get("farmacia"):
                precios_por_cadena.setdefault(precio["cadena"], {})[clave] = float(precio["precio_mediano"])

    candidatas = [
        {**s, "id": i}
        for i, s in enumerate(sucursales)
        if not es_farmacia[i] and s["cadena"] in precios_por_cadena
    ]
    cercanas = sucursales_en_radio(candidatas, latitud, longitud, radio_km)
    for s in cercanas:
        s["precios"] = precios_por_cadena[s["cadena"]]
    crudo = optimizar_compra([{"clave": c, "cantidad": n} for c, n in pedidos.items()], cercanas, max_sucursales)

    por_id = {s["id"]: s for s in cercanas}
    opciones = []
    for opcion in crudo["opciones"]:
        elegidas = []
        for elegida in opcion["sucursales"]:
            s = por_id[elegida["id"]]
            direccion = " ".join(str(x) for x in (s.get("calle"), s.get("numero")) if x).strip()
            elegidas.append({
                "id": str(s["id"]),
                "cadena": s["cadena"],
                "nombre_sucursal": s["nombre_sucursal"],
                "direccion": direccion or None,
                "localidad": s["localidad"],
                "provincia": s["provincia"],
                "latitud": s["latitud"],
                "longitud": s["longitud"],
                "distancia_km": round(elegida["distancia_km"], 2),
                "subtotal": round(elegida["subtotal"], 2),
                "productos": [
                    {
                        "id_producto": item["clave"],
                        "descripcion": indice[item["clave"]]["descripcion"],
                        "cantidad": item["cantidad"],
                        "precio_unitario": item["precio_unitario"],
                        "costo": round(item["costo"], 2),
                    }
                    for item in elegida["items"]
                ],
            })
        opciones.append({
            "max_sucursales": opcion["max_sucursales"],
            "total": round(opcion["total"], 2),
            "productos_cubiertos": opcion["items_cubiertos"],
            "distancia_suma_km": round(opcion["distancia_suma_km"], 2),
            "sucursales": elegidas,
        })
    return {
        "radio_km": radio_km,
        "productos": len(pedidos),
        "sin_precio_cerca": [
            {"id_producto": c, "descripcion": indice[c]["descripcion"]} for c in crudo["items_sin_precio"]
        ],
        "opciones": opciones,
    }


# ---------------------------------------------------------------------------
# Rubros de Mis gastos (openspec app-para-el-usuario, 2026-11-27)
#
# Mis gastos agrupa lo gastado por rubro (Almacen, Lacteos...) en vez de por las
# categorias de SEPA, que son muy finas ("Otras" se llevaba el 50%). La
# taxonomia categoria -> rubro tiene un solo duenio, categorizar.py; llega a la
# API con cada producto del indice, asi que el mapa se arma de ahi, en memoria.
# ---------------------------------------------------------------------------
def rubros_por_categoria(indice: dict, nombrar) -> dict[str, str]:
    """{categoria: nombre del rubro para mostrar}. Si una categoria aparece con
    mas de un rubro, gana el mas comun."""
    conteo: dict[str, dict[str, int]] = {}
    for producto in indice.values():
        categoria, rubro = producto.get("categoria"), producto.get("rubro")
        if not categoria or not rubro:
            continue
        conteo.setdefault(categoria, {}).setdefault(rubro, 0)
        conteo[categoria][rubro] += 1
    return {
        categoria: nombrar(max(rubros, key=lambda r: (rubros[r], r)))
        for categoria, rubros in sorted(conteo.items())
    }
