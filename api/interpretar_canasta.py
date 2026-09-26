"""Traduce una descripcion en lenguaje natural a una canasta de categorias con Gemini.

Usa google-genai, la libreria vigente. Hasta el 2026-09-10 usaba
google-generativeai, cuyo soporte termino: cualquier actualizacion podia dejar
Tu canasta sin funcionar. La categorizacion del pipeline ya estaba en la nueva.
"""

import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODELO = "gemini-flash-lite-latest"

# Unidad en la que se cotiza cada categoria y cantidad mensual sugerida para un
# adulto. Es la unica fuente de tres cosas: la lista de categorias que el modelo
# puede usar, la unidad que tiene que devolver para cada una, y lo que se ofrece
# al agregar una categoria a mano.
#
# La unidad es la dominante en los precios de SEPA, medida el 2026-09-10 sobre
# los 14,4 millones de precios del 2026-09-09 (Carne vacuna 93% en gramos,
# Huevos 100% por unidad, Aceite 67% en cc). Importa porque la canasta se cotiza
# por categoria x gama x UNIDAD: pedir Yogur en cc cuando el 71% de sus precios
# esta en gramos dejaba la categoria sin cotizar, sin que nada lo avisara, y el
# prompt anterior sugeria justamente cc.
#
# Las cantidades de las categorias con referencia de consumo son el punto medio
# de los rangos del prompt. El resto es un punto de partida razonable para que el
# usuario ajuste. En las categorias por unidad, la unidad es la pieza: un panal,
# una toallita.
CATEGORIAS = {
    # Las siete categorias del 2026-09-24 (aceite de oliva, verduras procesadas,
    # edulcorantes, premezclas, rebozadores, pastas frescas, comidas preparadas)
    # separan de los basicos productos que tienen otro precio por kilo. Ver
    # categorizar.py. La unidad sale de contar sus productos: el aceite de oliva
    # va en cc como el comun, porque "1 unidad" no permite comparar precio por
    # litro.
    "Accesorios mascotas": {"unidad": "unidad", "cantidad": 1},
    "Aceite": {"unidad": "cc", "cantidad": 500},
    "Aceite de oliva y especiales": {"unidad": "cc", "cantidad": 250},
    "Achuras y menudencias": {"unidad": "g", "cantidad": 400},
    "Aguas": {"unidad": "cc", "cantidad": 7500},
    "Alimento para mascotas": {"unidad": "g", "cantidad": 3000},
    "Alimentos para bebe": {"unidad": "cc", "cantidad": 1000},
    "Arroz": {"unidad": "g", "cantidad": 700},
    "Azucar": {"unidad": "g", "cantidad": 500},
    "Bazar y hogar": {"unidad": "unidad", "cantidad": 1},
    "Cacao": {"unidad": "g", "cantidad": 400},
    "Cafe": {"unidad": "g", "cantidad": 200},
    "Carne vacuna": {"unidad": "g", "cantidad": 2000},
    "Cerdo": {"unidad": "g", "cantidad": 500},
    "Cerveza": {"unidad": "cc", "cantidad": 2000},
    "Comidas preparadas": {"unidad": "g", "cantidad": 1000},
    "Conservas": {"unidad": "g", "cantidad": 500},
    "Descartables": {"unidad": "unidad", "cantidad": 50},
    "Dietetica suplementos y frutos secos": {"unidad": "g", "cantidad": 300},
    "Dulces y mermeladas": {"unidad": "g", "cantidad": 400},
    "Edulcorantes": {"unidad": "g", "cantidad": 100},
    "Elaborados de carne": {"unidad": "g", "cantidad": 800},
    "Electro": {"unidad": "unidad", "cantidad": 1},
    "Embutidos": {"unidad": "g", "cantidad": 500},
    "Facturas y reposteria": {"unidad": "g", "cantidad": 500},
    "Ferreteria": {"unidad": "unidad", "cantidad": 1},
    "Fiambres": {"unidad": "g", "cantidad": 400},
    "Fideos": {"unidad": "g", "cantidad": 800},
    "Frutas": {"unidad": "g", "cantidad": 2500},
    "Galletitas dulces": {"unidad": "g", "cantidad": 500},
    "Galletitas saladas": {"unidad": "g", "cantidad": 500},
    "Gaseosas": {"unidad": "cc", "cantidad": 1500},
    "Golosinas y chocolates": {"unidad": "g", "cantidad": 300},
    "Harina": {"unidad": "g", "cantidad": 500},
    "Higiene bebe": {"unidad": "unidad", "cantidad": 100},
    "Higiene personal": {"unidad": "unidad", "cantidad": 2},
    "Huevos": {"unidad": "unidad", "cantidad": 12},
    "Jugos": {"unidad": "cc", "cantidad": 1500},
    "Jugueteria": {"unidad": "unidad", "cantidad": 1},
    "Lavanderia": {"unidad": "cc", "cantidad": 1500},
    "Leche en polvo": {"unidad": "g", "cantidad": 800},
    "Leche fluida": {"unidad": "cc", "cantidad": 2500},
    "Legumbres": {"unidad": "g", "cantidad": 300},
    "Libreria": {"unidad": "unidad", "cantidad": 1},
    "Limpieza del hogar": {"unidad": "unidad", "cantidad": 2},
    "Manteca y margarina": {"unidad": "g", "cantidad": 200},
    "Otras carnes": {"unidad": "g", "cantidad": 500},
    "Otras grasas": {"unidad": "cc", "cantidad": 500},
    "Otros condimentos": {"unidad": "g", "cantidad": 200},
    "Pan": {"unidad": "g", "cantidad": 1800},
    "Panales": {"unidad": "unidad", "cantidad": 150},
    "Papa y tuberculos": {"unidad": "g", "cantidad": 2000},
    "Pastas frescas y tapas": {"unidad": "g", "cantidad": 500},
    "Perfumeria": {"unidad": "cc", "cantidad": 250},
    "Pescado": {"unidad": "g", "cantidad": 600},
    "Pollo": {"unidad": "g", "cantidad": 1300},
    "Premezclas e ingredientes para hornear": {"unidad": "g", "cantidad": 300},
    "Quesos": {"unidad": "g", "cantidad": 300},
    "Rebozadores y pan rallado": {"unidad": "g", "cantidad": 300},
    "Sal": {"unidad": "g", "cantidad": 250},
    "Snacks": {"unidad": "g", "cantidad": 300},
    "Te": {"unidad": "g", "cantidad": 100},
    "Textil y calzado": {"unidad": "unidad", "cantidad": 1},
    "Verduras": {"unidad": "g", "cantidad": 2500},
    "Verduras y papas procesadas": {"unidad": "g", "cantidad": 800},
    "Vinagre": {"unidad": "cc", "cantidad": 500},
    "Vinos y licores": {"unidad": "cc", "cantidad": 1500},
    "Yerba mate": {"unidad": "g", "cantidad": 400},
    "Yogur": {"unidad": "g", "cantidad": 500},
}

