# Design

## Context

Changuito pasó de proyecto de datos a producto, y el foco está en el recorrido del usuario y en que quiera cargar sus tickets. Las maquetas aprobadas están en `docs/maquetas/app-para-el-usuario.html`. El recorrido en producción del 27-11 se hizo con zona Palermo y en un celular de 375 px.

Cómo está hoy cada parte:
- **Navegación.** La barra es `utils/secciones.ts` con `BarraCelular.tsx`. El encabezado tiene el carrito (`AccesoLista.tsx`). Todas las páginas entran en un solo archivo de 670 KB; solo el mapa y Excel se descargan aparte.
- **Portada.** `components/Presentacion.tsx` arma las cifras con `utils/cifrasPortada.ts`:
  - el líder, "Tu súper más barato cerca";
  - "Lo que más subió";
  - "Cuánto ahorrás", con la canasta básica;
  - la tarjeta de tu lista, en `TarjetaTuLista.tsx`.
- **Mi compra.**
  - `pages/ListaPage.tsx` usa `TuLista.tsx` y `DondeComprarLista.tsx`, con la vista de la zona de `utils/listaEnZona.ts`.
  - `ProveedorLista.tsx` carga el ejemplo solo, y "terminarEjemplo" conserva los productos.
  - El total por cadena es la mediana nacional de cada cadena, y las promos son por sucursal.
- **Buscar.** `pages/MismoProductoPage.tsx`:
  - repite `TuLista` debajo de los resultados;
  - el titular toma `destacados.productos[0]`, la mayor diferencia del día, aunque haya una búsqueda.
- **Mis gastos.**
  - `pages/GastosPage.tsx` agrupa por la `categoria` de cada línea, con `resumirMes` de `utils/resumenGastos.ts`.
  - La compra habitual (`utils/compraHabitual.ts`) y `ParaTuProximaCompra` ya existen. Salieron del change `mis-gastos-para-volver`, que está desplegado pero sin archivar.
- **Datos que ya llegan.** Las líneas de un ticket traen `categoria`, `id_producto`, `cantidad` e `importe`. La taxonomía categoría → rubro vive en `orquestacion/scripts/categorizar.py`. Cada producto del índice en memoria de la API ya trae su `rubro`.

## Goals / Non-Goals

**Goals:**
- Una sola cifra por pantalla para la compra, igual en la portada y en Mi compra.
- Mis gastos que se lea de un vistazo (rubros) y que deje bajar al detalle (productos) sin saturar.
- Que cargar tickets dé algo a cambio enseguida:
  - la comparación del ticket;
  - tu inflación;
  - productos vigilados;
  - la compra armada.
- Una primera carga más liviana, sin sacar secciones.
- Costo cero en BigQuery: nada nuevo consulta por pedido.

**Non-Goals:**
- La lectura de fotos de tickets, que sigue apagada con `FOTOS_DE_TICKETS`.
- Las promos bancarias y "con qué tarjeta pagar", que irán en otro change cuando se defina la fuente. El informe de Convi recomienda curar las páginas de cada súper.
- Sorteos, mails, cuentas y notificaciones push.

## Decisions

### 1. La barra queda con un botón central y "Más" en el encabezado
- `BARRA_CELULAR` queda: Promos, Buscar, Ticket (botón), Mi compra y Mis gastos.
- En el celular, `AccesoLista` del encabezado se reemplaza por un botón ☰ que abre la hoja de Más (la misma que hoy abre la barra).
- En la computadora, el menú de secciones no cambia: sigue con el acceso a la lista.
- El botón Ticket lleva a `/gastos?cargar=1`. `GastosPage` lee el parámetro y abre `AnotarMonto` mientras `fotos` sea falso, o `CargarTicket` cuando se prenda.
- Alternativa descartada: dejar "Más" en la barra con seis lugares, porque a 375 px los textos no entran.

### 2. Carga diferida con `React.lazy` en el router
`QuienGanaPage`, `InflacionPage`, `ComoSeCalculaPage` y `PrivacidadPage` pasan a `lazy(() => import(...))`, dentro de un `Suspense` en el `Outlet` del `Layout` con un aviso de carga.

Medida de éxito: el archivo principal baja respecto de los 670 KB. Se anota el antes y el después en `docs/DECISIONES.md`.

No se divide más fino, por ejemplo por componente, porque el resto de las páginas se usa en el recorrido principal.

### 3. Una cifra: la más barata contra la siguiente
La regla vive en un solo lugar, una función en `utils/listaEnZona.ts` que la portada, Mi compra y Buscar comparten:
- La "siguiente opción" es la segunda cadena de la zona con todos los productos.
- Si solo una cadena tiene todo, la cifra muestra el total sin comparar.
- Medir contra la más cara inflaba el ahorro con cadenas que nadie elegiría.
- La regla de "diferencia chica" de `mismo-producto` se sigue aplicando sobre esta nueva diferencia.

### 4. El precio de cada producto en Mi compra sale de lo que ya cotiza la lista
`cotizarLista` ya devuelve el precio de cada producto en cada cadena. `TuLista` muestra el de la cadena ganadora y, si otra cadena de la zona lo tiene más barato, una línea "Más barata en X: $ Y". Las promos por producto siguen saliendo de `promosDeLista`, y no hay pedidos nuevos.

