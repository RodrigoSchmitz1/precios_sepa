# Spec Delta

## ADDED Requirements

### Requirement: Las promos del día se ven al abrir
En la portada, tus avisos y las promos del día SHALL ir inmediatamente después del buscador y las cifras, antes del ejemplo de precios y de "¿Qué querés saber?". En un teléfono de 375 px, el título de las promos del día SHALL quedar dentro de la primera pantalla. Abrir el mapa SHALL mostrarlo en ese mismo lugar.

#### Scenario: Abrir la app en el celular
- **GIVEN** la zona es Palermo y el usuario abre la portada en un teléfono de 375 × 812
- **WHEN** termina de cargar
- **THEN** ve "Las promos del día" sin desplazarse, debajo del buscador y de las cifras
- **AND** las filas por categoría y por súper quedan más abajo

#### Scenario: Las cifras no empujan las promos
- **GIVEN** la portada tiene tres cifras
- **WHEN** se ve en el celular
- **THEN** las cifras van en una fila que se desliza de costado, empezando por la primera
