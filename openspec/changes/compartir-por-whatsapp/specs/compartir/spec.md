## ADDED Requirements

### Requirement: Un link del sitio llega con tarjeta
Toda página del sitio SHALL servirse con título, descripción, imagen y URL para vista previa (Open Graph y Twitter), en el HTML inicial y sin depender de JavaScript. La imagen y la URL SHALL ser absolutas y usar el host por el que llegó el pedido.

#### Scenario: Pegar la portada en WhatsApp
- **GIVEN** un usuario pega el link de la portada en un chat
- **WHEN** WhatsApp pide la página para armar la vista previa
- **THEN** recibe un HTML con `og:title`, `og:description`, `og:image` de 1200x630 y `og:url`, sin ejecutar JavaScript

#### Scenario: Otro host
- **GIVEN** el sitio se sirve desde un dominio distinto del de Cloud Run
- **WHEN** se pide cualquier página
- **THEN** `og:image` y `og:url` apuntan a ese dominio

### Requirement: Un producto compartido dice qué producto es y su rango de precio
Un link a un producto de Mismo producto SHALL llevar en su tarjeta el nombre del producto y el rango de precio del país, con la cantidad de cadenas. NO SHALL nombrar a la cadena más barata, porque esa respuesta depende de la zona de quien lo abre. Si el producto no existe o los datos no están listos, SHALL llevar la tarjeta general. Todo texto que venga de los datos SHALL escaparse.

#### Scenario: La yerba compartida
- **GIVEN** la yerba Playadito 500 g cuesta entre $ 2.490 y $ 2.850 en 13 cadenas
- **WHEN** WhatsApp pide `/mismo-producto?p=<código de la yerba>`
- **THEN** el título dice el nombre de la yerba, "de $ 2.490 a $ 2.850 en 13 cadenas", y la descripción invita a ver dónde conviene en tu zona

#### Scenario: Un código que no existe
- **GIVEN** el código no está en Mismo producto
- **WHEN** se pide `/mismo-producto?p=000`
- **THEN** la página sale con la tarjeta general y con el mismo HTML de siempre para el navegador

#### Scenario: Un nombre con caracteres de HTML
- **GIVEN** la descripción de un producto tiene `<` o comillas
- **WHEN** se pide su link
- **THEN** los metadatos los muestran escapados y el HTML no se rompe

### Requirement: Cada sección tiene su tarjeta
Las páginas de Tu lista, Tu canasta, Más barato, Inflación y Mismo producto (sin un producto elegido) SHALL llevar título y descripción propios en su tarjeta. Una ruta desconocida SHALL llevar la tarjeta general.

#### Scenario: Compartir Inflación
- **GIVEN** un usuario comparte `/inflacion`
- **WHEN** WhatsApp arma la vista previa
- **THEN** el título habla de la inflación de la canasta y no es el título general

### Requirement: El detalle del producto se puede compartir
El detalle de un producto SHALL tener un botón "Compartir". El botón SHALL cumplir lo siguiente:
- Donde el navegador tenga el menú nativo para compartir, SHALL abrirlo con el titular que muestra la página y el link del producto, con la zona si la hay.
- Donde no lo tenga, SHALL copiar el link y avisar "Link copiado".
- Si el usuario cancela el menú, NO SHALL mostrar ningún error.

#### Scenario: Compartir desde el iPhone con zona
- **GIVEN** la zona es Palermo y el detalle dice que la yerba conviene en Día
- **WHEN** el usuario toca "Compartir"
- **THEN** se abre el menú de compartir con ese titular y un link que lleva el producto y la zona Palermo

#### Scenario: Navegador sin menú de compartir
- **GIVEN** el navegador no tiene `navigator.share`
- **WHEN** el usuario toca "Compartir"
- **THEN** el link queda copiado y el botón dice "Link copiado" por unos segundos

#### Scenario: Cancelar
- **GIVEN** el menú de compartir está abierto
- **WHEN** el usuario lo cierra sin elegir nada
- **THEN** la página sigue igual, sin mensajes de error

### Requirement: El sitio se instala con su ícono
El sitio SHALL tener un favicon con el chango de la marca, un `apple-touch-icon` de 180 px y un manifest con nombre "Changuito", íconos de 192 y 512 px y color de tema, para que al agregarlo a la pantalla de inicio se vea como una app.

#### Scenario: Agregar a inicio en el iPhone
- **GIVEN** un usuario abre el sitio en Safari
- **WHEN** lo agrega a la pantalla de inicio
- **THEN** el ícono es el chango sobre el degradé de la marca, no una captura de la página
