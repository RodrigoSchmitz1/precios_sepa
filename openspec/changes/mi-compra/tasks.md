# Tasks

## 1. Dónde comprarla cerca en la API

- [x] 1.1 Implementar `donde_comprar_lista` en `api/mismo_producto.py` (sucursales del índice del mapa en el radio, sin farmacias, precio creíble de cada cadena por producto, `optimizar_compra`, respuesta con nombre de producto); verificar con tests que con dos cadenas cerca reparte la lista en 1 y 2 paradas, que la cobertura va antes que el total y que una cadena sin sucursal en el radio no aparece.
- [x] 1.2 Exponer `POST /api/mismo-producto/lista/donde-comprar` (lista vacía 422, más de 50 productos 422, sin sucursales en el radio responde vacío con el radio usado); verificar con `TestClient` esos casos y que ningún pedido consulta BigQuery.

## 2. Mi compra en el frontend

- [x] 2.1 Renombrar la sección: título "Mi compra" en `/lista`, "Mi compra" en la barra del celular y en el menú de la computadora, y sacar Tu canasta de la hoja "Más"; verificar con los tests de `BarraCelular` actualizados.
- [x] 2.2 Agregar "Contanos quiénes viven en tu casa" (descripción → `interpretar` → `DeTuCanasta`) y "Empezar con la canasta básica" (→ `DeTuCanasta`) en Mi compra; verificar con Vitest que una yerba de 500 g para 2 kg entra con 4 unidades y que el 503 de la IA muestra "Probá de nuevo en un minuto" y ofrece la canasta básica.
- [x] 2.3 Ofrecer la canasta guardada ("Tenés una canasta guardada…") y borrarla al terminar o descartar; verificar con Vitest que aparece con una canasta guardada y que después de "Descartar" no vuelve.
- [x] 2.4 Adaptar `DondeComprarla` a productos de la lista con el endpoint nuevo, aviso de precio por cadena, pedido de zona sin zona y radio más grande sin sucursales; verificar con Vitest esos tres estados.
- [x] 2.5 Mudar "De tu canasta" de Mismo producto a Mi compra y cambiar el link "Armá tu canasta" por uno a Mi compra; verificar que Mismo producto ya no importa `DeTuCanasta` y que sus tests pasan.

## 3. Retirar Tu canasta

- [x] 3.1 Cambiar `/canasta-personalizada` por una redirección a `/lista` que conserve el `search`; verificar con un test de rutas que `?zona=AR-C:Palermo` llega a `/lista?zona=AR-C:Palermo`.
- [x] 3.2 Cambiar la tarjeta de la portada, Cómo se calcula y No encontrada para que digan "Mi compra" y lleven a `/lista`; verificar con `grep` que no queda ningún link a `/canasta-personalizada` fuera de la redirección.
- [x] 3.3 Borrar `CanastaPersonalizadaPage.tsx` y los componentes y tests que solo usaba ella, después de confirmar con `grep` que nadie más los importa; verificar con `npm run build` y `npm test`.

## 4. Documentación y revisión integral

- [x] 4.1 Anotar en `docs/DECISIONES.md` por qué se unieron, qué se conservó de Tu canasta y por qué Dónde comprarla usa precio de cadena; verificar que la entrada está.
- [x] 4.2 Correr los tests de la API, `npm test`, `npm run lint` y `npm run build`; verificar que todo pasa.
- [x] 4.3 Recorrer en local con Playwright WebKit a 375 px con la API local: lista vacía, armar con la canasta básica, elegir marcas, ver la cotización, Dónde comprarla con zona Palermo y el link viejo `/canasta-personalizada`; verificar sin desplazamiento horizontal ni errores en la consola, y guardar capturas.

## Workflow follow-up

- Archivar primero `mis-gastos-y-barra-nueva` y después este change: los dos modifican el requisito de la barra en `tu-lista`.
- Deploy cuando Rodrigo lo decida (hoy: nada pago hasta pulir todo).
