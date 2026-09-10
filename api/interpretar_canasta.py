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
    "Accesorios mascotas": {"unidad": "unidad", "cantidad": 1},
    "Aceite": {"unidad": "cc", "cantidad": 500},
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
    "Conservas": {"unidad": "g", "cantidad": 500},
    "Descartables": {"unidad": "unidad", "cantidad": 50},
    "Dietetica suplementos y frutos secos": {"unidad": "g", "cantidad": 300},
    "Dulces y mermeladas": {"unidad": "g", "cantidad": 400},
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
    "Perfumeria": {"unidad": "cc", "cantidad": 250},
    "Pescado": {"unidad": "g", "cantidad": 600},
    "Pollo": {"unidad": "g", "cantidad": 1300},
    "Quesos": {"unidad": "g", "cantidad": 300},
    "Sal": {"unidad": "g", "cantidad": 250},
    "Snacks": {"unidad": "g", "cantidad": 300},
    "Te": {"unidad": "g", "cantidad": 100},
    "Textil y calzado": {"unidad": "unidad", "cantidad": 1},
    "Verduras": {"unidad": "g", "cantidad": 2500},
    "Vinagre": {"unidad": "cc", "cantidad": 500},
    "Vinos y licores": {"unidad": "cc", "cantidad": 1500},
    "Yerba mate": {"unidad": "g", "cantidad": 400},
    "Yogur": {"unidad": "g", "cantidad": 500},
}

GAMAS = ("economico", "medio", "premium")
MASA_O_VOLUMEN = {"g", "cc"}

REFERENCIAS_MENSUALES_PER_CAPITA = """Como referencia de cantidades MENSUALES razonables para UN adulto (basadas en consumo promedio real en Argentina), antes de ajustar segun lo que describa el usuario:
- Pan: 1500-2000g
- Arroz: 500-800g
- Fideos: 600-900g
- Harina: 400-600g
- Papa y tuberculos: 1500-2500g (NO mas de 3000g salvo consumo muy alto declarado)
- Azucar: 400-600g
- Aceite: 400-600cc
- Carne vacuna: 1500-2500g (solo cortes vacunos; el cerdo, las achuras y las milanesas o hamburguesas van en sus propias categorias)
- Pollo: 1000-1500g (pollo entero y presas)
- Pescado: 400-800g
- Cerdo: 300-700g (si se consume)
- Achuras y menudencias: 200-500g (si se consumen)
- Elaborados de carne: 500-1000g (milanesas, hamburguesas, nuggets; si se consumen)
- Huevos: 8-15 unidades
- Leche fluida: 2000-3000cc
- Quesos: 200-400g
- Yogur: 300-600g
- Frutas: 2000-3000g
- Verduras: 2000-3000g
- Aguas: 6000-9000cc (2-3 litros por dia)
- Gaseosas/Jugos: 1000-2000cc cada una (si se consumen)
- Yerba mate: 300-500g (si se consume)
- Cafe: 100-200g (si se consume)
- Legumbres: 200-400g

Estos son valores de referencia para UNA persona por UN mes. Multiplica proporcionalmente segun la cantidad de personas que mencione el usuario, y ajusta hacia arriba o abajo segun lo que describa (ej. "comemos mucha carne" -> subir esa categoria; "casi no tomamos gaseosa" -> bajarla o no incluirla)."""

PROMPT_BASE = """Sos un asistente que arma canastas de compra personalizadas para supermercados en Argentina.

El usuario va a describir en lenguaje natural que consume o que necesita. Tu trabajo es traducir eso a una lista de categorias de productos, con una cantidad mensual estimada y un nivel de gama (economico, medio o premium).

{referencias}

REGLAS ESTRICTAS:
1. SOLO podes usar categorias de esta lista exacta, tal cual estan escritas. Entre parentesis figura la unidad en la que se mide cada una: {categorias}
2. NUNCA inventes una categoria que no este en la lista.
3. Usa las referencias de cantidad de arriba como punto de partida, multiplicando por la cantidad de personas que el usuario menciona (si no menciona, asumi 1 adulto), y ajustando segun lo que describa.
4. La unidad de cada item tiene que ser EXACTAMENTE la que figura entre parentesis para su categoria: "g" (gramos), "cc" (mililitros) o "unidad".
5. El campo "gama" debe ser "economico", "medio", o "premium" segun el presupuesto que el usuario describa. Si no lo menciona, usa "economico".
6. Da una razon breve (una frase) de por que incluiste cada categoria.
7. Responde UNICAMENTE con un JSON valido con este formato exacto:

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
