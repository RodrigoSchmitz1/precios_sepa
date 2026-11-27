## ADDED Requirements

### Requirement: Lo que comprás seguido se vigila solo
Los productos de la compra habitual de Mis gastos SHALL contar como avisos sin que el usuario los pida: entran en el bloque de Promos que dice cuáles están de oferta cerca, con la misma búsqueda de promos. NO SHALL ocupar lugar en el tope de 50 avisos. Cada uno SHALL decir que se vigila porque lo compra seguido y SHALL poder silenciarse. Un producto silenciado no vuelve aunque siga en la compra habitual. Si un producto está en los avisos y en la compra habitual, SHALL aparecer una sola vez.

#### Scenario: La yerba que compra siempre
- **GIVEN** la zona es Palermo, la yerba está en la compra habitual del usuario y está en promo en Coto, cerca
- **WHEN** el usuario abre Promos
- **THEN** ve la promo de la yerba en el bloque de sus avisos, marcada como algo que compra seguido

#### Scenario: Silenciar un producto
- **GIVEN** la leche se vigila porque está en la compra habitual
- **WHEN** el usuario la silencia
- **THEN** la leche deja de aparecer en el bloque, aunque siga comprándola

#### Scenario: Sin compra habitual
- **GIVEN** el usuario no tiene compra habitual
- **WHEN** abre Promos
- **THEN** el bloque muestra solo los avisos que pidió
