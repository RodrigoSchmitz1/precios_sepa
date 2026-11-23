# Proposal

## Why

Changuito tiene que convertirse en un lugar donde la gente entre seguido y se quede unos minutos, porque lo que haga ahí es lo que después diferencia a Changuito Empresas. Hoy la portada abre con un mapa y miles de promos sueltas: se mira una vez y no invita a volver ni a recorrer. Mis gastos compara cada ticket por separado, pero no responde lo que la gente se pregunta a fin de mes: en qué súper me hubiera salido más barata toda la compra, y cuánto me ahorraba repartiéndola entre dos.

## What Changes

- **Promos como vidriera.** La portada de Promos deja de abrir con el mapa. Arriba aparecen las promos fuertes del día cerca de la zona, y debajo filas por categoría ("Almacén", "Limpieza"…) y por súper ("Lo mejor de Día hoy"), cada una con sus mejores promos y un "Ver todas".
- **El mapa queda detrás de un botón.** "Ver en el mapa" abre el mapa y el listado de hoy, con los mismos filtros. No se carga Leaflet ni las 5.000 promos hasta que se pide.
- **Página por categoría.** Cada categoría tiene su página de promos cerca de la zona, con sus subcategorías como filtro y el mismo orden de siempre.
- **"Avisame cuando esté de oferta".** Un botón en el detalle de un producto y en cada promo de una categoría guarda el producto en el teléfono. Al volver a Promos, un bloque arriba dice cuántos de esos productos están en promo cerca y cuáles. Sin notificaciones con la app cerrada.
- **El mes en Mis gastos.** Con los tickets del mes, Mis gastos dice en qué súper de tu zona hubieras pagado menos por esos mismos productos, y cuánto menos mezclando dos, a precio de lista y sin promos.
- Fuera de alcance: mandar eventos anónimos para Changuito Empresas (se diseñan aparte y se encienden en el lanzamiento, con su propio consentimiento), notificaciones push y cuentas de usuario.

## Capabilities

### New Capabilities
- `avisos-de-oferta`: los productos que el usuario pidió que se le avise cuando estén en promo, guardados en el teléfono, y el aviso al volver.

### Modified Capabilities
- `promos`: la portada de Promos pasa a ser una vidriera (promos fuertes, filas por categoría y por súper), el mapa pasa detrás de un botón y cada categoría tiene su página.
- `mis-gastos`: se suma el resumen del mes contra la cadena más barata de la zona y contra la mejor combinación de dos.

## Impact

- **API** (`api/main.py`, `api/mapa_promos.py`): un endpoint nuevo para la vidriera y un filtro de rubro en `/promos/mapa`, resueltos con el índice en memoria; las filas de promo suman `id_producto`. Ninguna consulta nueva a BigQuery.
- **Frontend**: `PromosPage.tsx` se parte en vidriera, mapa y página de categoría (ruta nueva); componentes nuevos para las filas de la vidriera y el bloque de avisos; botón Avisame en el detalle de producto y en `PromoCard`; `GastosPage.tsx` suma el resumen del mes usando `/mismo-producto/lista/donde-comprar`.
- **Almacenamiento en el teléfono**: una clave nueva de localStorage para los avisos.
- **Compartir**: la ruta de la página de categoría lleva su propia tarjeta.
- **Tests**: API (unittest) y frontend (vitest) para la vidriera, el filtro de rubro, los avisos y el resumen del mes.
