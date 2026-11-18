# Spec Delta

## ADDED Requirements

### Requirement: En Tu lista, una diferencia chica se dice como chica
Cuando en Tu lista la cadena más cara entre las comparadas cobra menos de un 5%
más que la más barata, el titular SHALL decir que la compra cuesta casi lo mismo
y la diferencia en pesos, y SHALL NOT presentarla como ahorro. Vale con zona y
sin zona, con el mismo umbral que el detalle del producto.

#### Scenario: Lomas de Zamora con 2% de diferencia
- **GIVEN** la lista sale $ 13.088 en la cadena más barata de la zona y $ 13.300 en la más cara
- **WHEN** el usuario ve Tu lista
- **THEN** el titular dice que cuesta casi lo mismo, con una diferencia de $ 212, sin "ahorrás"

#### Scenario: Una diferencia grande
- **GIVEN** la lista sale $ 10.000 en la más barata y $ 11.000 en la más cara
- **WHEN** el usuario ve Tu lista
- **THEN** el titular dice cuánto ahorra, como hasta ahora
