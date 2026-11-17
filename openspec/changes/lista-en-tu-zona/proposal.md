# Proposal

## Why

Tu lista ignora la zona del usuario. El explore externo del 2026-11-17 eligió
"Lomas de Zamora" y Tu lista le dijo "ahorrás 11%" comparando contra la
Cooperativa Obrera, que no tiene sucursales ahí. En Lomas de Zamora hay
Carrefour, Coto, Dia, Disco, Express y Maxi, y la comparación tiene que hacerse
entre ellas.

zona-compartida llevó la zona a Mismo producto, Promos, Tu canasta y Más barato,
pero dejó afuera a Tu lista. Es la herramienta que más se parece a la compra de
todas las semanas, y hoy contradice al detalle del producto que está en la misma
página: el recuadro "En tu zona" compara con las cadenas de la zona y la lista
compara con todo el país.

## What Changes

- Con una zona elegida, el titular de Tu lista ("En X te sale…, ahorrás…") y la
  lista de cadenas con todos tus productos comparan solo las cadenas que tienen
  sucursal en la zona.
- Las cadenas de afuera de la zona pasan a una sección aparte, "Otras cadenas del
  país", que no entra en el ahorro.
- La estimación "combinando cadenas" se arma solo con cadenas de la zona.
- Los productos que no vende ninguna cadena de la zona se nombran aparte y no
  entran en los totales de la zona. Así un solo producto que no se consigue no
  deja a la zona sin comparación.
- Una zona con una sola cadena dice cuánto sale la lista ahí, sin un ahorro
  inventado.
- `POST /mismo-producto/lista` acepta opcionalmente las cadenas de la zona y
  devuelve la comparación dentro de la zona junto a la nacional. Sale del mismo
  índice en memoria, así que no consulta BigQuery.
- Sin zona elegida, Tu lista funciona igual que hoy.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mismo-producto`: suma los requisitos de Tu lista con zona. Hoy la spec no
  dice nada de la lista.

## Impact

- **API:**
  - `api/mismo_producto.py`: `cotizar_lista` recibe un parámetro opcional con las
    cadenas.
  - `api/main.py`: el cuerpo de `ListaDeProductos` admite `cadenas`.
  - Tests nuevos en `api/`.
- **Frontend:**
  - `frontend/src/components/TuLista.tsx` toma la zona con `useZona`.
  - `frontend/src/api/client.ts` cambia en `cotizarLista`.
  - `frontend/src/types/index.ts` cambia en `ResultadoLista`.
  - Tests de la cuenta en `utils/`.
- **Costo de BigQuery:** cero. La lista ya se cotiza desde
  `_indice_mismo_producto()`, que está en memoria.
- **Relación con `cadena-que-falta`:** ese change, activo y sin archivar, también
  modifica la spec `mismo-producto`. Los requisitos no chocan: allá se trata la
  fecha del precio arrastrado y acá la zona de la lista. Un precio arrastrado
  cuenta en la lista como cualquier otro.
