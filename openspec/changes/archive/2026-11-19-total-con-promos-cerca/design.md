# Design

## Context

- **El índice del mapa** (`IndiceMapa`, en `api/mapa_promos.py`) ya está en memoria. Cada promo es una posición con:
  - `id_producto`, `precio_promo`, `vigente_hasta` y `multiple`
  - las sucursales donde vale, en `miembros[inicio[pos]:inicio[pos+1]]`
  - `por_producto`, que da las posiciones de un producto.
- **`promos_de_productos`** devuelve, por producto, la mejor promo de cada cadena en la sucursal más cercana. No sirve para una cuenta por sucursal: puede mezclar sucursales de una misma cadena.
- **Tu lista** pide `/mismo-producto/lista` con las cadenas de la zona, y aparte `/promos/productos` para mostrar la mejor promo bajo cada producto (`promosQueConvienen`).
- **El detalle** ya pide las promos del producto (`PromosCercaDelProducto`) y tiene el precio más bajo de la zona (`titularDelProducto`).

## Goals / Non-Goals

**Goals:**
- Una cuenta con promos honesta: una sucursal real por cadena, promos vigentes y sin compra múltiple, dicha aparte, y que avise qué cadenas no informan promos.
- Una sola fuente para la cuenta: la API, desde memoria.

**Non-Goals:**
- Tocar el total principal, Más barato o Tu canasta.
- Descuentos bancarios y promos de compra múltiple.

## Decisions

### 1. `promos_de_lista` en la API
`mapa_promos.promos_de_lista(indice, items, precios_de_lista, cadenas, lat, lng, hoy)`:
- **Las sucursales:** las que están a menos de `RADIO_CERCA_KM` del punto y son de las cadenas pedidas.
- **Las promos:** por sucursal y producto, la promo vigente más barata sin compra múltiple. Se arma recorriendo `por_producto` de los productos de la lista y sus miembros cercanos.
- **El total de una sucursal** suma, para cada producto, el menor entre su precio de lista en esa cadena (del índice de Mismo producto, el mismo de `cotizar_lista`) y la promo de la sucursal, por la cantidad.
  - Una cadena que no vende algún producto de la lista queda incompleta, como en el total de siempre, y no compite.
- **Por cadena** queda la sucursal de menor total, con:
  - dirección y distancia
  - total con promos y total de lista
  - productos en promo
  - la vigencia más corta de las promos usadas
- **Endpoint:** `POST /api/promos/lista` recibe `{items, cadenas, latitud, longitud}` y devuelve `{cadenas: [...], poco_informan: [...]}`.
  - Valida como `/mismo-producto/lista`: hasta 50 productos y coordenadas acotadas.
  - Sin `@cachear`, porque depende del punto. Es en memoria.

### 2. Qué cadenas "casi no informan promos"
Al armar el índice del mapa se cuentan las promos por sucursal de cada cadena (promos × sucursales donde valen, dividido sus sucursales). `POCAS_PROMOS_POR_SUCURSAL = 50`.
- **Medido el 19-11:** Coto 33, Maxi 26, y cero los tres Changomás, Vea, Disco y Jumbo. Express tiene 69 y queda como cadena que informa.
- **La respuesta** trae `poco_informan`: las cadenas pedidas que están bajo el umbral.

### 3. Cuándo se muestra la línea en Tu lista
`utils/promosDeLista.ts` decide:
- **Se muestra** si la cadena más barata con promos difiere de la más barata de lista, o si es la misma con un total al menos 1% menor.
- **El texto:**
  - "Con las promos de esta semana cerca tuyo: en el {cadena} de {dirección} te sale $ X, {n} de tus productos en promo, hasta el dd/mm".
  - Si cambia el ganador, empieza "Con las promos, conviene…".
  - Debajo, en `text-xs`, las cadenas de `poco_informan` con la advertencia.
- **Si no se cumple,** no se muestra nada.
- **Sin zona,** no se pide.
- **El total de siempre no se toca,** y el resumen "N productos en promo cerca tuyo" queda como está.

### 4. El aviso bajo el titular del detalle
- **Reusa** las promos que ya trae `PromosCercaDelProducto`. La mejor promo sin compra múltiple que baje del precio más bajo de la zona sube a una línea debajo del titular, con `textoVigencia` y `direccionPromo`.
- **Se evita un segundo pedido:** las promos se levantan a la página, que las pasa al bloque y al aviso.

### 5. Memoria
La estructura nueva, las promos por sucursal y la cuenta, se arma por pedido con los productos de la lista. No se guarda nada nuevo, salvo el conteo por cadena, que son unos bytes. Se mide el tiempo con 50 productos en Palermo.

## Risks / Trade-offs

- **Las promos se informan el día anterior.** Una promo "hasta agotar stock" puede haberse terminado.
  - Mitigación: se dice "hasta el …" cuando hay fecha, y la línea dice "promos de esta semana", no "precio garantizado".
- **Gana la que informa.** Por eso la cuenta va aparte, se nombran las que no informan y el total principal no cambia.
- **Más texto en Tu lista.** Solo aparece cuando cambia algo, y es una sola línea más su aviso.
