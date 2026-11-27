import argparse
import csv
import glob
import gzip
import os
import re
import tempfile
from datetime import date, timedelta
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# --- Configuración ---
CREDENCIALES = "credenciales.json"
PROYECTO = "proyecto-precios-504221"
DATASET = "sepa"
# Los mismos de COMERCIOS_OBJETIVO en descargar_sepa.py (ver ahi por que).
COMERCIOS = [f"sepa{i}" for i in (2, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 20, 21, 24, 47)]

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


# Sin estas columnas una fila de producto no sirve: si a un comercio le falta
# alguna, se saltea ese comercio (y se avisa) en vez de cortar la carga de todos.
# Las demas (marca, presentacion, promos) quedan vacias si el archivo no las trae.
COLUMNAS_OBLIGATORIAS = {"id_comercio", "id_sucursal", "id_producto", "productos_precio_lista"}

# --- SEPA mayoristas (openspec sumar-mayoristas, 2026-11-26) ---
# Mismo detalle que minoristas (una fila por producto y sucursal) en un crudo
# hermano: cada fuente reemplaza su particion del dia con WRITE_TRUNCATE sin
# pisar a la otra. Las carpetas las arma descargar_sepa.py --dataset mayoristas.
PREFIJO_MAYORISTAS = "mayorista"
TABLA_HECHOS_MAYORISTAS = "productos_mayoristas"

# Las 13 columnas del crudo minorista, con el mismo nombre y significado, mas
# las del bulto y los precios sin IVA tal como los publica SEPA.
COLUMNAS_EXTRA_MAYORISTAS = [
    "unidades_bulto",
    "precio_bulto",
    "precio_unitario_sin_iva",
    "precio_bulto_sin_iva",
    "promo1_sin_iva",
    "promo2_sin_iva",
    "id_dun_14",
]

# Destino -> columna de SEPA mayoristas. El precio de lista es el precio por
# unidad comprando el bulto, con IVA: lo comparable con el precio de lista del
# minorista (tambien por unidad y con IVA). Verificado sobre la semana del 20 al
# 26-11: precio del bulto = precio por unidad x unidades en todas las filas
# menos 21 de Nini.
ORIGEN_MAYORISTAS = {
    "id_comercio": "id_comercio",
    "id_bandera": "id_bandera",
    "id_sucursal": "id_sucursal",
    "id_producto": "id_producto",
    "productos_descripcion": "productos_descripcion",
    "productos_marca": "productos_marca",
    "productos_precio_lista": "precio_unitario_bulto_por_unidad_venta_con_iva",
    "productos_precio_unitario_promo1": "productos_precio_unitario_con_iva_promo1",
    "productos_leyenda_promo1": "productos_leyenda_promo1",
    "productos_precio_unitario_promo2": "productos_precio_unitario_con_iva_promo2",
    "productos_leyenda_promo2": "productos_leyenda_promo2",
    "unidades_bulto": "unidad_venta",
    "precio_bulto": "precio_bulto_con_iva",
    "precio_unitario_sin_iva": "precio_unitario_bulto_por_unidad_venta_sin_iva",
    "precio_bulto_sin_iva": "precio_bulto_sin_iva",
    "promo1_sin_iva": "productos_precio_unitario_sin_iva_promo1",
    "promo2_sin_iva": "productos_precio_unitario_sin_iva_promo2",
    "id_dun_14": "id_dun_14",
}

# SEPA mayoristas no informa gramos ni cc. "1 UNI" es justo el caso en que
# stg_productos lee el tamaño de la descripcion (la regla de Carrefour), asi no
# hace falta una regla nueva.
CONSTANTES_MAYORISTAS = {
    "productos_cantidad_presentacion": "1",
    "productos_unidad_medida_presentacion": "UNI",
}

# Precios de promo: vacio o cero es "sin promo" (La Agricola Regional publica
# 0.00 en todos sus productos). Leyendas: solo espacios es vacia.
COLUMNAS_PROMO_MAYORISTAS = {
    "productos_precio_unitario_promo1", "productos_precio_unitario_promo2", "promo1_sin_iva", "promo2_sin_iva",
}
COLUMNAS_LEYENDA_MAYORISTAS = {"productos_leyenda_promo1", "productos_leyenda_promo2"}
OBLIGATORIAS_MAYORISTAS = {"id_comercio", "id_sucursal", "id_producto", "productos_precio_lista"}


