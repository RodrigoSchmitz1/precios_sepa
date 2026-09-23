"""Promos del mapa resueltas en memoria: mover el mapa no consulta BigQuery."""

import heapq
import math
import statistics
from array import array
from collections import Counter
from itertools import groupby, islice, repeat

from mismo_producto import normalizar

CAMPOS_SUCURSAL = (
    "cadena",
    "nombre_sucursal",
    "calle",
    "numero",
    "barrio",
    "localidad",
    "provincia",
    "latitud",
    "longitud",
)
# nivel_evidencia entra aca y no como columna aparte: son tres valores
# repetidos en las 92 mil promos, y el diccionario "unicos" de armar_indice los
# deja en tres strings internados. Cuesta una referencia por fila.
CAMPOS_TEXTO = ("descripcion", "marca", "categoria", "rubro", "leyenda", "nivel_evidencia")
CAMPOS_NUMERO = ("precio_lista", "precio_promo", "descuento_pct")


class IndiceMapa:
    # Columnas paralelas ordenadas de mayor a menor descuento: la posicion de una
    # promo es su orden en el resultado. 1,5 M filas como dicts no entran en 512 MiB.
    __slots__ = (
        "sucursales",
        *CAMPOS_TEXTO,
        *CAMPOS_NUMERO,
        "texto",
        "inicio",
        "miembros",
        "por_sucursal",
    )


def armar_indice(sucursales, promos) -> IndiceMapa:
    """sucursales: filas de mart_mapa_sucursales. promos: filas de mart_mapa_promos."""
    indice = IndiceMapa()
    indice.sucursales = []
    posicion = {}
    for fila in sucursales:
        posicion[fila["sucursal"]] = len(indice.sucursales)
        indice.sucursales.append({campo: fila[campo] for campo in CAMPOS_SUCURSAL})

    # La misma leyenda o descripcion llega como un string nuevo en cada fila.
    unicos: dict = {}
    textos = {campo: [] for campo in CAMPOS_TEXTO}
    numeros = {campo: array("d") for campo in CAMPOS_NUMERO}
    inicio, miembros = array("I", [0]), array("I")
    for fila in promos:
        claves = sorted(posicion[c] for c in fila["sucursales"] if c in posicion)
        if not claves:
            continue
        for campo, valores in textos.items():
            valor = fila[campo]
            valores.append(unicos.setdefault(valor, valor) if valor is not None else None)
        for campo, valores in numeros.items():
            valores.append(fila[campo])
        miembros.extend(claves)
        inicio.append(len(miembros))

    descuento, promo, descripcion = numeros["descuento_pct"], numeros["precio_promo"], textos["descripcion"]
    orden = sorted(range(len(descuento)), key=lambda i: (-descuento[i], promo[i], descripcion[i] or ""))

    for campo, valores in textos.items():
        setattr(indice, campo, [valores[i] for i in orden])
    for campo, valores in numeros.items():
        setattr(indice, campo, array("d", (valores[i] for i in orden)))
    indice.inicio, indice.miembros = array("I", [0]), array("I")
    for i in orden:
        indice.miembros.extend(miembros[inicio[i] : inicio[i + 1]])
        indice.inicio.append(len(indice.miembros))

    minusculas = {d: d.lower() for d in set(indice.descripcion) if d is not None}
    indice.texto = [minusculas.get(d) for d in indice.descripcion]

    # Por sucursal, las posiciones quedan ascendentes (de mayor a menor descuento),
    # asi que el recuadro se resuelve fusionando listas ya ordenadas.
    indice.por_sucursal = [array("I") for _ in indice.sucursales]
    for pos in range(len(orden)):
        for suc in indice.miembros[indice.inicio[pos] : indice.inicio[pos + 1]]:
            indice.por_sucursal[suc].append(pos)
    return indice


