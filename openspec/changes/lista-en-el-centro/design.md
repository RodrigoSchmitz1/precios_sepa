# Design

## Context

- **Navegación.** `Layout.tsx` usa un solo arreglo `SECCIONES` para el menú de la computadora y para la barra de abajo del celular (`sm:hidden`, cinco columnas). El acceso a la lista del encabezado es `AccesoLista`, con un contador que sale de `useLista()`.
- **Portada.** `Presentacion.tsx` arma el hero: titular, buscador y tarjeta de ejemplo. Tiene `useZona()`, pero no lee la lista.
- **Lista.** `ListaPage.tsx` muestra `TuLista` o, si está vacía, un texto con el buscador. `useLista()` expone `lista`, `agregar`, `quitar`, etc.
- **Buscador.** `mismo_producto.buscar(indice, consulta, limite)` resuelve en memoria. Su orden ya prioriza la categoría nombrada y las cadenas.

## Goals / Non-Goals

**Goals:** que la lista se encuentre y se arme rápido desde el celular, sin perder Inflación.

**Non-Goals:** rehacer la portada, decir para quién es el sitio, o resolver los frescos.

## Decisions

### 1. La barra del celular usa su propio arreglo
`SECCIONES_CELULAR` es `SECCIONES` con Inflación reemplazada por `{ ruta: "/lista", nombre: "Mi lista", corto: "Mi lista", icono: "🛒" }`.
- **El menú de la computadora** sigue con `SECCIONES`.
- **El ítem de la lista** muestra el contador de `useLista()` como globo sobre el ícono, con el mismo estilo que `AccesoLista`.
- **El changuito del encabezado** se queda: en la computadora es el acceso, y en el celular no molesta.

### 2. Los básicos los resuelve la API
`BASICOS` en `api/mismo_producto.py` es una lista de `(grupo, nombre corto, búsqueda)`. Ejemplos:
- `("Almacén", "Yerba", "yerba 1 kg")`
- `("Lácteos", "Leche", "leche entera 1 litro")`

**`basicos(indice)`** devuelve, para cada uno, el primer resultado de `buscar`, con el resumen del producto. Si una búsqueda no trae nada, se saltea.

**`GET /api/mismo-producto/basicos`** va con `@cachear`: el índice cambia una vez por día.

**Por qué búsquedas y no categorías:** medido el 19-11, el "más común" por categoría da una polenta para Harina, un endulzante para Azúcar, una crema para Quesos y un postre para Yogur. El buscador, con el texto que tipea la gente, da lo esperable.

### 3. El armado rápido
`ArmadoRapido.tsx` recibe los básicos y la lista:
- **La vista:** los agrupa y muestra cada uno como un botón con el nombre corto ("Yerba", "Aceite"), con el producto debajo en chico.
- **Tocar** suma o saca con `useLista()`. El estado se ve con `aria-pressed` y un ✓.
- **En `ListaPage`:**
  - con la lista vacía, el armado va primero, con el buscador debajo;
  - con productos al entrar, va al final, dentro de un `<details>` "Sumar básicos" cerrado;
  - si se entró con la lista vacía, el armado queda arriba y abierto toda la visita, y la comparación aparece debajo. Si no, el primer toque lo plegaba justo cuando se estaba armando la lista (decidido al probarlo).

### 4. La tarjeta de la portada
`TarjetaTuLista` en `Presentacion.tsx` cotiza con `cotizarLista(items, zona?.cadenas)` cuando hay lista, con el mismo pedido que Tu lista, y toma la cadena más barata con `vistaDeLista`.
- **Va debajo del buscador** del hero.
- **El texto** es "Tu lista · N productos: en {cadena} te sale $ X". Si no hay ninguna cadena completa, dice "Tu lista · N productos: mirá dónde te conviene".

## Risks / Trade-offs

- **Inflación pierde visibilidad en el celular.** Aceptado por decisión de Rodrigo. Sigue en la portada y en la computadora.
- **Un básico puede quedar desactualizado** si cambia el primer resultado del buscador. El cache es de un día, y se recalcula con el índice.
- **La portada suma un pedido** cuando hay lista. Es en memoria y sin cuota.
