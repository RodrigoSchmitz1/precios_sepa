import argparse
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


def preservar_foto_anterior(cliente, tabla):
    """
    Antes de pisar la dimensión, guarda una copia de su versión actual en {tabla}_anterior.
    Esa copia es la 'foto de ayer' contra la cual dbt detectará cambios (altas, bajas, modificaciones).
    Usa CTAS (permitido en el Sandbox; a diferencia de DML). Si la tabla todavía no existe
    (primera corrida del proyecto), no hay foto previa que preservar y se omite.
    """
    origen = f"{PROYECTO}.{DATASET}.{tabla}"
    anterior = f"{PROYECTO}.{DATASET}.{tabla}_anterior"

    try:
        cliente.get_table(origen)  # lanza NotFound si la tabla no existe todavía
    except NotFound:
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
      2. La primera carga limpia la tabla, las siguientes anexan. Sin fecha.
    """
    # Paso 1: preservar la foto anterior ANTES de pisar nada
    preservar_foto_anterior(cliente, tabla)

    # Paso 2: recargar la dimensión (snapshot)
    destino = f"{PROYECTO}.{DATASET}.{tabla}"
    primera_carga = True

    for comercio in COMERCIOS:
        archivo = f"{comercio}/{tabla}.csv"
        modo = (
            bigquery.WriteDisposition.WRITE_TRUNCATE
            if primera_carga
            else bigquery.WriteDisposition.WRITE_APPEND
        )
        esquema = esquema_desde_archivo(archivo)
        config = config_carga(esquema, modo)

        with open(archivo, "rb") as f:
            print(f"Cargando {archivo} en {tabla} (modo: {'reemplazar' if primera_carga else 'anexar'})...")
            job = cliente.load_table_from_file(f, destino, job_config=config)
            job.result()
            print(f"  -> OK: {job.output_rows} filas cargadas")

        primera_carga = False


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

    # --- Escalón 2: reconstruir productos por unión (CTAS, sin DML) ---
    print(f"Reconstruyendo {TABLA_HECHOS} con la partición {fecha}...")
    reconstruir = f"""
        CREATE OR REPLACE TABLE `{destino}`
        PARTITION BY fecha_datos
        OPTIONS (partition_expiration_days = 3) AS
        SELECT * FROM `{destino}`
        WHERE fecha_datos != DATE(@fecha)
        UNION ALL
        SELECT *, DATE(@fecha) AS fecha_datos
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
