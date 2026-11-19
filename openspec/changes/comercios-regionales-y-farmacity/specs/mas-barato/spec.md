## ADDED Requirements

### Requirement: Una farmacia compite solo en sus rubros
En Más barato, una farmacia SHALL competir solo en las categorías de los rubros Higiene y Bebés, tanto en la vista nacional como en la de la zona. En las demás categorías no SHALL aparecer, aunque informe algún producto suelto.

#### Scenario: Perfumería
- **WHEN** el usuario mira quién gana en Perfumería
- **THEN** Farmacity compite con los supermercados

#### Scenario: Golosinas
- **GIVEN** Farmacity informa algunos chocolates
- **WHEN** el usuario mira quién gana en Golosinas y chocolates
- **THEN** Farmacity no aparece
