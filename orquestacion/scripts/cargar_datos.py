import argparse
import csv
import gzip
import os
import tempfile
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
# pesaban 0.86 GB del crudo. El descarte se hace aca, al armar el archivo que
# se carga (ver cargar_productos).
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


def parsear_argumentos():
    """
    --fecha AAAA-MM-DD: fecha de los datos. Si se omite, usa ayer.
    --destino-productos: carga SOLO productos a otra tabla, sin tocar las
        dimensiones ni la tabla de produccion. Existe para validar un cambio en
        la carga contra lo que ya esta cargado.
    """
    parser = argparse.ArgumentParser(description="Carga datos SEPA a BigQuery.")
    parser.add_argument(
        "--fecha",
        required=False,
        default=None,
        help="Fecha de los datos (del ZIP de SEPA), formato AAAA-MM-DD. "
             "Si se omite, usa ayer.",
    )
    parser.add_argument(
        "--destino-productos",
        required=False,
        default=None,
        help="Tabla alternativa (proyecto.dataset.tabla) para cargar solo productos.",
    )
    args = parser.parse_args()

    if args.fecha is None:
        fecha = date.today() - timedelta(days=1)
        print(f"(sin --fecha: usando ayer = {fecha})")
    else:
        # date.fromisoformat valida el formato: si le pasás basura, falla acá
        fecha = date.fromisoformat(args.fecha)

    return fecha, args.destino_productos


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


def asegurar_tabla_productos(cliente, destino):
    """Crea la tabla destino con el esquema y la particion de produccion, si no existe."""
    if existe_tabla(cliente, destino):
        return
    produccion = cliente.get_table(f"{PROYECTO}.{DATASET}.{TABLA_HECHOS}")
    tabla = bigquery.Table(destino, schema=produccion.schema)
    tabla.time_partitioning = produccion.time_partitioning
    cliente.create_table(tabla)
    print(f"  (se creo {destino} con el esquema de produccion)")


def escribir_csv_productos(archivos, fecha, columnas, ruta):
    """
    Junta los CSV de todos los comercios en un solo archivo comprimido, con las
    columnas en el orden de la tabla destino y la fecha ya estampada.

    Las columnas se buscan por NOMBRE en el encabezado de cada archivo, no por
    posicion: si un comercio publica las columnas en otro orden, no se corren.
    Una fila con menos campos que el encabezado se completa con vacios (lo mismo
    que hace BigQuery con allow_jagged_rows); una con mas campos no se puede
    interpretar sin adivinar y se descarta, igual que un registro invalido.
    """
    csv.field_size_limit(10 * 1024 * 1024)
    escritas = 0
    descartadas = 0
    vacias = 0
    texto_fecha = fecha.isoformat()
    with gzip.open(ruta, "wt", encoding="utf-8", newline="", compresslevel=1) as salida:
        escritor = csv.writer(salida, delimiter="|", lineterminator="\n")
        escritor.writerow(columnas)
        for archivo in archivos:
            with open(archivo, encoding="utf-8-sig", errors="replace", newline="") as entrada:
                lector = csv.reader(entrada, delimiter="|")
                encabezado = next(lector)
                ancho = len(encabezado)
                # None marca la columna de fecha, que no viene en el archivo.
                indices = [None if c == "fecha_datos" else encabezado.index(c) for c in columnas]
                for fila in lector:
                    if not fila:
                        vacias += 1
                        continue
                    if len(fila) > ancho:
                        descartadas += 1
                        continue
                    if len(fila) < ancho:
                        fila = fila + [""] * (ancho - len(fila))
                    escritor.writerow([texto_fecha if i is None else fila[i] for i in indices])
                    escritas += 1
    return escritas, descartadas, vacias


