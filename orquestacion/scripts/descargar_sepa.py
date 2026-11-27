import argparse
import os
import shutil
import zipfile
import glob
import re
from datetime import date, timedelta
import requests

# --- Configuración ---
API_BASE = "https://datos.produccion.gob.ar/api/3/action/package_show?id="

# El portal rechaza pedidos sin User-Agent de navegador (403), sin importar si el request es legitimo.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Las cadenas que queremos (comercioId). Editá esta lista para escalar.
# Todos los supermercados de SEPA minoristas mas Farmacity (2026-11-19, openspec
# comercios-regionales-y-farmacity). Medido sobre los ZIP del 13 al 19-11: cada dia
# trae 17-18 comercios. Quedan afuera a proposito las tiendas de estaciones de
# servicio (3 Deheza, 4 Estacion Lima, 23 Axion: unos cientos de productos, nada
# de una compra de super) y el 36, que llega vacio. 16 (Libertad) no vino en toda
# esa semana; queda por si vuelve. El nombre y el formato de cada bandera estan
# en seeds/mapeo_cadenas.csv.
COMERCIOS_OBJETIVO = [2, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 20, 21, 24, 47]

# SEPA publica dos datasets con el mismo formato de ZIP (openspec sumar-mayoristas,
# 2026-11-26). Los mayoristas no tienen lista fija: entra todo comercio cuyo
# productos.csv traiga las columnas del bulto, asi un mayorista que empiece a
# informar se baja solo. El que llega con el esquema minorista (el 68, vacio
# toda la semana del 20 al 26-11) se saltea con aviso.
#
# Carpeta propia por dataset: los mayoristas van a mayoristaN/ y no a sepaN/.
# Asi la limpieza de una descarga no borra lo que bajo la otra, y
# ingesta_backfill.py sigue leyendo sepaN/ como "hay minoristas descargados".
DATASETS = {
    "minoristas": {"paquete": "sepa-precios", "prefijo": "sepa"},
    "mayoristas": {"paquete": "precios-claros-sepa-mayoristas", "prefijo": "mayorista"},
}

# La columna que distingue el esquema mayorista (unidades por bulto).
COLUMNA_MAYORISTA = "unidad_venta"

# Mapa día-de-semana (Python: lunes=0) -> nombre del recurso en SEPA
DIAS_SEMANA = {
    0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
    4: "Viernes", 5: "Sábado", 6: "Domingo"
}

CARPETA_DESTINO = os.path.dirname(os.path.abspath(__file__))
CARPETA_TEMP = os.path.join(CARPETA_DESTINO, "_temp_descarga")


def parsear_argumentos():
    parser = argparse.ArgumentParser(description="Descarga datos de SEPA.")
    parser.add_argument("--dia", help="Forzar un día específico para probar (ej: Viernes)")
    parser.add_argument("--fecha", help="Descargar una fecha puntual (AAAA-MM-DD), para backfill")
    parser.add_argument("--dataset", choices=sorted(DATASETS), default="minoristas",
                        help="Que dataset de SEPA bajar (default minoristas)")
    return parser.parse_args()


def calcular_fecha_objetivo():
    """Fecha objetivo = ayer. Devuelve (fecha, nombre_del_dia)."""
    ayer = date.today() - timedelta(days=1)
    nombre_dia = DIAS_SEMANA[ayer.weekday()]
    return ayer, nombre_dia


