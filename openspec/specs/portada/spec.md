# portada Specification

## Purpose
Decir en la portada, con las cifras del día, dónde le conviene comprar a quien
la mira: en su zona si eligió una, y en todo el país si no.

## Requirements

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
Debajo del buscador, la portada SHALL tener una sola tarjeta de tu compra:
- **Con lista:** SHALL decir en qué cadena sale más barata y cuánto, con la misma cifra que Mi compra. Con zona, entre las cadenas cerca; sin zona, en el país. SHALL decir también cuánto más sale en la siguiente opción, no en la más cara. La tarjeta SHALL llevar a Mi compra.
- **Sin lista:** SHALL invitar a armar la compra y ofrecer "Ver un ejemplo".

#### Scenario: Con lista y zona
- **GIVEN** la zona es Palermo y la lista tiene 12 productos, que salen $ 54.619 en Día y $ 56.767 en Market, la siguiente
- **WHEN** el usuario abre la portada
- **THEN** ve "Te conviene Día: tus 12 productos salen $ 54.619" y "En Market, la siguiente opción, pagás $ 2.148 más", y tocarla lo lleva a Mi compra

#### Scenario: Sin lista
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre la portada
- **THEN** ve la invitación a armar su compra con el botón "Ver un ejemplo"

### Requirement: Las promos del día se ven al abrir
En la portada, tus avisos y las promos del día SHALL ir inmediatamente después del buscador y la tarjeta de tu compra. En un teléfono de 375 px, el título de las promos del día SHALL quedar dentro de la primera pantalla. Abrir el mapa SHALL mostrarlo en ese mismo lugar. El mapa SHALL seguir oculto hasta que el usuario toque "Ver en el mapa".

#### Scenario: Abrir la app en el celular
- **GIVEN** la zona es Palermo y el usuario abre la portada en un teléfono de 375 × 812
- **WHEN** termina de cargar
- **THEN** ve "Las promos del día" sin desplazarse, debajo del buscador y de la tarjeta de su compra

#### Scenario: Las cifras no empujan las promos
- **GIVEN** la zona tiene una sola cadena y la portada muestra lo que cuesta no tener opciones
- **WHEN** se ve en el celular
- **THEN** esa tarjeta va junto a la de tu compra, sin bajar las promos del día fuera de la primera pantalla

#### Scenario: El mapa no se abre solo
- **WHEN** el usuario abre la portada
- **THEN** ve las promos en tarjetas y el botón "Ver en el mapa", sin el mapa cargado

### Requirement: Camino al ahorro en la primera visita
Cuando la lista es de ejemplo, la tarjeta de tu compra en la portada SHALL mostrar cuánto sale esa compra en la cadena más barata de la zona y cuánto más en la siguiente opción. SHALL llevar el título "Mirá cuánto ahorrás en tu compra" y aclarar que es una compra de ejemplo. SHALL llevar a Mi compra. Al pie de la comparación de Mi compra SHALL haber un paso siguiente que lleva a Mis gastos.

#### Scenario: Primera visita a la portada
- **WHEN** alguien abre la portada por primera vez con una zona elegida
- **THEN** ve la invitación a armar su compra con "Ver un ejemplo", sin una compra cargada sola

#### Scenario: Después de ver el ejemplo
- **GIVEN** el usuario tocó "Ver un ejemplo" y la zona es Palermo
- **WHEN** vuelve a la portada
- **THEN** ve "Mirá cuánto ahorrás en tu compra" con el total de la compra de ejemplo en la cadena más barata y la diferencia con la siguiente, y al tocarla llega a Mi compra

### Requirement: Tu lista esta semana
La primera vez que el usuario abre la app en una semana nueva, con lista propia, la tarjeta de tu compra SHALL decir cuánto sale hoy y cuánto cambió desde la última semana en que la vio, en la misma cadena. El total de cada semana SHALL guardarse solo en el teléfono. Sin un total anterior, o con la lista cambiada desde entonces, la tarjeta NO SHALL mostrar la diferencia.

#### Scenario: Bajó desde la semana pasada
- **GIVEN** la semana pasada la lista salía $ 54.619 en Día y hoy sale $ 53.900, con los mismos productos
- **WHEN** el usuario abre la app por primera vez en la semana
- **THEN** la tarjeta dice que esta semana su lista sale $ 53.900 en Día, $ 719 menos que la semana pasada

#### Scenario: Lista cambiada
- **GIVEN** el usuario sumó productos desde la última semana
- **WHEN** abre la app
- **THEN** la tarjeta muestra el total de hoy sin comparar con la semana pasada
