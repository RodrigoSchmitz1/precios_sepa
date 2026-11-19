# Proposal

## Why

Tu lista y el titular de un producto comparan el precio de lista de cada cadena: la mediana del país. Las promos de la sucursal se muestran debajo de cada producto, pero no entran en ninguna cuenta. El segundo explore externo, del 18-11, mostró que así la recomendación puede salir al revés:
- En Tres Arroyos, el titular dice que la Playadito de 1 kg conviene en Vea a $ 4.890.
- La Cooperativa Obrera la tiene a $ 5.199 de lista, pero en promo a $ 4.080 en su sucursal de calle Colón, que se ve más abajo en la misma pantalla.

**Medido el 19-11 con los índices en memoria, sin cuota.** Fueron 200 listas de 12 productos tomados al azar entre los 400 más comunes, en 60 zonas. Se usaron solo promos vigentes, sin compra múltiple, y de una sola sucursal por cadena a menos de 3 km de la zona (la que deja la lista más barata).
- **Cuánto cambia:** la cadena más barata cambia en la mitad de las listas (mediana 52,5%, p75 64%). En 45 de las 60 zonas cambia en el 20% de las listas o más, y en barrios porteños como Retiro, Recoleta o Belgrano supera el 70%.
- **Cuánto se ahorra:** cuando cambia, la lista sale un 4% menos de mediana. En Lanús, un 13%.
- **Quién pasa a ganar:** casi siempre Día (4.271 de unas 4.900 veces). Sus promos son precios promocionales de la sucursal ("precio promocional exclusivo Día en sucursales indicadas"), sin club ni tarjeta. Las de "2do al 50%" quedan afuera por ser de compra múltiple, y la marca coincide con el texto de la leyenda.

**Por qué el total principal sigue sin promos.** No todas las cadenas informan promos en SEPA:

| Cadena | Promos por sucursal |
|---|---|
| Día | 960 |
| Carrefour | 956 |
| Cooperativa Obrera | 707 |
| Market | 224 |
| La Anónima | 214 |
| Express | 69 |
| Coto | 33 |
| Maxi | 26 |
| Changomás, SuperChangomás, HiperChangomás, Vea, Disco y Jumbo | 0 |

Meter las promos en el total principal haría ganar a la que más informa, no a la que cobra menos. Es la decisión del 18-11 (DECISIONES, "Las promos de tu lista") y se mantiene. Lo que falta es la otra cuenta, dicha aparte, con las cadenas que no informan rotuladas.

Fue la oportunidad 1 del segundo explore externo.

## What Changes

- **Un segundo total en Tu lista, rotulado aparte.** Con zona, debajo de la comparación de siempre, va "Con las promos de esta semana cerca tuyo".
  - **Cómo se calcula:** para cada cadena cerca, el total en su sucursal a menos de 3 km que deja la lista más barata. Cada producto cuenta al menor entre su precio de lista y la promo vigente en esa sucursal, sin compra múltiple.
  - **Qué dice:** la sucursal, cuántos productos están en promo y hasta cuándo valen (la vigencia más corta de las usadas). Por ejemplo: "En el Día de Cl Thames 2447 te sale $ 31.200, 6 de tus productos en promo, hasta el 23/11".
  - **Si cambia el ganador** respecto del total de lista, se dice: "Con las promos, conviene el Día de …".
  - **Si no cambia nada,** no se agrega ruido.
- **Las cadenas que no informan promos se nombran.** Si alguna cadena cerca informa menos de 50 promos por sucursal en SEPA, la línea lo dice: "Coto, Disco y Jumbo casi no informan promos en SEPA: si tienen, no están en esta cuenta". El umbral sale de lo medido y vive en un solo lugar.
- **El titular del producto avisa si una promo cercana gana.** En el detalle con zona, si una promo vigente cerca deja el producto por debajo del precio más bajo de la zona, debajo del titular va "Con promo: $ 4.080 en la Cooperativa Obrera de Colón 33, hasta el 30/11". El titular de precio de lista no cambia.
- **Sin cambios en los totales de siempre.** El total principal, Más barato y Tu canasta siguen con precios de lista.

Fuera de alcance:
- **Descuentos bancarios o de jubilados:** SEPA no los trae. Decir que los precios no los incluyen queda para otro change.
- **Promos de compra múltiple:** necesitan saber cuántas unidades se compran de verdad.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `promos`: un segundo total de Tu lista con las promos cercanas, por sucursal y rotulado aparte, con las cadenas que no informan promos nombradas; y el aviso bajo el titular del producto cuando una promo cercana gana.

## Impact

- **API:**
  - `api/mapa_promos.py`: el total con promos por sucursal y el índice de promos por sucursal y producto (`promos_de_lista`), y cuántas promos por sucursal informa cada cadena (calculado al cargar el índice).
  - `POST /api/promos/lista`, desde memoria y sin `@cachear`.
  - Tests.
  - Se mide la memoria del índice.
- **Frontend:**
  - un cliente nuevo
  - `utils/promosDeLista.ts` con los textos
  - `TuLista.tsx`: la línea
  - el aviso bajo el titular en `MismoProductoPage.tsx` (con las promos que ya pide `PromosCercaDelProducto`)
  - tests
- **BigQuery:** nada.
- **Docs:** sección en `docs/DECISIONES.md` con lo medido.
