# Design

## Context

- `Presentacion.tsx` carga una sola vez, sin depender de la zona:
  - el resumen de inflación;
  - `obtenerQuienGana("")`, que es nacional;
  - los destacados;
  - la canasta básica del INDEC cotizada por cadena sin localidades, o sea en
    todo el país;
  - un producto de ejemplo.
- Arma tres cifras con esos datos:
  - el líder por categorías (`liderEn`, `categoriasGanadas`);
  - lo que más subió;
  - el ahorro (`ahorroEnCadenas`).
- Con zona solo agrega una línea: "Estas cifras son de todo el país".
- Para la zona ya existen:
  - `obtenerQuienGanaZona(zona.cadenas)`, que usa Más barato en tu zona;
  - `cotizarCanastaPorCadena(items, [localidad])` con ámbito `zona`, que usa
    Tu canasta;
  - `localidadDeZona(opciones, zona)`, que encuentra la localidad de la canasta
    que corresponde a la zona. Lo usa Tu canasta y puede no encontrar ninguna.

## Goals / Non-Goals

**Goals:**
- Que con zona, la tarjeta principal y la de ahorro sean de la zona.
- Que una zona de una sola cadena reciba una respuesta honesta.
- Que lo que siga siendo nacional lo diga en la misma tarjeta.

**Non-Goals:**
- La tarjeta de ejemplo del hero (la Playadito). Se queda nacional por ahora,
  porque el detalle del producto ya habla de la zona.
- Las promos y el mapa de la portada, que ya arrancan en la zona.
- Cambiar la API.

## Decisions

### La carga depende de la zona

- **Decisión:** el `useEffect` de la portada se separa en dos.
  - Lo que no depende de la zona (inflación, destacados, ejemplo) carga una
    vez.
  - Lo que sí depende (quién gana y la canasta por cadena) carga de nuevo
    cuando cambia `zona`.
  
  Cambiar la zona desde el encabezado actualiza las tarjetas sin recargar.
- **Con zona:**
  1. Quién gana: `obtenerQuienGanaZona(zona.cadenas)`.
  2. Canasta: `buscarLocalidades(zona.nombre)` y `localidadDeZona`. Si hay
     localidad, `cotizarCanastaPorCadena(items, [localidad])`. Si no, se cotiza
     el país y la tarjeta lo dice.

### Las cifras salen de una función pura

`cifrasDePortada({ quienGana, canasta, inflacion, zona, cadenasZona })` en
`utils/cifrasPortada.ts` devuelve las tarjetas: etiqueta, valor, detalle, chip y
si son de la zona o del país. El componente solo las dibuja. Las reglas de cada
caso quedan testeadas:

| Caso | Tarjeta 1 | Tarjeta 3 |
|---|---|---|
| Sin zona | "Más barata en más categorías" (país), como hoy | ahorro del país, como hoy |
| Zona con 2 o más cadenas | "Tu súper más barato cerca: X, en N de M categorías" | "Cuánto ahorrás en tu zona: P%", entre la más barata y la más cara de la zona |
| Zona sin canasta cotizable | igual que la anterior | ahorro del país, con "en todo el país" en el detalle |
| Zona con 1 cadena | "Tu única cadena cerca: X" ("SEPA informa una sola cadena en tu zona") | "La canasta básica en X: $T" (si se puede cotizar) |

La tarjeta 2 (lo que más subió) no cambia de dato. Con zona, el detalle termina
en "· todo el país".

### Una sola cadena

- **Decisión:** se cuentan las cadenas de la zona que tienen precios en el
  resultado de `/quien-gana/zona`. Si es una, o si la API devuelve 422 porque
  ninguna tiene precios, la tarjeta 1 dice que hay una sola cadena (o que no
  hay precios hoy) en lugar de un ranking.
- **Por qué:** con una sola cadena, "gana el 100% de las categorías" es
  verdad, pero no es una comparación.

### La aclaración de abajo

La línea "Estas cifras son de todo el país…" desaparece cuando hay zona, porque
cada tarjeta ya dice de dónde es su dato.

## Corregido al implementar

- **El alcance de la canasta lo dice la respuesta.** Con una sola cadena (como
  Rafaela), `/canasta-personalizada/por-cadena` no puede comparar en la zona y
  cotiza el país aunque reciba la localidad. La portada usa el `ambito` de la
  respuesta y no solo si encontró la localidad.
- **Zona de una cadena con la canasta del país:** la tarjeta muestra el total
  de esa cadena con "los precios de la cadena en todo el país". Se mide por el
  nivel de la cadena en productos idénticos, que es parejo en todo el país.
  Nunca muestra el ahorro del país.

## Risks / Trade-offs

- **Más pedidos al elegir la zona:** quién gana en la zona y la canasta de la
  zona son dos pedidos más. Los dos salen de índices en memoria y ya los hacen
  Más barato y Tu canasta.
- **Coincidencia entre zona y localidad de la canasta:** depende del nombre
  exacto y la provincia, como en Tu canasta. Cuando no coincide, la tarjeta cae
  al dato del país y lo dice, sin inventar nada.
- **Totales de la canasta de zona contra los del país:** con la zona, la
  canasta se cotiza en sus sucursales. El monto puede diferir del nacional por
  composición, así que el detalle dice qué categorías entran, como hoy.
