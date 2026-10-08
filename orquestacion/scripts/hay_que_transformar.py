"""
Decide si la corrida programada de dbt tiene algo que hacer hoy.

POR QUE EXISTE (2026-09-26). La corrida diaria gasta ~12 GiB de cuota aunque
no haya entrado nada: fechas_a_calcular siempre rehace la ultima fecha para que
ningun mart quede vacio, asi que un dia sin datos nuevos rearma los mismos marts
con el mismo resultado. El 26-09 el portal de SEPA no respondio, la ingesta no
cargo nada y la corrida habria quemado 12 GiB de los ~180 que le quedaban al
mes gratuito para escribir exactamente lo que ya estaba.

LA REGLA. Hay que transformar si pasa cualquiera de estas tres cosas:

  1. Hay fechas en el crudo que todavia no estan en los historicos. Cubre los
     datos nuevos y tambien una corrida que murio a mitad o que proceso solo
     algunas fechas (ver maximo_fechas_por_corrida): lo que no llego a los
     historicos sigue pendiente y la corrida siguiente lo retoma.
  2. Hubo commits en modelos, seeds, macros o la categorizacion despues del
     ultimo rebuild. Un cambio de metodologia tiene que llegar a los marts
     aunque no haya datos nuevos.
  3. La corrida no es la programada (workflow_dispatch): quien la dispara a
     mano quiere que corra.

POR QUE FECHAS Y NO HORAS DE MODIFICACION (2026-10-08). La primera version
corria si alguna tabla de la ingesta se habia modificado despues que el modelo
mas viejo. Pero la ingesta modifica el crudo aunque no cargue nada: ajusta su
retencion, y eso cambia la hora de modificacion de la tabla. Del 4 al 7 de
octubre SEPA no publico, la corrida corrio igual todos los dias, y el 7 rearmo
la canasta y Mas barato sin filas. Comparar fechas presentes contra fechas
procesadas mide lo que importa.

Todo sale de metadata de tablas (lista de particiones y tables.get), que no
consume cuota.

EL AVISO DE ATRASO NO SE PIERDE. Antes, un dia sin datos hacia fallar el test
crudo_al_dia y GitHub mandaba el mail. Si la corrida se saltea, ese test no
corre; por eso este script repite el mismo chequeo (la ultima fecha del crudo
contra hoy en Argentina, con el mismo umbral) y termina en error cuando saltea
con el crudo atrasado.

    python hay_que_transformar.py            # imprime la decision
    GITHUB_OUTPUT=... python hay_que_transformar.py   # ademas la deja al workflow
"""

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from google.cloud import bigquery
from google.cloud.exceptions import NotFound

PROYECTO = "proyecto-precios-504221"
RAIZ = Path(__file__).resolve().parents[2]
CRUDO = f"{PROYECTO}.sepa.productos"

# El mismo umbral que tests/crudo_al_dia.sql: en regimen el atraso es 1 dia, 2
# puede ser el portal demorado y con 3 el crudo ya esta por quedar vacio.
ATRASO_MAXIMO_DIAS = 2

# Donde queda cada fecha una vez procesada. Los mismos tres que mira la
# ingesta: cada uno arranco en una fecha distinta, asi que se usa la union.
HISTORICOS = [
    f"{PROYECTO}.dbt_precios.historico_quien_gana",
    f"{PROYECTO}.dbt_precios.historico_canasta_localidad",
    f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria",
]

# Lo que, si cambia en git, cambia lo que calcula dbt.
RUTAS_DE_CODIGO = ["models", "seeds", "macros", "dbt_project.yml", "packages.yml",
                   "orquestacion/scripts/categorizar.py"]


def decidir(pendientes, modelos_modificados, hay_commits, manual):
    """Devuelve (correr, motivo). Separada de BigQuery y de git para probarla.

    pendientes: fechas que estan en el crudo y no en los historicos.
    """
    if manual:
        return True, "corrida manual"
    if not modelos_modificados:
        return True, "no hay modelos armados todavia"
    if pendientes:
        return True, "fechas sin procesar: " + ", ".join(f.isoformat() for f in sorted(pendientes))
    if hay_commits:
        return True, "hay cambios de codigo de dbt sin aplicar"
    return False, "no hay fechas nuevas en el crudo ni cambios de codigo"


def fechas_con_particion(cliente, tabla):
    try:
        particiones = cliente.list_partitions(tabla)
    except NotFound:
        return set()
    return {datetime.strptime(p, "%Y%m%d").date() for p in particiones if p.isdigit()}


def fechas_pendientes(cliente):
    procesadas = set()
    for tabla in HISTORICOS:
        procesadas |= fechas_con_particion(cliente, tabla)
    return fechas_con_particion(cliente, CRUDO) - procesadas


def dias_de_atraso(ultima_fecha, hoy):
    """Dias entre la ultima fecha del crudo y hoy. Sin fechas, infinito."""
    return float("inf") if ultima_fecha is None else (hoy - ultima_fecha).days


def ultima_fecha_del_crudo(cliente):
    particiones = [p for p in cliente.list_partitions(CRUDO) if p.isdigit()]
    return datetime.strptime(max(particiones), "%Y%m%d").date() if particiones else None


def nombres_de_modelos():
    """Los modelos del repo: asi una tabla huerfana de un modelo borrado no
    queda para siempre como 'la mas vieja' y fuerza todas las corridas."""
    return {p.stem for p in (RAIZ / "models").rglob("*.sql")}


def modificaciones(cliente, tablas):
    fechas = {}
    for tabla in tablas:
        try:
            t = cliente.get_table(tabla)
        except NotFound:
            continue
        if t.table_type == "TABLE":  # las vistas no guardan cuando se rearmaron
            fechas[t.table_id] = t.modified
    return fechas


def hay_commits_desde(momento):
    salida = subprocess.run(
        ["git", "log", f"--since={momento.isoformat()}", "--format=%h", "--", *RUTAS_DE_CODIGO],
        cwd=RAIZ, capture_output=True, text=True, check=True,
    ).stdout.strip()
    return bool(salida)


def main():
    manual = os.environ.get("GITHUB_EVENT_NAME", "schedule") != "schedule"
    cliente = bigquery.Client.from_service_account_json(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "credenciales.json"))

    pendientes = fechas_pendientes(cliente)
    modelos = modificaciones(cliente, [f"{PROYECTO}.dbt_precios.{n}" for n in nombres_de_modelos()])
    commits = bool(modelos) and hay_commits_desde(min(modelos.values()))

    correr, motivo = decidir(pendientes, modelos, commits, manual)
    print(f"{'Correr' if correr else 'Saltear'}: {motivo}")

    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a") as salida:
            salida.write(f"correr={'true' if correr else 'false'}\n")

    # Si corre, el test crudo_al_dia se encarga del aviso.
    if not correr:
        hoy = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")).date()
        ultima = ultima_fecha_del_crudo(cliente)
        atraso = dias_de_atraso(ultima, hoy)
        if atraso > ATRASO_MAXIMO_DIAS:
            print(f"ERROR: la ultima fecha del crudo es {ultima}, {atraso} dias atras. "
                  "La ingesta local no esta cargando: revisar el log de la tarea programada.")
            return 1
        print(f"Crudo al dia: ultima fecha {ultima} ({atraso} dias).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