def _clave_columna(nombre):
    """El nombre de una columna sin espacios, BOM ni mayusculas."""
    return nombre.replace("\ufeff", "").strip().lower()


def parsear_argumentos(argv=None):
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
    parser.add_argument(
        "--solo-mayoristas",
        action="store_true",
        help="Carga solo los productos de mayoristas, sin dimensiones ni minoristas. "
             "Para recuperar una fecha de mayoristas cuyo minorista ya se cargo: "
             "volver a cargar las dimensiones pisaria la foto anterior del dia.",
    )
    parser.add_argument(
        "--destino-mayoristas",
        required=False,
        default=None,
        help="Tabla alternativa (proyecto.dataset.tabla) para los productos de mayoristas.",
    )
    args = parser.parse_args(argv)

    if args.fecha is None:
        fecha = date.today() - timedelta(days=1)
        print(f"(sin --fecha: usando ayer = {fecha})")
    else:
        # date.fromisoformat valida el formato: si le pasás basura, falla acá
        fecha = date.fromisoformat(args.fecha)

    return fecha, args


def esquema_desde_archivo(archivo):
    """Lee la primera línea (header) y arma un esquema con todas las columnas como STRING."""
    with open(archivo, "rb") as f:
        primera_linea = f.readline().decode("utf-8-sig", errors="ignore").strip()
    columnas = primera_linea.split("|")
    return [bigquery.SchemaField(col, "STRING") for col in columnas]


def reparar_renglones(archivo):
    """
    Vuelve a unir los renglones partidos por un salto de linea adentro de un
    campo sin comillas, y devuelve la ruta de un archivo temporal reparado (o
    el mismo archivo si no habia nada que unir).

    Desde el 2026-11-20 Comodin y Carrefour publican sucursales con un salto de
    linea en sucursales_observaciones. BigQuery partia el renglon en dos: la
    segunda mitad entraba como otra fila, con el horario en la columna de la
    latitud, y dbt fallaba al convertirla en numero (cuatro dias sin marts).

    Un renglon con menos campos que el encabezado se une con el siguiente,
    siempre que juntos no pasen de la cantidad del encabezado. Trabaja en
    bytes para no tocar la codificacion de cada comercio.
    """
    with open(archivo, "rb") as f:
        lineas = f.read().split(b"\n")
    if not lineas:
        return archivo
    campos = lineas[0].count(b"|") + 1
    reparadas = []
    unidas = 0
    for linea in lineas[1:]:
        anterior = reparadas[-1] if reparadas else None
        if (
            anterior is not None
            and anterior.count(b"|") + 1 < campos
            and anterior.count(b"|") + linea.count(b"|") + 1 <= campos
            and linea.strip()
        ):
            reparadas[-1] = anterior.rstrip(b"\r") + b" " + linea
            unidas += 1
        else:
            reparadas.append(linea)
    if unidas == 0:
        return archivo
    print(f"  ({archivo}: {unidas} renglones partidos vueltos a unir)")
    salida = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    with salida:
        salida.write(b"\n".join([lineas[0]] + reparadas))
    return salida.name


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


def preservar_foto_anterior(cliente, tabla, dataset=DATASET):
    """
    Antes de pisar la dimensión, guarda una copia de su versión actual en {tabla}_anterior.
    Esa copia es la 'foto de ayer' contra la cual dbt detectará cambios (altas, bajas, modificaciones).
    Usa CTAS (permitido en el Sandbox; a diferencia de DML). Si la tabla todavía no existe
    (primera corrida del proyecto), no hay foto previa que preservar y se omite.

    Corre UNA vez por carga, con minoristas y mayoristas juntos (openspec
    sumar-mayoristas): si cada dataset cargara su dimension por separado, la
    segunda carga copiaria como "foto de ayer" lo que la primera acaba de
    escribir, y la deteccion de cambios dejaria de ver los cambios del dia.
    """
    origen = f"{PROYECTO}.{dataset}.{tabla}"
    anterior = f"{PROYECTO}.{dataset}.{tabla}_anterior"

    if not existe_tabla(cliente, origen):
        print(f"  (no existe {tabla} aún; se omite la preservación de la foto anterior)")
        return

    print(f"Preservando foto anterior de {tabla} -> {tabla}_anterior...")
    query = f"CREATE OR REPLACE TABLE `{anterior}` AS SELECT * FROM `{origen}`"
    cliente.query(query).result()
    print(f"  -> OK: foto anterior guardada")


