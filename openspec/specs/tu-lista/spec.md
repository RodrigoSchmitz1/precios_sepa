# tu-lista Specification

## Purpose
Que la lista de productos de cada persona se encuentre desde cualquier página y
se vea cuántos productos tiene, para que vuelva a usarla en cada compra.

## Requirements

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
El sitio SHALL tener una página `/lista` llamada "Mi compra", con las mismas reglas de zona que Tu lista en Mismo producto. Arriba SHALL ir una sola cifra: la cadena donde la lista sale más barata, el total y la diferencia con la siguiente opción. Cada producto SHALL mostrar su cantidad y su precio en esa cadena y, debajo, su promo cerca o, si sale más barato en otra cadena de la zona, en cuál y a cuánto.

#### Scenario: Abrir la lista
- **GIVEN** la lista tiene 12 productos y la zona es Palermo
- **WHEN** el usuario abre `/lista`
- **THEN** ve arriba "$ 54.619 en Día" y la diferencia con Market, la siguiente opción, y cada producto con su precio en Día

#### Scenario: Un producto más barato en otra cadena
- **GIVEN** la leche sale $ 1.690 en Día y $ 1.540 en Vea, una cadena de la zona
- **WHEN** el usuario ve la leche en su lista
- **THEN** ve $ 1.690 y debajo "Más barato en Vea: $ 1.540"

### Requirement: Lo demás de Mi compra va plegado
Con productos, las demás cadenas, la compra en 2 o 3 súper y el total con las promos de la semana SHALL aparecer plegados debajo de la lista. Sin productos, la página SHALL explicar cómo se agregan y ofrecer "Ver un ejemplo", el buscador, el escaneo de códigos de barras, los básicos y armarla describiendo el hogar.

#### Scenario: Lo demás plegado
- **WHEN** el usuario abre `/lista` con productos
- **THEN** las otras cadenas, la compra en 2 súper y el total con promos aparecen cerrados, y cada uno se abre con un toque

#### Scenario: Lista vacía
- **GIVEN** la lista no tiene productos
- **WHEN** el usuario abre `/lista`
- **THEN** lee cómo agregar productos y tiene "Ver un ejemplo", el buscador, "Escanear", los básicos y "Contanos quiénes viven en tu casa"

### Requirement: Una sola lista en todo el sitio
La lista SHALL ser la misma en el encabezado, en `/lista` y en Mismo producto, y
SHALL seguir guardándose en el navegador con la misma clave que antes. Un cambio
hecho en otra pestaña SHALL verse sin recargar.

#### Scenario: La lista que ya estaba guardada
- **GIVEN** el usuario armó una lista antes de este cambio
- **WHEN** abre el sitio
- **THEN** ve la misma lista, con los mismos productos y cantidades

#### Scenario: Otra pestaña
- **GIVEN** el sitio está abierto en dos pestañas
- **WHEN** el usuario agrega un producto en una
- **THEN** el número del encabezado de la otra también cambia

### Requirement: Armar la lista con productos básicos
Tu lista SHALL ofrecer un armado rápido con unos 40 productos básicos agrupados (almacén, desayuno, lácteos, bebidas, limpieza, higiene). Cada uno SHALL sumarse a la lista con un toque y sacarse con otro. Los productos SHALL salir de una lista fija de búsquedas resuelta con el buscador del sitio, que la API resuelve sin consultar BigQuery.

#### Scenario: Lista vacía
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre Tu lista
- **THEN** ve los básicos agrupados, y al tocar "Yerba" se suma la Playadito de 1 kg a la lista

#### Scenario: Sacar un básico
- **GIVEN** el usuario sumó la yerba desde el armado rápido
- **WHEN** la vuelve a tocar
- **THEN** la yerba sale de su lista

### Requirement: Con productos, los básicos quedan plegados
Cuando la lista ya tiene productos, el armado rápido SHALL quedar plegado bajo "Sumar básicos" y abrirse a pedido, para no tapar la comparación.

#### Scenario: Lista con productos
- **GIVEN** la lista tiene 8 productos
- **WHEN** el usuario abre Tu lista
- **THEN** ve primero la comparación, y "Sumar básicos" cerrado

### Requirement: Abrir una lista compartida
Al abrir el link de una lista compartida, la página SHALL mostrar la lista recibida con sus productos y cantidades, cotizada con la zona de quien la abre. No SHALL cambiar la lista guardada hasta que la persona elija.
- Si no tenía lista, la recibida SHALL guardarse directo.
- Si tenía, SHALL elegir entre "Sumar a mi lista" (los nuevos se agregan, y en un producto repetido queda la cantidad mayor) y "Reemplazar mi lista".
- Un producto del link que ya no existe SHALL omitirse, diciendo cuántos.

#### Scenario: Sin lista propia
- **GIVEN** el usuario no tiene lista guardada
- **WHEN** abre un link con 3 productos
- **THEN** su lista pasa a tener esos 3 productos con sus cantidades

#### Scenario: Con lista propia
- **GIVEN** el usuario tiene 5 productos guardados
- **WHEN** abre un link con 3 productos, uno de ellos repetido
- **THEN** ve la lista recibida y sus precios, su lista no cambió, y puede sumar (queda con 7) o reemplazar (queda con 3)

### Requirement: Pegar una lista escrita
Tu lista SHALL tener "Pegar una lista", que recibe texto libre, como el de un chat. Cada renglón, o cada ítem separado por comas si es uno solo, SHALL convertirse en un producto con el buscador del sitio:
- la cantidad del principio o del final ("2 leches", "atún x3") SHALL tomarse como cantidad;
- las viñetas y las palabras de relleno no SHALL buscarse;
- si el renglón nombra un básico, SHALL preferirse el producto de los básicos.

El pegado no SHALL usar IA ni consultar la base.

#### Scenario: Una lista de WhatsApp
- **WHEN** el usuario pega "- 2 leches
- yerba
- 1 docena de huevos
- pan lactal"
- **THEN** ve 4 renglones: leche con cantidad 2, la yerba de los básicos, huevos y pan lactal

#### Scenario: Una sola línea con comas
- **WHEN** el usuario pega "yerba, aceite, fideos"
- **THEN** ve 3 renglones

### Requirement: Lo pegado se revisa antes de sumarlo
Para cada renglón, la persona SHALL ver el producto elegido, poder cambiarlo por otra opción o sacarlo, y después sumar todos de una vez. Un renglón sin resultado SHALL decirse, sin frenar a los demás. Sumar no SHALL superar el tope de 50 productos.

#### Scenario: Un renglón que no se encuentra
- **WHEN** el usuario pega "yerba, xzqw"
- **THEN** la yerba se puede sumar, y "xzqw" dice que no se encontró

#### Scenario: Cambiar y sumar
- **GIVEN** el renglón "leche" eligió una leche entera
- **WHEN** el usuario elige otra opción y toca "Sumar a mi lista"
- **THEN** se agrega la opción elegida, con la cantidad del renglón

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

### Requirement: Borrar el ejemplo entero o por grupo
Mientras la lista sea de ejemplo, Mi compra SHALL ofrecer un botón "Borrar el ejemplo", que vacía la lista y recuerda que no hay que volver a cargarla, y un chip por cada grupo presente, que saca de la lista todos los productos de ese grupo.

#### Scenario: Sacar un grupo
- **WHEN** el usuario toca el chip "Limpieza"
- **THEN** salen de la lista todos los productos de Limpieza y la comparación se recalcula con el resto

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
