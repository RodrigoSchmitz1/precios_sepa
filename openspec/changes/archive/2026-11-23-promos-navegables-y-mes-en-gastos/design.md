# Design

## Context

- **La portada es Promos** (`frontend/src/pages/PromosPage.tsx`). Arriba está `Presentacion`, y debajo se monta siempre `MapaPromos` (Leaflet). Cada paneo pide `/promos/mapa` con el recuadro visible y hasta 5.000 promos. La lista, las cifras y `FiltroCategorias` (rubro → categoría) se calculan en el navegador con esa respuesta.
- **Las promos viven en memoria** (`api/mapa_promos.py`):
  - `IndiceMapa` tiene columnas paralelas ordenadas por descuento, la sucursal de cada promo, `es_farmacia`, `multiple` (compra múltiple), `vigente_hasta`, `por_producto` y `promos_por_sucursal`.
  - `promos_de_productos` ya resuelve "las promos de estos productos cerca de esta zona" para Tu lista y el detalle, con `RADIO_CERCA_KM = 3`, `PROMOS_POR_PRODUCTO = 3` y `MAXIMO_PRODUCTOS = 100`.
  - `poco_informan` y `POCAS_PROMOS_POR_SUCURSAL = 50` nombran a las cadenas que casi no informan promos.
  - `_fila` no manda `id_producto`.
- **Mis gastos** (`GastosPage.tsx`, `utils/comparacionTicket.ts`, `utils/resumenGastos.ts`) guarda los gastos en localStorage y compara cada ticket con `cotizarLista`.
- **Mi compra** usa `/mismo-producto/lista/donde-comprar`, que devuelve las opciones con 1, 2 y 3 sucursales cerca, cada una con su total, `productos_cubiertos` y los productos que van a cada sucursal (tope de 50 productos). Sale de memoria.

## Goals / Non-Goals

**Goals:**
- Que Promos se recorra: vidriera, categorías, súper y avisos, y que tenga motivos para volver.
- Que el mapa deje de costar en la primera pantalla del celular.
- Que el mes de Mis gastos responda "dónde me salía más barato" y "cuánto ahorraba mezclando dos".
- Costo cero: nada nuevo consulta BigQuery.

**Non-Goals:**
- Eventos anónimos o señales para Changuito Empresas. Se diseñan aparte y sin cambiar estas pantallas: el botón Avisame y las páginas de categoría ya son los puntos donde se medirá.
- Notificaciones push, service worker y cuentas.
- Cambiar los totales de Mi compra o la comparación por ticket.

## Decisions

### 1. La vidriera la arma la API, en un endpoint nuevo
`GET /promos/vidriera?latitud&longitud` (coordenadas opcionales) responde:
- `fuertes`: hasta 8 promos;
- `categorias`: por rubro, la cantidad de promos y las 4 mejores, de más a menos promos;
- `cadenas`: por cadena cerca, la cantidad y las 4 mejores;
- `poco_informan`;
- la tabla de sucursales, como `/promos/mapa`.

Se calcula sobre el índice en memoria, con las sucursales a menos de `RADIO_CERCA_KM` de la zona, o todas si no hay zona.

**Alternativa descartada:** armarla en el navegador con `/promos/mapa`. Obliga a bajar hasta 5.000 promos, unos 400 KB, para mostrar unas 40. Es justo lo que este change le quiere ahorrar al celular.

**Sin `@cachear`:** cada zona es una combinación distinta, como en `/promos/mapa`. Sin zona, el resultado es uno solo y se puede guardar con el índice.

### 2. Qué es una promo fuerte, en un solo lugar
Las reglas viven en constantes de `mapa_promos.py` y los tests las leen:
- vigente;
- `multiple == 0`;
- con evidencia: nivel `leyenda` o `mercado`, nunca `sin_verificar` (las inverosímiles ya no llegan al índice);
- con zona, primero las que están en 2 o más sucursales cerca, y solo si no alcanzan, las de una;
- orden por descuento;
- un producto una sola vez;
- a lo sumo `MAXIMO_POR_CADENA_FUERTES = 3`.

Las mejores de cada fila usan el mismo orden de la página: más sucursales primero y el descuento como desempate. Las farmacias se excluyen de las filas por cadena, igual que en "cadenas cerca".

### 3. La página de categoría usa `/promos/mapa` con un filtro de rubro
- **Ruta:** `/promos/:rubro` (slug del rubro).
- **Pedido:** `/promos/mapa` gana los parámetros `rubro`, `latitud` y `longitud`, que `buscar` aplica en memoria. Así la respuesta trae solo ese rubro y no 5.000 promos de todo.
- **Cuenta igual que la vidriera:** con zona, las sucursales a menos de `RADIO_CERCA_KM` (un círculo, no un recuadro) y solo promos vigentes. Con un recuadro y sin sacar las vencidas, la fila decía "Limpieza · 185" y la página mostraba 203 (medido en Palermo el 23-11).
- **Filtros:** las subcategorías salen de `FiltroCategorias` restringido al rubro.
- **Reuso:** la lista, el orden, las tandas y el bloque de evidencia salen de `PromosPage` a un componente compartido (`ListadoPromos`), así la vista del mapa y la de categoría muestran lo mismo.

