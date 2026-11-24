"""La tarjeta de los links compartidos (openspec compartir-por-whatsapp).

WhatsApp, Telegram, Facebook y X arman la vista previa de un link leyendo el
HTML inicial, sin ejecutar JavaScript. El sitio es una SPA: sin esto, todo link
llega con el titulo general y sin imagen. Aca se completa el <head> del
index.html compilado segun la pagina.

Un producto dice su nombre y el rango de precio del pais, NO la cadena mas
barata: esa respuesta depende de la zona de quien abre el link, y su regla vive
en el frontend (utils/titularProducto.ts). Repetirla aca seria tenerla en dos
lugares, y un link compartido desde Palermo y abierto en Rosario nombraria una
cadena que en Rosario no esta.
"""

import html
import re
from urllib.parse import quote

TITULO_GENERAL = "Changuito — Precios de supermercado en Argentina"
DESCRIPCION_GENERAL = (
    "Dónde te conviene comprar: el mismo producto en cada súper de tu zona, "
    "con los precios oficiales de SEPA."
)

# La portada (Promos) y cualquier ruta que no este aca llevan la general.
SECCIONES = {
    "lista": (
        "Mi compra · Changuito",
        "Armá tu compra con los productos que llevás siempre y mirá en qué súper de tu zona te sale menos.",
    ),
    "gastos": (
        "Mis gastos en el súper · Changuito",
        "Sacale una foto al ticket o anotá el total, y mirá cuánto gastás por mes, por súper y por categoría.",
    ),
    "quien-gana": (
        "Qué súper está más barato · Changuito",
        "Qué cadena cobra menos en cada categoría, comparando los mismos productos.",
    ),
    "inflacion": (
        "Cuánto subió la canasta · Changuito",
        "La inflación del súper mes a mes, con lo que aporta cada categoría y cada cadena.",
    ),
    "privacidad": (
        "Privacidad · Changuito",
        "Qué pasa con tus datos en Changuito: casi todo queda en tu teléfono.",
    ),
    "mismo-producto": (
        "El mismo producto en cada súper · Changuito",
        "Buscá un producto y mirá cuánto cuesta en cada cadena de tu zona.",
    ),
}

# Rutas viejas que la app redirige: comparten la tarjeta (y la ruta canonica) de su destino.
# Tu canasta se unio con Mi lista en Mi compra (openspec mi-compra).
ALIAS = {"canasta-personalizada": "lista"}

# La pagina de promos de un rubro: /promos/<slug> (openspec
# promos-navegables-y-mes-en-gastos). El nombre se escribe como nombreRubro del
# frontend (utils/nombres.ts): los rubros con tilde van aca, el resto se
# capitaliza.
RUBRO_EN_RUTA = re.compile(r"^promos/([a-z0-9]+(?:-[a-z0-9]+)*)$")
RUBROS_CON_TILDE = {
    "almacen": "Almacén",
    "bebes": "Bebés",
    "infusiones-y-azucares": "Infusiones y azúcares",
    "lacteos": "Lácteos",
    "panaderia": "Panadería",
    "verduleria-y-frutas": "Verdulería y frutas",
}


def nombre_de_rubro(slug: str) -> str:
    return RUBROS_CON_TILDE.get(slug) or _capitalizar(slug.replace("-", " "))


# Lo que algunas cadenas cargan en el campo de marca cuando no hay marca.
# Igual que NO_SON_MARCAS en frontend/src/utils/texto.ts.
_NO_SON_MARCAS = {"sin marca", "s/m", "generico", "generica", "varios", "varias", "otros", "otras"}


def _capitalizar(palabra: str) -> str:
    return palabra[:1].upper() + palabra[1:]


def nombre_legible(descripcion: str, marca: str | None) -> str:
    """El mismo nombre que muestra la pagina (nombreLegible en
    frontend/src/utils/texto.ts): minusculas, la marca con mayuscula, y la marca
    al final si la descripcion no la dice. Los tests comparan contra los mismos
    ejemplos que los del frontend."""
    de_la_marca = {p for p in (marca or "").lower().split() if len(p) > 1}
    palabras = (descripcion or "").lower().split(" ")
    texto = " ".join(_capitalizar(p) if p in de_la_marca else p for p in palabras)
    significativas = [p for p in de_la_marca if len(p) > 2]
    ya_la_dice = any(p in palabras for p in significativas)
    es_marca = bool(significativas) and (marca or "").strip().lower() not in _NO_SON_MARCAS
    if not ya_la_dice and es_marca:
        texto = f"{texto} · {' '.join(_capitalizar(p) for p in marca.strip().lower().split())}"
    return _capitalizar(texto)


def pesos(valor: float) -> str:
    """"$ 2.490", como formatearPesos del frontend (es-AR, sin decimales)."""
    return "$ " + f"{round(valor):,}".replace(",", ".")


def _fecha_corta(iso: str | None) -> str:
    partes = (iso or "").split("-")
    if len(partes) != 3 or not all(p.isdigit() for p in partes):
        return ""
    return f"{int(partes[2])}/{int(partes[1])}"


