import os
import time
import json
from dotenv import load_dotenv
from google import genai
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# --- Configuracion ---
load_dotenv()
cliente_ia = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
cliente_bq = bigquery.Client.from_service_account_json("credenciales.json")

PROYECTO = "proyecto-precios-504221"
MODELO = "gemini-flash-lite-latest"
TAMANO_LOTE = 50

CATEGORIA_A_RUBRO = {
    "Leche fluida": "Lacteos", "Leche en polvo": "Lacteos", "Quesos": "Lacteos",
    "Yogur": "Lacteos", "Manteca y margarina": "Lacteos",
    "Carne vacuna": "Carnes", "Pollo": "Carnes", "Pescado": "Carnes",
    "Fiambres": "Carnes", "Embutidos": "Carnes",
    "Arroz": "Almacen", "Fideos": "Almacen", "Harina": "Almacen",
    "Galletitas dulces": "Almacen", "Galletitas saladas": "Almacen",
    "Legumbres": "Almacen", "Conservas": "Almacen",
    "Golosinas y chocolates": "Almacen", "Snacks": "Almacen",
    "Dietetica suplementos y frutos secos": "Almacen",
    "Pan": "Panaderia", "Facturas y reposteria": "Panaderia",
    "Verduras": "Verduleria y frutas", "Frutas": "Verduleria y frutas",
    "Papa y tuberculos": "Verduleria y frutas",
    "Aceite": "Aceites y grasas", "Otras grasas": "Aceites y grasas",
    "Azucar": "Infusiones y azucares", "Cafe": "Infusiones y azucares",
    "Te": "Infusiones y azucares", "Yerba mate": "Infusiones y azucares",
    "Cacao": "Infusiones y azucares",
    "Sal": "Condimentos", "Vinagre": "Condimentos", "Otros condimentos": "Condimentos",
    "Gaseosas": "Bebidas", "Jugos": "Bebidas", "Aguas": "Bebidas",
    "Cerveza": "Bebidas", "Vinos y licores": "Bebidas",
    "Limpieza del hogar": "Limpieza", "Lavanderia": "Limpieza", "Descartables": "Limpieza",
    "Higiene personal": "Higiene", "Perfumeria": "Higiene",
    "Panales": "Bebes", "Alimentos para bebe": "Bebes", "Higiene bebe": "Bebes",
    "Alimento para mascotas": "Mascotas", "Accesorios mascotas": "Mascotas",
    "Electro": "No alimentario", "Textil y calzado": "No alimentario",
    "Jugueteria": "No alimentario", "Libreria": "No alimentario",
    "Bazar y hogar": "No alimentario", "Ferreteria": "No alimentario",
    "Otros": "Otros",
}

CATEGORIAS = list(CATEGORIA_A_RUBRO.keys())


def traer_productos_a_categorizar():
    tabla_cat = f"{PROYECTO}.sepa.producto_categoria"
    try:
        cliente_bq.get_table(tabla_cat)
        existe = True
    except NotFound:
        existe = False

    if existe:
        filtro = f"""
          AND id_producto NOT IN (
              SELECT id_producto FROM `{tabla_cat}`
          )
        """
    else:
        filtro = ""

    query = f"""
        SELECT
            id_producto,
            ANY_VALUE(productos_descripcion) AS descripcion,
            ANY_VALUE(productos_marca) AS marca
        FROM `{PROYECTO}.sepa.productos`
        WHERE id_producto IS NOT NULL
          AND productos_descripcion IS NOT NULL
          {filtro}
        GROUP BY id_producto
    """
    return list(cliente_bq.query(query).result())


