"""
Ingesta auto-reparable de SEPA.

Detecta que fechas de la ventana reciente no fueron capturadas todavia y baja
y carga cada una. Reemplaza al "bajar siempre ayer": si un dia el pipeline no
corre (maquina apagada, portal caido), ese dia se recupera solo en la corrida
siguiente en vez de perderse para siempre.

Una fecha se considera capturada si aparece en el crudo (sepa.productos) o en
el historico (que es permanente). Chequear las dos cosas cubre los dos casos:
recien cargada pero todavia sin transformar, y transformada hace dias con el
crudo ya expirado.

RETENCION: sepa.productos retiene 3 dias (decision de costo). Eso choca de
frente con el backfill: BigQuery expira una particion apenas su fecha queda
fuera de la ventana, y el barrido tarda MENOS DE UN MINUTO. Medido el
2026-09-22: una particion del 15/09 cargada 14:07 ya no existia 14:08.

Hasta esa medicion este script cargaba fechas viejas, imprimia "Cargadas:
[...]" y BigQuery las borraba enseguida. El 2026-09-20 reporto exito sobre el
17/09 y esa fecha nunca llego al historico: perdida silenciosa con cara de
exito. Por eso ahora hace dos cosas mas:

  - ajusta la retencion ANTES de cargar, para que la fecha mas vieja en juego
    sobreviva hasta que dbt la capture (ver ajustar_retencion);
  - verifica DESPUES de cargar que las particiones sigan ahi, y falla si no
    (ver verificar_cargadas).

La retencion vuelve sola a 3 dias en cuanto los historicos alcanzan al crudo,
asi que no hay que acordarse de restaurar nada.

Sigue conviniendo correr dbt enseguida: el margen es de dias, no infinito.
"""

import argparse
import glob
import os
import shutil
import subprocess
import sys
from datetime import date, timedelta

from google.cloud import bigquery
from google.cloud.exceptions import NotFound

import disparar_pipeline

CARPETA = os.path.dirname(os.path.abspath(__file__))
CREDENCIALES = "credenciales.json"
PROYECTO = "proyecto-precios-504221"
TABLA_CRUDA = f"{PROYECTO}.sepa.productos"
# Crudo hermano de SEPA mayoristas (openspec sumar-mayoristas): mismo detalle,
# misma particion y la misma retencion que el crudo minorista.
TABLA_CRUDA_MAYORISTAS = f"{PROYECTO}.sepa.productos_mayoristas"
TABLAS_HISTORICO = [
    f"{PROYECTO}.dbt_precios.historico_quien_gana",
    f"{PROYECTO}.dbt_precios.historico_precios_cadena_categoria",
]

# Las copias del crudo que arma dbt, con su propia retencion (3 dias en su
# config). Tienen que retener lo mismo que el crudo mientras haya fechas en
# vuelo. El 2026-09-28 el 25/09 llego tarde (el portal estuvo caido del 26 al
# 27): el crudo lo retuvo, pero en stg_productos el 24/09 ya habia vencido, y el
# indice de inflacion necesita la fecha anterior para comparar. El 25 y el 28
# quedaron sin factor y la cadena de la pagina de inflacion se corto en el 24.
TABLAS_DERIVADAS = [
    f"{PROYECTO}.dbt_precios.stg_productos",
    f"{PROYECTO}.dbt_precios.int_precio_producto_cadena",
]

# Se revisan los 7 dias que publica SEPA, no los 3 que retiene el crudo. Antes
# el default era 3 porque una fecha mas vieja no sobrevivia al barrido de
# particiones; con la retencion dinamica de ajustar_retencion si sobrevive, asi
# que ya no hay motivo para mirar menos de lo que el portal ofrece.
#
# Importa: el 2026-09-16 y el 17 se perdieron justamente aca. La maquina estuvo
# apagada del 16 al 19; cuando volvio a correr, el 20, la ventana de 3 dias solo
# alcanzaba hasta el 17. Con 7 dias esa corrida habria recuperado toda la semana
# sola. Una semana de vacaciones ahora se repara sin intervencion.
VENTANA_DIAS = 7

# Lo que la tabla retiene en regimen normal. ajustar_retencion nunca baja de
# aca: es la decision de costo original (3 dias de crudo son ~4,4 GB).
RETENCION_BASE_DIAS = 3

