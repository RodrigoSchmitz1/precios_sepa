# Spec Delta

## MODIFIED Requirements

### Requirement: La inflación es nacional
La página de Inflación SHALL medir con todas las cadenas de súper del país, sin
mayoristas, tenga o no el usuario una zona elegida, y SHALL decir que es de todo
el país cuando hay una zona elegida.

#### Scenario: Inflación con zona elegida
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario abre Inflación
- **THEN** ve las mismas cifras que sin zona, con una aclaración de que son de todo el país

#### Scenario: Los mayoristas no mueven el índice
- **GIVEN** el interruptor de mayoristas se enciende
- **WHEN** corre dbt
- **THEN** el índice de ese día es el mismo que sin mayoristas
