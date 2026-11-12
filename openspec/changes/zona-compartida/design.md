# Design

## Context

Ver proposal.md (Why). Estado actual relevante:

- Cada página guarda su propia noción de lugar en estado local: Promos
  (`bbox`, `provincia`, `destino` del mapa), Tu canasta (`localidadesElegidas`,
  persistidas con la canasta en localStorage y en el link `?c=`), "Dónde
  comprarla" (punto y radio). Más barato, Mismo producto e Inflación no tienen.
- La API ya tiene en memoria, sin cuota: el índice del mapa (todas las
  sucursales con coordenadas y cadena, de `mart_mapa_sucursales`), los lugares
  que de ahí arma `mapa_promos.lugares` (560 barrios y localidades con centro y
  cantidad de sucursales, servidos en `/promos/lugares`), y el índice de Mismo
  producto (precio de cada producto en cada cadena, con `precio_creible`).
- Los nombres de cadena son los mismos (`nombre_comercial`) en las tres fuentes.

## Goals / Non-Goals

**Goals:**
- Un único estado de zona en el frontend que todas las páginas leen.
- Que la zona se pueda verificar de punta a punta: el recorrido inicio →
  búsqueda → Mismo producto, con la zona aplicada, se prueba en WebKit a 414 px.
- Cero consultas nuevas a BigQuery y cero cambios en dbt.

**Non-Goals:**
- Precio por sucursal de un producto exacto (el dato no existe en los marts).
- Cuentas de usuario: la zona vive en el navegador y en el link.
- Rediseñar las páginas: se cambia lo necesario para usar la zona.

## Decisions

### 1. La zona es un estado compartido, persistido en el navegador y reflejado en la URL

Un proveedor de contexto de React en el `Layout` guarda la zona (`nombre`,
`provincia`, `latitud`, `longitud`, `cadenas`) y la expone a todas las páginas.
Se guarda en localStorage (con try/catch: en modo privado puede fallar y el
sitio sigue andando con el estado en memoria) y se refleja en la URL como
`?zona=<provincia>:<nombre>` con `history.replaceState`, conservando los demás
parámetros (`?q=` de Mismo producto, `?c=` de Tu canasta). Así cualquier link
copiado, desde la barra o desde un botón de compartir, lleva la zona.

Al cargar: la URL gana sobre localStorage, como ya pasa con la canasta. Una
zona de la URL que no está en la lista de lugares se descarta con aviso.

Alternativas: (a) solo URL, propagando `?zona=` en cada `<Link>`: obliga a
tocar todos los links y es fácil olvidarse de uno, que es justo el bug actual.
(b) solo localStorage: no viaja en los links compartidos.

### 2. Lugares y cadenas salen de un endpoint nuevo `/zonas`

`mapa_promos.lugares` suma a cada lugar la lista de cadenas con sucursal en él
(el mismo agrupamiento por nombre normalizado y provincia que ya usa). Un
endpoint `/zonas` devuelve esa lista; `/promos/lugares` sigue igual para no
cambiar a Promos. El frontend la pide una vez y la guarda en memoria (decenas
de KB). Elegir zona, buscarla y resolver la ubicación se hace contra esa lista,
sin pedidos por letra.

Alternativa: un endpoint por zona (`/zonas/{provincia}/{nombre}`). Descartada:
el buscador necesita la lista entera igual, y una ida y vuelta por zona es
peor en el celular.

### 3. "Cadenas de tu zona" = cadenas con sucursal en ese barrio o localidad

Sin radio en kilómetros: el lugar ya es la unidad que el usuario eligió y la
que el sitio usa en Tu canasta. Un radio obligaría a elegir un número que en
CABA es un barrio y en la Patagonia es otra ciudad.

### 4. "Usar mi ubicación" elige el lugar más cercano, en el navegador

Con la ubicación del teléfono se toma el lugar de la lista cuyo centro está más
cerca (distancia sobre la esfera). No se manda la ubicación a la API.

### 5. Mismo producto separa por zona en el frontend

El detalle de un producto ya trae el precio de cada cadena; con la zona se
parte en "en tu zona" y "el resto" y se calcula la más barata de la zona. No
hace falta la API. La aclaración "precio de la cadena en todo el país" queda
fija en la pantalla, con o sin zona.

### 6. Más barato en la zona se calcula en la API, producto por producto

Filtrar en el frontend las filas de `mart_quien_gana` a las cadenas de la zona
daría un número engañoso: cada porcentaje se calculó compitiendo contra todas
las cadenas del país, así que una cadena de la zona "pierde" contra Maxi aunque
Maxi no esté. La API recalcula, desde el índice de Mismo producto que ya está en
memoria, quién tiene el precio más bajo en cada producto contando solo las
cadenas de la zona (las que no tienen precios ese día se ignoran: el 2026-11-11
faltaron Vea, Disco y Jumbo; si no queda ninguna con precios, 422), con las reglas de `mart_quien_gana`: productos que venden
al menos 2 de esas cadenas, cadenas con al menos 20 productos ofrecidos en la
categoría, y empates para todas. El mart no filtra por precio creíble, así que
la API tampoco: el objetivo es que, con todas las cadenas, las dos vistas digan
lo mismo. Endpoint:
`/quien-gana/zona?cadenas=...` (las cadenas vienen de la zona elegida).

Un test fija que, con todas las cadenas, el cálculo de la API reproduce el
ganador de cada categoría del mart (con la tolerancia que se mida).

Alternativa: un mart nuevo por localidad. Descartada: 560 lugares por 66
categorías, y un rearmado de pipeline por algo que la API ya puede calcular.

### 7. Promos y Tu canasta solo toman la zona como punto de partida

Promos abre el mapa en el centro de la zona usando el `destino` que ya tiene.
Tu canasta agrega la zona como localidad solo si no hay localidades guardadas y
si la zona está entre las localidades cotizables. En ninguno de los dos casos
lo que el usuario haga en la página cambia la zona.

### 8. El selector de zona vive en el encabezado

Un botón en el encabezado ("📍 Palermo, CABA" o "📍 Elegí tu zona") abre un
panel con el buscador, "usar mi ubicación" y "borrar zona". En el celular el
panel ocupa la parte de abajo de la pantalla, con campo de 16 px.

## Risks / Trade-offs

- [El ranking de zona y el nacional salen de cálculos distintos (API contra
  mart) y pueden diferir en detalle] → test de oráculo con todas las cadenas, y
  la página dice cuál vista se está viendo.
- [Una zona chica con una o dos cadenas] → Más barato lo dice y muestra la vista
  nacional (spec mas-barato); Mismo producto muestra el resto de las cadenas.
- [`replaceState` pisando parámetros de otras páginas] → el hook de zona solo
  toca `zona` y conserva el resto; test de la función que arma la URL.
- [Nombres de lugar que no coinciden con las localidades cotizables de Tu
  canasta (barrio contra localidad)] → si no hay coincidencia exacta por nombre
  y provincia, no se agrega y se avisa (spec tu-canasta).
- [Lista de lugares con sucursales de coordenadas rotas] → el centro ya es la
  mediana (decisión existente en `mapa_promos.lugares`).

## Migration Plan

Frontend y API se despliegan juntos en el mismo servicio de Cloud Run, así que
no hay versiones cruzadas. Sin zona guardada el sitio se comporta como hoy.
Rollback: volver a la revisión anterior de Cloud Run; la clave de localStorage
nueva no molesta a la versión vieja.
