# Spec Delta

## ADDED Requirements

### Requirement: Resumen del mes como app de gastos
Mis gastos SHALL mostrar el mes elegido con: meses en pastillas, una tarjeta principal con el total, la variación contra el mes anterior, la cantidad de compras, el gasto por compra y el gasto por día; una tarjeta de ahorro (promos y súper más barato de la zona); una dona por categoría con porcentajes; barras por semana del mes con el promedio; y el gasto por súper con cantidad de compras y porcentaje.

#### Scenario: Un mes con tickets
- **WHEN** el usuario abre Mis gastos con 3 compras en noviembre por $90.000
- **THEN** ve $90.000, 3 compras, $30.000 por compra, la dona por categoría, las semanas y el gasto por súper

### Requirement: Gasto por día
El gasto por día SHALL dividir el total del mes por los días transcurridos: hasta hoy si es el mes en curso, o todos los días del mes si ya terminó.

#### Scenario: Mes en curso
- **WHEN** hoy es 26 de noviembre y el mes suma $52.000
- **THEN** el gasto por día es $2.000

### Requirement: Movimientos por día
Los tickets del mes SHALL listarse agrupados por fecha, del más nuevo al más viejo, con un encabezado por día ("Hoy · 26 nov" para hoy, el día de la semana y la fecha para el resto). Cada uno SHALL mostrar la cadena, la cantidad de productos o "a mano", el total y el ahorro en promos si lo hubo.

#### Scenario: Dos tickets el mismo día
- **WHEN** hay dos tickets del 20 de noviembre
- **THEN** aparecen juntos bajo un solo encabezado "Viernes 20 nov"

### Requirement: Aviso del ejemplo con su origen
Con el mes de ejemplo, el aviso SHALL decir cuántos tickets y qué total lo forman, y que la página va a mostrar los tickets que se carguen.

#### Scenario: Mes de ejemplo
- **WHEN** se ve el ejemplo de 7 tickets por $158.473
- **THEN** el aviso dice "7 tickets por $ 158.473" y que cuando cargues tus tickets la página va a mostrar tus compras
