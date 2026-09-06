import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

CATEGORIAS_VALIDAS = [
    "Accesorios mascotas", "Aceite", "Aguas", "Alimento para mascotas",
    "Alimentos para bebe", "Arroz", "Azucar", "Bazar y hogar", "Cacao",
    "Cafe", "Carne vacuna", "Cerveza", "Conservas", "Descartables",
    "Dietetica suplementos y frutos secos", "Dulces y mermeladas", "Electro",
    "Embutidos", "Facturas y reposteria", "Ferreteria", "Fiambres", "Fideos",
    "Frutas", "Galletitas dulces", "Galletitas saladas", "Gaseosas",
    "Golosinas y chocolates", "Harina", "Higiene bebe", "Higiene personal",
    "Huevos", "Jugos", "Jugueteria", "Lavanderia", "Leche en polvo",
    "Leche fluida", "Legumbres", "Libreria", "Limpieza del hogar",
    "Manteca y margarina", "Otras grasas", "Otros condimentos", "Pan",
    "Panales", "Papa y tuberculos", "Perfumeria", "Pescado", "Pollo",
    "Quesos", "Sal", "Snacks", "Te", "Textil y calzado", "Verduras",
    "Vinagre", "Vinos y licores", "Yerba mate", "Yogur",
]

REFERENCIAS_MENSUALES_PER_CAPITA = """Como referencia de cantidades MENSUALES razonables para UN adulto (basadas en consumo promedio real en Argentina), antes de ajustar segun lo que describa el usuario:
- Pan: 1500-2000g
- Arroz: 500-800g
- Fideos: 600-900g
- Harina: 400-600g
- Papa y tuberculos: 1500-2500g (NO mas de 3000g salvo consumo muy alto declarado)
- Azucar: 400-600g
- Aceite: 400-600cc
- Carne vacuna: 1500-2500g
- Pollo: 1000-1500g
- Pescado: 400-800g
- Huevos: 8-15 unidades
- Leche fluida: 2000-3000cc
- Quesos: 200-400g
- Yogur: 300-600cc
- Frutas: 2000-3000g
- Verduras: 2000-3000g
- Aguas: 6000-9000cc (2-3 litros por dia)
- Gaseosas/Jugos: 1000-2000cc cada una (si se consumen)
- Yerba mate: 300-500g (si se consume)
- Cafe: 100-200g (si se consume)
- Legumbres: 200-400g

Estos son valores de referencia para UNA persona por UN mes. Multiplica proporcionalmente segun la cantidad de personas que mencione el usuario, y ajusta hacia arriba o abajo segun lo que describa (ej. "comemos mucha carne" -> subir esa categoria; "casi no tomamos gaseosa" -> bajarla o no incluirla)."""

PROMPT_BASE = """Sos un asistente que arma canastas de compra personalizadas para supermercados en Argentina.

El usuario va a describir en lenguaje natural que consume o que necesita. Tu trabajo es traducir eso a una lista de categorias de productos, con una cantidad mensual estimada (en gramos, cc, o unidades segun corresponda) y un nivel de gama (economico, medio o premium).

{referencias}

REGLAS ESTRICTAS:
1. SOLO podes usar categorias de esta lista exacta, tal cual estan escritas: {categorias}
2. NUNCA inventes una categoria que no este en la lista.
3. Usa las referencias de cantidad de arriba como punto de partida, multiplicando por la cantidad de personas que el usuario menciona (si no menciona, asumi 1 adulto), y ajustando segun lo que describa.
4. La unidad debe ser "g" (gramos), "cc" (mililitros/centimetros cubicos), o "unidad" (para productos que se cuentan, como huevos).
5. El campo "gama" debe ser "economico", "medio", o "premium" segun el presupuesto que el usuario describa. Si no lo menciona, usa "economico".
6. Da una razon breve (una frase) de por que incluiste cada categoria.
7. Responde UNICAMENTE con un JSON valido, sin texto adicional antes ni despues, sin bloques de markdown. El formato exacto es:

{{
  "items": [
    {{"categoria": "...", "cantidad": 1000, "unidad": "g", "gama": "economico", "razon": "..."}}
  ]
}}

Descripcion del usuario: "{descripcion}"
"""

modelo = genai.GenerativeModel("gemini-flash-lite-latest")


def interpretar_descripcion(descripcion: str) -> dict:
    prompt = PROMPT_BASE.format(
        referencias=REFERENCIAS_MENSUALES_PER_CAPITA,
        categorias=", ".join(CATEGORIAS_VALIDAS),
        descripcion=descripcion,
    )

    respuesta = modelo.generate_content(prompt)
    texto = respuesta.text.strip()

    if texto.startswith("```"):
        texto = texto.split("```")[1]
        if texto.startswith("json"):
            texto = texto[4:]
        texto = texto.strip()

    datos = json.loads(texto)

    items_validados = [
        item for item in datos.get("items", [])
        if item.get("categoria") in CATEGORIAS_VALIDAS
        and item.get("unidad") in ("g", "cc", "unidad")
        and item.get("gama") in ("economico", "medio", "premium")
        and isinstance(item.get("cantidad"), (int, float))
        and item.get("cantidad") > 0
    ]

    return {"items": items_validados}