def obtener_recurso(nombre_dia, fecha_esperada=None, dataset="minoristas"):
    """
    Consulta la API y busca el recurso del día.
    Si fecha_esperada se pasa, verifica que coincida (modo normal).
    Si es None, no verifica (modo prueba).
    """
    modo = "modo prueba" if fecha_esperada is None else "modo normal"
    print(f"Consultando la API de SEPA ({dataset}) para el recurso '{nombre_dia}' ({modo})...")
    respuesta = requests.get(API_BASE + DATASETS[dataset]["paquete"], headers=HEADERS, timeout=60)
    respuesta.raise_for_status()
    datos = respuesta.json()

    for recurso in datos["result"]["resources"]:
        if recurso.get("name", "").strip().lower() == nombre_dia.lower():
            descripcion = recurso.get("description", "")
            url = recurso.get("url", "")
            if fecha_esperada is None:
                print(f"  -> Recurso encontrado: {descripcion}")
                return url
            if str(fecha_esperada) in descripcion:
                print(f"  -> Recurso encontrado y fecha verificada: {descripcion}")
                return url
            print(f"  -> ATENCIÓN: el recurso '{nombre_dia}' existe pero su fecha "
                  f"no coincide con {fecha_esperada}.")
            print(f"     Descripción actual: '{descripcion}'")
            print(f"     Probablemente el portal aún no actualizó. No se descarga nada.")
            return None

    print(f"  -> No se encontró un recurso llamado '{nombre_dia}'.")
    return None


