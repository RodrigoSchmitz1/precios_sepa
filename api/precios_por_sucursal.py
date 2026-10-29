"""Precios por sucursal en memoria, para optimizar la compra de la canasta.

Carga mart_precio_categoria_sucursal una vez cada 6 horas y arma un indice por
sucursal. Optimizar es un problema de busqueda sobre esos precios, no una
consulta: resolverlo en BigQuery seria una query por visitante y por cada cambio
de radio, que es justo lo que la cuota diaria no aguanta.

Este modulo no conoce BigQuery: recibe filas y devuelve diccionarios, asi que se
puede testear sin credenciales.
"""

import sys

from optimizar_compra import optimizar_compra, sucursales_en_radio

# Radio y cantidad de sucursales que la API acepta. El radio tiene tope porque
# el optimizador enumera combinaciones: con un radio grande en el AMBA entrarian
# cientos de sucursales y la busqueda dejaria de ser instantanea.
RADIO_MAXIMO_KM = 10.0
MAXIMO_SUCURSALES = 3


def clave_de(categoria: str, gama: str, unidad: str) -> str:
    """Identifica lo que se compra. Se internan las cadenas porque la misma
    combinacion se repite en cada una de las ~1.400 sucursales: internadas, el
    indice guarda un puntero por entrada y no una copia del texto."""
    return sys.intern(f"{categoria}|{gama}|{unidad}")


def armar_indice(filas) -> dict:
    """Agrupa las filas del mart (una por categoria x gama x unidad x sucursal)
    en una lista de sucursales con sus precios."""
    sucursales: dict = {}
    fecha = None
    for fila in filas:
        clave_sucursal = (fila["id_comercio"], fila["id_sucursal"])
        sucursal = sucursales.get(clave_sucursal)
        if sucursal is None:
            direccion = " ".join(str(x) for x in (fila.get("calle"), fila.get("numero")) if x).strip()
            sucursal = sucursales[clave_sucursal] = {
                "id": f"{fila['id_comercio']}-{fila['id_sucursal']}",
                "cadena": fila["cadena"],
                "nombre_sucursal": fila["nombre_sucursal"],
                "direccion": direccion or None,
                "localidad": fila["localidad"],
                "provincia": fila["provincia"],
                "latitud": fila["latitud"],
                "longitud": fila["longitud"],
                "precios": {},
            }
        sucursal["precios"][clave_de(fila["categoria"], fila["gama"], fila["unidad_normalizada"])] = (
            fila["precio_mediano_unidad"]
        )
        fecha = fecha or str(fila["fecha_datos"])
    return {"sucursales": list(sucursales.values()), "fecha_datos": fecha}


def _descomponer(clave: str) -> dict:
    categoria, gama, unidad = clave.split("|")
    return {"categoria": categoria, "gama": gama, "unidad": unidad}