# Dias de aire que se le dan a dbt para capturar una fecha recuperada antes de
# que el crudo la suelte. dbt corre una vez por dia, asi que con 1 alcanzaria
# si nunca fallara. Son 3 porque si falla: el 18, 19 y 20 de septiembre de 2026
# fallaron tres corridas seguidas (el crudo habia quedado vacio y los marts
# compilaban DATE('None')). Con margen 1 o 2 esas fechas se habrian perdido
# igual. Cada dia extra cuesta una particion mas de crudo, ~1,45 GB, y solo
# mientras haya un backfill en vuelo.
MARGEN_DBT_DIAS = 3


def parsear_argumentos():
    parser = argparse.ArgumentParser(description="Ingesta SEPA con backfill automatico.")
    parser.add_argument(
        "--dias",
        type=int,
        default=VENTANA_DIAS,
        help=f"Cuantos dias hacia atras revisar (default {VENTANA_DIAS}, el maximo que publica SEPA)",
    )
    parser.add_argument(
        "--simular",
        action="store_true",
        help="Solo informar que fechas faltan, sin descargar ni cargar nada",
    )
    return parser.parse_args()


def fechas_en_tabla(cliente, tabla, desde):
    """Fechas distintas presentes en una tabla desde una fecha dada. Vacio si no existe."""
    try:
        cliente.get_table(tabla)
    except NotFound:
        print(f"  (la tabla {tabla} no existe todavia)")
        return set()

    query = f"SELECT DISTINCT fecha_datos FROM `{tabla}` WHERE fecha_datos >= @desde"
    config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("desde", "DATE", desde)]
    )
    return {fila.fecha_datos for fila in cliente.query(query, job_config=config).result()}


def fechas_con_particion(cliente, tabla, desde):
    """Lo mismo que fechas_en_tabla, pero leyendo la lista de particiones.

    Es metadata y no consume cuota; la consulta de fechas_en_tabla costaba
    ~0,24 GiB por corrida (medido el 2026-09-26), sobre todo por el crudo. Que
    sea gratis es lo que permite que la tarea programada reintente varias veces
    por dia cuando el portal no responde. Las tablas estan particionadas por
    fecha_datos, asi que cada particion es una fecha con filas.

    La verificacion de despues de cargar sigue usando la consulta: ahi importa
    ver las filas recien escritas, no la metadata.
    """
    try:
        particiones = cliente.list_partitions(tabla)
    except NotFound:
        print(f"  (la tabla {tabla} no existe todavia)")
        return set()
    fechas = set()
    for particion in particiones:
        if particion.isdigit():  # afuera __NULL__ y __UNPARTITIONED__
            fecha = date(int(particion[:4]), int(particion[4:6]), int(particion[6:]))
            if fecha >= desde:
                fechas.add(fecha)
    return fechas


def retencion_actual_dias(cliente):
    """Dias de retencion configurados hoy en el crudo. Sin limite -> un numero
    grande, para que quien lo use mire toda la tabla."""
    ms = cliente.get_table(TABLA_CRUDA).time_partitioning.expiration_ms
    return 3650 if ms is None else ms // (24 * 60 * 60 * 1000)


def calcular_faltantes(cliente, dias, hoy):
    """
    Fechas de la ventana que no estan ni en el crudo ni en el historico.

    Devuelve (faltantes, en_crudo, en_historico): los dos conjuntos salen de
    aca porque main los necesita para calcular la retencion, y volver a
    consultarlos costaria otra vuelta a BigQuery.
    """
    # Dos horizontes distintos, a proposito:
    #
    # - ventana: que fechas son candidatas a descargar. Es la del parametro,
    #   acotada por lo que publica SEPA.
    # - desde: hasta donde hay que MIRAR. Tiene que cubrir todo lo que el crudo
    #   pueda estar reteniendo, no solo la ventana, porque ajustar_retencion
    #   decide con estos conjuntos. Si una fecha recuperada por un backfill
    #   anterior ya salio de la ventana pero sigue en el crudo esperando a dbt,
    #   mirarla de menos la haria pasar por "nada en riesgo" y la retencion se
    #   cerraria encima justo antes de capturarla.
    retencion = retencion_actual_dias(cliente)
    desde = hoy - timedelta(days=max(dias, retencion + MARGEN_DBT_DIAS))
    ventana = [hoy - timedelta(days=n) for n in range(dias + 1)]

    en_crudo = fechas_con_particion(cliente, TABLA_CRUDA, desde)

    # Union de los historicos: cada uno arranco en una fecha distinta, asi
    # que mirar uno solo marcaria como faltantes fechas que si fueron procesadas.
    en_historico = set()
    for tabla in TABLAS_HISTORICO:
        en_historico |= fechas_con_particion(cliente, tabla, desde)

    capturadas = en_crudo | en_historico

    def listar(fechas):
        return ", ".join(f.isoformat() for f in sorted(fechas)) if fechas else "ninguna"

    print(f"  En el crudo:      {listar(en_crudo)}")
    print(f"  En los historicos: {listar(en_historico)}")

    # Ordenadas de mas vieja a mas nueva: las viejas son las que estan por
    # caerse de la ventana de publicacion de SEPA, asi que van primero.
    faltantes = sorted(f for f in ventana if f not in capturadas)
    return faltantes, en_crudo, en_historico