GAMAS = ("economico", "medio", "premium")
MASA_O_VOLUMEN = {"g", "cc"}

# Referencias de cantidad: las de la Canasta Basica Alimentaria del INDEC para
# Gran Buenos Aires, por adulto equivalente y por mes. Es la misma tabla que la
# seed composicion_canasta.csv, y un test verifica que sigan iguales. Hasta el
# 2026-09-24 eran rangos sin fuente y muy por debajo (pan 1,5-2 kg contra 6,75
# del INDEC): la misma familia de 4 en Palermo costaba $332.858 en Tu canasta y
# $669.923 en Canasta basica.
#
# LA BASE LA ARMA EL CODIGO, NO EL MODELO (2026-09-26). Se le pedia a Gemini que
# partiera de estas cantidades y ajustara, y armaba solo lo que el usuario
# nombraba: "vivo solo, como mucha carne y muchos huevos y tomo mate" salia con
# carne, huevos y yerba, y ninguna otra cosa. Reforzar la regla en el prompt lo
# arreglaba en una corrida y volvia a fallar en la siguiente. Ahora el modelo
# devuelve solo lo que depende de la descripcion (adultos equivalentes, que
# sacar, que ajustar o sumar) y armar_canasta pone la base.
#
# Las bebidas de la seed no van en la base: se suman si el usuario las menciona,
# con la cantidad de BEBIDAS_INDEC como referencia.
BASE_INDEC = {
    "Pan": 6750, "Galletitas saladas": 420, "Galletitas dulces": 210,
    "Arroz": 1200, "Harina": 1290, "Fideos": 1740, "Legumbres": 240,
    "Papa y tuberculos": 7020, "Verduras": 5730, "Frutas": 4950,
    "Carne vacuna": 4440, "Pollo": 1650, "Pescado": 180, "Fiambres": 60,
    "Huevos": 11,
    "Leche fluida": 9270, "Quesos": 330, "Yogur": 570, "Manteca y margarina": 60,
    "Aceite": 1200, "Azucar": 1230, "Dulces y mermeladas": 330,
    "Yerba mate": 510, "Cafe": 30,
    "Sal": 120, "Otros condimentos": 120, "Vinagre": 60,
}
BEBIDAS_INDEC = {"Gaseosas": 1150, "Aguas": 1150, "Jugos": 1150, "Cerveza": 540, "Vinos y licores": 540}

