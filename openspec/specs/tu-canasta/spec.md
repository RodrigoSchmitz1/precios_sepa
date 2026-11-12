# tu-canasta Specification

## Purpose
Cotizar la compra del mes del usuario con precios de las sucursales de las
localidades que elige, y compararla entre cadenas.

## Requirements

### Requirement: La zona entra como localidad
Al abrir Tu canasta con una zona elegida y sin localidades cargadas, la zona
SHALL entrar como la primera localidad. El usuario SHALL poder sacarla o sumar
otras, hasta tres, sin que eso cambie su zona.

#### Scenario: Primera visita con zona
- **GIVEN** la zona es "Rosario, Santa Fe" y Tu canasta no tiene localidades
- **WHEN** el usuario abre Tu canasta
- **THEN** "Rosario, Santa Fe" ya figura como localidad elegida

#### Scenario: Canasta guardada con otras localidades
- **GIVEN** el usuario ya había guardado una canasta con "Córdoba, Córdoba"
- **WHEN** abre Tu canasta con la zona "Rosario, Santa Fe"
- **THEN** conserva "Córdoba, Córdoba" y no agrega la zona sola

### Requirement: Zona sin precios por categoría
Si la zona no tiene precios suficientes para cotizar la canasta, Tu canasta
SHALL decirlo y no SHALL agregarla como localidad.

#### Scenario: Zona sin datos para cotizar
- **GIVEN** la zona es un barrio con sucursales pero sin precios de la canasta
- **WHEN** el usuario abre Tu canasta
- **THEN** ve que su zona no tiene precios para cotizar y puede elegir otra localidad
