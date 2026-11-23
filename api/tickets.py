"""
Mis gastos: leer la foto de un ticket de supermercado y vincular sus lineas con
los productos de SEPA (openspec mis-gastos-y-barra-nueva).

Dos pasos con Gemini, a lo sumo:
  1. leer: todas las fotos en un pedido; el modelo devuelve la cabecera y las
     lineas de cada foto por separado, y aca se unen sacando lo que se repite
     donde una foto se superpone con la siguiente.
  2. elegir: solo para las lineas sin codigo de barras, entre hasta
     CANDIDATOS_POR_LINEA productos de la misma cadena con precio parecido.

La foto no se guarda: llega en memoria, se manda a Gemini y se descarta. La
respuesta se arma solo con los campos de este modulo, asi que un DNI o una
tarjeta que el modelo transcriba igual nunca sale (ver limpiar_lectura).

Formato real de los tickets, visto en fotos publicas (2026-11-22): Carrefour y
Jumbo imprimen el codigo de 13 digitos debajo de cada producto; Coto, codigo
interno + codigo de barras con un cero adelante; Dia, solo texto abreviado. Los
pesables traen un codigo que empieza con 2 con el precio adentro.
"""

import json
import re
import time
from collections import deque
from datetime import date, datetime, timedelta, timezone

from mismo_producto import normalizar, palabras

# ---------------------------------------------------------------------------
# Reglas: la API y la pagina leen estos mismos numeros (la respuesta los manda).
# ---------------------------------------------------------------------------
MAXIMO_FOTOS = 3
# Unos 400 KB por foto achicada en el telefono; con margen para fotos grandes.
MAXIMO_BYTES_POR_FOTO = 2_500_000
TOLERANCIA_PRECIO_CANDIDATO = 0.15
CANDIDATOS_POR_LINEA = 5
COBERTURA_MINIMA_COMPARACION = 0.6
TICKETS_POR_HORA_POR_IP = 20
TICKETS_POR_DIA = 2_000
MAXIMO_LINEAS = 150

MODELO_TICKETS = "gemini-flash-lite-latest"
CATEGORIA_SIN_PRODUCTO = "Otros"

CONSTANTES_PARA_LA_PAGINA = {
    "maximo_fotos": MAXIMO_FOTOS,
    "cobertura_minima_comparacion": COBERTURA_MINIMA_COMPARACION,
}

# ---------------------------------------------------------------------------
# Paso 1: leer
# ---------------------------------------------------------------------------
PROMPT_LEER = """Sos un lector de tickets de supermercados de la Argentina.
Te paso {n} foto(s) de UN mismo ticket, en orden de arriba hacia abajo. Pueden superponerse.

Devolvé SOLO un JSON con esta forma:
{{
  "es_ticket": true o false,
  "cadena": "nombre del supermercado como figura (ej. COTO, Carrefour, DIA, Jumbo)",
  "cuit_comercio": "CUIT del COMERCIO que emite el ticket, solo digitos",
  "sucursal": "numero o nombre de sucursal/tienda impreso (ej. SUC68, 5202) o null",
  "fecha": "AAAA-MM-DD",
  "comprobante": "numero de comprobante tal como figura (ej. 13945-00148992) o null",
  "total": numero,
  "fotos": [
    {{
      "lineas": [{{"descripcion": "texto del producto", "cantidad": numero, "precio_unitario": numero,
                  "importe": numero, "codigo": "codigo de barras de 12 a 14 digitos o null"}}],
      "descuentos": [{{"descripcion": "texto de la promo o descuento", "importe": numero positivo}}]
    }}
  ]
}}

Reglas:
- Un objeto en "fotos" por cada foto, en el mismo orden, con SOLO lo que se ve en esa foto.
- "codigo": el codigo de barras del producto si esta impreso (13 o 14 digitos, a veces con un 0 adelante).
  Si hay dos numeros (codigo interno y codigo de barras), usá el de barras, el mas largo. Si no hay, null.
- Los descuentos, promos, bonificaciones y lineas con importe negativo van en "descuentos", con el importe en positivo.
- Montos con punto decimal (3100.50), sin separador de miles.
- NO transcribas datos de la persona: DNI, CUIT del cliente, nombre, numero de tarjeta, cupon, autorizacion,
  numero de socio o cliente. Ignoralos.
- Si la foto no es un ticket de compra, "es_ticket": false y el resto vacio.
"""


