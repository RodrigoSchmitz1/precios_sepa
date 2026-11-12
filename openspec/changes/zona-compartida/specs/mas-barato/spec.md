# Spec Delta

## Purpose

Decir qué cadena tiene el precio más bajo más seguido en cada categoría, entre
todas las del país o entre las que el usuario tiene cerca.

## ADDED Requirements

### Requirement: Quién gana entre las cadenas de tu zona
Con una zona elegida, Más barato SHALL calcular el ganador de cada categoría y
el líder general solo entre las cadenas con sucursal en la zona, con la misma
regla que la vista nacional (un empate cuenta para todas las empatadas).

#### Scenario: Ganador en la zona
- **GIVEN** en Palermo hay Dia, Coto, Express, Market, Carrefour, Jumbo y Disco, pero no Maxi
- **WHEN** el usuario abre Más barato
- **THEN** el ganador de cada categoría sale de esas siete cadenas, y Maxi no aparece como ganadora

### Requirement: La vista nacional a un toque
Más barato SHALL dejar pasar de la vista de la zona a la de todo el país y
volver, sin cambiar la zona del usuario.

#### Scenario: Ver todo el país
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario elige ver todo el país
- **THEN** ve el ranking nacional, y el encabezado sigue diciendo "Palermo, CABA"

### Requirement: Zona con una sola cadena
Si la zona tiene una sola cadena, Más barato SHALL decir que no hay con qué
comparar en la zona y mostrar la vista nacional.

#### Scenario: Pueblo con una cadena
- **GIVEN** la zona es una localidad donde solo hay La Anónima
- **WHEN** el usuario abre Más barato
- **THEN** lee que en su zona hay una sola cadena y ve el ranking de todo el país
