"""
Promos de bancos y billeteras en supermercados (openspec promos-bancarias).

SEPA no las trae. La fuente son las paginas de descuentos de cada cadena,
curadas a mano en datos/promos_bancarias.json (ver docs/promos-bancarias.md).
Aca se valida cada promo y se filtran las vigentes. Se lee una vez por
instancia: no consulta BigQuery ni a terceros.

Solo hechos y palabras propias: nada de textos legales copiados ni datos de
otros agregadores.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

RUTA = Path(__file__).parent / "datos" / "promos_bancarias.json"

# Las cadenas como las nombra SEPA (y zona.cadenas en el frontend). Una promo
# que nombra otra cosa es un error de tipeo.
CADENAS_CONOCIDAS = {
    "Carrefour", "Market (Carrefour)", "Express (Carrefour)", "Maxi (Carrefour)",
    "Coto", "Dia", "Jumbo", "Disco", "Vea",
    "Changomas", "SuperChangomas", "HiperChangomas",
    "La Anonima", "Topsy (La Anonima)", "Bomba (La Anonima)",
    "Cooperativa Obrera", "Toledo", "Comodin", "Maxi Comodin",
    "La Agricola Regional", "Mariano Max", "Unicoop", "California",
}

DIAS = ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")
MEDIOS = {"credito", "debito", "qr", "billetera", "prepaga"}
TIPOS = {"descuento", "reintegro"}
CANALES = {"sucursal", "online", "ambos"}
PERIODOS_TOPE = {"compra", "dia", "semana", "mes", None}
ACUMULA = {"si", "no", "no_se_sabe"}
OBLIGATORIOS = (
    "id", "cadenas", "entidad", "medio", "dias", "porcentaje", "tipo", "canal",
    "vigente_desde", "vigente_hasta", "fuente", "revisada",
)
_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _fecha(valor) -> date | None:
    if not isinstance(valor, str) or not _FECHA.match(valor):
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def errores_de_promo(promo: dict, hoy: date) -> list[str]:
    """Lo que esta mal en una promo, en palabras. Vacio si esta bien."""
    nombre = promo.get("id") or "(sin id)"
    errores = [f"{nombre}: falta {campo}" for campo in OBLIGATORIOS if promo.get(campo) in (None, "", [])]
    if errores:
        return errores
    desconocidas = [c for c in promo["cadenas"] if c not in CADENAS_CONOCIDAS]
    if desconocidas:
        errores.append(f"{nombre}: cadena desconocida {', '.join(desconocidas)}")
    if any(d not in DIAS for d in promo["dias"]):
        errores.append(f"{nombre}: dia invalido")
    if not isinstance(promo["porcentaje"], (int, float)) or not 1 <= promo["porcentaje"] <= 100:
        errores.append(f"{nombre}: el porcentaje tiene que estar entre 1 y 100")
    if promo["medio"] not in MEDIOS:
        errores.append(f"{nombre}: medio invalido")
    if promo["tipo"] not in TIPOS:
        errores.append(f"{nombre}: tipo invalido")
    if promo["canal"] not in CANALES:
        errores.append(f"{nombre}: canal invalido")
    if promo.get("tope_periodo") not in PERIODOS_TOPE:
        errores.append(f"{nombre}: periodo de tope invalido")
    if promo.get("tope") is not None and (not isinstance(promo["tope"], (int, float)) or promo["tope"] <= 0):
        errores.append(f"{nombre}: el tope tiene que ser un monto positivo")
    if promo.get("acumula", "no_se_sabe") not in ACUMULA:
        errores.append(f"{nombre}: acumula tiene que ser si, no o no_se_sabe")
    desde, hasta, revisada = _fecha(promo["vigente_desde"]), _fecha(promo["vigente_hasta"]), _fecha(promo["revisada"])
    if not desde or not hasta or not revisada:
        errores.append(f"{nombre}: fecha invalida (AAAA-MM-DD)")
    else:
        if hasta < desde:
            errores.append(f"{nombre}: la vigencia termina antes de empezar")
        if revisada > hoy:
            errores.append(f"{nombre}: la fecha de revision es posterior a hoy")
    if not str(promo["fuente"]).startswith("https://"):
        errores.append(f"{nombre}: la fuente tiene que ser una URL https")
    return errores


def errores_del_archivo(promos: list[dict], hoy: date) -> list[str]:
    errores = [e for p in promos for e in errores_de_promo(p, hoy)]
    ids = [p.get("id") for p in promos]
    repetidos = sorted({i for i in ids if ids.count(i) > 1 and i})
    errores += [f"{i}: id repetido" for i in repetidos]
    return errores


def leer(ruta: Path = RUTA) -> list[dict]:
    with open(ruta, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    return datos.get("promos", [])


def vigentes(promos: list[dict], hoy: date) -> dict:
    """Las promos vigentes hoy y la revision mas vieja entre ellas."""
    hoy_texto = hoy.isoformat()
    lista = [
        {**p, "acumula": p.get("acumula", "no_se_sabe")}
        for p in promos
        if p["vigente_desde"] <= hoy_texto <= p["vigente_hasta"]
    ]
    return {"promos": lista, "revisadas_hasta": min((p["revisada"] for p in lista), default=None)}
