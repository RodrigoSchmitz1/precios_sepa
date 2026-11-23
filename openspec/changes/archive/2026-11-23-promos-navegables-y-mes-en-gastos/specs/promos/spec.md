# Spec Delta

## MODIFIED Requirements

### Requirement: Promos arranca en tu zona
Con una zona elegida, la vidriera de Promos, el mapa cuando se abre y las páginas de categoría SHALL mostrar las promos cerca de esa zona, y el mapa SHALL abrir centrado en ella. Sin zona, la vidriera SHALL mostrar las promos de todo el país e invitar a elegir la zona.

#### Scenario: Abrir promos con zona
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario abre Promos
- **THEN** la vidriera muestra promos de sucursales cerca de Palermo
- **AND** si toca "Ver en el mapa", el mapa está centrado en Palermo y la lista muestra las promos de esa zona

#### Scenario: Abrir promos sin zona
- **GIVEN** el usuario no eligió zona
- **WHEN** abre Promos
- **THEN** ve la vidriera con promos de todo el país y una línea que lo invita a elegir su zona para ver las de cerca

## ADDED Requirements

### Requirement: Promos abre como vidriera
Promos SHALL abrir con una vidriera y no con el mapa: primero las promos fuertes del día, después filas por categoría y después filas por súper. Cada fila SHALL mostrar pocas promos y la cantidad que hay cerca. Cada fila de categoría SHALL llevar con "Ver todas" a su página, y cada fila de súper SHALL llevar al mapa.

#### Scenario: Primera pantalla en el celular
- **GIVEN** la zona es "Caballito, CABA" y el usuario abre Promos en un teléfono de 390 px
- **WHEN** termina de cargar
- **THEN** ve las promos fuertes del día antes que cualquier mapa
- **AND** el mapa no se cargó

#### Scenario: Una fila por categoría
- **GIVEN** cerca de la zona hay promos de Almacén
- **WHEN** el usuario baja por la vidriera
- **THEN** ve la fila "Almacén" con la cantidad de promos cerca, sus mejores promos y "Ver todas"

### Requirement: Las promos fuertes se eligen por lo que se puede aprovechar
Las promos fuertes del día SHALL ser promos vigentes, sin compra múltiple, con evidencia, presentes en más de una sucursal cerca cuando haya, ordenadas por descuento. SHALL NOT repetirse el mismo producto ni pasar de 3 promos de la misma cadena.

#### Scenario: Una crema al 70% en una sola sucursal
- **GIVEN** cerca de la zona hay una crema al 70% en una sola sucursal y un aceite al 35% en ocho
- **WHEN** se arman las promos fuertes
- **THEN** el aceite aparece y la crema no

#### Scenario: Un 2x1 no es promo fuerte
- **GIVEN** la promo de mayor descuento cerca es "2do al 70%"
- **WHEN** se arman las promos fuertes
- **THEN** esa promo no está entre las fuertes

#### Scenario: Una cadena no copa la vidriera
- **GIVEN** las diez promos de mayor descuento cerca son de Carrefour
- **WHEN** se arman las promos fuertes
- **THEN** hay a lo sumo 3 de Carrefour

### Requirement: Las filas por súper son de las cadenas de la zona
Con zona, la vidriera SHALL tener una fila por cada cadena con sucursal cerca que tenga promos, con sus mejores promos. Las farmacias SHALL NOT tener fila. Las cadenas que casi no informan promos en SEPA SHALL NOT tener fila y SHALL nombrarse en una línea, con el mismo umbral que Tu lista.

#### Scenario: Palermo
- **GIVEN** la zona es Palermo y cerca hay Día, Carrefour, Coto y Jumbo
- **WHEN** el usuario baja a las filas por súper
- **THEN** ve una fila de Día y una de Carrefour, y una línea que dice que Coto y Jumbo casi no informan promos en SEPA

### Requirement: El mapa se abre a pedido
El mapa de promos y el listado completo SHALL abrirse con un botón "Ver en el mapa" y SHALL funcionar como hasta ahora: filtros, buscador de lugares, provincia, orden y categorías. Ni el mapa ni las promos de la zona visible SHALL pedirse antes de que el usuario lo abra. Un link a Promos con el mapa abierto SHALL abrirlo de entrada.

#### Scenario: Abrir el mapa
- **GIVEN** el usuario está en la vidriera
- **WHEN** toca "Ver en el mapa"
- **THEN** ve el mapa centrado en su zona con el listado de promos de lo que muestra

#### Scenario: Compartir el mapa abierto
- **GIVEN** el usuario abrió el mapa y copia el link
- **WHEN** otra persona abre ese link
- **THEN** ve el mapa abierto

### Requirement: Cada categoría tiene su página de promos
Cada categoría de la vidriera SHALL tener una página con todas sus promos cerca de la zona, con sus subcategorías como filtro, el buscador de productos y los dos órdenes de la página Promos. SHALL contar las promos igual que la vidriera: la cantidad de la fila y la de la página SHALL coincidir. La página SHALL tener su propia dirección para compartirla.

#### Scenario: Ver todas las de Limpieza
- **GIVEN** la zona es Caballito
- **WHEN** el usuario toca "Ver todas" en la fila Limpieza
- **THEN** llega a la página de Limpieza con todas sus promos cerca, ordenadas por cantidad de sucursales, y puede filtrar por "Lavandina"
- **AND** si la fila decía "Limpieza · 185 promos", la página dice 185 promos

#### Scenario: Categoría sin promos cerca
- **GIVEN** cerca de la zona no hay promos de Bebés
- **WHEN** el usuario abre la página de Bebés
- **THEN** lee que no hay promos de Bebés cerca y puede volver a la vidriera

### Requirement: La vidriera no consulta BigQuery
Armar la vidriera y las páginas de categoría SHALL resolverse con los datos que la API ya tiene en memoria, sin una consulta a BigQuery por pedido.

#### Scenario: Cien visitas en zonas distintas
- **GIVEN** cien personas abren la vidriera desde zonas distintas
- **WHEN** el sitio arma cada vidriera
- **THEN** no se ejecuta ninguna consulta nueva en BigQuery
