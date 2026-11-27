## MODIFIED Requirements

### Requirement: Resumen de gastos
La página SHALL mostrar:
- el gasto del mes elegido y su comparación con el mes anterior;
- el gasto por súper y por rubro;
- la lista de tickets del mes.

El usuario SHALL poder cambiar de mes.

#### Scenario: Mes con tickets
- **GIVEN** en noviembre hay 4 tickets por $ 180.000, $ 120.000 en Coto y $ 60.000 en Día, y en octubre se gastaron $ 150.000
- **WHEN** el usuario mira noviembre
- **THEN** ve $ 180.000, un 20 % más que octubre, Coto $ 120.000 y Día $ 60.000, y los rubros de esos tickets

### Requirement: Resumen del mes como app de gastos
Mis gastos SHALL mostrar el mes elegido con:
- los meses en pastillas;
- una tarjeta principal con el total, la variación contra el mes anterior, la cantidad de compras, el gasto por compra y el ahorro en promos;
- una tarjeta "En qué gastaste" con un selector Rubros · Productos · Súper;
- "Tu inflación";
- los movimientos.

Semana a semana, el presupuesto y las acciones (Excel, compartir y borrar) SHALL quedar plegados al final.

#### Scenario: Un mes con tickets
- **WHEN** el usuario abre Mis gastos con 3 compras en noviembre por $90.000
- **THEN** ve $90.000, 3 compras, $30.000 por compra, "En qué gastaste" con la vista por rubros elegida y los movimientos

#### Scenario: Lo secundario plegado
- **WHEN** el usuario baja hasta el final de Mis gastos
- **THEN** ve "Semana a semana", el presupuesto y las acciones cerrados, y cada uno se abre con un toque

### Requirement: Movimientos por día
Los tickets del mes SHALL listarse agrupados por fecha, del más nuevo al más viejo, con un encabezado por día: "Hoy · 26 nov" para hoy, y el día de la semana y la fecha para el resto. Cada uno SHALL mostrar la cadena, la cantidad de productos o "a mano", el total y el ahorro en promos si lo hubo. Si la comparación con la cadena más barata de la zona se puede mostrar, el movimiento SHALL decir también cuánto menos salía ahí.

#### Scenario: Dos tickets el mismo día
- **WHEN** hay dos tickets del 20 de noviembre
- **THEN** aparecen juntos bajo un solo encabezado "Viernes 20 nov"

#### Scenario: Un ticket que salía menos en otra cadena
- **GIVEN** un ticket de Carrefour de $ 16.022 cuyos productos salían $ 14.882 en Día, de la zona, a precio de lista
- **WHEN** el usuario mira los movimientos
- **THEN** el ticket muestra $ 16.022 y "en Día: −$ 1.140"

## ADDED Requirements

### Requirement: Gastos por rubro
La vista Rubros SHALL agrupar lo gastado por el rubro de cada producto (Almacén, Lácteos, Bebidas, Carnes, Higiene, Limpieza y los demás de la taxonomía del sitio), no por las categorías de SEPA. SHALL mostrar los 7 rubros con más gasto y juntar el resto en "Otros". El rubro de cada categoría SHALL salir de la misma taxonomía que usa el resto del sitio. Una línea sin categoría conocida va a "Otros"; un gasto a mano, a "Sin detalle".

#### Scenario: El mes de ejemplo
- **WHEN** el usuario ve la vista Rubros del mes de ejemplo
- **THEN** ve a lo sumo 8 porciones, y "Otros" no es la más grande

#### Scenario: Un gasto a mano
- **GIVEN** el mes tiene un ticket con productos y un monto anotado a mano por $ 20.000
- **WHEN** el usuario ve la vista Rubros
- **THEN** los $ 20.000 aparecen como "Sin detalle", aparte de los rubros

### Requirement: Productos de un rubro
Tocar un rubro SHALL mostrar debajo sus productos del mes, de mayor a menor gasto, con la cantidad comprada y el total. SHALL mostrar los primeros 5 y un "+ N productos más" que despliega el resto. Se SHALL ver un rubro abierto por vez.

#### Scenario: Abrir Almacén
- **GIVEN** en noviembre Almacén suma $ 48.835 en 13 productos, el primero Yerba Playadito 1 kg ×3 por $ 15.624
- **WHEN** el usuario toca Almacén
- **THEN** ve "Almacén · $ 48.835", la yerba primero con ×3 y $ 15.624, cuatro productos más y "+ 8 productos más"

### Requirement: Vista por productos y por súper
La vista Productos SHALL listar los productos del mes de mayor a menor gasto, con cantidad, cadena y total, los primeros 5 con la opción de ver todos. La vista Súper SHALL mostrar cada cadena con su gasto, cantidad de compras y porcentaje del mes. Las líneas con el mismo producto de SEPA SHALL sumarse como un solo producto. Las no vinculadas SHALL sumarse por su descripción.

#### Scenario: La yerba en tres tickets
- **GIVEN** la misma yerba aparece en 3 tickets del mes
- **WHEN** el usuario elige la vista Productos
- **THEN** la yerba aparece una sola vez con ×3 y el total de los tres

### Requirement: Tu inflación
Con al menos 3 productos vinculados comprados en el mes elegido y en el anterior, Mis gastos SHALL mostrar "Tu inflación": cuánto cambió el precio pagado por esos productos, ponderado por lo gastado este mes, y el producto que más subió y el que más bajó. Al lado SHALL mostrar la variación del súper en general que publica Inflación para ese mes. SHALL calcularse solo en el teléfono.

#### Scenario: Tres productos en común
- **GIVEN** en octubre y noviembre el usuario compró yerba, leche y café, y por esos productos pagó 1,8 % más en noviembre
- **WHEN** abre Mis gastos en noviembre
- **THEN** ve "Tu inflación +1,8 %" al lado de la del súper en general, con el producto que más le subió y el que más le bajó

#### Scenario: Primer mes
- **GIVEN** el usuario cargó tickets solo en noviembre
- **WHEN** abre Mis gastos
- **THEN** lee que con tickets de dos meses va a ver su inflación

### Requirement: Tu inflación sin datos suficientes
Con menos de 3 productos vinculados en común entre los dos meses, "Tu inflación" SHALL decir que todavía no alcanza para calcularla, sin mostrar un porcentaje.

#### Scenario: Dos productos en común
- **GIVEN** en octubre y noviembre solo se repiten la yerba y la leche
- **WHEN** el usuario abre Mis gastos en noviembre
- **THEN** lee que todavía no alcanza para calcular su inflación, sin un porcentaje
