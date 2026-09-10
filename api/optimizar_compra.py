"""
Optimizacion de la compra de una canasta entre sucursales cercanas (Fase 4).

Dada una canasta (items con su cantidad) y las sucursales dentro de un radio,
encuentra la combinacion de hasta K sucursales que minimiza el costo total si
cada item se compra en la sucursal mas barata del grupo.

Es un problema de seleccion de subconjuntos: con N sucursales hay C(N, K)
combinaciones. Se resuelve EXACTO, probando todas, porque K es chico (1 a 3) y
N se achica mucho antes de enumerar:

1. Sucursales con el mismo costo en todos los items de la canasta son
   intercambiables (las cadenas suelen tener precio nacional): se deja la mas
   cercana y se cuenta cuantas equivalentes tiene.
2. Una sucursal que es igual o mas cara en todo, que no vende nada que otra no
   venda y que ademas esta igual o mas lejos, nunca puede mejorar una
   combinacion: se descarta. Sin la condicion de distancia se podria perder el
   desempate, y el resultado dejaria de ser exacto.

Orden entre dos combinaciones: primero la que consigue mas items de la canasta,
despues la mas barata, despues la de menor suma de distancias. Primero la
cobertura porque una combinacion "barata" que no trae la mitad de la canasta no
es mas barata: es otra canasta.

La opcion de K sucursales es la mejor entre las combinaciones de 1 a K. Asi
nunca incluye una sucursal a la que no se le compra nada: esa combinacion
empata en costo con la misma sin esa sucursal y pierde en distancia.

Este modulo no conoce BigQuery ni la API: recibe estructuras simples y devuelve
estructuras simples, para poder verificarlo contra una busqueda exhaustiva.
"""

import math
from itertools import combinations

RADIO_TIERRA_KM = 6371.0088
INF = float("inf")


