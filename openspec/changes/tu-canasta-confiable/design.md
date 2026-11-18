# Design

## Context

- **El control de cantidad** (`ItemCanastaEditable.tsx`) es un `div` con `flex` y `overflow-hidden` que contiene "−", un `input type=number` de `w-14` y "+". Está dentro de otro `flex` en la segunda fila de la grilla.
  - En el celular, la regla de `index.css` lleva los campos a 16 px.
  - Medido en WebKit a 414 px: la caja queda en 77 px, el contenido pide 106 px y el "+" cae afuera.
  - El `input` de número tiene un ancho mínimo propio y el contenedor se encoge (`flex-shrink`).
- **El paso 4** (`DondeComprarla.tsx`) arranca con `punto = null` y `MapaZona` centra en el Obelisco. React-Leaflet usa `center` solo al montar: cambiarlo después no mueve el mapa.
- **La zona** (`useZona()`) trae `latitud` y `longitud`, el centro del lugar, que ya usan las promos cercanas.
- **El paso 3** (`CanastaPorCadena.tsx`) recibe de `/por-cadena` las listas `categorias_comparadas`, `categorias_afuera` y `total_categorias`. Hoy las nombra solo en el párrafo final, en `text-xs`.

## Goals / Non-Goals

**Goals:**
- Un control de cantidad que entre a 375 px sin perder los 16 px.
- El paso 4 en la zona del usuario, sin un toque extra.
- Que ningún número de la pantalla parezca el costo de la canasta entera sin serlo.

**Non-Goals:**
- Cambiar cómo se calcula el total por cadena o la optimización por sucursal.
- Unificar los dos métodos en uno.

## Decisions

### 1. El control no se encoge y el campo pasa a texto con teclado decimal
- **El control:** el contenedor del control lleva `shrink-0`, y el campo, `min-w-0` con un ancho fijo que entra a 16 px: `w-16` con `px-1`, unos 64 px para "20,86".
  - Si a 375 px la fila no entra, el texto "kg / mes" baja de línea (`flex-wrap`) antes que recortar un botón.
  - Se mide en WebKit a 375 y 414 px antes de cerrar.
- **El campo:** `type="text"` con `inputMode="decimal"`, para que muestre "20,86".
  - **Por qué no `type=number`:** muestra el número como lo formatea el navegador (punto en Safari) y no deja escribir coma en todos los teclados.
  - **Escribir y leer:** `utils/cantidad.ts` tiene `mostrarCantidad(n)`, que da "20,86" con hasta 2 decimales y sin ceros de más, y `leerCantidad(texto)`, que acepta "3,5" y "3.5" y devuelve `null` si no es un número positivo.
  - **Mientras se tipea,** el campo guarda el texto. Recién se aplica al perder el foco o con Enter, para no pelear con lo que la persona está escribiendo.

### 2. El punto inicial es la zona
- **Estado:** `DondeComprarla` guarda `punto` y su origen: `"zona"` o `"usuario"`.
- **Con zona y sin punto elegido por el usuario,** el punto es el centro de la zona.
- **Cuando cambia la zona,** el punto vuelve a ser el de la zona nueva, aunque el usuario hubiera tocado el mapa. Cambiar la zona es decir "ahora compro acá".
- **`MapaZona`:** suma un componente hijo que llama `map.setView(centro)` cuando cambia el punto. React-Leaflet no lo hace solo.
- **El cálculo sale solo.** `/optimizar` responde desde memoria, sin costo, y ya se llama cada vez que cambia el punto.

### 3. El titular del paso 3 dice cuántas categorías compara
- **Con categorías afuera:** el titular empieza "En las N categorías que venden todas, en {barata} te sale unos $ X y en {cara} $ Y: ahorrás…".
- **Con la canasta entera comparable:** dice "Con toda tu canasta, …".
- **La línea de lo que no entra:** debajo, en `text-sm`, nombra hasta 4 categorías de las que quedaron afuera, legibles con `nombreCategoria` y priorizando las frescas (verduras, frutas, pollo, huevos) si están. Si hay más, agrega "y N más". Cierra con "no entran acá porque no las venden todas las cadenas; abajo, en Dónde comprarla cerca tuyo, sí se suman".
- **El texto vive en un util con tests** (`utils/canastaPorCadena.ts`), para no armarlo en el JSX.
- **El párrafo largo de método** queda como está, como explicación para quien quiera más.

## Risks / Trade-offs

- **El titular se alarga** con "En las 25 categorías que venden todas".
  - Mitigación: se mide en el celular. Si pasa de 4 líneas, el número de categorías va en el antetítulo en vez del titular.
- **El paso 4 dispara un pedido al cargar la página con zona.** Es en memoria y sin cuota. Si la canasta está vacía no se llama, como hoy.
- **Una canasta guardada con otras localidades** (spec actual: conserva Córdoba aunque la zona sea Rosario) tendrá el paso 3 en Córdoba y el paso 4 en Rosario.
  - Aceptado: el paso 4 es "cerca tuyo", y tu zona es dónde estás. Se nota en DECISIONES.
