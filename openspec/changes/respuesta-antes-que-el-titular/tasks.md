# Tasks

## 1. Titular compacto

- [x] 1.1 Prop `compacto` en `Titular.tsx` (padding, h1 2xl/3xl, sin bajada). Las demás páginas quedan igual.
- [x] 1.2 En la portada de Mismo producto, compacto con una búsqueda de 2 letras o más o con una lista guardada.
- [x] 1.3 En `VistaProducto`, siempre compacto. El código de barras, la fecha y el aviso de poco respaldo pasan a una línea chica debajo de las tarjetas.

## 2. Titular del producto

- [x] 2.1 `utils/titularProducto.ts` con `titularDelProducto(p, cadenasZona)` y la constante `DIFERENCIA_CASI_IGUAL_PCT = 5`, con todos los casos de la tabla del design y sus tests.
- [x] 2.2 `VistaProducto` usa la función para el titular y para `FilaDeCifras`. Se quita `ResumenDeZona`. Con zona, el rango del país va en una línea debajo de las tarjetas.
- [x] 2.3 Correr los tests del frontend y el build.

## 3. Verificación

- [x] 3.1 Medir en WebKit a 414x896, contra la API local, dónde empieza el primer resultado en la búsqueda, el detalle y Tu lista. Tiene que ser antes de los 320 px.
- [x] 3.2 Detalle de la Playadito de 1 kg con Lomas de Zamora: el titular y las tarjetas sin Vea. Detalle de un producto que no se vende en la zona: dice que no se consigue.
- [x] 3.3 Barrido de las 6 páginas sin desbordes ni errores, sin zona y con zona.
- [x] 3.4 Anotar en `docs/DECISIONES.md` el umbral del 5% y el titular compacto.
