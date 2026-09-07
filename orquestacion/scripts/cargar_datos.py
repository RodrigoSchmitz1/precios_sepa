import argparse
import os
from datetime import date, timedelta
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# --- Configuración ---
CREDENCIALES = "credenciales.json"
PROYECTO = "proyecto-precios-504221"
DATASET = "sepa"
COMERCIOS = ["sepa2", "sepa9", "sepa10", "sepa11", "sepa12", "sepa13", "sepa15", "sepa16"]

# productos se maneja aparte (particionada + fecha); las dimensiones van como snapshot
TABLA_HECHOS = "productos"
TABLAS_DIMENSIONES = ["sucursales", "comercio"]

# Columnas del CSV de productos que se conservan. El archivo trae 4 mas
# (productos_ean, productos_precio_referencia, productos_cantidad_referencia y
# productos_unidad_medida_referencia) que no usa ningun modelo ni endpoint y
# pesaban 0.86 GB del crudo. El CSV se carga entero a la landing (el esquema
# tiene que coincidir posicionalmente con el archivo), y el descarte ocurre al
# reconstruir la tabla final.
COLUMNAS_PRODUCTOS = [
    "id_comercio",
    "id_bandera",
    "id_sucursal",
    "id_producto",
    "productos_descripcion",
    "productos_cantidad_presentacion",
    "productos_unidad_medida_presentacion",
    "productos_marca",
    "productos_precio_lista",
    "productos_precio_unitario_promo1",
    "productos_leyenda_promo1",
    "productos_precio_unitario_promo2",
    "productos_leyenda_promo2",
]


def parsear_fecha():
    """
    Lee la fecha de datos desde la línea de comandos: --fecha AAAA-MM-DD
    Si no se pasa --fecha, usa ayer (para el pipeline automático).
    """
    parser = argparse.ArgumentParser(description="Carga datos SEPA a BigQuery.")
    parser.add_argument(
        "--fecha",
        required=False,
        default=None,
        help="Fecha de los datos (del ZIP de SEPA), formato AAAA-MM-DD. "
             "Si se omite, usa ayer.",
    )
    args = parser.parse_args()

    if args.fecha is None:
        # Modo automático: ayer
        ayer = date.today() - timedelta(days=1)
        print(f"(sin --fecha: usando ayer = {ayer})")
        return ayer

    # Modo manual: la fecha que pasaste
    # date.fromisoformat valida el formato: si le pasás basura, falla acá
    return date.fromisoformat(args.fecha)


def esquema_desde_archivo(archivo):
    """Lee la primera línea (header) y arma un esquema con todas las columnas como STRING."""
    with open(archivo, "rb") as f:
        primera_linea = f.readline().decode("utf-8-sig", errors="ignore").strip()
    columnas = primera_linea.split("|")
    return [bigquery.SchemaField(col, "STRING") for col in columnas]


def config_carga(esquema, modo):
    """Configuración de carga reutilizable para cualquier CSV de SEPA."""
    return bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.CSV,
        field_delimiter="|",
        skip_leading_rows=1,
        autodetect=False,
        write_disposition=modo,
        allow_quoted_newlines=True,
        encoding="UTF-8",
        allow_jagged_rows=True,
        max_bad_records=1000,
        schema=esquema,
    )


def existe_tabla(cliente, tabla):
    """Devuelve True si la tabla existe."""
    try:
        cliente.get_table(tabla)
        return True
    except NotFound:
        return False


