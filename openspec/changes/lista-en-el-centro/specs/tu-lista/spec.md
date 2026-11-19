## ADDED Requirements

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
