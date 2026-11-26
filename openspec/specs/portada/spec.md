# portada Specification

## Purpose
Decir en la portada, con las cifras del día, dónde le conviene comprar a quien
la mira: en su zona si eligió una, y en todo el país si no.

## Requirements

### Requirement: Con zona, la cadena más barata es la de tu zona
Con una zona elegida que tiene al menos dos cadenas con precios, la tarjeta
principal de la portada SHALL nombrar la cadena de la zona que es la más barata
en más categorías, y en cuántas lo es. Esa cuenta SHALL ser la misma que usa
Más barato en tu zona.

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta principal dice "Tu súper más barato cerca" y nombra una cadena con sucursal en Lomas de Zamora, la misma que encabeza Más barato en su zona

#### Scenario: Sin zona
- **WHEN** no hay zona elegida
- **THEN** la tarjeta principal nombra la cadena más barata en más categorías de todo el país, como hasta ahora

### Requirement: Con zona, el ahorro se mide entre las cadenas de tu zona
Con una zona elegida que tiene precios para la canasta básica en al menos dos
cadenas, la tarjeta de ahorro SHALL comparar la canasta básica cotizada en las
sucursales de la zona, entre la cadena más barata y la más cara de la zona. Si
la zona no tiene precios para cotizar la canasta, la tarjeta SHALL mostrar el
dato del país y decir que es del país.

#### Scenario: El ahorro no nombra cadenas de afuera
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta de ahorro nombra solo cadenas con sucursal en Lomas de Zamora

#### Scenario: Zona sin precios para la canasta
- **GIVEN** una zona con sucursales pero sin precios para cotizar la canasta básica
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta de ahorro muestra el dato del país y dice que es del país

### Requirement: Una zona con una sola cadena no inventa una comparación
Con una zona elegida en la que SEPA informa una sola cadena cerca, la portada SHALL decirlo y SHALL mostrar cuánto sale ahí la canasta básica, sin un porcentaje de ahorro ni un ranking.

#### Scenario: Rafaela
- **GIVEN** la zona es "Rafaela, Santa Fe", donde la única cadena cerca es La Anónima
- **WHEN** el usuario abre la portada
- **THEN** lee que cerca de su zona SEPA informa solo La Anónima y cuánto sale ahí la canasta básica, sin un "ahorrás"

### Requirement: Una zona con una sola cadena dice lo que cuesta no tener opciones
Con una sola cadena cerca, la portada SHALL decir a cuántos km está la sucursal más cercana de otra cadena. Si la cadena de la zona tiene total en el ranking nacional de la canasta, SHALL decir cuánto menos sale la misma canasta en la cadena más barata del país, como un costo y no como un ahorro al alcance. Sin ese total, NO SHALL mostrar la cifra.

#### Scenario: Lo que cuesta no tener opciones
- **GIVEN** la zona es "Rafaela, Santa Fe", la otra cadena más cercana está a 50 km, y en el ranking nacional la canasta sale 14% menos en Maxi (Carrefour) que en La Anónima
- **WHEN** el usuario abre la portada
- **THEN** lee que la otra cadena más cercana está a unos 50 km y que en Maxi (Carrefour), la más barata del país, la misma canasta sale 14% menos

#### Scenario: Una cadena sin total nacional
- **GIVEN** la única cadena cerca es la Cooperativa Obrera, que no tiene total en el ranking nacional
- **WHEN** el usuario abre la portada
- **THEN** lee que es la única cadena cerca y a cuántos km está la otra más cercana, sin una comparación con la más barata del país

### Requirement: Lo nacional se dice como nacional
Con una zona elegida, cada tarjeta de la portada que siga mostrando un dato de
todo el país SHALL decirlo en la misma tarjeta.

#### Scenario: Lo que más subió
- **GIVEN** hay una zona elegida
- **WHEN** el usuario mira la tarjeta "Lo que más subió"
- **THEN** la tarjeta dice que es de todo el país

### Requirement: El ejemplo de la portada, con zona, compara las cadenas de la zona
Con una zona elegida, la tarjeta del producto de ejemplo de la portada SHALL comparar solo las cadenas cerca de la zona, si al menos dos venden el producto. Si no, SHALL mostrar las del país y decir "en todo el país" en la misma tarjeta.

#### Scenario: Palermo
- **GIVEN** la zona es Palermo y la Coca Cola de 2,25 L la venden varias cadenas cerca
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta compara esas cadenas y no muestra La Anónima

#### Scenario: Una zona con una sola cadena
- **GIVEN** la zona es Rafaela, con una sola cadena cerca
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta muestra cadenas del país y dice "en todo el país"

### Requirement: La portada arranca por tu lista
Si el usuario tiene productos en su lista, la portada SHALL mostrar debajo del buscador cuánto sale su lista en la cadena más barata: con zona, entre las cadenas cerca; sin zona, en el país. La tarjeta SHALL llevar a Tu lista. Sin lista, la portada NO SHALL mostrarla.

#### Scenario: Con lista y zona
- **GIVEN** la zona es Tres Arroyos y la lista tiene 8 productos, más baratos en Vea a $ 41.575
- **WHEN** el usuario abre la portada
- **THEN** debajo del buscador ve "Tu lista · 8 productos: en Vea te sale $ 41.575", que lo lleva a Tu lista

#### Scenario: Sin lista
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre la portada
- **THEN** no ve la tarjeta de su lista

### Requirement: Las promos del día se ven al abrir
En la portada, tus avisos y las promos del día SHALL ir inmediatamente después del buscador y las cifras, antes del ejemplo de precios. En un teléfono de 375 px, el título de las promos del día SHALL quedar dentro de la primera pantalla. Abrir el mapa SHALL mostrarlo en ese mismo lugar.

#### Scenario: Abrir la app en el celular
- **GIVEN** la zona es Palermo y el usuario abre la portada en un teléfono de 375 × 812
- **WHEN** termina de cargar
- **THEN** ve "Las promos del día" sin desplazarse, debajo del buscador y de las cifras
- **AND** las filas por categoría y por súper quedan más abajo

#### Scenario: Las cifras no empujan las promos
- **GIVEN** la portada tiene tres cifras
- **WHEN** se ve en el celular
- **THEN** las cifras van en una fila que se desliza de costado, empezando por la primera

### Requirement: Camino al ahorro en la primera visita
Cuando la lista es de ejemplo, la tarjeta de tu lista en la portada SHALL mostrar cuánto sale esa compra en la cadena más barata de la zona, con el título "Mirá cuánto ahorrás en tu compra" y la aclaración de que es una compra de ejemplo, y SHALL llevar a Mi compra. Con la lista propia, la tarjeta SHALL seguir como antes. Al pie de la comparación de Mi compra SHALL haber un paso siguiente que lleva a Mis gastos.

#### Scenario: Primera visita a la portada
- **WHEN** alguien abre la portada por primera vez con una zona elegida
- **THEN** ve "Mirá cuánto ahorrás en tu compra" con el total de la compra de ejemplo en la cadena más barata, y al tocarla llega a Mi compra
