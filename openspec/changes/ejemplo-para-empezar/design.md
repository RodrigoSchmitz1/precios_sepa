# Design

## Context

- Mi compra (`ListaPage.tsx`) guarda la lista en el navegador (`utils/lista.ts`, `ProveedorLista.tsx`, contexto `useLista`). Con la lista vacía muestra el armado rápido (`ArmadoRapido`, que pide `/mismo-producto/basicos`: unos 40 básicos en 6 grupos, resueltos con el buscador en memoria).
- La comparación por cadena (`DondeComprarLista`) y la tarjeta de la portada (`TarjetaTuLista`, dentro de `Presentacion`) ya cotizan la lista con endpoints que responden desde el índice en memoria. No tocan BigQuery por pedido.
- Mis gastos (`GastosPage.tsx`) lee `leerGastos()` de `changuito.gastos.v1` y arma con eso el resumen, `ElMesEnTuZona` (cotiza los productos del mes con `dondeComprarLista`), la compra habitual, el presupuesto, el informe y el Excel.

## Goals / Non-Goals

**Goals:**
- Que la primera visita muestre ahorro con precios reales de la zona sin cargar nada.
- Que el ejemplo se saque entero o por grupo, y que nunca se mezcle con datos reales.

**Non-Goals:**
- Promos bancarias, el guía Changuito y Gemini pago.
- Endpoints nuevos.

## Decisions

1. **El ejemplo de Mi compra es una lista real con una marca.** Se guarda en la misma clave de la lista, más una marca aparte `changuito.lista.ejemplo.v1` con dos estados: `"activo"` (la lista actual es el ejemplo) y `"hecho"` (ya se cargó una vez; no vuelve). Así la comparación, la portada y compartir funcionan sin cambios. El contexto expone `esEjemplo`, `borrarEjemplo()` y `quitarGrupo(grupo)`. `agregar`, `quitar` y `cambiarCantidad` pasan la marca a `"hecho"`, porque tocar la lista la hace propia, y `vaciar` también. `quitarGrupo` no la cambia. Alternativa descartada: una lista de ejemplo aparte, en memoria. Duplicaba cada consumidor de la lista y la portada no la vería.
2. **Se carga en el proveedor al abrir la app.** Si la lista está vacía, no hay marca y no hay una lista por link (`?l=`), el proveedor pide los básicos y guarda los 12 elegidos. Si el pedido falla, no se marca nada y se reintenta en la próxima visita. El grupo de cada producto se guarda en el ítem (`grupo`), un campo opcional que ignoran los consumidores actuales, para que los chips no dependan de volver a pedir los básicos.
3. **Qué 12 básicos.** En cada grupo, los dos básicos que venden más empresas (`empresas` del producto), en `utils/ejemploDeCompra.ts`. Primero probé con una lista fija de nombres (yerba, queso cremoso, huevos, Coca light…), pero varios estaban en 3 a 5 empresas. Así, en Palermo solo Market y Carrefour tenían la compra completa, con $354 de diferencia. Eligiendo por cobertura quedan 8 cadenas completas y la diferencia es de 10%. Si quedan menos de 8 productos, no se carga ejemplo.
4. **El ejemplo de Mis gastos se arma en memoria con los mismos básicos.** `utils/gastosDeEjemplo.ts` arma, con la fecha de hoy, 7 `Gasto` (`origen: "foto"`, porque el ahorro en promos y la comparación solo cuentan tickets de foto; id `ejemplo-N`) con líneas de productos reales (`id_producto`, descripción y un precio entre `precio_mas_bajo` y `precio_mas_alto`, en el 60, 75 y 90% del rango según la cadena: como quien compra sin comparar. Con precios más bajos, el ejemplo decía que el súper más barato salía más caro que los tickets) en 3 cadenas de la zona (las primeras de `zona.cadenas`, o Carrefour, Coto y Día si no hay zona), con dos descuentos de promo. Las cifras salen de precios reales, no de montos inventados. `GastosPage` usa `gastosVisibles = reales.length > 0 || ejemploDescartado ? reales : ejemplo`, y el presupuesto, el Excel, la compra habitual, el informe y la racha siguen leyendo solo los reales. Descartar guarda `changuito.gastos.ejemplo.v1 = "hecho"`, y guardar el primer gasto real también.
5. **Portada.** `TarjetaTuLista` ya cotiza la lista. Con `esEjemplo` cambia el título a "Mirá cuánto ahorrás en tu compra" y agrega "Compra de ejemplo: cambiala por la tuya". El link sigue yendo a `/lista`.
6. **Cartel del ejemplo en Mi compra.** Un componente `EjemploDeCompra` arriba de la lista dice "Lista de ejemplo: así se ve con tu compra", con el botón "Borrar el ejemplo" y un chip `×` por cada grupo presente. Con el ejemplo activo no se abre el armado rápido de arriba, porque la lista no está vacía. Al pie de `DondeComprarLista` va el link "¿Y lo que ya gastaste? Mirá Mis gastos".

## Risks / Trade-offs

- [Alguien con la lista vacía a propósito vuelve y ve el ejemplo] → la marca `"hecho"` evita que el ejemplo vuelva. Quien vació la lista antes de este cambio verá el ejemplo una sola vez.
- [Un usuario que comparte la lista de ejemplo por link] → no pasa nada malo: es una lista válida.
- [El ejemplo de gastos toma precios de lista sin cadena exacta] → el texto aclara que es un ejemplo, y la comparación "en el más barato" usa el mismo endpoint real con esos productos.
- [Los tests que asumen la lista vacía al montar] → el proveedor solo carga el ejemplo si `obtenerBasicos` responde. En los tests se mockea vacío por defecto.
