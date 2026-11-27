## MODIFIED Requirements

### Requirement: Tu lista se ve desde todas las páginas
El acceso a Tu lista SHALL mostrar cuántos productos tiene y SHALL verse en todas las páginas. En el celular SHALL ser la pestaña "Mi compra" de la barra de abajo; en la computadora, el menú de secciones.

#### Scenario: Volver otro día
- **GIVEN** el usuario guardó 3 productos en su lista en una visita anterior
- **WHEN** abre cualquier página del sitio en el celular
- **THEN** ve "Mi compra" con un 3 en la barra de abajo

#### Scenario: Sin lista
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre cualquier página
- **THEN** ve "Mi compra" sin número

### Requirement: Agregar se nota en el momento
Al agregar o quitar un producto de la lista, el número del acceso a Tu lista SHALL cambiar sin recargar la página.

#### Scenario: Agregar desde una búsqueda
- **GIVEN** la lista tiene 2 productos
- **WHEN** el usuario toca "+ Lista" en un resultado de Buscar
- **THEN** el número de "Mi compra" pasa a 3

### Requirement: Tu lista tiene su página
El sitio SHALL tener una página `/lista` llamada "Mi compra", con las mismas reglas de zona que Tu lista en Mismo producto.
- **Arriba:** una sola cifra con la cadena donde la lista sale más barata, el total y cuánto más sale en la siguiente opción.
- **La lista:** cada producto con su cantidad y su precio en esa cadena. Debajo de cada uno, su promo cerca o, si sale más barato en otra cadena, en cuál y a cuánto.
- **Plegado:** las demás cadenas, la compra en 2 o 3 súper y el total con las promos de la semana.

Sin productos, la página SHALL explicar cómo se agregan y ofrecer "Ver un ejemplo", el buscador, el escaneo de códigos de barras, los básicos y armarla describiendo el hogar.

#### Scenario: Abrir la lista
- **GIVEN** la lista tiene 12 productos y la zona es Palermo
- **WHEN** el usuario abre `/lista`
- **THEN** ve arriba "$ 54.619 en Día" y "$ 2.148 menos que en Market", y cada producto con su precio en Día

#### Scenario: Un producto más barato en otra cadena
- **GIVEN** la leche sale $ 1.690 en Día y $ 1.540 en Vea, una cadena de la zona
- **WHEN** el usuario ve la leche en su lista
- **THEN** ve $ 1.690 y debajo "Más barata en Vea: $ 1.540"

#### Scenario: Lo demás plegado
- **WHEN** el usuario abre `/lista` con productos
- **THEN** las otras cadenas, la compra en 2 súper y el total con promos aparecen cerrados, y cada uno se abre con un toque

#### Scenario: Lista vacía
- **GIVEN** la lista no tiene productos
- **WHEN** el usuario abre `/lista`
- **THEN** lee cómo agregar productos y tiene "Ver un ejemplo", el buscador, "Escanear", los básicos y "Contanos quiénes viven en tu casa"

### Requirement: Lista de ejemplo en la primera visita
La app NO SHALL cargar la lista de ejemplo sola. Con la lista vacía, Mi compra y la portada SHALL ofrecer un botón "Ver un ejemplo". Al tocarlo SHALL cargar la lista de ejemplo, marcada como "Lista de ejemplo", con la comparación de dónde comprarla en la zona visible sin ningún toque más. Una lista recibida por link SHALL tener prioridad sobre el ejemplo.

#### Scenario: Primera visita
- **WHEN** alguien abre la app por primera vez
- **THEN** su lista está vacía y Mi compra ofrece "Ver un ejemplo"

#### Scenario: Ver el ejemplo
- **GIVEN** la zona es Palermo y la lista está vacía
- **WHEN** el usuario toca "Ver un ejemplo"
- **THEN** ve la lista de ejemplo marcada como tal y cuánto sale en cada cadena de su zona

#### Scenario: No vuelve si se borró
- **WHEN** el usuario borró el ejemplo y vuelve a entrar con la lista vacía
- **THEN** ve "Ver un ejemplo" y el armado rápido, sin lista de ejemplo cargada

### Requirement: Qué tiene el ejemplo
El ejemplo SHALL tener unos 12 básicos de al menos cinco grupos, tomados de los básicos que sirve la API. Si la API falla o devuelve menos de 8 de los elegidos, el botón SHALL decir que no se pudo armar el ejemplo, y Mi compra SHALL seguir con el armado rápido.

