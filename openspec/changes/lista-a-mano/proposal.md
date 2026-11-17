# Proposal

## Why

Es el candidato 4 del explore externo del 2026-11-17: "la lista no se encuentra
y no hay hábito". Tu lista es la herramienta más parecida a la compra de todas
las semanas, y ya compara en tu zona (`lista-en-tu-zona`). Pero hoy:

- Vive solo al fondo de Mismo producto, en una sección que no se llama "lista".
  La barra del celular dice "Producto".
- Ningún lugar del sitio muestra que hay una lista ni cuántos productos tiene.
  Quien agrega algo con "+ Lista" no ve dónde fue a parar. Quien vuelve otro día
  no sabe que su lista sigue guardada.
- El estado de la lista está adentro de `MismoProductoPage`: ninguna otra parte
  del sitio puede leerlo.

## What Changes

- **Un acceso a Tu lista en el encabezado de todas las páginas,** con el ícono
  del changuito y la cantidad de productos, en el celular y en la computadora.
  Al agregar un producto, el número cambia en el momento.
- **Una página propia, `/lista`,** con Tu lista: cuánto sale en cada cadena de
  tu zona, las cantidades y quitar productos.
- **Sin productos,** la página explica cómo se arma la lista y ofrece el buscador
  y el camino desde Tu canasta.
- **La lista pasa a un estado compartido** (`ProveedorLista`), guardado en el
  navegador como hoy y con la misma clave. Así no se pierde ninguna lista ya
  guardada. Si se cambia en otra pestaña, se actualiza.
- **Mismo producto sigue mostrando Tu lista donde está,** pero usa el mismo
  estado que el encabezado y `/lista`.
- **La barra inferior del celular no cambia.** Cambiar "Inflación" por "Mi
  lista" es una decisión aparte, para cuando se vea si el acceso del encabezado
  alcanza.

## Capabilities

### New Capabilities

- `tu-lista`: dónde se encuentra la lista en el sitio, cómo se ve su tamaño y
  la página propia.

### Modified Capabilities

Ninguna. Los requisitos de la lista con zona (`mismo-producto`) no cambian. La
página nueva usa el mismo componente.

## Impact

- **Frontend:**
  - Nuevos: `contexto/lista.ts` y `components/ProveedorLista.tsx`, con el estado
    compartido, y `pages/ListaPage.tsx` con la ruta `/lista`.
  - `components/Layout.tsx`: el acceso con contador en el encabezado y el
    proveedor.
  - `pages/MismoProductoPage.tsx`: deja su `useState` de la lista y usa el
    contexto.
  - Tests de la lógica de la lista (agregar, tope de 50, cantidades,
    sincronizar entre pestañas).
- **API y BigQuery:** sin cambios.