def carpetas_mayoristas(base="."):
    """Las carpetas mayoristaN/ que dejo descargar_sepa.py --dataset mayoristas."""
    patron = re.compile(PREFIJO_MAYORISTAS + r"\d+$")
    return sorted(
        os.path.basename(c) for c in glob.glob(os.path.join(base, PREFIJO_MAYORISTAS + "*"))
        if os.path.isdir(c) and patron.match(os.path.basename(c))
    )


def comercios_repetidos(base="."):
    """
    Numeros de comercio de mayoristas que tambien son de minoristas.

    Hoy no pasa (mayoristas 61-70, minoristas 2-47), pero el resto del proyecto
    identifica una cadena por id_comercio: un numero compartido mezclaria
    sucursales y precios de dos empresas. Se chequea aca porque es gratis (la
    lista de minoristas es fija); en dbt costaria recorrer los dos crudos.
    """
    minoristas = {c[len("sepa"):] for c in COMERCIOS}
    return sorted(c[len(PREFIJO_MAYORISTAS):] for c in carpetas_mayoristas(base)
                  if c[len(PREFIJO_MAYORISTAS):] in minoristas)


def carpetas_de_comercios(base="."):
    """
    Las carpetas de comercio que entran en las dimensiones: las de minoristas
    (lista fija, ver COMERCIOS) y las de mayoristas que haya en disco, salvo
    las que repiten un numero de minorista (ver comercios_repetidos).
    Devuelve [(carpeta, id_comercio)].
    """
    repetidos = set(comercios_repetidos(base))
    if repetidos:
        print(f"  ATENCION: mayoristas con numero de comercio de minorista {sorted(repetidos)}: "
              f"no entran en las dimensiones")
    minoristas = [(c, c[len("sepa"):]) for c in COMERCIOS]
    mayoristas = [(c, c[len(PREFIJO_MAYORISTAS):]) for c in carpetas_mayoristas(base)
                  if c[len(PREFIJO_MAYORISTAS):] not in repetidos]
    return minoristas + mayoristas


def consulta_reconstruccion(destino, landing):
    """
    Reconstruye una dimension con lo cargado hoy mas lo que conservaba de los
    comercios que hoy no vinieron.

    "No vinieron" se decide contra lo que hay en el destino y no contra una
    lista fija (openspec sumar-mayoristas): los mayoristas no tienen lista, y con
    la lista de minoristas una carga borraria a los comercios del otro dataset.

    Solo se conservan los id_comercio numericos: cada CSV de SEPA trae una fila
    final de metadata ("Ultima actualizacion: ...") que cae en id_comercio, y sin
    el filtro se irian acumulando dia a dia. Era la razon de la lista fija.
    """
    return f"""
            CREATE OR REPLACE TABLE `{destino}` AS
            SELECT * FROM `{destino}`
            WHERE REGEXP_CONTAINS(id_comercio, r'^[0-9]+$')
              AND id_comercio NOT IN UNNEST(@presentes)
            UNION ALL
            SELECT * FROM `{landing}`
        """


