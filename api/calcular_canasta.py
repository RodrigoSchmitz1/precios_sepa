from google.cloud import bigquery

PROYECTO = "proyecto-precios-504221"

# Minimo de muestras para considerar confiable el precio de una categoria.
MIN_MUESTRAS = 10


def calcular_costo_canasta(cliente_bq, items: list, localidades: list) -> dict:
    """Calcula el costo real de una canasta personalizada.

    items: lista de {categoria, cantidad, unidad, gama, razon}
    localidades: lista de nombres de localidad (se combinan, no se promedian
    por separado -- el usuario eligio verlas como una sola zona).

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
        return {"items": [], "costo_total": 0, "categorias_calculadas": 0, "categorias_pedidas": len(items)}

    precios = _traer_precios(cliente_bq, items, localidades)

    resultados_por_categoria = []
    for item in items:
        clave = (item["categoria"], item["gama"], item["unidad"])
        dato = precios.get(clave)
        if not dato or dato["muestras"] < MIN_MUESTRAS:
            continue

        precio_unitario = dato["precio_mediano_unidad"]
        resultados_por_categoria.append({
            "categoria": item["categoria"],
            "cantidad": item["cantidad"],
            "unidad": item["unidad"],
            "gama": item["gama"],
            "razon": item.get("razon", ""),
            "precio_unitario": round(precio_unitario, 4),
            "costo_categoria": round(precio_unitario * item["cantidad"], 2),
            "muestras": dato["muestras"],
        })

    costo_total = round(sum(r["costo_categoria"] for r in resultados_por_categoria), 2)

    return {
        "items": resultados_por_categoria,
        "costo_total": costo_total,
        "categorias_calculadas": len(resultados_por_categoria),
        "categorias_pedidas": len(items),
    }


def _traer_precios(cliente_bq, items: list, localidades: list) -> dict:
    """Trae en UNA sola query el precio de todas las categorias pedidas.

    Devuelve {(categoria, gama, unidad): {precio_mediano_unidad, muestras}}.
    """
    tabla = f"{PROYECTO}.dbt_precios.mart_precio_categoria_localidad"

    query = f"""
        SELECT
            categoria,
            gama,
            unidad_normalizada,
            SUM(precio_mediano_unidad * muestras) / SUM(muestras) AS precio_mediano_unidad,
            SUM(muestras) AS muestras
        FROM `{tabla}`
        WHERE fecha_datos = (SELECT MAX(fecha_datos) FROM `{tabla}`)
            AND localidad IN UNNEST(@localidades)
            AND categoria IN UNNEST(@categorias)
        GROUP BY categoria, gama, unidad_normalizada
    """

    categorias = list({item["categoria"] for item in items})
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ArrayQueryParameter("localidades", "STRING", localidades),
        bigquery.ArrayQueryParameter("categorias", "STRING", categorias),
    ])

    filas = cliente_bq.query(query, job_config=job_config).result()
    return {
        (f["categoria"], f["gama"], f["unidad_normalizada"]): {
            "precio_mediano_unidad": f["precio_mediano_unidad"],
            "muestras": f["muestras"],
        }
        for f in filas
    }
