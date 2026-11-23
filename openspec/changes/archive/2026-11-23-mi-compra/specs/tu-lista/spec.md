# Spec Delta

## MODIFIED Requirements

### Requirement: Tu lista tiene su página
El sitio SHALL tener una página `/lista` llamada "Mi compra" con Tu lista, sus
cantidades y cuánto sale en cada cadena, con las mismas reglas de zona que Tu
lista en Mismo producto. Sin productos, la página SHALL explicar cómo se
agregan y ofrecer el buscador, los básicos y armarla describiendo el hogar.

#### Scenario: Abrir la lista
- **GIVEN** la lista tiene productos y la zona es "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario toca el acceso del encabezado
- **THEN** llega a `/lista`, titulada "Mi compra", y ve cuánto sale su lista en las cadenas de Lomas de Zamora

#### Scenario: Lista vacía
- **GIVEN** la lista no tiene productos
- **WHEN** el usuario abre `/lista`
- **THEN** lee cómo agregar productos y tiene un buscador que lleva a Mismo producto, los básicos y "Contanos quiénes viven en tu casa"

### Requirement: Mi lista está en la barra del celular
La barra de secciones de abajo, en el celular, SHALL tener, en este orden: "Promos" (la portada), "Buscar" (Mismo producto), "Mi compra" (lleva a `/lista` y muestra cuántos productos tiene), "Mis gastos" (`/gastos`) y "Más". "Más" SHALL abrir un menú con Más barato, Inflación y Cómo se calcula. Esas secciones SHALL seguir accesibles desde el menú de la computadora, desde la portada y por su dirección.

#### Scenario: Ir a la lista desde cualquier página
- **GIVEN** el usuario tiene 5 productos en su lista y está en Mismo producto, en el celular
- **WHEN** mira la barra de abajo
- **THEN** ve "Mi compra" con un 5, y tocarla lo lleva a `/lista`

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

## ADDED Requirements

### Requirement: Armar la compra describiendo el hogar
Mi compra SHALL ofrecer "Contanos quiénes viven en tu casa": con una descripción libre, la IA propone categorías y cantidades por mes, y para cada categoría la persona elige una marca entre las más comunes con un toque. Cada marca elegida SHALL sumarse a la lista con las unidades que cubren la cantidad del mes.

#### Scenario: Familia de cuatro
- **GIVEN** la lista está vacía
- **WHEN** el usuario escribe "somos 2 adultos y 2 chicos" y elige una yerba de 500 g para "Yerba, 2 kg por mes"
- **THEN** la yerba entra a la lista con 4 unidades

#### Scenario: La IA está al límite
- **GIVEN** el servicio de la IA responde que superó el límite de pedidos
- **WHEN** el usuario manda la descripción
- **THEN** la página dice que pruebe en un minuto y ofrece empezar desde la canasta básica

### Requirement: Empezar desde la canasta básica
Mi compra SHALL ofrecer empezar desde la canasta básica del INDEC sin usar la IA: muestra sus categorías con la cantidad por mes y la persona elige las marcas igual que con la descripción del hogar.

#### Scenario: Canasta básica
- **WHEN** el usuario toca "Empezar con la canasta básica"
- **THEN** ve las categorías de la canasta básica con sus cantidades y puede elegir una marca en cada una

### Requirement: Dónde comprarla cerca
Con una zona elegida y productos en la lista, Mi compra SHALL mostrar la mejor forma de comprarla en 1, 2 y 3 cadenas con sucursal dentro del radio, con la sucursal más cercana de cada una en un mapa y qué productos se compran en cada una. SHALL decir que usa el precio de cada cadena para todo el país. Primero cuenta cubrir más productos y después el total.

#### Scenario: Dos paradas
- **GIVEN** la lista tiene 10 productos, la zona es Palermo y en Coto salen $ 30.000 y en Día $ 28.000, pero comprando 6 en Día y 4 en Coto salen $ 26.500
- **WHEN** el usuario mira "Dónde comprarla cerca"
- **THEN** ve la opción de 1 cadena (Día, $ 28.000) y la de 2 (Día y Coto, $ 26.500), con la sucursal más cercana de cada una

#### Scenario: Sin zona
- **GIVEN** el usuario no eligió zona
- **WHEN** abre Mi compra con productos
- **THEN** "Dónde comprarla cerca" le pide elegir la zona

#### Scenario: Ninguna sucursal en el radio
- **GIVEN** no hay sucursales dentro del radio elegido
- **WHEN** el usuario mira "Dónde comprarla cerca"
- **THEN** la página lo dice y ofrece un radio más grande

### Requirement: Una canasta guardada pasa a la lista
Si el navegador tiene una canasta guardada de Tu canasta, Mi compra SHALL ofrecer elegir las marcas de sus categorías para pasarla a la lista. Al terminar o descartarla, la oferta SHALL dejar de aparecer.

#### Scenario: Visitante que usaba Tu canasta
- **GIVEN** el navegador tiene una canasta guardada con 12 categorías
- **WHEN** el usuario abre Mi compra
- **THEN** ve "Tenés una canasta guardada: elegí las marcas para pasarla a tu lista" con sus 12 categorías

### Requirement: Tu canasta lleva a Mi compra
La dirección `/canasta-personalizada` SHALL llevar a `/lista`, conservando la zona del link si la tiene.

#### Scenario: Link viejo
- **WHEN** el usuario abre `/canasta-personalizada?zona=AR-C:Palermo`
- **THEN** llega a `/lista?zona=AR-C:Palermo`