def cargar_dimension(cliente, tabla, dataset=DATASET, base="."):
    """
    Snapshot con preservación:
      1. Copia la versión actual a {tabla}_anterior (foto de ayer, para detectar cambios).
      2. Carga a una landing SOLO los comercios que vinieron en el ZIP de hoy,
         minoristas y mayoristas juntos.
      3. Reconstruye la dimensión: los comercios ausentes conservan sus filas
         anteriores y los presentes se reemplazan por lo nuevo.

    El paso 3 importa: si un comercio no publica un día (pasa), pisar la
    dimensión entera lo borraría, y la detección de cambios lo reportaría como
    si hubiera dado de baja todas sus sucursales. Un hueco de publicación no es
    un cierre de locales. Lo mismo si un dataset entero no vino: el portal de
    mayoristas caido no borra las sucursales mayoristas.

    Las landings mezclan los dos datasets por posicion de columna: verificado el
    2026-11-26 que sucursales.csv (21 columnas) y comercio.csv (8) tienen el
    mismo encabezado en minoristas y mayoristas.
    """
    # Paso 1: preservar la foto anterior ANTES de pisar nada
    preservar_foto_anterior(cliente, tabla, dataset)

    destino = f"{PROYECTO}.{dataset}.{tabla}"
    landing = f"{PROYECTO}.{dataset}.{tabla}_landing"
    primera_carga = True
    presentes = []

    # Paso 2: cargar a la landing los comercios disponibles
    for carpeta, id_comercio in carpetas_de_comercios(base):
        archivo = os.path.join(base, carpeta, f"{tabla}.csv")
        if not os.path.exists(archivo):
            print(f"  (sin {carpeta}/{tabla}.csv: ese comercio no vino en el ZIP de esta fecha, se omite)")
            continue

        modo = (
            bigquery.WriteDisposition.WRITE_TRUNCATE
            if primera_carga
            else bigquery.WriteDisposition.WRITE_APPEND
        )
        esquema = esquema_desde_archivo(archivo)
        config = config_carga(esquema, modo)
        reparado = reparar_renglones(archivo)

        with open(reparado, "rb") as f:
            print(f"Cargando {carpeta}/{tabla}.csv en landing de {tabla} (modo: {'reemplazar' if primera_carga else 'anexar'})...")
            job = cliente.load_table_from_file(f, landing, job_config=config)
            job.result()
            print(f"  -> OK: {job.output_rows} filas cargadas")

        presentes.append(id_comercio)
        primera_carga = False

    if primera_carga:
        raise RuntimeError(
            f"No se encontro ningun archivo {tabla}.csv. Se aborta para no dejar "
            f"la dimension a medio construir."
        )

    # Paso 3: reconstruir preservando los comercios ausentes.
    if existe_tabla(cliente, destino):
        print(f"Reconstruyendo {tabla} (se preservan los comercios que hoy no vinieron)...")
        config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ArrayQueryParameter("presentes", "STRING", presentes)]
        )
        cliente.query(consulta_reconstruccion(destino, landing), job_config=config).result()
        print(f"  -> OK: cargados hoy {sorted(presentes, key=int)}; el resto se conserva")
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

    Las lineas vacias se omiten. El camino anterior las cargaba como filas con
    todas las columnas en NULL (7 el 2026-09-09) que stg_productos descartaba
    por no tener precio. Al validar las dos cargas de esa fecha fue la unica
    diferencia.

    COLUMNAS QUE FALTAN (2026-11-23). Del 19 al 21-11 la carga entera cortaba
    con "list.index(x): x not in list": un comercio nuevo (La Agricola Regional
    o Unicoop; el 22, sin ellos, cargo bien) publica productos.csv sin una de
    las columnas esperadas. Ahora los nombres se comparan sin espacios ni
    mayusculas, una columna opcional que falta queda vacia, y si falta una
    obligatoria se saltea solo ese comercio. Todo queda dicho en el log.
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
                posicion = {_clave_columna(c): i for i, c in enumerate(encabezado)}
                faltan = [c for c in columnas if c != "fecha_datos" and _clave_columna(c) not in posicion]
                if faltan:
                    obligatorias = [c for c in faltan if c in COLUMNAS_OBLIGATORIAS]
                    if obligatorias:
                        print(f"  ATENCION: {archivo} no trae {obligatorias}: se saltea ese comercio")
                        continue
                    print(f"  ({archivo} no trae {faltan}: quedan vacias)")
                # None marca la columna de fecha, que no viene en el archivo; -1, una que falta.
                indices = [
                    None if c == "fecha_datos" else posicion.get(_clave_columna(c), -1) for c in columnas
                ]
                for fila in lector:
                    if not fila:
                        vacias += 1
                        continue
                    if len(fila) > ancho:
                        descartadas += 1
                        continue
                    if len(fila) < ancho:
                        fila = fila + [""] * (ancho - len(fila))
                    escritor.writerow([texto_fecha if i is None else ("" if i < 0 else fila[i]) for i in indices])
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


# --- Mayoristas ---

