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
El sitio SHALL tener una página `/lista` con Tu lista, sus cantidades y cuánto
sale en cada cadena, con las mismas reglas de zona que Tu lista en Mismo
producto. Sin productos, la página SHALL explicar cómo se agregan y ofrecer el
buscador.

#### Scenario: Abrir la lista
- **GIVEN** la lista tiene productos y la zona es "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario toca el acceso del encabezado
- **THEN** llega a `/lista` y ve cuánto sale su lista en las cadenas de Lomas de Zamora

#### Scenario: Lista vacía
- **GIVEN** la lista no tiene productos
- **WHEN** el usuario abre `/lista`
- **THEN** lee cómo agregar productos y tiene un buscador que lleva a Mismo producto

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
La barra de secciones de abajo, en el celular, SHALL tener "Mi lista", que lleva a `/lista` y muestra cuántos productos tiene, en el lugar que ocupaba Inflación. Inflación SHALL seguir accesible desde el menú de la computadora, desde la portada y por su dirección.

#### Scenario: Ir a la lista desde cualquier página
- **GIVEN** el usuario tiene 5 productos en su lista y está en Mismo producto, en el celular
- **WHEN** mira la barra de abajo
- **THEN** ve "Mi lista" con un 5, y tocarla lo lleva a Tu lista

#### Scenario: Inflación sigue existiendo
- **WHEN** el usuario abre `/inflacion`
- **THEN** ve la sección de Inflación como antes

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