def fechas_en_riesgo(en_crudo, en_historico, entrantes=frozenset()):
    """
    Fechas que van a estar en el crudo y todavia no llegaron a los historicos.

    Son las unicas que una retencion corta puede destruir: el historico es
    permanente, asi que lo que ya llego ahi puede caerse del crudo sin drama.
    'entrantes' son las que esta corrida esta por cargar, que todavia no figuran
    en el crudo pero van a figurar en un rato.
    """
    return (set(en_crudo) | set(entrantes)) - set(en_historico)


def dias_de_retencion(en_riesgo, hoy):
    """
    Cuantos dias tiene que retener el crudo para no perder nada en vuelo.

    Pura a proposito: aca viven las aristas (conjunto vacio, fechas de hoy, el
    piso de costo) y asi se prueban sin tocar BigQuery. Ver
    test_ingesta_backfill.py.
    """
    if not en_riesgo:
        return RETENCION_BASE_DIAS

    edad = (hoy - min(en_riesgo)).days

    # El margen se aplica SOLO a fechas que la ventana normal ya no cubre. Una
    # fecha de ayer no necesita nada extra: con los 3 dias de siempre vive hasta
    # pasado manana, o sea que dbt tiene varias corridas para capturarla.
    #
    # Sumarle el margen igual seria un error caro y silencioso: un dia normal
    # pediria 4 dias de retencion y el crudo quedaria con una particion de mas
    # (~1,45 GB) para siempre, subiendo el piso de almacenamiento sin que nadie
    # lo pida. La ventana se abre cuando hace falta, no por las dudas.
    if edad < RETENCION_BASE_DIAS:
        return RETENCION_BASE_DIAS

    return edad + MARGEN_DBT_DIAS


def tablas_con_retencion():
    """
    (nombre, tabla) de todo lo que retiene la misma ventana que el crudo: el
    crudo minorista, el de mayoristas y sus copias en dbt (ver TABLAS_DERIVADAS).

    El de mayoristas sigue al minorista porque dbt los transforma juntos: una
    fecha recuperada tiene que estar en los dos hasta que llegue a la historia.
    """
    return [("crudo", TABLA_CRUDA), ("crudo mayoristas", TABLA_CRUDA_MAYORISTAS)] + [
        (t.rsplit(".", 1)[1], t) for t in TABLAS_DERIVADAS
    ]


def fechas_mayoristas_faltantes(en_crudo, en_crudo_mayoristas, ya_procesadas=frozenset()):
    """
    Fechas que estan en el crudo minorista y faltan en el de mayoristas.

    Pasa cuando el recurso de mayoristas fallo o todavia no estaba el dia que se
    cargo minoristas. Se recuperan solo esas: una fecha que ya no esta en el
    crudo minorista no se puede transformar con los dos juntos, y cargarla
    sola solo agregaria una particion que vence sin llegar a ningun lado.
    'ya_procesadas' son las que esta corrida acaba de bajar con minoristas.
    Ordenadas de la mas vieja a la mas nueva.
    """
    return sorted(set(en_crudo) - set(en_crudo_mayoristas) - set(ya_procesadas))