def columnas_mayoristas():
    """El orden de columnas del crudo de mayoristas (sin fecha_datos)."""
    return COLUMNAS_PRODUCTOS + COLUMNAS_EXTRA_MAYORISTAS


def esquema_mayoristas():
    """Todo STRING como el crudo minorista, mas fecha_datos DATE al final."""
    return [bigquery.SchemaField(c, "STRING") for c in columnas_mayoristas()] + [
        bigquery.SchemaField("fecha_datos", "DATE")
    ]


def valor_mayorista(columna, valor):
    """Normaliza un valor de SEPA mayoristas antes de guardarlo (ver CONSTANTES y PROMO)."""
    valor = valor.strip()
    if columna in COLUMNAS_PROMO_MAYORISTAS:
        try:
            return "" if float(valor.replace(",", ".")) == 0 else valor
        except ValueError:
            return ""
    return valor


def escribir_csv_mayoristas(archivos, fecha, ruta):
    """
    Lo mismo que escribir_csv_productos, para SEPA mayoristas: una fila por
    producto y sucursal, columnas buscadas por nombre, el precio de lista por
    unidad comprando el bulto y las columnas del bulto aparte (ver
    ORIGEN_MAYORISTAS).

    A diferencia del minorista, la fila final de metadata ("Ultima
    actualizacion: ...") se descarta aca, porque id_comercio no es numerico: el
    crudo de mayoristas no arrastra esas filas basura.

    Devuelve (escritas, descartadas, vacias).
    """
    csv.field_size_limit(10 * 1024 * 1024)
    columnas = columnas_mayoristas()
    escritas = descartadas = vacias = 0
    texto_fecha = fecha.isoformat()
    with gzip.open(ruta, "wt", encoding="utf-8", newline="", compresslevel=1) as salida:
        escritor = csv.writer(salida, delimiter="|", lineterminator="\n")
        escritor.writerow(columnas + ["fecha_datos"])
        for archivo in archivos:
            with open(archivo, encoding="utf-8-sig", errors="replace", newline="") as entrada:
                lector = csv.reader(entrada, delimiter="|")
                encabezado = next(lector, None)
                if not encabezado:
                    print(f"  ({archivo} vacio: se saltea)")
                    continue
                ancho = len(encabezado)
                posicion = {_clave_columna(c): i for i, c in enumerate(encabezado)}
                faltan = [c for c, origen in ORIGEN_MAYORISTAS.items() if _clave_columna(origen) not in posicion]
                obligatorias = [c for c in faltan if c in OBLIGATORIAS_MAYORISTAS]
                if obligatorias:
                    print(f"  ATENCION: {archivo} no trae {obligatorias}: se saltea ese comercio")
                    continue
                if faltan:
                    print(f"  ({archivo} no trae {faltan}: quedan vacias)")
                indices = [posicion.get(_clave_columna(ORIGEN_MAYORISTAS[c]), -1) if c in ORIGEN_MAYORISTAS else None
                           for c in columnas]
                i_comercio = posicion[_clave_columna("id_comercio")]
                for fila in lector:
                    if not fila or not any(campo.strip() for campo in fila):
                        vacias += 1
                        continue
                    if len(fila) > ancho or not fila[i_comercio].strip().isdigit():
                        descartadas += 1
                        continue
                    if len(fila) < ancho:
                        fila = fila + [""] * (ancho - len(fila))
                    salida_fila = [
                        CONSTANTES_MAYORISTAS[c] if i is None else ("" if i < 0 else valor_mayorista(c, fila[i]))
                        for c, i in zip(columnas, indices)
                    ]
                    escritor.writerow(salida_fila + [texto_fecha])
                    escritas += 1
    return escritas, descartadas, vacias


def asegurar_tabla_mayoristas(cliente, destino):
    """
    Crea el crudo de mayoristas si no existe: misma particion y retencion que
    el crudo minorista (despues las mantiene juntas ingesta_backfill.py) y
    clustering por comercio, producto y sucursal, que no cuesta nada.
    """
    if existe_tabla(cliente, destino):
        return
    produccion = cliente.get_table(f"{PROYECTO}.{DATASET}.{TABLA_HECHOS}")
    tabla = bigquery.Table(destino, schema=esquema_mayoristas())
    tabla.time_partitioning = bigquery.TimePartitioning(
        type_=bigquery.TimePartitioningType.DAY,
        field="fecha_datos",
        expiration_ms=produccion.time_partitioning.expiration_ms,
    )
    tabla.clustering_fields = ["id_comercio", "id_producto", "id_sucursal"]
    cliente.create_table(tabla)
    print(f"  (se creo {destino} con la particion y la retencion del crudo minorista)")


