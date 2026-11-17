# Proposal

## Why

Es el tercer candidato del explore externo del 2026-11-17: "la respuesta antes
que el hero". En Mismo producto la persona viene a buscar algo puntual, pero en
el celular lo primero que ve es un titular a sangre que ocupa media pantalla.
Medido en producción en WebKit a 414x896:

- **Búsqueda:** el primer resultado aparece a 561 px. Con el teclado de iOS
  abierto quedan unos 500 px visibles, así que el usuario toca "Buscar" y
  parece que no pasó nada.
- **Detalle y Tu lista:** el recuadro "En tu zona" del detalle empieza a
  567 px, igual que Tu lista.
- **Con zona, la pantalla se contradice.** Con "Lomas de Zamora" elegida y la
  Playadito de 1 kg, el titular dice "7% más caro en Coto y 2 más que en Vea".
  Vea no tiene sucursales en Lomas, y las tarjetas de abajo ("Más barato",
  "Más caro") también son nacionales. Más abajo, el recuadro verde nombra otra
  cadena como la más barata de la zona. ¿A cuál le cree el usuario?
- **El titular dramatiza las diferencias chicas.** Un 3% en rosa grande, cuando
  lo útil sería decir que da casi lo mismo dónde comprarla y cuántos pesos son.

## What Changes

- **Titular compacto cuando hay algo que mostrar.** Con una búsqueda en curso
  (2 letras o más), un producto elegido o una lista guardada, el titular de
  Mismo producto se achica: se va la bajada, la letra baja y el margen se
  reduce. Así el resultado entra en la primera pantalla.
- **Con zona, el titular del producto es el de la zona.** Nombra la más barata
  y la más cara de las cadenas de la zona. Las tarjetas (más barato, más caro,
  diferencia, cadenas) también pasan a ser de la zona. El recuadro verde
  aparte desaparece, porque su contenido ahora está en el titular.
- **Lo nacional queda, pero abajo.** Debajo de las tarjetas, una línea dice el
  rango del país, y la lista "Otras cadenas del país" sigue igual. La tira de
  precios también pasa a ser de la zona.
- **Las diferencias chicas se dicen como chicas.** Si la más cara cobra menos
  de un 5% más que la más barata, el titular dice que cuesta casi lo mismo y
  cuántos pesos de diferencia hay, en lugar de destacar el porcentaje. Vale con
  zona y sin zona.
- **Queda fuera la portada con zona** ("tu súper más barato cerca" en lugar de
  "Maxi en el país"). Es la otra mitad del candidato y va en un change propio,
  porque toca las tarjetas de la portada y sus datos.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mismo-producto`:
  - suma el titular compacto, el titular de zona y la diferencia chica;
  - modifica "La más barata de tu zona", que pasa del recuadro al titular.

## Impact

- **`frontend/src/components/Titular.tsx`:** nueva variante `compacto`. Las
  otras 6 páginas que lo usan no cambian.
- **`frontend/src/pages/MismoProductoPage.tsx`:** la portada de la sección, el
  detalle (`VistaProducto`) y `ResumenDeZona`, que se va.
- **`frontend/src/utils/`:** una función pura nueva que arma el titular del
  producto (zona o país, diferencia chica, casos sin cadena), con sus tests.
- **API y BigQuery:** sin cambios. Todo sale de lo que ya trae el detalle del
  producto.
