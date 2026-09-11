import functools
import json
import os
import threading
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from google.api_core.exceptions import GoogleAPICallError
from google.cloud import bigquery
from google.oauth2 import service_account
from pydantic import BaseModel
from typing import Optional
from interpretar_canasta import CATEGORIAS, interpretar_descripcion
from calcular_canasta import calcular_costo_canasta
import mapa_promos

api = FastAPI(title="precios_sepa API")

# Origenes permitidos: en desarrollo el dev server de Vite, en produccion el
# dominio donde quede publicado el frontend. Se pasa por variable de entorno
# separada por comas para no tener que tocar el codigo al desplegar.
ORIGENES = [
    o.strip()
    for o in os.getenv("ORIGENES_PERMITIDOS", "http://localhost:5173").split(",")
    if o.strip()
]

api.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

PROYECTO = "proyecto-precios-504221"


def _crear_cliente_bq() -> bigquery.Client:
    """Resuelve las credenciales segun donde este corriendo, de mas segura a menos.

    1. Credenciales del propio entorno (ADC). Es el camino en Cloud Run: el
       servicio corre COMO una service account, asi que no hace falta que exista
       una clave privada en ningun lado. Es la opcion preferida justamente
       porque no hay material secreto que filtrar.
    2. GCP_SA_KEY, la clave completa en una variable de entorno. Para hostings
       que no son de Google y no tienen forma de asumir una identidad.
    3. El archivo credenciales.json al lado del codigo, que es el desarrollo
       local de siempre.
    """
    if os.getenv("USAR_CREDENCIALES_DEL_ENTORNO") == "1":
        return bigquery.Client(project=PROYECTO)

    clave = os.getenv("GCP_SA_KEY")
    if clave:
        return bigquery.Client(
            credentials=service_account.Credentials.from_service_account_info(
                json.loads(clave)
            ),
            project=PROYECTO,
        )

    return bigquery.Client.from_service_account_json("credenciales.json")

cliente_bq = _crear_cliente_bq()

# ---------------------------------------------------------------------------
# Cache en memoria
#
# Los datos cambian UNA VEZ POR DIA, cuando corre el pipeline, pero cada request
# lanzaba una consulta a BigQuery. El mapa de promos es el caso critico: escanea
# 211,8 MB por request y se dispara cada vez que el usuario mueve el mapa, asi
# que sin cache un rato jugando con el mapa cuesta varios GB.
#
# El TTL es de 6 horas: el pipeline corre una vez al dia, asi que servir un dato
# de hasta 6 horas de antiguedad no cambia nada para el usuario y recorta el
# gasto de forma brutal cuando varias visitas miran la misma zona.
#
# Es cache por proceso, no compartida: si el hosting levanta varias instancias
# cada una tiene la suya. Alcanza de sobra para el trafico de un portfolio, y no
# agrega una dependencia (Redis) que habria que sostener.
# ---------------------------------------------------------------------------
TTL_CACHE_SEGUNDOS = 6 * 3600
_cache: dict = {}


def cachear(fn):
    """Cachea por argumentos. Solo para endpoints cuyo dato cambia una vez al dia.

    Si BigQuery falla al refrescar y hay un valor guardado, se sirve ese valor
    aunque tenga mas de 6 horas. El caso que lo motiva es la cuota diaria: cuando
    se agota, BigQuery rechaza todo hasta la medianoche del Pacifico, y antes de
    esto el sitio respondia 500 aunque tuviera en memoria un dato de hace un rato
    que seguia siendo valido, porque el pipeline actualiza una vez por dia.
    Mostrar el dato de ayer es mejor que mostrar un error; si no hay nada
    guardado, el error sigue su curso y lo responde el manejador de abajo.
    """

    @functools.wraps(fn)
    def envoltorio(*args, **kwargs):
        clave = (fn.__name__, args, tuple(sorted(kwargs.items())))
        ahora = time.time()
        guardado = _cache.get(clave)
        if guardado and ahora - guardado[0] < TTL_CACHE_SEGUNDOS:
            return guardado[1]
        try:
            valor = fn(*args, **kwargs)
        except GoogleAPICallError:
            if guardado:
                return guardado[1]
            raise
        _cache[clave] = (ahora, valor)
        return valor

    return envoltorio


