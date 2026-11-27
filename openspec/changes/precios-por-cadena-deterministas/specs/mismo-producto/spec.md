# Spec Delta

## ADDED Requirements

### Requirement: El nombre de un producto no cambia solo
El nombre, la marca y el tamaño que Mismo producto muestra para un producto, y los
textos con que se lo busca, SHALL ser los mismos en dos corridas hechas con los mismos datos. Cuando dos marcas o
dos tamaños empatan en todos los criterios de elección, SHALL ganar siempre el
mismo, decidido por su texto.

#### Scenario: Dos marcas empatadas
- **GIVEN** un producto cuya marca informan dos comercios como "PUREZA D LAS SIERRAS" y otros dos como "PUREZA DE LAS SIERRA", del mismo largo
- **WHEN** se calcula Mismo producto dos veces con los mismos datos
- **THEN** las dos veces muestra la misma marca, "PUREZA D LAS SIERRAS", la primera en orden alfabético

#### Scenario: Dos tamaños empatados
- **GIVEN** un producto que una empresa declara de 500 g y otra de 900 g, con la misma cantidad de sucursales
- **WHEN** se calcula Mismo producto dos veces con los mismos datos
- **THEN** las dos veces muestra el mismo tamaño, 500 g, el de menor cantidad

#### Scenario: Los textos de búsqueda salen en el mismo orden
- **GIVEN** un producto que cuatro comercios describen de formas distintas
- **WHEN** se calcula Mismo producto dos veces con los mismos datos
- **THEN** los textos con que se lo busca son idénticos, en el mismo orden