def cargar_productos_mayoristas(cliente, fecha, destino=None, base="."):
    """
    Carga la fecha de mayoristas como UNA particion de productos_mayoristas,
    igual que cargar_productos: load job, WRITE_TRUNCATE, sin consultas.

    Devuelve las filas cargadas, o None si no habia carpetas de mayoristas (el
    portal no publico o la descarga fallo): no se carga una particion vacia.
    """
    destino = destino or f"{PROYECTO}.{DATASET}.{TABLA_HECHOS_MAYORISTAS}"
    repetidos = comercios_repetidos(base)
    if repetidos:
        raise RuntimeError(
            f"SEPA mayoristas publico comercios con numero de minorista {repetidos}: "
            f"se mezclarian dos empresas. No se carga mayoristas de {fecha}."
        )
    archivos = [os.path.join(base, c, f"{TABLA_HECHOS}.csv") for c in carpetas_mayoristas(base)]
    archivos = [a for a in archivos if os.path.exists(a)]
    if not archivos:
        print(f"  (no hay productos de mayoristas descargados para {fecha}; no se carga nada)")
        return None

    asegurar_tabla_mayoristas(cliente, destino)
    esquema = cliente.get_table(destino).schema
    descriptor, ruta = tempfile.mkstemp(suffix=".csv.gz")
    os.close(descriptor)
    try:
        print(f"Armando el archivo de {len(archivos)} mayoristas para {fecha}...")
        escritas, descartadas, vacias = escribir_csv_mayoristas(archivos, fecha, ruta)
        if not escritas:
            raise RuntimeError(f"Los archivos de mayoristas de {fecha} no tienen filas validas.")
        tam_mb = os.path.getsize(ruta) / (1024 * 1024)
        print(f"  -> {escritas:,} filas ({tam_mb:.1f} MB comprimido); "
              f"descartadas (pie de archivo o exceso de campos): {descartadas}; lineas vacias: {vacias}")
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
        print(f"  -> OK: {job.output_rows:,} filas en la particion {fecha} "
              f"(registros rechazados por BigQuery: {len(job.errors or [])})")
        return job.output_rows
    finally:
        os.remove(ruta)


# Codigo de salida cuando minoristas se cargo y mayoristas fallo: ingesta_backfill
# lo distingue de una falla total para no volver a cargar minoristas.
SALIDA_FALLO_MAYORISTAS = 3


def main(argv=None):
    fecha, args = parsear_argumentos(argv)
    cliente = bigquery.Client.from_service_account_json(CREDENCIALES)

    if args.destino_productos:
        print(f"=== Carga de validacion: solo productos de {fecha} a {args.destino_productos} ===\n")
        cargar_productos(cliente, fecha, args.destino_productos)
        return 0

    if args.solo_mayoristas:
        print(f"=== Carga SEPA mayoristas (solo productos) para la fecha {fecha} ===\n")
        if cargar_productos_mayoristas(cliente, fecha, args.destino_mayoristas) is None:
            return 1
        return 0

    print(f"=== Carga SEPA para la fecha {fecha} ===\n")

    # Dimensiones (snapshot + preservación de la foto anterior), los dos
    # datasets en la misma pasada (ver cargar_dimension).
    for tabla in TABLAS_DIMENSIONES:
        cargar_dimension(cliente, tabla)

    # Hechos (particionado, con fecha)
    cargar_productos(cliente, fecha)

    # Mayoristas al final y aparte: si falla, minoristas ya quedo cargado.
    try:
        cargar_productos_mayoristas(cliente, fecha, args.destino_mayoristas)
    except Exception as error:  # noqa: BLE001 - se informa y se distingue por el codigo de salida
        print(f"\nATENCION: fallo la carga de mayoristas de {fecha}: {error}")
        print("Minoristas quedo cargado.")
        return SALIDA_FALLO_MAYORISTAS

    print(f"\n¡Listo! Carga completa para {fecha}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
