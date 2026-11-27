## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Con zona, la cadena más barata es la de tu zona
**Reason**: La tarjeta "Tu súper más barato cerca" se contradecía con la tarjeta de tu compra: nombraba Market mientras la compra salía más barata en Día. La portada queda con una sola cifra, la de tu compra.
**Migration**: La cadena que gana más categorías sigue en Más barato, dentro del menú Más.

### Requirement: Con zona, el ahorro se mide entre las cadenas de tu zona
**Reason**: El ahorro de la canasta básica era otra cifra más al lado de la de tu compra. Medía contra la cadena más cara, que no es una opción real.
**Migration**: La tarjeta de tu compra (o la del ejemplo) muestra el ahorro contra la siguiente opción.

### Requirement: Lo nacional se dice como nacional
**Reason**: Con la salida de "Lo que más subió" y del líder nacional, la portada ya no tiene tarjetas con datos de todo el país. La tarjeta de tu compra dice si compara en la zona o en el país.
**Migration**: "Lo que más subió" queda en Inflación, dentro del menú Más.
