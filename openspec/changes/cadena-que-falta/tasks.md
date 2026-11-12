# Tasks

## 1. dbt: arrastre en Mismo producto

- [x] 1.1 Agregar `dias_maximos_arrastre: 2` a `dbt_project.yml`, comentado junto a la retención de 3 días de `int_precio_producto_cadena`; verificar que `dbt parse` pasa
- [x] 1.2 Hacer un dry run de `mart_mismo_producto` compilado y anotar los bytes antes del cambio
- [x] 1.3 Cambiar la CTE `precios` de `mart_mismo_producto` para arrastrar las cadenas que faltan en la última fecha desde su fecha más reciente dentro del tope, y sumar `fecha_precio` a la salida; verificar con un dry run que los bytes extra son decenas de MB y no GiB
- [x] 1.4 Agregar a `_mismo_producto_unit_tests.yml` el caso de 3 fechas (se arrastra la que falta el último día, no la de hace 3 días, no se duplica la presente); verificar que `dbt test --select mart_mismo_producto` pasa
- [x] 1.5 Agregar `tests/arrastre_dentro_del_tope.sql` leyendo la misma variable; verificar que pasa sobre el mart nuevo y que fallaría con el tope en 0 si hay una cadena arrastrada
- [x] 1.6 Correr el SELECT compilado del mart como consulta de solo lectura (el unico target de dbt es producción) y verificar con `leer_tabla` que, si la fecha todavía lo permite, Jumbo, Disco y Vea aparecen con `fecha_precio` del día anterior; si no, que ninguna fila tiene `fecha_precio` distinto de `fecha_datos`

## 2. API

- [x] 2.1 Llevar `fecha_precio` al índice de Mismo producto y al detalle de un producto, y agregar la función de cadenas de otro día; verificar con un test en `api/` sobre un índice armado a mano (ninguna, una, tres cadenas)
- [x] 2.2 Exponer `/datos/cadenas-de-otro-dia` con caché; verificar con TestClient la forma de la respuesta
- [x] 2.3 Pasar `/quien-gana` y `/quien-gana/categorias` a `quien_gana_entre` sobre el índice con todas las cadenas, con las mismas columnas, el mismo orden y el filtro por categoría; verificar con tests de forma y con el oráculo contra `mart_quien_gana` leído con `leer_tabla` (mismo ganador y porcentajes en todas las categorías de un día completo)

## 3. Frontend

- [x] 3.1 Agregar a `client.ts` la llamada nueva y el formato de fecha `AAAA-MM-DD` → `10/11` sin `new Date`; verificar con Vitest
- [x] 3.2 Crear `AvisoCadenasDeOtroDia` con el texto para una, dos y tres o más cadenas; verificar con Vitest que no se muestra con la lista vacía
- [x] 3.3 Poner el aviso en Mismo producto, Más barato y la portada, y "precio del dd/mm" en las filas arrastradas de Mismo producto; verificar a 414 px (en el panel del navegador, Chromium; no se corrió WebKit), con la API local sobre el resultado real del mart nuevo del 11-11, que entra sin desborde y sin errores de consola

## 4. Documentación e integración

- [x] 4.1 Completar en docs/DECISIONES.md ("Datos que se pierden en silencio") cómo quedó: dónde vive el arrastre y por qué no en la tabla intermedia, el tope, los nombres, y Más barato desde el índice
- [x] 4.2 Correr los tests de API y frontend, tsc y eslint; verificar que todo pasa
- [x] 4.3 Validar el cambio con `openspec validate cadena-que-falta --strict` si el CLI está disponible; si no, revisar a mano que cada requirement tenga al menos un scenario

## Workflow follow-up

- Mostrar el resultado a Rodrigo antes de commitear; desplegar solo con su OK.
- Archivar el cambio (`/openspec-archive-change`) después del deploy.
