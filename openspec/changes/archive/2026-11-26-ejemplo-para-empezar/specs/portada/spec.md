# Spec Delta

## ADDED Requirements

### Requirement: Camino al ahorro en la primera visita
Cuando la lista es de ejemplo, la tarjeta de tu lista en la portada SHALL mostrar cuánto sale esa compra en la cadena más barata de la zona, con el título "Mirá cuánto ahorrás en tu compra" y la aclaración de que es una compra de ejemplo, y SHALL llevar a Mi compra. Con la lista propia, la tarjeta SHALL seguir como antes. Al pie de la comparación de Mi compra SHALL haber un paso siguiente que lleva a Mis gastos.

#### Scenario: Primera visita a la portada
- **WHEN** alguien abre la portada por primera vez con una zona elegida
- **THEN** ve "Mirá cuánto ahorrás en tu compra" con el total de la compra de ejemplo en la cadena más barata, y al tocarla llega a Mi compra
