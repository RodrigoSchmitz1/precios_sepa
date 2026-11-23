"""Señales anonimas de uso para Changuito Empresas (openspec senales-anonimas).

Que categorias de promos se miran, que productos se piden en avisos y que se
busca, contado de forma anonima: cada evento lleva un identificador al azar que
el telefono cambia cada dia, la zona elegida (provincia y localidad) y el rubro,
la categoria o el producto. No se guarda la IP, ni el texto buscado, ni nada que
permita unir los eventos de una persona de un dia con los de otro.

Escribir no consume cuota: los eventos se juntan en memoria y se suben con
trabajos de carga (load jobs), nunca con consultas. Todo esta apagado salvo que
el servicio tenga SENALES_ACTIVAS=1.
"""

import io
import json
import os
import re
import threading
import time
from collections import deque
from datetime import datetime
from zoneinfo import ZoneInfo

_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")

TIPOS = ("vista_rubro", "aviso_pedido", "aviso_quitado", "busqueda")
CAMPOS_DEL_EVENTO = {"tipo", "rubro", "id_producto", "texto"}
MAXIMO_POR_TANDA = 20
MAXIMO_TEXTO = 80
POR_ID_POR_DIA = 200
POR_IP_POR_HORA = 2000
POR_DIA = 50_000

# El identificador del dia es un UUID que genera el telefono (crypto.randomUUID).
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

DATASET = "sepa_senales"
TABLA = "eventos"
# Cuanto se conserva cada dia de eventos crudos. Los agregados semanales no
# necesitan mas de un año para comparar contra el mismo mes del año anterior.
EXPIRACION_DIAS = 400
VACIAR_CADA_SEGUNDOS = 300
VACIAR_CON_FILAS = 500

ESQUEMA = (
    ("fecha", "DATE"),
    ("tipo", "STRING"),
    ("id_dia", "STRING"),
    ("provincia", "STRING"),
    ("localidad", "STRING"),
    ("rubro", "STRING"),
    ("categoria", "STRING"),
    ("id_producto", "STRING"),
)


def activas() -> bool:
    return os.getenv("SENALES_ACTIVAS") == "1"


def hoy_en_argentina(ahora: float | None = None) -> str:
    return datetime.fromtimestamp(time.time() if ahora is None else ahora, _ARGENTINA).date().isoformat()


def validar_tanda(cuerpo, *, rubros: dict, productos: dict, zonas: set, categoria_de, hoy: str) -> list[dict]:
    """Las filas a guardar de una tanda. Lo que no cumple el formato se descarta.

    rubros: slug -> nombre del rubro (los del indice del mapa).
    productos: id_producto -> producto (el indice de Mismo producto).
    zonas: pares (provincia, nombre) de /zonas.
    categoria_de: texto buscado -> categoria del primer resultado, o None.
    """
    if not isinstance(cuerpo, dict) or set(cuerpo) - {"id", "zona", "eventos"}:
        return []
    id_dia = cuerpo.get("id")
    eventos = cuerpo.get("eventos")
    if not isinstance(id_dia, str) or not _UUID.match(id_dia) or not isinstance(eventos, list):
        return []
    provincia = localidad = None
    zona = cuerpo.get("zona")
    if isinstance(zona, dict) and (zona.get("provincia"), zona.get("nombre")) in zonas:
        provincia, localidad = zona["provincia"], zona["nombre"]

    filas = []
    for evento in eventos[:MAXIMO_POR_TANDA]:
        if not isinstance(evento, dict) or set(evento) - CAMPOS_DEL_EVENTO or evento.get("tipo") not in TIPOS:
            continue
        fila = {"fecha": hoy, "tipo": evento["tipo"], "id_dia": id_dia, "provincia": provincia,
                "localidad": localidad, "rubro": None, "categoria": None, "id_producto": None}
        if evento["tipo"] == "vista_rubro":
            rubro = rubros.get(evento.get("rubro")) if isinstance(evento.get("rubro"), str) else None
            if rubro is None:
                continue
            fila["rubro"] = rubro
        elif evento["tipo"] in ("aviso_pedido", "aviso_quitado"):
            id_producto = evento.get("id_producto")
            producto = productos.get(id_producto) if isinstance(id_producto, str) else None
            if producto is None:
                continue
            fila.update(id_producto=id_producto, categoria=producto.get("categoria"), rubro=producto.get("rubro"))
        else:
            # La busqueda se traduce a una categoria y el texto se descarta aca:
            # no sale de esta funcion.
            texto = evento.get("texto")
            if not isinstance(texto, str) or not texto.strip() or len(texto) > MAXIMO_TEXTO:
                continue
            categoria = categoria_de(texto)
            if not categoria:
                continue
            fila["categoria"] = categoria
        filas.append(fila)
    return filas