def cargar_productos(cliente, fecha, destino=None):
    """
    Carga la fecha como UNA particion, con un load job directo y sin consultas.

    POR QUE ASI (2026-09-10): antes se cargaba el CSV a una landing y despues se
    reconstruia la tabla entera con CREATE OR REPLACE ... AS SELECT (dias
    anteriores) UNION ALL (landing), porque en el Sandbox de BigQuery no habia
    DML. Esa consulta leia las tres particiones cada dia para agregar una: 4,07
    GiB por corrida, la partida mas grande del pipeline despues de dbt. Los load
    jobs no consumen cuota de consultas, asi que ahora cuesta cero.

    El archivo se arma aca con las columnas que se conservan y la fecha, y se
    carga sobre la particion de esa fecha (productos$AAAAMMDD) con WRITE_TRUNCATE:
      - idempotente: recargar una fecha reemplaza su particion, no la duplica;
      - atomico: es un solo job, asi que una falla no deja la particion a medias;
      - las demas fechas no se tocan.
    Se comprime antes de subir: el CSV del dia pesa del orden de 2 GB y la
    subida sale de una conexion domestica.
    """
    destino = destino or f"{PROYECTO}.{DATASET}.{TABLA_HECHOS}"
    asegurar_tabla_productos(cliente, destino)
    esquema = cliente.get_table(destino).schema
    columnas = [campo.name for campo in esquema]

    archivos = []
    for comercio in COMERCIOS:
        archivo = f"{comercio}/{TABLA_HECHOS}.csv"
        if os.path.exists(archivo):
            archivos.append(archivo)
        else:
            print(f"  (sin {archivo}: ese comercio no vino en el ZIP de esta fecha, se omite)")

    # Sin esta guarda se cargaria una particion vacia sobre una fecha que quiza
    # ya tenia datos.
    if not archivos:
        raise RuntimeError(
            f"No se encontro ningun archivo {TABLA_HECHOS}.csv para {fecha}. "
            f"Se aborta para no pisar la particion."
        )

    descriptor, ruta = tempfile.mkstemp(suffix=".csv.gz")
    os.close(descriptor)
    try:
        print(f"Armando el archivo de {len(archivos)} comercios para {fecha}...")
        escritas, descartadas, vacias = escribir_csv_productos(archivos, fecha, columnas, ruta)
        tam_mb = os.path.getsize(ruta) / (1024 * 1024)
        print(f"  -> {escritas:,} filas ({tam_mb:.0f} MB comprimido); "
              f"descartadas por exceso de campos: {descartadas}; lineas vacias: {vacias}")

        config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.CSV,
            field_delimiter="|",
            skip_leading_rows=1,
            autodetect=False,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
            allow_quoted_newlines=True,
            encoding="UTF-8",
            max_bad_records=1000,
            schema=esquema,
        )
        particion = f"{destino}${fecha:%Y%m%d}"
        print(f"Cargando la particion {particion}...")
        with open(ruta, "rb") as f:
            job = cliente.load_table_from_file(f, particion, job_config=config)
            job.result()
        errores = len(job.errors or [])
        print(f"  -> OK: {job.output_rows:,} filas en la particion {fecha} "
              f"(registros rechazados por BigQuery: {errores})")
    finally:
        os.remove(ruta)


def main():
    fecha, destino_productos = parsear_argumentos()
    cliente = bigquery.Client.from_service_account_json(CREDENCIALES)

    if destino_productos:
        print(f"=== Carga de validacion: solo productos de {fecha} a {destino_productos} ===\n")
        cargar_productos(cliente, fecha, destino_productos)
        return

    print(f"=== Carga SEPA para la fecha {fecha} ===\n")

    # Dimensiones (snapshot + preservación de la foto anterior)
    for tabla in TABLAS_DIMENSIONES:
        cargar_dimension(cliente, tabla)

    # Hechos (particionado, con fecha)
    cargar_productos(cliente, fecha)

    print(f"\n¡Listo! Carga completa para {fecha}.")


if __name__ == "__main__":
    main()
