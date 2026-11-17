# Spec Delta

## ADDED Requirements

### Requirement: El resultado entra en la primera pantalla
Cuando hay una búsqueda de 2 letras o más, un producto elegido o una lista
guardada, Mismo producto SHALL mostrar su titular en versión compacta, sin
bajada. En un celular de 414x896 el primer resultado SHALL empezar antes de los
320 px.

#### Scenario: Buscar desde el celular
- **WHEN** el usuario busca "yerba playadito" en un celular
- **THEN** el primer resultado se ve sin bajar la pantalla

#### Scenario: Primera visita sin nada
- **GIVEN** no hay búsqueda, producto elegido ni lista guardada
- **WHEN** el usuario entra a Mismo producto
- **THEN** ve el titular completo, con la cifra del día y la bajada

### Requirement: Con zona, el titular del producto es el de la zona
Con una zona elegida y al menos una cadena de la zona que venda el producto con
precio creíble, el titular del producto, la tira de precios y las tarjetas de
cifras SHALL usar solo las cadenas de la zona. Debajo de las tarjetas, una línea
SHALL decir el rango de precios del país.

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires" y el producto es la Playadito de 1 kg
- **WHEN** el usuario lo abre
- **THEN** el titular, la tira y las tarjetas nombran solo cadenas con sucursal en Lomas de Zamora, y Vea aparece solo en la línea del país y en la lista de otras cadenas del país

#### Scenario: Ninguna cadena de la zona lo vende
- **GIVEN** ninguna cadena con sucursal en la zona vende el producto
- **WHEN** el usuario lo abre
- **THEN** el titular dice que en su zona no se consigue, y las tarjetas muestran los precios del país

### Requirement: Una diferencia chica se dice como chica
Cuando la cadena más cara cobra menos de un 5% más que la más barata, el titular
del producto SHALL decir que cuesta casi lo mismo y la diferencia en pesos, sin
destacar el porcentaje. Vale para la comparación de la zona y para la del país.

#### Scenario: Playadito con 3% de diferencia
- **GIVEN** un producto que cuesta $ 5.079 en la más barata y $ 5.250 en la más cara
- **WHEN** el usuario lo abre
- **THEN** el titular dice que cuesta casi lo mismo en todas, con una diferencia de $ 171

## MODIFIED Requirements

### Requirement: La más barata de tu zona
Con una zona elegida y al menos una cadena de la zona que venda el producto,
Mismo producto SHALL decir en el titular cuál es la más barata de la zona y
cuánto más barata es que la más cara de la zona. No SHALL repetirlo en un
recuadro aparte.

#### Scenario: Titular con zona
- **GIVEN** en Palermo el producto sale $ 4.775 en Dia y $ 6.000 en Express
- **WHEN** el usuario lo abre
- **THEN** el titular dice que en su zona la más barata es Dia, un 20% menos que Express

#### Scenario: Ninguna cadena de la zona lo vende
- **GIVEN** ninguna cadena con sucursal en la zona vende el producto
- **WHEN** el usuario lo abre
- **THEN** ve que en su zona no se consigue, y la lista de las cadenas que sí lo venden en el país