class Topes:
    """Por identificador del dia, por IP (ultima hora) y por instancia y dia, en
    memoria. La IP solo vive aca, para frenar un abuso: no se escribe en ningun
    lado. Con varias instancias cada una cuenta lo suyo."""

    def __init__(self, por_id: int = POR_ID_POR_DIA, por_ip_por_hora: int = POR_IP_POR_HORA, por_dia: int = POR_DIA):
        self.por_id, self.por_ip_por_hora, self.por_dia = por_id, por_ip_por_hora, por_dia
        self._dia = ""
        self._por_id: dict[str, int] = {}
        self._total = 0
        self._por_ip: dict[str, deque] = {}
        self._candado = threading.Lock()

    def cuantos(self, id_dia: str, ip: str, pedidos: int, ahora: float | None = None) -> int:
        """Cuantos de los eventos pedidos se aceptan (0 si se paso algun tope)."""
        ahora = time.time() if ahora is None else ahora
        hoy = hoy_en_argentina(ahora)
        with self._candado:
            if hoy != self._dia:
                self._dia, self._por_id, self._total = hoy, {}, 0
            cola = self._por_ip.setdefault(ip, deque())
            while cola and ahora - cola[0] > 3600:
                cola.popleft()
            lugar = min(self.por_id - self._por_id.get(id_dia, 0), self.por_dia - self._total,
                        self.por_ip_por_hora - len(cola))
            aceptados = max(0, min(pedidos, lugar))
            if aceptados:
                self._por_id[id_dia] = self._por_id.get(id_dia, 0) + aceptados
                self._total += aceptados
                cola.extend([ahora] * aceptados)
            return aceptados


class Buffer:
    """Junta filas en memoria y las sube con un load job cada VACIAR_CADA_SEGUNDOS
    o al llegar a VACIAR_CON_FILAS. Si la instancia muere sin apagarse, se
    pierden a lo sumo esos minutos: para contar tendencias semanales alcanza."""

    def __init__(self, proyecto: str, cliente_de):
        self.proyecto = proyecto
        self._cliente_de = cliente_de  # se llama recien al subir: los tests no necesitan BigQuery
        self._filas: list[dict] = []
        self._ultimo = time.time()
        self._candado = threading.Lock()
        self._dataset_listo = False

    def agregar(self, filas: list[dict], ahora: float | None = None) -> None:
        ahora = time.time() if ahora is None else ahora
        with self._candado:
            self._filas.extend(filas)
            hay_que_vaciar = len(self._filas) >= VACIAR_CON_FILAS or ahora - self._ultimo >= VACIAR_CADA_SEGUNDOS
        if hay_que_vaciar:
            threading.Thread(target=self.vaciar, daemon=True).start()

    def pendientes(self) -> int:
        with self._candado:
            return len(self._filas)

    def vaciar(self) -> int:
        """Sube lo que haya. Devuelve cuantas filas subio. Si falla, las devuelve al buffer."""
        with self._candado:
            filas, self._filas = self._filas, []
            self._ultimo = time.time()
        if not filas:
            return 0
        try:
            self._subir(filas)
        except Exception as error:  # noqa: BLE001 - un fallo de BigQuery no puede tirar la API
            print(f"Senales: no se pudieron subir {len(filas)} eventos ({error!r}); se reintenta")
            with self._candado:
                self._filas = filas + self._filas
            return 0
        return len(filas)

    def _subir(self, filas: list[dict]) -> None:
        from google.cloud import bigquery

        cliente = self._cliente_de()
        destino = f"{self.proyecto}.{DATASET}.{TABLA}"
        if not self._dataset_listo:
            dataset = bigquery.Dataset(f"{self.proyecto}.{DATASET}")
            dataset.location = "US"
            dataset.default_partition_expiration_ms = EXPIRACION_DIAS * 24 * 3600 * 1000
            cliente.create_dataset(dataset, exists_ok=True)
            self._dataset_listo = True
        config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            create_disposition=bigquery.CreateDisposition.CREATE_IF_NEEDED,
            schema=[bigquery.SchemaField(nombre, tipo) for nombre, tipo in ESQUEMA],
            time_partitioning=bigquery.TimePartitioning(field="fecha"),
        )
        datos = io.BytesIO("\n".join(json.dumps(f, ensure_ascii=False) for f in filas).encode("utf-8"))
        cliente.load_table_from_file(datos, destino, job_config=config).result()