def ajustar_retencion(cliente, en_riesgo, hoy):
    """
    Deja la retencion del crudo en el minimo que no pierda datos en vuelo.

    "En vuelo" es toda fecha que va a estar en el crudo y todavia no llego a los
    historicos. Si BigQuery la expira antes de que dbt la capture, se pierde: los
    historicos son la unica copia permanente y SEPA solo publica 7 dias.

    La cuenta es la distancia hasta la fecha mas vieja en riesgo mas el margen
    para dbt. Sin nada en riesgo, RETENCION_BASE_DIAS.

    Que tambien BAJE es la mitad importante. En cuanto los historicos alcanzan al
    crudo la ventana se cierra sola y el almacenamiento vuelve a lo de siempre;
    sin eso, un backfill dejaria la tabla inflada hasta que alguien se acuerde de
    restaurarla a mano, que es justo el tipo de paso que nadie se acuerda.
    """
    objetivo = dias_de_retencion(en_riesgo, hoy)
    motivo = (f"la mas vieja sin capturar es {min(en_riesgo)}" if en_riesgo
              else "no queda nada sin capturar")

    # El crudo, el de mayoristas y sus copias en dbt con la misma ventana.
    for nombre, tabla_id in tablas_con_retencion():
        try:
            tabla = cliente.get_table(tabla_id)
        except NotFound:
            continue
        actual_ms = tabla.time_partitioning.expiration_ms
        objetivo_ms = objetivo * 24 * 60 * 60 * 1000
        if actual_ms == objetivo_ms:
            print(f"  Retencion de {nombre}: {objetivo} dias (sin cambios)")
            continue
        actual = "sin limite" if actual_ms is None else f"{actual_ms // (24 * 60 * 60 * 1000)} dias"
        tabla.time_partitioning.expiration_ms = objetivo_ms
        # update_table con el campo entero: expiration_ms vive dentro de
        # time_partitioning, no es un campo propio de la tabla.
        cliente.update_table(tabla, ["time_partitioning"])
        print(f"  Retencion de {nombre}: {actual} -> {objetivo} dias ({motivo})")


def verificar_cargadas(cliente, fechas, tabla=TABLA_CRUDA):
    """
    Confirma que las fechas recien cargadas siguen en el crudo. Devuelve las que
    no estan.

    No es paranoia. BigQuery expira particiones de forma asincronica, asi que un
    load job puede terminar OK y la particion desaparecer segundos despues. Sin
    este chequeo el script canta exito sobre datos que ya no existen, que es
    exactamente como se perdio el 2026-09-17.
    """
    presentes = fechas_en_tabla(cliente, tabla, min(fechas))
    return sorted(f for f in fechas if f not in presentes)


def hay_datos_descargados(prefijo="sepa"):
    """True si quedo al menos una carpeta prefijoN/ con datos para cargar
    (sepaN/ de minoristas o mayoristaN/ de mayoristas)."""
    return any(
        os.path.isdir(c) for c in glob.glob(os.path.join(CARPETA, prefijo + "[0-9]*"))
    )


def borrar_carpetas(prefijo):
    """Borra las carpetas prefijoN/ que hayan quedado de otra corrida."""
    for carpeta in glob.glob(os.path.join(CARPETA, prefijo + "[0-9]*")):
        if os.path.isdir(carpeta):
            shutil.rmtree(carpeta)


def correr_codigo(script, *extra):
    """Ejecuta un script hermano con el mismo interprete. Devuelve el codigo de salida."""
    comando = [sys.executable, os.path.join(CARPETA, script), *extra]
    return subprocess.run(comando, cwd=CARPETA).returncode


def correr(script, *extra):
    """Como correr_codigo, pero devuelve True si salio bien."""
    return correr_codigo(script, *extra) == 0


# Lo que devuelve cargar_datos.py cuando minoristas se cargo y mayoristas fallo
# (cargar_datos.SALIDA_FALLO_MAYORISTAS; no se importa para no cargar el
# cliente de BigQuery dos veces).
SALIDA_FALLO_MAYORISTAS = 3


def resultado_de_la_carga(codigo, hay_mayoristas):
    """
    Traduce el codigo de salida de cargar_datos.py a (minoristas, mayoristas),
    cada uno 'ok', 'sin_datos' o 'error'. Pura, para probarla sin subprocesos.
    """
    if codigo == 0:
        return "ok", ("ok" if hay_mayoristas else "sin_datos")
    if codigo == SALIDA_FALLO_MAYORISTAS:
        return "ok", "error"
    return "error", "error" if hay_mayoristas else "sin_datos"


