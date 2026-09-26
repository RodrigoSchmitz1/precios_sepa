"""
Decide si la corrida programada de dbt tiene algo que hacer hoy.

POR QUE EXISTE (2026-09-26). La corrida diaria gasta ~12 GiB de cuota aunque
no haya entrado nada: fechas_a_calcular siempre rehace la ultima fecha para que
ningun mart quede vacio, asi que un dia sin datos nuevos rearma los mismos marts
con el mismo resultado. El 26-09 el portal de SEPA no respondio, la ingesta no
cargo nada y la corrida habria quemado 12 GiB de los ~180 que le quedaban al
mes gratuito para escribir exactamente lo que ya estaba.

LA REGLA. Hay que transformar si pasa cualquiera de estas tres cosas:

  1. Alguna tabla que escribe la ingesta (crudo, comercio, sucursales) se
     modifico despues que el modelo de dbt mas viejo. Cubre los datos nuevos y
     tambien una corrida que murio a mitad: el mart que no llego a armarse
     queda mas viejo que el crudo y la corrida siguiente lo rehace.
  2. Hubo commits en modelos, seeds, macros o la categorizacion despues de esa
     misma hora. Un cambio de metodologia tiene que llegar a los marts aunque
     no haya datos nuevos.
  3. La corrida no es la programada (workflow_dispatch): quien la dispara a
     mano quiere que corra.

Todo sale de metadata de tablas (tables.get), que no consume cuota.

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

# Lo que escribe la ingesta local. No va producto_categoria, que esta en el
# mismo dataset pero la escribe este mismo workflow (categorizar.py).
ENTRADAS = [
    f"{PROYECTO}.sepa.productos",
    f"{PROYECTO}.sepa.comercio",
    f"{PROYECTO}.sepa.sucursales",
]

# Lo que, si cambia en git, cambia lo que calcula dbt.
RUTAS_DE_CODIGO = ["models", "seeds", "macros", "dbt_project.yml", "packages.yml",
                   "orquestacion/scripts/categorizar.py"]


def decidir(entradas_modificadas, modelos_modificados, hay_commits, manual):
    """Devuelve (correr, motivo). Separada de BigQuery y de git para probarla."""
    if manual:
        return True, "corrida manual"
    if not modelos_modificados:
        return True, "no hay modelos armados todavia"
    mas_viejo = min(modelos_modificados.values())
    nuevas = sorted(t for t, m in entradas_modificadas.items() if m > mas_viejo)
    if nuevas:
        return True, f"la ingesta escribio {', '.join(nuevas)} despues del modelo mas viejo"
    if hay_commits:
        return True, "hay cambios de codigo de dbt sin aplicar"
    viejo = min(modelos_modificados, key=modelos_modificados.get)
    return False, f"nada nuevo desde {mas_viejo:%Y-%m-%d %H:%M} UTC ({viejo})"


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

    entradas = modificaciones(cliente, ENTRADAS)
    modelos = modificaciones(cliente, [f"{PROYECTO}.dbt_precios.{n}" for n in nombres_de_modelos()])
    commits = bool(modelos) and hay_commits_desde(min(modelos.values()))

    correr, motivo = decidir(entradas, modelos, commits, manual)
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
