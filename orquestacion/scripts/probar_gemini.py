import os
from dotenv import load_dotenv
from google import genai
import time

# Cargamos la API key desde el archivo .env
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# Conectamos con Gemini
cliente = genai.Client(api_key=API_KEY)

# Lista fija de categorías (para que la IA sea consistente)
CATEGORIAS = [
    "Almacen", "Bebidas sin alcohol", "Bebidas con alcohol", "Lacteos",
    "Carnes", "Frutas y verduras", "Panaderia", "Limpieza",
    "Higiene y perfumeria", "Congelados", "Snacks y golosinas",
    "Bebes", "Mascotas", "Otros"
]

# Unos pocos productos de prueba (los escribo a mano para probar)
productos_prueba = [
    "COCA COLA REGULAR 2.25 LT",
    "FIDEOS SPAGHETTI MATARAZZO 500 GR",
    "LAVANDINA AYUDIN 1 LT",
    "LECHE ENTERA LA SERENISIMA 1 LT",
    "SHAMPOO SEDAL 340 ML",
]

# Armamos el prompt (la instruccion para la IA)
lista_cat = ", ".join(CATEGORIAS)

for producto in productos_prueba:
    prompt = f"""Clasifica el siguiente producto de supermercado en UNA SOLA de estas categorias: {lista_cat}.
Responde UNICAMENTE con el nombre exacto de la categoria, sin explicaciones ni texto adicional.

Producto: {producto}"""

    respuesta = cliente.models.generate_content(
        model="gemini-flash-latest",
        contents=prompt,
    )
    categoria = respuesta.text.strip()
    print(f"{producto}  -->  {categoria}")
    time.sleep(6)

print("\n¡Prueba terminada!")