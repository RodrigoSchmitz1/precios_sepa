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
from fastapi.middleware.gzip import GZipMiddleware
from google.api_core.exceptions import GoogleAPICallError
from google.cloud import bigquery
from google.genai import errors as genai_errors
from google.oauth2 import service_account
from pydantic import BaseModel
from typing import Optional
from interpretar_canasta import CATEGORIAS, interpretar_descripcion
from calcular_canasta import calcular_costo_canasta
import mapa_promos
import mismo_producto
import precios_por_sucursal

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

    # Para los tests en GitHub Actions, que no tienen credenciales y no las
    # necesitan: ningun test consulta BigQuery. Con credenciales anonimas el
    # cliente se crea sin red, y cualquier consulta que se escape falla en vez
    # de gastar cuota.
    if os.getenv("SIN_BIGQUERY") == "1":
        from google.auth.credentials import AnonymousCredentials

        return bigquery.Client(project=PROYECTO, credentials=AnonymousCredentials())

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
            content={"detail": "No se pudo consultar la base de datos. Probá de nuevo en unos minutos."},
        )
    try:
        hora, segundos = _reinicio_de_cuota()
        cuando = f"a las {hora} (hora de Argentina)"
        encabezados = {"Retry-After": str(segundos)}
    except Exception:
        cuando = "a la medianoche del Pacífico"
        encabezados = {}
    return JSONResponse(
        status_code=503,
        headers=encabezados,
        content={
            "detail": (
                "El sitio alcanzó el límite diario de consultas a la base de datos, "
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

    # Se agrupa por producto + cadena + PRECIO, no se listan las filas tal cual.
    #
    # El mart tiene una fila por producto x cadena x provincia, a proposito: el
    # precio de una promo suele variar por region. Pero cuando NO varia, listar
    # las filas crudas repite la misma promo una vez por provincia, y como la
    # lista se ordena por descuento, las primeras pantallas quedan tomadas por
    # dos o tres productos repetidos. Medido el 2026-09-23: de 31 grupos con
    # mas de una provincia, 11 tenian el mismo precio en todas (el repelente de
    # Dia ocupaba 8 filas identicas a $890).
    #
    # Agrupar por precio conserva la variacion real y borra solo la repeticion:
    # ese repelente pasa a 1 fila, y el alfajor de Express, que si cambia de
    # precio entre provincias, pasa de 12 filas a 5 (una por precio distinto).
    #
    # El GROUP BY va en SQL y no en Python para que el LIMIT cuente filas ya
    # agrupadas; si no, pedir 200 devolveria menos de 200 promos visibles y la
    # paginacion de la pagina quedaria corrida.
    query = f"""
        SELECT
            descripcion, marca, categoria, rubro, cadena,
            precio_lista, precio_promo, descuento_pct,
            ANY_VALUE(leyenda) AS leyenda,
            -- Es el mismo para todo el grupo: el nivel se decide por producto y
            -- precio, que son justamente las claves del GROUP BY.
            ANY_VALUE(nivel_evidencia) AS nivel_evidencia,
            -- Representa al grupo la provincia donde mas sucursales la tienen.
            ARRAY_AGG(provincia ORDER BY sucursales_con_esta_promo DESC LIMIT 1)[OFFSET(0)] AS provincia,
            COUNT(DISTINCT provincia) AS provincias,
            SUM(sucursales_con_esta_promo) AS sucursales_con_esta_promo
        FROM `{PROYECTO}.dbt_precios.mart_promos_vigentes`
        {where}
        GROUP BY descripcion, marca, categoria, rubro, cadena,
                 precio_lista, precio_promo, descuento_pct
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


# Filas por pagina cuando leer_tabla (abajo) tiene que caer a list_rows.
#
# Sin este parametro list_rows trae paginas enormes, y la memoria salta mientras
# se decodifican. Medido el 2026-09-23 sobre mart_mismo_producto (200 mil filas),
# solo recorriendolas sin armar nada:
#
#   sin definir   pico 508 MB   59 s
#   20.000        pico 226 MB   66 s
#   5.000         pico  57 MB   77 s
#
# Cloud Run corre este servicio con 512 MiB. Con el default, la carga de Mismo
# producto sola ya se pasaba y el contenedor moria al primer pedido. Con 5.000,
# el peor caso -una instancia recien levantada cargando los dos indices a la
# vez, mas lo que ya retienen y el proceso base- queda cerca de 330 MB. Con
# 20.000 dejaria de entrar. Cuesta unos 18 segundos mas en la primera carga de
# cada instancia, que despues queda en la cache de 6 horas.
FILAS_POR_PAGINA = 5_000


def leer_tabla(tabla, campos=None):
    """Recorre un mart entero, fila por fila como dict, sin consumir cuota.

    Usa la Storage Read API: lee en columnas (Arrow) y en paralelo. Medido el
    2026-09-26 sobre mart_mismo_producto (200 mil filas), desde la PC:

      list_rows de a 5.000    55 s   pico 141 MB
      Storage Read API        3,6 s  pico  92 MB

    Era la espera de la primera visita a El mismo producto o al mapa despues de
    que Cloud Run apagara la instancia. Tampoco consume la cuota de consultas:
    se factura aparte, por bytes leidos, con 300 TiB gratis por mes, y cada
    carga lee unas decenas de MB.

    Si la Storage API falla antes de la primera fila (sin permiso, API
    deshabilitada), se vuelve a list_rows, que anda igual pero lento. Una falla
    a mitad de camino se propaga: reintentar desde cero duplicaria filas.
    """
    try:
        lotes = cliente_bq.list_rows(tabla, selected_fields=campos).to_arrow_iterable(
            bqstorage_client=_cliente_storage())
        primer_lote = next(lotes, None)
    except Exception as error:  # noqa: BLE001 - cualquier falla aca tiene el mismo remedio
        print(f"Storage Read API no disponible para {tabla} ({error!r}); uso list_rows")
        yield from (dict(f) for f in cliente_bq.list_rows(tabla, selected_fields=campos, page_size=FILAS_POR_PAGINA))
        return
    if primer_lote is not None:
        yield from primer_lote.to_pylist()
    for lote in lotes:
        yield from lote.to_pylist()


@functools.lru_cache(maxsize=1)
def _cliente_storage():
    from google.cloud import bigquery_storage

    return bigquery_storage.BigQueryReadClient(credentials=cliente_bq._credentials)


@cachear
def _cargar_indice_mapa():
    # leer_tabla no es una consulta y no consume la cuota.
    sucursales = leer_tabla(f"{PROYECTO}.dbt_precios.mart_mapa_sucursales")
    promos = leer_tabla(f"{PROYECTO}.dbt_precios.mart_mapa_promos")
    return mapa_promos.armar_indice(sucursales, promos)


def _indice_mapa():
    # Sin el candado, dos pedidos a una instancia recien levantada cargarian todo dos veces.
    with _candado_mapa:
        return _cargar_indice_mapa()


@api.get("/promos/lugares")
def obtener_lugares_del_mapa():
    """Localidades y barrios para el buscador que mueve el mapa.

    Sale del indice del mapa, que ya esta en memoria: no consulta BigQuery. La
    lista entera pesa unas decenas de KB y la pagina la filtra al tipear, asi
    que cada letra no es un pedido.
    """
    return mapa_promos.lugares(_indice_mapa())


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
    indice = _indice_mapa()
    promos, hay_mas = mapa_promos.buscar(
        indice,
        busqueda=busqueda,
        provincia=provincia,
        lat_min=lat_min,
        lat_max=lat_max,
        lng_min=lng_min,
        lng_max=lng_max,
        limite=limite,
    )
    # Cada promo trae los numeros de sus sucursales; los datos de cada sucursal
    # viajan una sola vez en "sucursales". Ver mapa_promos._fila.
    # JSONResponse directo y no el dict: FastAPI pasaria cada campo de cada promo
    # por jsonable_encoder, y con 6000 promos eso eran 290 ms, mas que la busqueda
    # entera. Todo lo que arma mapa_promos ya son tipos de JSON.
    return JSONResponse(
        {"promos": promos, "hay_mas": hay_mas, "sucursales": mapa_promos.tabla_de_sucursales(indice, promos)}
    )


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


# /canasta y /canasta/detalle se retiraron el 2026-10-08 junto con la seccion
# Canasta basica (ver frontend/src/components/Presentacion.tsx). La composicion
# sigue: es la base del boton "Empezar con la canasta basica" de Tu canasta.

# Grupos para mostrar la composicion de la canasta. Es presentacion: el orden
# dentro de cada grupo es el de las listas y una categoria que falte aca cae en
# "Otros" en vez de desaparecer.
GRUPOS_CANASTA = {
    "Pan, harinas y almacen": [
        "Pan", "Galletitas saladas", "Galletitas dulces", "Arroz", "Harina", "Fideos",
        "Legumbres", "Azucar", "Dulces y mermeladas",
    ],
    "Frutas y verduras": ["Papa y tuberculos", "Verduras", "Frutas"],
    "Carnes y huevos": ["Carne vacuna", "Pollo", "Pescado", "Achuras y menudencias", "Fiambres", "Huevos"],
    "Lacteos": ["Leche fluida", "Quesos", "Yogur", "Manteca y margarina"],
    "Aceite y condimentos": ["Aceite", "Sal", "Otros condimentos", "Vinagre"],
    "Bebidas e infusiones": ["Gaseosas", "Aguas", "Jugos", "Cerveza", "Vinos y licores", "Cafe", "Yerba mate"],
}


@cachear
def _composicion_canasta():
    # La seed es chica y list_rows no consume cuota.
    filas = {f["categoria"]: dict(f) for f in cliente_bq.list_rows(f"{PROYECTO}.dbt_precios.composicion_canasta")}
    grupos = []
    for grupo, categorias in GRUPOS_CANASTA.items():
        items = [filas.pop(c) for c in categorias if c in filas]
        if items:
            grupos.append({"grupo": grupo, "items": items})
    if filas:
        grupos.append({"grupo": "Otros", "items": sorted(filas.values(), key=lambda f: f["categoria"])})
    return grupos


@api.get("/canasta/composicion")
def obtener_composicion_canasta():
    """Que tiene la canasta basica: cada categoria con su cantidad mensual por adulto.

    Sin esto el visitante veia un total de $243.000 sin saber que compraba con
    eso, y lo comparaba con Tu canasta de una familia entera.
    """
    return _composicion_canasta()


def _ctes_periodo_mensual(tabla: str) -> str:
    """Subconsultas que definen el periodo (un mes) y su cadena de eslabones.

    Las usan los dos endpoints de inflacion. Estaban copiadas en cada uno, y dos
    copias de la misma definicion terminan diciendo cosas distintas. Esperan el
    parametro @mes (DATE, primer dia del mes, o NULL para el mes de la ultima
    fecha cargada).

    EL PERIODO ES UN MES CALENDARIO (2026-10-27). Hasta esa fecha era la cadena
    contigua mas reciente, que arrancaba el 15-09 y crecia un dia por vez. Una
    serie que fallaba un solo dia quedaba afuera para siempre, asi que la
    cobertura se achicaba a medida que se acumulaba historia; y un periodo de 42
    dias no se puede comparar con nada publicado. Un mes se compara con el IPC.

    La cadena se recorre hacia atras desde la ultima fecha del mes siguiendo
    fecha_base, y se corta al llegar al mes anterior: el primer eslabon compara
    el primer dia del mes contra el ultimo del mes anterior, como un indice
    mensual. Si un hueco la corta antes, el periodo arranca despues del hueco y
    desde_inicio_de_mes lo dice: es menos pero es cierto. Nunca se multiplica
    salteando un eslabon que falta.

    Devuelve las CTE sin el WITH: quien la usa arranca con "WITH RECURSIVE".
    """
    return f"""
        eslabones AS (
            SELECT DISTINCT fecha_datos, fecha_base
            FROM `{tabla}`
            WHERE factor_vs_base IS NOT NULL
        ),
        limites AS (
            SELECT ultima, DATE_TRUNC(ultima, MONTH) AS inicio_mes
            FROM (
                SELECT MAX(fecha_datos) AS ultima
                FROM eslabones
                WHERE @mes IS NULL OR DATE_TRUNC(fecha_datos, MONTH) = @mes
            )
        ),
        cadena AS (
            SELECT e.fecha_datos, e.fecha_base
            FROM eslabones AS e
            JOIN limites AS l ON e.fecha_datos = l.ultima
            UNION ALL
            -- El eslabon anterior entra solo si su fecha final sigue dentro del
            -- mes: el que termina en el mes anterior es la base, no un eslabon.
            SELECT e.fecha_datos, e.fecha_base
            FROM eslabones AS e
            JOIN cadena AS c ON e.fecha_datos = c.fecha_base
            JOIN limites AS l ON c.fecha_base >= l.inicio_mes
        ),
        periodo AS (
            SELECT
                MIN(c.fecha_base) AS fecha_inicio,
                MAX(c.fecha_datos) AS fecha_fin,
                COUNT(DISTINCT c.fecha_datos) AS eslabones_esperados,
                ANY_VALUE(l.inicio_mes) AS mes,
                MIN(c.fecha_base) < ANY_VALUE(l.inicio_mes) AS desde_inicio_de_mes
            FROM cadena AS c, limites AS l
        ),
        encadenado AS (
            SELECT
                h.categoria,
                h.cadena,
                h.unidad_normalizada,
                -- Producto de los factores, via exp(suma de logaritmos).
                EXP(SUM(LN(h.factor_vs_base))) AS factor_total,
                COUNT(*) AS eslabones,
                MIN(h.fecha_base) AS desde,
                MAX(h.fecha_datos) AS hasta
            FROM `{tabla}` AS h
            JOIN cadena AS c USING (fecha_datos, fecha_base)
            WHERE h.factor_vs_base IS NOT NULL
            GROUP BY h.categoria, h.cadena, h.unidad_normalizada
        )"""


def _ctes_mercado(tabla: str) -> str:
    """El indice de MERCADO de cada categoria en el periodo: diario y del mes.

    Lo usan el resumen y la incidencia, que tienen que decir lo mismo de cada
    categoria. Cada dia, la categoria es la media geometrica de los factores de
    sus series (cadena x unidad) que tienen dato ese dia, con al menos 3
    cadenas; el mes encadena esos factores diarios (ver obtener_inflacion_resumen).

    Entran todas las unidades. La incidencia las filtraba a la unidad de la
    canasta y la misma pagina mostraba Verduras +4,48% en el ranking y +7,25% en
    la cascada (2026-10-27). La unidad importa para el peso, que es un precio
    por kilo o por litro, pero no para la variacion: cada relativo es de un
    producto contra si mismo.

    Espera las CTE de _ctes_periodo_mensual antes. Devuelve diario y
    por_categoria, sin coma final.
    """
    return f"""
        diario AS (
            SELECT
                h.categoria,
                h.fecha_datos,
                EXP(AVG(LN(h.factor_vs_base))) AS factor,
                COUNT(*) AS series,
                COUNT(DISTINCT h.cadena) AS cadenas
            FROM `{tabla}` AS h
            JOIN cadena AS c USING (fecha_datos, fecha_base)
            WHERE h.factor_vs_base IS NOT NULL
            GROUP BY h.categoria, h.fecha_datos
            HAVING COUNT(DISTINCT h.cadena) >= 3
        ),
        por_categoria AS (
            SELECT
                categoria,
                EXP(SUM(LN(factor))) AS factor_total,
                COUNT(*) AS eslabones,
                CAST(ROUND(AVG(series)) AS INT64) AS series,
                -- El dia mas flaco: "al menos N cadenas todos los dias".
                MIN(cadenas) AS cadenas
            FROM diario
            GROUP BY categoria
        )"""


def armar_incidencia(filas: list[dict]) -> dict:
    """Cuanto aporta cada categoria a la variacion de la canasta del mes.

    Cada fila es una categoria de la canasta con `gasto` (cantidad del INDEC x
    precio al cierre del mes anterior; None si no hay precio) y `factor` (el
    indice de mercado del mes; None si la categoria no se pudo encadenar).

    La canasta es un indice de Laspeyres sobre esas categorias: pesa cada una
    por lo que se gastaba en ella al empezar el mes. La incidencia de una
    categoria es su peso por su variacion, y las incidencias SUMAN exactamente
    la variacion de la canasta: es lo que permite leerla como una cascada.

    Las categorias sin indice no se inventan: quedan afuera, los pesos se
    reparten entre las que si tienen, y la cobertura dice cuanto del gasto se
    midio. Una variacion sobre el 60% del gasto no es la de la canasta.
    """
    con_gasto = [f for f in filas if f["gasto"]]
    gasto_total = sum(f["gasto"] for f in con_gasto)
    medidas = [f for f in con_gasto if f["factor"] is not None]
    gasto_medido = sum(f["gasto"] for f in medidas)
    if not medidas:
        return {"variacion_canasta_pct": None, "cobertura_pct": 0.0, "categorias": [], "sin_indice": sorted(f["categoria"] for f in filas)}

    categorias = []
    for f in medidas:
        peso = f["gasto"] / gasto_medido
        variacion = (f["factor"] - 1) * 100
        categorias.append(
            {
                "categoria": f["categoria"],
                "peso_pct": round(peso * 100, 2),
                "variacion_pct": round(variacion, 2),
                # Puntos porcentuales de la variacion de la canasta.
                "incidencia_pp": round(peso * variacion, 4),
                "cadenas": f["cadenas"],
            }
        )
    categorias.sort(key=lambda c: c["incidencia_pp"], reverse=True)
    variacion_canasta = sum(f["gasto"] / gasto_medido * (f["factor"] - 1) * 100 for f in medidas)
    return {
        "variacion_canasta_pct": round(variacion_canasta, 2),
        "cobertura_pct": round(gasto_medido / gasto_total * 100, 1),
        "categorias": categorias,
        "sin_indice": sorted(f["categoria"] for f in filas if f not in medidas),
    }


def _parametro_mes(mes: Optional[str]) -> bigquery.ScalarQueryParameter:
    """"2026-10" -> DATE 2026-10-01; None deja que la consulta use el ultimo mes."""
    fecha = datetime.strptime(mes, "%Y-%m").date() if mes else None
    return bigquery.ScalarQueryParameter("mes", "DATE", fecha)


PATRON_MES = r"^\d{4}-(0[1-9]|1[0-2])$"


@api.get("/inflacion")
@cachear
def obtener_inflacion(
    categoria: Optional[str] = Query(None, description="Filtrar por categoria exacta"),
    mes: Optional[str] = Query(None, pattern=PATRON_MES, description="AAAA-MM; por defecto, el ultimo"),
):
    condiciones = []
    parametros = [_parametro_mes(mes)]

    if categoria:
        condiciones.append("e.categoria = @categoria")
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
        WITH RECURSIVE {_ctes_periodo_mensual(tabla)},
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
            -- Puede ser nulo desde el 2026-10-27: el factor usa todas las gamas
            -- y el nivel solo la economica, que en una cadena chica puede no
            -- llegar al minimo de muestras.
            n.precio_mediano_unidad AS precio_actual,
            ROUND((e.factor_total - 1) * 100, 2) AS variacion_pct,
            p.fecha_inicio,
            p.fecha_fin
        FROM encadenado AS e
        CROSS JOIN periodo AS p
        LEFT JOIN nivel_actual AS n
            USING (categoria, cadena, unidad_normalizada)
        -- Solo series con la cadena COMPLETA en el mes: un eslabon por cada
        -- fecha del periodo. Una serie a la que le falta un dia no se puede
        -- encadenar, y multiplicar salteando el hueco daria un numero inventado.
        WHERE e.eslabones = p.eslabones_esperados
        {where_extra}
        ORDER BY e.categoria, variacion_pct DESC
    """

    job_config = bigquery.QueryJobConfig(query_parameters=parametros)
    resultados = cliente_bq.query(query, job_config=job_config).result()
    return [dict(fila) for fila in resultados]


@api.get("/inflacion/resumen")
@cachear
def obtener_inflacion_resumen(
    mes: Optional[str] = Query(None, pattern=PATRON_MES, description="AAAA-MM; por defecto, el ultimo"),
):
    """Variacion de mercado por categoria en un mes, para leer de un vistazo.

    La pagina antes obligaba a elegir una categoria y mostraba sus cadenas por
    separado. Eso parte las series en grupos chicos y, como la mayoria de los
    precios no se mueve de un dia al otro, casi siempre se veian ceros: habia
    que adivinar que categoria mirar. Este endpoint responde la pregunta al
    reves, que es la que trae al lector: QUE se movio.

    SE ENCADENA EL MERCADO, NO CADA SERIE (2026-10-27). Cada dia, el factor de
    una categoria es la media geometrica de los factores de sus series (cadena x
    unidad) que tienen dato ESE dia, y el del mes encadena esos factores
    diarios. Antes se encadenaba cada serie por separado y solo entraban las que
    tenian todos los dias: una cadena que faltaba un dia sacaba su serie entera,
    y una categoria sin 3 series completas desaparecia. Asi trabajan los indices
    de precios: el agregado elemental de cada periodo se calcula sobre la
    muestra que hay en ese periodo.

    Sin datos de volumen de ventas no hay con que ponderar, asi que cada serie
    pesa igual. Cada dia la categoria necesita 3 cadenas: con menos, el numero
    no es el mercado sino un supermercado, y ese dia falta el eslabon.
    """
    tabla = f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria"
    query = f"""
        WITH RECURSIVE {_ctes_periodo_mensual(tabla)},
        {_ctes_mercado(tabla)}
        SELECT
            c.categoria,
            ROUND((c.factor_total - 1) * 100, 2) AS variacion_pct,
            c.series,
            c.cadenas,
            p.fecha_inicio,
            p.fecha_fin,
            p.mes,
            p.desde_inicio_de_mes
        FROM por_categoria AS c
        CROSS JOIN periodo AS p
        -- Un eslabon por cada fecha del periodo: una categoria a la que le
        -- falta un dia (menos de 3 cadenas ese dia) no se puede encadenar.
        WHERE c.eslabones = p.eslabones_esperados
        ORDER BY variacion_pct DESC
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[_parametro_mes(mes)])
    return [dict(fila) for fila in cliente_bq.query(query, job_config=job_config).result()]


@api.get("/inflacion/incidencia")
@cachear
def obtener_inflacion_incidencia(
    mes: Optional[str] = Query(None, pattern=PATRON_MES, description="AAAA-MM; por defecto, el ultimo"),
):
    """Cuanto subio la canasta basica en el mes y cuanto aporto cada categoria.

    El ranking de categorias dice que se movio, pero no cuanto pesa: Sal +4% y
    Carne +1% no se pueden sumar. La incidencia los pone en la misma escala,
    puntos de la canasta, ponderando cada categoria por lo que se gasta en ella
    con las cantidades del INDEC (seed composicion_canasta). Es la forma en que
    el INDEC explica el IPC.

    El precio que da el peso es el del cierre del mes anterior (fecha_inicio),
    mediana entre cadenas del nivel de la gama economica, que es la que usa la
    canasta. El indice de cada categoria es el mismo del resumen, con todas sus
    unidades. Lee el historico (unos MB).
    """
    tabla = f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria"
    canasta = f"{PROYECTO}.dbt_precios.composicion_canasta"
    query = f"""
        WITH RECURSIVE {_ctes_periodo_mensual(tabla)},
        {_ctes_mercado(tabla)},
        precio_base AS (
            SELECT
                h.categoria,
                h.unidad_normalizada,
                APPROX_QUANTILES(h.precio_mediano_unidad, 2)[OFFSET(1)] AS precio
            FROM `{tabla}` AS h, periodo AS p
            WHERE h.fecha_datos = p.fecha_inicio
                AND h.precio_mediano_unidad IS NOT NULL
            GROUP BY h.categoria, h.unidad_normalizada
        )
        SELECT
            s.categoria,
            s.cantidad * b.precio AS gasto,
            -- Solo con la cadena entera del mes; si no, la categoria no se mide.
            IF(m.eslabones = p.eslabones_esperados, m.factor_total, NULL) AS factor,
            m.cadenas,
            p.fecha_inicio,
            p.fecha_fin,
            p.mes,
            p.desde_inicio_de_mes
        FROM `{canasta}` AS s
        CROSS JOIN periodo AS p
        LEFT JOIN precio_base AS b
            ON b.categoria = s.categoria AND b.unidad_normalizada = s.unidad
        LEFT JOIN por_categoria AS m
            ON m.categoria = s.categoria
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[_parametro_mes(mes)])
    filas = [dict(fila) for fila in cliente_bq.query(query, job_config=job_config).result()]
    if not filas:
        return None
    periodo = {k: filas[0][k] for k in ("fecha_inicio", "fecha_fin", "mes", "desde_inicio_de_mes")}
    return {**periodo, **armar_incidencia(filas)}


class DescripcionCanasta(BaseModel):
    descripcion: str


class CalcularCanastaRequest(BaseModel):
    items: list
    localidades: list


@api.post("/canasta-personalizada/interpretar")
def interpretar_canasta_personalizada(datos: DescripcionCanasta):
    # El plan gratuito de Gemini admite 15 pedidos por minuto. Pasado eso
    # responde 429, que sin esto llegaba al usuario como un error 500 generico.
    try:
        return interpretar_descripcion(datos.descripcion)
    except genai_errors.APIError as error:
        if error.code == 429:
            return JSONResponse(status_code=503, content={
                "detail": "Hay muchas canastas armándose al mismo tiempo. Probá de nuevo en un minuto, "
                          "o armá la tuya con la canasta básica o eligiendo las categorías a mano."})
        raise


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


# ---------------------------------------------------------------------------
# Optimizar la compra entre sucursales cercanas (Fase 4)
#
# Mismo patron que El mismo producto y que el mapa: la tabla se carga entera con
# leer_tabla (que no consume cuota) y la busqueda pasa en memoria. Optimizar en
# BigQuery seria una consulta por visitante y por cada cambio de radio.
# ---------------------------------------------------------------------------
_candado_sucursales = threading.Lock()

# Tope de items por pedido. La canasta mas grande que arma la IA ronda las 60
# categorias; el limite existe para que un pedido armado a mano no obligue a
# recorrer la zona entera con una lista interminable.
MAXIMO_ITEMS_OPTIMIZAR = 80


@cachear
def _cargar_indice_sucursales():
    return precios_por_sucursal.armar_indice(leer_tabla(f"{PROYECTO}.dbt_precios.mart_precio_categoria_sucursal"))


def _indice_sucursales():
    with _candado_sucursales:
        return _cargar_indice_sucursales()


class OptimizarCompraRequest(BaseModel):
    items: list
    latitud: float
    longitud: float
    radio_km: float = 2.0
    max_sucursales: int = 3


@api.post("/canasta-personalizada/optimizar")
def optimizar_compra_canasta(datos: OptimizarCompraRequest):
    """En que sucursales cercanas conviene comprar la canasta, con 1, 2 o 3 paradas."""
    if not datos.items:
        return JSONResponse(status_code=422, content={"detail": "La canasta está vacía."})
    if len(datos.items) > MAXIMO_ITEMS_OPTIMIZAR:
        return JSONResponse(
            status_code=422,
            content={"detail": f"Son demasiadas categorías: el máximo es {MAXIMO_ITEMS_OPTIMIZAR}."},
        )
    return precios_por_sucursal.optimizar(
        _indice_sucursales(),
        datos.items,
        datos.latitud,
        datos.longitud,
        datos.radio_km,
        datos.max_sucursales,
    )


class CanastaPorCadenaRequest(BaseModel):
    items: list
    localidades: list = []


@api.post("/canasta-personalizada/por-cadena")
def canasta_por_cadena(datos: CanastaPorCadenaRequest):
    """Tu canasta en cada cadena: cuanto sale la compra entera en cada una.

    Sale del mismo indice en memoria que "Donde comprarla": no consulta BigQuery.
    """
    if not datos.items:
        return JSONResponse(status_code=422, content={"detail": "La canasta está vacía."})
    if len(datos.items) > MAXIMO_ITEMS_OPTIMIZAR:
        return JSONResponse(
            status_code=422,
            content={"detail": f"Son demasiadas categorías: el máximo es {MAXIMO_ITEMS_OPTIMIZAR}."},
        )
    items = [i for i in datos.items if isinstance(i, dict)]
    localidades = [l for l in datos.localidades if isinstance(l, dict)][:3]
    return precios_por_sucursal.canasta_por_cadena(_indice_sucursales(), items, localidades)


# Una localidad se ofrece si tiene precio en al menos esta cantidad de
# categorias: con menos, casi cualquier canasta quedaria a medio cotizar.
CATEGORIAS_MINIMAS_LOCALIDAD = 15


@cachear
def _localidades_canasta():
    """Localidades donde se puede cotizar Tu canasta, leidas una vez.

    Hasta el 2026-09-24 cada texto del buscador era una consulta a BigQuery
    (10 MB facturados como minimo, y una clave de cache nueva por cada letra):
    la unica parte de Tu canasta que gastaba cuota por visitante. Ademas
    comparaba con LIKE en minusculas, asi que "cordoba" no encontraba
    "Cordoba" con tilde. Ahora el mart se lee con leer_tabla, que no consume
    cuota, y se busca en memoria con la misma normalizacion que los demas
    buscadores. Sale del mart de precios por categoria, contra el que cotiza
    la canasta, y no del de canasta basica, que solo tiene las localidades con
    la canasta INDEC completa.
    """
    tabla = cliente_bq.get_table(f"{PROYECTO}.dbt_precios.mart_precio_categoria_localidad")
    campos = [c for c in tabla.schema if c.name in ("localidad", "provincia", "categoria", "fecha_datos")]
    filas = list(leer_tabla(tabla, campos))
    return armar_localidades(filas, CATEGORIAS_MINIMAS_LOCALIDAD)


def armar_localidades(filas, categorias_minimas: int) -> list[dict]:
    """Localidades del ultimo dia con precio en suficientes categorias, ordenadas."""
    if not filas:
        return []
    ultima = max(f["fecha_datos"] for f in filas)
    categorias: dict = {}
    for f in filas:
        # Sin provincia no se puede cotizar: calcular la pide para no mezclar
        # localidades homonimas de provincias distintas.
        if f["fecha_datos"] == ultima and f["localidad"] and f["provincia"]:
            categorias.setdefault((f["localidad"], f["provincia"]), set()).add(f["categoria"])
    return [
        {"localidad": loc, "provincia": prov, "_texto": mismo_producto.normalizar(loc)}
        for (loc, prov), cats in sorted(categorias.items())
        if len(cats) >= categorias_minimas
    ]


def filtrar_localidades(localidades: list[dict], busqueda: Optional[str], limite: int) -> list[dict]:
    buscado = mismo_producto.normalizar(busqueda or "").strip()
    elegidas = [l for l in localidades if buscado in l["_texto"]] if buscado else localidades
    return [{"localidad": l["localidad"], "provincia": l["provincia"]} for l in elegidas[:limite]]


@api.get("/canasta-personalizada/localidades")
def obtener_localidades_disponibles(
    busqueda: Optional[str] = Query(None, description="Buscar localidad por texto"),
    limite: int = Query(50, le=200, description="Cantidad maxima de resultados"),
):
    return filtrar_localidades(_localidades_canasta(), busqueda, limite)


# ---------------------------------------------------------------------------
# El mismo producto
#
# La tabla se carga entera y se busca en memoria (ver mismo_producto.py). Los
# tres endpoints comparten la misma carga cacheada, y ninguno consulta BigQuery:
# la tabla se lee con leer_tabla.
#
# Las rutas fijas (/buscar, /destacados) van antes que /{id_producto}: FastAPI
# resuelve en orden de declaracion y si no "buscar" se tomaria como un id.
# ---------------------------------------------------------------------------
_candado_mismo_producto = threading.Lock()


@cachear
def _cargar_indice_mismo_producto():
    # leer_tabla no es una consulta y no consume la cuota. El mart tiene solo el
    # ultimo dia, asi que no hace falta filtrar por fecha.
    return mismo_producto.armar_indice(leer_tabla(f"{PROYECTO}.dbt_precios.mart_mismo_producto"))


def _indice_mismo_producto():
    # Sin el candado, dos pedidos a una instancia recien levantada cargarian la tabla dos veces.
    with _candado_mismo_producto:
        return _cargar_indice_mismo_producto()


@api.get("/mismo-producto/buscar")
def buscar_mismo_producto(
    q: str = Query(..., min_length=2, max_length=80, description="Palabras de la descripcion o la marca"),
    limite: int = Query(20, ge=1, le=50),
):
    return mismo_producto.buscar(_indice_mismo_producto(), q, limite)


class ListaDeProductos(BaseModel):
    items: list


@api.post("/mismo-producto/lista")
def cotizar_lista_de_productos(datos: ListaDeProductos):
    """Tu lista: cuanto sale una lista de productos exactos en cada cadena.

    Sale del mismo indice en memoria que el resto de la seccion, asi que no
    consulta BigQuery por mas listas que se armen.
    """
    if not datos.items:
        return JSONResponse(status_code=422, content={"detail": "La lista está vacía."})
    items = [i for i in datos.items if isinstance(i, dict)]
    return mismo_producto.cotizar_lista(_indice_mismo_producto(), items)


class CategoriasDeTuCanasta(BaseModel):
    categorias: list
    limite: int = 4


@api.post("/mismo-producto/sugeridos")
def sugerir_productos_por_categoria(datos: CategoriasDeTuCanasta):
    """De tu canasta a tu lista: las marcas mas comunes de cada categoria.

    Un solo pedido para toda la canasta, sobre el indice en memoria.
    """
    return mismo_producto.sugeridos_por_categoria(_indice_mismo_producto(), datos.categorias, datos.limite)


@api.get("/mismo-producto/destacados")
def obtener_productos_destacados(limite: int = Query(12, ge=1, le=30)):
    return mismo_producto.destacados(_indice_mismo_producto(), limite)


@cachear
def _empresa_de_cada_cadena() -> dict:
    """Cadena -> empresa, de la seed mapeo_cadenas (las banderas de una misma
    empresa comparten id_comercio). list_rows no consume la cuota."""
    return {
        f["nombre_comercial"]: f["id_comercio"]
        for f in cliente_bq.list_rows(f"{PROYECTO}.dbt_precios.mapeo_cadenas")
    }


@cachear
def _ahorro_por_categoria():
    # Recorre el indice entero (medio segundo con 45 mil productos): se calcula
    # una vez por refresco y no en cada visita.
    return mismo_producto.ahorro_por_categoria(_indice_mismo_producto(), _empresa_de_cada_cadena())


@api.get("/mismo-producto/ahorro")
def obtener_ahorro_por_categoria():
    """Cuanto conviene comparar en cada categoria, quien tiene el precio mas bajo
    y las reglas de precio que lo explican. Ver ahorro_por_categoria."""
    return _ahorro_por_categoria()


@api.get("/mismo-producto/{id_producto}")
def obtener_mismo_producto(id_producto: str):
    resultado = mismo_producto.detalle(_indice_mismo_producto(), id_producto)
    if resultado is None:
        return JSONResponse(
            status_code=404,
            content={"detail": "Ese producto no tiene precio en dos o más cadenas en el último día."},
        )
    return resultado


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

# Comprimir las respuestas (2026-09-23). Sin esto, cada movida del mapa bajaba
# 1,5 MB de JSON con 2000 promos: casi todo son los numeros de sucursal de cada
# una, que se repiten y comprimen 8 a 1 (179 KB). Va en la app exterior para
# que cubra tambien el bundle del frontend, que pasa los 500 KB.
app.add_middleware(GZipMiddleware, minimum_size=1000)

ESTATICOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
CACHE_INMUTABLE = "public, max-age=31536000, immutable"


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
        # Lo de assets/ lleva el hash del contenido en el nombre (lo pone Vite):
        # si cambia el archivo cambia el nombre, asi que se puede guardar para
        # siempre. El resto (favicon, etc.) queda con la heuristica del navegador.
        if ruta.startswith("assets/"):
            return FileResponse(archivo, headers={"Cache-Control": CACHE_INMUTABLE})
        return FileResponse(archivo)

    # Un asset que no existe es un 404, no la pagina. Antes caia en el fallback
    # de abajo y devolvia index.html con 200: el navegador intentaba ejecutar
    # HTML como JavaScript y el sitio quedaba en blanco, sin un error claro.
    # Pasa con un index.html viejo (de antes de un deploy) que pide el bundle
    # anterior, y paso el 2026-09-24 durante el traspaso entre revisiones.
    if ruta.startswith("assets/"):
        return JSONResponse(status_code=404, content={"detalle": "Ese archivo no existe."})

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
    # no-cache no es "no guardar": obliga a revalidar con el ETag en cada visita,
    # que cuesta un 304 sin cuerpo. Sin esto el navegador aplicaba su heuristica
    # y podia seguir usando el index.html de antes de un deploy, que pide un
    # bundle que ya no existe. Safari en iPhone es de los que mas lo guardan.
    return FileResponse(indice, headers={"Cache-Control": "no-cache"})
