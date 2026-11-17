# Spec Delta

## Purpose
Decir en la portada, con las cifras del día, dónde le conviene comprar a quien
la mira: en su zona si eligió una, y en todo el país si no.

## ADDED Requirements

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
Con una zona elegida en la que SEPA informa una sola cadena, la portada SHALL
decirlo y SHALL mostrar cuánto sale ahí la canasta básica, sin un porcentaje de
ahorro ni un ranking.

#### Scenario: Rafaela
- **GIVEN** la zona es "Rafaela, Santa Fe", donde la única cadena es La Anónima
- **WHEN** el usuario abre la portada
- **THEN** lee que en su zona SEPA informa solo La Anónima y cuánto sale ahí la canasta básica, sin un "ahorrás"

### Requirement: Lo nacional se dice como nacional
Con una zona elegida, cada tarjeta de la portada que siga mostrando un dato de
todo el país SHALL decirlo en la misma tarjeta.

#### Scenario: Lo que más subió
- **GIVEN** hay una zona elegida
- **WHEN** el usuario mira la tarjeta "Lo que más subió"
- **THEN** la tarjeta dice que es de todo el país
