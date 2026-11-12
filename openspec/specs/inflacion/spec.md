# inflacion Specification

## Purpose
Medir cuánto se movieron los precios de supermercado en el mes, por categoría y
para la canasta básica, y comunicar sobre qué alcance se midió.

## Requirements

### Requirement: La inflación es nacional
La página de Inflación SHALL medir con todas las cadenas del país, tenga o no
el usuario una zona elegida, y SHALL decir que es de todo el país cuando hay una
zona elegida.

#### Scenario: Inflación con zona elegida
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario abre Inflación
- **THEN** ve las mismas cifras que sin zona, con una aclaración de que son de todo el país
