# Tasks

## 1. API

- [x] 1.1 `cotizar_lista(indice, items, cadenas=None)` en `api/mismo_producto.py`. Con `cadenas`, suma el bloque `zona` con `cadenas`, `combinando_cadenas`, `no_en_zona` y `mas_barato`, y "completa" se mide sobre los productos que se venden en la zona. Sin `cadenas`, la respuesta queda idéntica a la de hoy.
- [x] 1.2 `ListaDeProductos` en `api/main.py` admite `cadenas: list[str] | None`. Las cadenas que no tienen precio ese día se ignoran sin dar error.
- [x] 1.3 Tests en `api/test_lista_zona.py`:
  - la cadena de afuera de la zona no entra en las filas de la zona;
  - un producto que no se vende en la zona va a `no_en_zona` y no anula la cadena completa;
  - combinando cadenas usa la más barata de la zona;
  - con una cadena sin precio ese día, la respuesta es 200;
  - sin `cadenas`, la respuesta es igual a la de hoy;
  - la zona de una sola cadena.
- [x] 1.4 Correr la suite completa de la API con `SIN_BIGQUERY=1`.

## 2. Frontend

- [x] 2.1 `cotizarLista(items, cadenas?)` en `client.ts` y el tipo `ResultadoLista` con el bloque `zona` opcional.
- [x] 2.2 Una función pura en `utils/` que, a partir del resultado y la zona, arme el caso a mostrar según la tabla del design. Con sus tests.
- [x] 2.3 `TuLista.tsx` usa `useZona`. Las cadenas de la zona entran en la clave del efecto. Implementa el titular y las secciones de cada caso, con "Otras cadenas del país" plegada, y nombra `no_en_zona` arriba del titular.
- [x] 2.4 Correr los tests del frontend y el build.

## 3. Verificación

- [x] 3.1 Recorrido en Playwright WebKit a 414x896, contra la API local:
  - Lomas de Zamora: la Cooperativa Obrera no aparece en el titular;
  - Rafaela: no aparece ningún "ahorrás";
  - borrar la zona vuelve a la comparación nacional;
  - un producto que no se consigue en la zona aparece nombrado.
- [x] 3.2 Barrido sin desbordes ni errores de consola, con zona y sin zona.
- [x] 3.3 Anotar la decisión en `docs/DECISIONES.md`, en "La zona del usuario".