### 5. El ejemplo se pide y se reemplaza
- `ProveedorLista` deja de pedir los básicos al abrir. Expone `verEjemplo()`, que los pide y carga el ejemplo.
- `agregar` con la marca "activo" reemplaza la lista por el producto nuevo. Guarda la lista anterior en memoria para "Deshacer" durante 6 segundos.
- Quitar o cambiar una cantidad mantiene el comportamiento de hoy.
- La marca "hecho" se conserva. Quien ya borró el ejemplo no vuelve a verlo cargado, pero sigue teniendo el botón.

Riesgo: el recorrido de la primera visita pierde la cifra automática de la portada. La tarjeta "Ver un ejemplo" la reemplaza con un toque, como hace Convi.

### 6. El escaneo usa `BarcodeDetector` y, si no está, un reemplazo cargado al tocar
- Chrome en Android tiene `BarcodeDetector`; Safari en iPhone no.
- Al tocar "Escanear" se abre la cámara con `getUserMedia`. Si no existe `BarcodeDetector`, se importa en ese momento el paquete `barcode-detector`, un reemplazo de esa API hecho con zxing-wasm.
- Formatos: EAN-13, EAN-8, UPC-A y UPC-E.
- El código se resuelve con `/api/mismo-producto/{id_producto}`, porque el id es el EAN, y el código con un 0 adelante también se prueba.
- Sin cámara o sin permiso, hay un campo para escribir el código.
- Alternativa descartada: Tesseract o una librería en el archivo principal, por el peso.

### 7. Rubros desde la API, sin otra tabla en el frontend
- `/api/gastos/estado`, que Mis gastos ya pide, suma `rubros: {categoria: nombre_del_rubro}`.
  - Se arma una vez por índice con los pares categoría–rubro del índice de Mismo producto, en memoria.
  - Los nombres van con tilde (`compartir.RUBROS_CON_TILDE`).
  - Así la taxonomía sigue teniendo un solo dueño: `categorizar.py` → datos → API.
- El frontend agrupa con ese mapa: los 7 rubros con más gasto y el resto en "Otros". Los gastos a mano van como "Sin detalle".
- Si el pedido falla, se agrupa por categoría, como hoy, con un aviso chico.
- El mes de ejemplo usa el `rubro` que ya traen los básicos.

### 8. Tu inflación se calcula en el teléfono contra la góndola de las mismas categorías
Para cada `id_producto` comprado en los dos meses:
1. Se toma el precio unitario promedio pagado en cada mes.
2. Se pondera la variación por lo gastado en el mes elegido.
3. Hacen falta 3 productos o más en común.

La comparación es la variación de góndola de `/inflacion/resumen` para las categorías de esos productos, ponderada igual: es más justo que un índice general.

Se pide recién con 3 productos o más en común. Ese endpoint ya existe y está guardado 6 horas en la API, así que no hay consultas nuevas por usuario. No se usa el número del INDEC, porque el sitio no tiene ese dato.

### 9. Productos vigilados = compra habitual + avisos
- `BloqueAvisos` une los avisos pedidos con `compraHabitual(gastos)`, sin repetir.
- Los silenciados se guardan en `changuito.vigilados.silenciados.v1` y no ocupan lugar en el tope de 50.
- La búsqueda de promos es la misma de siempre, `/api/promos/productos`, que sale del índice en memoria.

### 10. "Tu lista esta semana" con un registro en el teléfono
- Se guarda `changuito.lista.semana.v1` con `{semana ISO, huella de la lista, cadena, total}`.
- La primera vez que se abre la app en una semana nueva, si la huella es la misma, la tarjeta muestra la diferencia.
- Nunca se manda nada al servidor.

## Risks / Trade-offs

- **[Sacar las cifras de la portada le quita "datos del día"]** → Siguen en Más barato e Inflación. La portada gana en coherencia, porque no se contradice.
- **[El reemplazo de `BarcodeDetector` pesa]** → Se descarga solo al tocar "Escanear". Se mide su peso y se anota.
- **[Rubros con pocos datos]** → Con un solo ticket, la dona puede tener 2 porciones, y es correcto. "Otros" junta del rubro 8 en adelante.
- **[Tu inflación con pocos productos es ruidosa]** → El mínimo de 3 en común, más el texto que dice sobre cuántos productos se calculó.
- **[`mis-gastos-para-volver` sin archivar]** → Los requisitos nuevos usan su compra habitual. Hay que archivarlo antes de archivar este change, para que las specs principales tengan esa definición.

## Migration Plan

- Sin migración de datos: las claves de la lista, los avisos y los gastos no cambian. Hay claves nuevas para silenciados y para la semana.
- Las direcciones `/quien-gana`, `/inflacion`, `/como-se-calcula` y `/privacidad` siguen iguales.
- Para volver atrás alcanza con revertir el commit y desplegar.

## Open Questions

- ¿El botón Ticket tiene que decir "Cargar gasto" mientras la foto esté apagada? Por defecto queda "Ticket", porque es el gesto que queremos instalar.
- ¿Cuántos segundos de "Deshacer"? Por defecto, 6.
