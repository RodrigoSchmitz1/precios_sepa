## ADDED Requirements

### Requirement: Promos bancarias curadas con su fuente
Cada promo bancaria SHALL tener: las cadenas donde vale, la entidad (banco o billetera), el medio de pago, los días de la semana, el porcentaje, si es descuento en caja o reintegro, el canal (sucursal, online o ambos), la vigencia desde y hasta, la URL de la fuente y la fecha de revisión. SHALL poder tener tope y su período, compra mínima, segmento, rubros y si acumula con la promo de góndola (sí, no o no se sabe).

#### Scenario: Una promo completa
- **GIVEN** la página de descuentos de Día dice que los miércoles hay 20 % de reintegro con MODO, con tope de $ 20.000 por mes y compra mínima de $ 35.000
- **WHEN** se carga en el archivo
- **THEN** queda con cadena Día, entidad MODO, medio QR, día miércoles, 20 %, reintegro, tope $ 20.000 mensual, compra mínima $ 35.000, la URL de la página de Día y la fecha en que se revisó

### Requirement: Solo hechos, con palabras propias
El archivo SHALL guardar solo datos (porcentajes, días, topes, entidades, fechas) y una nota breve escrita con palabras propias. NO SHALL copiar textos legales, imágenes ni datos de otros agregadores.

#### Scenario: Una condición rara
- **GIVEN** una promo que vale solo para galletitas y gaseosas
- **WHEN** se carga
- **THEN** se anotan los rubros y una nota propia como "solo algunos rubros", sin pegar el texto legal de la cadena

### Requirement: El archivo se valida
Los tests SHALL rechazar el archivo si a una promo le falta un campo obligatorio, si el porcentaje no está entre 1 y 100, si la vigencia termina antes de empezar, si nombra una cadena que el sitio no conoce o si la fecha de revisión es posterior a hoy.

#### Scenario: Una cadena mal escrita
- **GIVEN** una promo cargada con la cadena "Carefour"
- **WHEN** corren los tests
- **THEN** fallan y dicen qué promo nombra una cadena desconocida

### Requirement: La API sirve las promos vigentes sin BigQuery
`GET /api/promos-bancarias` SHALL devolver las promos vigentes en la fecha de la Argentina, leídas del archivo, que se carga una vez por instancia. Una promo con la vigencia vencida NO SHALL devolverse. Servirlas NO SHALL consultar BigQuery.

#### Scenario: Una promo vencida
- **GIVEN** una promo con vigencia hasta el 30 de noviembre
- **WHEN** alguien pide las promos el 1 de diciembre
- **THEN** esa promo no viene en la respuesta

### Requirement: Promos bancarias de hoy en la portada
Con una zona elegida, la portada SHALL mostrar las promos bancarias de hoy de las cadenas de la zona, con chips "Hoy" y "Mañana". SHALL ir debajo de las promos del día, sin sacar su título de la primera pantalla. Cada promo SHALL mostrar la cadena, el porcentaje, la entidad y, en una línea, si es en caja o reintegro, el canal y el tope.

#### Scenario: Un jueves en Palermo
- **GIVEN** la zona es Palermo y hoy es jueves
- **WHEN** el usuario abre la portada
- **THEN** ve las promos bancarias de los jueves de las cadenas con sucursal cerca de Palermo, y no las de cadenas que no están en su zona

#### Scenario: Mañana
- **WHEN** el usuario toca "Mañana"
- **THEN** ve las promos del día siguiente

### Requirement: Cada promo dice de dónde sale
Cada promo bancaria que se muestra SHALL decir de qué página sale, con un enlace, y la fecha en que se revisó ("revisada el 27/11"). SHALL aclarar que conviene confirmar en la app del banco antes de pagar.

#### Scenario: Ver la fuente
- **WHEN** el usuario mira una promo de Carrefour
- **THEN** lee "Fuente: página de Carrefour · revisada el 27/11" con el enlace a esa página

### Requirement: Mis tarjetas en el teléfono
El usuario SHALL poder marcar los bancos y billeteras que tiene, entre las entidades que aparecen en las promos vigentes. Lo marcado SHALL guardarse solo en el teléfono. Con tarjetas marcadas, la portada y "Con qué pagar" SHALL mostrar primero, o solo, las promos que puede usar, con una opción para ver todas.

#### Scenario: Marcar MODO y Banco Nación
- **GIVEN** el usuario marca MODO y Banco Nación en Mis tarjetas
- **WHEN** abre la portada
- **THEN** ve solo las promos de hoy de MODO y Banco Nación en su zona, y un enlace para ver todas

#### Scenario: Sin tarjetas marcadas
- **WHEN** el usuario no marcó ninguna
- **THEN** ve todas las promos e invita a marcar sus tarjetas

### Requirement: Con qué pagar tu compra
Con lista y zona, Mi compra SHALL decir, para las cadenas de la zona con la lista completa, la mejor promo bancaria del día que el usuario puede usar. SHALL mostrar dos cifras: cuánto paga en caja y cuánto le devuelven después, con el tope aplicado. El canal SHALL ser sucursal por defecto.

#### Scenario: Reintegro con tope
- **GIVEN** la lista sale $ 54.619 en Día y hoy hay 20 % de reintegro con MODO en Día, con tope de $ 10.000
- **WHEN** el usuario, con MODO marcado, abre Mi compra
- **THEN** lee que en Día paga $ 54.619 en caja y le devuelven $ 10.000 en 10 a 30 días, porque el 20 % sería $ 10.924 y el tope es $ 10.000

#### Scenario: Descuento en caja
- **GIVEN** hoy hay 25 % de descuento en caja con Banco Ciudad en Coto, sin tope, y la lista sale $ 57.212 en Coto
- **WHEN** el usuario, con Banco Ciudad marcado, abre Mi compra
- **THEN** lee que en Coto paga $ 42.909 en caja

### Requirement: Lo que no se puede calcular se dice
Una promo que depende de un segmento que el usuario no marcó o que vale solo en algunos rubros SHALL mostrarse como "a confirmar", sin monto. Si la compra no llega a la compra mínima, SHALL decirlo. Si no se sabe si la promo acumula con la de góndola, SHALL decirlo junto a la cifra.

#### Scenario: Solo algunos rubros
- **GIVEN** una promo de 40 % que vale solo para galletitas y gaseosas
- **WHEN** aparece en Con qué pagar
- **THEN** se muestra como "a confirmar: solo algunos rubros", sin un monto de ahorro

#### Scenario: Debajo de la compra mínima
- **GIVEN** una promo con compra mínima de $ 35.000 y una lista que sale $ 20.000
- **WHEN** aparece en Con qué pagar
- **THEN** dice que hace falta comprar $ 35.000 o más para usarla

### Requirement: Cómo se curan las promos
El repositorio SHALL tener un documento con la curaduría semanal:
- qué páginas se revisan y cada cuánto;
- qué campos se anotan;
- qué no se copia;
- cómo se marca la fecha de revisión;
- qué se hace con una promo que ya no aparece.

#### Scenario: Una promo que desapareció de la página
- **GIVEN** una promo cargada que ya no figura en la página de la cadena
- **WHEN** se hace la revisión semanal
- **THEN** el documento indica sacarla o cerrar su vigencia ese día
