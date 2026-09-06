"""
Descarga el GeoJSON oficial de barrios de CABA (datos abiertos GCBA) y lo
convierte a CSV con la geometria en formato WKT, listo para cargar a BigQuery.
Fuente: https://data.buenosaires.gob.ar/dataset/barrios
"""
import csv
import requests
from shapely.geometry import shape

URL_GEOJSON = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/barrios/barrios.geojson"
ARCHIVO_SALIDA = "barrios_caba.csv"


def main():
    print("Descargando GeoJSON de barrios de CABA...")
    respuesta = requests.get(URL_GEOJSON, timeout=30)
    respuesta.raise_for_status()
    datos = respuesta.json()

    features = datos["features"]
    print(f"Encontrados {len(features)} barrios.")

    with open(ARCHIVO_SALIDA, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["barrio", "comuna", "geometria_wkt"])

        for feature in features:
            nombre = feature["properties"].get("nombre") or feature["properties"].get("BARRIO")
            comuna = feature["properties"].get("comuna") or feature["properties"].get("COMUNA")
            geometria = shape(feature["geometry"])
            writer.writerow([nombre, comuna, geometria.wkt])

    print(f"Listo. Guardado en {ARCHIVO_SALIDA}")


if __name__ == "__main__":
    main()