def preservar_foto_anterior(cliente, tabla):
    """
    Antes de pisar la dimensión, guarda una copia de su versión actual en {tabla}_anterior.
    Esa copia es la 'foto de ayer' contra la cual dbt detectará cambios (altas, bajas, modificaciones).
    Usa CTAS (permitido en el Sandbox; a diferencia de DML). Si la tabla todavía no existe
    (primera corrida del proyecto), no hay foto previa que preservar y se omite.
    """
    origen = f"{PROYECTO}.{DATASET}.{tabla}"
    anterior = f"{PROYECTO}.{DATASET}.{tabla}_anterior"

    if not existe_tabla(cliente, origen):
        print(f"  (no existe {tabla} aún; se omite la preservación de la foto anterior)")
        return

    print(f"Preservando foto anterior de {tabla} -> {tabla}_anterior...")
    query = f"CREATE OR REPLACE TABLE `{anterior}` AS SELECT * FROM `{origen}`"
    cliente.query(query).result()
    print(f"  -> OK: foto anterior guardada")


def cargar_dimension(cliente, tabla):
    """
    Snapshot con preservación:
      1. Copia la versión actual a {tabla}_anterior (foto de ayer, para detectar cambios).
      2. Carga a una landing SOLO los comercios que vinieron en el ZIP de hoy.
      3. Reconstruye la dimensión: los comercios ausentes conservan sus filas
         anteriores y los presentes se reemplazan por lo nuevo.

    El paso 3 importa: si un comercio no publica un día (pasa), pisar la
    dimensión entera lo borraría, y la detección de cambios lo reportaría como
    si hubiera dado de baja todas sus sucursales. Un hueco de publicación no es
    un cierre de locales.
    """
    # Paso 1: preservar la foto anterior ANTES de pisar nada
    preservar_foto_anterior(cliente, tabla)

    destino = f"{PROYECTO}.{DATASET}.{tabla}"
    landing = f"{PROYECTO}.{DATASET}.{tabla}_landing"
    primera_carga = True
    presentes = []

    # Paso 2: cargar a la landing los comercios disponibles
    for comercio in COMERCIOS:
        archivo = f"{comercio}/{tabla}.csv"
        if not os.path.exists(archivo):
            print(f"  (sin {archivo}: ese comercio no vino en el ZIP de esta fecha, se omite)")
            continue

        modo = (
            bigquery.WriteDisposition.WRITE_TRUNCATE
            if primera_carga
            else bigquery.WriteDisposition.WRITE_APPEND
        )
        esquema = esquema_desde_archivo(archivo)
        config = config_carga(esquema, modo)

        with open(archivo, "rb") as f:
            print(f"Cargando {archivo} en landing de {tabla} (modo: {'reemplazar' if primera_carga else 'anexar'})...")
            job = cliente.load_table_from_file(f, landing, job_config=config)
            job.result()
            print(f"  -> OK: {job.output_rows} filas cargadas")

        presentes.append(comercio.replace("sepa", ""))
        primera_carga = False

    if primera_carga:
        raise RuntimeError(
            f"No se encontro ningun archivo {tabla}.csv. Se aborta para no dejar "
            f"la dimension a medio construir."
        )

    # Paso 3: reconstruir preservando los comercios ausentes.
    # Se listan los ausentes explicitamente en vez de usar "NOT IN presentes":
    # cada CSV de SEPA trae una fila final de metadata ("Ultima actualizacion:
    # ...") que cae en id_comercio, y con NOT IN se irian acumulando dia a dia.
    ausentes = [c.replace("sepa", "") for c in COMERCIOS if c.replace("sepa", "") not in presentes]

    if existe_tabla(cliente, destino) and ausentes:
        print(f"Reconstruyendo {tabla} (se preservan los comercios ausentes)...")
        query = f"""
            CREATE OR REPLACE TABLE `{destino}` AS
            SELECT * FROM `{destino}` WHERE id_comercio IN UNNEST(@ausentes)
            UNION ALL
            SELECT * FROM `{landing}`
        """
        config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("ausentes", "STRING", ausentes)
            ]
        )
        cliente.query(query, job_config=config).result()
        print(f"  -> OK: comercios {ausentes} preservados de la foto anterior")
    else:
        cliente.query(
            f"CREATE OR REPLACE TABLE `{destino}` AS SELECT * FROM `{landing}`"
        ).result()
        print(f"  -> OK: todos los comercios actualizados")

    cliente.query(f"TRUNCATE TABLE `{landing}`").result()


