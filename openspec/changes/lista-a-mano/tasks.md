# Tasks

## 1. Estado compartido

- [x] 1.1 Función pura `agregarALista(lista, item)` en `utils/lista.ts` (sin repetidos, tope de 50), con tests.
- [x] 1.2 `contexto/lista.ts` (`EstadoLista`, `useLista`) y `components/ProveedorLista.tsx`: estado, guardado con la misma clave y escucha del evento `storage` de otras pestañas.
- [x] 1.3 `ProveedorLista` en `Layout`. `MismoProductoPage` deja su `useState` de la lista y usa `useLista`.

## 2. Acceso y página

- [x] 2.1 Acceso a `/lista` en el encabezado: changuito, "Lista" desde `sm`, número en un círculo, `aria-label` con la cantidad y al menos 40 px de alto.
- [x] 2.2 `pages/ListaPage.tsx` en la ruta `/lista`: titular compacto, `TuLista` y estado vacío con buscador y link a Tu canasta.
- [x] 2.3 Correr los tests del frontend, el lint y el build.

## 3. Verificación

- [x] 3.1 En WebKit a 414x896, contra la API local:
  - una lista guardada antes del cambio se ve igual y el encabezado muestra su número;
  - "+ Lista" en Mismo producto sube el número;
  - el acceso lleva a `/lista` con la comparación de la zona;
  - `/lista` vacía muestra el buscador;
  - un cambio en una pestaña se ve en la otra.
- [x] 3.2 Barrido de las 6 páginas y `/lista` a 414 y 375 px, sin desbordes ni errores, con zona y sin zona.
- [x] 3.3 Anotar en `docs/DECISIONES.md` la lista a mano.
