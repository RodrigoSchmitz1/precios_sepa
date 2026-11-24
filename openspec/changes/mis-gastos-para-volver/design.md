# Design

## Context

- **Lo que ya hay:** Mis gastos guarda los tickets en localStorage (`utils/gastos.ts`), resume el mes (`utils/resumenGastos.ts`) y compara el mes contra la cadena más barata y mezclando dos (`utils/mesDeGastos.ts`, `ElMesEnTuZona`).
- **Endpoints en memoria que ya se usan:**
  - `/promos/productos`: promos cerca por `id_producto`, lo usan los avisos de oferta;
  - `/mismo-producto/lista/donde-comprar`: opciones con 1, 2 y 3 sucursales.
- **Restricciones:**
  - nada nuevo consulta BigQuery;
  - todo queda en el teléfono;
  - formato es-AR, sin `new Date("AAAA-MM-DD")`.

## Goals / Non-Goals

**Goals:**
- Darle a Mis gastos razones para volver mirando hacia adelante.
- Que todo salga de los tickets que ya cargó el usuario y de endpoints existentes.

**Non-Goals:**
- Subir tickets para estudios.
- La página de privacidad.
- Premios o sorteos.

## Decisions

### 1. La compra habitual sale de los tickets, en el teléfono
`utils/compraHabitual.ts` arma la compra habitual:
- **Qué entra:** los `id_producto` vinculados que aparecen en al menos 2 tickets con foto de los últimos 90 días.
- **Orden y tope:** se ordenan por cantidad de tickets y desempatan por importe; hasta 30, por debajo de los 50 de una lista y de los 100 de `/promos/productos`.
- **Cantidad típica:** la mediana de las cantidades redondeada, mínimo 1.

Los 90 días se cuentan con fechas AAAA-MM-DD comparadas como texto, igual que el resto de Mis gastos. Una sola función alimenta la sección de promos y la de próxima compra, así las dos hablan de los mismos productos.

### 2. Promos y próxima compra reutilizan lo que ya existe
- **Promos:** `obtenerPromosDeProductos(ids, zona)`, la misma búsqueda que el bloque de avisos, mostrando la promo más barata de cada producto con `PromoCercana`.
- **Próxima compra:** `dondeComprarLista(items, zona, RADIO_CERCA_KM)` con las opciones de 1 y 2 sucursales y la misma regla que el resumen del mes: mezclar solo si son dos cadenas distintas, cubren los mismos productos y baja el total. La regla se saca a una función compartida con `mesDeGastos.ts` para que no haya dos versiones.
- **Pedidos:** ambos se piden recién cuando la sección se ve, y solo si cambia la firma (productos y zona).

### 3. Presupuesto en localStorage
- **Dónde:** `utils/presupuesto.ts` guarda `changuito.presupuesto.v1` con `{monto}`.
- **Avisos:** `AVISO_PRESUPUESTO = 0.8` vive en un solo lugar.
- **Carga:** con el mismo campo de pesos que "Anotar un monto" (`leerMonto`), que acepta "300.000" o "300000".
- **Fallas:** si no se puede guardar, se dice y vale para esa visita.

### 4. Informe del mes y racha
- **Texto para compartir:** sale de `resumirMes`, el mismo que muestra la pantalla, así que no hay dos números distintos. Usa `BotonCompartir`. No nombra súper ni sucursales: el resumen de alguien no tiene por qué decir dónde compra.
- **Racha:** cuenta semanas ISO (lunes a domingo) seguidas con al menos un gasto, terminando en la semana actual o en la anterior. Si terminara solo en la actual, se cortaría todos los lunes hasta que el usuario cargue algo.

### 5. El aviso de la foto
El texto suma que la foto la lee Google Gemini en servidores de Estados Unidos y que no se guarda, y el botón pasa a "Acepto y saco la foto". Es el consentimiento expreso para la transferencia internacional (art. 12) que pidió el informe legal. La clave de aceptación no cambia: quien ya aceptó el texto anterior no lo vuelve a ver. Mientras la lectura de fotos esté apagada en producción, nadie lo ve.

## Risks / Trade-offs

- **[Compra habitual con pocos tickets]** → Con menos de 3 productos repetidos no se muestra nada: mejor eso que una "compra habitual" de un solo ticket.
- **[Dos pedidos más al abrir Mis gastos]** → Son dos pedidos a endpoints en memoria, solo con zona y compra habitual, y cada uno se repite solo si cambian los productos o la zona.
- **[Quien aceptó el aviso viejo no ve el texto nuevo]** → Hoy nadie aceptó en producción porque las fotos están apagadas, así que no hace falta cambiar la clave.

## Migration Plan

Deploy normal. Sin datos que migrar.
