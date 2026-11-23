# Design

## Context

- **Todo lo que hace el usuario hoy queda en el teléfono.** Mi compra, Mis gastos y los avisos viven en localStorage, y la API no guarda nada de los visitantes.
- **La API ya tiene un interruptor del mismo tipo.** `FOTOS_DE_TICKETS` apaga la lectura de fotos, y `GET /api/gastos/estado` le dice a la página si está prendida. También tiene topes en memoria por IP y por día (`tickets.Topes`) y lee los marts con la Storage Read API, sin consultas.
- **Los puntos donde medir ya existen:**
  - `PromosRubroPage` (página de una categoría);
  - `BotonAvisame` (único lugar donde se pide un aviso);
  - el formulario "Buscar una promo" de `PromosDelDia`.
- **El menú Más** (`BarraCelular`) es donde van las opciones que no son secciones.
- **Restricciones:**
  - costo cero en BigQuery;
  - Ley 25.326: consentimiento libre, expreso e informado, y registro de la base ante la AAIP;
  - regla de Rodrigo de no gastar ni lanzar nada pago hasta pulir.

## Goals / Non-Goals

**Goals:**
- Dejar la medición implementada, probada y apagada, lista para encender con una variable.
- Que cada evento sea anónimo por construcción: nada en la fila permite volver a la persona.
- Que guardar no cueste consultas, y que los agregados no muestren grupos chicos.

**Non-Goals:**
- Líneas de ticket: llegan con las fotos y con su propio consentimiento.
- Pantallas de Changuito Empresas que usen estos agregados (otro change en ese repo).
- Medir visitas, tiempos o clics en general: solo los tres eventos que sirven a Empresas.

## Decisions

### 1. Interruptor por variable y estado por endpoint
`SENALES_ACTIVAS=1` prende todo, y `GET /api/senales/estado` responde `{activas}`. Es el mismo patrón que las fotos: se prende en el lanzamiento sin recompilar. Con la variable apagada, `POST /api/senales` responde 503 sin leer el cuerpo.

### 2. Identificador al azar que cambia cada día
- **Qué es:** `crypto.randomUUID()` guardado en `changuito.senales.v1` junto con la fecha del día. Al cambiar el día, se genera otro.
- **Para qué:** solo para contar personas por día. Los eventos de distintos días no se pueden unir, así que no hay perfil de nadie y los datos son anónimos, no personales.
- **Alternativa descartada:** un identificador estable con consentimiento explícito. Rodrigo eligió el modelo prendido con aviso porque con un "Sí / No" casi nadie suma. Esconder el "no" o meterlo en condiciones sería engañoso y contrario a la Ley 25.326.
- **Alternativa descartada:** derivarlo de la IP o del navegador, que sería un dato personal.

### 3. Eventos acotados, validados en la API
La app manda tandas de hasta 20 eventos de la forma `{tipo, rubro?, id_producto?, texto?}`, y la API agrega la fecha. El identificador del día, la provincia y la localidad van una vez por tanda.

La API valida cada campo:
- el tipo sale de una lista cerrada (`vista_rubro`, `aviso_pedido`, `aviso_quitado`, `busqueda`);
- el rubro tiene que existir en el índice del mapa;
- el `id_producto` tiene que existir en el índice de Mismo producto;
- la provincia y la localidad tienen que ser una zona conocida.

Lo que no valida se descarta. La búsqueda se traduce en memoria a la categoría del primer resultado del buscador de Mismo producto. Si no hay resultado, el evento se descarta, y el texto nunca se guarda.

### 4. Escritura con load jobs desde un buffer en memoria
- **Cómo:** la API acumula filas en memoria y cada 5 minutos, o al llegar a 500 filas, sube un NDJSON a `sepa_senales.eventos` con `load_table_from_file` (append, partición por fecha). También vacía el buffer al apagar la instancia (lifespan de FastAPI).
- **Por qué:** los load jobs no consumen cuota de consultas. El tope de 1.500 cargas por tabla por día da de sobra con una cada 5 minutos por instancia (máximo 3 instancias).
- **Alternativa descartada:** `insert_rows_json` (streaming clásico), que se cobra.
- **Alternativa descartada por ahora:** la Storage Write API, que es gratis hasta 2 TiB al mes pero pide definir un protobuf. Si el volumen crece, se cambia sin tocar la app.
- **Riesgo aceptado:** si una instancia muere sin apagarse bien, se pierden hasta 5 minutos de eventos. Para contar tendencias semanales alcanza.