UNIDAD_TEXTO = {"g": "g", "cc": "cc", "unidad": " unidades"}


def _referencias():
    lineas = [f"- {c}: {q}{UNIDAD_TEXTO[CATEGORIAS[c]['unidad']]}" for c, q in BASE_INDEC.items()]
    bebidas = ", ".join(f"{c} {q}cc" for c, q in BEBIDAS_INDEC.items())
    return (
        "CANASTA BASE: por adulto equivalente y por mes, de la Canasta Basica Alimentaria del INDEC (Gran Buenos Aires). "
        "El sistema la agrega sola, multiplicada por los adultos equivalentes que indiques:\n"
        + "\n".join(lineas)
        + "\n\nBebidas (NO estan en la base; sumalas solo si el usuario las menciona, con esta referencia "
        f"por adulto equivalente): {bebidas}. Cerveza si se toma seguido: 4000-6000cc por adulto.\n\n"
        "ADULTOS EQUIVALENTES (como el INDEC): cada adulto cuenta 0,9; cada chico en edad escolar 0,65; un bebe 0,35. "
        "Una familia de dos adultos y dos chicos son 3,1. Si no dice cuantos son, 0,9 (una persona)."
    )


PROMPT_BASE = """Sos un asistente que arma canastas de compra mensuales para supermercados en Argentina.

El usuario describe en lenguaje natural que consume. La canasta base del INDEC se agrega sola; vos decidis solo lo que depende de la descripcion.

{referencias}

Categorias validas, con la unidad en que se miden entre parentesis: {categorias}

QUE TENES QUE DEVOLVER:
1. "adultos_equivalentes": cuantos adultos equivalentes son en el hogar (numero).
2. "gama": "economico", "medio" o "premium" segun el presupuesto que describa. Si no lo menciona, "economico".
3. "quitar": categorias de la CANASTA BASE que NO van, solo si el usuario dice que no las consume o que las compra fuera del supermercado. Un vegetariano no lleva Carne vacuna, Pollo, Pescado ni Fiambres (si lleva todo lo demas). Si compra en carniceria: Carne vacuna y Pollo; en verduleria: Frutas, Verduras y Papa y tuberculos; en panaderia: Pan. Si nombra solo una parte ("el pollo lo compro en la polleria"), saca solo esa. Si no hay nada que sacar, lista vacia.
4. "items": SOLO las categorias que cambian respecto de la base por lo que describe, o que hay que sumar porque no estan en la base. No repitas las de la base que quedan igual.
   - Si la categoria ESTA en la base, da un "factor" sobre la cantidad de la base y NO una cantidad: 1.5 es 50% mas, 2 el doble, 0.5 la mitad. El sistema hace la cuenta.
   - Si NO esta en la base, da la "cantidad" mensual TOTAL del hogar.
   Ejemplos: "como mucha carne" -> Carne vacuna con factor 1.5; "tomamos mucha leche" -> Leche fluida con factor 1.5; "cocino poco" -> Harina, Arroz, Fideos, Legumbres, Papa y tuberculos, Verduras y Aceite con factor 0.5, y Comidas preparadas con su cantidad; "tomamos cerveza" -> Cerveza con su cantidad; "tenemos un bebe" -> Panales y Higiene bebe con su cantidad.
5. "solo_lo_mencionado": true SOLO si el usuario pide explicitamente una lista con nada mas que ciertas cosas ("solo quiero cotizar yerba y cafe"). Describir lo que come no es eso: false.

REGLAS:
- SOLO categorias de la lista, escritas exactamente igual. NUNCA inventes una.
- La unidad de cada item es EXACTAMENTE la de la lista: "g" (gramos), "cc" (mililitros) o "unidad".
- En las categorias por unidad, la unidad es la PIEZA, no el paquete: un huevo, un panal, una toallita. Un bebe usa unos 150 panales y 200 toallitas (Higiene bebe) por mes.
- Los basicos van en su categoria basica salvo que el usuario pida la variante: "aceite" es Aceite (girasol, maiz, mezcla), no Aceite de oliva y especiales; "papas" es Papa y tuberculos, no Verduras y papas procesadas; "azucar" es Azucar, no Edulcorantes; "fideos" es Fideos, no Pastas frescas y tapas. Usa la categoria de la variante solo si la menciona (aceite de oliva, papas fritas congeladas, edulcorante, ravioles, premezcla, pan rallado).
- Categorias que se confunden: "Embutidos" son chorizo, morcilla y salchichas (tambien las tipo viena); "Elaborados de carne" son hamburguesas, milanesas, nuggets y patitas de pollo; "Achuras y menudencias" son higado, mondongo, chinchulines, mollejas y rinon; "Comidas preparadas" es comida hecha (pizzas, empanadas, tartas, platos listos); el pan de pancho y el de hamburguesa son "Pan" y se suman al de la base (factor mayor a 1, nunca menor). Un "asado" suma Carne vacuna y tambien Embutidos (el chorizo y la morcilla van siempre).
- Cada item lleva una razon breve (una frase).

Responde UNICAMENTE con un JSON valido con este formato exacto:

{{
  "adultos_equivalentes": 0.9,
  "gama": "economico",
  "quitar": [],
  "solo_lo_mencionado": false,
  "items": [
    {{"categoria": "Carne vacuna", "factor": 1.5, "unidad": "g", "gama": "economico", "razon": "..."}},
    {{"categoria": "Cerveza", "cantidad": 4000, "unidad": "cc", "gama": "economico", "razon": "..."}}
  ]
}}

Descripcion del usuario: "{descripcion}"
"""

