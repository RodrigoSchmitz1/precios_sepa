# Proposal

## Why

Changuito responde "¿dónde conviene comprar?", pero no le da a la persona una razón para volver después de comprar. Un registro rápido de lo que gastó en el súper, con categorías, ahorro en promos y cuánto hubiera pagado en la cadena más barata de su zona, es un uso diario que hoy no existe. Además, cada ticket leído produce los datos de compra real que más adelante puede usar Changuito Empresas (ver `Desktop/investigaciones/reports/Changuito Empresas con tickets y anuncios.md`). La barra del celular no tiene lugar para una sección más, así que hay que reordenarla.

## What Changes

- Nueva sección **Mis gastos** (`/gastos`), con lugar propio en la barra del celular y en el menú de la computadora.
- Cargar un gasto de dos formas: **foto del ticket** (de 1 a 3 fotos del mismo ticket) o **monto total a mano** (súper, fecha y monto).
- La foto se manda a la API, que la lee con Gemini y devuelve solo cabecera, líneas y descuentos. **La foto no se guarda** en ningún lado, y los datos personales del ticket (DNI, tarjeta, nombre, número de cliente) se descartan.
- Cada línea se vincula con un producto de SEPA: directo por el código de barras impreso (Carrefour, Coto, Jumbo) o, si no hay código, eligiendo entre candidatos de esa cadena con precio parecido.
- Los gastos se guardan **solo en el teléfono**, sin cuentas. La persona ve el gasto por mes, por súper y por categoría, el ahorro en promos y "en la cadena más barata de tu zona estos productos salían $Y a precio de lista".
- **Bajar a Excel** todos los gastos y sus líneas.
- Un mismo ticket no se carga dos veces (se reconoce por cadena, número de comprobante, fecha y total).
- **Barra del celular nueva:** Promos | Buscar | Mi lista | Mis gastos | Más. "Buscar" lleva a Mismo producto. "Más" abre Más barato, Tu canasta, Inflación y Cómo se calcula. **BREAKING (navegación):** Más barato y Tu canasta dejan la barra del celular; siguen en sus direcciones, en el menú de la computadora y desde la portada.

Fuera de alcance: unir Tu canasta con Mi lista (otro change), subir tickets a estudios para Changuito Empresas (segundo consentimiento, inscripción en la AAIP: otro change), promos patrocinadas y premios por ticket.

## Capabilities

### New Capabilities
- `mis-gastos`: registro de gastos de supermercado en el teléfono a partir de fotos de tickets o montos a mano, con lectura del ticket, vínculo con productos de SEPA, resúmenes y exportación a Excel.

### Modified Capabilities
- `tu-lista`: cambia el requisito de la barra de secciones del celular (Mi lista se queda, pero la barra pasa a Promos, Buscar, Mi lista, Mis gastos y Más).

## Impact

- **Frontend:** `Layout.tsx` (barra y menú "Más"), `router.tsx` (ruta `/gastos`), página y componentes nuevos de Mis gastos, almacenamiento local nuevo (`changuito.gastos.v1`), achicado de la foto en el teléfono antes de mandarla, exportación a Excel con una librería cargada solo al tocar "Bajar a Excel".
- **API:** endpoint nuevo `POST /api/gastos/leer-ticket` (imagen en base64, sin guardarla), módulo de lectura con Gemini y vínculo con el índice de Mismo producto que ya está en memoria. "Hubieras pagado" reusa la cotización de Tu lista. **Ninguna consulta a BigQuery por pedido.**
- **Costos y cuentas:** la lectura de tickets usa Gemini Flash-Lite con facturación activada (en el plan gratis Google puede usar las imágenes). Del orden de centavos de dólar cada mil tickets. Activar la facturación necesita el OK de Rodrigo antes del deploy.
- **Privacidad:** aviso antes de la primera foto (qué se manda, que no se guarda, que los gastos quedan en el teléfono). Sin datos en el servidor, no hace falta una base inscripta en la AAIP para este change.
- **Docs:** `docs/DECISIONES.md` (barra nueva, lectura de tickets, precisión del "hubieras pagado").
