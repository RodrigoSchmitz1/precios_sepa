# Proposal

## Why

Rodrigo vio Mis gastos con el mes de ejemplo y le falta parecerse a una app profesional de gastos personales: hoy es una tarjeta con el total, dos listas de barras y una lista de tickets plegados. Aprobó la maqueta `docs/maquetas/mis-gastos.html`, con estilo de app de finanzas, y pidió aclarar que el ejemplo sale de 7 tickets por un total dado y que la página va a seguir los tickets que se carguen.

## What Changes

- Meses en pastillas en lugar de flechas.
- Tarjeta principal con degradé: total del mes, variación contra el mes anterior, y compras, gasto por compra y gasto por día.
- Aviso del ejemplo: "Son datos de ejemplo: N tickets por $X armados con precios de hoy. Cuando cargues tus tickets, esta página va a mostrar tus compras."
- "Tu ahorro del mes": lo ahorrado en promos y, debajo, lo que salía en el súper más barato de la zona (lo que hoy es "Tu mes en los súper de tu zona").
- "En qué gastaste": dona por categoría con porcentajes (las 5 primeras y Otras).
- "Semana a semana": barras por semana del mes (1–7, 8–14, 15–21, 22–28 y 29 al fin) con el promedio.
- "Por súper": cada cadena con inicial en color, cantidad de compras, barra y porcentaje.
- Presupuesto en su propia tarjeta (solo con gastos reales).
- "Movimientos": los tickets agrupados por día ("Hoy · 26 nov", "Viernes 20 nov"), con inicial de la cadena, cantidad de productos, origen y ahorro en promos; al abrir uno se ve el detalle como hoy.
- Al final: bajar a Excel, compartir el mes y borrar todo, como hoy.

Fuera de alcance: lectura de fotos (sigue apagada) y datos nuevos.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mis-gastos`: nueva presentación del mes, con los mismos datos.

## Impact

Frontend: `GastosPage.tsx`, `TicketGuardado.tsx`, `utils/resumenGastos.ts` (semanas, compras por súper, gasto por día) y componentes nuevos de gráficos en `components/gastos/`. Sin cambios en la API ni en lo que se guarda.
