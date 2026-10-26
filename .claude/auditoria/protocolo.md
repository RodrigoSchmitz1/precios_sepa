# Protocolo común de auditoría

Lo aplican todos los agentes de `.claude/agents/`. No lo repitas en tu respuesta.

## Costo cero (antes que cualquier otra cosa)

El proyecto vive en el nivel gratuito de BigQuery y tiene una cuota diaria dura. Una
auditoría no puede ser la razón de un cargo ni de que el pipeline del día no entre.

1. Nunca corras `dbt run`, `dbt build`, `dbt seed`, `dbt snapshot` ni nada que escriba.
   `dbt test` solo si te lo piden explícitamente.
2. Toda consulta a BigQuery pasa primero por `bq query --dry_run --use_legacy_sql=false`.
   Si el dry run supera **200 MB**, no la corras: reformulala o reportala como
   "No pude verificar". Al correrla, siempre con `--maximum_bytes_billed=209715200`.
3. Consultá solo marts e históricos (`dbt_precios.mart_*`, tablas chicas). Las tablas
   crudas de SEPA (`stg_*` y las de ingesta) están prohibidas: una lectura completa
   cuesta más que todo el resto de la auditoría.
4. Anotá los bytes de cada consulta. El total va al cierre de tu respuesta.
5. Si no hay credenciales o el dry run falla, seguí con lo que se puede verificar
   sin BigQuery (código, tests, API local con `SIN_BIGQUERY=1`). No pidas permisos.

## Secretos

No abras `credenciales.json`, `github_token.txt`, `.env` ni nada bajo `orquestacion/scripts/`
que no sea `.py`. Si un hallazgo los involucra, nombrá el archivo, no su contenido.

## Eficiencia

1. No leas archivos completos. Ubicá con `grep -n` y leé el tramo con `sed -n 'A,Bp'`.
2. `frontend/dist/`, `node_modules/`, `venv/`, `target/` y `package-lock.json` no se leen.
3. Un hallazgo por causa raíz, no diez síntomas de lo mismo.
4. Solo lectura: ningún agente edita el proyecto. Los casos de prueba van a archivos
   temporales fuera del repo.

## Regla de evidencia

Reportá solo lo que puedas respaldar con una línea de código, un valor calculado o una
ejecución. Lo demás va marcado **SOSPECHA**, con la comprobación que lo confirmaría.
Cero falsos positivos por especulación: un hallazgo falso le cuesta más al proyecto
que uno que se escapa, porque enseña a no creerle a la auditoría.

## Formato de salida (estricto, sin preámbulo)

Una tabla, máximo 15 filas, de mayor a menor severidad:

`ID | Sev | archivo:línea | Problema (1 línea) | Evidencia (valor concreto) | Fix mínimo (1 línea)`

Severidades:
- **CRÍTICO**: el sitio publica un número falso, o se filtra un secreto, o se arriesga cuota.
- **ALTO**: un número correcto pero engañoso (comparación no comparable, empate escondido,
  unidad mezclada), o una sección que se rompe con datos reales.
- **MEDIO**: borde que hoy no ocurre pero la fuente puede mandar; inconsistencia de texto.
- **BAJO**: prolijidad.

Cierre, en tres líneas:
`Verificado sin problemas: …` · `No pude verificar: … (por qué)` · `BigQuery: N consultas, X MB`.
