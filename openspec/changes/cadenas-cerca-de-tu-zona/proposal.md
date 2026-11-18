# Proposal

## Why

Para el sitio, "las cadenas de tu zona" son las que tienen sucursal dentro del barrio o de la localidad elegida. El 18-11, en `/zonas` de producción:
- **Zonas de una sola cadena:** 331 de las 559 (59%) tienen una sola.
- **No es falta de opciones:** en 147 de esas zonas hay otra empresa a menos de 3 km del centro.
  - En CABA pasa en las 10: Villa Soldati, Congreso, Santa Rita y siete más.
  - En Villa Soldati, la portada dice "Tu única cadena cerca: Día — SEPA informa una sola cadena en tu zona", con cuatro empresas o más a menos de 3 km.
  - Más barato dice que no hay con qué comparar. Tu lista y Mismo producto comparan contra una sola cadena.
  - Es un error de lo que el sitio afirma, no de los datos: el barrio es un recorte administrativo, y la gente compra a unas cuadras, crucen o no el límite.

Las otras zonas sí tienen una sola cadena cerca. Con el radio de 3 km son 186: 90 de Día, 40 de La Anónima, 34 de la Cooperativa Obrera y 12 de Vea. La otra cadena más cercana está a una mediana de 50 km.
- **Hoy esas zonas leen** que hay una sola cadena y cuánto sale ahí la canasta. Para esa persona el sitio queda casi vacío.
- **Lo que les cuesta no tener opciones** (medido el 18-11 con la canasta del INDEC, sobre el ranking nacional en productos idénticos):
  - Día: +8,1% respecto de Maxi, la más barata del país.
  - La Anónima: +13,9%.
  - El dato está medido desde octubre (DECISIONES, "lo que sí pesa es qué cadenas hay cerca") y nunca se publicó.

Fue el candidato 9 del explore externo del 17-11. Rodrigo eligió hacer las dos partes: el radio y la página honesta.

## What Changes

- **Las cadenas de tu zona son las que están cerca.** Una zona tiene las cadenas con sucursal en el lugar más las que tienen una sucursal a menos de 3 km de su centro. Es el mismo radio que ya usan las promos cercanas, y una sola constante para los dos.
  - El cambio es uno solo, en `/zonas`, y lo toman juntos la portada, Más barato, Mismo producto y Tu lista.
  - Medido: las zonas de una sola cadena pasan de 331 a 186, ninguna en CABA, y las de tres o más pasan de 138 a 287.
- **Una zona que sigue con una sola cadena dice lo que le cuesta.**
  - La portada dice que cerca de la zona SEPA informa solo esa cadena y a cuántos km está la otra más cercana.
  - Agrega cuánto saldría la misma canasta en la cadena más barata del país: "En Maxi (Carrefour), la más barata del país, la misma canasta sale $ X, un 14% menos".
  - Si la cadena de la zona no tiene total en el ranking nacional (Cooperativa Obrera, Vea), no se inventa la cifra: queda solo la distancia.
- **El selector de zona** dice "N cadenas cerca" en vez de "N cadenas".

Fuera de alcance:
- **Tu canasta:** sigue cotizando por localidad, como dice su spec.
- **El ahorro de la portada:** cuando la canasta no se puede cotizar en la localidad, sigue saliendo del país, rotulado como tal.
- **El titular general** ("Comprá mejor…") y el ejemplo nacional de la portada.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `zona-del-usuario`: suma que las cadenas de una zona incluyen las que tienen sucursal a menos de 3 km de su centro.
- `portada`: el requisito de la zona con una sola cadena suma la distancia a la otra cadena más cercana y lo que costaría la canasta en la más barata del país.

## Impact

- **API:**
  - `api/mapa_promos.py`, `lugares(con_cadenas=True)`: las cadenas cercanas, `otra_cadena_cerca` en las zonas de una sola cadena y una constante de radio compartida con las promos.
  - `/zonas` se calcula una vez por carga del índice del mapa, no en cada pedido.
  - Tests.
- **Frontend:**
  - `utils/cifrasPortada.ts`: la tarjeta de la zona de una cadena.
  - `SelectorZona.tsx`: el texto "cadenas cerca".
  - `QuienGanaPage.tsx`: el texto de una sola cadena.
  - Tests.
- **BigQuery:** nada. Todo sale del índice del mapa y del ranking de la canasta, que ya están en memoria.
- **Memoria:** `/zonas` suma un campo en unas 186 zonas.
- **Docs:** sección en `docs/DECISIONES.md`.
