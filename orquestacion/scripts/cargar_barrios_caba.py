"""
Carga barrios_caba.csv (generado por descargar_barrios_caba.py) a BigQuery,
como tabla sepa.barrios_caba con columnas: barrio, comuna, geometria_wkt.
Requiere credenciales.json en la misma carpeta.
"""
from google.cloud import bigquery

PROYECTO = "proyecto-precios-504221"
DATASET = "sepa"
TABLA = "barrios_caba"
ARCHIVO = "barrios_caba.csv"


def main():
    cliente = bigquery.Client.from_service_account_json("credenciales.json")

    tabla_id = f"{PROYECTO}.{DATASET}.{TABLA}"

    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.CSV,
        skip_leading_rows=1,
        schema=[
            bigquery.SchemaField("barrio", "STRING"),
            bigquery.SchemaField("comuna", "INT64"),
            bigquery.SchemaField("geometria_wkt", "STRING"),
        ],
        write_disposition="WRITE_TRUNCATE",
    )

    with open(ARCHIVO, "rb") as f:
        job = cliente.load_table_from_file(f, tabla_id, job_config=job_config)

    job.result()

    tabla = cliente.get_table(tabla_id)
    print(f"Cargado: {tabla.num_rows} filas en {tabla_id}")


if __name__ == "__main__":
    main()
