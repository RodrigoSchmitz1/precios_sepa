# mis-gastos Specification

## Purpose
Que cada persona lleve el registro de lo que gasta en el supermercado a partir de la foto de sus tickets o de montos anotados a mano, guardado en su teléfono, con resúmenes por mes, súper y categoría, el ahorro en promos y la comparación con la cadena más barata de su zona.

## Requirements

### Requirement: Sección Mis gastos
El sitio SHALL tener una página `/gastos` llamada "Mis gastos". Sin gastos cargados, la página SHALL explicar en pocas líneas para qué sirve y ofrecer las dos formas de cargar un gasto: sacar una foto del ticket o anotar el monto.

#### Scenario: Primera visita
- **GIVEN** el usuario nunca cargó un gasto
- **WHEN** abre `/gastos`
- **THEN** ve "Mis gastos", una explicación corta y los botones "Sacar foto del ticket" y "Anotar un monto"

### Requirement: Aviso antes de la primera foto
Antes de mandar la primera foto, la página SHALL decir que la foto se manda a leer y no se guarda, que los datos personales del ticket se descartan y que los gastos quedan solo en ese teléfono. El aviso SHALL aceptarse una vez por teléfono y SHALL poder releerse desde la página.

#### Scenario: Primera foto
- **GIVEN** el usuario no aceptó el aviso
- **WHEN** toca "Sacar foto del ticket"
- **THEN** ve el aviso y la foto se manda solo después de aceptarlo

#### Scenario: Fotos siguientes
- **GIVEN** el usuario ya aceptó el aviso en ese teléfono
- **WHEN** toca "Sacar foto del ticket"
- **THEN** pasa directo a la cámara o a elegir la foto

### Requirement: Leer un ticket desde fotos
El usuario SHALL poder cargar de 1 a 3 fotos del mismo ticket. La API SHALL devolver la cadena, la sucursal impresa si la hay, la fecha, el número de comprobante, el total, cada línea (descripción, cantidad, precio unitario, importe y código de barras si está impreso) y cada descuento con su importe.

#### Scenario: Ticket con productos y descuentos
- **GIVEN** una foto legible de un ticket de Coto con 12 productos y una promo "40% VINOS/CHAM"
- **WHEN** el usuario la manda
- **THEN** ve la cadena, la fecha, el total, las 12 líneas y el descuento con su importe

#### Scenario: Ticket largo en varias fotos
- **GIVEN** un ticket que no entra en una foto
- **WHEN** el usuario manda 2 fotos, de arriba y de abajo
- **THEN** recibe un solo ticket con las líneas de las dos fotos y sin líneas repetidas

### Requirement: Revisar antes de guardar
Antes de guardar un ticket leído, el usuario SHALL ver lo leído y poder corregir la cadena, la fecha y el total, y sacar líneas. Si la suma de las líneas y los descuentos no coincide con el total impreso, la página SHALL decirlo. Nada SHALL guardarse sin que el usuario confirme.

#### Scenario: La suma no cierra
- **GIVEN** un ticket leído cuyas líneas menos los descuentos suman $ 41.200 y el total impreso es $ 43.900
- **WHEN** el usuario revisa el ticket
- **THEN** la página dice que faltan $ 2.700 de líneas y permite guardarlo igual o volver a sacar la foto

### Requirement: La foto y los datos personales no se guardan
La API SHALL leer la foto y descartarla sin guardarla en disco, en registros ni en ninguna base. La respuesta SHALL NOT incluir DNI, CUIT del cliente, nombre, número de tarjeta ni número de cliente, aunque estén impresos.

#### Scenario: Ticket con DNI y tarjeta
- **GIVEN** un ticket de Jumbo que imprime "DNI:18005992" y "Tarj:379975*****1007"
- **WHEN** la API lo lee
- **THEN** la respuesta no contiene ni el DNI ni los números de la tarjeta

### Requirement: Foto que no se puede leer
Si la foto no es un ticket de compra o no se puede leer, la página SHALL decirlo y ofrecer volver a sacarla o anotar el monto a mano. Si la API está al límite de pedidos, SHALL decir que se pruebe de nuevo en un minuto, sin un error genérico.

#### Scenario: Foto borrosa
- **WHEN** el usuario manda una foto en la que no se lee ninguna línea
- **THEN** la página dice que no pudo leer el ticket y ofrece "Sacar otra foto" y "Anotar el monto"

#### Scenario: Límite de pedidos
- **GIVEN** el servicio de lectura responde que superó el límite de pedidos
- **WHEN** el usuario manda una foto
- **THEN** la página dice "Probá de nuevo en un minuto" y no pierde las fotos elegidas

### Requirement: Vincular líneas por código de barras
Cuando una línea trae un código de barras impreso, la API SHALL vincularla con el producto de SEPA de ese código, también si viene con un cero adelante (14 dígitos). Los códigos de pesables, que empiezan con 2 y llevan el precio adentro, SHALL NOT vincularse por código.

#### Scenario: Código de Coto con cero adelante
- **GIVEN** una línea con "07793147570187"
- **WHEN** la API vincula el ticket
- **THEN** la línea queda vinculada al producto 7793147570187 con su nombre y su categoría de SEPA

#### Scenario: Producto pesable
- **GIVEN** una línea "MANI SIN SAL X KG" con código "02573096000950"
- **WHEN** la API vincula el ticket
- **THEN** la línea no se vincula por código y pasa a vincularse por candidatos

### Requirement: Vincular líneas sin código
Cuando una línea no trae código o el código no está en SEPA, la API SHALL buscar candidatos de la misma cadena con precio parecido al pagado y elegir uno solo si coincide con la descripción. Si no, la línea SHALL quedar sin producto y con una categoría deducida del texto, o "Otros".

