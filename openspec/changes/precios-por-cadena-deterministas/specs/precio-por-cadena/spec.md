# Spec Delta

## Purpose

Definir cómo se calcula el precio y el tamaño de un producto en una cadena a
partir de lo que informan sus sucursales, para que Mismo producto, Quién gana, la
historia y los cambios de precio partan de un número estable y reproducible.

## ADDED Requirements

### Requirement: El precio de una cadena es la mediana de sus sucursales
El precio de un producto en una cadena para una fecha SHALL ser la mediana exacta
de los precios que informan sus sucursales ese día. Con una cantidad par de
precios SHALL ser el menor de los dos del medio, así el precio publicado es
siempre uno que alguna sucursal cobra.

#### Scenario: Cantidad impar de precios
- **GIVEN** una cadena con tres sucursales que informan $100, $120 y $300
- **WHEN** se calcula su precio
- **THEN** el precio es $120

#### Scenario: Cantidad par de precios
- **GIVEN** una cadena con cuatro sucursales que informan $100, $110, $130 y $500
- **WHEN** se calcula su precio
- **THEN** el precio es $110, no el promedio $120

#### Scenario: Una sola sucursal
- **GIVEN** una cadena con una sola sucursal que informa $250
- **WHEN** se calcula su precio
- **THEN** el precio es $250

### Requirement: El tamaño de una cadena es uno que declaró alguna sucursal
El tamaño del envase de un producto en una cadena SHALL ser la mediana baja de las
cantidades que declaran sus sucursales, ignorando las que no se reconocen. Si
ninguna sucursal declara una cantidad reconocible, el tamaño SHALL quedar vacío
sin cortar el cálculo del resto.

#### Scenario: Dos tamaños declarados
- **GIVEN** una cadena con dos sucursales que declaran 500 g y 1.000 g
- **WHEN** se calcula su tamaño
- **THEN** el tamaño es 500 g, nunca 750 g

#### Scenario: Ninguna cantidad reconocible
- **GIVEN** una cadena cuyas sucursales no traen una cantidad reconocible
- **WHEN** se calcula su tamaño
- **THEN** el tamaño queda vacío y el precio de esa cadena se calcula igual

### Requirement: Los mismos datos dan el mismo precio
Dos cálculos del precio y del tamaño por cadena hechos sobre los mismos datos de
SEPA SHALL dar exactamente el mismo resultado, fila por fila.

#### Scenario: Reconstrucción con los mismos datos
- **GIVEN** el precio por cadena de una fecha ya calculado
- **WHEN** se vuelve a calcular esa fecha sin que cambie el crudo
- **THEN** ningún precio, tamaño, mínimo, máximo ni cantidad de sucursales cambia
