# tu-lista Specification

## Purpose
Que la lista de productos de cada persona se encuentre desde cualquier página y
se vea cuántos productos tiene, para que vuelva a usarla en cada compra.

## Requirements

### Requirement: Tu lista se ve desde todas las páginas
El encabezado de todas las páginas SHALL tener un acceso a Tu lista que muestre
cuántos productos tiene. El acceso SHALL verse en el celular y en la
computadora.

#### Scenario: Volver otro día
- **GIVEN** el usuario guardó 3 productos en su lista en una visita anterior
- **WHEN** abre cualquier página del sitio
- **THEN** ve en el encabezado el acceso a Tu lista con un 3

#### Scenario: Sin lista
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre cualquier página
- **THEN** ve el acceso a Tu lista sin número

### Requirement: Agregar se nota en el momento
Al agregar o quitar un producto de la lista, el número del encabezado SHALL
cambiar sin recargar la página.

#### Scenario: Agregar desde una búsqueda
- **GIVEN** la lista tiene 2 productos
- **WHEN** el usuario toca "+ Lista" en un resultado de Mismo producto
- **THEN** el número del encabezado pasa a 3

### Requirement: Tu lista tiene su página
El sitio SHALL tener una página `/lista` con Tu lista, sus cantidades y cuánto
sale en cada cadena, con las mismas reglas de zona que Tu lista en Mismo
producto. Sin productos, la página SHALL explicar cómo se agregan y ofrecer el
buscador.

#### Scenario: Abrir la lista
- **GIVEN** la lista tiene productos y la zona es "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario toca el acceso del encabezado
- **THEN** llega a `/lista` y ve cuánto sale su lista en las cadenas de Lomas de Zamora

#### Scenario: Lista vacía
- **GIVEN** la lista no tiene productos
- **WHEN** el usuario abre `/lista`
- **THEN** lee cómo agregar productos y tiene un buscador que lleva a Mismo producto

### Requirement: Una sola lista en todo el sitio
La lista SHALL ser la misma en el encabezado, en `/lista` y en Mismo producto, y
SHALL seguir guardándose en el navegador con la misma clave que antes. Un cambio
hecho en otra pestaña SHALL verse sin recargar.

#### Scenario: La lista que ya estaba guardada
- **GIVEN** el usuario armó una lista antes de este cambio
- **WHEN** abre el sitio
- **THEN** ve la misma lista, con los mismos productos y cantidades

#### Scenario: Otra pestaña
- **GIVEN** el sitio está abierto en dos pestañas
- **WHEN** el usuario agrega un producto en una
- **THEN** el número del encabezado de la otra también cambia
