# Spec Delta

## Purpose

Bajar y guardar cada día los precios de SEPA mayoristas con el mismo detalle que los minoristas (producto, sucursal, día, precio y promos), con precio por unidad y sucursales ubicadas, identificados como mayoristas.

## ADDED Requirements

### Requirement: Mayoristas con el mismo detalle que minoristas
El pipeline SHALL guardar, por cada fecha, una fila por comercio, bandera, sucursal y producto de cada mayorista que informa SEPA, con su precio de lista y sus dos promos. SHALL NOT agregar por cadena antes de guardar.

#### Scenario: Un producto en 38 sucursales
- **GIVEN** Maxiconsumo informa un código de barras en 38 sucursales el 25-11
- **WHEN** termina la carga de esa fecha
- **THEN** el crudo de mayoristas tiene 38 filas de ese código para Maxiconsumo, una por sucursal, cada una con su precio y sus promos

### Requirement: El precio de lista es por unidad comprando el bulto
El precio de lista de un mayorista SHALL ser el precio por unidad comprando el bulto, con IVA. Cada fila SHALL guardar también las unidades por bulto, el precio del bulto con IVA y los precios sin IVA tal como los publica SEPA.

#### Scenario: Bulto de 12
- **GIVEN** Maxiconsumo publica un desodorante a $23.758,44 el bulto de 12, $1.979,87 por unidad
- **WHEN** se carga esa fila
- **THEN** su precio de lista es $1.979,87, con 12 unidades por bulto y $23.758,44 de precio del bulto

#### Scenario: Venta por unidad
- **GIVEN** Makro publica un producto con 1 unidad por bulto
- **WHEN** se carga esa fila
- **THEN** su precio de lista es igual al precio del bulto

### Requirement: Promos en cero son sin promo
Un precio de promo vacío o igual a cero SHALL guardarse como sin promo.

#### Scenario: La Agrícola Regional informa 0.00
- **GIVEN** La Agrícola Regional publica `0.00` como precio de promo en todos sus productos
- **WHEN** se cargan esas filas
- **THEN** ninguna de ellas tiene promo

### Requirement: El tamaño sale de la descripción
Como SEPA mayoristas no informa gramos ni cc, el tamaño de un producto mayorista SHALL leerse de su descripción con la misma regla que ya se usa cuando la fuente dice "1 unidad".

#### Scenario: Aceite de litro y medio
- **GIVEN** un mayorista publica "ACEITE DE GIRASOL COCINERO 1.5 LT"
- **WHEN** se normaliza su tamaño
- **THEN** queda en 1.500 cc

### Requirement: Un mayorista se identifica como tal
Cada comercio de SEPA mayoristas SHALL tener formato `mayorista`, en el mismo lugar donde se define el formato de supermercados y farmacias. Un comercio de SEPA minoristas SHALL conservar su formato aunque venda al por mayor.

#### Scenario: Makro y Maxi
- **WHEN** se leen los formatos
- **THEN** Makro es `mayorista` y Maxi (Carrefour) sigue siendo `supermercado`

### Requirement: Los números de comercio no se pisan
El pipeline SHALL fallar si un mismo número de comercio aparece en SEPA minoristas y en SEPA mayoristas.

#### Scenario: Un número repetido
- **GIVEN** un día SEPA mayoristas publica un comercio con el mismo número que uno de minoristas
- **WHEN** corre el pipeline
- **THEN** falla diciendo qué número se repite

### Requirement: Las sucursales de mayoristas tienen ubicación
Toda sucursal mayorista con precios SHALL tener latitud y longitud. Cuando SEPA no las publica, SHALL usarse una corrección cargada a mano a partir de la dirección. Una corrección SHALL NOT pisar una coordenada que SEPA sí publica.

#### Scenario: Makro sin longitud
- **GIVEN** SEPA publica la sucursal Olivos de Makro con latitud y sin longitud
- **WHEN** se arman las sucursales
- **THEN** Olivos tiene la ubicación de la corrección y aparece en el mapa

#### Scenario: Una sucursal nueva sin coordenadas
- **GIVEN** un mayorista suma una sucursal con precios y sin coordenadas, y no tiene corrección
- **WHEN** corre el pipeline
- **THEN** falla nombrando esa sucursal

### Requirement: Las fechas de mayoristas que faltan se recuperan
La ingesta SHALL bajar y cargar cada fecha de los últimos 7 días que falte en el crudo de mayoristas, igual que con minoristas. Una fecha que SEPA todavía no publicó SHALL quedar para la corrida siguiente, sin error.

#### Scenario: Se cayó solo el recurso de mayoristas
- **GIVEN** el 24-11 minoristas se cargó y el recurso de mayoristas respondía con error
- **WHEN** corre la ingesta del 25
- **THEN** se carga mayoristas del 24 sin volver a cargar minoristas del 24

### Requirement: La historia guarda los cambios de precio de los mayoristas
La historia de precio de cada producto SHALL registrar también los cambios del precio de cada mayorista, con el mismo registro de cambios que las demás cadenas. SHALL NOT guardarse una historia por sucursal.

#### Scenario: Maxiconsumo cambia un precio
- **GIVEN** el precio de un producto en Maxiconsumo pasa de $1.900 a $1.980 entre el 24 y el 25-11
- **WHEN** corre dbt el 25
- **THEN** la historia de ese producto tiene una fila de Maxiconsumo del 25 a $1.980

### Requirement: Una falla de mayoristas no frena a minoristas
Si la descarga o la carga de mayoristas falla, minoristas SHALL cargarse igual, la tarea SHALL terminar con error y el registro SHALL decir qué falló.

#### Scenario: Portal de mayoristas caído
- **GIVEN** el recurso de mayoristas responde con error
- **WHEN** corre la ingesta
- **THEN** minoristas se carga y la tarea termina con código de error

### Requirement: La carga de sucursales conserva al otro dataset
Cargar sucursales y comercios SHALL conservar los registros de todo comercio que no vino en esa carga, sea minorista o mayorista, y la foto anterior que usa la detección de cambios SHALL ser la del día anterior para los dos.

#### Scenario: Mayoristas no vino
- **GIVEN** un día baja minoristas y mayoristas falla
- **WHEN** se cargan sucursales y comercios
- **THEN** las sucursales de los mayoristas siguen en la tabla

### Requirement: El crudo de mayoristas retiene lo mismo que el de minoristas
El crudo de mayoristas SHALL tener la misma retención que el de minoristas, incluida la que se abre mientras haya fechas recuperadas sin llegar a la historia.

#### Scenario: Backfill de tres días
- **GIVEN** la ingesta abre la retención del crudo de minoristas a 6 días por un backfill
- **WHEN** termina el ajuste
- **THEN** el crudo de mayoristas también retiene 6 días

### Requirement: Los mayoristas llegan a la app con un interruptor
Mientras el interruptor de mayoristas esté apagado, ningún mart ni pantalla SHALL incluir mayoristas, aunque la ingesta ya los cargue.

#### Scenario: Interruptor apagado
- **GIVEN** la ingesta cargó mayoristas y el interruptor está apagado
- **WHEN** corre dbt
- **THEN** ningún mart tiene filas de comercios con formato `mayorista`
