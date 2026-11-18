# promos Specification

## Purpose
Mostrar los descuentos vigentes que publican las cadenas, empezando por los que
el usuario tiene cerca.

## Requirements

### Requirement: Promos arranca en tu zona
Con una zona elegida, el mapa de promos SHALL abrir centrado en la zona y la
lista SHALL mostrar las promos de esa zona. Sin zona, SHALL abrir como hasta
ahora.

#### Scenario: Abrir promos con zona
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario abre Promos
- **THEN** el mapa está centrado en Palermo y la lista muestra las promos de esa zona

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
