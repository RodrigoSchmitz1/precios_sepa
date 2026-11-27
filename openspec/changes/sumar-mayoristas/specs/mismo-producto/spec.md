# Spec Delta

## ADDED Requirements

### Requirement: Los mayoristas se muestran aparte, comprando el bulto
En el detalle de un producto, los mayoristas que lo venden SHALL aparecer en un bloque aparte de las cadenas de súper, identificados como mayoristas. Cada uno SHALL mostrar el precio por unidad, las unidades del bulto y el precio del bulto.

#### Scenario: Desodorante en Maxiconsumo
- **GIVEN** Maxiconsumo vende un desodorante a $1.979,87 por unidad en bulto de 12
- **WHEN** el usuario abre ese producto
- **THEN** ve a Maxiconsumo en el bloque de mayoristas con "$ 1.980 c/u" y "comprando el bulto de 12 ($ 23.758)", en pesos sin centavos como el resto del sitio

#### Scenario: Un producto que ningún mayorista vende
- **GIVEN** ningún mayorista informa un producto
- **WHEN** el usuario lo abre
- **THEN** no aparece el bloque de mayoristas

### Requirement: Los mayoristas no cuentan para la más barata ni la brecha
La cadena más barata, la más cara, la diferencia entre ellas, la referencia del mercado y la credibilidad de un precio SHALL calcularse solo con las cadenas que no son mayoristas, con zona o sin ella.

#### Scenario: Nini más barato que todos los súper
- **GIVEN** un producto cuesta $1.500 por unidad en Nini y entre $2.000 y $2.400 en los súper
- **WHEN** el usuario abre ese producto
- **THEN** el titular nombra al súper de $2.000 como el más barato y la diferencia es entre $2.000 y $2.400

### Requirement: El bloque de mayoristas compara con el súper más barato
Cada mayorista del bloque SHALL decir cuánto más barato o más caro sale por unidad que la cadena de súper más barata del producto, con zona o sin ella según corresponda.

#### Scenario: Maxiconsumo contra el súper más barato
- **GIVEN** el súper más barato cobra $2.000 y Maxiconsumo $1.700 por unidad comprando el bulto
- **WHEN** el usuario abre ese producto
- **THEN** Maxiconsumo dice que sale 15% menos por unidad comprando el bulto

### Requirement: Con zona, los mayoristas cerca van primero
Con una zona elegida, el bloque de mayoristas SHALL mostrar primero los que tienen sucursal cerca de la zona, con el mismo radio que las cadenas de la zona, y después los demás.

#### Scenario: Zona con Makro cerca
- **GIVEN** la zona tiene una sucursal de Makro a 2 km y Maxiconsumo no tiene ninguna cerca
- **WHEN** el usuario abre un producto que venden los dos
- **THEN** Makro aparece primero, marcado como cerca
