---
description: Auditoría completa y de costo cero - auditores en paralelo, verificador que intenta refutar, informe único priorizado. Uso: /auditar [datos|coherencia|frontend|todo] [sección]
argument-hint: [datos|coherencia|frontend|todo] [sección]
---
Argumentos: $ARGUMENTS (por defecto `todo` y todas las secciones).

1. Base de regresión, sin BigQuery: `cd frontend && npm test`, `cd api && SIN_BIGQUERY=1 python -m unittest discover -p "test_*.py"`.
   Si algo falla, eso encabeza el informe y no hace falta seguir.
2. Lanzá EN PARALELO, en un solo mensaje, los auditores que correspondan al foco:
   `auditor-datos`, `auditor-coherencia`, `auditor-frontend`. A cada uno pasale solo
   el foco, la sección y el resultado del paso 1. Nada de contexto de más.
3. Juntá sus tablas, deduplicá por causa raíz y pasale los CRÍTICO y ALTO a
   `verificador-hallazgos`. Lo REFUTADO sale del informe; lo SIN DECIDIR queda marcado.
4. Escribí `docs/auditorias/INFORME_<AAAA-MM-DD>.md`: una tabla
   `ID | Sev | archivo:línea | Problema | Evidencia | Fix mínimo`, máximo 25 filas, más
   "Verificado sin problemas", "No pude verificar" y el total de bytes de BigQuery.
5. No corrijas nada. Preguntá cuáles arreglar. Cada arreglo lleva un test que falle
   antes y pase después; al terminar, repetí solo el auditor afectado.
