"""Promos del mapa resueltas en memoria: mover el mapa no consulta BigQuery."""

import heapq
from bisect import bisect_left, bisect_right
import math
import re
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
# id_producto entra para las promos de Tu lista y del detalle (openspec
# promos-de-tu-lista); como texto repetido, tambien lo deduplica "unicos".
CAMPOS_TEXTO = ("id_producto", "descripcion", "marca", "categoria", "rubro", "leyenda", "nivel_evidencia")
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
        "multiple",
        "vigente_hasta",
        "por_producto",
        "promos_por_sucursal",
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
    multiple = bytearray()
    for fila in promos:
        claves = sorted(posicion[c] for c in fila["sucursales"] if c in posicion)
        if not claves:
            continue
        for campo, valores in textos.items():
            valor = fila.get(campo)
            valores.append(unicos.setdefault(valor, valor) if valor is not None else None)
        for campo, valores in numeros.items():
            valores.append(fila[campo])
        multiple.append(1 if fila.get("requiere_compra_multiple") else 0)
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

    indice.multiple = bytearray(multiple[i] for i in orden)
    hasta = {l: vigencia_de(l) for l in set(indice.leyenda) if l is not None}
    indice.vigente_hasta = [hasta.get(l) for l in indice.leyenda]
    indice.por_producto = {}
    for pos, id_producto in enumerate(indice.id_producto):
        if id_producto is not None:
            indice.por_producto.setdefault(str(id_producto), array("I")).append(pos)

    minusculas = {d: d.lower() for d in set(indice.descripcion) if d is not None}
    indice.texto = [minusculas.get(d) for d in indice.descripcion]

    # Por sucursal, las posiciones quedan ascendentes (de mayor a menor descuento),
    # asi que el recuadro se resuelve fusionando listas ya ordenadas.
    indice.por_sucursal = [array("I") for _ in indice.sucursales]
    for pos in range(len(orden)):
        for suc in indice.miembros[indice.inicio[pos] : indice.inicio[pos + 1]]:
            indice.por_sucursal[suc].append(pos)

    # Cuantas promos informa cada cadena por sucursal (total-con-promos-cerca):
    # para decir cuales casi no informan. Ver POCAS_PROMOS_POR_SUCURSAL.
    sucursales_por_cadena: Counter = Counter()
    promos_por_cadena: Counter = Counter()
    for suc, s in enumerate(indice.sucursales):
        sucursales_por_cadena[s["cadena"]] += 1
        promos_por_cadena[s["cadena"]] += len(indice.por_sucursal[suc])
    indice.promos_por_sucursal = {c: promos_por_cadena[c] / n for c, n in sucursales_por_cadena.items() if n}
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
# Promos de unos productos cerca de la zona (openspec promos-de-tu-lista)
# ---------------------------------------------------------------------------

# "Cerca" de la zona: medido el 2026-11-18, 3 km del centro dan 12 sucursales
# con promos en Lomas de Zamora, 194 en Palermo y 2 en Rafaela. Las sucursales
# del lugar no sirven: en un barrio chico son una o dos, y la de cuatro cuadras
# pero del barrio vecino quedaria afuera.
#
# Es tambien el radio de "las cadenas de tu zona" (cadenas-cerca-de-tu-zona,
# 2026-11-18): una sola definicion de "cerca" para todo el sitio.
RADIO_CERCA_KM = 3
RADIO_PROMOS_KM = RADIO_CERCA_KM  # nombre anterior, lo usa /promos/productos
PROMOS_POR_PRODUCTO = 3
MAXIMO_PRODUCTOS = 100

# El 98% de las promos del 2026-11-17 dice hasta cuando vale: "valida desde el
# 12/11/2026 hasta 17/11/2026" (Carrefour), "Vigencia desde el 10/11/2026 al
# 18/11/2026" (Dia, Coop. Obrera) o "Vigente hasta el 2026-11-20". El resto son
# promos de Dia "hasta agotar stock", sin fecha.
_VIGENCIA = re.compile(r"\b(?:hasta(?: el)?|al)\s+(?:(\d{1,2})/(\d{1,2})/(\d{4})|(\d{4})-(\d{2})-(\d{2}))", re.I)


def vigencia_de(leyenda: str | None) -> str | None:
    """La fecha de fin de la promo como AAAA-MM-DD, o None si la leyenda no la dice."""
    m = _VIGENCIA.search(leyenda or "")
    if not m:
        return None
    if m.group(1):
        dia, mes, anio = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        anio, mes, dia = int(m.group(4)), int(m.group(5)), int(m.group(6))
    if not (1 <= mes <= 12 and 1 <= dia <= 31):
        return None
    return f"{anio:04d}-{mes:02d}-{dia:02d}"


