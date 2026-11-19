## ADDED Requirements

### Requirement: Tu lista dice cuánto sale con las promos cerca, aparte
Con una zona elegida, Tu lista SHALL mostrar, aparte del total de siempre, cuánto sale la lista en cada cadena cerca si se aprovechan sus promos vigentes. La cuenta SHALL usar una sola sucursal por cadena, a menos de 3 km de la zona: la que deja la lista más barata. Cada producto SHALL contar al menor entre su precio de lista y la promo de esa sucursal. Las promos de compra múltiple NO SHALL contarse. El total de siempre NO SHALL cambiar.

#### Scenario: Palermo con promos en Día
- **GIVEN** la zona es Palermo, la lista es más barata en Maxi a precio de lista, y con las promos del Día de Cl Thames 2447 la misma lista sale menos
- **WHEN** el usuario abre Tu lista
- **THEN** el total de siempre sigue diciendo Maxi, y una línea aparte dice cuánto sale en el Día de Cl Thames 2447 con promos, cuántos productos están en promo y hasta cuándo

#### Scenario: Las promos no cambian el ganador
- **GIVEN** con o sin promos la cadena más barata de la lista es la misma, al mismo total
- **WHEN** el usuario abre Tu lista
- **THEN** no aparece la línea de promos

#### Scenario: Un 2x1 no cuenta
- **GIVEN** la única promo de un producto es "2do al 70%"
- **WHEN** se calcula el total con promos
- **THEN** ese producto cuenta a su precio de lista

### Requirement: Las cadenas que casi no informan promos se nombran
Cuando la cuenta con promos incluye cadenas cerca que informan menos de 50 promos por sucursal en SEPA, Tu lista SHALL nombrarlas y decir que, si tienen promos, no están en esa cuenta. El umbral SHALL vivir en un solo lugar.

#### Scenario: Coto y Jumbo cerca
- **GIVEN** la zona tiene Coto y Jumbo cerca, que casi no informan promos
- **WHEN** el usuario ve la línea de promos
- **THEN** lee que Coto y Jumbo casi no informan promos en SEPA y que, si tienen, no están en esa cuenta

### Requirement: El titular del producto avisa si una promo cerca gana
En el detalle de un producto con zona, si una promo vigente cerca, sin compra múltiple, deja el producto por debajo del precio más bajo de las cadenas de la zona, debajo del titular SHALL decirse en una línea el precio con promo, la cadena, la sucursal y hasta cuándo vale. El titular de precio de lista NO SHALL cambiar.

#### Scenario: Tres Arroyos
- **GIVEN** la zona es Tres Arroyos, la Playadito de 1 kg sale $ 4.890 en Vea, y la Cooperativa Obrera de calle Colón la tiene en promo a $ 4.080 hasta el 30/11
- **WHEN** el usuario abre el detalle
- **THEN** el titular sigue diciendo Vea, y debajo lee "Con promo: $ 4.080 en la Cooperativa Obrera de Colón, hasta el 30/11"

#### Scenario: Sin promo que gane
- **GIVEN** ninguna promo cerca baja del precio más bajo de la zona
- **WHEN** el usuario abre el detalle
- **THEN** no hay línea de promo debajo del titular
