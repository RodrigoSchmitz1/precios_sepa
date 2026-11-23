# Spec Delta

## ADDED Requirements

### Requirement: Tu mes en la cadena más barata de tu zona
Con zona, el resumen del mes SHALL decir cuánto hubieran salido los productos vinculados de los tickets del mes en la sucursal cerca de una sola cadena que los deja más baratos, contra lo que figura en los tickets para esos mismos productos antes de descuentos. Si esa cadena no tiene todos, SHALL decir cuántos de los productos del mes compara. SHALL decir que es a precio de lista y sin promos.

#### Scenario: Noviembre en Día
- **GIVEN** la zona es Caballito y los tickets de noviembre tienen productos vinculados por $ 180.000 antes de descuentos
- **AND** Día cerca cobra esos productos $ 162.000
- **WHEN** el usuario mira noviembre
- **THEN** lee que en Día esos productos salían $ 162.000, $ 18.000 menos, a precio de lista y sin promos

#### Scenario: Ya compró en la más barata
- **GIVEN** todos los tickets del mes son de Día y Día es la más barata para esos productos
- **WHEN** el usuario mira el mes
- **THEN** lee que ya compró en la más barata de su zona, sin una diferencia negativa

### Requirement: Cuánto ahorrabas mezclando dos cadenas
Con zona, el resumen del mes SHALL decir cuánto salían esos mismos productos repartidos entre las dos cadenas con sucursal cerca que dejan el total más bajo, qué llevar de cada una y cuánto menos que en una sola. Si mezclar no baja el total, SHALL NOT mostrarse.

#### Scenario: Día y Coto
- **GIVEN** los productos del mes salen $ 162.000 en Día y $ 151.000 repartidos entre Día y Coto
- **WHEN** el usuario mira el mes
- **THEN** lee que mezclando Día y Coto salían $ 151.000, $ 11.000 menos que solo en Día, y puede ver qué llevar de cada una

#### Scenario: Mezclar no conviene
- **GIVEN** repartir entre dos cadenas no baja el total de la más barata
- **WHEN** el usuario mira el mes
- **THEN** no ve la línea de mezclar dos

### Requirement: El resumen del mes avisa cuando no alcanza
El resumen del mes SHALL NOT compararse si los productos vinculados cubren menos del mínimo del importe de los tickets del mes, el mismo mínimo que la comparación de cada ticket. Los gastos anotados a mano SHALL NOT entrar en la cuenta. Con más productos que el tope de una lista, SHALL usar los de mayor importe y decir cuántos quedaron afuera. Sin zona, SHALL invitar a elegirla.

#### Scenario: Mes con poco vinculado
- **GIVEN** los tickets del mes suman $ 200.000 y sus productos vinculados $ 40.000
- **WHEN** el usuario mira el mes
- **THEN** no ve la comparación y lee que no se reconocieron suficientes productos del mes para compararlo

#### Scenario: Mes con solo gastos a mano
- **GIVEN** el mes tiene solo gastos anotados a mano
- **WHEN** el usuario mira el mes
- **THEN** no ve la comparación del mes

#### Scenario: Mes sin zona
- **GIVEN** el usuario no eligió zona y tiene tickets en el mes
- **WHEN** mira el mes
- **THEN** lee que eligiendo su zona le dice en qué súper le salía más barato el mes

### Requirement: El resumen del mes no consulta BigQuery
Calcular el resumen del mes SHALL resolverse con los datos que la API ya tiene en memoria, sin una consulta a BigQuery por pedido, y los tickets SHALL seguir sin guardarse en el servidor.

#### Scenario: Calcular el mes
- **GIVEN** un usuario con 12 tickets en el mes
- **WHEN** abre Mis gastos
- **THEN** el sitio pide la cuenta con la lista de productos y cantidades del mes, no ejecuta ninguna consulta nueva en BigQuery y no guarda nada en el servidor
