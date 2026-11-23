# Tasks

## 1. Barra nueva y menú "Más"

- [x] 1.1 En `Layout.tsx`, armar la barra del celular Promos | Buscar | Mi lista | Mis gastos | Más y sumar "Mis gastos" al menú de la computadora; verificar con un test de Vitest que la barra tiene esas cinco entradas en ese orden y que "Mi lista" sigue mostrando el contador.
- [x] 1.2 Agregar la hoja "Más" (Más barato, Tu canasta, Inflación, Cómo se calcula), que se cierra al elegir y deja "Más" marcado en esas rutas; verificar con un test que tocar "Más" → "Más barato" navega a `/quien-gana` y marca "Más".
- [x] 1.3 Agregar la ruta `/gastos` en `router.tsx` con una página provisoria; verificar que `/gastos` responde y que `/quien-gana`, `/canasta-personalizada` e `/inflacion` siguen funcionando por su dirección.
- [x] 1.4 Revisar a 375 y 414 px con Playwright WebKit que la barra no desborda, que cada botón mide al menos 44 px de alto y que la hoja "Más" queda sobre el mapa; guardar las capturas.

## 2. Lectura del ticket en la API

- [x] 2.1 Crear `api/tickets.py` con las constantes (`MAXIMO_FOTOS`, `TOLERANCIA_PRECIO_CANDIDATO`, `CANDIDATOS_POR_LINEA`, `COBERTURA_MINIMA_COMPARACION`, `TICKETS_POR_HORA_POR_IP`, `TICKETS_POR_DIA`) y el esquema de respuesta de lectura; verificar con un test que la respuesta armada solo contiene los campos del esquema aunque el modelo devuelva DNI o tarjeta.
- [x] 2.2 Transcribir como fixtures de texto (sin datos personales) los cuatro tickets públicos vistos (Carrefour, Coto, Jumbo, Día) en el formato que devuelve el paso de lectura; verificar que los tests los cargan.
- [x] 2.3 Implementar el paso de lectura con Gemini (`gemini-flash-lite-latest`, JSON con esquema, varias fotos en un pedido, sin escribir la imagen en disco ni en registros); verificar con tests con Gemini simulado que dos fotos del mismo ticket se unen sin líneas repetidas y que un error 429 termina en 503 "Probá de nuevo en un minuto".
- [x] 2.4 Leer al iniciar la tabla CUIT → cadenas desde `stg_comercio` con la Storage Read API y reconocer la cadena por CUIT o, si falta, por nombre; verificar con tests que el CUIT de Coto da Coto, el de Carrefour da la familia Carrefour y un nombre sin CUIT también se reconoce.

## 3. Vínculo con SEPA

- [x] 3.1 Vincular por código (13 dígitos, 14 con cero adelante; nunca los que empiezan con 2) contra el índice de Mismo producto; verificar con los fixtures de Carrefour, Coto y Jumbo que todas sus líneas con código quedan vinculadas y que el pesable de Coto no.
- [x] 3.2 Armar candidatos para las líneas sin código (misma cadena, precio dentro de la tolerancia, ordenados por palabras en común) e implementar el paso de elegir con Gemini (candidato o "ninguno", y categoría de la lista del sitio); verificar con Gemini simulado que el fixture de Día termina vinculado o en Bebidas, y que "ART VARIOS 1" queda en "Otros".
- [x] 3.3 Exponer `POST /api/gastos/leer-ticket` (JSON con fotos en base64, tope de fotos y de tamaño, topes por IP y diario) que devuelve ticket, líneas vinculadas, descuentos y las constantes que usa el frontend; verificar con `TestClient` las respuestas 200, 413 (cuerpo grande), 422 (más de 3 fotos) y 429 (tope por IP), y con un mock de BigQuery que ningún pedido dispara una consulta.

## 4. Mis gastos en el teléfono

- [x] 4.1 Crear `utils/gastos.ts` (leer, guardar, borrar uno, borrar todos, detectar duplicado por cadena + comprobante + fecha + total, tope de 500, aviso aceptado) con todos los accesos a `localStorage` envueltos; verificar con Vitest el duplicado, el tope y que un `localStorage` que tira error no rompe.
- [x] 4.2 Calcular los resúmenes (mes elegido, contra el mes anterior, por súper, por categoría, ahorro en promos, "Sin detalle" para los gastos a mano) sin `new Date("AAAA-MM-DD")`; verificar con Vitest el ejemplo de la spec (noviembre $ 180.000, +20 % contra octubre).
- [x] 4.3 Cargar fotos: elegir o sacar de 1 a 3, achicarlas en el teléfono (1.600 px, JPEG 0,8), mostrar el aviso la primera vez y mandar; verificar con Vitest que el aviso aparece solo la primera vez y que una foto de 4.000 px sale con el lado largo de 1.600.
- [x] 4.4 Pantalla de revisión: corregir cadena, fecha y total, sacar líneas, aviso cuando la suma no cierra, aviso de duplicado y confirmar para guardar; verificar con Vitest el caso "faltan $ 2.700" y que nada se guarda sin confirmar.
- [x] 4.5 Anotar un monto a mano (súper, fecha, monto); verificar con Vitest que suma al mes y al súper y cae en "Sin detalle".
- [x] 4.6 Página `/gastos`: estado vacío, mes con totales, por súper, por categoría, ahorro en promos, lista de tickets y borrar; verificar con Vitest el estado vacío y el de un mes con tickets.
- [x] 4.7 "Hubieras pagado" por ticket con el endpoint de Tu lista y la zona, solo con cobertura de al menos `COBERTURA_MINIMA_COMPARACION` y una cadena de la zona que tenga todos los productos; verificar con Vitest el caso bien vinculado y el de pocos productos.
- [x] 4.8 "Bajar a Excel" con SheetJS cargado con `import()` al tocar el botón, hojas de gastos y de líneas; verificar con Vitest que el libro tiene 10 y 120 filas con montos numéricos, y con el build que `xlsx` queda en un chunk aparte.

## 5. Documentación y revisión integral

- [x] 5.1 Anotar en `docs/DECISIONES.md` la barra nueva y por qué Tu canasta pasa a "Más", el formato de los tickets por cadena, el "hubieras pagado" lista contra lista y la facturación de Gemini; verificar que la entrada está.
- [x] 5.2 Correr `pytest`/`unittest` de la API, `npm test`, `npm run lint` y `npm run build`; verificar que todo pasa.
- [x] 5.3 Recorrer en el servidor local con Playwright WebKit a 375 px: cargar un ticket con la lectura simulada, revisarlo, guardarlo, ver el resumen, anotar un monto, bajar el Excel y borrar todo; verificar sin desplazamiento horizontal, sin errores en la consola, con formato es-AR y guardar capturas.
- [x] 5.4 Probar la lectura real con Gemini en local sobre las cuatro fotos públicas (sin guardarlas en el repo) y anotar en `docs/DECISIONES.md` cuántas líneas se leyeron y vincularon bien por cadena; verificar que los números quedaron anotados.

## Workflow follow-up

- Activar la facturación del proyecto de Gemini y la alerta de presupuesto (Rodrigo), antes del deploy.
- Deploy en Cloud Run con el OK de Rodrigo y verificar en producción con un ticket real.
- Archivar el change.
