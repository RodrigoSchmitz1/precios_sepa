# Proposal

## Why

Changuito dejó de ser un proyecto de datos y pasó a ser un emprendimiento. El objetivo ya no es mostrar información sino que la persona tenga un buen recorrido y quiera cargar sus tickets: sin tickets, los datos casi no sirven para Changuito Empresas.

El recorrido en producción del 27-11 encontró varias fallas:
- **Mi compra muestra cinco totales distintos** para la misma lista, y ninguno de sus productos tiene precio.
- **La portada se contradice.** Dice que la compra sale más barata en Día y, justo abajo, que "Tu súper más barato cerca" es Market.
- **Buscar repite la lista entera** debajo de los resultados.
- **En Mis gastos, "Otras" se lleva el 50 %**, porque las categorías de SEPA son muy finas.
- **Nada recompensa cargar un ticket.**

## What Changes

- **Barra del celular nueva**:
  - Pestañas: Promos, Buscar, un botón central 📷 Ticket, Mi compra y Mis gastos.
  - "Más" pasa arriba a la derecha (☰), en el lugar del carrito, que repetía Mi compra.
  - Más barato e Inflación quedan dentro de Más y se descargan recién cuando se abren.
  - En Más barato sale el cuadro de categorías por cadena.
- **Portada**:
  - Una sola tarjeta de tu compra, con la misma cifra que Mi compra, comparada con la siguiente opción y no con la más cara.
  - Sale "Tu súper más barato cerca".
  - Sale "Lo que más subió": queda solo en Inflación.
  - Al volver cada semana, la tarjeta dice cuánto sale tu lista hoy y cuánto cambió.
- **Mi compra**:
  - Una cifra arriba, con el precio de cada producto en esa cadena.
  - Las otras cadenas, la compra en 2 súper y el total con promos quedan plegados.
  - La lista de ejemplo deja de cargarse sola: aparece al tocar "Ver un ejemplo".
  - Si se está viendo el ejemplo, el primer producto propio lo reemplaza.
  - Se puede sumar un producto escaneando su código de barras.
  - Sin parpadeo de "Elegí tu zona" cuando ya hay una zona guardada.
- **Buscar**:
  - Deja de repetir la lista: solo marca "✓ En la lista" y da un acceso a Mi compra.
  - El titular de la diferencia sale de los resultados que se ven.
- **Mis gastos**:
  - Los gastos se agrupan en rubros (a lo sumo 7 más "Otros"), en lugar de las categorías de SEPA.
  - Tocar un rubro muestra sus productos con cantidad y total.
  - Un selector cambia la vista entre Rubros, Productos y Súper.
  - Nueva tarjeta "Tu inflación", con tus mismos productos mes contra mes.
  - Cada ticket dice cuánto salía en la cadena más barata de tu zona.
  - Semana a semana, el presupuesto y las acciones quedan plegados.
- **Recompensa por cargar tickets, sin sorteos ni pago**:
  - Los productos que se repiten en tus tickets quedan vigilados solos, con aviso cuando entran en promo cerca.
  - Mi compra se puede armar con lo que comprás de verdad.

## Capabilities

### New Capabilities
- `navegacion`: la barra del celular, el menú Más y la descarga diferida de las secciones que no están en la barra.

### Modified Capabilities
- `portada`:
  - la tarjeta de tu compra reemplaza a la del súper más barato y al ahorro de la canasta;
  - la diferencia se mide contra la siguiente opción;
  - se suma el resumen semanal de tu lista.
- `tu-lista`:
  - el acceso a la lista pasa a la barra;
  - Mi compra muestra una cifra y el precio de cada producto;
  - el ejemplo se pide con un botón y se reemplaza con el primer producto propio;
  - se suma el escaneo de códigos de barras y armar la lista desde tus tickets;
  - sale el requisito de la barra, que pasa a `navegacion`.
- `mis-gastos`: rubros en lugar de categorías, productos por rubro, selector de vista, tu inflación y la comparación en cada ticket.
- `mismo-producto`: los resultados no repiten la lista, y el titular sale de los resultados que se ven.
- `mas-barato`: sale el cuadro de categorías por cadena.
- `avisos-de-oferta`: avisos automáticos para los productos que se repiten en tus tickets.

## Impact

- **Frontend, en `frontend/src`**:
  - archivos: `utils/secciones.ts`, `components/Layout.tsx` y la barra, `router.tsx` (con `React.lazy`), `components/Presentacion.tsx`, `components/TarjetaTuLista.tsx`, `components/ProveedorLista.tsx`, `pages/ListaPage.tsx`, `pages/MismoProductoPage.tsx`, `pages/QuienGanaPage.tsx`, `pages/GastosPage.tsx`, `components/gastos/*` y `utils/resumenGastos.ts`;
  - utilidades nuevas para rubros, inflación personal, productos vigilados y escaneo.
- **API**: no hay endpoints nuevos.
  - El código de barras se resuelve con `/api/mismo-producto/{id_producto}`.
  - El rubro de cada producto ya viene en los datos que sirve la API.
  - El costo de BigQuery sigue en cero.
- **Dependencias**: un lector de códigos de barras para Safari, que no tiene `BarcodeDetector`. Se descarga solo al tocar "Escanear".
- **Fuera de alcance**:
  - la lectura de fotos de tickets, que sigue apagada;
  - las promos bancarias y "con qué tarjeta pagar", que irán en otro change cuando se defina la fuente;
  - sorteos;
  - mails o cuentas.
