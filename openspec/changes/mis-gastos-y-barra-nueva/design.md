# Design

## Context

- La app no tiene cuentas. Tu lista y Tu canasta se guardan en `localStorage` (`frontend/src/utils/lista.ts`, envuelto en try/catch). Mis gastos sigue el mismo patrón.
- La API tiene en memoria el índice de Mismo producto (`api/mismo_producto.py`): un registro por código de barras con descripción, marca, categoría y precio creíble **por cadena para todo el país**. `cotizar_lista` ya cotiza una lista de códigos entre las cadenas de la zona. No hay precios por sucursal para productos exactos.
- La API ya usa Gemini (`api/interpretar_canasta.py`, `gemini-flash-lite-latest`, `GEMINI_API_KEY` como secreto de Cloud Run) y ya convierte el 429 de Gemini en un 503 con "Probá de nuevo en un minuto" (`test_limite_gemini.py`).
- `requirements.txt` no tiene `python-multipart`; el frontend no tiene librería de Excel.
- Formato real de los tickets, verificado en fotos públicas: Carrefour y Jumbo imprimen el código de barras de 13 dígitos debajo de cada producto; Coto imprime código interno + código de barras con un cero adelante (14 dígitos) y las promos como línea propia con importe negativo; Día imprime solo texto abreviado. Los pesables traen un código que empieza con 2 con el precio adentro. Varios imprimen DNI y tarjeta parcial.

## Goals / Non-Goals

**Goals:**
- Leer un ticket con a lo sumo dos pedidos a Gemini y ninguna consulta a BigQuery.
- Que el registro guardado en el teléfono ya tenga la forma que después necesita Changuito Empresas (líneas, códigos, cadena, sucursal, descuentos), aunque hoy no se suba.

**Non-Goals:**
- Subir tickets al servidor o guardar algo del usuario del lado del servidor.
- Precios por sucursal, historial de precios pagados, o pasar los gastos de un teléfono a otro.
- Leer el QR de ARCA: el número de comprobante impreso ya sirve para detectar duplicados y evita sumar una librería de QR.

## Decisions

### 1. Barra intermedia: Tu canasta va a "Más"
Barra del celular: Promos | Buscar | Mi lista | Mis gastos | Más. "Más" abre una hoja con Más barato, Tu canasta, Inflación y Cómo se calcula, y queda marcado cuando la ruta actual es una de ellas. Tu canasta sale de la barra porque en los registros del último mes solo 3 personas la usaron con la IA y porque se va a unir con Mi lista en otro change. El menú de la computadora suma "Mis gastos" y conserva todo lo demás.
*Alternativa:* seis lugares en la barra. Descartada: a 375 px cada etiqueta queda en 62 px y "Mis gastos" no entra.

### 2. La foto viaja achicada, en base64, en un JSON
El teléfono achica cada foto (lado largo de 1.600 px como máximo, JPEG con calidad 0,8, unos 200–400 KB) y la manda en `POST /api/gastos/leer-ticket` como `{"fotos": ["<base64>", ...]}`, con 3 fotos como máximo y un tope de tamaño del cuerpo. El servidor la pasa a Gemini en memoria y no la escribe nunca.
*Alternativa:* multipart. Descartada: suma `python-multipart` para nada, y el JSON se testea igual que los otros endpoints.

### 3. Dos pasos con Gemini: leer y después elegir
1. **Leer:** un pedido con todas las fotos y una respuesta JSON con esquema fijo (cadena, CUIT del comercio, sucursal, fecha, comprobante, total, líneas, descuentos). El prompt pide no transcribir datos personales. Además, el servidor arma la respuesta **solo con los campos del esquema**, así que un DNI que el modelo devuelva igual nunca sale.
2. **Elegir:** solo si quedan líneas sin código, un segundo pedido con esas líneas y hasta 5 candidatos por línea. El modelo elige un candidato o "ninguno", y una categoría de la lista de categorías del sitio para las que quedan sin producto.
*Alternativa:* un solo pedido con todo el catálogo. Descartada: el catálogo tiene decenas de miles de productos y el modelo inventaría códigos.

### 4. Vínculo con SEPA en el servidor, con el índice en memoria
- Código de 13 dígitos, o de 14 con un cero adelante: búsqueda directa en el índice. Los códigos que empiezan con 2 no se buscan.
- Sin código: candidatos del índice que la cadena del ticket informa, con precio dentro de ±`TOLERANCIA_PRECIO_CANDIDATO` (15 %) del precio unitario pagado, ordenados por palabras en común con la descripción (`normalizar`/`palabras` de Mismo producto). Se mandan los 5 primeros al paso 2.
- La cadena del ticket se reconoce por el CUIT del comercio impreso, con la tabla CUIT → cadenas de SEPA leída al iniciar desde `stg_comercio` (30 filas, por la Storage Read API como los otros marts) y, si no hay CUIT, por el nombre. Carrefour cubre a toda la familia (Carrefour, Market, Express, Maxi); se toma el precio de "Carrefour" y, si no lo informa, el de la familia más parecido.
- Las constantes (`TOLERANCIA_PRECIO_CANDIDATO`, `CANDIDATOS_POR_LINEA`, `MAXIMO_FOTOS`, `COBERTURA_MINIMA_COMPARACION`) viven en un solo módulo; la API se las pasa al frontend en la respuesta para que el texto use el mismo número.

