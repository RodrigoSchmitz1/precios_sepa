from google.cloud import bigquery

PROYECTO = "proyecto-precios-504221"

# Minimo de muestras para considerar confiable el precio de una categoria.
MIN_MUESTRAS = 10


def calcular_costo_canasta(cliente_bq, items: list, localidades: list) -> dict:
    """Calcula el costo real de una canasta personalizada.

    items: lista de {categoria, cantidad, unidad, gama, razon}
    localidades: lista de {localidad, provincia} (se combinan, no se promedian
    por separado -- el usuario eligio verlas como una sola zona). La provincia
    es obligatoria porque el nombre solo es ambiguo: hay localidades repetidas
    entre provincias (Cordoba existe en AR-C y AR-X con precios distintos), y
    filtrar solo por nombre traia las dos mezcladas en el mismo promedio.

    Lee de mart_precio_categoria_localidad, que ya tiene el precio mediano por
    unidad precalculado por categoria x gama x unidad x localidad. Antes esto
    se calculaba al vuelo con una query por categoria contra stg_productos:
    2.51 GB escaneados por categoria, ~37 GB por una canasta de 15. Con eso,
    unos 27 usuarios agotaban el TB mensual gratuito de BigQuery.

    Al combinar varias localidades se promedian las medianas ponderando por
    cantidad de muestras. No es identico a la mediana del pool de todas las
    localidades juntas (lo que se hacia antes), pero es mas representativo:
    el recorte de outliers queda relativo a cada localidad, en vez de que una
    localidad barata entera pueda quedar recortada al compararla con otra cara.
    """
    if not items or not localidades:
        return {
            "items": [],
            "costo_total": 0,
            "categorias_calculadas": 0,
            "categorias_pedidas": len(items),
            "categorias_provinciales": 0,
        }

    zona, provincia = _traer_precios(cliente_bq, items, localidades)
    return armar_resultado(items, zona, provincia)


def armar_resultado(items: list, zona: dict, provincia: dict) -> dict:
    """Cotiza cada item con el precio de la zona o, si no alcanza, el de la provincia.

    RESPALDO PROVINCIAL (2026-09-24). Una categoria sin 10 precios en la zona
    elegida quedaba fuera del total. Al cargar la canasta basica para 2 adultos
    y 2 chicos en Palermo, el pollo economico no tenia datos y la canasta salia
    sin pollo, mas barata que la real, con un aviso al pie que era facil no ver.
    Canasta basica ya resolvia lo mismo con la mediana de la provincia, como
    hacen los indices oficiales con los precios faltantes; ahora Tu canasta
    tambien, y cada item dice de donde salio su precio (origen_precio) para que
    la pagina lo marque. A diferencia de Canasta basica no hay tope de
    categorias imputadas: aca no se comparan localidades entre si, se cotiza la
    canasta de una persona, y un precio provincial marcado es mejor que un hueco.

    Separada de la consulta para poder probarla sin BigQuery.
    """
    resultados = []
    for item in items:
        clave = (item["categoria"], item["gama"], item["unidad"])
        dato, origen = zona.get(clave), "zona"
        if not dato or dato["muestras"] < MIN_MUESTRAS:
            dato, origen = provincia.get(clave), "provincia"
        if not dato or dato["muestras"] < MIN_MUESTRAS:
            continue

        precio_unitario = dato["precio_mediano_unidad"]
        resultados.append({
            "categoria": item["categoria"],
            "cantidad": item["cantidad"],
            "unidad": item["unidad"],
            "gama": item["gama"],
            "razon": item.get("razon", ""),
            "precio_unitario": round(precio_unitario, 4),
            "costo_categoria": round(precio_unitario * item["cantidad"], 2),
            "muestras": dato["muestras"],
            "origen_precio": origen,
        })

    return {
        "items": resultados,
        "costo_total": round(sum(r["costo_categoria"] for r in resultados), 2),
        "categorias_calculadas": len(resultados),
        "categorias_pedidas": len(items),
        "categorias_provinciales": sum(r["origen_precio"] == "provincia" for r in resultados),
    }


def _traer_precios(cliente_bq, items: list, localidades: list) -> tuple[dict, dict]:
    """Trae en UNA sola query el precio de la zona y el de sus provincias.

    Devuelve dos diccionarios {(categoria, gama, unidad): {precio_mediano_unidad,
    muestras}}: el primero con las localidades elegidas y el segundo con todas
    las localidades de sus provincias. Los dos promedian las medianas de cada
    localidad ponderando por muestras, igual que ya se hacia al combinar zonas.
    Es la misma tabla chica leida una vez, asi que el respaldo no agrega costo.
    """
    tabla = f"{PROYECTO}.dbt_precios.mart_precio_categoria_localidad"

    query = f"""
        WITH base AS (
            SELECT *
            FROM `{tabla}`
            WHERE fecha_datos = (SELECT MAX(fecha_datos) FROM `{tabla}`)
                AND provincia IN UNNEST(@provincias)
                AND categoria IN UNNEST(@categorias)
        )
        SELECT
            "zona" AS nivel,
            categoria,
            gama,
            unidad_normalizada,
            SUM(precio_mediano_unidad * muestras) / SUM(muestras) AS precio_mediano_unidad,
            SUM(muestras) AS muestras
        FROM base
        WHERE (localidad, provincia) IN UNNEST(@zonas)
        GROUP BY categoria, gama, unidad_normalizada
        UNION ALL
        SELECT
            "provincia" AS nivel,
            categoria,
            gama,
            unidad_normalizada,
            SUM(precio_mediano_unidad * muestras) / SUM(muestras) AS precio_mediano_unidad,
            SUM(muestras) AS muestras
        FROM base
        GROUP BY categoria, gama, unidad_normalizada
    """

    categorias = list({item["categoria"] for item in items})
    provincias = list({z["provincia"] for z in localidades})
    tipo_zona = bigquery.StructQueryParameterType(
        bigquery.ScalarQueryParameterType("STRING", name="localidad"),
        bigquery.ScalarQueryParameterType("STRING", name="provincia"),
    )
    zonas = [
        bigquery.StructQueryParameter(
            None,
            bigquery.ScalarQueryParameter("localidad", "STRING", z["localidad"]),
            bigquery.ScalarQueryParameter("provincia", "STRING", z["provincia"]),
        )
        for z in localidades
    ]

    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ArrayQueryParameter("zonas", tipo_zona, zonas),
        bigquery.ArrayQueryParameter("categorias", "STRING", categorias),
        bigquery.ArrayQueryParameter("provincias", "STRING", provincias),
    ])

    niveles: dict = {"zona": {}, "provincia": {}}
    for f in cliente_bq.query(query, job_config=job_config).result():
        niveles[f["nivel"]][(f["categoria"], f["gama"], f["unidad_normalizada"])] = {
            "precio_mediano_unidad": f["precio_mediano_unidad"],
            "muestras": f["muestras"],
        }
    return niveles["zona"], niveles["provincia"]
