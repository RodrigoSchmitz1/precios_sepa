## ADDED Requirements

### Requirement: Tu canasta compara supermercados
Tu canasta SHALL cotizar y comparar solo supermercados. Ni la comparación entre cadenas ni Dónde comprarla SHALL incluir una farmacia, porque no vende la mayor parte de una compra del mes.

#### Scenario: Una localidad con Farmacity
- **GIVEN** la zona tiene sucursales de Farmacity
- **WHEN** el usuario cotiza su canasta
- **THEN** ninguna opción ni cadena de la comparación es Farmacity
