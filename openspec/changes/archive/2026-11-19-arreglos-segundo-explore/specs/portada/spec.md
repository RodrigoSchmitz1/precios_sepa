## ADDED Requirements

### Requirement: El ejemplo de la portada, con zona, compara las cadenas de la zona
Con una zona elegida, la tarjeta del producto de ejemplo de la portada SHALL comparar solo las cadenas cerca de la zona, si al menos dos venden el producto. Si no, SHALL mostrar las del país y decir "en todo el país" en la misma tarjeta.

#### Scenario: Palermo
- **GIVEN** la zona es Palermo y la Coca Cola de 2,25 L la venden varias cadenas cerca
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta compara esas cadenas y no muestra La Anónima

#### Scenario: Una zona con una sola cadena
- **GIVEN** la zona es Rafaela, con una sola cadena cerca
- **WHEN** el usuario abre la portada
- **THEN** la tarjeta muestra cadenas del país y dice "en todo el país"
