# Spec Delta

## ADDED Requirements

### Requirement: Las promos de mayoristas se ven marcadas
Las promos de un mayorista SHALL aparecer en el mapa de promos y en el detalle de un producto, identificadas como de mayorista y con las unidades del bulto. En la vidriera, un mayorista con sucursal cerca que tenga promos SHALL tener su fila, identificada como mayorista, después de las filas de súper.

#### Scenario: Promo de Yaguar cerca
- **GIVEN** Yaguar tiene una sucursal cerca de la zona con una promo en un producto
- **WHEN** el usuario abre Promos
- **THEN** ve la fila de Yaguar después de las de súper, marcada como mayorista, y la promo dice el bulto
