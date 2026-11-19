# Proposal

## Why

Tu lista es la tarea con más valor del sitio: armar lo que compro siempre y ver dónde me conviene, ahora también con las promos cerca. Pero no se ve como la tarea principal. El segundo explore externo, del 18-11, lo marcó como el problema 2 y como la oportunidad 2:
- **En el celular** se llega solo por un changuito sin texto, arriba a la derecha.
- **La barra de abajo,** el lugar más valioso del celular, tiene Promos, Canasta, Barato, Producto e Inflación. Inflación es la sección más analítica y la que menos busca quien hace la compra. Ya lo había señalado el primer explore.
- **La portada no arranca por tu lista,** aunque la tengas armada.
- **Armar la lista desde cero** obliga a buscar producto por producto.

Rodrigo decidió el 19-11 que "Mi lista" reemplace a Inflación en la barra del celular.

**Lo medido para el armado rápido.** Tomar "el producto más común de cada categoría" de la canasta del INDEC da cosas raras por cómo se clasifican algunas categorías: Harina da una polenta, Azúcar un endulzante, Quesos una crema y Yogur un postre. Los frescos casi no tienen productos comparables. En cambio, el primer resultado del buscador para 40 búsquedas de básicos da productos que se reconocen: Playadito 1 kg, Natura 1,5 L, Ala, Favorita, La Serenísima, Ayudín, Colgate. Casi todos están en 13 o 14 cadenas.

## What Changes

- **"Mi lista" en la barra del celular,** en lugar de Inflación, con el número de productos.
  - Inflación sigue en el menú de la computadora, en "¿Qué querés saber?" de la portada y en su dirección.
  - En la computadora, la barra de arriba no cambia.
- **La portada arranca por tu lista** si tenés productos guardados.
  - Debajo del buscador va una tarjeta: "Tu lista · 8 productos: en Vea te sale $ 41.575". Con zona, entre las cadenas cerca; sin zona, en el país.
  - Lleva a `/lista`.
  - Sin lista, la portada queda como hoy.
- **Armado rápido con productos básicos.** En Tu lista, unos 40 básicos agrupados: almacén, desayuno, lácteos, bebidas, limpieza e higiene.
  - Cada uno se suma con un toque y se puede sacar con otro.
  - Con la lista vacía es lo primero que se ve; con productos, queda plegado como "Sumar básicos".
  - Los productos salen de una lista fija de búsquedas que la API resuelve una vez por día, con el mismo buscador del sitio.

Fuera de alcance:
- Que el sitio diga para quién es, y la portada en general.
- Los frescos.
- Sacar Inflación del sitio.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `tu-lista`: suma tres requisitos: "Mi lista" en la barra del celular, el armado rápido con productos básicos y la lista plegada cuando ya hay productos.
- `portada`: suma un requisito: la portada arranca por tu lista cuando hay productos guardados.

## Impact

- **API:** `GET /api/mismo-producto/basicos`, con la lista fija de búsquedas y su grupo en `api/mismo_producto.py`. Resuelve con `buscar` sobre el índice en memoria y queda cacheado. Tests.
- **Frontend:**
  - `Layout.tsx`: la barra del celular con "Mi lista" y el contador.
  - `Presentacion.tsx`: la tarjeta de tu lista.
  - `ListaPage.tsx` y un componente `ArmadoRapido.tsx`.
  - un cliente nuevo.
  - tests.
- **BigQuery:** nada.
- **Docs:** sección en `docs/DECISIONES.md`.