### 4. El mapa a pedido
- La vista del mapa queda en un componente propio, cargado con `React.lazy` (46 KB aparte). Leaflet en sí sigue en el paquete principal, porque lo usan el mapa de la zona y Mi compra; lo que se ahorra la portada es montar el mapa y pedir las 5.000 promos.
- Se abre con el parámetro `?mapa=1`, que el botón pone y el link conserva para compartirlo.
- Al abrirla, se comporta como la página de hoy.

### 5. Avisos en localStorage, buscados con `/promos/productos`
- **Guardado:** `utils/avisos.ts` guarda `changuito.avisos` como `[{id_producto, descripcion, desde}]`, con tope `MAXIMO_AVISOS = 50` (por debajo de `MAXIMO_PRODUCTOS = 100` de la API).
- **Fallas de guardado:** todo acceso va en try/catch, como en `utils/gastos.ts`. Si falla, el botón dice que el navegador no deja guardar.
- **Búsqueda:** la vidriera llama a `obtenerPromosDeProductos(ids, zona)`, la misma búsqueda del detalle, y muestra la promo más barata de cada aviso. A diferencia del detalle, no la filtra contra el precio más bajo de la zona: quien pidió el aviso quiere saber que está en promo.
- **Para Empresas, después:** el botón queda en un componente `BotonAvisame`, el único lugar a instrumentar cuando se enciendan las señales.
- **`id_producto` en las filas de promo:** `_fila` lo suma, porque PromoCard lo necesita para el botón.

### 6. El mes contra 1 y 2 cadenas con `donde-comprar`
- **Productos del mes:** `utils/mesDeGastos.ts` junta los productos vinculados de los tickets del mes, sin los gastos a mano. Suma cantidades e importes por `id_producto`, ordena por importe y toma hasta 50, el tope de la lista.
- **Pedido:** llama a `dondeComprarLista` con la zona y `RADIO_CERCA_KM`.
- **Cuentas:**
  - La opción de 1 sucursal da "la más barata". Si no cubre todos los productos, la cuenta va sobre los que cubre y se dice "N de tus M productos".
  - La de 2 da "mezclando dos", y se muestra solo si baja el total y usa de verdad dos cadenas distintas.
  - Cada comparación es contra lo que figura en los tickets para los productos que esa opción cubre, antes de descuentos.
- **Cuándo no se compara:** si lo cubierto queda por debajo del mínimo de cobertura del importe del mes (`leerCoberturaMinima`, el mismo de cada ticket).
- **Pagado:** la línea antes de descuentos, igual que `comparacionTicket.ts`, porque comparar lo pagado con promos contra precios de lista haría parecer cara una compra con descuento.

## Risks / Trade-offs

- **[Rubros con nombres largos o muchos rubros]** La vidriera muestra los 6 rubros con más promos y un "Ver todas las categorías" con el resto. → Se revisa a 375 px antes de cerrar.
- **[Sin zona, la vidriera nacional mezcla regiones]** Una promo de La Anónima puede no servirle a alguien de CABA. → Se dice "en todo el país" y se invita a elegir la zona arriba.
- **[Los avisos pueden no tener promos por semanas]** → El bloque se reduce a una línea, para no gastar pantalla en un "no hay nada".
- **[Mes con muchos productos]** Al cortar en 50 productos quedan afuera los de menor importe. → Se dice cuántos quedaron afuera y la cobertura se mide igual.
- **[Lo que mide el mes]** Precio por cadena para todo el país contra lo que figura en el ticket de una sucursal: es honesto, pero no es "lo que te cobraban en esa sucursal". → Se aclara "a precio de lista y sin promos", como en cada ticket.
- **[Memoria de Cloud Run]** El endpoint de vidriera recorre las promos de las sucursales cerca, sin copiar el índice. → Se mide el tiempo con Palermo, la zona con más promos, y se anota en docs/DECISIONES.md.

## Migration Plan

Es un deploy normal, sin datos que migrar. Los links viejos a `/` siguen abriendo Promos, ahora como vidriera. Se agrega la tarjeta de compartir para `/promos/:rubro`. Para volver atrás, se revierte el commit: los avisos guardados quedan en el teléfono sin efecto.

## Open Questions

- Resuelta: los rubros reales sirven como título de fila con `nombreRubro` ("Almacén", "No alimentario", "Infusiones y azúcares"). En Palermo el primero es "No alimentario" (1.456 promos).
