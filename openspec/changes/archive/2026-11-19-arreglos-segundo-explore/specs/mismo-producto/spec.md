## ADDED Requirements

### Requirement: La búsqueda entiende las unidades escritas
La búsqueda SHALL leer las unidades escritas con palabras como su abreviatura. "litro", "litros", "lt" y "lts" valen "l"; "kilo", "kilos" y "kilogramos" valen "kg"; "gramo", "gramos" y "grs" valen "g". Un número seguido de su unidad, con o sin espacio, SHALL encontrar el mismo tamaño que "1l", "1kg" o "500g".

#### Scenario: Un litro escrito entero
- **GIVEN** La Serenísima tiene leches de 1 L en Mismo producto
- **WHEN** el usuario busca "leche la serenisima 1 litro"
- **THEN** ve las mismas leches que con "leche la serenisima 1l"

#### Scenario: Gramos
- **WHEN** el usuario busca "playadito 500 gramos"
- **THEN** ve la yerba Playadito de 500 g

### Requirement: Las sucursales de la zona se dicen como del país
En la sección "En tu zona" del detalle, la cantidad de sucursales de cada cadena SHALL decir que es del país ("969 sucursales en el país"), porque el precio y el conteo son de toda la cadena y no de la zona.

#### Scenario: Día en Palermo
- **GIVEN** la zona es Palermo y Día tiene 969 sucursales en el país
- **WHEN** el usuario abre un producto
- **THEN** la fila de Día en "En tu zona" dice "969 sucursales en el país"

### Requirement: Sin precio cerca no es sin stock
Cuando ninguna cadena cerca de la zona informa precio de un producto de la lista, Tu lista SHALL decir que ninguna cadena cerca informa su precio. NO SHALL decir que el producto no se consigue o que nadie lo vende: SEPA es una lista de precios, no de existencias.

#### Scenario: Un producto sin precio cerca
- **GIVEN** la zona es Rafaela y ninguna cadena cerca informa precio del alfajor regional
- **WHEN** el usuario abre Tu lista
- **THEN** lee "Ninguna cadena cerca informa precio de: Alfajor regional", y no "No se consigue en tu zona"
