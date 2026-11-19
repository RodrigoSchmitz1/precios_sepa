# tu-canasta Specification

## Purpose
Cotizar la compra del mes del usuario con precios de las sucursales de las
localidades que elige, y compararla entre cadenas.

## Requirements

### Requirement: La zona entra como localidad
Al abrir Tu canasta con una zona elegida y sin localidades cargadas, la zona
SHALL entrar como la primera localidad. El usuario SHALL poder sacarla o sumar
otras, hasta tres, sin que eso cambie su zona.

#### Scenario: Primera visita con zona
- **GIVEN** la zona es "Rosario, Santa Fe" y Tu canasta no tiene localidades
- **WHEN** el usuario abre Tu canasta
- **THEN** "Rosario, Santa Fe" ya figura como localidad elegida

#### Scenario: Canasta guardada con otras localidades
- **GIVEN** el usuario ya había guardado una canasta con "Córdoba, Córdoba"
- **WHEN** abre Tu canasta con la zona "Rosario, Santa Fe"
- **THEN** conserva "Córdoba, Córdoba" y no agrega la zona sola

### Requirement: Zona sin precios por categoría
Si la zona no tiene precios suficientes para cotizar la canasta, Tu canasta
SHALL decirlo y no SHALL agregarla como localidad.

#### Scenario: Zona sin datos para cotizar
- **GIVEN** la zona es un barrio con sucursales pero sin precios de la canasta
- **WHEN** el usuario abre Tu canasta
- **THEN** ve que su zona no tiene precios para cotizar y puede elegir otra localidad

### Requirement: Las cantidades se cambian desde el celular
El control de cantidad de cada categoría SHALL mostrar enteros el botón "−", el número y el botón "+", y SHALL dejarlos tocar a 375 y 414 px de ancho, con el número a 16 px. El número SHALL mostrarse con coma decimal ("20,86") y SHALL aceptar que se tipee con coma o con punto.

#### Scenario: Subir una cantidad en el iPhone
- **GIVEN** la canasta del INDEC está cargada y la pantalla mide 414 px
- **WHEN** el usuario toca "+" en Galletitas saladas
- **THEN** el "+" está dentro de su caja, se puede tocar y la cantidad sube un paso

#### Scenario: Un número largo
- **GIVEN** Pan tiene 20,86 kg por mes
- **WHEN** se ve su fila a 375 px
- **THEN** se ven el "−", "20,86" y el "+"

#### Scenario: Tipear con punto
- **GIVEN** el usuario borra la cantidad de Arroz
- **WHEN** escribe "3.5"
- **THEN** la cantidad pasa a 3,5 kg por mes y se muestra "3,5"

### Requirement: Dónde comprarla arranca en tu zona
Con una zona elegida, el mapa de "Dónde comprarla cerca tuyo" SHALL abrir centrado en la zona y SHALL calcular las sucursales cercanas a ese punto sin que el usuario toque el mapa. Si el usuario cambia la zona, el punto SHALL pasar a la nueva. Tocar el mapa o usar la ubicación del teléfono SHALL seguir moviendo el punto. Sin zona, el mapa SHALL esperar a que el usuario elija un punto.

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires" y la canasta tiene categorías
- **WHEN** el usuario llega al paso 4
- **THEN** el mapa está centrado en Lomas y las opciones son de sucursales a pocos km de Lomas, no del centro porteño

#### Scenario: Cambiar la zona
- **GIVEN** el paso 4 muestra sucursales de Lomas
- **WHEN** el usuario cambia la zona a "Rosario, Santa Fe"
- **THEN** el mapa y las sucursales pasan a Rosario

#### Scenario: Elegir otro punto
- **GIVEN** el mapa está centrado en la zona
- **WHEN** el usuario toca otro lugar del mapa
- **THEN** las sucursales se calculan desde ese lugar

### Requirement: La comparación entre cadenas dice qué suma
La sección "Tu canasta en cada súper" SHALL decir en su titular sobre cuántas categorías de la canasta compara. Si quedan categorías afuera porque no las venden todas las cadenas, SHALL nombrar las principales en una línea visible debajo del titular y SHALL decir que "Dónde comprarla cerca tuyo" sí las suma.

#### Scenario: Canasta del INDEC en Lomas
- **GIVEN** la canasta tiene 32 categorías y 7 no las venden todas las cadenas de la zona
- **WHEN** el usuario ve "Tu canasta en cada súper"
- **THEN** el titular dice "En las 25 categorías que venden todas" antes de los montos, y debajo se lee que verdura, fruta, pollo y huevos no entran ahí y que el paso 4 sí los suma

#### Scenario: Todas comparables
- **GIVEN** todas las categorías de la canasta las venden todas las cadenas
- **WHEN** el usuario ve la sección
- **THEN** el titular dice que compara la canasta entera y no hay línea de categorías afuera

### Requirement: Dónde comprarla compara opciones que cubren lo mismo
En "Dónde comprarla cerca tuyo", el mejor total SHALL ser el de la opción que cubre más categorías y, entre las que cubren lo mismo, el más barato. La diferencia "contra una sola" SHALL calcularse solo si las dos opciones cubren las mismas categorías. Cada opción que no cubre todas las categorías SHALL decir cuántas cubre o cuáles le faltan.

#### Scenario: Una sucursal que no tiene todo
- **GIVEN** en una sucursal la canasta sale $ 144.427 con 26 de 27 categorías, y en dos sale $ 146.661 con las 27
- **WHEN** el usuario mira el paso 4
- **THEN** el mejor total es el de dos sucursales, la opción de una dice que cubre 26 de 27, y no aparece una diferencia "contra una sola"

### Requirement: Dónde comprarla arranca en el radio de la zona
El radio inicial de "Dónde comprarla cerca tuyo" SHALL ser el mismo que define las cadenas cerca de la zona (3 km), y las opciones de radio SHALL incluirlo.

#### Scenario: El Maxi de Lomas
- **GIVEN** la zona es Lomas de Zamora y el Maxi está a 2,5 km de su centro
- **WHEN** el usuario llega al paso 4
- **THEN** el radio es de 3 km y el Maxi entra en las sucursales consideradas