def _fila(indice: IndiceMapa, pos: int, sucs: list[int]) -> dict:
    """Una promo con TODAS las sucursales de la zona donde vale.

    Antes era una fila por promo x sucursal y el listado repetia la misma promo
    una vez por local: el repelente de Dia ocupaba pantallas enteras porque esta
    en cientos de sucursales. La promo es una sola; donde encontrarla es un
    detalle que se pide cuando se quiere.

    Los campos de la primera sucursal se siguen mandando sueltos para que la
    fila pueda mostrar una direccion sin abrir nada. Se elige la primera de la
    zona, no una cualquiera: la lista viene ordenada por sucursal, asi que es
    estable entre pedidos iguales.

    Las sucursales van como NUMEROS, no como diccionarios, y todas, sin tope. Una
    primera version mandaba hasta 40 sucursales completas por promo: 3,5 MB por
    respuesta, 134 promos recortadas en CABA, y el mapa -que ubicaba cada promo
    en su primera sucursal- pasaba de 517 marcadores a 250. Con numeros y una
    tabla aparte (ver tabla_de_sucursales), cada sucursal viaja una sola vez.
    """
    primera = indice.sucursales[sucs[0]]
    return {
        "descripcion": indice.descripcion[pos],
        "marca": indice.marca[pos],
        "categoria": indice.categoria[pos],
        "rubro": indice.rubro[pos],
        **primera,
        "precio_lista": indice.precio_lista[pos],
        "precio_promo": indice.precio_promo[pos],
        "descuento_pct": indice.descuento_pct[pos],
        "leyenda": indice.leyenda[pos],
        "nivel_evidencia": indice.nivel_evidencia[pos],
        "sucursales": sucs,
        "total_sucursales": len(sucs),
    }


def tabla_de_sucursales(indice: IndiceMapa, filas: list[dict]) -> dict:
    """Las sucursales que nombran las filas, cada una una sola vez, por numero.

    Las claves van como texto porque JSON no tiene claves numericas; la pagina
    busca con el mismo numero que viene en la fila.
    """
    usadas = {s for fila in filas for s in fila["sucursales"]}
    return {str(s): indice.sucursales[s] for s in sorted(usadas)}


def buscar(
    indice: IndiceMapa,
    busqueda: str | None = None,
    provincia: str | None = None,
    lat_min: float | None = None,
    lat_max: float | None = None,
    lng_min: float | None = None,
    lng_max: float | None = None,
    limite: int = 500,
) -> tuple[list[dict], bool]:
    """Una fila por PROMO, de mayor a menor descuento, y si quedaron mas afuera.

    Mismos filtros que la consulta que reemplaza: el recuadro se aplica solo con
    los dos limites de cada eje, y la busqueda es por texto en la descripcion.
    """
    en_zona = [
        i
        for i, s in enumerate(indice.sucursales)
        if (not provincia or s["provincia"] == provincia)
        and (lat_min is None or lat_max is None or lat_min <= s["latitud"] <= lat_max)
        and (lng_min is None or lng_max is None or lng_min <= s["longitud"] <= lng_max)
    ]

    if busqueda:
        palabra = busqueda.lower()
        marcadas = bytearray(len(indice.sucursales))
        for suc in en_zona:
            marcadas[suc] = 1
        pares = (
            (pos, suc)
            for pos, texto in enumerate(indice.texto)
            if texto is not None and palabra in texto
            for suc in indice.miembros[indice.inicio[pos] : indice.inicio[pos + 1]]
            if marcadas[suc]
        )
    else:
        pares = heapq.merge(*(zip(indice.por_sucursal[suc], repeat(suc)) for suc in en_zona))

    # heapq.merge entrega los pares ordenados por posicion, asi que los de una
    # misma promo llegan seguidos y alcanza con agrupar consecutivos: no hace
    # falta juntar todo en memoria para saber cuantas sucursales tiene cada una.
    grupos = groupby(pares, key=lambda par: par[0])
    seleccion = [(pos, [suc for _, suc in grupo]) for pos, grupo in islice(grupos, limite + 1)]
    return [_fila(indice, pos, sucs) for pos, sucs in seleccion[:limite]], len(seleccion) > limite


# ---------------------------------------------------------------------------
# Lugares para el buscador del mapa
# ---------------------------------------------------------------------------

# Un lugar cuyas sucursales estan, en la mediana, a mas de esto de su centro no
# es una localidad: es una provincia cargada en el campo de localidad. Medido el
# 2026-09-23: "BUENOS AIRES" agrupaba 423 sucursales en 796 km, y lo mismo
# pasaba con CORRIENTES, ENTRE RIOS y SANTA FE. Llevar el mapa a su "centro"
# dejaria al usuario en medio del campo.
DISPERSION_MAXIMA_KM = 15

# Dos lugares con el mismo nombre a menos de esto son el mismo lugar cargado
# distinto. Ver lugares().
DISTANCIA_MISMO_LUGAR_KM = 20

PALABRAS_EN_MINUSCULA = {"de", "del", "la", "las", "los", "el", "y"}