### 5. "Hubieras pagado": lista contra lista, solo en la zona
El frontend cotiza los productos vinculados con el endpoint de Tu lista que ya existe, con la zona del usuario. Compara la suma de las líneas vinculadas **tal como figuran en el ticket, antes de los descuentos** (precio de lista en esa cadena) contra la cadena de la zona más barata **que tiene todos esos productos**. No se muestra si los vinculados cubren menos del 60 % (`COBERTURA_MINIMA_COMPARACION`) del subtotal del ticket, si ninguna cadena de la zona los tiene todos o si no hay zona. Así se respeta la honestidad del dato: precio de lista nacional contra precio de lista nacional, sin mezclar con promos.
*Alternativa:* comparar el total pagado con promos contra precios de lista. Descartada: haría parecer cara una compra que se hizo con descuento.

### 6. Almacenamiento local
Clave `changuito.gastos.v1`: lista de gastos con `id`, `origen` (`foto`/`mano`), `cadena`, `cadenas_sepa`, `sucursal`, `fecha` (texto `AAAA-MM-DD`, leído sin `new Date("AAAA-MM-DD")`), `comprobante`, `total`, `descuentos[]` y `lineas[]` (descripción, cantidad, precio unitario, importe, código, `id_producto`, nombre, categoría). Unos 3 KB por ticket. Tope de 500 gastos: al pasarlo se avisa y se pide bajar a Excel y borrar los más viejos. El aviso aceptado va en `changuito.gastos.aviso.v1`. El duplicado se detecta en el teléfono con (cadena, comprobante, fecha, total).

### 7. Excel con SheetJS cargado a pedido
`xlsx` desde el tarball oficial de cdn.sheetjs.com (la versión de npm está abandonada), con `import()` dinámico al tocar "Bajar a Excel": no pesa en la carga de la página. Montos como números, fechas como texto `DD/MM/AAAA`.
*Alternativa:* CSV. Descartada: Excel en es-AR espera `;` y coma decimal, y un CSV mal abierto rompe los montos.

### 8. Límites contra abuso y costo
El endpoint es público y cada pedido cuesta plata. Tope por IP en memoria (`TICKETS_POR_HORA_POR_IP`, 20) y tope diario global (`TICKETS_POR_DIA`, 2.000) que devuelven 429/503 con mensaje claro. Con varias instancias el tope es por instancia (máximo 3): alcanza para frenar un abuso, no para contar exacto. Se suma una alerta de presupuesto de facturación en Google Cloud.

### 9. Facturación de Gemini
En el plan gratis Google puede usar lo que se manda para mejorar sus productos, con revisión humana. Para fotos de tickets eso contradice el aviso. Se activa la facturación en el proyecto de la clave antes del deploy; desde ahí todo pedido de esa clave, incluida Tu canasta, es pago y sin ese uso. Con Flash-Lite cuesta del orden de USD 0,001 por ticket. Requiere el OK de Rodrigo.

## Risks / Trade-offs

- [Gemini lee mal un precio o una línea] → la persona revisa antes de guardar y la página avisa si la suma no cierra con el total.
- [Fotos de iPhone en HEIC] → el `<input type="file" accept="image/*">` de Safari entrega JPEG; igual se decodifica con `createImageBitmap` y, si falla, se pide sacar la foto con la cámara de la app.
- [Candidato equivocado en tickets sin código] → solo se acepta un candidato si el modelo lo elige entre los filtrados por cadena y precio; si duda, queda sin producto. Se mide en los fixtures cuántos se aciertan antes de dar el change por terminado.
- [El usuario borra el navegador y pierde todo] → aviso en la página y "Bajar a Excel" siempre a mano.
- [Un ticket de 80 líneas supera el tope de 50 productos de `cotizar_lista`] → se cotizan los 50 de mayor importe y se dice.
- [Sacar Más barato y Tu canasta de la barra baja su uso] → siguen en "Más", en la portada y en la computadora; se mira en los registros un mes después.

## Migration Plan

1. Activar la facturación del proyecto de Gemini y crear la alerta de presupuesto (Rodrigo).
2. Deploy normal en Cloud Run con el OK de Rodrigo. No hay datos que migrar: Mis gastos arranca vacío.
3. Vuelta atrás: el deploy anterior. Los gastos guardados en teléfonos quedan en `localStorage` y vuelven a verse si Mis gastos regresa.

## Open Questions

- ¿El tope por IP de 20 tickets por hora es razonable para una familia que carga tickets atrasados? Se puede ajustar después del primer mes sin tocar specs.