def procesar_fecha(fecha):
    """
    Descarga y carga una fecha, minoristas y mayoristas juntos.
    Devuelve (minoristas, mayoristas), cada uno 'ok', 'sin_datos' o 'error'.

    Mayoristas no frena a minoristas: si su descarga falla, se carga minoristas
    solo y la fecha de mayoristas se recupera en la corrida siguiente (ver
    fechas_mayoristas_faltantes).
    """
    print(f"\n--- {fecha} ---")

    if not correr("descargar_sepa.py", "--fecha", fecha.isoformat()):
        print(f"  ERROR en la descarga de {fecha}")
        return "error", "sin_datos"

    if not hay_datos_descargados():
        print(f"  SEPA no tiene datos publicados para {fecha}; se omite")
        return "sin_datos", "sin_datos"

    descarga_mayoristas = correr("descargar_sepa.py", "--dataset", "mayoristas", "--fecha", fecha.isoformat())
    if not descarga_mayoristas:
        print(f"  ERROR en la descarga de mayoristas de {fecha}: se carga minoristas solo")
        # Si la descarga murio antes de limpiar, quedarian las carpetas de otra
        # fecha y cargar_datos.py las subiria con esta (la leccion del 08-09).
        borrar_carpetas("mayorista")
    hay_mayoristas = descarga_mayoristas and hay_datos_descargados("mayorista")
    if descarga_mayoristas and not hay_mayoristas:
        print(f"  (SEPA mayoristas todavia no publico {fecha}; queda para la corrida siguiente)")

    minoristas, mayoristas = resultado_de_la_carga(
        correr_codigo("cargar_datos.py", "--fecha", fecha.isoformat()), hay_mayoristas
    )
    if not descarga_mayoristas:
        mayoristas = "error"
    if minoristas == "error":
        print(f"  ERROR en la carga de {fecha}")
    else:
        print(f"  OK: {fecha} cargada (mayoristas: {mayoristas})")
    return minoristas, mayoristas


def procesar_fecha_mayoristas(fecha):
    """Recupera solo los mayoristas de una fecha cuyo minorista ya esta cargado.
    Devuelve 'ok', 'sin_datos' o 'error'."""
    print(f"\n--- {fecha} (solo mayoristas) ---")
    if not correr("descargar_sepa.py", "--dataset", "mayoristas", "--fecha", fecha.isoformat()):
        print(f"  ERROR en la descarga de mayoristas de {fecha}")
        return "error"
    if not hay_datos_descargados("mayorista"):
        print(f"  SEPA mayoristas no tiene datos publicados para {fecha}; se omite")
        return "sin_datos"
    # --solo-mayoristas no toca sucursales ni comercio: volver a cargarlas
    # pisaria la foto anterior que usa la deteccion de cambios.
    if not correr("cargar_datos.py", "--fecha", fecha.isoformat(), "--solo-mayoristas"):
        print(f"  ERROR en la carga de mayoristas de {fecha}")
        return "error"
    print(f"  OK: mayoristas de {fecha} cargados")
    return "ok"


