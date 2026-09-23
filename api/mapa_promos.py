"""Promos del mapa resueltas en memoria: mover el mapa no consulta BigQuery."""

import heapq
from array import array
from itertools import islice, repeat

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
CAMPOS_TEXTO = ("descripcion", "marca", "categoria", "rubro", "leyenda")
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


def _fila(indice: IndiceMapa, pos: int, suc: int) -> dict:
    s = indice.sucursales[suc]
    return {
        "descripcion": indice.descripcion[pos],
        "marca": indice.marca[pos],
        "categoria": indice.categoria[pos],
        "rubro": indice.rubro[pos],
        **s,
        "precio_lista": indice.precio_lista[pos],
        "precio_promo": indice.precio_promo[pos],
        "descuento_pct": indice.descuento_pct[pos],
        "leyenda": indice.leyenda[pos],
    }


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
    """Una fila por promo x sucursal, de mayor a menor descuento, y si quedaron mas afuera.

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

    seleccion = list(islice(pares, limite + 1))
    return [_fila(indice, pos, suc) for pos, suc in seleccion[:limite]], len(seleccion) > limite
