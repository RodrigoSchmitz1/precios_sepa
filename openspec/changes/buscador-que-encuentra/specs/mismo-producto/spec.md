# Spec Delta

## ADDED Requirements

### Requirement: La búsqueda encuentra palabras, no pedazos
Cada palabra buscada SHALL coincidir con el comienzo de una palabra del producto
(su descripción, su marca, su tamaño o como lo llama alguna cadena). Una palabra
buscada SHALL NOT coincidir con el medio de una palabra. El plural SHALL
encontrar el singular.

#### Scenario: Pan no es empanada
- **WHEN** el usuario busca "pan"
- **THEN** no aparecen tapas de empanada, y los pañales (que sin tilde empiezan con "pan") van después de todo lo que dice "pan" entero

#### Scenario: Una palabra empezada
- **WHEN** el usuario busca "gall"
- **THEN** aparecen galletitas

#### Scenario: Plural
- **GIVEN** un producto que se llama "HUEVO BLANCO AVICOPER CARTON X 30 UNI"
- **WHEN** el usuario busca "huevos"
- **THEN** ese producto aparece

### Requirement: La búsqueda tolera la ortografía
La búsqueda SHALL tratar como iguales la b y la v, la s, la z y la c antes de e o
de i, la y y la ll, y SHALL ignorar la h. La comparación SHALL seguir sin
distinguir mayúsculas ni tildes.

#### Scenario: Yerva
- **WHEN** el usuario busca "yerva"
- **THEN** aparecen los mismos productos que buscando "yerba"

### Requirement: La categoría buscada va primero
Los resultados SHALL ir primero si la categoría del producto tiene alguna
palabra buscada entera, con su plural. Entre ellos SHALL ir primero los de la
categoría que la búsqueda nombra entera.

#### Scenario: Leche
- **WHEN** el usuario busca "leche"
- **THEN** los primeros resultados son de la categoría Leche fluida, y los chocolates y golosinas con leche van después

#### Scenario: Huevos
- **WHEN** el usuario busca "huevos"
- **THEN** los primeros resultados son de la categoría Huevos, y el huevo Kinder va después

#### Scenario: Pan antes que pan rallado
- **WHEN** el usuario busca "pan"
- **THEN** la categoría Pan va antes que Rebozadores y pan rallado, y ninguna de las dos coincide con Panales

### Requirement: Después, el nombre que muestra la página
Dentro del mismo nivel de categoría, SHALL ir primero el producto cuyo nombre
visible tiene todas las palabras buscadas, después el que las tiene enteras, y
a igualdad el que venden más cadenas y el de descripción más corta.

#### Scenario: Una búsqueda que ya andaba
- **WHEN** el usuario busca "fideos"
- **THEN** los resultados siguen siendo fideos, primero los que dicen FIDEOS en su nombre