def cargar_productos(cliente, fecha):
    """
    Dos escalones, sin DML (compatible con BigQuery Sandbox):
      1. Carga los 4 comercios a una tabla landing temporal (sin fecha).
      2. Reconstruye productos por unión: (días anteriores ≠ fecha) + (día nuevo desde landing).
         Al excluir la fecha que se carga, recargar un día no lo duplica (idempotente).
    """
    landing = f"{PROYECTO}.{DATASET}.productos_landing"
    destino = f"{PROYECTO}.{DATASET}.{TABLA_HECHOS}"

    # --- Escalón 1: cargar el crudo a landing (truncate en el primero, append en el resto) ---
    primera_carga = True
    for comercio in COMERCIOS:
        archivo = f"{comercio}/{TABLA_HECHOS}.csv"
        if not os.path.exists(archivo):
            print(f"  (sin {archivo}: ese comercio no vino en el ZIP de esta fecha, se omite)")
            continue

        modo = (
            bigquery.WriteDisposition.WRITE_TRUNCATE
            if primera_carga
            else bigquery.WriteDisposition.WRITE_APPEND
        )
        esquema = esquema_desde_archivo(archivo)
        config = config_carga(esquema, modo)

        with open(archivo, "rb") as f:
            print(f"Cargando {archivo} en landing (modo: {'reemplazar' if primera_carga else 'anexar'})...")
            job = cliente.load_table_from_file(f, landing, job_config=config)
            job.result()
            print(f"  -> OK: {job.output_rows} filas cargadas a landing")

        primera_carga = False

    # Sin esta guarda, si no se cargo nada la landing conservaria los datos de la
    # corrida anterior y el paso siguiente los estamparia con la fecha de hoy.
    if primera_carga:
        raise RuntimeError(
            f"No se encontro ningun archivo {TABLA_HECHOS}.csv para {fecha}. "
            f"Se aborta para no cargar datos de otra fecha."
        )

    # --- Escalón 2: reconstruir productos por unión (CTAS, sin DML) ---
    print(f"Reconstruyendo {TABLA_HECHOS} con la partición {fecha}...")
    columnas = ",\n            ".join(COLUMNAS_PRODUCTOS)
    reconstruir = f"""
        CREATE OR REPLACE TABLE `{destino}`
        PARTITION BY fecha_datos
        OPTIONS (partition_expiration_days = 3) AS
        SELECT
            {columnas},
            fecha_datos
        FROM `{destino}`
        WHERE fecha_datos != DATE(@fecha)
        UNION ALL
        SELECT
            {columnas},
            DATE(@fecha) AS fecha_datos
        FROM `{landing}`
    """
    params = [bigquery.ScalarQueryParameter("fecha", "DATE", fecha)]
    job_config = bigquery.QueryJobConfig(query_parameters=params)

    cliente.query(reconstruir, job_config=job_config).result()
    print(f"  -> OK: partición {fecha} cargada")


    print(f"Vaciando productos_landing para liberar espacio...")
    cliente.query(f"TRUNCATE TABLE `{landing}`").result()
    print(f"  -> OK: landing vaciada")

def main():
    fecha = parsear_fecha()
    cliente = bigquery.Client.from_service_account_json(CREDENCIALES)

    print(f"=== Carga SEPA para la fecha {fecha} ===\n")

    # Dimensiones (snapshot + preservación de la foto anterior)
    for tabla in TABLAS_DIMENSIONES:
        cargar_dimension(cliente, tabla)

    # Hechos (particionado, con fecha)
    cargar_productos(cliente, fecha)

    print(f"\n¡Listo! Carga completa para {fecha}.")


if __name__ == "__main__":
    main()
