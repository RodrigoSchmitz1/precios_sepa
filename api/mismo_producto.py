"""El mismo producto: busqueda, detalle y destacados sobre mart_mismo_producto.

La tabla se lee entera con leer_tabla (main.py), que no consume cuota, se refresca cada 6
horas (la cache de main.py) y se busca en memoria. Buscar con LIKE en BigQuery
escanearia la tabla en cada busqueda, y esta pagina invita justamente a buscar
muchas veces seguidas: un rato de uso podia comerse la cuota diaria.

Este modulo no conoce BigQuery: recibe filas y devuelve diccionarios, para
poder testearlo sin credenciales.
"""

import math
import re
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


def normalizar(texto: str | None) -> str:
    """Minusculas, sin tildes y con el tamano pegado: "Café 1 KG" y "cafe 1kg"
    tienen que encontrarse igual."""
    descompuesto = unicodedata.normalize("NFD", texto or "")
    plano = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn").lower()
    return TAMANO_SEPARADO.sub(r"\1\2", plano)


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
                "_texto": normalizar(
                    f"{fila['descripcion']} {fila['marca'] or ''} "
                    f"{_tamanos_buscables(fila.get('cantidad_normalizada'), fila.get('unidad_normalizada'))} "
                    f"{fila.get('textos_busqueda') or ''}"
                ),
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


def cotizar_lista(indice: dict, items: list[dict]) -> dict:
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
        precios = {p["cadena"]: p["precio_mediano"] for p in producto["precios"] if p["precio_creible"]} if producto else {}
        if not precios:
            no_encontrados.append(clave)
            continue
        cadena_barata = min(precios, key=lambda c: (precios[c], c))
        productos.append({
            **_resumen(producto),
            "cantidad": cantidad,
            "mas_barato": {"cadena": cadena_barata, "precio": precios[cadena_barata]},
            "_precios": precios,
        })

    cadenas = sorted({c for p in productos for c in p["_precios"]})
    por_cadena = []
    for cadena in cadenas:
        con_precio = [p for p in productos if cadena in p["_precios"]]
        por_cadena.append({
            "cadena": cadena,
            "total": round(sum(p["_precios"][cadena] * p["cantidad"] for p in con_precio), 2),
            "productos_con_precio": len(con_precio),
            "completa": len(con_precio) == len(productos),
            "faltan": [p["id_producto"] for p in productos if cadena not in p["_precios"]],
        })
    por_cadena.sort(key=lambda c: (not c["completa"], -c["productos_con_precio"], c["total"], c["cadena"]))

    combinada = round(sum(p["mas_barato"]["precio"] * p["cantidad"] for p in productos), 2)
    for p in productos:
        del p["_precios"]
    return {
        "productos": productos,
        "no_encontrados": no_encontrados,
        "cadenas": por_cadena,
        "combinando_cadenas": combinada,
        "fecha_datos": next((indice[p["id_producto"]]["fecha_datos"] for p in productos), None),
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
# ---------------------------------------------------------------------------

MINIMO_PRODUCTOS_CATEGORIA = 20
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
        cadena, veces = max(ganadas_por_categoria[categoria].items(), key=lambda e: (e[1], e[0]))
        categorias.append(
            {
                "categoria": categoria,
                "productos": len(valores),
                "ahorro_mediano_pct": round(_mediana(valores) * 100, 1),
                "cadena_mas_barata": cadena,
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
