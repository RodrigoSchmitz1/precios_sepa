## Why

Lo que se aprende en el sitio ("Maxi", "da casi lo mismo") se aprende una sola
vez. Lo que cambia cada semana y le importa a quien hace la compra son las
promos de lo que compra, en el súper que tiene cerca, y hoy eso no está
conectado con la lista ni con el detalle de un producto (explore externo del
17-11, candidato 5: "no hay un motivo para volver").

Medido el 18-11 con las promos del 17-11 (`list_rows`, sin cuota):

- 103.272 promos válidas. 8.963 de los 47.637 productos de Mismo producto
  tienen al menos una.
- De los 400 productos que están en más cadenas, los que tienen una promo a
  menos de 3 km del centro de la zona son 62 en Lomas de Zamora, 85 en Palermo,
  122 en Caballito, 103 en La Plata, 59 en Bahía Blanca y 12 en Rafaela. En
  casi 9 de cada 10 de esos casos la promo queda por debajo del precio más bajo
  que hoy muestra el sitio para ese producto.
- Una lista de 10 productos comunes en Lomas tiene, en promedio, uno o dos en
  promo cerca. Es suficiente para que valga la pena mirar la lista cada semana.
- El 98% de las promos dice hasta cuándo valen en la leyenda ("hasta
  23/11/2026", "al 30/11/2026"). El resto son promos de Día "hasta agotar
  stock".

## What Changes

- **Tu lista** (en Mismo producto y en `/lista`), con zona elegida: debajo de
  cada producto que esté en promo cerca de la zona aparece la mejor, con
  cadena, dirección, precio, descuento, hasta cuándo vale y el mismo sello de
  evidencia que en Promos ("lo declara la cadena", "verificada", "sin
  verificar"). Arriba, una línea: "Esta semana 2 productos de tu lista están en
  promo cerca tuyo".
- **Detalle de un producto**, con zona elegida: un bloque "En promo cerca
  tuyo" con hasta 3 promos, de la más barata a la más cara.
- Solo se muestra una promo si deja el producto **más barato que la cadena más
  barata de la zona**. Una promo de 15% en Carrefour que igual sale más que en
  Maxi no es una razón para cambiar de súper.
- Los totales de la lista no cambian: siguen siendo con el precio de cada
  cadena en todo el país. Las promos van aparte. Las cadenas que casi no
  informan promos (Coto, Disco, Jumbo) quedarían castigadas si el total las
  mezclara.
- Sin zona elegida, Tu lista invita a elegirla en una línea ("Elegí tu zona y
  te mostramos qué está en promo cerca"). El detalle no muestra nada nuevo.
- API: un endpoint nuevo que, dados los productos y el centro de la zona,
  devuelve sus promos en las sucursales cercanas. Sale del índice del mapa que
  ya está en memoria: no consulta BigQuery.

Fuera de alcance: promos de productos parecidos ("otra yerba está en promo"),
resumen semanal o avisos, descuentos bancarios, historia del precio (candidato
6) y cambiar cómo se calculan los totales.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `promos`: las promos aparecen también en Tu lista y en el detalle de un
  producto, para la zona del usuario y solo cuando mejoran el precio de la
  zona.

## Impact

- `api/mapa_promos.py`: el índice guarda `id_producto` y un índice por
  producto. Función nueva para las promos de unos productos cerca de un punto.
- `api/main.py`: `GET /api/promos/productos?ids=…&latitud=…&longitud=…`.
- Memoria: unas 14 mil claves nuevas y una referencia por promo; se mide con
  las filas reales antes de desplegar.
- Frontend: `components/TuLista.tsx`, `pages/MismoProductoPage.tsx`, una
  utilidad nueva para elegir la promo que conviene y leer la vigencia, y sus
  tests.
- `docs/DECISIONES.md`: la regla de qué promo se muestra y por qué los totales
  no las incluyen.
- Costo en BigQuery: cero. Una columna que ya está en `mart_mapa_promos`, leída
  con la Storage Read API.
