## ADDED Requirements

### Requirement: Dónde comprarla compara opciones que cubren lo mismo
En "Dónde comprarla cerca tuyo", el mejor total SHALL ser el de la opción que cubre más categorías y, entre las que cubren lo mismo, el más barato. La diferencia "contra una sola" SHALL calcularse solo si las dos opciones cubren las mismas categorías. Cada opción que no cubre todas las categorías SHALL decir cuántas cubre o cuáles le faltan.

#### Scenario: Una sucursal que no tiene todo
- **GIVEN** en una sucursal la canasta sale $ 144.427 con 26 de 27 categorías, y en dos sale $ 146.661 con las 27
- **WHEN** el usuario mira el paso 4
- **THEN** el mejor total es el de dos sucursales, la opción de una dice que cubre 26 de 27, y no aparece una diferencia "contra una sola"

### Requirement: Dónde comprarla arranca en el radio de la zona
El radio inicial de "Dónde comprarla cerca tuyo" SHALL ser el mismo que define las cadenas cerca de la zona (3 km), y las opciones de radio SHALL incluirlo.

#### Scenario: El Maxi de Lomas
- **GIVEN** la zona es Lomas de Zamora y el Maxi está a 2,5 km de su centro
- **WHEN** el usuario llega al paso 4
- **THEN** el radio es de 3 km y el Maxi entra en las sucursales consideradas