def promos_de_productos(
    indice: IndiceMapa,
    ids: list[str],
    latitud: float,
    longitud: float,
    hoy: str,
    radio_km: float = RADIO_PROMOS_KM,
) -> dict[str, list[dict]]:
    """Por producto, sus promos vigentes en sucursales a menos de radio_km.

    Una por cadena (la mas barata de esa cadena), ordenadas por precio y hasta
    PROMOS_POR_PRODUCTO. Cada una con la sucursal mas cercana al punto, para
    la direccion, y cuantas otras sucursales cercanas la tienen. Decidir si
    la promo conviene frente al precio de la zona lo hace el navegador, que
    ya tiene ese precio (frontend/src/utils/promosCerca.ts).

    hoy es AAAA-MM-DD en la Argentina: los datos son del dia anterior, y una
    promo "hasta 17/11" leida el 18/11 ya termino.
    """
    distancia = {}
    for i, s in enumerate(indice.sucursales):
        d = _km(latitud, longitud, s["latitud"], s["longitud"])
        if d <= radio_km:
            distancia[i] = d
    resultado: dict[str, list[dict]] = {}
    if not distancia:
        return resultado
    for id_producto in dict.fromkeys(str(i) for i in ids):
        mejor_por_cadena: dict[str, dict] = {}
        for pos in indice.por_producto.get(id_producto, ()):
            hasta = indice.vigente_hasta[pos]
            if hasta is not None and hasta < hoy:
                continue
            cercanas = [s for s in indice.miembros[indice.inicio[pos] : indice.inicio[pos + 1]] if s in distancia]
            if not cercanas:
                continue
            cercanas.sort(key=lambda s: distancia[s])
            sucursal = indice.sucursales[cercanas[0]]
            fila = {
                "id_producto": id_producto,
                "descripcion": indice.descripcion[pos],
                **sucursal,
                "distancia_km": round(distancia[cercanas[0]], 1),
                "otras_sucursales_cerca": len(cercanas) - 1,
                "precio_lista": indice.precio_lista[pos],
                "precio_promo": indice.precio_promo[pos],
                "descuento_pct": indice.descuento_pct[pos],
                "leyenda": indice.leyenda[pos],
                "nivel_evidencia": indice.nivel_evidencia[pos],
                "vigente_hasta": hasta,
                "requiere_compra_multiple": bool(indice.multiple[pos]),
            }
            clave = sucursal["cadena"] or ""
            actual = mejor_por_cadena.get(clave)
            if actual is None or (fila["precio_promo"], fila["distancia_km"]) < (actual["precio_promo"], actual["distancia_km"]):
                mejor_por_cadena[clave] = fila
        if mejor_por_cadena:
            filas = sorted(mejor_por_cadena.values(), key=lambda f: (f["precio_promo"], f["distancia_km"]))
            resultado[id_producto] = filas[:PROMOS_POR_PRODUCTO]
    return resultado


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


# Una cadena que informa menos promos que esto por sucursal "casi no informa
# promos" (total-con-promos-cerca, 2026-11-19). Medido ese dia: Dia 960,
# Carrefour 956, Cooperativa Obrera 707, Market 224, La Anonima 214, Express 69;
# Coto 33, Maxi 26, y cero los tres Changomas, Vea, Disco y Jumbo.
POCAS_PROMOS_POR_SUCURSAL = 50
MAXIMO_PRODUCTOS_LISTA = 50


def poco_informan(indice: IndiceMapa, cadenas) -> list[str]:
    """Las cadenas pedidas que casi no informan promos en SEPA."""
    return sorted(c for c in set(cadenas) if indice.promos_por_sucursal.get(c, 0) < POCAS_PROMOS_POR_SUCURSAL)