def distancia_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia sobre la superficie terrestre, en km (formula de haversine)."""
    f1, f2 = math.radians(lat1), math.radians(lat2)
    dfi = f2 - f1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dfi / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dlambda / 2) ** 2
    return 2 * RADIO_TIERRA_KM * math.asin(math.sqrt(a))


def sucursales_en_radio(sucursales: list, lat: float, lon: float, radio_km: float) -> list:
    """Sucursales a radio_km o menos del punto, con su distancia, de la mas cercana a la mas lejana.

    Cada sucursal necesita "latitud" y "longitud"; se devuelve una copia con
    "distancia_km" agregado.
    """
    cercanas = []
    for s in sucursales:
        d = distancia_km(lat, lon, s["latitud"], s["longitud"])
        if d <= radio_km:
            cercanas.append({**s, "distancia_km": d})
    cercanas.sort(key=lambda s: s["distancia_km"])
    return cercanas


def _evaluar(costos: list, distancia: float, cantidad_items: int) -> tuple:
    """Clave de orden de una combinacion: menor es mejor.

    (-items cubiertos, costo total de los cubiertos, suma de distancias).
    """
    total = sum(costos)
    if total != INF:
        return (-cantidad_items, total, distancia)
    finitos = [c for c in costos if c != INF]
    return (-len(finitos), sum(finitos), distancia)


def _agrupar_iguales(sucursales: list, claves: list, cantidades: dict) -> list:
    """Paso 1: una sucursal por vector de costos, la mas cercana."""
    grupos: dict = {}
    for s in sucursales:
        vector = tuple(
            s["precios"][c] * cantidades[c] if c in s["precios"] else INF for c in claves
        )
        if all(x == INF for x in vector):
            continue  # no vende nada de la canasta
        actual = grupos.get(vector)
        if actual is None:
            grupos[vector] = {
                "id": s["id"],
                "distancia_km": s["distancia_km"],
                "vector": vector,
                "equivalentes": 0,
            }
        elif s["distancia_km"] < actual["distancia_km"]:
            grupos[vector] = {
                "id": s["id"],
                "distancia_km": s["distancia_km"],
                "vector": vector,
                "equivalentes": actual["equivalentes"] + 1,
            }
        else:
            actual["equivalentes"] += 1
    return list(grupos.values())


def _descartar_dominadas(distintas: list) -> list:
    """Paso 2: saca las sucursales que otra supera en costo sin estar mas lejos.

    Despues del paso 1 no hay dos vectores iguales, asi que si b domina a a y a
    domina a b a la vez los vectores serian identicos: no puede pasar, y el orden
    en que se descartan no cambia el resultado.
    """
    candidatas = []
    for a in distintas:
        dominada = any(
            b is not a
            and b["distancia_km"] <= a["distancia_km"]
            and all(vb <= va for vb, va in zip(b["vector"], a["vector"]))
            for b in distintas
        )
        if not dominada:
            candidatas.append(a)
    return candidatas


def _mejor_combinacion_de_tamano(candidatas: list, tamano: int, cantidad_items: int):
    """Mejor combinacion de exactamente `tamano` candidatas. Devuelve (clave, indices)."""
    n = len(candidatas)
    vectores = [c["vector"] for c in candidatas]
    distancias = [c["distancia_km"] for c in candidatas]
    mejor_clave, mejores = None, None

    if tamano == 1:
        for i in range(n):
            clave = _evaluar(vectores[i], distancias[i], cantidad_items)
            if mejor_clave is None or clave < mejor_clave:
                mejor_clave, mejores = clave, (i,)
        return mejor_clave, mejores

    if tamano == 2:
        for i, j in combinations(range(n), 2):
            minimos = list(map(min, vectores[i], vectores[j]))
            clave = _evaluar(minimos, distancias[i] + distancias[j], cantidad_items)
            if mejor_clave is None or clave < mejor_clave:
                mejor_clave, mejores = clave, (i, j)
        return mejor_clave, mejores

    if tamano == 3:
        for i, j in combinations(range(n), 2):
            par = list(map(min, vectores[i], vectores[j]))
            distancia_par = distancias[i] + distancias[j]
            for k in range(j + 1, n):
                total = sum(map(min, par, vectores[k]))
                distancia = distancia_par + distancias[k]
                if total != INF:
                    clave = (-cantidad_items, total, distancia)
                else:
                    clave = _evaluar(list(map(min, par, vectores[k])), distancia, cantidad_items)
                if mejor_clave is None or clave < mejor_clave:
                    mejor_clave, mejores = clave, (i, j, k)
        return mejor_clave, mejores

    raise ValueError("Se admiten combinaciones de 1 a 3 sucursales")


def optimizar_compra(items: list, sucursales: list, max_sucursales: int = 3) -> dict:
    """Mejor forma de comprar la canasta en 1, 2, ... max_sucursales sucursales.

    items: lista de {"clave": hashable, "cantidad": numero}. La clave identifica
        lo que se compra (en la API, categoria x gama x unidad).
    sucursales: lista de {"id": hashable, "distancia_km": numero,
        "precios": {clave: precio_unitario}}. Una clave ausente significa que la
        sucursal no tiene precio para ese item.

    Devuelve:
        items_sin_precio: claves que ninguna sucursal vende; quedan afuera.
        sucursales_en_zona, sucursales_distintas, sucursales_candidatas: cuantas
            habia, cuantas con costos distintos y cuantas quedaron para enumerar.
        opciones: una por K, de 1 a max_sucursales, cada una con las sucursales
            elegidas, que se compra en cada una, el total y la cobertura.
    """
    if not 1 <= max_sucursales <= 3:
        raise ValueError("max_sucursales tiene que estar entre 1 y 3")

    cantidades: dict = {}
    for item in items:
        cantidades[item["clave"]] = cantidades.get(item["clave"], 0) + item["cantidad"]

    con_precio = {c for s in sucursales for c in s["precios"]}
    claves = [c for c in cantidades if c in con_precio]
    sin_precio = [c for c in cantidades if c not in con_precio]

    distintas = _agrupar_iguales(sucursales, claves, cantidades)
    candidatas = _descartar_dominadas(distintas)

    resultado = {
        "items_sin_precio": sin_precio,
        "sucursales_en_zona": len(sucursales),
        "sucursales_distintas": len(distintas),
        "sucursales_candidatas": len(candidatas),
        "opciones": [],
    }
    if not candidatas or not claves:
        return resultado

    mejor_clave, mejores = None, None
    for k in range(1, max_sucursales + 1):
        if k <= len(candidatas):
            clave, indices = _mejor_combinacion_de_tamano(candidatas, k, len(claves))
            if mejor_clave is None or clave < mejor_clave:
                mejor_clave, mejores = clave, indices
        resultado["opciones"].append(
            _armar_opcion(k, [candidatas[i] for i in mejores], claves, cantidades)
        )
    return resultado


def _armar_opcion(k: int, elegidas: list, claves: list, cantidades: dict) -> dict:
    """Asigna cada item a la sucursal mas barata de la combinacion (a igual costo, la mas cercana)."""
    por_sucursal = {id(s): {"sucursal": s, "items": [], "subtotal": 0.0} for s in elegidas}
    cubiertos = 0
    total = 0.0
    for posicion, clave in enumerate(claves):
        opciones_item = [s for s in elegidas if s["vector"][posicion] != INF]
        if not opciones_item:
            continue
        elegida = min(opciones_item, key=lambda s: (s["vector"][posicion], s["distancia_km"]))
        costo = elegida["vector"][posicion]
        grupo = por_sucursal[id(elegida)]
        grupo["items"].append({
            "clave": clave,
            "cantidad": cantidades[clave],
            "precio_unitario": costo / cantidades[clave] if cantidades[clave] else 0.0,
            "costo": costo,
        })
        grupo["subtotal"] += costo
        cubiertos += 1
        total += costo

    usadas = [g for g in por_sucursal.values() if g["items"]]
    usadas.sort(key=lambda g: g["sucursal"]["distancia_km"])
    return {
        "max_sucursales": k,
        "sucursales": [
            {
                "id": g["sucursal"]["id"],
                "distancia_km": g["sucursal"]["distancia_km"],
                "equivalentes": g["sucursal"]["equivalentes"],
                "items": g["items"],
                "subtotal": g["subtotal"],
            }
            for g in usadas
        ],
        "total": total,
        "items_cubiertos": cubiertos,
        "items_con_precio_en_zona": len(claves),
        "distancia_suma_km": sum(g["sucursal"]["distancia_km"] for g in usadas),
    }
