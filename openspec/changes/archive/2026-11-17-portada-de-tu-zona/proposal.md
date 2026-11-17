# Proposal

## Why

Es la segunda mitad del candidato 3 del explore externo del 2026-11-17. Con una
zona elegida, la portada sigue titulando con todo el país. Con "Lomas de Zamora":

- La tarjeta "Más barata en más categorías" dice **Maxi en el país**.
- "Cuánto ahorrás eligiendo dónde" dice **12%** y compara dos cadenas que casi
  nadie tiene cerca a la vez. El 17-11 eran Maxi y La Anónima, y La Anónima no
  está en Lomas.
- La única señal de la zona es una línea chica: "Estas cifras son de todo el
  país".

Según el explore, la zona cambia la letra chica y no el titular. El propio
DECISIONES midió que Maxi es la más barata disponible en solo 33 de 382
localidades: lo que importa es qué cadenas tiene cerca cada uno. Y la portada
es lo primero que se ve después de elegir la zona.

## What Changes

Con una zona elegida, la portada pasa a hablar de la zona:

- **"Tu súper más barato cerca":** la cadena de la zona que gana más
  categorías. Sale del mismo cálculo que Más barato en tu zona
  (`/quien-gana/zona`).
- **"Cuánto ahorrás eligiendo dónde":** la canasta básica cotizada solo en las
  sucursales de la zona (`/canasta-personalizada/por-cadena` con la zona como
  localidad), y la diferencia entre la más barata y la más cara de la zona.
- **Zonas con una sola cadena:** la portada no inventa una comparación. Dice
  que SEPA informa una sola cadena en la zona y cuánto sale ahí la canasta.
- **"Lo que más subió" sigue siendo nacional,** porque la inflación es
  nacional (spec `inflacion`). La aclaración de abajo pasa a decir solo eso.
- **Si la zona no tiene precios para la canasta** (un barrio con sucursales
  pero sin la canasta cotizable), esa tarjeta queda con el dato del país y lo
  dice.
- Sin zona, la portada queda igual.

## Capabilities

### New Capabilities

- `portada`: qué dice la portada del sitio, con zona y sin zona.

### Modified Capabilities

Ninguna. La aclaración nacional ya la cubre "Cada página dice si usa la zona"
en `zona-del-usuario`, y este change la cumple tarjeta por tarjeta.

## Impact

- **Frontend:**
  - `frontend/src/components/Presentacion.tsx`: la carga de datos depende de la
    zona y las tarjetas se arman distinto.
  - `frontend/src/utils/`: una función pura que arma las cifras de la portada a
    partir de los datos y la zona, con sus tests. Se mueve ahí la lógica que hoy
    está dentro del componente.
- **API:** sin cambios. Se usan `/quien-gana/zona`,
  `/canasta-personalizada/localidades` y `/canasta-personalizada/por-cadena`,
  que ya existen y salen de índices en memoria.
- **BigQuery:** cero.
