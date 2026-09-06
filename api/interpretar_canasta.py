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

PROMPT_BASE = """Sos un asistente que arma canastas de compra personalizadas para supermercados en Argentina.

El usuario va a describir en lenguaje natural que consume o que necesita. Tu trabajo es traducir eso a una lista de categorias de productos, con una cantidad mensual estimada (en gramos, cc, o unidades segun corresponda) y un nivel de gama (economico, medio o premium).

REGLAS ESTRICTAS:
1. SOLO podes usar categorias de esta lista exacta, tal cual estan escritas: {categorias}
2. NUNCA inventes una categoria que no este en la lista.
3. Las cantidades deben ser realistas para el periodo de UN MES, pensando en la cantidad de personas que el usuario menciona (si no menciona, asumi 1 adulto).
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
