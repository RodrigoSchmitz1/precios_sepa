# Design

## Context

`GastosPage.tsx` arma el mes con `resumirMes` (`utils/resumenGastos.ts`): total, variación, por súper, por categoría, ahorro en promos y los gastos del mes. `ElMesEnTuZona` cotiza los productos del mes contra la zona. `TicketGuardado` muestra cada ticket plegado. La maqueta aprobada está en `docs/maquetas/mis-gastos.html`.

## Goals / Non-Goals

**Goals:** que la página se vea como una app de gastos con los datos que ya hay.
**Non-Goals:** datos nuevos, librerías de gráficos, cambios en la API o en lo guardado.

## Decisions

1. **Gráficos en SVG y CSS propios**, sin librería: una dona con `stroke-dasharray` y barras con alturas en porcentaje. Pesan nada y siguen los colores del sitio.
2. **Cálculos puros en `resumenGastos.ts`**: `semanasDelMes(gastos, mes)` (cinco tramos fijos por día del mes), `comprasPorSuper(gastos)` y `gastoPorDia(total, mes, hoy)`. Son testeables sin pantalla.
3. **Colores de cadena por nombre**: un mapa chico para las cadenas grandes (Carrefour, Coto, Día, Jumbo, Disco, Vea, ChangoMás, Toledo, La Anónima, Cooperativa Obrera) y, para el resto, un color de una paleta fija elegido por hash del nombre. Es solo la inicial en un círculo: no usa logos ni marcas.
4. **Dona: las 5 categorías más grandes y "Otras"**, en el orden de `porCategoria`. "Sin detalle" cuenta como cualquier otra categoría.
5. **`ElMesEnTuZona` entra en la tarjeta de ahorro** sin cambiar su lógica: arriba va el ahorro en promos y debajo el componente.
6. **`TicketGuardado` cambia solo su encabezado plegado** (inicial, cadena, productos u origen, total, ahorro). El detalle al abrirlo queda igual.

## Risks / Trade-offs

- [Un mes con un solo ticket deja la dona con una sola porción y las semanas casi vacías] → se muestran igual: es lo que pasó.
- [Los tests buscan textos de la página actual] → se mantienen los textos clave ("Por súper", "Ahorraste … en promos", "En noviembre gastaste") y se ajustan los demás.