def construir_prompt(lote):
    lista_cat = ", ".join(CATEGORIAS)
    lineas = []
    for n, p in enumerate(lote):
        marca = p["marca"] or ""
        lineas.append(f"{n+1}. {p['descripcion']} | marca: {marca}")
    texto_productos = "\n".join(lineas)

    return f"""Sos un clasificador de productos de supermercados argentinos. Clasifica cada producto en UNA de estas categorias exactas:
{lista_cat}

Reglas:
- Elegi la categoria mas especifica que corresponda.
- Usa la marca como ayuda (ej: Coca-Cola/Pepsi -> Gaseosas; Disney/Lego -> Jugueteria; Samsung/BGH/Philco -> Electro; Ipanema -> Textil y calzado; Maped/Bic -> Libreria).
- Los supermercados grandes venden mucho mas que comida: televisores, ropa, juguetes, utiles, ollas, herramientas. Clasifica eso en las categorias No alimentario (Electro, Textil y calzado, Jugueteria, Libreria, Bazar y hogar, Ferreteria), NO en "Otros".
- "Bazar y hogar" incluye ollas, cubiertos, vasos, sahumerios, velas, adornos, y cositas de hogar.
- Alimentos menos obvios: mani/papitas/palitos -> Snacks; caramelos/chocolates/alfajores -> Golosinas y chocolates; proteinas/creatina/frutos secos/pasta de mani fit -> Dietetica suplementos y frutos secos.
- Usa "Otros" SOLO si realmente no encaja en ninguna (debe ser muy poco).

Devolve UNICAMENTE un JSON valido: una lista donde cada elemento tiene "n" (numero del producto) y "categoria" (una de las categorias exactas de la lista). Sin texto adicional, sin markdown.

Productos:
{texto_productos}"""


def guardar_en_bigquery(resultados):
    if not resultados:
        return
    tabla_destino = f"{PROYECTO}.sepa.producto_categoria"
    config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        schema=[
            bigquery.SchemaField("id_producto", "STRING"),
            bigquery.SchemaField("descripcion", "STRING"),
            bigquery.SchemaField("marca", "STRING"),
            bigquery.SchemaField("categoria", "STRING"),
            bigquery.SchemaField("rubro", "STRING"),
        ],
    )
    job = cliente_bq.load_table_from_json(resultados, tabla_destino, job_config=config)
    job.result()


def main():
    print("Trayendo productos a categorizar desde BigQuery...")
    productos = traer_productos_a_categorizar()
    print(f"  -> {len(productos)} productos para categorizar\n")

    if not productos:
        print("No hay productos nuevos para categorizar. Nada que hacer.")
        return

    GUARDAR_CADA = 10
    buffer = []
    total_guardado = 0
    total_lotes = (len(productos) + TAMANO_LOTE - 1) // TAMANO_LOTE

    for i in range(0, len(productos), TAMANO_LOTE):
        lote = productos[i:i + TAMANO_LOTE]
        num_lote = i // TAMANO_LOTE + 1
        prompt = construir_prompt(lote)

        try:
            respuesta = cliente_ia.models.generate_content(model=MODELO, contents=prompt)
            texto = respuesta.text.strip().replace("```json", "").replace("```", "").strip()
            categorias_lote = json.loads(texto)

            for item in categorias_lote:
                n = item["n"] - 1
                if 0 <= n < len(lote):
                    categoria = item["categoria"]
                    if categoria not in CATEGORIA_A_RUBRO:
                        categoria = "Otros"
                    rubro = CATEGORIA_A_RUBRO[categoria]
                    buffer.append({
                        "id_producto": lote[n]["id_producto"],
                        "descripcion": lote[n]["descripcion"],
                        "marca": lote[n]["marca"],
                        "categoria": categoria,
                        "rubro": rubro,
                    })
            print(f"Lote {num_lote}/{total_lotes}: {len(categorias_lote)} categorizados")
        except Exception as e:
            print(f"Lote {num_lote}/{total_lotes}: ERROR -> {e}")

        if num_lote % GUARDAR_CADA == 0 and buffer:
            guardar_en_bigquery(buffer)
            total_guardado += len(buffer)
            print(f"  >> Guardado parcial: {len(buffer)} productos (acumulado: {total_guardado})")
            buffer = []

        time.sleep(4)

    if buffer:
        guardar_en_bigquery(buffer)
        total_guardado += len(buffer)
        print(f"  >> Guardado final: {len(buffer)} productos")

    print(f"\nListo! Total categorizado y guardado en esta corrida: {total_guardado} productos")


if __name__ == "__main__":
    main()

