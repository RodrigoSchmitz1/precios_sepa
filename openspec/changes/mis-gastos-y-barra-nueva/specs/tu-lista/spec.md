# Spec Delta

## MODIFIED Requirements

### Requirement: Mi lista está en la barra del celular
La barra de secciones de abajo, en el celular, SHALL tener, en este orden: "Promos" (la portada), "Buscar" (Mismo producto), "Mi lista" (lleva a `/lista` y muestra cuántos productos tiene), "Mis gastos" (`/gastos`) y "Más". "Más" SHALL abrir un menú con Más barato, Tu canasta, Inflación y Cómo se calcula. Esas secciones SHALL seguir accesibles desde el menú de la computadora, desde la portada y por su dirección.

#### Scenario: Ir a la lista desde cualquier página
- **GIVEN** el usuario tiene 5 productos en su lista y está en Mismo producto, en el celular
- **WHEN** mira la barra de abajo
- **THEN** ve "Mi lista" con un 5, y tocarla lo lleva a Tu lista

#### Scenario: Inflación sigue existiendo
- **WHEN** el usuario abre `/inflacion`
- **THEN** ve la sección de Inflación como antes

#### Scenario: Más barato desde el menú Más
- **GIVEN** el usuario está en el celular
- **WHEN** toca "Más" y elige "Más barato"
- **THEN** ve la sección Más barato, y "Más" queda marcado en la barra

#### Scenario: Mis gastos en la barra
- **WHEN** el usuario toca "Mis gastos" en la barra del celular
- **THEN** ve la página `/gastos`