def _numero(valor) -> float | None:
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    if isinstance(valor, str):
        texto = valor.strip().replace("$", "").replace(" ", "")
        # "1.234,50" -> 1234.50 ; "1234.50" -> 1234.50
        if "," in texto:
            texto = texto.replace(".", "").replace(",", ".")
        try:
            return float(texto)
        except ValueError:
            return None
    return None


def _texto(valor, largo: int) -> str | None:
    if not isinstance(valor, str):
        return None
    limpio = " ".join(valor.split())[:largo]
    return limpio or None


_FECHA = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_COMPROBANTE = re.compile(r"^[0-9A-Za-z\- ]{1,40}$")


def _fecha(valor) -> str | None:
    if not isinstance(valor, str):
        return None
    m = _FECHA.match(valor.strip())
    if not m:
        return None
    try:
        date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return valor.strip()


def _digitos(valor) -> str:
    return re.sub(r"\D", "", valor) if isinstance(valor, str) else ""


def _linea(crudo) -> dict | None:
    if not isinstance(crudo, dict):
        return None
    descripcion = _texto(crudo.get("descripcion"), 80)
    importe = _numero(crudo.get("importe"))
    if not descripcion or importe is None:
        return None
    cantidad = _numero(crudo.get("cantidad"))
    if cantidad is None or cantidad <= 0:
        cantidad = 1.0
    precio = _numero(crudo.get("precio_unitario"))
    if precio is None or precio <= 0:
        precio = round(importe / cantidad, 2) if cantidad else importe
    codigo = _digitos(crudo.get("codigo"))
    return {
        "descripcion": descripcion,
        "cantidad": round(cantidad, 3),
        "precio_unitario": round(precio, 2),
        "importe": round(importe, 2),
        "codigo": codigo if 8 <= len(codigo) <= 14 else None,
    }


def _descuento(crudo) -> dict | None:
    if not isinstance(crudo, dict):
        return None
    descripcion = _texto(crudo.get("descripcion"), 80)
    importe = _numero(crudo.get("importe"))
    if not descripcion or importe is None or importe == 0:
        return None
    return {"descripcion": descripcion, "importe": round(abs(importe), 2)}


def _clave_linea(linea: dict) -> tuple:
    return (normalizar(linea["descripcion"]), linea["importe"], linea["codigo"])


def unir_fotos(fotos: list[list[dict]]) -> list[dict]:
    """Une las lineas de varias fotos del mismo ticket.

    Dos fotos seguidas se pueden superponer: el final de una es el principio de
    la otra. Se saca el tramo repetido mas largo en ese borde y nada mas. Dos
    lineas iguales DENTRO de una foto son dos compras (llevar dos veces el mismo
    producto en lineas separadas es comun) y se quedan las dos.
    """
    unidas: list[dict] = []
    for lineas in fotos:
        tope = min(len(unidas), len(lineas))
        repetidas = 0
        for k in range(tope, 0, -1):
            if [_clave_linea(x) for x in unidas[-k:]] == [_clave_linea(x) for x in lineas[:k]]:
                repetidas = k
                break
        unidas.extend(lineas[repetidas:])
    return unidas


