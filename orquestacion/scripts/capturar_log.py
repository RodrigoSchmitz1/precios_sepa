import argparse
from datetime import date, timedelta
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# --- Configuración ---
CREDENCIALES = "credenciales.json"
PROYECTO = "proyecto-precios-504221"
DATASET_DBT = "dbt_precios"   # donde dbt materializa la detección
DATASET_LOG = "sepa"          # donde vive el log (junto a las crudas)

LOG = f"{PROYECTO}.{DATASET_LOG}.log_cambios_dimensiones"
DETECCIONES = [
    f"{PROYECTO}.{DATASET_DBT}.deteccion_cambios_sucursales",
    f"{PROYECTO}.{DATASET_DBT}.deteccion_cambios_comercio",
]


def parsear_fecha():
    """
    Lee la fecha desde la línea de comandos: --fecha AAAA-MM-DD
    Si no se pasa --fecha, usa ayer (para el pipeline automático).
    """
    parser = argparse.ArgumentParser(description="Captura cambios de dimensiones al log histórico.")
    parser.add_argument(
        "--fecha",
        required=False,
        default=None,
        help="Fecha de la detección, formato AAAA-MM-DD. Si se omite, usa ayer.",
    )
    args = parser.parse_args()

    if args.fecha is None:
        ayer = date.today() - timedelta(days=1)
        print(f"(sin --fecha: usando ayer = {ayer})")
        return ayer

    return date.fromisoformat(args.fecha)


def existe_tabla(cliente, tabla):
    """Devuelve True si la tabla existe."""
    try:
        cliente.get_table(tabla)
        return True
    except NotFound:
        return False


def capturar_log(cliente, fecha):
    """
    Acumula los cambios detectados hoy al log histórico, sin DML.
    Patrón: log_nuevo = (log viejo SIN esta fecha) UNION ALL (detecciones de hoy con fecha).
    Excluir la fecha actual hace la operación idempotente (reprocesar un día no duplica).
    """
    # Las detecciones de hoy: unimos sucursales + comercio, y les estampamos la fecha
    detecciones_union = "\n        UNION ALL\n        ".join(
        f"SELECT DATE(@fecha) AS fecha_deteccion, * FROM `{d}`"
        for d in DETECCIONES
    )

    # Si el log ya existe, arrancamos preservando lo viejo (menos la fecha de hoy).
    # Si no existe (primera corrida), esa parte se omite.
    if existe_tabla(cliente, LOG):
        parte_historica = f"""
        SELECT * FROM `{LOG}`
        WHERE fecha_deteccion != DATE(@fecha)
        UNION ALL
        """
    else:
        parte_historica = ""
        print("  (el log no existía; se crea por primera vez)")

    query = f"""
        CREATE OR REPLACE TABLE `{LOG}`
        PARTITION BY fecha_deteccion AS
        {parte_historica}
        {detecciones_union}
    """

    params = [bigquery.ScalarQueryParameter("fecha", "DATE", fecha)]
    job_config = bigquery.QueryJobConfig(query_parameters=params)

    print(f"Capturando cambios de dimensiones al log para la fecha {fecha}...")
    cliente.query(query, job_config=job_config).result()

    # Reporte de cuántos cambios se registraron hoy
    conteo_query = f"""
        SELECT dimension, tipo_cambio, COUNT(*) AS cantidad
        FROM `{LOG}`
        WHERE fecha_deteccion = DATE(@fecha)
        GROUP BY dimension, tipo_cambio
        ORDER BY dimension, tipo_cambio
    """
    resultado = cliente.query(conteo_query, job_config=job_config).result()
    filas = list(resultado)
    if filas:
        print(f"  -> Cambios registrados para {fecha}:")
        for fila in filas:
            print(f"     {fila.dimension} / {fila.tipo_cambio}: {fila.cantidad}")
    else:
        print(f"  -> Sin cambios para {fecha}.")


def main():
    fecha = parsear_fecha()
    cliente = bigquery.Client.from_service_account_json(CREDENCIALES)
    print(f"=== Captura de log de cambios para {fecha} ===\n")
    capturar_log(cliente, fecha)
    print(f"\n¡Listo! Log actualizado para {fecha}.")


if __name__ == "__main__":
    main()