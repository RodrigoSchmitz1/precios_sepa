# Proposal

## Why

Antes de prender la lectura de fotos y las señales anónimas, la Ley 25.326 (art. 6) pide informar quién es el responsable de los datos, para qué se usan, adónde van y cómo ejercer los derechos. El informe de paneles e incentivos del 24-11 lo puso en la lista de lo necesario para lanzar. Changuito no tiene ninguna página que lo diga.

## What Changes

- Página `/privacidad` con: el responsable (Rodrigo Schmitz) y el contacto (rodri.schmitz@gmail.com); lo que queda solo en el teléfono; las fotos de tickets (Google Gemini en EE.UU., no se guardan, se descartan los datos personales, todavía apagado); las señales anónimas (identificador diario, apagado); los registros técnicos del servidor (IP, dirección pedida y navegador, 30 días); los derechos y la leyenda de la AAIP como órgano de control.
- Link desde el pie de página y desde el menú Más del celular, y tarjeta propia para compartir.

## Capabilities

### New Capabilities
- `privacidad`: la página que informa qué pasa con los datos en Changuito.

### Modified Capabilities

## Impact

Frontend: `PrivacidadPage.tsx`, `router.tsx`, `secciones.ts` (menú Más), `Layout.tsx` (pie). API: `compartir.py` (tarjeta de `/privacidad`). Sin datos nuevos.
