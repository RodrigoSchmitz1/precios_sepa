# mas-barato Specification

## Purpose
Decir qué cadena tiene el precio más bajo más seguido en cada categoría, entre
todas las del país o entre las que el usuario tiene cerca.

## Requirements

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

### Requirement: La vista nacional usa las cadenas de Mismo producto
La vista nacional de Más barato SHALL calcular el ganador de cada categoría con
todas las cadenas que tienen precios en Mismo producto, incluidas las
arrastradas, y con la misma regla que la vista de la zona.

#### Scenario: Día sin Cencosud
- **GIVEN** el 2026-11-11 Jumbo, Disco y Vea se muestran con precios del 2026-11-10
- **WHEN** el usuario abre Más barato sin zona
- **THEN** Jumbo, Disco y Vea compiten en cada categoría

#### Scenario: Día completo
- **GIVEN** todas las cadenas tienen precios del último día
- **WHEN** el usuario abre Más barato sin zona
- **THEN** el ganador de cada categoría y sus porcentajes coinciden con `mart_quien_gana` de ese día

### Requirement: Más barato sin el cuadro de categorías por cadena
Más barato SHALL mostrar el líder y el ganador de cada categoría sin el cuadro que cruza cada categoría con cada cadena. Las reglas para elegir ganadores en la zona y en el país no cambian.

#### Scenario: Abrir Más barato
- **GIVEN** la zona es Palermo
- **WHEN** el usuario abre Más barato desde el menú Más
- **THEN** ve el líder de su zona y el ganador de cada categoría, y no ve el cuadro de categorías por cadena
