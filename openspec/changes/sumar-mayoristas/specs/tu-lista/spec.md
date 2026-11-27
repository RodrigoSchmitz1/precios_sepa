# Spec Delta

## ADDED Requirements

### Requirement: Tu lista muestra los mayoristas cerca aparte
Con una zona elegida, Tu lista SHALL mostrar en una sección aparte cada mayorista con sucursal cerca que venda productos de la lista: cuántos de los productos tiene y cuánto suman por unidad comprando el bulto. Los mayoristas SHALL NOT entrar en el titular, el ahorro, los totales por cadena ni la combinación de cadenas.

#### Scenario: Maxiconsumo cerca con 7 de 10 productos
- **GIVEN** la lista tiene 10 productos y Maxiconsumo, con sucursal cerca, vende 7
- **WHEN** el usuario abre Tu lista
- **THEN** ve una línea de Maxiconsumo con 7 de 10 productos y su suma por unidad comprando el bulto, y el titular y el ahorro siguen siendo entre súper

#### Scenario: Sin mayoristas cerca
- **GIVEN** ningún mayorista tiene sucursal cerca de la zona
- **WHEN** el usuario abre Tu lista
- **THEN** no aparece la sección de mayoristas
