from google.cloud import bigquery

PROYECTO = "proyecto-precios-504221"


def calcular_costo_canasta(cliente_bq, items: list, localidades: list) -> dict:
    """Calcula el costo real de una canasta personalizada.

    items: lista de {categoria, cantidad, unidad, gama, razon}
    localidades: lista de nombres de localidad (se combinan, no se promedian
    por separado -- el usuario eligio verlas como una sola zona).
    """
    if not items or not localidades:
        return {"items": [], "costo_total": 0, "categorias_calculadas": 0, "categorias_pedidas": len(items)}

    parametros = []
    resultados_por_categoria = []

    for i, item in enumerate(items):
        param_categoria = f"categoria_{i}"
        param_gama = f"gama_{i}"

        query = f"""
            WITH productos_filtrados AS (
                SELECT
                    p.precio,
                    p.cantidad_normalizada
                FROM `{PROYECTO}.dbt_precios.stg_productos` AS p
                JOIN `{PROYECTO}.sepa.producto_categoria` AS cat ON p.id_producto = cat.id_producto
                JOIN `{PROYECTO}.dbt_precios.mart_gama_productos` AS gama ON p.id_producto = gama.id_producto
                JOIN `{PROYECTO}.dbt_precios.stg_sucursales` AS s ON p.id_comercio = s.id_comercio AND p.id_sucursal = s.id_sucursal
                WHERE p.fecha_datos = (SELECT MAX(fecha_datos) FROM `{PROYECTO}.dbt_precios.stg_productos`)
                    AND cat.categoria = @{param_categoria}
                    AND gama.gama = @{param_gama}
                    AND s.localidad IN UNNEST(@localidades)
                    AND p.cantidad_normalizada IS NOT NULL
                    AND p.unidad_normalizada = @unidad_{i}
                    AND (
                        (p.unidad_normalizada IN ("g", "cc") AND p.cantidad_normalizada BETWEEN 5 AND 10000)
                        OR (p.unidad_normalizada = "unidad" AND p.cantidad_normalizada BETWEEN 1 AND 60)
                    )
            ),
            con_precio_unitario AS (
                SELECT precio / cantidad_normalizada AS precio_por_unidad
                FROM productos_filtrados
            ),
            limites AS (
                SELECT
                    APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(10)] AS p10,
                    APPROX_QUANTILES(precio_por_unidad, 100)[OFFSET(90)] AS p90
                FROM con_precio_unitario
            )
            SELECT
                APPROX_QUANTILES(precio_por_unidad, 2)[OFFSET(1)] AS precio_mediano_unidad,
                COUNT(*) AS muestras
            FROM con_precio_unitario, limites
            WHERE precio_por_unidad >= limites.p10 AND precio_por_unidad <= limites.p90
        """

        job_config = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter(param_categoria, "STRING", item["categoria"]),
            bigquery.ScalarQueryParameter(param_gama, "STRING", item["gama"]),
            bigquery.ScalarQueryParameter(f"unidad_{i}", "STRING", item["unidad"]),
            bigquery.ArrayQueryParameter("localidades", "STRING", localidades),
        ])

        resultado = list(cliente_bq.query(query, job_config=job_config).result())

        if resultado and resultado[0]["muestras"] and resultado[0]["muestras"] >= 10:
            precio_unitario = resultado[0]["precio_mediano_unidad"]
            costo_categoria = round(precio_unitario * item["cantidad"], 2)
            resultados_por_categoria.append({
                "categoria": item["categoria"],
                "cantidad": item["cantidad"],
                "unidad": item["unidad"],
                "gama": item["gama"],
                "razon": item.get("razon", ""),
                "precio_unitario": round(precio_unitario, 4),
                "costo_categoria": costo_categoria,
                "muestras": resultado[0]["muestras"],
            })

    costo_total = round(sum(r["costo_categoria"] for r in resultados_por_categoria), 2)

    return {
        "items": resultados_por_categoria,
        "costo_total": costo_total,
        "categorias_calculadas": len(resultados_por_categoria),
        "categorias_pedidas": len(items),
    }