def promos_de_lista(
    indice: IndiceMapa,
    items: list[dict],
    precios: dict,
    cadenas,
    latitud: float,
    longitud: float,
    hoy: str,
    radio_km: float = RADIO_CERCA_KM,
) -> list[dict]:
    """Cuanto sale una lista en cada cadena cerca si se aprovechan sus promos
    (total-con-promos-cerca, 2026-11-19).

    Una sola sucursal por cadena, a menos de radio_km: la que deja la lista mas
    barata. Cada producto cuenta al menor entre su precio de lista en la cadena
    (precios[id][cadena], el mismo de Tu lista) y la promo vigente de esa
    sucursal; las de compra multiple no cuentan. Una cadena que no tiene precio
    de lista para todos los productos no compite, como en el total de siempre.

    items: [{"id_producto", "cantidad"}]. Devuelve una fila por cadena, de la
    mas barata a la mas cara con promos.
    """
    pedidos: dict[str, int] = {}
    for item in items[:MAXIMO_PRODUCTOS_LISTA]:
        cantidad = item.get("cantidad", 1)
        if isinstance(cantidad, bool) or not isinstance(cantidad, int):
            cantidad = 1
        pedidos[str(item.get("id_producto", ""))] = max(1, min(cantidad, 99))
    cadenas = set(cadenas)
    completas = [c for c in cadenas if pedidos and all(c in precios.get(i, {}) for i in pedidos)]
    if not completas:
        return []
    distancia = {}
    for s, suc in enumerate(indice.sucursales):
        if suc["cadena"] in completas:
            d = _km(latitud, longitud, suc["latitud"], suc["longitud"])
            if d <= radio_km:
                distancia[s] = d
    # La promo mas barata de cada producto en cada sucursal cercana: (precio, pos).
    promo: dict = {}
    for id_producto in pedidos:
        for pos in indice.por_producto.get(id_producto, ()):
            hasta = indice.vigente_hasta[pos]
            if (hasta is not None and hasta < hoy) or indice.multiple[pos]:
                continue
            for s in indice.miembros[indice.inicio[pos] : indice.inicio[pos + 1]]:
                if s in distancia:
                    actual = promo.get((s, id_producto))
                    if actual is None or indice.precio_promo[pos] < actual[0]:
                        promo[(s, id_producto)] = (indice.precio_promo[pos], pos)
    resultado = []
    for cadena in completas:
        total_lista = sum(precios[i][cadena] * n for i, n in pedidos.items())
        mejor = None
        for s in (s for s in distancia if indice.sucursales[s]["cadena"] == cadena):
            total, en_promo, vigencias = 0.0, 0, []
            for i, n in pedidos.items():
                lista = precios[i][cadena]
                p = promo.get((s, i))
                if p and p[0] < lista:
                    total += p[0] * n
                    en_promo += 1
                    if indice.vigente_hasta[p[1]]:
                        vigencias.append(indice.vigente_hasta[p[1]])
                else:
                    total += lista * n
            clave = (round(total, 2), distancia[s])
            if mejor is None or clave < mejor[0]:
                mejor = (clave, s, total, en_promo, min(vigencias) if vigencias else None)
        if mejor is None:
            continue
        _, s, total, en_promo, vigencia = mejor
        resultado.append({
            **indice.sucursales[s],
            "distancia_km": round(distancia[s], 2),
            "total_con_promos": round(total, 2),
            "total_lista": round(total_lista, 2),
            "productos_en_promo": en_promo,
            "vigente_hasta": vigencia,
        })
    resultado.sort(key=lambda f: (f["total_con_promos"], f["cadena"]))
    return resultado