# ---------------------------------------------------------------------------
# Errores de BigQuery
#
# El proyecto tiene una cuota diaria de consultas para que no pueda generar
# costos. Cuando se agota, BigQuery responde 403 con reason "quotaExceeded" y,
# sin manejarlo, FastAPI devolvia "500 Internal Server Error": el sitio parecia
# roto cuando en realidad estaba funcionando el limite que lo protege. Ahora se
# responde 503 con un mensaje que el frontend muestra tal cual, y con la hora a
# la que vuelven los datos.
#
# Cualquier otro error de BigQuery tambien responde 503, pero sin detalles: el
# mensaje interno puede incluir nombres de tablas o del proyecto.
# ---------------------------------------------------------------------------
def _reinicio_de_cuota() -> tuple[str, int]:
    """Hora de Argentina a la que se reinicia la cuota, y segundos que faltan.

    La cuota diaria de BigQuery se reinicia a la medianoche del Pacifico, que en
    Argentina son las 04:00 o las 05:00 segun el horario de verano de EE.UU.
    """
    pacifico = ZoneInfo("America/Los_Angeles")
    ahora = datetime.now(pacifico)
    medianoche = (ahora + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    hora = medianoche.astimezone(ZoneInfo("America/Argentina/Buenos_Aires")).strftime("%H:%M")
    return hora, max(int((medianoche - ahora).total_seconds()), 0)


def _es_cuota_agotada(error: GoogleAPICallError) -> bool:
    detalles = getattr(error, "errors", None) or []
    return any(isinstance(d, dict) and d.get("reason") == "quotaExceeded" for d in detalles)


@api.exception_handler(GoogleAPICallError)
async def responder_error_de_bigquery(request: Request, error: GoogleAPICallError):
    if not _es_cuota_agotada(error):
        return JSONResponse(
            status_code=503,
            content={"detail": "No se pudo consultar la base de datos. Proba de nuevo en unos minutos."},
        )
    try:
        hora, segundos = _reinicio_de_cuota()
        cuando = f"a las {hora} (hora de Argentina)"
        encabezados = {"Retry-After": str(segundos)}
    except Exception:
        cuando = "a la medianoche del Pacifico"
        encabezados = {}
    return JSONResponse(
        status_code=503,
        headers=encabezados,
        content={
            "detail": (
                "El sitio alcanzo el limite diario de consultas a la base de datos, "
                "que existe para que el proyecto no genere costos. Los datos vuelven "
                f"a estar disponibles {cuando}."
            )
        },
    )


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


@api.get("/health")
def health():
    return {"status": "ok"}


@api.get("/promos")
@cachear
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


# ---------------------------------------------------------------------------
# Mapa de promos
#
# Se resuelve en memoria (ver mapa_promos.py). Hasta el 2026-09-11 cada paneo era
# una consulta que escaneaba la tabla entera (0,39 GiB) con un recuadro distinto,
# asi que la cache nunca se reutilizaba y unos 18 paneos agotaban la cuota libre.
# ---------------------------------------------------------------------------
_candado_mapa = threading.Lock()


@cachear
def _cargar_indice_mapa():
    # list_rows lee con tabledata.list: no es una consulta y no consume la cuota.
    sucursales = cliente_bq.list_rows(f"{PROYECTO}.dbt_precios.mart_mapa_sucursales")
    promos = cliente_bq.list_rows(f"{PROYECTO}.dbt_precios.mart_mapa_promos")
    return mapa_promos.armar_indice((dict(f) for f in sucursales), (dict(f) for f in promos))


def _indice_mapa():
    # Sin el candado, dos pedidos a una instancia recien levantada cargarian todo dos veces.
    with _candado_mapa:
        return _cargar_indice_mapa()


@api.get("/promos/mapa")
def obtener_promos_mapa(
    busqueda: Optional[str] = Query(None, description="Buscar en la descripcion del producto"),
    provincia: Optional[str] = Query(None, description="Filtrar por provincia (ej: AR-B)"),
    lat_min: Optional[float] = Query(None, description="Limite sur del area visible"),
    lat_max: Optional[float] = Query(None, description="Limite norte del area visible"),
    lng_min: Optional[float] = Query(None, description="Limite oeste del area visible"),
    lng_max: Optional[float] = Query(None, description="Limite este del area visible"),
    limite: int = Query(500, ge=1, le=6000, description="Cantidad maxima de resultados"),
):
    # Sin @cachear: cada recuadro distinto quedaba guardado para siempre en _cache.
    promos, hay_mas = mapa_promos.buscar(
        _indice_mapa(),
        busqueda=busqueda,
        provincia=provincia,
        lat_min=lat_min,
        lat_max=lat_max,
        lng_min=lng_min,
        lng_max=lng_max,
        limite=limite,
    )
    return {"promos": promos, "hay_mas": hay_mas}


@api.get("/gama")
@cachear
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

    # La unidad va en la respuesta porque es parte del grano: un mismo producto
    # puede tener una gama en gramos y otra por unidad (ver mart_gama_productos).
    query = f"""
        SELECT id_producto, categoria, rubro, unidad_normalizada,
               precio_mediano, precio_por_unidad, gama
        FROM `{PROYECTO}.dbt_precios.mart_gama_productos`
        {where}
        ORDER BY precio_mediano DESC
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@api.get("/quien-gana")
@cachear
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


@api.get("/quien-gana/categorias")
@cachear
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


@api.get("/canasta")
@cachear
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
        SELECT localidad, provincia, categorias_en_canasta, categorias_imputadas,
               costo_canasta_total
        FROM `{tabla}`
        {where}
        ORDER BY costo_canasta_total ASC
        LIMIT @limite
    """
    parametros.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@api.get("/canasta/detalle")
@cachear
def obtener_canasta_detalle(
    localidad: str = Query(..., description="Localidad exacta"),
    provincia: str = Query(..., description="Codigo ISO de provincia, ej AR-C"),
):
    """Desglose de la canasta de una localidad, categoria por categoria.

    Un total de seis cifras sin nada detras es un numero que hay que creer. Con
    el desglose el lector ve de que esta hecho, cuanto pesa cada categoria y
    sobre cuantas observaciones se calculo, y decide por su cuenta si le cierra.
    """
    tabla = f"{PROYECTO}.dbt_precios.mart_canasta_detalle"
    query = f"""
        SELECT
            categoria,
            cantidad_necesaria,
            precio_mediano_unidad,
            costo_categoria,
            muestras,
            origen_precio
        FROM `{tabla}`
        WHERE {solo_ultima_fecha(tabla)}
            AND localidad = @localidad
            AND provincia = @provincia
        ORDER BY costo_categoria DESC
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("localidad", "STRING", localidad),
        bigquery.ScalarQueryParameter("provincia", "STRING", provincia),
    ])
    return [dict(fila) for fila in cliente_bq.query(query, job_config=job_config).result()]


@api.get("/inflacion")
@cachear
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


@api.get("/inflacion/resumen")
@cachear
def obtener_inflacion_resumen():
    """Variacion de mercado por categoria, para leer de un vistazo.

    La pagina antes obligaba a elegir una categoria y mostraba sus cadenas por
    separado. Eso parte las series en grupos chicos y, como la mayoria de los
    precios no se mueve de un dia al otro, casi siempre se veian ceros: habia
    que adivinar que categoria mirar. Este endpoint responde la pregunta al
    reves, que es la que trae al lector: QUE se movio.

    El indice de una categoria es la media geometrica de los factores encadenados
    de todas sus series (cadena x unidad) que tienen la cadena completa. Sin
    datos de volumen de ventas no hay con que ponderar, asi que cada cadena pesa
    igual; se devuelve la cantidad de series para que se vea sobre cuanto se
    calculo.
    """
    tabla = f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria"
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
                EXP(SUM(LN(factor_vs_base))) AS factor_total,
                COUNT(*) AS eslabones,
                MIN(fecha_base) AS desde,
                MAX(fecha_datos) AS hasta
            FROM `{tabla}`
            WHERE factor_vs_base IS NOT NULL
            GROUP BY categoria, cadena, unidad_normalizada
        ),
        completas AS (
            -- Solo series con la cadena entera: a una que le falta un eslabon no
            -- se la puede encadenar, y multiplicar salteando el hueco daria un
            -- numero inventado.
            SELECT e.*
            FROM encadenado AS e, periodo AS p
            WHERE e.eslabones = p.eslabones_esperados
                AND e.desde = p.fecha_inicio
                AND e.hasta = p.fecha_fin
        )
        SELECT
            c.categoria,
            ROUND((EXP(AVG(LN(c.factor_total))) - 1) * 100, 2) AS variacion_pct,
            COUNT(*) AS series,
            COUNT(DISTINCT c.cadena) AS cadenas,
            p.fecha_inicio,
            p.fecha_fin
        FROM completas AS c
        CROSS JOIN periodo AS p
        GROUP BY c.categoria, p.fecha_inicio, p.fecha_fin
        -- Una categoria cubierta por una sola cadena no es "el mercado": es un
        -- supermercado. Publicarla en un ranking de variacion del mercado seria
        -- darle a un dato suelto la autoridad de un agregado. Con el corte en 3
        -- cadenas hoy queda afuera 1 categoria de 54 (Leche en polvo, con 1);
        -- 41 de las 54 tienen 8 cadenas o mas.
        HAVING COUNT(DISTINCT c.cadena) >= 3
        ORDER BY variacion_pct DESC
    """
    return [dict(fila) for fila in cliente_bq.query(query).result()]


class DescripcionCanasta(BaseModel):
    descripcion: str


class CalcularCanastaRequest(BaseModel):
    items: list
    localidades: list


@api.post("/canasta-personalizada/interpretar")
def interpretar_canasta_personalizada(datos: DescripcionCanasta):
    return interpretar_descripcion(datos.descripcion)


@api.post("/canasta-personalizada/calcular")
def calcular_canasta_personalizada(datos: CalcularCanastaRequest):
    return calcular_costo_canasta(cliente_bq, datos.items, datos.localidades)


@api.get("/canasta-personalizada/categorias")
def obtener_categorias_canasta():
    """Categorias que se pueden agregar a mano a Tu canasta.

    Cada una con la unidad en la que se cotiza y una cantidad mensual sugerida.
    Sale del mismo diccionario que usa la IA, asi que lo que se agrega a mano y lo
    que propone el modelo siempre coinciden en la unidad. No consulta BigQuery.
    """
    return [
        {"categoria": nombre, "unidad": datos["unidad"], "cantidad_sugerida": datos["cantidad"]}
        for nombre, datos in sorted(CATEGORIAS.items())
    ]


@api.get("/canasta-personalizada/localidades")
@cachear
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


# ---------------------------------------------------------------------------
# App exterior: sirve el frontend compilado y monta la API bajo /api.
#
# Todo vive en un solo servicio de Cloud Run en vez de separar frontend y API en
# dos plataformas. Al ser el mismo origen no hay CORS que configurar, que es la
# fuente de errores mas comun al desplegar un SPA con su API, y hay una sola URL
# que recordar y mantener.
#
# El prefijo /api no es cosmetico: las rutas de la API y las pantallas del
# frontend se pisaban. "/canasta", "/quien-gana" y "/inflacion" eran las dos
# cosas a la vez, y sin separarlas el navegador recibiria JSON donde espera una
# pagina.
# ---------------------------------------------------------------------------
app = FastAPI(title="precios_sepa")
app.mount("/api", api)

ESTATICOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


@app.get("/{ruta:path}")
def servir_frontend(ruta: str):
    """Sirve el frontend, con el fallback que necesita cualquier SPA.

    Si la ruta corresponde a un archivo real (el bundle, el css, el favicon) se
    devuelve ese archivo. Si no, se devuelve index.html: las rutas como
    /canasta-personalizada no existen en el disco, las resuelve el router de
    React una vez que la pagina cargo. Sin este fallback, entrar directo a una
    URL que no sea la raiz, o recargar estando en una seccion, daria 404.
    """
    archivo = os.path.normpath(os.path.join(ESTATICOS, ruta))
    # Se verifica que el archivo resuelto siga dentro de la carpeta de estaticos:
    # sin esto, una ruta con ".." serviria cualquier archivo del contenedor.
    if ruta and archivo.startswith(ESTATICOS) and os.path.isfile(archivo):
        return FileResponse(archivo)

    indice = os.path.join(ESTATICOS, "index.html")
    if not os.path.isfile(indice):
        # Desarrollo local: el frontend lo sirve Vite en otro puerto y la carpeta
        # static/ solo existe dentro de la imagen. Se responde algo util en vez
        # de reventar con un error de archivo no encontrado.
        return JSONResponse(
            status_code=404,
            content={
                "detalle": "El frontend compilado no esta en esta instancia.",
                "sugerencia": "En desarrollo usa el dev server de Vite; la API vive bajo /api.",
            },
        )
    return FileResponse(indice)
