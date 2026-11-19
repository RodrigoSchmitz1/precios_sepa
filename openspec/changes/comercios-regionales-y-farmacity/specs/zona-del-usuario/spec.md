## ADDED Requirements

### Requirement: Una farmacia no cuenta como cadena cerca
Las cadenas de una zona SHALL ser solo supermercados. Una farmacia con sucursal en la zona o a menos de 3 km SHALL listarse aparte, como farmacia cerca. No SHALL sumarse a la cantidad de cadenas que muestra el selector, ni sacar a una zona de "una sola cadena".

#### Scenario: Una ciudad con un supermercado y un Farmacity
- **GIVEN** en una ciudad hay sucursales de La Anónima y de Farmacity, y ningún otro supermercado a menos de 3 km
- **WHEN** el usuario la elige
- **THEN** el selector dice 1 cadena cerca, y las páginas tratan la zona como de una sola cadena
