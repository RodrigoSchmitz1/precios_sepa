# senales-anonimas Specification

## Purpose
Medir de forma anónima qué categorías de promos se miran, qué productos se piden en avisos y qué se busca, para dar a Changuito Empresas agregados que nadie más tiene, sin armar un perfil de nadie, con un aviso claro, la opción de apagarlo en un toque y sin costo por pedido.

## Requirements

### Requirement: Las señales arrancan apagadas en el servicio
Sin `SENALES_ACTIVAS=1` en el servicio, la app SHALL NOT mostrar el aviso ni mandar eventos, y la API SHALL rechazar los eventos sin guardarlos. La app SHALL saber si están activas preguntándole a la API.

#### Scenario: Servicio sin la variable
- **GIVEN** el servicio corre sin `SENALES_ACTIVAS`
- **WHEN** alguien abre Promos y el menú Más
- **THEN** no ve el aviso ni la opción de datos anónimos, y la app no manda ningún evento

### Requirement: Anónimas y prendidas, con un aviso claro
Con las señales activas, la app SHALL mandar los eventos de esta capacidad salvo que la persona las haya apagado. La primera vez, Promos SHALL mostrar un aviso de una línea que diga que Changuito cuenta de forma anónima qué categorías se miran, con "Entendido" y "Más info". Cerrarlo SHALL esconderlo para siempre en ese teléfono.

#### Scenario: Primera visita
- **GIVEN** las señales están activas y la persona nunca vio el aviso
- **WHEN** abre Promos
- **THEN** ve el aviso de una línea con "Entendido" y "Más info"

#### Scenario: Más info
- **GIVEN** la persona ve el aviso
- **WHEN** toca "Más info"
- **THEN** ve qué se cuenta, qué no se cuenta y el interruptor para apagarlo

### Requirement: Apagarlas en un toque
El menú Más SHALL tener un interruptor "Datos anónimos", prendido por defecto, que se apaga en un solo toque y sin confirmación. Apagado, la app SHALL NOT mandar ningún evento y SHALL descartar los que tenga en cola.

#### Scenario: Apagar
- **GIVEN** las señales están activas y la persona abre el menú Más
- **WHEN** toca el interruptor "Datos anónimos"
- **THEN** queda apagado y la app no manda ningún evento más

### Requirement: Qué eventos se mandan
Con las señales activas y prendidas, la app SHALL mandar solo estos eventos:
- abrir la página de una categoría de promos (con el rubro);
- pedir o quitar un aviso de oferta (con el producto);
- buscar una promo (con el texto, para que la API lo traduzca a una categoría).

Ningún otro uso de la app SHALL generar eventos.

#### Scenario: Abrir Limpieza
- **GIVEN** las señales están prendidas y la zona es Caballito
- **WHEN** la persona abre la página de promos de Limpieza
- **THEN** se manda un evento con el rubro Limpieza, la provincia y la localidad de la zona

#### Scenario: Pedir un aviso
- **GIVEN** las señales están prendidas
- **WHEN** la persona toca "Avisame cuando esté de oferta" en un producto
- **THEN** se manda un evento con ese producto

### Requirement: Un evento no identifica a nadie
Cada evento guardado SHALL tener solo el tipo, la fecha, un identificador al azar que el teléfono cambia cada día, la provincia y la localidad de la zona elegida, y el rubro o el producto. SHALL NOT guardarse la IP, la ubicación exacta, el nombre, el texto buscado ni datos del navegador, y SHALL NOT haber forma de unir los eventos de una persona de un día con los de otro.

#### Scenario: Dos días seguidos
- **GIVEN** la persona usa la app el lunes y el martes
- **WHEN** se guardan sus eventos
- **THEN** los del lunes y los del martes tienen identificadores distintos

#### Scenario: Una búsqueda
- **GIVEN** las señales están prendidas y la persona busca "lavandina ayudin"
- **WHEN** el evento llega a la API
- **THEN** se guarda la categoría Lavandina y no el texto buscado

#### Scenario: Una búsqueda que no corresponde a nada
- **GIVEN** la persona busca un texto que no coincide con ninguna categoría ni producto
- **WHEN** el evento llega a la API
- **THEN** no se guarda nada

### Requirement: Mandar y guardar no cuesta consultas
Los eventos SHALL viajar en tandas y guardarse sin ejecutar una consulta a BigQuery por pedido. La API SHALL limitar cuántos eventos acepta por identificador y por día, y SHALL descartar los que no cumplan el formato.

#### Scenario: Muchos eventos
- **GIVEN** cien personas usan la app durante un día con las señales prendidas
- **WHEN** la API guarda sus eventos
- **THEN** no se ejecuta ninguna consulta nueva en BigQuery

#### Scenario: Un evento inventado
- **GIVEN** alguien manda un evento con un tipo desconocido o un campo de más
- **WHEN** llega a la API
- **THEN** se descarta sin guardarse

### Requirement: Agregados con un mínimo de personas
Los agregados para Changuito Empresas SHALL contar, por semana y por provincia, cuántas personas por día abrieron cada categoría de promos, buscaron cada categoría y pidieron aviso de cada producto. Un grupo con menos que el umbral SHALL NOT aparecer. El umbral SHALL vivir en un solo lugar.

#### Scenario: Una categoría poco mirada
- **GIVEN** el umbral es 10 y en una semana Bebés en Jujuy sumó 4 personas por día
- **WHEN** se arma el agregado de esa semana
- **THEN** la fila de Bebés en Jujuy no aparece