def main():
    args = parsear_argumentos()
    cliente = bigquery.Client.from_service_account_json(CREDENCIALES)

    hoy = date.today()
    print(f"=== Ingesta SEPA con backfill (ventana: {args.dias} dias) ===\n")
    faltantes, en_crudo, en_historico = calcular_faltantes(cliente, args.dias, hoy)
    # Que fechas tiene el crudo de mayoristas (metadata, gratis). Mirar mas
    # atras que el crudo minorista no cambia nada: solo se recuperan fechas que
    # estan en los dos (ver fechas_mayoristas_faltantes).
    en_crudo_mayoristas = fechas_con_particion(cliente, TABLA_CRUDA_MAYORISTAS, min(en_crudo, default=hoy))

    if faltantes:
        print(f"\nFechas faltantes: {', '.join(f.isoformat() for f in faltantes)}")
    else:
        print("\nNo falta ninguna fecha de minoristas.")
    pendientes_mayoristas = fechas_mayoristas_faltantes(en_crudo, en_crudo_mayoristas, faltantes)
    if pendientes_mayoristas:
        print(f"Mayoristas faltantes (minorista ya cargado): "
              f"{', '.join(f.isoformat() for f in pendientes_mayoristas)}")

    if args.simular:
        print("(modo simulacion: no se descarga ni carga nada)")
        return 0

    if not faltantes and not pendientes_mayoristas:
        print("Nada que hacer.")
        # Se ajusta igual: si un backfill anterior dejo la ventana abierta y dbt
        # ya capturo esas fechas, este es el momento en que se cierra sola.
        ajustar_retencion(cliente, fechas_en_riesgo(en_crudo, en_historico), hoy)
        return 0

    # La ventana se abre ANTES de cargar y contando las fechas que estan por
    # entrar. Si se abriera despues no serviria de nada: el barrido de
    # particiones tarda menos de un minuto.
    ajustar_retencion(cliente, fechas_en_riesgo(en_crudo, en_historico, faltantes), hoy)

    resultados = {f: procesar_fecha(f) for f in faltantes}
    resultados_mayoristas = {f: procesar_fecha_mayoristas(f) for f in pendientes_mayoristas}

    ok = [f for f, (r, _) in resultados.items() if r == "ok"]
    sin_datos = [f for f, (r, _) in resultados.items() if r == "sin_datos"]
    errores = [f for f, (r, _) in resultados.items() if r == "error"]
    mayoristas = {f: m for f, (_, m) in resultados.items()}
    mayoristas.update(resultados_mayoristas)
    ok_mayoristas = sorted(f for f, m in mayoristas.items() if m == "ok")
    errores_mayoristas = sorted(f for f, m in mayoristas.items() if m == "error")

    # Recien aca se sabe si "cargada" quiere decir algo. Antes de este chequeo el
    # resumen era una promesa: decia OK aunque BigQuery ya hubiera expirado la
    # particion.
    desaparecidas = verificar_cargadas(cliente, ok) if ok else []
    if desaparecidas:
        ok = [f for f in ok if f not in desaparecidas]
    desaparecidas_mayoristas = (
        verificar_cargadas(cliente, ok_mayoristas, TABLA_CRUDA_MAYORISTAS) if ok_mayoristas else []
    )
    if desaparecidas_mayoristas:
        ok_mayoristas = [f for f in ok_mayoristas if f not in desaparecidas_mayoristas]

    # La ventana se abrio contando TODAS las faltantes, porque antes de bajarlas
    # no se sabe cuales existen. Ahora si: se recalcula con las que entraron de
    # verdad. Sin esto, una fecha que SEPA nunca publico (el 26 y el 27/09 de
    # 2026, con el portal caido) dejaba la retencion abierta hasta que salia de
    # la ventana de 7 dias: el 30/09 el crudo y sus copias sumaban 9,85 GiB,
    # contra los 10 GiB de almacenamiento gratuito.
    ajustar_retencion(cliente, fechas_en_riesgo(en_crudo, en_historico, ok), hoy)

    def listar(fechas):
        return [str(f) for f in fechas] or "ninguna"

    print("\n=== Resumen ===")
    print(f"  Cargadas:      {listar(ok)}")
    print(f"  Sin datos:     {listar(sin_datos)}")
    print(f"  Con error:     {listar(errores)}")
    print(f"  Mayoristas cargadas:  {listar(ok_mayoristas)}")
    print(f"  Mayoristas con error: {listar(errores_mayoristas)}")

    if desaparecidas or desaparecidas_mayoristas:
        print(f"  DESAPARECIDAS: {listar(desaparecidas)}; mayoristas: {listar(desaparecidas_mayoristas)}")
        print("    Se cargaron y BigQuery las expiro antes de que dbt las capturara.")
        print("    Revisa la retencion del crudo: ajustar_retencion deberia haberla")
        print("    abierto lo suficiente. Mientras SEPA las siga publicando se pueden")
        print("    reintentar; despues de eso, no.")

    if ok or ok_mayoristas:
        # Aunque otras fechas hayan fallado: las que entraron conviene
        # transformarlas ya, antes de que la retencion corta las alcance.
        print("\nDisparando la transformacion para que estas fechas lleguen a los historicos...")
        disparar_pipeline.disparar_si_hay_token()

    falla = errores or desaparecidas or errores_mayoristas or desaparecidas_mayoristas
    return 1 if falla else 0


if __name__ == "__main__":
    sys.exit(main())
