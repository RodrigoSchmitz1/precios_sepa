# Spec Delta

## ADDED Requirements

### Requirement: Un mayorista cerca se lista aparte
Un mayorista con sucursal en la zona o a menos de 3 km de su centro SHALL listarse aparte, como mayorista cerca. SHALL NOT sumarse a la cantidad de cadenas que muestra el selector ni a las cadenas de la zona que usan las comparaciones.

#### Scenario: Zona con Makro cerca
- **GIVEN** cerca de la zona hay Día, Coto y una sucursal de Makro
- **WHEN** el usuario elige esa zona
- **THEN** el selector dice 2 cadenas cerca y nombra a Makro como mayorista cerca
