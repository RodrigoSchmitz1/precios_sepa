# Proposal

## Why

Lo que diferencia a Changuito Empresas no son los datos de SEPA, que cualquiera puede bajar, sino lo que la gente hace en Changuito: qué categorías de promos mira, qué productos pide que le avisen cuando estén de oferta y qué busca. Hoy todo eso queda en el teléfono y no se mide nada. La medición tiene que estar diseñada y probada antes del lanzamiento, con un aviso claro y la opción de apagarla, para encenderla ese día sin gastar plata antes.

## What Changes

- **Anónimas y prendidas, con un aviso claro.** La primera vez, Promos muestra un aviso de una línea ("Changuito cuenta de forma anónima qué categorías se miran") con "Entendido" y "Más info". En el menú Más, un interruptor "Datos anónimos" las apaga en un toque. Rodrigo eligió este modelo el 23-11: con un "Sí / No" casi nadie suma, y esconder el "no" o meterlo en condiciones sería engañoso y contrario a la Ley 25.326. Para no necesitar consentimiento, los eventos son anónimos de verdad: el identificador cambia cada día, así que no hay perfil de nadie.
- **Eventos anónimos acotados:**
  - abrir la página de una categoría de promos;
  - pedir o quitar un aviso de oferta;
  - buscar una promo (se guarda solo la categoría que corresponde a la búsqueda, nunca el texto).
  
  Cada evento lleva un identificador al azar que el teléfono cambia cada día, la provincia y la localidad de la zona elegida, y la fecha. No lleva IP, nombre, cuenta ni ubicación exacta.
- **Envío sin costo.** Los eventos viajan en tandas y la API los acumula en memoria y los escribe en BigQuery con trabajos de carga, que no consumen cuota de consultas. Ningún evento dispara una consulta.
- **Agregados para Changuito Empresas.** Dos marts semanales: categorías de promos más miradas y productos más pedidos en avisos, por provincia, en personas por día. Solo muestran un grupo si supera un umbral.
- **Interruptor `SENALES_ACTIVAS`**, como `FOTOS_DE_TICKETS`. Apagado, la app no muestra el aviso ni manda nada, y la API rechaza los eventos. Se enciende en el lanzamiento, después de revisar el texto del aviso.
- Fuera de alcance: líneas de ticket (son datos de compras de una persona: llegan con las fotos y con un consentimiento explícito), pantallas de Changuito Empresas que muestren estos agregados, y notificaciones.

## Capabilities

### New Capabilities
- `senales-anonimas`: el aviso y el interruptor, los eventos anónimos que la app manda, cómo se guardan y los agregados con umbral para Changuito Empresas.

### Modified Capabilities

## Impact

- **Frontend**:
  - `utils/senales.ts`: interruptor, identificador del día y cola de eventos con `sendBeacon`.
  - Aviso de una línea en Promos, hoja "Más info" e interruptor en el menú Más.
  - Llamadas en `PromosRubroPage`, `BotonAvisame` y en la búsqueda de la vidriera.
- **API**:
  - `senales.py` con validación, topes en memoria y buffer.
  - `POST /api/senales` y `GET /api/senales/estado`.
  - Escritura a `sepa_senales.eventos` con load jobs, y vaciado del buffer al apagar la instancia.
- **dbt**: fuente `sepa_senales.eventos` y dos marts con umbral (`umbral_personas_senales`), deshabilitados mientras `senales_activas` sea falso.
- **BigQuery**: un dataset nuevo con una tabla particionada por día y expiración de 400 días. El almacenamiento es chico y la escritura es gratis.
- **Legal y operación**: antes de encender, Rodrigo revisa el texto del aviso y confirma que los datos anónimos no requieren registro ante la AAIP (Ley 25.326); si lo requieren, lo registra.