def optimizar(indice: dict, items: list, latitud: float, longitud: float, radio_km: float,
              max_sucursales: int = MAXIMO_SUCURSALES) -> dict:
    """Resuelve la compra en 1, 2 y 3 sucursales dentro del radio.

    items: lista de {"categoria", "gama", "unidad", "cantidad"}, como los de Tu
    canasta. Devuelve lo mismo que optimizar_compra, pero con las claves y los
    ids traducidos a algo que la pantalla pueda mostrar.
    """
    radio_km = min(max(float(radio_km), 0.1), RADIO_MAXIMO_KM)
    max_sucursales = min(max(int(max_sucursales), 1), MAXIMO_SUCURSALES)

    cercanas = sucursales_en_radio(indice["sucursales"], latitud, longitud, radio_km)
    pedidos = [
        {"clave": clave_de(i["categoria"], i["gama"], i["unidad"]), "cantidad": i["cantidad"]}
        for i in items
    ]
    crudo = optimizar_compra(pedidos, cercanas, max_sucursales)

    por_id = {s["id"]: s for s in cercanas}
    datos_visibles = ("id", "cadena", "nombre_sucursal", "direccion", "localidad", "provincia",
                      "latitud", "longitud")

    opciones = []
    for opcion in crudo["opciones"]:
        sucursales = []
        for elegida in opcion["sucursales"]:
            sucursal = por_id[elegida["id"]]
            sucursales.append({
                **{campo: sucursal[campo] for campo in datos_visibles},
                "distancia_km": round(elegida["distancia_km"], 2),
                # Cuantas sucursales de la zona tienen exactamente los mismos
                # precios: sin esto, "la mas barata" parece unica cuando en
                # realidad hay varias iguales y se eligio la mas cercana.
                "equivalentes": elegida["equivalentes"],
                "subtotal": round(elegida["subtotal"], 2),
                "items": [
                    {
                        **_descomponer(item["clave"]),
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
            "items_cubiertos": opcion["items_cubiertos"],
            "distancia_suma_km": round(opcion["distancia_suma_km"], 2),
            "sucursales": sucursales,
        })

    return {
        "fecha_datos": indice["fecha_datos"],
        "radio_km": radio_km,
        "sucursales_en_zona": crudo["sucursales_en_zona"],
        "sucursales_candidatas": crudo["sucursales_candidatas"],
        "items_sin_precio": [_descomponer(c) for c in crudo["items_sin_precio"]],
        "opciones": opciones,
    }


# ---------------------------------------------------------------------------
# Tu canasta en cada cadena (2026-10-14)
#
# "Si hago toda la compra en un solo lugar, ¿cuanto me sale en cada uno?". Es la
# pregunta de quien elige super, mayorista incluido, y sale del mismo indice en
# memoria: no consulta BigQuery.
#
# Dos reglas para que los totales se puedan comparar, medidas sobre la canasta
# basica del INDEC del 2026-10-09:
#
# 1. GAMA DE RESPALDO. La gama corta tercios dentro de cada categoria para todo
#    el mercado, asi que hay cadenas sin productos en el tercio pedido (Vea,
#    Jumbo y Disco no tenian 6 de las 32 categorias en gama economica). Si la
#    cadena no tiene la gama pedida se usa la VECINA, primero la de arriba: es
#    lo que pagaria quien compra ahi. Solo la vecina: saltar de economica a
#    premium ponia la leche de Vea a $12.500 el litro y su verdura a $36.000 el
#    kilo, y Vea salia al doble que Dia. Se informa cuantas.
#
# 1b. PRECIOS CREIBLES. Para cada categoria se toma la mediana entre cadenas, y
#    el precio de una cadena que esta a menos de la mitad o a mas del doble no
#    cuenta (la misma regla que El mismo producto): es un producto raro o un
#    error de la fuente, no la compra de nadie.
#
# 2. SOLO LO QUE VENDEN TODAS. Una cadena a la que le falta la carne suma menos
#    porque compra menos, no porque sea mas barata. Entran las cadenas que
#    cubren al menos COBERTURA_MINIMA de la canasta, y el total de cada una se
#    hace sobre las categorias que tienen TODAS esas cadenas. Las que quedan
#    afuera se dicen.
# ---------------------------------------------------------------------------
GAMAS = ("economico", "medio", "premium")
COBERTURA_MINIMA = 0.8
# Con menos categorias en comun la comparacion deja de ser "tu canasta".
CATEGORIAS_COMUNES_MINIMAS = 3


def _gamas_de_respaldo(gama: str) -> list:
    """La pedida y despues sus vecinas, primero la de arriba."""
    if gama not in GAMAS:
        return [GAMAS[0]]
    i = GAMAS.index(gama)
    return [GAMAS[j] for j in (i, i + 1, i - 1) if 0 <= j < len(GAMAS)]


def _mediana(valores: list) -> float:
    ordenados = sorted(valores)
    n = len(ordenados)
    medio = n // 2
    return ordenados[medio] if n % 2 else (ordenados[medio - 1] + ordenados[medio]) / 2


def _total_con_niveles(cadena: str, pedidos: list, comunes: list, tabla: dict, entran: list, niveles: dict) -> tuple:
    """Total de la canasta en una cadena con el metodo de productos identicos.

    Cada item vale lo mismo para todas las cadenas (la mediana entre ellas de su
    precio en esa categoria) multiplicado por el NIVEL de la cadena: cuanto mas
    cara o mas barata es, en productos identicos, que el precio tipico del
    mercado. Sin productos identicos en la categoria (la carne fresca: cada
    cadena codifica sus cortes) se usa su nivel general; sin ningun nivel, su
    propio precio, como antes. Devuelve el total y cuantas categorias usaron el
    nivel general y cuantas el precio propio: van separadas porque la pagina
    dice "va el nivel general" y antes contaba las dos juntas (auditoria
    2026-10-28).
    """
    total = 0.0
    con_nivel_general = con_precio_propio = 0
    for j in comunes:
        referencia = _mediana([tabla[c][j][0] for c in entran])
        nivel = niveles["por_categoria"].get((cadena, pedidos[j]["categoria"]))
        if nivel is None:
            nivel = niveles["general"].get(cadena)
            if nivel is None:
                con_precio_propio += 1
            else:
                con_nivel_general += 1
        precio = referencia * nivel if nivel is not None else tabla[cadena][j][0]
        total += precio * pedidos[j]["cantidad"]
    return round(total, 2), con_nivel_general, con_precio_propio


def canasta_por_cadena(indice: dict, items: list, localidades: list | None = None, niveles: dict | None = None) -> dict:
    """Cuanto sale la canasta en cada cadena: las sucursales de la zona si se
    eligio una y tiene al menos dos cadenas, las de todo el pais si no.

    Con `niveles` (mismo_producto.niveles_por_cadena) cada cadena se compara
    por su precio en productos IDENTICOS; sin ellos, por la mediana de la gama
    pedida en sus sucursales.

    PRODUCTOS IDENTICOS (2026-10-28). La mediana de la gama economica de cada
    cadena ponia a Jumbo como la canasta mas barata del pais, cuando en
    productos identicos es 6 a 14% mas cara que Maxi, Dia, Coto y Carrefour. La
    gama corta el tercio barato con un umbral del MERCADO, asi que cada cadena
    queda con distintos productos debajo: en carne, Jumbo tenia solo puchero y
    dos picadas comunes ($7.165 el kilo) y Maxi muchos cortes, varios mas
    baratos que esos pero tambien otros cerca del corte ($12.995 de mediana).
    Tener mas surtido barato subia la mediana. Con 4,44 kg de carne en la
    canasta, esa sola linea le daba a Jumbo $25.885 de ventaja. Comparar sobre
    productos identicos es como lo hacen los indices de precios entre comercios
    y como ya lo hace Mas barato, asi que las dos secciones dicen lo mismo.
    """
    pedidos = [i for i in items if i.get("cantidad") and i.get("categoria") and i.get("unidad")]
    zona = {(l.get("localidad"), l.get("provincia")) for l in (localidades or [])}
    sucursales = indice["sucursales"]
    ambito = "pais"
    if zona:
        en_zona = [s for s in sucursales if (s["localidad"], s["provincia"]) in zona]
        if len({s["cadena"] for s in en_zona}) >= 2:
            sucursales, ambito = en_zona, "zona"

    claves = {clave_de(i["categoria"], g, i["unidad"]) for i in pedidos for g in GAMAS}
    precios: dict = {}
    cuantas: dict = {}
    for s in sucursales:
        cuantas[s["cadena"]] = cuantas.get(s["cadena"], 0) + 1
        de_la_cadena = precios.setdefault(s["cadena"], {})
        for clave, precio in s["precios"].items():
            if clave in claves:
                de_la_cadena.setdefault(clave, []).append(precio)

    # Precio de cada item en cada cadena, con gama de respaldo.
    tabla: dict = {}
    for cadena, de_la_cadena in precios.items():
        fila = []
        for item in pedidos:
            encontrado = None
            for gama in _gamas_de_respaldo(item.get("gama", "economico")):
                lista = de_la_cadena.get(clave_de(item["categoria"], gama, item["unidad"]))
                if lista:
                    encontrado = (_mediana(lista), gama != item.get("gama"))
                    break
            fila.append(encontrado)
        tabla[cadena] = fila

    # Precios creibles: fuera de [mitad, doble] de la mediana entre cadenas no cuenta.
    for j in range(len(pedidos)):
        valores = [tabla[c][j][0] for c in tabla if tabla[c][j] is not None]
        if len(valores) < 3:
            continue
        referencia = _mediana(valores)
        for c in tabla:
            if tabla[c][j] is not None and not (referencia / 2 <= tabla[c][j][0] <= referencia * 2):
                tabla[c][j] = None

    def cobertura(cadena):
        return sum(p is not None for p in tabla[cadena])

    minimo = COBERTURA_MINIMA * len(pedidos)
    entran = [c for c in tabla if pedidos and cobertura(c) >= minimo]
    comunes = [j for j in range(len(pedidos)) if entran and all(tabla[c][j] is not None for c in entran)]
    if len(comunes) < CATEGORIAS_COMUNES_MINIMAS:
        entran, comunes = [], []

    filas = []
    for c in entran:
        fila = {
            "cadena": c,
            "con_otra_gama": sum(tabla[c][j][1] for j in comunes),
            "sucursales": cuantas[c],
        }
        if niveles:
            fila["total"], fila["con_nivel_general"], fila["con_precio_propio"] = _total_con_niveles(
                c, pedidos, comunes, tabla, entran, niveles
            )
        else:
            fila["total"] = round(sum(tabla[c][j][0] * pedidos[j]["cantidad"] for j in comunes), 2)
        filas.append(fila)
    cadenas = sorted(filas, key=lambda f: (f["total"], f["cadena"]))
    return {
        "metodo": "productos_identicos" if niveles else "mediana_de_la_gama",
        "ambito": ambito,
        "cadenas": cadenas,
        "categorias_comparadas": [pedidos[j]["categoria"] for j in comunes],
        "categorias_afuera": [pedidos[j]["categoria"] for j in range(len(pedidos)) if j not in comunes],
        "cadenas_afuera": sorted(
            ({"cadena": c, "categorias_con_precio": cobertura(c)} for c in tabla if c not in entran),
            key=lambda f: -f["categorias_con_precio"],
        ),
        "total_categorias": len(pedidos),
        "fecha_datos": indice["fecha_datos"],
    }
