# historia-de-precio Specification

## Purpose
Guardar desde el día en que empezó la historia del precio de cada producto en
cada cadena, ocupando lo mínimo, y decir en el detalle y en Tu lista cuándo un
precio subió o bajó de verdad.

## Requirements

### Requirement: La historia guarda solo los cambios de precio
El sistema SHALL guardar, para cada producto y cadena de Mismo producto, una fila con el precio creíble y la fecha cada vez que ese precio cambia respecto del último guardado.
- La primera vez que aparece un producto en una cadena SHALL guardarse también.
- Un día en que el precio no cambia, o en que la cadena no informa, NO SHALL agregar filas.
- Un precio que no es creíble NO SHALL guardarse.
- La historia NO SHALL vencer ni borrarse al reconstruir los modelos.

#### Scenario: Un precio que no cambia
- **GIVEN** la historia tiene la yerba Playadito 1 kg en Día a $ 4.200 desde el 18/11
- **WHEN** el 19/11 Día la sigue informando a $ 4.200
- **THEN** la historia no suma ninguna fila para ese producto en Día

#### Scenario: Un precio que cambia
- **GIVEN** la historia tiene la yerba en Día a $ 4.200 desde el 18/11
- **WHEN** el 25/11 Día la informa a $ 3.950
- **THEN** la historia suma una fila con $ 3.950 y fecha 25/11, y conserva la del 18/11

#### Scenario: Una cadena que no vino
- **GIVEN** el 22/11 el archivo de SEPA llega sin Cencosud
- **WHEN** se procesa ese día
- **THEN** la historia no registra cambios en Disco, Jumbo ni Vea por la ausencia

#### Scenario: Un precio mal cargado
- **GIVEN** una sucursal informa un precio 10 veces más alto y el sitio lo descarta por no creíble
- **WHEN** se procesa ese día
- **THEN** ese precio no entra en la historia

### Requirement: Un cambio cuenta si es reciente y de 3% o más
Un producto en una cadena SHALL tener un cambio de precio para mostrar solo si su último cambio pasó en los últimos 30 días y movió el precio un 3% o más respecto del precio anterior. Los dos umbrales SHALL vivir en un solo lugar, y la API y los textos SHALL usar ese resultado sin recalcularlo.

#### Scenario: Cambio chico
- **GIVEN** el precio en Coto pasó de $ 1.000 a $ 1.020 hace 5 días
- **WHEN** se pide el detalle del producto
- **THEN** Coto no muestra ningún cambio

#### Scenario: Cambio viejo
- **GIVEN** el último cambio del producto en Día fue una baja de 10%, hace 45 días
- **WHEN** se pide el detalle del producto
- **THEN** Día no muestra ningún cambio

#### Scenario: Primer día de historia
- **GIVEN** la historia empezó hoy y todos los precios son su primera fila
- **WHEN** se pide cualquier producto
- **THEN** ninguna cadena muestra un cambio

### Requirement: El detalle del producto dice qué cadena cambió el precio
En el detalle de Mismo producto, cada cadena con un cambio para mostrar SHALL decir si subió o bajó, cuánto en porcentaje entero, la fecha en formato corto y el precio anterior. Una cadena sin cambio para mostrar NO SHALL decir nada sobre su historia.

#### Scenario: Una baja en Día
- **GIVEN** el aceite Cocinero 1,5 L pasó en Día de $ 4.000 a $ 3.600 el 25/11
- **WHEN** el usuario abre el detalle del aceite
- **THEN** la fila de Día dice "Bajó 10% el 25/11 (antes $ 4.000)"

#### Scenario: Sin cambios recientes
- **GIVEN** ninguna cadena cambió el precio del producto en los últimos 30 días
- **WHEN** el usuario abre el detalle
- **THEN** no ve ninguna línea de subió, bajó ni "sin cambios"

### Requirement: Tu lista dice si cambió el precio de donde conviene comprar
En Tu lista con zona, cada producto cuyo precio más barato de la zona tenga un cambio para mostrar en esa cadena SHALL decir debajo si subió o bajó, cuánto, en qué cadena y desde qué fecha. Los totales de la lista NO SHALL cambiar por esto.

#### Scenario: La yerba bajó donde conviene
- **GIVEN** la zona es Palermo, la yerba es más barata en Día y Día la bajó 6% el 25/11
- **WHEN** el usuario abre Tu lista
- **THEN** debajo de la yerba ve "Bajó 6% en Día el 25/11"

#### Scenario: Cambió en otra cadena
- **GIVEN** la yerba es más barata en Día y la que cambió el precio es Carrefour
- **WHEN** el usuario abre Tu lista
- **THEN** la yerba no muestra ningún cambio

#### Scenario: Sin zona
- **GIVEN** el usuario no eligió zona
- **WHEN** abre Tu lista
- **THEN** ningún producto muestra un cambio de precio
