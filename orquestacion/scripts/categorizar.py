import argparse
import collections
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import time
import json
from datetime import datetime, timezone
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
    # Agregadas el 2026-09-10. Sin una categoria para el cerdo, la clasificacion
    # lo mandaba a Carne vacuna: de los 335 productos economicos de esa
    # categoria, solo 138 eran vacunos (131 de cerdo, 57 achuras, 9 de cordero).
    # Eso abarataba la carne de la canasta y hacia incoherente compararla con el
    # pollo. Cada tipo de carne tiene ahora su categoria, y las achuras y los
    # elaborados (que tienen otro precio por kilo) van aparte.
    "Cerdo": "Carnes", "Otras carnes": "Carnes",
    "Achuras y menudencias": "Carnes", "Elaborados de carne": "Carnes",
    "Arroz": "Almacen", "Fideos": "Almacen", "Harina": "Almacen",
    "Galletitas dulces": "Almacen", "Galletitas saladas": "Almacen",
    "Legumbres": "Almacen", "Conservas": "Almacen",
    "Golosinas y chocolates": "Almacen", "Snacks": "Almacen",
    "Dietetica suplementos y frutos secos": "Almacen",
    # Huevos y Dulces y mermeladas faltaban en esta lista aunque tienen productos
    # (192 y 512) y las dos estan en la canasta basica: una version anterior del
    # prompt las tenia y se perdieron. Sin ellas, un producto nuevo de esas
    # categorias caia en otra sin que nada fallara. Detectado el 2026-09-10
    # comparando las categorias de los datos contra esta lista.
    "Huevos": "Almacen", "Dulces y mermeladas": "Almacen",
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


def ultima_fecha_cruda():
    """Ultima particion cargada en el crudo, leida de la metadata.

    INFORMATION_SCHEMA.PARTITIONS no escanea datos. Consultar MAX(fecha_datos)
    sobre la tabla costaria leer esa columna entera.
    """
    query = f"""
        SELECT MAX(PARSE_DATE('%Y%m%d', partition_id)) AS fecha
        FROM `{PROYECTO}.sepa.INFORMATION_SCHEMA.PARTITIONS`
        WHERE table_name = 'productos'
          AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
    """
    return list(cliente_bq.query(query).result())[0].fecha


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

    # Solo la ultima fecha del crudo, no las tres que retiene. BigQuery cobra
    # por columna leida y no por fila devuelta, asi que el NOT IN no abarata
    # nada: leer descripcion y marca de las 3 particiones costaba 2,22 GiB por
    # corrida, casi la octava parte del pipeline diario. Con una sola particion
    # es un tercio.
    #
    # No se pierde nada. Un producto de una fecha anterior ya paso por aca el
    # dia en que llego. Si un lote de Gemini fallo ese dia, el producto se
    # reintenta en cuanto vuelva a aparecer en una fecha nueva, y los que ya no
    # se venden no afectan ningun calculo: los marts leen las fechas recientes.
    #
    # La fecha va como parametro y no como subconsulta: con MAX() adentro de la
    # consulta BigQuery no poda particiones y escanea la tabla entera igual.
    fecha = ultima_fecha_cruda()
    print(f"  (se revisa la ultima fecha del crudo: {fecha})")

    query = f"""
        SELECT
            id_producto,
            ANY_VALUE(productos_descripcion) AS descripcion,
            ANY_VALUE(productos_marca) AS marca
        FROM `{PROYECTO}.sepa.productos`
        WHERE fecha_datos = @fecha
          AND id_producto IS NOT NULL
          AND productos_descripcion IS NOT NULL
          {filtro}
        GROUP BY id_producto
    """
    config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("fecha", "DATE", fecha)]
    )
    return list(cliente_bq.query(query, job_config=config).result())


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
- Carnes: cada tipo de carne va en su categoria, sin mezclar.
  - "Carne vacuna": SOLO cortes crudos de vaca, novillo o ternera, frescos o congelados, incluida la carne picada. "MILANESA DE NALGA" o "MILANESA DE CUADRADA" sin la palabra rebozada o empanada es carne cruda cortada para milanesa: va aca. Un "medallon de lomo" es un corte crudo: va aca. Nunca cerdo, cordero, pollo, achuras, fiambres ni elaborados.
  - "Cerdo": cortes crudos de cerdo, frescos o congelados (bondiola fresca, pechito, carre, solomillo, costillas, matambre de cerdo, cerdo feteado crudo).
  - "Pollo": SOLO pollo entero y presas crudas (pechuga, suprema, muslo, pata muslo, alitas), frescos o congelados.
  - "Pescado": pescados y mariscos crudos, frescos o congelados, sin rebozar. Los enlatados van en Conservas.
  - "Otras carnes": cortes crudos de cordero, chivito, cabrito, conejo, pato, pavo y cualquier carne que no sea vaca, cerdo, pollo ni pescado.
  - "Achuras y menudencias": higado, lengua, riñon, mondongo, chinchulines, mollejas, corazon, sesos y menudos, de cualquier animal. Las "patitas de pollo" son un rebozado con forma, NO una achura: van en Elaborados de carne.
  - "Elaborados de carne": productos preparados con carne o pescado que se cocinan antes de comer: milanesas y supremas rebozadas o empanadas, hamburguesas, medallones formados, nuggets, bocaditos, patitas y formitas de pollo, chicken fingers, albondigas, rebozados de pescado y comidas preparadas con carne.
  - "Fiambres": lo que se come frio y feteado, curado, cocido o ahumado: jamon cocido y crudo, paleta cocida, salame, salamin, longaniza, mortadela, bondiola curada, lomo curado o ahumado, leberwurst, queso de cerdo, arrollados y matambres cocidos, pechuga de pavo o de pollo cocida, y las "picadas" (tablas de fiambres y quesos). Una "picada" NO es carne picada.
  - "Embutidos": los que se cocinan antes de comer: chorizo fresco, morcilla, salchichas.
  - Los sandwiches (de miga, triples) no son fiambres ni elaborados de carne: van en Otros.