def limpiar_lectura(crudo) -> dict:
    """Lo que devolvio el modelo, reducido a los campos de Mis gastos.

    Es una lista blanca: solo se copian estos campos, con su tipo y su largo.
    Cualquier otro dato que el modelo agregue (DNI, tarjeta, nombre) se pierde
    aca, y por eso no puede salir en la respuesta."""
    if not isinstance(crudo, dict) or crudo.get("es_ticket") is False:
        return {"legible": False}
    fotos = crudo.get("fotos")
    if not isinstance(fotos, list):
        # Por si el modelo devuelve las lineas sin separar por foto.
        fotos = [{"lineas": crudo.get("lineas"), "descuentos": crudo.get("descuentos")}]
    lineas_por_foto, descuentos_por_foto = [], []
    for foto in fotos[:MAXIMO_FOTOS]:
        foto = foto if isinstance(foto, dict) else {}
        crudas = foto.get("lineas") if isinstance(foto.get("lineas"), list) else []
        lineas_por_foto.append([x for x in (_linea(c) for c in crudas) if x])
        crudos = foto.get("descuentos") if isinstance(foto.get("descuentos"), list) else []
        descuentos_por_foto.append([x for x in (_descuento(c) for c in crudos) if x])
    lineas = unir_fotos(lineas_por_foto)[:MAXIMO_LINEAS]
    descuentos = [{"descripcion": d["descripcion"], "importe": d["importe"]}
                  for d in unir_fotos([[{**d, "codigo": None} for d in f] for f in descuentos_por_foto])]
    total = _numero(crudo.get("total"))
    if not lineas and total is None:
        return {"legible": False}
    comprobante = _texto(crudo.get("comprobante"), 40)
    if comprobante:
        # "04712 - 00116390" y "04712-00116390" son el mismo: importa para detectar duplicados.
        comprobante = re.sub(r"\s*-\s*", "-", comprobante)
    cuit = _digitos(crudo.get("cuit_comercio"))
    return {
        "legible": True,
        "cadena": _texto(crudo.get("cadena"), 40),
        "cuit_comercio": cuit if len(cuit) == 11 else None,
        "sucursal": _texto(crudo.get("sucursal"), 40),
        "fecha": _fecha(crudo.get("fecha")),
        "comprobante": comprobante if comprobante and _COMPROBANTE.match(comprobante) else None,
        "total": round(total, 2) if total is not None else None,
        "lineas": lineas,
        "descuentos": descuentos,
    }


def _texto_json(respuesta) -> dict:
    texto = (getattr(respuesta, "text", None) or "").strip()
    if texto.startswith("```"):
        texto = texto.strip("`").removeprefix("json").strip()
    return json.loads(texto) if texto else {}


def _tipo_de_imagen(foto: bytes) -> str:
    """El telefono manda JPEG; igual se mira la firma por si llega otro formato."""
    if foto.startswith(b"\x89PNG"):
        return "image/png"
    if foto[:4] == b"RIFF" and foto[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def leer_con_gemini(cliente, fotos: list[bytes]) -> dict:
    """Paso 1. Devuelve el JSON crudo del modelo (se limpia con limpiar_lectura)."""
    from google.genai import types

    partes = [types.Part.from_bytes(data=foto, mime_type=_tipo_de_imagen(foto)) for foto in fotos]
    respuesta = cliente.models.generate_content(
        model=MODELO_TICKETS,
        contents=[*partes, PROMPT_LEER.format(n=len(fotos))],
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0),
    )
    return _texto_json(respuesta)


# ---------------------------------------------------------------------------
# Que cadena es
# ---------------------------------------------------------------------------
def armar_tabla_cuit(filas) -> dict[str, list[str]]:
    """CUIT del comercio -> cadenas de SEPA (nombre_comercial de stg_comercio)."""
    tabla: dict[str, list[str]] = {}
    for fila in filas:
        cuit = _digitos(str(fila.get("cuit") or ""))
        nombre = fila.get("nombre_comercial")
        if len(cuit) == 11 and nombre and nombre not in tabla.setdefault(cuit, []):
            tabla[cuit].append(nombre)
    return tabla


