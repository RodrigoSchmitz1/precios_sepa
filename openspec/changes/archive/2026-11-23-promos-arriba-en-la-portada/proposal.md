# Proposal

## Why

En el celular, la vidriera de Promos quedaba unas tres pantallas debajo de la presentación: el ejemplo de precios, tres cifras apiladas y las cuatro secciones. Si Changuito tiene que invitar a mirar promos apenas se abre, las promos del día y los avisos tienen que verse en la primera pantalla.

## What Changes

- Tus avisos y las promos del día pasan a ir justo después del buscador y las cifras de la portada; "Ver en el mapa" abre el mapa en ese mismo lugar.
- En el celular, las cifras se deslizan de costado en una fila, el ejemplo de precios baja debajo de las promos y se esconde el subtítulo de la presentación.
- Las filas por categoría y por súper siguen más abajo, después de "¿Qué querés saber?".

## Capabilities

### New Capabilities

### Modified Capabilities
- `portada`: las promos del día y los avisos se ven en la primera pantalla del celular.

## Impact

Solo frontend: `Presentacion.tsx` (hueco para las promos, cifras deslizables, ejemplo abajo en el celular), `VidrieraPromos.tsx` partida en promos del día y filas, `useVidriera` para pedir la vidriera una sola vez, y `PromosPage.tsx`. Sin cambios en la API ni consultas nuevas.
