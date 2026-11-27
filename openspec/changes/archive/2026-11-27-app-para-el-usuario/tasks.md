# Tasks

## 0. Antes de empezar

- [x] 0.1 Archivar `mis-gastos-para-volver` (ya desplegado), así su compra habitual queda en la spec principal de `mis-gastos`. Verificar con `openspec validate --all --strict`. El commit del archivo lo aprueba Rodrigo.
- [x] 0.2 Medir el tamaño actual del archivo principal (`npm run build`, sin comprimir y con gzip) para comparar después.

## 1. Navegación

- [x] 1.1 Cambiar `BARRA_CELULAR` en `utils/secciones.ts` (Promos, Buscar, Ticket, Mi compra, Mis gastos) y dibujar en `BarraCelular.tsx` el botón central destacado. Verificar con `BarraCelular.test.tsx` actualizado: orden, cantidad en Mi compra y que el botón lleva a `/gastos?cargar=1`.
- [x] 1.2 En el encabezado del celular, reemplazar `AccesoLista` por el botón ☰ que abre la hoja de Más (Más barato, Inflación, Cómo se calcula, Privacidad), sin tocar el menú de la computadora. Verificar con un test de la hoja y a 375 px.
- [x] 1.3 Pasar `QuienGanaPage`, `InflacionPage`, `ComoSeCalculaPage` y `PrivacidadPage` a `React.lazy`, con un `Suspense` en el `Layout`. Verificar con el build que hay archivos aparte y que el principal baja; anotar el antes y el después.
- [x] 1.4 Sacar `MapaDelMercado` de Más barato. Verificar que la página sigue mostrando el líder y los ganadores (tests de `QuienGanaPage`, si los hay, o un test nuevo).

## 2. La cifra de tu compra (portada, Mi compra y Buscar)

- [x] 2.1 Escribir en `utils/listaEnZona.ts` la regla "la más barata contra la siguiente" (con una sola cadena completa no compara) y sus tests. Usarla en `TarjetaTuLista`, Mi compra y el titular de Tu lista.
- [x] 2.2 Portada:
  - sacar las cifras del líder, "Lo que más subió" y "Cuánto ahorrás" de `cifrasPortada.ts`, y dejar las de zona con una sola cadena;
  - la tarjeta de tu compra sin lista invita con "Ver un ejemplo".

  Verificar con tests de `cifrasPortada`, `TarjetaTuLista.test.tsx` y a 375 px, con las promos del día dentro de la primera pantalla.
- [x] 2.3 Escribir "Tu lista esta semana" (`changuito.lista.semana.v1`: semana, huella, cadena y total) en una utilidad con tests: misma huella compara, lista cambiada no compara, primera semana sin dato. Mostrarlo en `TarjetaTuLista`.

## 3. Mi compra

- [x] 3.1 Rehacer la parte de arriba de `ListaPage`:
  - una cifra en tarjeta principal;
  - en `TuLista`, el precio de cada producto en la cadena ganadora y la línea "Más barata en X";
  - las otras cadenas, la compra en 2 o 3 súper y el total con promos dentro de `details` plegados.

  Verificar con `MiCompra.test.tsx` actualizado y a 375 px.
- [x] 3.2 Cambiar el ejemplo en `ProveedorLista`:
  - no se carga solo; `verEjemplo()` con su error;
  - sumar con el ejemplo lo reemplaza y ofrece "Deshacer" durante 6 segundos;
  - quitar o cambiar una cantidad lo vuelve propio.

  Verificar con `EjemploDeCompra.test.tsx` y con los casos de la spec (Sumar un producto, Deshacer, Cambiar una cantidad, No vuelve si se borró).
- [x] 3.3 Sumar el botón "Armarla con lo que comprás", con `compraHabitual` y sin repetir productos. Verificar con un test: hay compra habitual y se suman las cantidades; sin compra habitual no aparece.
- [x] 3.4 Arreglar el parpadeo de "Elegí tu zona": con zona guardada, mostrar un aviso de carga hasta tener la zona. Verificar con un test que nunca se renderiza el pedido de zona si hay una guardada.