_cliente = None


def _cliente_gemini():
    """El cliente se crea en el primer uso y no al importar: asi el modulo se puede
    importar (tests, el endpoint de categorias) sin necesitar la API key."""
    global _cliente
    if _cliente is None:
        _cliente = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _cliente


def construir_prompt(descripcion: str) -> str:
    categorias = ", ".join(f"{nombre} ({datos['unidad']})" for nombre, datos in sorted(CATEGORIAS.items()))
    return PROMPT_BASE.format(
        referencias=_referencias(),
        categorias=categorias,
        descripcion=descripcion,
    )


def normalizar_items(datos: dict) -> dict:
    """Valida lo que devolvio el modelo y corrige la unidad cuando no coincide.

    - Categoria fuera de la lista, gama invalida o cantidad no positiva: se descarta.
    - Unidad distinta de la de la categoria:
        g <-> cc: se usa la unidad de la categoria sin tocar la cantidad. En los
            alimentos donde se confunden (yogur, aceite, dulces) un cc pesa cerca
            de un gramo, y es mejor que dejar el item sin cotizar.
        entre "unidad" y g/cc: no hay conversion posible sin inventar un peso por
            pieza, asi que se usa la cantidad sugerida de la categoria.
    """
    items = []
    crudos = datos.get("items") if isinstance(datos, dict) else None
    for item in crudos if isinstance(crudos, list) else []:
        if not isinstance(item, dict):
            continue
        categoria = item.get("categoria")
        referencia = CATEGORIAS.get(categoria)
        cantidad = item.get("cantidad")
        if referencia is None or item.get("gama") not in GAMAS:
            continue
        if isinstance(cantidad, bool) or not isinstance(cantidad, (int, float)) or cantidad <= 0:
            continue
        unidad = item.get("unidad")
        if unidad != referencia["unidad"]:
            if not ({unidad, referencia["unidad"]} <= MASA_O_VOLUMEN):
                cantidad = referencia["cantidad"]
            unidad = referencia["unidad"]
        items.append({
            "categoria": categoria,
            "cantidad": cantidad,
            "unidad": unidad,
            "gama": item["gama"],
            "razon": item.get("razon", "") if isinstance(item.get("razon", ""), str) else "",
        })
    return {"items": items}


