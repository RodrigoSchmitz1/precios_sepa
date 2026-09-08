from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from pydantic import BaseModel
from typing import Optional
from interpretar_canasta import interpretar_descripcion
from calcular_canasta import calcular_costo_canasta

app = FastAPI(title="precios_sepa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

cliente_bq = bigquery.Client.from_service_account_json("credenciales.json")

PROYECTO = "proyecto-precios-504221"


def solo_ultima_fecha(tabla: str) -> str:
    """Condicion para acotar un mart al ultimo dia que tenga cargado.

    Desde el arreglo de grano del 2026-09-06 los marts devuelven UNA FILA POR
    FECHA (antes solo calculaban la fecha maxima del crudo, y por eso un dia
    perdido se volvia irrecuperable). Esta API no se actualizo junto con ese
    cambio y quedo consultandolos sin filtrar, asi que devolvia una fila por
    cada fecha disponible: /canasta listaba la misma localidad varias veces con
    precios distintos, y como ordena por costo ascendente terminaba rankeando
    combinaciones de localidad-y-dia en vez de localidades.

    Cualquier consulta a un mart que tenga fecha_datos en el grano tiene que
    pasar por aca. Los historicos son la excepcion: ahi las fechas multiples son
    justamente el punto.
    """
    return f"fecha_datos = (SELECT MAX(fecha_datos) FROM `{tabla}`)"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/promos")
def obtener_promos(
    busqueda: Optional[str] = Query(None, description="Buscar en la descripcion del producto"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoria exacta"),
    provincia: Optional[str] = Query(None, description="Filtrar por provincia (ej: AR-B)"),
    limite: int = Query(50, le=200, description="Cantidad maxima de resultados"),
):
    condiciones = []
    parametros = []

    if busqueda:
        condiciones.append("LOWER(descripcion) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))
    if categoria:
        condiciones.append("categoria = @categoria")
        parametros.append(bigquery.ScalarQueryParameter("categoria", "STRING", categoria))
    if provincia:
        condiciones.append("provincia = @provincia")
        parametros.append(bigquery.ScalarQueryParameter("provincia", "STRING", provincia))

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    query = f"""
        SELECT
            descripcion, marca, categoria, rubro, cadena, provincia,
            precio_lista, precio_promo, descuento_pct, leyenda,
            sucursales_con_esta_promo
        FROM `{PROYECTO}.dbt_precios.mart_promos_vigentes`
        {where}
        ORDER BY descuento_pct DESC
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/promos/mapa")
def obtener_promos_mapa(
    busqueda: Optional[str] = Query(None, description="Buscar en la descripcion del producto"),
    provincia: Optional[str] = Query(None, description="Filtrar por provincia (ej: AR-B)"),
    lat_min: Optional[float] = Query(None, description="Limite sur del area visible"),
    lat_max: Optional[float] = Query(None, description="Limite norte del area visible"),
    lng_min: Optional[float] = Query(None, description="Limite oeste del area visible"),
    lng_max: Optional[float] = Query(None, description="Limite este del area visible"),
    limite: int = Query(500, le=6000, description="Cantidad maxima de resultados"),
):
    condiciones = []
    parametros = []

    if busqueda:
        condiciones.append("LOWER(descripcion) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))
    if provincia:
        condiciones.append("provincia = @provincia")
        parametros.append(bigquery.ScalarQueryParameter("provincia", "STRING", provincia))
    if lat_min is not None and lat_max is not None:
        condiciones.append("latitud BETWEEN @lat_min AND @lat_max")
        parametros.append(bigquery.ScalarQueryParameter("lat_min", "FLOAT64", lat_min))
        parametros.append(bigquery.ScalarQueryParameter("lat_max", "FLOAT64", lat_max))
    if lng_min is not None and lng_max is not None:
        condiciones.append("longitud BETWEEN @lng_min AND @lng_max")
        parametros.append(bigquery.ScalarQueryParameter("lng_min", "FLOAT64", lng_min))
        parametros.append(bigquery.ScalarQueryParameter("lng_max", "FLOAT64", lng_max))

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    query = f"""
        SELECT
            descripcion, marca, categoria, rubro, cadena,
            nombre_sucursal, calle, numero, barrio, localidad, provincia,
            latitud, longitud, precio_lista, precio_promo, descuento_pct, leyenda
        FROM `{PROYECTO}.dbt_precios.mart_promos_por_sucursal`
        {where}
        ORDER BY descuento_pct DESC
        LIMIT @limite_consulta
    """
    parametros.append(bigquery.ScalarQueryParameter("limite_consulta", "INT64", limite + 1))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = [dict(fila) for fila in cliente_bq.query(query, job_config=job_config).result()]

    hay_mas = len(resultados) > limite
    resultados = resultados[:limite]

    return {"promos": resultados, "hay_mas": hay_mas}


@app.get("/gama")
def obtener_gama(
    categoria: Optional[str] = Query(None, description="Filtrar por categoria"),
    gama: Optional[str] = Query(None, description="economico, medio o premium"),
    limite: int = Query(50, le=200, description="Cantidad maxima de resultados"),
):
    condiciones = []
    parametros = []

    if categoria:
        condiciones.append("categoria = @categoria")
        parametros.append(bigquery.ScalarQueryParameter("categoria", "STRING", categoria))
    if gama:
        condiciones.append("gama = @gama")
        parametros.append(bigquery.ScalarQueryParameter("gama", "STRING", gama))

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    query = f"""
        SELECT id_producto, categoria, rubro, precio_mediano, gama
        FROM `{PROYECTO}.dbt_precios.mart_gama_productos`
        {where}
        ORDER BY precio_mediano DESC
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/quien-gana")
def obtener_quien_gana(
    categoria: Optional[str] = Query(None, description="Filtrar por categoria exacta"),
):
    tabla = f"{PROYECTO}.dbt_precios.mart_quien_gana"
    condiciones = [solo_ultima_fecha(tabla)]
    parametros = []

    if categoria:
        condiciones.append("categoria = @categoria")
        parametros.append(bigquery.ScalarQueryParameter("categoria", "STRING", categoria))

    where = f"WHERE {' AND '.join(condiciones)}"

    query = f"""
        SELECT categoria, rubro, cadena, productos_ganados, total_productos_categoria, pct_victorias
        FROM `{tabla}`
        {where}
        ORDER BY categoria, pct_victorias DESC
    """

    job_config = bigquery.QueryJobConfig(query_parameters=parametros) if parametros else None
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/quien-gana/categorias")
def obtener_categorias_disponibles():
    tabla = f"{PROYECTO}.dbt_precios.mart_quien_gana"
    query = f"""
        SELECT DISTINCT categoria
        FROM `{tabla}`
        WHERE {solo_ultima_fecha(tabla)}
        ORDER BY categoria
    """
    resultados = cliente_bq.query(query).result()
    return [fila["categoria"] for fila in resultados]


@app.get("/canasta")
def obtener_canasta(
    busqueda: Optional[str] = Query(None, description="Buscar localidad por texto"),
    provincia: Optional[str] = Query(None, description="Filtrar por provincia (ej: AR-B)"),
    limite: int = Query(500, le=2000, description="Cantidad maxima de resultados"),
):
    tabla = f"{PROYECTO}.dbt_precios.mart_canasta_localidad"
    condiciones = ["categorias_disponibles >= 20", solo_ultima_fecha(tabla)]
    parametros = []

    if busqueda:
        condiciones.append("LOWER(localidad) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))
    if provincia:
        condiciones.append("provincia = @provincia")
        parametros.append(bigquery.ScalarQueryParameter("provincia", "STRING", provincia))

    where = f"WHERE {' AND '.join(condiciones)}"

    query = f"""
        SELECT localidad, provincia, categorias_disponibles, costo_canasta_total
        FROM `{tabla}`
        {where}
        ORDER BY costo_canasta_total ASC
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/inflacion")
def obtener_inflacion(
    categoria: Optional[str] = Query(None, description="Filtrar por categoria exacta"),
):
    condiciones = []
    parametros = []

    if categoria:
        condiciones.append("f.categoria = @categoria")
        parametros.append(bigquery.ScalarQueryParameter("categoria", "STRING", categoria))

    where_extra = f"AND {' AND '.join(condiciones)}" if condiciones else ""

    query = f"""
        WITH fechas AS (
            SELECT MIN(fecha_datos) AS fecha_inicio, MAX(fecha_datos) AS fecha_fin
            FROM `{PROYECTO}.dbt_precios.historico_precios_cadena_categoria`
        ),
        inicio AS (
            SELECT categoria, cadena, unidad_normalizada, precio_mediano_unidad AS precio_inicio
            FROM `{PROYECTO}.dbt_precios.historico_precios_cadena_categoria` AS h, fechas
            WHERE h.fecha_datos = fechas.fecha_inicio
        ),
        fin AS (
            SELECT categoria, cadena, unidad_normalizada, precio_mediano_unidad AS precio_fin
            FROM `{PROYECTO}.dbt_precios.historico_precios_cadena_categoria` AS h, fechas
            WHERE h.fecha_datos = fechas.fecha_fin
        )
        SELECT
            f.categoria,
            f.cadena,
            i.precio_inicio,
            f.precio_fin,
            ROUND((f.precio_fin - i.precio_inicio) / i.precio_inicio * 100, 2) AS variacion_pct,
            (SELECT fecha_inicio FROM fechas) AS fecha_inicio,
            (SELECT fecha_fin FROM fechas) AS fecha_fin
        FROM fin AS f
        JOIN inicio AS i
            ON f.categoria = i.categoria
            AND f.cadena = i.cadena
            AND f.unidad_normalizada = i.unidad_normalizada
        WHERE i.precio_inicio > 0
        {where_extra}
        ORDER BY f.categoria, variacion_pct DESC
    """

    job_config = bigquery.QueryJobConfig(query_parameters=parametros) if parametros else None
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/inflacion/categorias")
def obtener_categorias_inflacion():
    query = f"""
        SELECT DISTINCT categoria
        FROM `{PROYECTO}.dbt_precios.historico_precios_cadena_categoria`
        ORDER BY categoria
    """
    resultados = cliente_bq.query(query).result()
    return [fila["categoria"] for fila in resultados]


class DescripcionCanasta(BaseModel):
    descripcion: str


class CalcularCanastaRequest(BaseModel):
    items: list
    localidades: list


@app.post("/canasta-personalizada/interpretar")
def interpretar_canasta_personalizada(datos: DescripcionCanasta):
    return interpretar_descripcion(datos.descripcion)


@app.post("/canasta-personalizada/calcular")
def calcular_canasta_personalizada(datos: CalcularCanastaRequest):
    return calcular_costo_canasta(cliente_bq, datos.items, datos.localidades)


@app.get("/canasta-personalizada/localidades")
def obtener_localidades_disponibles(
    busqueda: Optional[str] = Query(None, description="Buscar localidad por texto"),
    limite: int = Query(50, le=200, description="Cantidad maxima de resultados"),
):
    tabla = f"{PROYECTO}.dbt_precios.mart_canasta_localidad"
    condiciones = ["categorias_disponibles >= 15", solo_ultima_fecha(tabla)]
    parametros = []

    if busqueda:
        condiciones.append("LOWER(localidad) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))

    where = f"WHERE {' AND '.join(condiciones)}"

    query = f"""
        SELECT DISTINCT localidad, provincia
        FROM `{tabla}`
        {where}
        ORDER BY localidad
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]
