# Spec Delta

## MODIFIED Requirements

### Requirement: Aviso antes de la primera foto
Antes de mandar la primera foto, la página SHALL decir que la foto la lee Google Gemini en servidores de Estados Unidos y no se guarda, que los datos personales del ticket se descartan y que los gastos quedan solo en ese teléfono. El aviso SHALL aceptarse una vez por teléfono con un botón que diga que se acepta, y SHALL poder releerse desde la página.

#### Scenario: Primera foto
- **GIVEN** el usuario no aceptó el aviso
- **WHEN** toca "Sacar foto del ticket"
- **THEN** ve el aviso, que nombra a Google Gemini y a Estados Unidos, y la foto se manda solo después de tocar "Acepto y saco la foto"

#### Scenario: Fotos siguientes
- **GIVEN** el usuario ya aceptó el aviso en ese teléfono
- **WHEN** toca "Sacar foto del ticket"
- **THEN** pasa directo a la cámara o a elegir la foto

## ADDED Requirements

### Requirement: Tu compra habitual
La compra habitual SHALL ser los productos vinculados que aparecen en al menos dos tickets de los últimos 90 días, hasta 30, ordenados por cuántas veces aparecen, con la cantidad típica de cada uno. Con menos de 3 productos así, las secciones que la usan SHALL NOT mostrarse.

#### Scenario: Pocos tickets
- **GIVEN** el usuario cargó un solo ticket
- **WHEN** abre Mis gastos
- **THEN** no ve las secciones de compra habitual

### Requirement: Lo que comprás seguido está en promo cerca
Con zona y compra habitual, Mis gastos SHALL decir cuántos productos de la compra habitual están en promo cerca y mostrar cada uno con su promo más barata, con los mismos datos que los avisos de oferta. Sin ninguno en promo, SHALL NOT mostrar un bloque vacío. Sin zona, SHALL invitar a elegirla.

#### Scenario: Dos productos en promo
- **GIVEN** la zona es Caballito y la compra habitual tiene yerba y aceite, los dos en promo cerca
- **WHEN** el usuario abre Mis gastos
- **THEN** lee "2 cosas que comprás seguido están en promo cerca" con las dos promos

### Requirement: Dónde te conviene la próxima compra
Con zona y compra habitual, Mis gastos SHALL decir en qué súper de la zona sale más barata la compra habitual y cuánto, y cuánto sale mezclando dos si baja el total, a precio de lista y sin promos.

#### Scenario: La próxima compra
- **GIVEN** la compra habitual sale $ 42.000 en Día y $ 39.500 mezclando Día y Coto
- **WHEN** el usuario abre Mis gastos
- **THEN** lee que su compra habitual sale menos en Día, $ 42.000, y que mezclando Día y Coto sale $ 39.500

### Requirement: Presupuesto del mes
El usuario SHALL poder poner un presupuesto mensual, cambiarlo y sacarlo. Con presupuesto, el resumen del mes SHALL mostrar cuánto lleva gastado, cuánto le queda y una barra de avance; desde el 80 % SHALL avisarlo, y al pasarlo SHALL decir por cuánto. El presupuesto SHALL guardarse solo en el teléfono.

#### Scenario: Cerca del tope
- **GIVEN** el presupuesto es $ 300.000 y en el mes lleva $ 255.000
- **WHEN** abre Mis gastos
- **THEN** ve que lleva el 85 %, que le quedan $ 45.000 y un aviso de que está cerca del tope

#### Scenario: Pasado
- **GIVEN** el presupuesto es $ 300.000 y lleva $ 320.000
- **WHEN** abre Mis gastos
- **THEN** ve que se pasó por $ 20.000

### Requirement: Informe del mes para compartir
El resumen del mes SHALL tener "Compartir", que arma un texto corto con el mes, el total, la comparación con el mes anterior, la categoría con más gasto y el ahorro en promos, sin tickets, sin súper ni sucursales.

#### Scenario: Compartir noviembre
- **GIVEN** en noviembre gastó $ 180.000, 10 % menos que en octubre, más en Almacén, y ahorró $ 6.000 en promos
- **WHEN** toca "Compartir"
- **THEN** el texto dice el mes, $ 180.000, 10 % menos que el mes anterior, Almacén y $ 6.000 de ahorro en promos

### Requirement: Racha de semanas
Mis gastos SHALL mostrar la racha de semanas seguidas, terminando en la actual o en la anterior, con al menos un gasto cargado. Con menos de 2 semanas, SHALL NOT mostrarse.

#### Scenario: Tres semanas
- **GIVEN** el usuario cargó gastos esta semana y las dos anteriores
- **WHEN** abre Mis gastos
- **THEN** ve "3 semanas seguidas cargando tus gastos"