def descargar_zip(url, destino):
    """Descarga el ZIP grande del día en pedazos."""
    print(f"Descargando ZIP principal (puede tardar varios minutos)...")
    with requests.get(url, headers=HEADERS, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(destino, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    tam_mb = os.path.getsize(destino) / (1024 * 1024)
    print(f"  -> OK: descargado ({tam_mb:.1f} MB)")


def limpiar_carpetas_comercios(prefijo="sepa"):
    """
    Borra las carpetas sepaN/ de una corrida anterior.
    Imprescindible para el backfill, por dos caminos distintos:
      - si el ZIP de la fecha que bajamos no trae algun comercio, la carpeta
        vieja de ese comercio quedaria en disco y cargar_datos.py la subiria
        como si fuera de esta fecha;
      - si el portal todavia no publico la fecha, main() sale temprano sin
        bajar nada y TODAS las carpetas viejas quedarian en disco.
    En los dos casos se terminan mezclando dias distintos.

    Solo las del dataset que se va a bajar (prefijo): la descarga de mayoristas
    no tiene que borrar los minoristas que se bajaron un momento antes.
    """
    for carpeta in carpetas_del_dataset(prefijo):
        shutil.rmtree(carpeta)


def carpetas_del_dataset(prefijo, base=None):
    """Las carpetas prefijoN/ (N numerico) que hay en disco."""
    base = base or CARPETA_DESTINO
    patron = re.compile(re.escape(prefijo) + r"\d+$")
    return sorted(
        c for c in glob.glob(os.path.join(base, prefijo + "*"))
        if os.path.isdir(c) and patron.match(os.path.basename(c))
    )


def encabezado_productos(zip_comercio):
    """La primera linea de productos.csv dentro del ZIP de un comercio, o None."""
    nombres = [n for n in zip_comercio.namelist() if n.lower().endswith("productos.csv")]
    if not nombres:
        return None
    with zip_comercio.open(nombres[0]) as f:
        return f.readline().decode("utf-8-sig", errors="replace")


def es_esquema_mayorista(encabezado):
    """True si el encabezado de productos.csv trae las columnas del bulto."""
    if not encabezado:
        return False
    columnas = {c.replace("\ufeff", "").strip().lower() for c in encabezado.split("|")}
    return COLUMNA_MAYORISTA in columnas


def debe_extraer(dataset, id_comercio, encabezado):
    """
    Decide si un comercio del ZIP se extrae. Devuelve (extraer, motivo).

    Minoristas: los de COMERCIOS_OBJETIVO (ver ahi por que esa lista).
    Mayoristas: todos los que traen el esquema del bulto.
    """
    if dataset == "minoristas":
        return id_comercio in COMERCIOS_OBJETIVO, None
    if es_esquema_mayorista(encabezado):
        return True, None
    return False, "no trae el esquema mayorista (sin columnas del bulto)"


def extraer_comercios_objetivo(zip_principal, carpeta_trabajo, dataset="minoristas"):
    """Descomprime el ZIP principal y extrae SOLO los CSV de los comercios objetivo."""
    prefijo = DATASETS[dataset]["prefijo"]
    with zipfile.ZipFile(zip_principal, 'r') as z:
        z.extractall(carpeta_trabajo)

    subcarpetas = [d for d in glob.glob(os.path.join(carpeta_trabajo, "*")) if os.path.isdir(d)]
    if not subcarpetas:
        print("  -> ERROR: no se encontró la carpeta de fecha dentro del ZIP.")
        return []
    carpeta_fecha = subcarpetas[0]

    zips_internos = glob.glob(os.path.join(carpeta_fecha, "*comercio-sepa-*.zip"))
    comercios_extraidos = []

    for zip_interno in zips_internos:
        nombre = os.path.basename(zip_interno)
        try:
            id_comercio = int(nombre.split("comercio-sepa-")[1].split("_")[0])
        except (IndexError, ValueError):
            continue

        # Minoristas filtra por la lista antes de abrir el ZIP: el 36 llega vacio
        # y, abierto, daria un aviso de "corrupto" todos los dias.
        if dataset == "minoristas" and id_comercio not in COMERCIOS_OBJETIVO:
            continue

        try:
            with zipfile.ZipFile(zip_interno, 'r') as z:
                extraer, motivo = debe_extraer(dataset, id_comercio, encabezado_productos(z))
                if not extraer:
                    if motivo:
                        print(f"  -> ATENCIÓN: el comercio {id_comercio} {motivo}; se saltea.")
                    continue
                destino_comercio = os.path.join(CARPETA_DESTINO, f"{prefijo}{id_comercio}")
                os.makedirs(destino_comercio, exist_ok=True)
                z.extractall(destino_comercio)
            comercios_extraidos.append(id_comercio)
            print(f"  -> OK: comercio {id_comercio} extraído a {prefijo}{id_comercio}/")
        except zipfile.BadZipFile:
            print(f"  -> ATENCIÓN: el ZIP del comercio {id_comercio} está corrupto, se saltea.")

    return comercios_extraidos


def main():
    args = parsear_argumentos()
    dataset = args.dataset
    prefijo = DATASETS[dataset]["prefijo"]

    if args.dia:
        nombre_dia = args.dia.capitalize()
        fecha_esperada = None
        print(f"=== Descarga SEPA {dataset} — MODO PRUEBA: {nombre_dia} ===\n")
    elif args.fecha:
        fecha = date.fromisoformat(args.fecha)
        nombre_dia = DIAS_SEMANA[fecha.weekday()]
        fecha_esperada = fecha
        print(f"=== Descarga SEPA {dataset} — BACKFILL: {nombre_dia} {fecha} ===\n")
    else:
        fecha, nombre_dia = calcular_fecha_objetivo()
        fecha_esperada = fecha
        print(f"=== Descarga SEPA {dataset} — objetivo: {nombre_dia} {fecha} ===\n")

    carpeta_temp = f"{CARPETA_TEMP}_{dataset}"
    if os.path.exists(carpeta_temp):
        shutil.rmtree(carpeta_temp)
    os.makedirs(carpeta_temp)

    # Se limpia ANTES de consultar la API, no despues de descargar: si el portal
    # todavia no publico esta fecha se sale sin bajar nada, y las carpetas de la
    # corrida anterior sobrevivirian. ingesta_backfill.py las leeria como "hay
    # datos descargados" y cargar_datos.py las subiria con la fecha de hoy.
    # Paso exactamente eso el 2026-09-08: se cargo el 09-07 duplicado.
    limpiar_carpetas_comercios(prefijo)

    url = obtener_recurso(nombre_dia, fecha_esperada, dataset)
    if not url:
        print("\nNo hay datos válidos para descargar. Saliendo sin error.")
        if os.path.exists(carpeta_temp):
            shutil.rmtree(carpeta_temp)
        return

    zip_principal = os.path.join(carpeta_temp, "sepa_dia.zip")
    descargar_zip(url, zip_principal)

    print("Extrayendo comercios objetivo...")
    extraidos = extraer_comercios_objetivo(zip_principal, carpeta_temp, dataset)

    shutil.rmtree(carpeta_temp)

    if extraidos:
        print(f"\n¡Listo! Comercios descargados: {sorted(extraidos)}")
    else:
        print(f"\nATENCIÓN: no se extrajo ningún comercio objetivo.")


if __name__ == "__main__":
    main()
