from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery
from typing import Optional

app = FastAPI(title="precios_sepa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

cliente_bq = bigquery.Client.from_service_account_json("credenciales.json")

PROYECTO = "proyecto-precios-504221"


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
    limite: int = Query(500, le=2000, description="Cantidad maxima de resultados"),
):
    condiciones = []
    parametros = []

    if busqueda:
        condiciones.append("LOWER(descripcion) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))
    if provincia:
        condiciones.append("provincia = @provincia")
        parametros.append(bigquery.ScalarQueryParameter("provincia", "STRING", provincia))

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    query = f"""
        SELECT
            descripcion, marca, categoria, rubro, cadena,
            nombre_sucursal, calle, numero, barrio, localidad, provincia,
            latitud, longitud, precio_lista, precio_promo, descuento_pct, leyenda
        FROM `{PROYECTO}.dbt_precios.mart_promos_por_sucursal`
        {where}
        ORDER BY descuento_pct DESC
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


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
    condiciones = []
    parametros = []

    if categoria:
        condiciones.append("categoria = @categoria")
        parametros.append(bigquery.ScalarQueryParameter("categoria", "STRING", categoria))

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    query = f"""
        SELECT categoria, rubro, cadena, productos_ganados, total_productos_categoria, pct_victorias
        FROM `{PROYECTO}.dbt_precios.mart_quien_gana`
        {where}
        ORDER BY categoria, pct_victorias DESC
    """

    job_config = bigquery.QueryJobConfig(query_parameters=parametros) if parametros else None
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/quien-gana/categorias")
def obtener_categorias_disponibles():
    query = f"""
        SELECT DISTINCT categoria
        FROM `{PROYECTO}.dbt_precios.mart_quien_gana`
        ORDER BY categoria
    """
    resultados = cliente_bq.query(query).result()
    return [fila["categoria"] for fila in resultados]