## 4. Buscar y escanear

- [x] 4.1 En `MismoProductoPage`:
  - sacar `TuLista` de debajo de los resultados;
  - sumar "✓ En la lista" (ya existe) y el acceso "Ver mi compra (N)";
  - el titular de una búsqueda toma la mayor diferencia de los resultados que se ven.

  Verificar con tests (el caso de yerba Playadito de la spec) y que el primer resultado sigue antes de los 320 px a 414 px.
- [x] 4.2 Escribir el escáner: un componente que se carga al tocar "Escanear", con `BarcodeDetector` o el paquete `barcode-detector` importado en ese momento.
  - Formatos: EAN-13, EAN-8, UPC-A y UPC-E.
  - Si la cámara falla o no hay permiso, se puede escribir el código a mano.
  - Para resolver el código se prueba también con un 0 adelante.

  Ponerlo en Mi compra y en Buscar. Verificar con tests de la resolución (conocido, desconocido, con 0 adelante, sin permiso), y a mano en Chrome de Android y en Safari del iPhone si se puede, si no en WebKit con una imagen de prueba.

## 5. Mis gastos

- [x] 5.1 API: sumar `rubros` (categoría → nombre con tilde) a `/api/gastos/estado`, armado una vez por índice desde el índice de Mismo producto, sin BigQuery. Verificar con un test en `api/` que el mapa cubre las categorías del índice y que no consulta BigQuery.
- [x] 5.2 Frontend: agrupar por rubro en `resumenGastos.ts` (7 más "Otros", "Sin detalle" para gastos a mano, por categoría si el mapa falla), y los productos por rubro y del mes (sumados por `id_producto` o por descripción). Verificar con tests, entre ellos que en el mes de ejemplo "Otros" no es la porción más grande.
- [x] 5.3 Dibujar "En qué gastaste" con el selector Rubros · Productos · Súper, el rubro que se toca con sus 5 primeros productos y "+ N productos más", siguiendo la maqueta. Verificar con tests de `GastosPage` y a 375 px.
- [x] 5.4 Escribir `utils/tuInflacion.ts`: precio unitario promedio por producto en cada mes, ponderado por el gasto del mes elegido, con un mínimo de 3 en común, el que más subió y el que más bajó, y la góndola ponderada de `/inflacion/resumen` pedida solo si hay 3 en común. Verificar con tests (3 en común, 2 en común, primer mes). Mostrar la tarjeta.
- [x] 5.5 En los movimientos, mostrar "en X: −$ Y" cuando la comparación con la más barata de la zona se puede mostrar. Plegar al final "Semana a semana" (con el gasto por día), el presupuesto y las acciones. Verificar con tests y a 375 px.
- [x] 5.6 Hacer que `/gastos?cargar=1` abra la carga del monto a mano (o la de la foto, cuando esté prendida). Verificar con un test.

## 6. Productos vigilados

- [x] 6.1 Unir en `BloqueAvisos` los avisos pedidos con la compra habitual, sin repetir, marcando "lo comprás seguido", con un silenciar que se guarda en `changuito.vigilados.silenciados.v1` y no cuenta en el tope de 50. Verificar con tests (la yerba de la compra habitual en promo, silenciar, sin compra habitual).

## 7. Cierre

- [x] 7.1 Correr `npx tsc -b`, `npx eslint src`, `npx vitest run` y `npm run build` en `frontend/`, y los tests de la API.
- [x] 7.2 Recorrer en WebKit a 414 px y en el panel a 375 px: portada, Mi compra (vacía, ejemplo, propia), Buscar, escáner, Mis gastos (ejemplo y real) y la hoja de Más. Que no haya desbordes ni errores en la consola, y que las promos del día estén en la primera pantalla.
- [x] 7.3 Anotar en `docs/DECISIONES.md`: la siguiente opción en lugar de la más cara, el ejemplo a pedido, los rubros desde la API, tu inflación contra la góndola y no contra el INDEC, la carga diferida con el antes y el después, y por qué no hay sorteos.
