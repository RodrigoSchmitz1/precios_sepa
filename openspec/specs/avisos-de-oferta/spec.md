# avisos-de-oferta Specification

## Purpose
Que el usuario pueda pedir que le avisen cuando un producto esté en promo cerca de su zona, guardado en su teléfono y sin cuenta, y lo vea al volver a la app.

## Requirements

### Requirement: Pedir que te avisen
El detalle de un producto y cada promo de una página de categoría SHALL tener un botón "Avisame cuando esté de oferta". Tocarlo SHALL guardar el producto y cambiar el botón a "Te avisamos", que al tocarlo de nuevo deja de avisar.

#### Scenario: Pedir aviso desde el detalle
- **GIVEN** el usuario está en el detalle de Cocinero aceite de girasol 1,5 L
- **WHEN** toca "Avisame cuando esté de oferta"
- **THEN** el botón dice "Te avisamos" y el producto queda entre sus avisos

#### Scenario: Dejar de avisar
- **GIVEN** el producto ya está entre sus avisos
- **WHEN** toca "Te avisamos"
- **THEN** el producto sale de sus avisos y el botón vuelve a "Avisame cuando esté de oferta"

### Requirement: Los avisos se guardan en el teléfono
Los avisos SHALL guardarse solo en el navegador del teléfono, sin cuenta y sin mandarlos al servidor salvo para buscar sus promos. SHALL caber hasta 50 productos; con 50, el botón SHALL decir que se llegó al tope. Si el navegador no permite guardar, el botón SHALL decirlo.

#### Scenario: Volver otro día
- **GIVEN** el usuario pidió aviso de 3 productos el lunes
- **WHEN** vuelve el jueves desde el mismo teléfono
- **THEN** sus 3 avisos siguen ahí

#### Scenario: Tope de avisos
- **GIVEN** el usuario tiene 50 avisos
- **WHEN** abre el detalle de otro producto
- **THEN** el botón dice que llegó al tope de 50 avisos y que puede sacar alguno

### Requirement: Al volver, la app dice cuáles están de oferta
Con zona y avisos, la vidriera de Promos SHALL empezar con un bloque que diga cuántos productos avisados están en promo cerca y muestre de cada uno su promo vigente más barata cerca, con la cadena, la sucursal, el precio, el descuento, hasta cuándo vale y su evidencia. Las promos SHALL salir de la misma búsqueda de promos cerca que usa el detalle del producto.

#### Scenario: Dos avisos en promo
- **GIVEN** la zona es Caballito y el usuario tiene 5 avisos, 2 en promo cerca
- **WHEN** abre Promos
- **THEN** arriba de todo lee "2 de tus avisos están de oferta cerca" con esas dos promos

#### Scenario: Ninguno en promo
- **GIVEN** el usuario tiene avisos y ninguno está en promo cerca
- **WHEN** abre Promos
- **THEN** ve una línea chica con la cantidad de avisos que tiene y que todavía no están de oferta, sin un bloque vacío

#### Scenario: Avisos sin zona
- **GIVEN** el usuario tiene avisos y no eligió zona
- **WHEN** abre Promos
- **THEN** lee que eligiendo su zona le dice cuáles están de oferta cerca

### Requirement: Ver y sacar los avisos
Desde el bloque de avisos, el usuario SHALL poder ver la lista de todos sus avisos y sacar cualquiera.

#### Scenario: Sacar un aviso
- **GIVEN** el usuario tiene 4 avisos
- **WHEN** abre la lista de avisos y saca uno
- **THEN** le quedan 3

### Requirement: Avisar no consulta BigQuery
Buscar las promos de los avisos SHALL resolverse con los datos que la API ya tiene en memoria, sin una consulta a BigQuery por pedido.

#### Scenario: Muchos usuarios con avisos
- **GIVEN** cien personas con avisos distintos abren Promos
- **WHEN** el sitio busca las promos de sus avisos
- **THEN** no se ejecuta ninguna consulta nueva en BigQuery