def _km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia aproximada, sobrada para decidir si un lugar es compacto."""
    return math.hypot((lat2 - lat1) * 111.0, (lng2 - lng1) * 111.0 * math.cos(math.radians((lat1 + lat2) / 2)))


# Dos zonas con nombres parecidos a menos de esto son el mismo lugar
# (arreglos-segundo-explore, 2026-11-19). Ver _juntar_nombres_parecidos.
DISTANCIA_ALIAS_KM = 2


def _palabras_del_lugar(nombre: str) -> frozenset:
    return frozenset(w for w in re.findall(r"[a-z0-9]+", normalizar(nombre)) if w not in PALABRAS_EN_MINUSCULA)


def _juntar_nombres_parecidos(indice: IndiceMapa, lugares_: list, centro) -> list:
    """Un mismo lugar cargado con nombres parecidos es una sola zona.

    El selector ofrecia "Laferrere", "Gregorio de Laferrere" y "Gregorio
    Laferrere", a menos de 1,5 km entre si: la fusion por nombre solo juntaba
    nombres identicos. Se juntan los de la misma provincia con centros a menos
    de DISTANCIA_ALIAS_KM cuando las palabras de un nombre (sin "de", "la",
    etc.) estan contenidas en las del otro. Medido el 2026-11-19: 30 pares, casi
    todos duplicados reales (Villa Lugano y Lugano, Jose C. Paz con y sin punto,
    Paternal y La Paternal); algunos son un barrio y su ciudad (Nueva Cordoba y
    Cordoba), que con las cadenas a 3 km dicen casi lo mismo.

    Queda el nombre del que tiene mas sucursales; los demas van a "alias", que
    el buscador de zonas y los links viejos siguen encontrando.
    """
    orden = sorted(lugares_, key=lambda l: (-l["sucursales"], l["nombre"]))
    juntos: list = []
    for lugar in orden:
        palabras = _palabras_del_lugar(lugar["nombre"])
        destino = next(
            (
                j for j in juntos
                if j["provincia"] == lugar["provincia"]
                and palabras and j["_palabras"]
                and (palabras <= j["_palabras"] or j["_palabras"] <= palabras)
                and _km(j["latitud"], j["longitud"], lugar["latitud"], lugar["longitud"]) < DISTANCIA_ALIAS_KM
            ),
            None,
        )
        if destino is None:
            juntos.append({**lugar, "_palabras": palabras, "alias": []})
            continue
        destino["alias"].append(lugar["nombre"])
        destino["_sucursales"] = destino["_sucursales"] | lugar["_sucursales"]
        destino["sucursales"] = len(destino["_sucursales"])
        destino["latitud"], destino["longitud"] = centro(destino["_sucursales"])
        destino["cadenas"] = sorted(set(destino["cadenas"]) | set(lugar["cadenas"]))
    for j in juntos:
        del j["_palabras"], j["_sucursales"]
        if not j["alias"]:
            del j["alias"]
    return juntos


# Una franja de latitud un poco mas ancha que el radio: 1 grado son ~111 km.
_FRANJA_GRADOS = RADIO_CERCA_KM / 111.0 * 1.05


def _sumar_cadenas_cerca(indice: IndiceMapa, lugares_: list) -> None:
    """Las cadenas de cada lugar pasan a ser las que estan CERCA: las del lugar
    mas las que tienen una sucursal a menos de RADIO_CERCA_KM de su centro
    (cadenas-cerca-de-tu-zona, 2026-11-18).

    Hasta ese dia eran solo las del barrio o la localidad: 331 de 559 zonas
    tenian "una sola cadena", y en 147 habia otra empresa a menos de 3 km. En
    Villa Soldati la portada decia "Tu unica cadena cerca: Dia" con cuatro
    empresas o mas a unas cuadras. El barrio es un limite administrativo; la
    gente compra cerca, cruce o no el limite.

    Si un lugar queda con una sola cadena, se agrega otra_cadena_cerca: la
    sucursal mas cercana de otra cadena, para decir cuanto hay que viajar.
    Se compara solo contra las sucursales de una franja de latitud: 559 lugares
    por 2.500 sucursales en cada armado sobraba."""
    puntos = sorted(
        (s["latitud"], s["longitud"], s["cadena"]) for s in indice.sucursales
        if s.get("cadena") and s.get("latitud") is not None and s.get("longitud") is not None
    )
    latitudes = [p[0] for p in puntos]
    for lugar in lugares_:
        lat, lng = lugar["latitud"], lugar["longitud"]
        desde, hasta = bisect_left(latitudes, lat - _FRANJA_GRADOS), bisect_right(latitudes, lat + _FRANJA_GRADOS)
        cerca = set(lugar["cadenas"]) | {
            c for la, ln, c in puntos[desde:hasta] if _km(lat, lng, la, ln) <= RADIO_CERCA_KM
        }
        lugar["cadenas"] = sorted(cerca)
        if len(cerca) == 1:
            otra = min(((_km(lat, lng, la, ln), c) for la, ln, c in puntos if c not in cerca), default=None)
            if otra:
                lugar["otra_cadena_cerca"] = {"cadena": otra[1], "km": round(otra[0])}


# Nombres que en CABA no son un lugar sino la ciudad entera. Sirven para mover
# el mapa, pero no como zona: "Capital Federal" juntaba las sucursales de Dia
# que escriben eso en el barrio, y como zona decia que en toda CABA hay una sola
# cadena (2026-11).
GENERICOS_CABA = {"capital federal", "caba", "ciudad autonoma de buenos aires", "ciudad autonoma buenos aires", "buenos aires"}


def lugares(indice: IndiceMapa, con_cadenas: bool = False) -> list[dict]:
    """Localidades y barrios con sucursales, para que el mapa pueda ir a uno.

    Con `con_cadenas`, cada lugar trae tambien las cadenas cerca: las que
    tienen sucursal en el o a menos de RADIO_CERCA_KM de su centro, sin repetir
    (ver _sumar_cadenas_cerca), y quedan afuera los nombres genericos de CABA: es la lista de
    zonas del sitio (ver /zonas). Va aparte para no agrandar /promos/lugares,
    que el mapa pide igual que antes.

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
                **({"cadenas": sorted({p["cadena"] for p in puntos if p["cadena"]})} if con_cadenas else {}),
                **({"_sucursales": grupo["sucursales"]} if con_cadenas else {}),
            }
        )
    if con_cadenas:
        resultado = [l for l in resultado if not (l["provincia"] == "AR-C" and normalizar(l["nombre"]) in GENERICOS_CABA)]
        resultado = _juntar_nombres_parecidos(indice, resultado, centro)
        _sumar_cadenas_cerca(indice, resultado)
    resultado.sort(key=lambda l: (-l["sucursales"], l["nombre"]))
    return resultado

