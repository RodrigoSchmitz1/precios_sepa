import argparse
import os
import shutil
import zipfile
import glob
from datetime import date, timedelta
import requests

# --- Configuración ---
API_URL = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios"

# Las cadenas que queremos (comercioId). Editá esta lista para escalar.
COMERCIOS_OBJETIVO = [2, 9, 10, 11, 12, 13, 15, 16]  # La Anónima, Cencosud, Carrefour, Coto, DIA

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
    return parser.parse_args()


def calcular_fecha_objetivo():
    """Fecha objetivo = ayer. Devuelve (fecha, nombre_del_dia)."""
    ayer = date.today() - timedelta(days=1)
    nombre_dia = DIAS_SEMANA[ayer.weekday()]
    return ayer, nombre_dia


def obtener_recurso(nombre_dia, fecha_esperada=None):
    """
    Consulta la API y busca el recurso del día.
    Si fecha_esperada se pasa, verifica que coincida (modo normal).
    Si es None, no verifica (modo prueba).
    """
    modo = "modo prueba" if fecha_esperada is None else "modo normal"
    print(f"Consultando la API de SEPA para el recurso '{nombre_dia}' ({modo})...")
    respuesta = requests.get(API_URL, timeout=60)
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
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(destino, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    tam_mb = os.path.getsize(destino) / (1024 * 1024)
    print(f"  -> OK: descargado ({tam_mb:.1f} MB)")


def extraer_comercios_objetivo(zip_principal, carpeta_trabajo):
    """Descomprime el ZIP principal y extrae SOLO los CSV de los comercios objetivo."""
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

        if id_comercio not in COMERCIOS_OBJETIVO:
            continue

        destino_comercio = os.path.join(CARPETA_DESTINO, f"sepa{id_comercio}")
        os.makedirs(destino_comercio, exist_ok=True)
        try:
            with zipfile.ZipFile(zip_interno, 'r') as z:
                z.extractall(destino_comercio)
            comercios_extraidos.append(id_comercio)
            print(f"  -> OK: comercio {id_comercio} extraído a sepa{id_comercio}/")
        except zipfile.BadZipFile:
            print(f"  -> ATENCIÓN: el ZIP del comercio {id_comercio} está corrupto, se saltea.")

    return comercios_extraidos


def main():
    args = parsear_argumentos()

    if args.dia:
        nombre_dia = args.dia.capitalize()
        fecha_esperada = None
        print(f"=== Descarga SEPA — MODO PRUEBA: {nombre_dia} ===\n")
    else:
        fecha, nombre_dia = calcular_fecha_objetivo()
        fecha_esperada = fecha
        print(f"=== Descarga SEPA — objetivo: {nombre_dia} {fecha} ===\n")

    if os.path.exists(CARPETA_TEMP):
        shutil.rmtree(CARPETA_TEMP)
    os.makedirs(CARPETA_TEMP)

    url = obtener_recurso(nombre_dia, fecha_esperada)
    if not url:
        print("\nNo hay datos válidos para descargar. Saliendo sin error.")
        if os.path.exists(CARPETA_TEMP):
            shutil.rmtree(CARPETA_TEMP)
        return

    zip_principal = os.path.join(CARPETA_TEMP, "sepa_dia.zip")
    descargar_zip(url, zip_principal)

    print("Extrayendo comercios objetivo...")
    extraidos = extraer_comercios_objetivo(zip_principal, CARPETA_TEMP)

    shutil.rmtree(CARPETA_TEMP)

    if extraidos:
        print(f"\n¡Listo! Comercios descargados: {sorted(extraidos)}")
    else:
        print(f"\nATENCIÓN: no se extrajo ningún comercio objetivo.")


if __name__ == "__main__":
    main()
