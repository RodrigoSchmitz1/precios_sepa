# tu-lista Specification

## Purpose
Que la lista de productos de cada persona se encuentre desde cualquier página y
se vea cuántos productos tiene, para que vuelva a usarla en cada compra.

## Requirements

### Requirement: Tu lista se ve desde todas las páginas
El encabezado de todas las páginas SHALL tener un acceso a Tu lista que muestre
cuántos productos tiene. El acceso SHALL verse en el celular y en la
computadora.

#### Scenario: Volver otro día
- **GIVEN** el usuario guardó 3 productos en su lista en una visita anterior
- **WHEN** abre cualquier página del sitio
- **THEN** ve en el encabezado el acceso a Tu lista con un 3

#### Scenario: Sin lista
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre cualquier página
- **THEN** ve el acceso a Tu lista sin número

### Requirement: Agregar se nota en el momento
Al agregar o quitar un producto de la lista, el número del encabezado SHALL
cambiar sin recargar la página.

#### Scenario: Agregar desde una búsqueda
- **GIVEN** la lista tiene 2 productos
- **WHEN** el usuario toca "+ Lista" en un resultado de Mismo producto
- **THEN** el número del encabezado pasa a 3

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
La app SHALL cargar una lista de ejemplo al abrirse, en cualquier página, cuando la lista está vacía y el ejemplo nunca se cargó en ese navegador; una lista recibida por link SHALL tener prioridad y en ese caso no se carga el ejemplo. En Mi compra, el ejemplo SHALL mostrarse marcado como "Lista de ejemplo", con la comparación de dónde comprarla en la zona visible sin ningún toque más.

#### Scenario: Primera visita
- **WHEN** alguien abre Mi compra por primera vez con una zona elegida
- **THEN** ve la lista de ejemplo marcada como tal y cuánto sale en cada cadena de su zona

#### Scenario: No vuelve si se borró
- **WHEN** el usuario borró el ejemplo y vuelve a entrar con la lista vacía
- **THEN** ve el armado rápido, sin lista de ejemplo

### Requirement: Qué tiene el ejemplo
El ejemplo SHALL tener unos 12 básicos de al menos cinco grupos, tomados de los básicos que sirve la API. Si la API falla o devuelve menos de 8 de los elegidos, no SHALL cargarse ejemplo y Mi compra SHALL mostrar el armado rápido como hasta ahora.

#### Scenario: Sin básicos
- **WHEN** el pedido de básicos falla al abrir la app
- **THEN** la lista queda vacía y Mi compra muestra el armado rápido

### Requirement: Borrar el ejemplo entero o por grupo
Mientras la lista sea de ejemplo, Mi compra SHALL ofrecer un botón "Borrar el ejemplo", que vacía la lista y recuerda que no hay que volver a cargarla, y un chip por cada grupo presente, que saca de la lista todos los productos de ese grupo.

#### Scenario: Sacar un grupo
- **WHEN** el usuario toca el chip "Limpieza"
- **THEN** salen de la lista todos los productos de Limpieza y la comparación se recalcula con el resto

### Requirement: El ejemplo pasa a ser tuyo al tocarlo
Al sumar un producto, quitar uno suelto o cambiar una cantidad, la lista SHALL dejar de ser de ejemplo: se quita la marca y el cartel, y queda como lista propia. Sacar un grupo con su chip no la convierte.

#### Scenario: Sumar un producto
- **WHEN** con la lista de ejemplo el usuario suma un producto desde el buscador
- **THEN** la lista deja de decir "Lista de ejemplo" y conserva los productos que tenía