def cadenas_del_ticket(cadena: str | None, cuit: str | None, tabla_cuit: dict[str, list[str]]) -> list[str]:
    """Las cadenas de SEPA del ticket, la mas probable primero.

    El CUIT da la empresa (Cencosud: Jumbo, Vea y Disco) y el nombre impreso
    elige dentro de ella. Sin CUIT, se busca el nombre entre todas."""
    nombre = normalizar(cadena or "")
    familia = tabla_cuit.get(cuit or "", [])
    if not familia:
        todas = sorted({c for cs in tabla_cuit.values() for c in cs})
        familia = [c for c in todas if nombre and _coincide_nombre(nombre, c)]
        # "Carrefour" en un ticket de Market: la familia entera por el nombre de la empresa.
        for cs in tabla_cuit.values():
            if any(c in familia for c in cs):
                familia = familia + [c for c in cs if c not in familia]
    # Primero la que tiene mas palabras de su nombre en el ticket: "Carrefour
    # Market" es Market (Carrefour), no Carrefour. A igualdad, el orden de la familia.
    # A igualdad de palabras, la de nombre mas corto: "Carrefour" en el ticket
    # es Carrefour y no Maxi (Carrefour).
    puntaje = {c: _palabras_en_comun(nombre, c) for c in familia}
    largo = {c: len(normalizar(c.replace("(", " ").replace(")", " ")).split()) for c in familia}
    return sorted(familia, key=lambda c: (-puntaje[c], largo[c], familia.index(c)))


def _palabras_en_comun(nombre_ticket: str, cadena: str) -> int:
    del_ticket = set(nombre_ticket.split())
    return sum(1 for w in normalizar(cadena.replace("(", " ").replace(")", " ")).split() if w in del_ticket)


def _coincide_nombre(nombre_ticket: str, cadena: str) -> bool:
    base = normalizar(cadena.split("(")[0])
    return bool(base) and (base in nombre_ticket or nombre_ticket in base)


# ---------------------------------------------------------------------------
# Paso 2: vincular con SEPA
# ---------------------------------------------------------------------------
def _digito_verificador_ok(codigo: str) -> bool:
    total = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(codigo[:12]))
    return (10 - total % 10) % 10 == int(codigo[12])


def normalizar_codigo(codigo: str | None) -> str | None:
    """El codigo impreso, como id de SEPA (13 digitos), o None si no sirve.

    Coto imprime 14 digitos con un cero adelante; un UPC de 12 se completa con
    un cero. Los que empiezan con 2 son de pesables o internos (llevan el precio
    adentro) y un digito verificador que no cierra es una lectura equivocada."""
    if not codigo:
        return None
    if len(codigo) == 14 and codigo.startswith("0"):
        codigo = codigo[1:]
    elif len(codigo) == 12:
        codigo = "0" + codigo
    if len(codigo) != 13 or codigo.startswith("2") or not _digito_verificador_ok(codigo):
        return None
    return codigo


def _precio_en(producto: dict, cadenas: list[str]) -> float | None:
    """El precio del producto en la primera cadena de la lista que lo informa."""
    por_cadena = {p["cadena"]: p for p in producto["precios"] if p.get("precio_creible", True)}
    for cadena in cadenas:
        if cadena in por_cadena:
            return float(por_cadena[cadena]["precio_mediano"])
    return None


_POR_CADENA: dict = {"indice": None, "por_cadena": {}}


def _productos_de(indice: dict, cadena: str) -> list[tuple[dict, float]]:
    """Los productos que informa una cadena, con su precio, armado una vez por indice."""
    if _POR_CADENA["indice"] is not indice:
        _POR_CADENA["indice"], _POR_CADENA["por_cadena"] = indice, {}
    cache = _POR_CADENA["por_cadena"]
    if cadena not in cache:
        cache[cadena] = [
            (p, float(pr["precio_mediano"]))
            for p in indice.values()
            for pr in p["precios"]
            if pr["cadena"] == cadena and pr.get("precio_creible", True)
        ]
    return cache[cadena]