def tarjeta_producto(producto: dict) -> tuple[str, str]:
    """Titulo y descripcion de la tarjeta de un producto de Mismo producto.

    Usa los agregados del mart tal cual (precio_mas_bajo, precio_mas_alto,
    cadenas): son los mismos que muestra la pagina."""
    nombre = nombre_legible(producto["descripcion"], producto.get("marca"))
    bajo, alto, cadenas = producto["precio_mas_bajo"], producto["precio_mas_alto"], producto["cadenas"]
    rango = pesos(bajo) if round(bajo) == round(alto) else f"de {pesos(bajo)} a {pesos(alto)}"
    titulo = f"{nombre} · {rango} en {cadenas} cadenas"
    fecha = _fecha_corta(producto.get("fecha_datos"))
    descripcion = "Mirá dónde conviene en tu zona. Precios oficiales de SEPA" + (f" del {fecha}." if fecha else ".")
    return titulo, descripcion


# Una lista compartida viaja entera en el link: /lista?l=<id>x<cant>-<id>...
# (openspec compartir-y-pegar-la-lista). El frontend la lee con las mismas
# reglas (utils/lista.ts, listaDelLink).
ITEM_DE_LISTA = re.compile(r"^\d{4,14}(?:x\d{1,2})?$")
MAXIMO_PRODUCTOS_EN_LINK = 50


def productos_en_link(valor: str | None) -> int:
    """Cuantos productos validos (y distintos) trae el parametro l del link."""
    ids = []
    for item in (valor or "").split("-"):
        if ITEM_DE_LISTA.match(item):
            codigo = item.split("x")[0]
            if codigo not in ids:
                ids.append(codigo)
    return min(len(ids), MAXIMO_PRODUCTOS_EN_LINK)


def tarjeta(ruta: str, id_producto: str | None, producto: dict | None, lista: str | None = None) -> tuple[str, str, str]:
    """(titulo, descripcion, ruta canonica) de la pagina pedida."""
    seccion = ruta.strip("/")
    seccion = ALIAS.get(seccion, seccion)
    cantidad = productos_en_link(lista) if seccion == "lista" else 0
    if cantidad:
        titulo = f"Lista del súper · {cantidad} producto{'s' if cantidad != 1 else ''}"
        descripcion = "Te compartieron una lista: mirá en qué súper de tu zona te sale menos. Precios oficiales de SEPA."
        return titulo, descripcion, f"/lista?l={quote(lista or '', safe='x-')}"
    if seccion == "mismo-producto" and id_producto and producto:
        titulo, descripcion = tarjeta_producto(producto)
        return titulo, descripcion, f"/mismo-producto?p={quote(str(id_producto), safe='')}"
    rubro = RUBRO_EN_RUTA.match(seccion)
    if rubro:
        nombre = nombre_de_rubro(rubro.group(1))
        titulo = f"Promos de {nombre} · Changuito"
        descripcion = f"Las promos de {nombre.lower()} de hoy en los súper de tu zona, con los datos oficiales de SEPA."
        return titulo, descripcion, f"/{seccion}"
    if seccion in SECCIONES:
        titulo, descripcion = SECCIONES[seccion]
        return titulo, descripcion, f"/{seccion}"
    return TITULO_GENERAL, DESCRIPCION_GENERAL, "/"


def _reemplazar(texto: str, patron: str, nuevo: str) -> str:
    resultado, n = re.subn(patron, lambda _: nuevo, texto, count=1)
    return resultado if n else texto


def completar_head(plantilla: str, origen: str, titulo: str, descripcion: str, ruta: str) -> str:
    """El index.html con la tarjeta de la pagina. Todo texto va escapado: el
    codigo llega por la URL y la descripcion viene de los datos de SEPA."""
    t, d = html.escape(titulo, quote=True), html.escape(descripcion, quote=True)
    u = html.escape(origen + ruta, quote=True)
    # El <title> de la pestaña NO se toca: la app no lo actualiza al navegar, y
    # entrar por un link de la yerba dejaria "Playadito..." en la pestaña
    # aunque despues se pase a Inflacion. La tarjeta usa og:title.
    salida = _reemplazar(plantilla, r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{d}" />')
    salida = _reemplazar(salida, r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{t}" />')
    salida = _reemplazar(
        salida, r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{d}" />'
    )
    salida = _reemplazar(salida, r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{u}" />')
    return salida.replace("__ORIGEN__", html.escape(origen, quote=True))


def origen_del_pedido(base_url: str, proto_reenviado: str | None) -> str:
    """"https://host", sin barra final. Cloud Run termina el TLS en su proxy y
    la app ve http: se usa X-Forwarded-Proto, y si no viene, https salvo en
    localhost. Una imagen de tarjeta por http no la muestra nadie."""
    sin_barra = base_url.rstrip("/")
    esquema, _, resto = sin_barra.partition("://")
    host = resto.split("/")[0]
    local = host.split(":")[0] in ("localhost", "127.0.0.1", "[::1]") or host.startswith("testserver")
    if proto_reenviado in ("http", "https"):
        esquema = proto_reenviado.split(",")[0].strip()
    elif not local:
        esquema = "https"
    return f"{esquema}://{host}"
