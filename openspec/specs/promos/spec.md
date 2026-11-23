# promos Specification

## Purpose
Mostrar los descuentos vigentes que publican las cadenas, empezando por los que
el usuario tiene cerca.

## Requirements

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

### Requirement: Mover el mapa no cambia la zona
Mover el mapa o buscar otro lugar desde el mapa SHALL cambiar lo que se ve en
Promos, pero no la zona del usuario.

#### Scenario: Mirar promos de otro lado
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario arrastra el mapa hasta Belgrano
- **THEN** ve las promos de Belgrano, y el encabezado sigue diciendo "Palermo, CABA"

### Requirement: Las promos de tu lista, cerca de tu zona
Con una zona elegida, Tu lista SHALL mostrar debajo de cada producto la mejor
promo vigente en una sucursal cercana a la zona, siempre que deje el producto
más barato que la cadena más barata de la zona. Arriba de la lista SHALL decir
cuántos productos de la lista están en promo cerca. Lo mismo SHALL valer en
Mismo producto y en `/lista`.

#### Scenario: Un producto de la lista en promo cerca
- **GIVEN** la zona es "Palermo, CABA" y la lista tiene Levité manzana 2,25 L
- **AND** la cadena más barata de la zona la vende a $ 3.500 y un Día a menos de 3 km tiene una promo de 35% a $ 2.470 hasta el 23/11
- **WHEN** el usuario abre Tu lista
- **THEN** debajo de Levité ve "−35% en Día" con la dirección, $ 2.470, "hasta el 23/11" y el sello de evidencia
- **AND** arriba lee que 1 producto de su lista está en promo cerca

#### Scenario: Una promo que no conviene
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires" y la lista tiene un café que Maxi vende a $ 5.989
- **AND** un Carrefour cercano lo tiene en promo a $ 6.383
- **WHEN** el usuario abre Tu lista
- **THEN** el café no muestra ninguna promo

#### Scenario: Ninguna promo cerca
- **GIVEN** la zona elegida y ningún producto de la lista en promo cerca
- **WHEN** el usuario abre Tu lista
- **THEN** no ve ningún bloque de promos ni una línea que diga "0 productos en promo"

### Requirement: Una promo dice dónde, cuánto y hasta cuándo
Cada promo que se muestre en Tu lista o en el detalle SHALL decir la cadena,
la dirección de la sucursal más cercana, el precio, el descuento, hasta cuándo
vale cuando la cadena lo informa, si pide llevar más de una unidad y su nivel
de evidencia, con los mismos textos que la página Promos. Una promo cuya
vigencia ya terminó SHALL NOT mostrarse.

#### Scenario: Promo vencida
- **GIVEN** hoy es 18/11 y la única promo cercana de un producto dice "válida hasta 17/11/2026"
- **WHEN** el usuario abre Tu lista
- **THEN** ese producto no muestra promo

#### Scenario: Promo sin fecha
- **GIVEN** una promo de Día dice "hasta agotar stock" sin fecha
- **WHEN** se muestra en Tu lista
- **THEN** se ve sin "hasta el", con el resto de sus datos

### Requirement: Las promos no cambian el total de la lista
Los totales de Tu lista por cadena y "combinando cadenas" SHALL seguir
calculándose con el precio de cada cadena en todo el país, con o sin promos
cerca. Las promos SHALL presentarse aparte de esos totales.

#### Scenario: Total con un producto en promo
- **GIVEN** la lista sale $ 11.664 en Maxi y uno de sus productos está en promo cerca
- **WHEN** el usuario abre Tu lista
- **THEN** el total de Maxi sigue siendo $ 11.664 y la promo se ve debajo del producto

### Requirement: Sin zona, Tu lista invita a elegirla para ver promos
Sin zona elegida, Tu lista SHALL decir en una línea que eligiendo la zona se
ven las promos cercanas de los productos de la lista, y SHALL NOT mostrar
promos.

#### Scenario: Lista sin zona
- **GIVEN** el usuario no eligió zona y tiene productos en la lista
- **WHEN** abre Tu lista
- **THEN** lee que si elige su zona le muestran qué está en promo cerca, y no ve promos

### Requirement: El detalle de un producto muestra sus promos cerca
Con una zona elegida, el detalle de un producto SHALL mostrar hasta 3 promos
vigentes del producto en sucursales cercanas a la zona que lo dejen más barato
que la cadena más barata de la zona, de la más barata a la más cara, con los
mismos datos que en Tu lista. Sin promos que cumplan eso, o sin zona, el
detalle SHALL NOT mostrar el bloque.

