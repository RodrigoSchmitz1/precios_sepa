# Proposal

## Why

`respuesta-antes-que-el-titular` hizo que el detalle de un producto diga
"cuesta casi lo mismo" cuando la diferencia entre la cadena más barata y la más
cara es menor al 5%. Tu lista quedó afuera. En producción, con Lomas de Zamora
y una lista de tres productos, el titular dice "ahorrás $ 212 (2%)" en verde.
Es la misma no-noticia, presentada como ahorro, y contradice el criterio del
detalle que está en la misma página.

## What Changes

- Si en Tu lista la cadena más cara cobra menos de un 5% más que la más barata,
  el titular dice que la compra cuesta casi lo mismo y cuántos pesos de
  diferencia hay, sin el "ahorrás" en verde. El umbral es el mismo del detalle
  (`DIFERENCIA_CASI_IGUAL_PCT`).
- Vale con zona y sin zona. Del 5% para arriba, el titular queda como hoy.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mismo-producto`: suma el requisito de la diferencia chica en Tu lista.

## Impact

- `frontend/src/utils/listaEnZona.ts`: una función que dice si hay ahorro, si
  es casi lo mismo o si no hay comparación, con tests.
- `frontend/src/components/TuLista.tsx`: el titular.
- API y BigQuery: sin cambios.
