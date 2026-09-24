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
# Gran Buenos Aires, por adulto equivalente y por mes (las mismas de la seed
# composicion_canasta). Hasta el 2026-09-24 eran rangos sin fuente ("basadas en
# consumo promedio real") y muy por debajo: pan 1,5-2 kg contra 6,75 del INDEC,
# leche 2-3 litros contra 9,27, carne 1,5-2,5 kg contra 4,44. Ademas se
# multiplicaba por personas y no por adultos equivalentes. El resultado: la
# misma familia de 4 en Palermo costaba $332.858 en Tu canasta y $669.923 en
# Canasta basica, en el mismo sitio.
REFERENCIAS_MENSUALES_PER_CAPITA = """Referencias de cantidad MENSUAL por ADULTO EQUIVALENTE, de la Canasta Basica Alimentaria del INDEC (Gran Buenos Aires). Son el punto de partida; despues se ajusta segun lo que describa el usuario:
- Pan: 6750g
- Galletitas saladas: 420g. Galletitas dulces: 210g
- Arroz: 1200g. Fideos: 1740g. Harina: 1290g. Legumbres: 240g
- Papa y tuberculos: 7020g
- Verduras: 5730g. Frutas: 4950g
- Carne vacuna: 4440g. Pollo: 1650g. Pescado: 180g. Fiambres: 60g
- Huevos: 11 unidades
- Leche fluida: 9270cc. Quesos: 330g. Yogur: 570g. Manteca y margarina: 60g
- Aceite: 1200cc
- Azucar: 1230g. Dulces y mermeladas: 330g
- Gaseosas, Jugos y Aguas: 1150cc cada una (si se consumen)
- Cerveza y Vinos y licores: 540cc cada una (si se consumen); 4000-6000cc de cerveza si se toma seguido
- Yerba mate: 510g. Cafe: 30g
- Sal: 120g. Otros condimentos: 120g. Vinagre: 60cc
- Lo que no esta en la lista (cerdo, elaborados de carne, embutidos, limpieza, higiene, panales, etc.): una cantidad razonable si el usuario lo menciona.

ADULTOS EQUIVALENTES (como el INDEC): cada adulto cuenta 0,9; cada chico en edad escolar 0,65; un bebe 0,35. Una familia de dos adultos y dos chicos son 3,1 adultos equivalentes: multiplica las referencias por ese numero, no por la cantidad de personas.

Ajusta hacia arriba o abajo segun lo que describa (ej. "comemos mucha carne" -> subir esa categoria; "casi no tomamos gaseosa" -> bajarla o no incluirla)."""

PROMPT_BASE = """Sos un asistente que arma canastas de compra personalizadas para supermercados en Argentina.

El usuario va a describir en lenguaje natural que consume o que necesita. Tu trabajo es traducir eso a una lista de categorias de productos, con una cantidad mensual estimada y un nivel de gama (economico, medio o premium).

{referencias}

REGLAS ESTRICTAS:
1. SOLO podes usar categorias de esta lista exacta, tal cual estan escritas. Entre parentesis figura la unidad en la que se mide cada una: {categorias}
2. NUNCA inventes una categoria que no este en la lista.
3. Usa las referencias de cantidad de arriba como punto de partida, multiplicando por los ADULTOS EQUIVALENTES del hogar (si no menciona, asumi 1 adulto: 0,9), y ajustando segun lo que describa.
4. La unidad de cada item tiene que ser EXACTAMENTE la que figura entre parentesis para su categoria: "g" (gramos), "cc" (mililitros) o "unidad".
5. El campo "gama" debe ser "economico", "medio", o "premium" segun el presupuesto que el usuario describa. Si no lo menciona, usa "economico".
6. Los basicos van en su categoria basica salvo que el usuario pida la variante: "aceite" es Aceite (girasol, maiz, mezcla), no Aceite de oliva y especiales; "papas" es Papa y tuberculos, no Verduras y papas procesadas; "azucar" es Azucar, no Edulcorantes; "fideos" es Fideos, no Pastas frescas y tapas; "harina" es Harina. Usa la categoria de la variante solo si la menciona (aceite de oliva, papas fritas congeladas, edulcorante, ravioles, premezcla, pan rallado). Y si menciona SOLO la variante, no agregues tambien el basico: "papas congeladas" es Verduras y papas procesadas y nada de Papa y tuberculos.
   Categorias que se confunden: "Embutidos" son chorizo, morcilla y salchichas (tambien las tipo viena); "Elaborados de carne" son hamburguesas, milanesas, nuggets y patitas de pollo; "Achuras y menudencias" son higado, mondongo, chinchulines, mollejas y riñon; "Comidas preparadas" es comida hecha (pizzas, empanadas, tartas, platos listos); el pan de pancho y el de hamburguesa son "Pan". Un "asado" suma Carne vacuna y tambien Embutidos (el chorizo y la morcilla van siempre).
7. La canasta se cotiza con precios de SUPERMERCADO. Si el usuario dice que algo lo compra en otro lado, NO incluyas esas categorias: carniceria -> Carne vacuna, Pollo, Cerdo, Achuras y menudencias; verduleria -> Frutas, Verduras, Papa y tuberculos; panaderia -> Pan, Facturas y reposteria. Si nombra solo una parte ("el pollo lo compro en la polleria"), saca solo esa.
8. Da una razon breve (una frase) de por que incluiste cada categoria.
9. Responde UNICAMENTE con un JSON valido con este formato exacto:

{{
  "items": [
    {{"categoria": "...", "cantidad": 1000, "unidad": "g", "gama": "economico", "razon": "..."}}
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
        referencias=REFERENCIAS_MENSUALES_PER_CAPITA,
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


def interpretar_descripcion(descripcion: str) -> dict:
    respuesta = _cliente_gemini().models.generate_content(
        model=MODELO,
        contents=construir_prompt(descripcion),
        # Modo JSON: el modelo devuelve JSON sin envolverlo en bloques de markdown,
        # que antes habia que limpiar a mano y era la parte fragil del parseo.
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    texto = (respuesta.text or "").strip()
    if texto.startswith("```"):
        texto = texto.strip("`").removeprefix("json").strip()
    return normalizar_items(json.loads(texto))