#### Scenario: Detalle con promos cerca
- **GIVEN** la zona es "Caballito, CABA" y Cocinero aceite de girasol 1,5 L está en promo en dos sucursales cercanas por debajo del precio de la zona
- **WHEN** el usuario abre el detalle del producto
- **THEN** ve "En promo cerca tuyo" con las dos promos, la más barata primero

#### Scenario: Detalle sin zona
- **GIVEN** el usuario no eligió zona
- **WHEN** abre el detalle de un producto
- **THEN** no ve el bloque de promos

### Requirement: Las promos de tus productos no consultan BigQuery
Buscar las promos de los productos de una lista o de un detalle SHALL
resolverse con los datos que la API ya tiene en memoria, sin una consulta a
BigQuery por pedido.

#### Scenario: Muchas visitas con listas distintas
- **GIVEN** cien personas abren Tu lista con zonas y productos distintos
- **WHEN** el sitio busca las promos de cada lista
- **THEN** no se ejecuta ninguna consulta nueva en BigQuery

### Requirement: Tu lista dice cuánto sale con las promos cerca, aparte
Con una zona elegida, Tu lista SHALL mostrar, aparte del total de siempre, cuánto sale la lista en cada cadena cerca si se aprovechan sus promos vigentes. La cuenta SHALL usar una sola sucursal por cadena, a menos de 3 km de la zona: la que deja la lista más barata. Cada producto SHALL contar al menor entre su precio de lista y la promo de esa sucursal. Las promos de compra múltiple NO SHALL contarse. El total de siempre NO SHALL cambiar.

#### Scenario: Palermo con promos en Día
- **GIVEN** la zona es Palermo, la lista es más barata en Maxi a precio de lista, y con las promos del Día de Cl Thames 2447 la misma lista sale menos
- **WHEN** el usuario abre Tu lista
- **THEN** el total de siempre sigue diciendo Maxi, y una línea aparte dice cuánto sale en el Día de Cl Thames 2447 con promos, cuántos productos están en promo y hasta cuándo

#### Scenario: Las promos no cambian el ganador
- **GIVEN** con o sin promos la cadena más barata de la lista es la misma, al mismo total
- **WHEN** el usuario abre Tu lista
- **THEN** no aparece la línea de promos

#### Scenario: Un 2x1 no cuenta
- **GIVEN** la única promo de un producto es "2do al 70%"
- **WHEN** se calcula el total con promos
- **THEN** ese producto cuenta a su precio de lista

### Requirement: Las cadenas que casi no informan promos se nombran
Cuando la cuenta con promos incluye cadenas cerca que informan menos de 50 promos por sucursal en SEPA, Tu lista SHALL nombrarlas y decir que, si tienen promos, no están en esa cuenta. El umbral SHALL vivir en un solo lugar.

#### Scenario: Coto y Jumbo cerca
- **GIVEN** la zona tiene Coto y Jumbo cerca, que casi no informan promos
- **WHEN** el usuario ve la línea de promos
- **THEN** lee que Coto y Jumbo casi no informan promos en SEPA y que, si tienen, no están en esa cuenta

### Requirement: El titular del producto avisa si una promo cerca gana
En el detalle de un producto con zona, si una promo vigente cerca, sin compra múltiple, deja el producto por debajo del precio más bajo de las cadenas de la zona, debajo del titular SHALL decirse en una línea el precio con promo, la cadena, la sucursal y hasta cuándo vale. El titular de precio de lista NO SHALL cambiar.

#### Scenario: Tres Arroyos
- **GIVEN** la zona es Tres Arroyos, la Playadito de 1 kg sale $ 4.890 en Vea, y la Cooperativa Obrera de calle Colón la tiene en promo a $ 4.080 hasta el 30/11
- **WHEN** el usuario abre el detalle
- **THEN** el titular sigue diciendo Vea, y debajo lee "Con promo: $ 4.080 en la Cooperativa Obrera de Colón, hasta el 30/11"

#### Scenario: Sin promo que gane
- **GIVEN** ninguna promo cerca baja del precio más bajo de la zona
- **WHEN** el usuario abre el detalle
- **THEN** no hay línea de promo debajo del titular

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