### 5. Topes en memoria
Por identificador: 200 eventos por día. Por IP: 2.000 por hora, solo en memoria, para frenar abusos; la IP no se escribe en ningún lado. Por instancia: 50.000 eventos por día. Se reutiliza la forma de `tickets.Topes`.

### 6. Apagar es dejar de mandar
El interruptor del menú Más guarda `apagadas` y descarta la cola. No hace falta una baja ni borrar lo ya mandado: con el identificador del día no se puede saber qué eventos eran de esa persona. La expiración de 400 días del dataset limita cuánto se conserva.

### 7. Agregados en dbt con umbral, deshabilitados hasta encender
- **`mart_senales_rubros`:** semana, provincia, rubro, personas por día (identificadores distintos por día, sumados en la semana) y eventos.
- **`mart_senales_avisos`:** semana, provincia, id_producto, personas por día.
- **`mart_senales_busquedas`:** semana, provincia, categoría buscada, personas por día. Se sumó al implementar: sin él, el evento de búsqueda no se usaba en ningún lado.
- **Umbral:** `HAVING personas >= var('umbral_personas_senales')`, en 10 para empezar.
- **Habilitación:** `enabled: var('senales_activas', false)`, para no gastar una consulta diaria sobre una tabla vacía. Se prende con la variable en `dbt_project.yml` cuando se encienda el servicio. La fuente queda declarada siempre: dbt no revisa que la tabla exista mientras ningún modelo habilitado la lea.
- **Verificado sin dbt local:** el SQL del umbral se corrió en BigQuery sobre filas escritas en la propia consulta (0 bytes): un grupo de 12 personas por día aparece, uno de 4 no, y la misma persona dos veces en un día cuenta una.

### 8. El aviso y la hoja "Más info"
- **Aviso:** una línea debajo de las promos del día, con "Entendido" y "Más info", una sola vez por teléfono.
- **Hoja "Más info"** (`HojaDatosAnonimos`), en palabras simples:
  - qué se cuenta: las categorías que mirás, los avisos que pedís y lo que buscás, traducido a una categoría;
  - qué no se cuenta: nombre, ubicación exacta, IP, tus gastos ni tus tickets; el identificador cambia cada día;
  - para qué: estadísticas agregadas para marcas y súper;
  - el mismo interruptor que el menú Más.

## Risks / Trade-offs

- **[Pocos usuarios al principio]** → Los agregados quedan vacíos hasta pasar el umbral. Es el comportamiento correcto: mostrar grupos chicos sería peor.
- **[Personas por día no son personas por semana]** → Quien entra tres días cuenta tres veces en la semana. Para comparar categorías y productos entre sí alcanza, y es el precio de no tener un perfil de nadie.
- **[Reidentificación]** → No se guarda nada con qué cruzar: ni IP ni ubicación exacta, y el identificador muere cada día. La localidad es la de la zona elegida, que cubre miles de personas.
- **[Pérdida de eventos al reciclar instancias]** → Se acepta, como dice la decisión 4.
- **[Cumplimiento legal]** → Revisar el texto y confirmar que los datos anónimos no requieren registro ante la AAIP es tarea de Rodrigo. El interruptor no se prende sin eso, y queda escrito en las tareas como bloqueante del lanzamiento.

## Migration Plan

1. Implementar y desplegar con la variable apagada: no cambia nada para nadie.
2. En el lanzamiento: revisar el texto (y registrar la base si hiciera falta), crear el dataset `sepa_senales` (lo crea la API la primera vez si no existe, con expiración de 400 días), poner `SENALES_ACTIVAS=1` en el deploy y `senales_activas: true` en dbt.
3. Para volver atrás: sacar la variable. Los eventos guardados quedan y expiran solos.

## Open Questions

- El umbral de 10 personas es un punto de partida. Se revisa con datos reales.
