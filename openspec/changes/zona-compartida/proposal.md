# Proposal

## Why

El sitio pide "tu zona" de cuatro formas distintas que no se comunican: Promos
usa el mapa y un selector de provincia, Tu canasta pide hasta tres localidades,
"Dónde comprarla" usa el GPS con un radio, y Más barato e Inflación no tienen
zona. Probado en un celular por alguien que no lo conocía (2026-11), el
recorrido natural fue elegir la localidad en el inicio y buscar un producto; al
llegar a Mismo producto la zona había desaparecido y los precios eran de todo el
país. Para quien compra, la pregunta es "dónde me conviene esto acá cerca", y
hoy el sitio la contesta solo si uno descubre cada pantalla por separado.

Es la base de lo que sigue (un inicio pensado para el celular e insights
personales): sin una zona compartida, cada mejora vuelve a pedirla.

## What Changes

- Una sola zona del usuario para todo el sitio: se elige una vez (buscando un
  barrio o localidad, o con "usar mi ubicación"), queda visible en el
  encabezado de todas las páginas, se puede cambiar o borrar desde ahí, se
  recuerda en el navegador y viaja en los links que se comparten.
- Mismo producto con zona: además del precio de cada cadena, dice qué cadenas
  hay en tu zona y cuál de ellas es la más barata, y separa las que no tienen
  sucursal cerca. El precio sigue siendo el de la cadena, y la página lo dice.
- Promos con zona: el mapa y la lista arrancan en tu zona.
- Tu canasta con zona: la zona viene cargada como localidad.
- Más barato con zona: muestra quién gana entre las cadenas de tu zona, con la
  vista nacional a un toque.
- Inflación declara que es nacional y no usa la zona.
- La API suma, a la lista de lugares que ya tiene en memoria, las cadenas con
  sucursal en cada lugar. Ninguna consulta nueva a BigQuery.

Fuera de alcance (cambios siguientes): el rediseño del inicio para el celular,
los insights personales ("lo que vos comprás subió X%"), instalar como app y
compartir por WhatsApp.

## Capabilities

### New Capabilities
- `zona-del-usuario`: qué es la zona, cómo se elige, se muestra, se recuerda,
  se comparte por link y se borra; qué pasa sin zona.
- `mismo-producto`: cómo se presentan los precios de un producto exacto en
  cada cadena, y cómo cambia esa presentación con una zona elegida.
- `promos`: qué promos se muestran y desde dónde arranca el mapa.
- `tu-canasta`: de dónde salen las localidades contra las que se cotiza.
- `mas-barato`: contra qué conjunto de cadenas se calcula quién gana.
- `inflacion`: el alcance geográfico del índice y cómo se lo comunica.

### Modified Capabilities
(ninguna: es el primer cambio con OpenSpec y todavía no hay specs)

## Impact

- Frontend: un estado de zona compartido (nuevo), el encabezado (Layout), las
  páginas de Promos, Mismo producto, Tu canasta, Más barato e Inflación, y el
  buscador de la portada.
- API: `/promos/lugares` (o un endpoint hermano) devuelve también las cadenas de
  cada lugar, desde el índice del mapa que ya está en memoria.
- Sin cambios en dbt ni en BigQuery; sin rearmado del pipeline.
- docs/DECISIONES.md: la zona compartida y por qué el precio de un producto
  sigue siendo el de la cadena.