#### Scenario: Sin básicos
- **WHEN** el pedido de básicos falla al tocar "Ver un ejemplo"
- **THEN** la lista queda vacía, el usuario lee que no se pudo armar el ejemplo y Mi compra muestra el armado rápido

### Requirement: El ejemplo pasa a ser tuyo al tocarlo
Con la lista de ejemplo, sumar un producto propio SHALL reemplazar el ejemplo: la lista queda solo con ese producto, sin la marca ni el cartel. Durante unos segundos SHALL ofrecer "Deshacer", que vuelve a dejar el ejemplo con el producto sumado. Quitar un producto suelto o cambiar una cantidad SHALL quitar la marca y dejar la lista como propia, con lo que tenía. Sacar un grupo con su chip no la convierte.

#### Scenario: Sumar un producto
- **GIVEN** la lista es de ejemplo, con 12 productos
- **WHEN** el usuario suma Yerba Playadito 1 kg desde Buscar
- **THEN** su lista tiene solo la yerba y deja de decir "Lista de ejemplo"

#### Scenario: Deshacer
- **GIVEN** el usuario acaba de sumar la yerba y el ejemplo se reemplazó
- **WHEN** toca "Deshacer"
- **THEN** la lista vuelve a tener los 12 productos del ejemplo más la yerba, como lista propia

#### Scenario: Cambiar una cantidad
- **WHEN** con la lista de ejemplo el usuario sube la leche a 3
- **THEN** la lista deja de decir "Lista de ejemplo" y conserva los 12 productos

## ADDED Requirements

### Requirement: Sumar un producto escaneando su código
Mi compra y Buscar SHALL tener un botón "Escanear" que abre la cámara y lee el código de barras de un producto. Con un código conocido, SHALL mostrar el producto con su precio y "+ Lista". Con un código desconocido, SHALL decir que ese producto no está en los precios de SEPA y ofrecer buscarlo por nombre. Sin permiso de cámara o sin cámara, SHALL decirlo y ofrecer escribir el código. Leer el código NO SHALL consultar BigQuery.

#### Scenario: Escanear una yerba
- **WHEN** el usuario escanea el código de barras de un paquete de Yerba Playadito 1 kg
- **THEN** ve el producto con su precio en las cadenas de su zona y puede sumarlo con "+ Lista"

#### Scenario: Código que no está
- **WHEN** el usuario escanea un código que no está en los precios de SEPA
- **THEN** lee que ese producto no figura y puede buscarlo por nombre

#### Scenario: Sin permiso de cámara
- **WHEN** el usuario no da permiso para la cámara
- **THEN** lee que sin cámara puede escribir el código, y tiene el campo para hacerlo

### Requirement: Armar la lista con lo que comprás
Cuando Mis gastos tiene una compra habitual (la misma regla que Mis gastos: productos vinculados en al menos dos tickets de los últimos 90 días, con su cantidad típica), Mi compra SHALL ofrecer "Armarla con lo que comprás". Esa opción SHALL sumar a la lista los productos de la compra habitual con su cantidad típica. Los productos que ya están en la lista no se repiten. Sin compra habitual, la opción NO SHALL mostrarse.

#### Scenario: Productos que se repiten
- **GIVEN** la compra habitual tiene la yerba con cantidad típica 1 y la leche con 3
- **WHEN** el usuario toca "Armarla con lo que comprás"
- **THEN** la lista suma la yerba con 1 y la leche con 3

#### Scenario: Sin compra habitual
- **GIVEN** el usuario solo anotó montos a mano
- **WHEN** abre Mi compra
- **THEN** no ve la opción "Armarla con lo que comprás"

### Requirement: La zona guardada no parpadea
Con una zona guardada en el teléfono, Mi compra NO SHALL mostrar en ningún momento el pedido de elegir zona. Mientras llegan los precios de la zona, SHALL mostrar un aviso de carga.

#### Scenario: Entrar con zona guardada
- **GIVEN** el usuario eligió Palermo en una visita anterior
- **WHEN** abre `/lista` sin la zona en la dirección
- **THEN** no ve "Elegí tu zona arriba" mientras carga, y después ve la comparación de Palermo

## REMOVED Requirements

### Requirement: Mi lista está en la barra del celular
**Reason**: La barra del celular cambia: suma el botón de ticket y "Más" pasa al encabezado. La barra deja de ser parte de la lista.
**Migration**: El requisito vive ahora en la capacidad `navegacion` ("Barra del celular con botón de ticket" y "Menú Más arriba a la derecha").
