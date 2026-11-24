# privacidad Specification

## Purpose
Informar en palabras simples qué pasa con los datos en Changuito, quién es el responsable y cómo ejercer los derechos, como pide la Ley 25.326.

## Requirements

### Requirement: Página de privacidad
El sitio SHALL tener una página `/privacidad` que diga quién es el responsable y su contacto, qué datos quedan solo en el teléfono, qué pasa con las fotos de tickets (Google Gemini en Estados Unidos, sin guardarse, descartando los datos personales), cómo funcionan los datos anónimos, qué registran los servidores y por cuánto tiempo, y cómo pedir acceso, rectificación o supresión, con la leyenda de la AAIP como órgano de control. Lo que todavía esté apagado SHALL decir que todavía no está activo.

#### Scenario: Leer la página
- **WHEN** alguien abre `/privacidad`
- **THEN** ve el nombre del responsable, el mail de contacto, las secciones de teléfono, fotos, datos anónimos, registros del servidor y derechos, y la leyenda de la AAIP

### Requirement: Se llega desde todo el sitio
La página SHALL estar enlazada desde el pie de página y desde el menú Más del celular.

#### Scenario: Desde el celular
- **WHEN** el usuario abre el menú Más
- **THEN** ve "Privacidad"