def _nombre_legible(nombre: str) -> str:
    """Las cadenas escriben la misma localidad en mayusculas o no ("AGRONOMIA",
    "Ciudad de Salta"). Se pasa a titulo, con los articulos en minuscula."""
    if not nombre.isupper():
        return nombre
    palabras = nombre.lower().split()
    return " ".join(
        p if i > 0 and p in PALABRAS_EN_MINUSCULA else p.capitalize() for i, p in enumerate(palabras)
    )


def _km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia aproximada, sobrada para decidir si un lugar es compacto."""
    return math.hypot((lat2 - lat1) * 111.0, (lng2 - lng1) * 111.0 * math.cos(math.radians((lat1 + lat2) / 2)))


def lugares(indice: IndiceMapa) -> list[dict]:
    """Localidades y barrios con sucursales, para que el mapa pueda ir a uno.

    Se buscan los dos campos porque dicen cosas distintas: en CABA la localidad
    es "Capital Federal" para todo el distrito y el barrio es lo que la gente
    escribe ("Palermo"); en el resto del pais el barrio suele traer el partido.

    El centro es la MEDIANA de las sucursales y no el promedio ni el rectangulo
    que las contiene. Hay sucursales con coordenadas rotas -las 8 de Moreno se
    repartian en 10.745 km- y una sola alcanza para correr un promedio o
    estirar un rectangulo hasta otro continente; la mediana ni se entera.
    """
    grupos: dict = {}
    for i, s in enumerate(indice.sucursales):
        for campo in ("barrio", "localidad"):
            nombre = (s.get(campo) or "").strip()
            if len(nombre) < 3 or not any(c.isalpha() for c in nombre):
                continue
            clave = (normalizar(nombre), s["provincia"])
            grupo = grupos.setdefault(clave, {"nombres": Counter(), "sucursales": set(), "provincias": Counter()})
            grupo["nombres"][nombre] += 1
            grupo["sucursales"].add(i)
            grupo["provincias"][s["provincia"]] += 1

    def centro(sucursales: set) -> tuple[float, float]:
        puntos = [indice.sucursales[i] for i in sucursales]
        return (statistics.median(p["latitud"] for p in puntos), statistics.median(p["longitud"] for p in puntos))

    # Mismo nombre y centros a menos de DISTANCIA_MISMO_LUGAR_KM: es el mismo
    # lugar cargado distinto. Pasa con sucursales sin provincia ("Salta" sin
    # codigo junto a "Salta" en AR-A) y con provincias mal cargadas (23 de
    # Cordoba marcadas como CABA). Sin fusionar, el buscador ofrecia "Salta" dos
    # veces y "Cordoba, CABA". Se procesa de mayor a menor, asi la provincia que
    # queda es la de la mayoria.
    por_nombre: dict = {}
    for (norma, _), grupo in grupos.items():
        por_nombre.setdefault(norma, []).append(grupo)
    fusionados = []
    for candidatos in por_nombre.values():
        candidatos.sort(key=lambda g: -len(g["sucursales"]))
        propios: list = []
        for g in candidatos:
            c = centro(g["sucursales"])
            destino = next((f for f in propios if _km(*c, *f["centro"]) < DISTANCIA_MISMO_LUGAR_KM), None)
            if destino is None:
                propios.append({**g, "centro": c})
            else:
                destino["sucursales"] = destino["sucursales"] | g["sucursales"]
                destino["nombres"] = destino["nombres"] + g["nombres"]
                destino["provincias"] = destino["provincias"] + g["provincias"]
        fusionados.extend(propios)

    resultado = []
    for grupo in fusionados:
        puntos = [indice.sucursales[i] for i in grupo["sucursales"]]
        lat, lng = centro(grupo["sucursales"])
        dispersion = statistics.median(_km(lat, lng, p["latitud"], p["longitud"]) for p in puntos)
        if dispersion > DISPERSION_MAXIMA_KM:
            continue
        provincias = [(n, prov) for prov, n in grupo["provincias"].items() if prov]
        resultado.append(
            {
                "nombre": _nombre_legible(grupo["nombres"].most_common(1)[0][0]),
                "provincia": max(provincias)[1] if provincias else None,
                "latitud": lat,
                "longitud": lng,
                "sucursales": len(puntos),
            }
        )
    resultado.sort(key=lambda l: (-l["sucursales"], l["nombre"]))
    return resultado

