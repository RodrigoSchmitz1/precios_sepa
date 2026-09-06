"""
Ingesta auto-reparable de SEPA.

Detecta que fechas de la ventana reciente no fueron capturadas todavia y baja
y carga cada una. Reemplaza al "bajar siempre ayer": si un dia el pipeline no
corre (maquina apagada, portal caido), ese dia se recupera solo en la corrida
siguiente en vez de perderse para siempre.

Una fecha se considera capturada si aparece en el crudo (sepa.productos) o en
el historico (que es permanente). Chequear las dos cosas cubre los dos casos:
recien cargada pero todavia sin transformar, y transformada hace dias con el
crudo ya expirado.

LIMITE CONOCIDO: sepa.productos retiene 3 dias (partition_expiration_days=3,
decision de costo). Una fecha mas vieja que eso se puede cargar igual y llega
al historico si dbt corre a continuacion, pero BigQuery va a expirar esa
particion del crudo poco despues. Por eso conviene correr dbt inmediatamente
despues de este script.
"""

import argparse
import glob
import os
import subprocess
import sys
from datetime import date, timedelta

from google.cloud import bigquery
from google.cloud.exceptions import NotFound

CARPETA = os.path.dirname(os.path.abspath(__file__))
CREDENCIALES = "credenciales.json"
PROYECTO = "proyecto-precios-504221"
TABLA_CRUDA = f"{PROYECTO}.sepa.productos"
TABLAS_HISTORICO = [
    f"{PROYECTO}.dbt_precios.historico_quien_gana",
    f"{PROYECTO}.dbt_precios.historico_canasta_localidad",
    f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria",
]

# Por defecto se revisan los mismos 3 dias que retiene el crudo: son las fechas
# que se recuperan de forma confiable. SEPA publica 7 dias, asi que con --dias
# se puede intentar una recuperacion mas profunda, pero es best-effort: una
# fecha mas vieja que la retencion sobrevive en el crudo solo hasta que
# BigQuery expira su particion, asi que depende de que dbt corra enseguida.
VENTANA_DIAS = 3


def parsear_argumentos():
    parser = argparse.ArgumentParser(description="Ingesta SEPA con backfill automatico.")
    parser.add_argument(
        "--dias",
        type=int,
        default=VENTANA_DIAS,
        help=f"Cuantos dias hacia atras revisar (default {VENTANA_DIAS}, el maximo que publica SEPA)",
    )
    parser.add_argument(
        "--simular",
        action="store_true",
        help="Solo informar que fechas faltan, sin descargar ni cargar nada",
    )
    return parser.parse_args()


def fechas_en_tabla(cliente, tabla, desde):
    """Fechas distintas presentes en una tabla desde una fecha dada. Vacio si no existe."""
    try:
        cliente.get_table(tabla)
    except NotFound:
        print(f"  (la tabla {tabla} no existe todavia)")
        return set()

    query = f"SELECT DISTINCT fecha_datos FROM `{tabla}` WHERE fecha_datos >= @desde"
    config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("desde", "DATE", desde)]
    )
    return {fila.fecha_datos for fila in cliente.query(query, job_config=config).result()}


def calcular_faltantes(cliente, dias):
    """Fechas de la ventana que no estan ni en el crudo ni en el historico."""
    hoy = date.today()
    desde = hoy - timedelta(days=dias)
    ventana = [hoy - timedelta(days=n) for n in range(dias + 1)]

    en_crudo = fechas_en_tabla(cliente, TABLA_CRUDA, desde)

    # Union de los tres historicos: cada uno arranco en una fecha distinta, asi
    # que mirar uno solo marcaria como faltantes fechas que si fueron procesadas.
    en_historico = set()
    for tabla in TABLAS_HISTORICO:
        en_historico |= fechas_en_tabla(cliente, tabla, desde)

    capturadas = en_crudo | en_historico

    def listar(fechas):
        return ", ".join(f.isoformat() for f in sorted(fechas)) if fechas else "ninguna"

    print(f"  En el crudo:      {listar(en_crudo)}")
    print(f"  En los historicos: {listar(en_historico)}")

    # Ordenadas de mas vieja a mas nueva: las viejas son las que estan por
    # caerse de la ventana de publicacion de SEPA, asi que van primero.
    return sorted(f for f in ventana if f not in capturadas)


def hay_datos_descargados():
    """True si quedo al menos una carpeta sepaN/ con datos para cargar."""
    return any(
        os.path.isdir(c) for c in glob.glob(os.path.join(CARPETA, "sepa*"))
    )


def correr(script, *extra):
    """Ejecuta un script hermano con el mismo interprete. Devuelve True si salio bien."""
    comando = [sys.executable, os.path.join(CARPETA, script), *extra]
    resultado = subprocess.run(comando, cwd=CARPETA)
    return resultado.returncode == 0


def procesar_fecha(fecha):
    """Descarga y carga una fecha. Devuelve 'ok', 'sin_datos' o 'error'."""
    print(f"\n--- {fecha} ---")

    if not correr("descargar_sepa.py", "--fecha", fecha.isoformat()):
        print(f"  ERROR en la descarga de {fecha}")
        return "error"

    if not hay_datos_descargados():
        print(f"  SEPA no tiene datos publicados para {fecha}; se omite")
        return "sin_datos"

    if not correr("cargar_datos.py", "--fecha", fecha.isoformat()):
        print(f"  ERROR en la carga de {fecha}")
        return "error"

    print(f"  OK: {fecha} cargada")
    return "ok"


def main():
    args = parsear_argumentos()
    cliente = bigquery.Client.from_service_account_json(CREDENCIALES)

    print(f"=== Ingesta SEPA con backfill (ventana: {args.dias} dias) ===\n")
    faltantes = calcular_faltantes(cliente, args.dias)

    if not faltantes:
        print("\nNo falta ninguna fecha. Nada que hacer.")
        return 0

    print(f"\nFechas faltantes: {', '.join(f.isoformat() for f in faltantes)}")

    if args.simular:
        print("(modo simulacion: no se descarga ni carga nada)")
        return 0

    resultados = {f: procesar_fecha(f) for f in faltantes}

    ok = [f for f, r in resultados.items() if r == "ok"]
    sin_datos = [f for f, r in resultados.items() if r == "sin_datos"]
    errores = [f for f, r in resultados.items() if r == "error"]

    print("\n=== Resumen ===")
    print(f"  Cargadas:      {[str(f) for f in ok] or 'ninguna'}")
    print(f"  Sin datos:     {[str(f) for f in sin_datos] or 'ninguna'}")
    print(f"  Con error:     {[str(f) for f in errores] or 'ninguna'}")

    if ok:
        print("\nCorre dbt a continuacion para que estas fechas lleguen a los historicos.")

    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
