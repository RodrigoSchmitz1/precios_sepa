# Design

## Context

- `cotizar_lista(indice, items)` en `api/mismo_producto.py` arma, por cadena:
  - el total;
  - cuántos productos tiene;
  - si está completa;
  - qué le falta.
- También devuelve, por producto, la cadena más barata (`mas_barato`) y el piso
  "combinando cadenas". Los precios por cadena de cada producto (`_precios`) se
  borran antes de responder.
- `TuLista.tsx` no recibe la zona. El titular sale de la cadena completa más
  barata y la más cara de todo el país.
- El detalle del producto, en la misma página, ya parte por zona con
  `partirPorZona(p.precios, cadenasVisibles(zona))`.
- `/quien-gana/zona` recibe los nombres crudos de `Zona.cadenas` e ignora las
  cadenas sin precio ese día. Devuelve 422 solo si no queda ninguna.

## Goals / Non-Goals

**Goals:**
- Que Tu lista con zona compare entre las cadenas de la zona: titular, ahorro,
  completas y combinando cadenas.
- Que las cadenas del país sigan visibles pero aparte, como en el detalle del
  producto.
- Mantener el costo de BigQuery en cero.

**Non-Goals:**
- Precio por sucursal. El precio de cada cadena sigue siendo el de todo el país,
  y la nota fija lo dice.
- Mover la lista de lugar o hacerla más fácil de encontrar (ícono, contador).
  Eso sale del explore, pero es otro change.
- Cambiar cómo se elige la zona.

## Decisions

### La cuenta de la zona se hace en la API, no en el navegador

- **Decisión:** `POST /mismo-producto/lista` acepta en el cuerpo un
  `cadenas: list[str]` opcional. Con cadenas, la respuesta suma un bloque
  `zona`:
  ```
  zona: {
    cadenas: [...filas como las de "cadenas", solo de la zona, con "completa"
               medido sobre los productos que se venden en la zona],
    combinando_cadenas: <piso con cadenas de la zona>,
    no_en_zona: [id_producto, ...],
    mas_barato: {id_producto: {cadena, precio}}
  }
  ```
  Las filas nacionales quedan como están.
- **Por qué:** el navegador no tiene los precios por cadena de cada producto,
  porque la API los borra. Sin ellos no puede rearmar "combinando cadenas" ni la
  más barata de la zona por producto. Hacerlo en la API también repite la forma
  de `/quien-gana/zona`.
- **Alternativa descartada:** filtrar `cadenas` en el navegador. Alcanza para el
  titular, pero no para combinando cadenas, y deja dos cálculos del mismo número.
- **Alternativa descartada:** devolver `_precios` al navegador. Agranda la
  respuesta y saca la regla de la API.

### Nombres de cadena

Se mandan los nombres crudos de `Zona.cadenas`, como en `obtenerQuienGanaZona`.
El índice de Mismo producto usa esos nombres. Las cadenas que no están en el
índice ese día se ignoran sin dar error, porque un día sin Cencosud no tiene que
romper la lista de Palermo.

### Completa en la zona

- **Decisión:** una cadena de la zona es completa si tiene todos los productos
  que vende al menos una cadena de la zona. Los productos que no vende ninguna
  van en `no_en_zona` y quedan afuera de los totales de la zona.
- **Por qué:** con la regla nacional, un solo producto regional dejaría a la
  zona sin ninguna cadena completa y sin titular. Es el mismo criterio que el
  detalle del producto: "en tu zona no se consigue".
- **Riesgo:** la lista de la zona suma menos productos que la nacional. Por eso
  `no_en_zona` se nombra arriba del titular y no en la letra chica.

### Lo que muestra Tu lista con zona

| Caso | Titular | Debajo |
|---|---|---|
| 2 o más cadenas completas en la zona | "En tu zona, en X te sale $A y en Y $B: ahorrás…", entre cadenas de la zona | "Con todos tus productos" (zona), "Les falta algún producto" (zona), "Otras cadenas del país" plegada |
| 1 sola cadena completa en la zona | "En tu zona, en X te sale $A" (y si hay más cadenas en la zona, que son incompletas, se dice) | igual |
| Ninguna completa en la zona | "Ninguna cadena de tu zona tiene todos…" | coberturas de la zona y del país |
| Ningún producto se consigue en la zona | "En tu zona no se consigue ninguno de tus productos" | la comparación nacional de hoy |
| Sin zona | como hoy | como hoy |

"Otras cadenas del país" muestra las cadenas de afuera de la zona con su total y
cuántos productos tienen, sin barras ni ahorro. Va plegada, así no compite con
el titular.

### La zona entra en la clave del efecto

La clave que dispara la cotización suma las cadenas de la zona, así que cambiar
o borrar la zona vuelve a cotizar. Se mantiene la espera de 250 ms.

## Risks / Trade-offs

- **[Respuesta más grande]** → El bloque `zona` repite filas solo de las cadenas
  de la zona, entre 1 y 10. Son unos cientos de bytes.
- **[La zona puede tener cadenas que no venden nada de la lista]** → No aparecen
  en las filas de la zona, igual que hoy no aparece una cadena sin precio para
  ningún producto.
- **[Dos cifras de ahorro en la misma página]** → El ahorro nacional se deja de
  mostrar cuando hay zona. Solo queda el de la zona, para no repetir la
  contradicción que encontró el explore.
