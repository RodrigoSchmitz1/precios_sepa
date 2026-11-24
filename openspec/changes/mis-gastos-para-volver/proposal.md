# Proposal

## Why

Mis gastos es la parte de Changuito que hace volver a la gente, y la que algún día va a generar los tickets que Changuito Empresas necesita. El informe de paneles e incentivos del 24-11 concluyó que pagar por ticket no tiene sentido en la Argentina (los reintegros bancarios aplastan cualquier cupón) y que el incentivo tiene que ser el valor informativo: que la app le diga a cada uno algo útil sobre su propia compra. Hoy Mis gastos muestra el pasado (cuánto gastaste); le falta mirar hacia adelante: qué de lo que comprás está en promo, dónde te conviene la próxima compra, cuánto te queda del presupuesto.

## What Changes

- **Tu compra habitual en promo cerca.** Con los productos que más se repiten en tus tickets, Mis gastos dice cuáles están en promo cerca de tu zona, con la misma búsqueda que los avisos de oferta.
- **Dónde te conviene la próxima compra.** Tu compra habitual cotizada en los súper de tu zona: el más barato y, si conviene, mezclando dos.
- **Presupuesto del mes.** El usuario pone cuánto quiere gastar por mes y ve cuánto lleva y cuánto le queda; al pasar el 80 % se le avisa.
- **Informe del mes para compartir.** Un resumen corto del mes (total, comparación con el mes anterior, categoría donde más gastó, ahorro en promos) con "Compartir", y la racha de semanas seguidas con al menos un gasto cargado.
- **Aviso de la foto.** El aviso antes de la primera foto dice que la lee Google Gemini en servidores de Estados Unidos y que no se guarda, y el botón pasa a "Acepto y saco la foto" (consentimiento expreso para la transferencia internacional, Ley 25.326 art. 12).
- Fuera de alcance: subir tickets para estudios (llega con las fotos y su propio consentimiento), la página de privacidad (necesita el responsable y un contacto) y premios.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mis-gastos`: aviso de la foto con la transferencia a EE.UU.; compra habitual en promo, próxima compra, presupuesto, informe para compartir y racha.

## Impact

- **Frontend**: `GastosPage` y componentes nuevos en `components/gastos/` (compra habitual, presupuesto, informe del mes); utilidades en `utils/compraHabitual.ts` y `utils/presupuesto.ts`; `CargarTicket` (texto del aviso). Usa endpoints existentes: `/promos/productos` y `/mismo-producto/lista/donde-comprar`.
- **API**: sin cambios.
- **Datos**: todo queda en el teléfono (localStorage); ninguna consulta nueva a BigQuery.
