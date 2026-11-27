## ADDED Requirements

### Requirement: Barra del celular con botón de ticket
En el celular, la barra de abajo SHALL tener, en este orden: "Promos" (la portada), "Buscar" (Mismo producto), un botón central "Ticket", "Mi compra" (`/lista`, con la cantidad de productos de la lista) y "Mis gastos" (`/gastos`). El botón central SHALL destacarse del resto y llevar a cargar un gasto en Mis gastos. Mientras la lectura de fotos esté apagada, SHALL abrir directamente la carga del monto a mano.

#### Scenario: Ir a la lista desde cualquier página
- **GIVEN** el usuario tiene 5 productos en su lista y está en Buscar, en el celular
- **WHEN** mira la barra de abajo
- **THEN** ve "Mi compra" con un 5, y tocarla lo lleva a `/lista`

#### Scenario: Cargar un gasto con la lectura de fotos apagada
- **GIVEN** la lectura de fotos está apagada
- **WHEN** el usuario toca el botón central "Ticket"
- **THEN** llega a Mis gastos con la carga del monto a mano abierta

### Requirement: Menú Más arriba a la derecha
En el celular, el encabezado SHALL tener arriba a la derecha un botón "Más" que abre un menú con Más barato, Inflación, Cómo se calcula y Privacidad. Ese botón SHALL reemplazar al acceso del carrito, porque la lista ya está en la barra. Estas secciones SHALL seguir accesibles desde el menú de la computadora y por su dirección.

#### Scenario: Más barato desde el menú
- **GIVEN** el usuario está en el celular
- **WHEN** toca "Más" y elige "Más barato"
- **THEN** ve la sección Más barato

#### Scenario: Inflación por su dirección
- **WHEN** el usuario abre `/inflacion`
- **THEN** ve la sección de Inflación

#### Scenario: Sin carrito repetido
- **WHEN** el usuario mira el encabezado en el celular
- **THEN** ve la zona y el botón "Más", y no un segundo acceso a Mi compra

### Requirement: Lo que no está en la barra no pesa al abrir
Más barato, Inflación, Cómo se calcula y Privacidad SHALL descargarse recién cuando el usuario abre una de esas secciones, y no al abrir la app. Mientras se descargan, SHALL verse un aviso de carga dentro del marco de la página, sin perder el encabezado ni la barra.

#### Scenario: Primera carga sin Inflación
- **WHEN** el usuario abre la portada por primera vez
- **THEN** el navegador no descarga el código de Inflación ni el de Más barato

#### Scenario: Abrir Inflación
- **WHEN** el usuario toca "Inflación" en el menú Más
- **THEN** ve un aviso de carga breve y después la sección, con el encabezado y la barra en su lugar