#### Scenario: Ticket de Día sin códigos
- **GIVEN** una línea de Día "GASEOSA COCA SIN AZU" a $ 3.100
- **WHEN** la API vincula el ticket
- **THEN** la línea queda vinculada a una Coca-Cola sin azúcar que Día informa a un precio parecido, o queda sin producto en la categoría Bebidas

#### Scenario: Sin candidato que coincida
- **GIVEN** una línea "ART VARIOS 1" sin código
- **WHEN** la API vincula el ticket
- **THEN** la línea queda sin producto y en la categoría "Otros"

### Requirement: Anotar un monto a mano
El usuario SHALL poder cargar un gasto con súper, fecha y monto, sin foto. Ese gasto SHALL contar en los totales por mes y por súper, y en la categoría "Sin detalle".

#### Scenario: Gasto anotado
- **WHEN** el usuario anota $ 25.000 en Carrefour el 20/11/2026
- **THEN** noviembre suma $ 25.000 más, Carrefour también, y la categoría "Sin detalle" muestra ese monto

### Requirement: Un ticket no se carga dos veces
La página SHALL reconocer un ticket ya cargado por su cadena, número de comprobante, fecha y total. Si coincide, SHALL avisar y no SHALL guardarlo de nuevo salvo que el usuario lo confirme.

#### Scenario: Misma foto dos veces
- **GIVEN** el usuario ya guardó el ticket 13945-00148992 de Jumbo del 09/01/2025
- **WHEN** vuelve a mandar una foto del mismo ticket
- **THEN** la página dice que ese ticket ya está cargado y no lo duplica

### Requirement: Los gastos se guardan en el teléfono
Los gastos SHALL guardarse solo en el navegador del teléfono, sin cuenta y sin mandarlos al servidor. Si el navegador no permite guardar, la página SHALL seguir funcionando en esa visita y decir que los gastos no van a quedar guardados.

#### Scenario: Volver otro día
- **GIVEN** el usuario guardó 3 tickets
- **WHEN** vuelve a abrir `/gastos` al día siguiente en el mismo teléfono
- **THEN** ve sus 3 tickets

#### Scenario: Navegador sin almacenamiento
- **GIVEN** el navegador no deja guardar datos
- **WHEN** el usuario carga un ticket
- **THEN** lo ve en esa visita y un aviso dice que no va a quedar guardado

### Requirement: Resumen de gastos
La página SHALL mostrar el gasto del mes elegido, su comparación con el mes anterior, el gasto por súper y por categoría, y la lista de tickets del mes. El usuario SHALL poder cambiar de mes.

#### Scenario: Mes con tickets
- **GIVEN** en noviembre hay 4 tickets por $ 180.000, $ 120.000 en Coto y $ 60.000 en Día, y en octubre se gastaron $ 150.000
- **WHEN** el usuario mira noviembre
- **THEN** ve $ 180.000, un 20 % más que octubre, Coto $ 120.000 y Día $ 60.000, y las categorías de esos tickets

### Requirement: Ahorro en promos
La página SHALL sumar los descuentos impresos en los tickets del mes y mostrarlos como ahorro en promos. Un gasto anotado a mano SHALL NOT sumar ahorro.

#### Scenario: Descuentos del mes
- **GIVEN** dos tickets de noviembre con descuentos de $ 69,20 y $ 1.500
- **WHEN** el usuario mira noviembre
- **THEN** ve "Ahorraste $ 1.569 en promos"

### Requirement: Cuánto hubieras pagado en la cadena más barata
Para cada ticket, la página SHALL comparar sus productos vinculados contra el precio de lista de las cadenas de la zona del usuario y decir cuánto salían en la más barata. SHALL decir que es a precio de lista y sin promos, y SHALL NOT mostrarlo si los productos vinculados cubren menos del mínimo del importe del ticket.

#### Scenario: Ticket bien vinculado
- **GIVEN** un ticket de Coto de $ 40.000 con productos vinculados por $ 36.000 y Día cerca de la zona cobra esos productos $ 31.000 a precio de lista
- **WHEN** el usuario mira el ticket
- **THEN** ve que en Día esos productos salían $ 31.000 a precio de lista, sin promos

#### Scenario: Pocos productos vinculados
- **GIVEN** un ticket de $ 40.000 en el que solo se vincularon productos por $ 8.000
- **WHEN** el usuario mira el ticket
- **THEN** no ve la comparación y ve que no se reconocieron suficientes productos para compararlo

### Requirement: Bajar a Excel
La página SHALL ofrecer "Bajar a Excel", que descarga un archivo .xlsx con una hoja de gastos (fecha, súper, total, ahorro en promos, origen foto o a mano) y una hoja de líneas (fecha, súper, descripción, producto vinculado, categoría, cantidad, precio e importe).

#### Scenario: Descargar
- **GIVEN** el usuario tiene 10 gastos con 120 líneas
- **WHEN** toca "Bajar a Excel"
- **THEN** descarga un .xlsx con 10 filas en la hoja de gastos y 120 en la de líneas, con montos como números

### Requirement: Borrar gastos
El usuario SHALL poder borrar un gasto y borrar todos sus gastos. Borrar todos SHALL pedir confirmación.

#### Scenario: Borrar todo
- **WHEN** el usuario toca "Borrar todos mis gastos" y confirma
- **THEN** la página queda como en la primera visita, con el aviso ya aceptado

### Requirement: Mis gastos no consulta BigQuery
Leer un ticket, vincularlo y comparar precios SHALL resolverse con los datos que la API ya tiene en memoria. Ningún pedido de Mis gastos SHALL disparar una consulta a BigQuery.

#### Scenario: Leer un ticket
- **WHEN** la API lee y vincula un ticket
- **THEN** no se ejecuta ninguna consulta a BigQuery
