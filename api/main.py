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

    # Se ordena por pct_gana_cuando_compite, no por pct_victorias: esta ultima
    # divide por todos los comparables de la categoria y no por los que la
    # cadena ofrece, asi que premia el surtido amplio antes que el precio bajo.
    # Con la tasa correcta el lider cambia en 22 de 58 categorias.
    query = f"""
        SELECT
            categoria, rubro, cadena,
            productos_ganados, productos_ofrecidos, total_productos_categoria,
            pct_gana_cuando_compite, pct_victorias
        FROM `{tabla}`
        {where}
        ORDER BY categoria, pct_gana_cuando_compite DESC
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
    # Ya no se filtra por cobertura: desde el 2026-09-08 el mart emite solo
    # localidades con la canasta completa, que son las unicas comparables entre si.
    tabla = f"{PROYECTO}.dbt_precios.mart_canasta_localidad"
    condiciones = [solo_ultima_fecha(tabla)]
    parametros = []

    if busqueda:
        condiciones.append("LOWER(localidad) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))
    if provincia:
        condiciones.append("provincia = @provincia")
        parametros.append(bigquery.ScalarQueryParameter("provincia", "STRING", provincia))

    where = f"WHERE {' AND '.join(condiciones)}"

    query = f"""
        SELECT localidad, provincia, categorias_en_canasta, costo_canasta_total
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

    tabla = f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria"

    # Se encadenan los factores diarios en vez de restar el nivel de precios de
    # dos fechas. El nivel es la mediana de los productos que hubiera ese dia, y
    # restar dos niveles mezcla cambios de precio con cambios de surtido: medido
    # sobre 564 combinaciones entre el 09-05 y el 09-07, 101 se desviaban mas de
    # un punto y "Bazar y hogar" en Disco daba +75,76% cuando en realidad ningun
    # precio se habia movido. El factor diario se calcula sobre los productos
    # presentes en ambas fechas (ver mart_precios_cadena_categoria).
    query = f"""
        WITH periodo AS (
            SELECT
                MIN(fecha_base) AS fecha_inicio,
                MAX(fecha_datos) AS fecha_fin,
                COUNT(DISTINCT fecha_datos) AS eslabones_esperados
            FROM `{tabla}`
            WHERE factor_vs_base IS NOT NULL
        ),
        encadenado AS (
            SELECT
                categoria,
                cadena,
                unidad_normalizada,
                -- Producto de los factores, via exp(suma de logaritmos).
                EXP(SUM(LN(factor_vs_base))) AS factor_total,
                COUNT(*) AS eslabones,
                MIN(fecha_base) AS desde,
                MAX(fecha_datos) AS hasta
            FROM `{tabla}`
            WHERE factor_vs_base IS NOT NULL
            GROUP BY categoria, cadena, unidad_normalizada
        ),
        nivel_actual AS (
            SELECT h.categoria, h.cadena, h.unidad_normalizada, h.precio_mediano_unidad
            FROM `{tabla}` AS h, periodo
            WHERE h.fecha_datos = periodo.fecha_fin
        )
        SELECT
            e.categoria,
            e.cadena,
            -- La unidad es parte del grano: una cadena puede tener dos filas en
            -- la misma categoria (ej. jugos en cc y en unidad). Sin este campo
            -- se veian dos "Coto" con numeros distintos y sin forma de saber
            -- cual era cual.
            e.unidad_normalizada,
            n.precio_mediano_unidad AS precio_actual,
            ROUND((e.factor_total - 1) * 100, 2) AS variacion_pct,
            p.fecha_inicio,
            p.fecha_fin
        FROM encadenado AS e
        CROSS JOIN periodo AS p
        JOIN nivel_actual AS n
            USING (categoria, cadena, unidad_normalizada)
        -- Solo series con la cadena COMPLETA: tiene que tener un eslabon por
        -- cada fecha del periodo y arrancar y terminar donde arranca y termina
        -- el periodo. Una serie a la que le falta un dia no se puede encadenar,
        -- y multiplicar salteando el hueco daria un numero inventado.
        WHERE e.eslabones = p.eslabones_esperados
            AND e.desde = p.fecha_inicio
            AND e.hasta = p.fecha_fin
        {where_extra.replace("f.categoria", "e.categoria")}
        ORDER BY e.categoria, variacion_pct DESC
    """

    job_config = bigquery.QueryJobConfig(query_parameters=parametros) if parametros else None
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@app.get("/inflacion/categorias")
def obtener_categorias_inflacion():
    # Solo las que tienen factor: una categoria que existe en el historico pero
    # no se puede encadenar aparecia en el desplegable y devolvia cero filas.
    query = f"""
        SELECT DISTINCT categoria
        FROM `{PROYECTO}.dbt_precios.historico_precios_cadena_categoria`
        WHERE factor_vs_base IS NOT NULL
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
    # Se consulta el mart de precios por categoria, que es contra el que
    # realmente cotiza la canasta personalizada, y no el de canasta basica.
    # Salian de ahi por inercia, y desde que ese mart emite solo localidades con
    # la canasta INDEC completa habria dejado al usuario con 31 opciones cuando
    # su canasta a medida se puede calcular en cientos de localidades.
    tabla = f"{PROYECTO}.dbt_precios.mart_precio_categoria_localidad"
    condiciones = [solo_ultima_fecha(tabla)]
    parametros = []

    if busqueda:
        condiciones.append("LOWER(localidad) LIKE @busqueda")
        parametros.append(bigquery.ScalarQueryParameter("busqueda", "STRING", f"%{busqueda.lower()}%"))

    where = f"WHERE {' AND '.join(condiciones)}"

    query = f"""
        SELECT localidad, provincia
        FROM `{tabla}`
        {where}
        GROUP BY localidad, provincia
        HAVING COUNT(DISTINCT categoria) >= 15
        ORDER BY localidad
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]
