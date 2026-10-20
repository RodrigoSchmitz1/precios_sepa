"""
Dispara la transformacion (pipeline_diario.yml) apenas la ingesta carga algo.

POR QUE (2026-10-20). El cron de GitHub no garantiza horario: la corrida
programada para las 08:37 ART arranco entre las 11:20 y las 14:40 del 14 al
19-10. Los datos que la PC cargo a las 07:00 llegaban a la app a la tarde, y
los dias de trabajo manual la corrida encontraba la cuota ya gastada. Con este
disparo la transformacion arranca a los pocos minutos de la carga.

El cron queda como respaldo: si el disparo falla (sin token, sin red, GitHub
caido), la corrida programada procesa las mismas fechas mas tarde. Por eso un
disparo fallido avisa en el log pero no hace fallar la ingesta. Y si el disparo
anduvo, la programada se saltea sola: hay_que_transformar.py ya no encuentra
fechas pendientes. El workflow tiene concurrency, asi que las dos nunca corren
a la vez.

EL TOKEN. Un fine-grained personal access token de GitHub, solo para el repo
precios_sepa y con el permiso "Actions: Read and write", guardado en
github_token.txt al lado de este script (esta en .gitignore, igual que
credenciales.json). No se usa el del administrador de credenciales de git: la
tarea programada corre sin sesion interactiva y ese token tiene permisos sobre
todos los repos. Se copia a mano en cada PC, como credenciales.json.
"""

import os

import requests

CARPETA = os.path.dirname(os.path.abspath(__file__))
ARCHIVO_TOKEN = os.path.join(CARPETA, "github_token.txt")
URL = ("https://api.github.com/repos/RodrigoSchmitz1/precios_sepa"
       "/actions/workflows/pipeline_diario.yml/dispatches")
RAMA = "main"


def leer_token(ruta=ARCHIVO_TOKEN):
    """El token del archivo, o None si no esta o esta vacio."""
    try:
        with open(ruta, encoding="utf-8") as archivo:
            return archivo.read().strip() or None
    except FileNotFoundError:
        return None


def disparar(token, post=requests.post):
    """Pide la corrida. Devuelve (ok, detalle); nunca levanta excepcion."""
    try:
        respuesta = post(
            URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={"ref": RAMA},
            timeout=30,
        )
    except requests.RequestException as error:
        return False, f"sin conexion con GitHub ({type(error).__name__})"
    # 204 sin cuerpo es el exito documentado del endpoint.
    if respuesta.status_code == 204:
        return True, "transformacion disparada"
    return False, f"GitHub respondio {respuesta.status_code}: {respuesta.text[:200]}"


def disparar_si_hay_token(ruta=ARCHIVO_TOKEN, post=requests.post):
    """Lo que llama la ingesta: imprime el resultado y devuelve si anduvo."""
    token = leer_token(ruta)
    if token is None:
        print("  (sin github_token.txt: la transformacion queda para el cron)")
        return False
    ok, detalle = disparar(token, post)
    if ok:
        print(f"  OK: {detalle}")
    else:
        print(f"  AVISO: no se pudo disparar la transformacion, {detalle}. "
              "Queda para la corrida programada.")
    return ok


if __name__ == "__main__":
    disparar_si_hay_token()
