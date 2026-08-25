import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
cliente = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("Modelos disponibles para tu cuenta:\n")
for modelo in cliente.models.list():
    # Mostramos solo los que sirven para generar texto
    if "generateContent" in modelo.supported_actions:
        print(modelo.name)