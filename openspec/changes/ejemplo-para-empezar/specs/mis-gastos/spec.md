# Spec Delta

## ADDED Requirements

### Requirement: Mes de ejemplo con cero gastos
Con cero gastos guardados y sin haber descartado el ejemplo, Mis gastos SHALL mostrar un mes de ejemplo de 7 tickets en varias cadenas y categorías, armados con productos y precios reales de los básicos, con al menos dos líneas de promo, y SHALL mostrar con ellos lo mismo que con tickets reales: total del mes, por súper, por categoría, ahorro en promos y lo que hubiera costado en el súper más barato de la zona.

#### Scenario: Primera visita a Mis gastos
- **WHEN** alguien abre Mis gastos sin gastos guardados
- **THEN** ve el resumen de un mes de ejemplo con el ahorro en promos y lo que hubiera pagado en el súper más barato

### Requirement: Cartel del ejemplo
Con el ejemplo a la vista, un cartel SHALL decir "Así se ve con tus tickets. Es un ejemplo." con el botón "Borrar el ejemplo y empezar", y las formas de cargar un ticket SHALL seguir a la vista.

#### Scenario: Borrar el ejemplo
- **WHEN** el usuario toca "Borrar el ejemplo y empezar"
- **THEN** ve la página vacía con las formas de cargar un ticket, y el ejemplo no vuelve

### Requirement: El ejemplo no es un gasto
Los gastos de ejemplo SHALL vivir solo en memoria: no se guardan en el teléfono ni entran en el presupuesto, el Excel, la compra habitual, la racha, el informe del mes ni las señales anónimas. Al guardar el primer gasto real, el ejemplo SHALL desaparecer y la página SHALL mostrar solo los gastos reales.

#### Scenario: Primer gasto real
- **WHEN** con el ejemplo a la vista el usuario anota un monto a mano
- **THEN** el ejemplo desaparece y el mes muestra solo ese gasto