def candidatos(indice: dict, linea: dict, cadenas: list[str]) -> list[dict]:
    """Hasta CANDIDATOS_POR_LINEA productos de las cadenas del ticket con precio
    parecido al pagado y alguna palabra en comun con la descripcion.

    Las palabras del ticket vienen abreviadas ("COCA SIN AZU"): cuenta como
    coincidencia que una palabra del ticket sea el principio de una del producto."""
    if linea["cantidad"] != int(linea["cantidad"]) or linea["precio_unitario"] <= 0:
        return []  # pesables: el precio es por kilo y la cantidad no es un entero
    buscadas = [w for w in palabras(linea["descripcion"]) if len(w) >= 3 or w.isdigit()]
    if not buscadas:
        return []
    precio = linea["precio_unitario"]
    vistos: dict[str, tuple[int, float, dict]] = {}
    for cadena in cadenas:
        for producto, precio_cadena in _productos_de(indice, cadena):
            if abs(precio_cadena - precio) > TOLERANCIA_PRECIO_CANDIDATO * precio:
                continue
            suyas = producto["_palabras"].split()
            coincidencias = sum(1 for w in buscadas if any(s.startswith(w) for s in suyas))
            if coincidencias == 0:
                continue
            clave = producto["id_producto"]
            distancia = abs(precio_cadena - precio) / precio
            if clave not in vistos or (coincidencias, -distancia) > (vistos[clave][0], -vistos[clave][1]):
                vistos[clave] = (coincidencias, distancia, producto)
    orden = sorted(vistos.values(), key=lambda v: (-v[0], v[1], v[2]["descripcion"]))
    return [
        {"id_producto": p["id_producto"], "descripcion": p["descripcion"], "marca": p["marca"],
         "categoria": p["categoria"]}
        for _, _, p in orden[:CANDIDATOS_POR_LINEA]
    ]


PROMPT_ELEGIR = """Lineas de un ticket de supermercado argentino, abreviadas. Para cada linea elegí el producto
que es EXACTAMENTE el mismo (misma marca, variedad y tamaño) entre sus candidatos, o null si ninguno lo es o dudás.
Para las que queden en null, elegí la categoria mas probable de esta lista: {categorias}.

Devolvé SOLO un JSON: {{"lineas": [{{"n": numero de linea, "id_producto": "id elegido o null", "categoria": "..."}}]}}

Lineas:
{lineas}
"""


def elegir_con_gemini(cliente, pendientes: list[dict], categorias: list[str]) -> dict:
    """Paso 2. pendientes: [{"n", "descripcion", "precio_unitario", "candidatos"}]."""
    from google.genai import types

    texto = "\n".join(
        json.dumps({"n": p["n"], "descripcion": p["descripcion"], "precio": p["precio_unitario"],
                    "candidatos": [{"id_producto": c["id_producto"], "descripcion": c["descripcion"],
                                    "marca": c["marca"]} for c in p["candidatos"]]}, ensure_ascii=False)
        for p in pendientes
    )
    respuesta = cliente.models.generate_content(
        model=MODELO_TICKETS,
        contents=PROMPT_ELEGIR.format(categorias=", ".join(categorias), lineas=texto),
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.0),
    )
    return _texto_json(respuesta)


def categorias_del_indice(indice: dict) -> list[str]:
    return sorted({p["categoria"] for p in indice.values() if p.get("categoria")})