# Rango de adultos equivalentes que se acepta del modelo: un bebe solo y un
# hogar grande. Fuera de eso es un error de lectura, y se usa una persona.
ADULTOS_MINIMO, ADULTOS_MAXIMO, ADULTOS_POR_DEFECTO = 0.35, 15, 0.9
# Mas que eso sobre la base ya no es un ajuste de habitos sino un error.
FACTOR_MAXIMO = 5


def _redondear(cantidad, unidad):
    return round(cantidad) if unidad == "unidad" else int(round(cantidad / 10) * 10)


def armar_canasta(datos: dict) -> dict:
    """Arma la canasta: la base del INDEC por los adultos equivalentes, menos lo
    que el usuario no consume, con lo que cambia o se suma encima.

    Lo que devolvio el modelo se valida igual que antes (normalizar_items). Un
    item del modelo pisa al de la base de su misma categoria, aunque este en
    "quitar": que lo nombre con cantidad es mas explicito que la lista.
    """
    datos = datos if isinstance(datos, dict) else {}
    adultos = datos.get("adultos_equivalentes")
    if (isinstance(adultos, bool) or not isinstance(adultos, (int, float))
            or not ADULTOS_MINIMO <= adultos <= ADULTOS_MAXIMO):
        adultos = ADULTOS_POR_DEFECTO

    # En las categorias de la base el modelo da un factor y la cuenta se hace
    # aca: pedirle la cantidad total fallaba en la multiplicacion ("tomamos
    # mucha leche" salia con menos leche que la base de ese hogar).
    crudos = datos.get("items") if isinstance(datos.get("items"), list) else []
    items = []
    for item in crudos:
        if isinstance(item, dict) and item.get("categoria") in BASE_INDEC and "factor" in item:
            factor = item.get("factor")
            if isinstance(factor, bool) or not isinstance(factor, (int, float)) or not 0 < factor <= FACTOR_MAXIMO:
                continue
            categoria = item["categoria"]
            item = {**item, "cantidad": _redondear(BASE_INDEC[categoria] * adultos * factor,
                                                   CATEGORIAS[categoria]["unidad"]),
                    "unidad": CATEGORIAS[categoria]["unidad"]}
        items.append(item)
    propios = normalizar_items({"items": items})["items"]

    # Una cantidad diez veces menor a la sugerida en una categoria fuera de la
    # base es una lectura equivocada, no un consumo: el modelo contaba paquetes
    # en vez de piezas y ponia 5 toallitas por mes para un bebe.
    for item in propios:
        sugerida = CATEGORIAS[item["categoria"]]["cantidad"]
        if item["categoria"] not in BASE_INDEC and item["cantidad"] < sugerida / 10:
            item["cantidad"] = sugerida

    if datos.get("solo_lo_mencionado") is True:
        return {"items": propios}
    gama = datos.get("gama") if datos.get("gama") in GAMAS else "economico"
    quitar = datos.get("quitar") if isinstance(datos.get("quitar"), list) else []
    quitar = {c for c in quitar if isinstance(c, str)}
    nombrados = {i["categoria"] for i in propios}

    adultos_texto = f"{adultos:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    base = [
        {
            "categoria": categoria,
            "cantidad": _redondear(cantidad * adultos, CATEGORIAS[categoria]["unidad"]),
            "unidad": CATEGORIAS[categoria]["unidad"],
            "gama": gama,
            "razon": f"Canasta del INDEC para {adultos_texto} adultos equivalentes.",
        }
        for categoria, cantidad in BASE_INDEC.items()
        if categoria not in quitar and categoria not in nombrados
    ]
    return {"items": base + propios}


def interpretar_descripcion(descripcion: str) -> dict:
    respuesta = _cliente_gemini().models.generate_content(
        model=MODELO,
        contents=construir_prompt(descripcion),
        # Modo JSON: el modelo devuelve JSON sin envolverlo en bloques de markdown,
        # que antes habia que limpiar a mano y era la parte fragil del parseo.
        # Temperatura baja: la misma descripcion tiene que dar la misma canasta.
        # Con la del modelo por defecto, "familia de 4" salia con 15 categorias
        # en una corrida y 29 en la siguiente, y el costo cambiaba al doble.
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
    )
    texto = (respuesta.text or "").strip()
    if texto.startswith("```"):
        texto = texto.strip("`").removeprefix("json").strip()
    return armar_canasta(json.loads(texto))