- Usa "Otros" SOLO si realmente no encaja en ninguna (debe ser muy poco).

Devolve UNICAMENTE un JSON valido: una lista donde cada elemento tiene "n" (numero del producto) y "categoria" (una de las categorias exactas de la lista). Sin texto adicional, sin markdown.

Productos:
{texto_productos}"""


# Espera antes de cada reintento, en segundos.
ESPERAS_REINTENTO = [15, 45, 120]


def clasificar_lote(lote):
    """Pide a Gemini la categoria de cada producto del lote.

    Reintenta ante cualquier falla: un 503 por alta demanda, un 429 por cuota o
    una respuesta que no es JSON. El 2026-09-10 un solo 503 dejaba 50 productos
    con la clasificacion vieja sin volver a intentarlo. Si despues de los
    reintentos sigue fallando, el error sube y el lote se informa como fallido.
    """
    prompt = construir_prompt(lote)
    ultimo_error = None
    for espera in [0] + ESPERAS_REINTENTO:
        if espera:
            time.sleep(espera)
        try:
            respuesta = cliente_ia.models.generate_content(model=MODELO, contents=prompt)
            texto = respuesta.text.strip().replace("```json", "").replace("```", "").strip()
            resultado = json.loads(texto)
            if not isinstance(resultado, list):
                raise ValueError("la respuesta no es una lista")
            return resultado
        except Exception as e:
            ultimo_error = e
    raise ultimo_error


def guardar_en_bigquery(resultados):
    if not resultados:
        return
    tabla_destino = f"{PROYECTO}.sepa.producto_categoria"
    # La tabla es de solo agregado: una reclasificacion suma filas nuevas en vez
    # de pisar las viejas, y stg_categorias se queda con la mas reciente de cada
    # producto. Pisar la tabla borraria el resultado de todas las corridas de
    # Gemini anteriores, que no se pueden reconstruir gratis, y dejaria sin
    # rastro que clasificacion tenia cada producto antes.
    config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        # La columna de version se agrego el 2026-09-10; las filas anteriores la
        # tienen en NULL y cuentan como las mas viejas.
        schema_update_options=[bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION],
        schema=[
            bigquery.SchemaField("id_producto", "STRING"),
            bigquery.SchemaField("descripcion", "STRING"),
            bigquery.SchemaField("marca", "STRING"),
            bigquery.SchemaField("categoria", "STRING"),
            bigquery.SchemaField("rubro", "STRING"),
            bigquery.SchemaField("categorizado_en", "TIMESTAMP"),
        ],
    )
    job = cliente_bq.load_table_from_json(resultados, tabla_destino, job_config=config)
    job.result()


def tiene_columna_de_version():
    tabla = cliente_bq.get_table(f"{PROYECTO}.sepa.producto_categoria")
    return any(campo.name == "categorizado_en" for campo in tabla.schema)


def traer_productos_para_recategorizar(categorias):
    """Productos cuya clasificacion VIGENTE esta en alguna de las categorias dadas.

    Lee las descripciones de producto_categoria, que ya las guarda: no hace
    falta escanear el crudo.
    """
    orden = "categorizado_en DESC NULLS LAST" if tiene_columna_de_version() else "id_producto"
    query = f"""
        SELECT id_producto, descripcion, marca, categoria AS categoria_anterior
        FROM (
            SELECT *
            FROM `{PROYECTO}.sepa.producto_categoria`
            WHERE TRUE
            QUALIFY ROW_NUMBER() OVER (PARTITION BY id_producto ORDER BY {orden}) = 1
        )
        WHERE categoria IN UNNEST(@categorias)
    """
    config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("categorias", "STRING", categorias)]
    )
    return list(cliente_bq.query(query, job_config=config).result())


def parsear_argumentos():
    parser = argparse.ArgumentParser(description="Categoriza productos con Gemini.")
    parser.add_argument(
        "--recategorizar",
        default=None,
        help="Categorias separadas por coma cuyos productos se vuelven a clasificar "
             "con la taxonomia actual (por ejemplo, despues de agregar categorias).",
    )
    parser.add_argument(
        "--hilos",
        type=int,
        default=4,
        help="Lotes que se mandan a Gemini en paralelo (default 4).",
    )
    return parser.parse_args()


def main():
    args = parsear_argumentos()

    if args.recategorizar:
        categorias = [c.strip() for c in args.recategorizar.split(",") if c.strip()]
        desconocidas = [c for c in categorias if c not in CATEGORIA_A_RUBRO]
        if desconocidas:
            raise SystemExit(f"Categorias que no existen en la taxonomia: {desconocidas}")
        print(f"Trayendo productos a RECATEGORIZAR de {categorias}...")
        productos = traer_productos_para_recategorizar(categorias)
    else:
        print("Trayendo productos a categorizar desde BigQuery...")
        productos = traer_productos_a_categorizar()
    print(f"  -> {len(productos)} productos para categorizar\n")

    if not productos:
        print("No hay productos nuevos para categorizar. Nada que hacer.")
        return

    GUARDAR_CADA = 10
    buffer = []
    transiciones = collections.Counter()
    total_guardado = 0
    lotes = [productos[i:i + TAMANO_LOTE] for i in range(0, len(productos), TAMANO_LOTE)]
    total_lotes = len(lotes)
    fallidos = []

    # Los lotes van en paralelo: cada llamada a Gemini tarda cerca de un minuto,
    # y reclasificar 3.100 productos de a uno llevaba mas de una hora. Los
    # resultados se procesan en este hilo, asi que el buffer y los contadores no
    # necesitan sincronizacion.
    with ThreadPoolExecutor(max_workers=args.hilos) as pool:
        futuros = {pool.submit(clasificar_lote, lote): (num, lote) for num, lote in enumerate(lotes, 1)}
        for completados, futuro in enumerate(as_completed(futuros), 1):
            num_lote, lote = futuros[futuro]
            try:
                categorias_lote = futuro.result()
                agregados = 0
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
                            "categorizado_en": datetime.now(timezone.utc).isoformat(),
                        })
                        agregados += 1
                        anterior = lote[n].get("categoria_anterior")
                        if anterior is not None:
                            transiciones[(anterior, categoria)] += 1
                print(f"Lote {num_lote}/{total_lotes}: {agregados} categorizados")
            except Exception as e:
                fallidos.append(num_lote)
                print(f"Lote {num_lote}/{total_lotes}: ERROR tras reintentos -> {e}")

            if completados % GUARDAR_CADA == 0 and buffer:
                guardar_en_bigquery(buffer)
                total_guardado += len(buffer)
                print(f"  >> Guardado parcial: {len(buffer)} productos (acumulado: {total_guardado})")
                buffer = []

    if buffer:
        guardar_en_bigquery(buffer)
        total_guardado += len(buffer)
        print(f"  >> Guardado final: {len(buffer)} productos")

    print(f"\nListo! Total categorizado y guardado en esta corrida: {total_guardado} productos")
    if fallidos:
        print(f"Lotes que fallaron despues de reintentar: {sorted(fallidos)}")

    if transiciones:
        print("\nCambios de categoria (anterior -> nueva):")
        for (anterior, nueva), cantidad in sorted(transiciones.items(), key=lambda x: -x[1]):
            marca = "" if anterior == nueva else "  <-- cambio"
            print(f"  {cantidad:5}  {anterior} -> {nueva}{marca}")
        sin_clasificar = len(productos) - sum(transiciones.values())
        if sin_clasificar:
            print(f"  {sin_clasificar} productos quedaron con la clasificacion anterior (lotes con error)")


if __name__ == "__main__":
    main()