def vincular(lectura: dict, indice: dict, tabla_cuit: dict, elegir) -> dict:
    """Agrega a cada linea id_producto, nombre, categoria y como se vinculo.

    elegir(pendientes, categorias) -> JSON del paso 2; solo se llama si quedan
    lineas sin vincular por codigo."""
    cadenas = cadenas_del_ticket(lectura.get("cadena"), lectura.get("cuit_comercio"), tabla_cuit)
    lineas = []
    pendientes = []
    for n, linea in enumerate(lectura["lineas"]):
        codigo = normalizar_codigo(linea["codigo"])
        producto = indice.get(codigo) if codigo else None
        if producto:
            lineas.append({**linea, "id_producto": codigo, "nombre": producto["descripcion"],
                           "categoria": producto["categoria"] or CATEGORIA_SIN_PRODUCTO, "vinculo": "codigo"})
            continue
        lineas.append({**linea, "id_producto": None, "nombre": None, "categoria": CATEGORIA_SIN_PRODUCTO,
                       "vinculo": "ninguno"})
        pendientes.append({"n": n, "descripcion": linea["descripcion"], "precio_unitario": linea["precio_unitario"],
                           "candidatos": candidatos(indice, linea, cadenas)})

    if pendientes:
        categorias = categorias_del_indice(indice)
        try:
            respuesta = elegir(pendientes, categorias) or {}
        except Exception as error:  # noqa: BLE001 - sin el paso 2, las lineas quedan en Otros
            if getattr(error, "code", None) == 429:
                raise
            print(f"Mis gastos: fallo el paso de elegir ({error!r}); las lineas quedan sin producto")
            respuesta = {}
        elegidas = {e.get("n"): e for e in respuesta.get("lineas", []) if isinstance(e, dict)}
        permitidas = set(categorias)
        for pendiente in pendientes:
            eleccion = elegidas.get(pendiente["n"], {})
            ids = {c["id_producto"] for c in pendiente["candidatos"]}
            elegido = eleccion.get("id_producto")
            linea = lineas[pendiente["n"]]
            if isinstance(elegido, str) and elegido in ids:
                producto = indice[elegido]
                linea.update(id_producto=elegido, nombre=producto["descripcion"],
                             categoria=producto["categoria"] or CATEGORIA_SIN_PRODUCTO, vinculo="candidato")
            elif eleccion.get("categoria") in permitidas:
                linea["categoria"] = eleccion["categoria"]

    return {
        "cadena": lectura.get("cadena"),
        "cadenas_sepa": cadenas,
        "sucursal": lectura.get("sucursal"),
        "fecha": lectura.get("fecha"),
        "comprobante": lectura.get("comprobante"),
        "total": lectura.get("total"),
        "lineas": lineas,
        "descuentos": lectura.get("descuentos", []),
    }


# ---------------------------------------------------------------------------
# Topes: el endpoint es publico y cada lectura cuesta plata.
# ---------------------------------------------------------------------------
_ARGENTINA = timezone(timedelta(hours=-3))


class Topes:
    """Por IP (en la ultima hora) y por dia, en memoria. Con varias instancias
    cada una cuenta lo suyo: alcanza para frenar un abuso, no para contar exacto."""

    def __init__(self, por_hora_por_ip: int = TICKETS_POR_HORA_POR_IP, por_dia: int = TICKETS_POR_DIA):
        self.por_hora_por_ip = por_hora_por_ip
        self.por_dia = por_dia
        self._por_ip: dict[str, deque] = {}
        self._dia: tuple[str, int] = ("", 0)

    def permitir(self, ip: str, ahora: float | None = None) -> str | None:
        """None si se puede leer; si no, "ip" o "dia" segun que tope se paso."""
        ahora = time.time() if ahora is None else ahora
        hoy = datetime.fromtimestamp(ahora, _ARGENTINA).date().isoformat()
        dia, cuenta = self._dia if self._dia[0] == hoy else (hoy, 0)
        if cuenta >= self.por_dia:
            return "dia"
        cola = self._por_ip.setdefault(ip, deque())
        while cola and ahora - cola[0] > 3600:
            cola.popleft()
        if len(cola) >= self.por_hora_por_ip:
            return "ip"
        cola.append(ahora)
        self._dia = (dia, cuenta + 1)
        return None
