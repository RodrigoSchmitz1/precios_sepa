# Tasks

## 1. API

- [x] 1.1 Escribir `api/senales.py`: lista cerrada de tipos, validación de cada evento contra los índices en memoria (rubros del mapa, productos de Mismo producto, zonas), traducción de la búsqueda a categoría sin guardar el texto, y topes por identificador, IP e instancia; verificar con `api/test_senales.py` (tipo desconocido, campo de más, rubro inexistente, búsqueda sin resultado, búsqueda que guarda la categoría y no el texto, topes).
- [x] 1.2 Buffer en memoria con vaciado por tiempo o tamaño mediante `load_table_from_file` (NDJSON, append, partición por fecha), creación del dataset `sepa_senales` con expiración de 400 días si no existe, y vaciado en el lifespan de FastAPI; verificar con tests que usan un cliente de BigQuery falso (sin `query`, solo cargas).
- [x] 1.3 Exponer `GET /api/senales/estado` y `POST /api/senales` detrás de `SENALES_ACTIVAS`; verificar con tests que apagado responde 503 sin tocar el buffer, que encendido guarda solo lo válido y que no se guarda la IP.

## 2. Frontend

- [x] 2.1 Escribir `utils/senales.ts`: interruptor (prendidas por defecto, `apagadas` guardado), aviso visto, identificador con `crypto.randomUUID` que cambia cada día, cola con envío en tandas por `sendBeacon` (y `fetch` con keepalive de respaldo); verificar con `senales.test.ts` (apagadas no manda y vacía la cola, prendidas manda en tandas, otro día otro identificador, almacenamiento bloqueado no rompe).
- [x] 2.2 Crear el aviso de una línea de Promos ("Entendido" / "Más info", una sola vez) y `HojaDatosAnonimos` (qué se cuenta, qué no, para qué, interruptor), solo con `/api/senales/estado` activo; verificar con tests de vitest (servicio apagado no aparece, Entendido lo esconde, Más info abre la hoja, el interruptor apaga).
- [x] 2.3 Sumar el interruptor "Datos anónimos" en el menú Más (un toque, sin confirmación); verificar con `BarraCelular.test.tsx`.
- [x] 2.4 Mandar los eventos desde `PromosRubroPage` (vista_rubro), `BotonAvisame` (aviso_pedido / aviso_quitado) y la búsqueda de `PromosDelDia` (busqueda), con la provincia y la localidad de la zona; verificar con tests que apagadas no se encola nada y prendidas se encola el evento correcto.

## 3. dbt

- [x] 3.1 Declarar la fuente `sepa_senales.eventos` y los marts `mart_senales_rubros`, `mart_senales_busquedas` y `mart_senales_avisos` en personas por día con `umbral_personas_senales`, deshabilitados con `senales_activas: false`; verificar corriendo el SQL en BigQuery sobre filas escritas en la consulta (0 bytes): grupo bajo el umbral no aparece, la misma persona en un día cuenta una. Sin unit tests de dbt: un unit test de un modelo deshabilitado podría romper el parseo de la corrida diaria.

## 4. Cierre

- [x] 4.1 Correr los tests de la API, de la orquestación y del frontend, lint y build; desplegar con la variable apagada solo con el OK de Rodrigo y verificar que la app no ofrece nada y `POST /api/senales` responde 503.
- [x] 4.2 Anotar en `docs/DECISIONES.md` el diseño (load jobs, identificador que cambia cada día, umbral) y en `DEPLOY.md` cómo encender (`SENALES_ACTIVAS=1` en `--set-env-vars`, `senales_activas: true` en dbt).

## Workflow follow-up

- Antes de encender (bloqueante): revisar el texto del aviso y de "Más info", y confirmar que los datos anónimos no requieren registro ante la AAIP (Rodrigo).
- En el lanzamiento: deploy con `SENALES_ACTIVAS=1`, `senales_activas: true` en dbt, y revisar los agregados después de la primera semana.
- Más adelante: líneas de ticket con su propio consentimiento cuando se prendan las fotos.
