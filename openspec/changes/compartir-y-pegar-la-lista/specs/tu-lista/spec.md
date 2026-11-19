## ADDED Requirements

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
