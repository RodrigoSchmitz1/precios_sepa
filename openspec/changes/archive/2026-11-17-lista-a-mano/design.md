# Design

## Context

- `MismoProductoPage` tiene la lista en un `useState(leerLista)`. La guarda con
  `guardarLista` en un efecto y define en el mismo componente `agregar` (sin
  repetidos, tope `MAXIMO_PRODUCTOS` = 50), `cambiarCantidad`, `quitar` y
  `enLista`.
- `TuLista` recibe la lista y los callbacks por props y toma la zona con
  `useZona`. `DeTuCanasta` recibe la lista y `onAgregar`.
- El encabezado (`Layout`) tiene el logo, `SelectorZona` y, desde `sm`, la nav.
  En el celular las secciones van en la barra inferior.
- La zona ya usa el mismo patrón: un contexto armado por `ProveedorZona` dentro
  del `Layout`.

## Goals / Non-Goals

**Goals:**
- Que la lista se vea y se abra desde cualquier página.
- Una sola fuente de verdad para la lista.
- No perder ninguna lista guardada.

**Non-Goals:**
- Cambiar la barra inferior del celular.
- Cuentas de usuario o una lista que siga a la persona entre dispositivos.
- Nuevas formas de agregar productos (desde Promos o Más barato). Hoy se agrega
  desde Mismo producto y desde "De tu canasta", y eso sigue igual.

## Decisions

### `ProveedorLista`, como `ProveedorZona`

- `contexto/lista.ts` define `EstadoLista`: `lista`, `agregar(p, cantidad?)`,
  `cambiarCantidad`, `quitar`, `vaciar` y `enLista`. También exporta
  `useLista()`.
- `components/ProveedorLista.tsx` lo implementa con `useState(leerLista)` y un
  efecto que guarda la lista. La lógica de agregar queda igual que hoy (sin
  repetidos y con tope de 50), en una función pura de `utils/lista.ts` para
  poder testearla.
- **Otras pestañas:** escucha el evento `storage` del navegador para la clave
  `changuito.lista.v1`. Cuando cambia en otra pestaña, vuelve a leer la lista.
  El efecto que guarda no dispara `storage` en la misma pestaña, así que no hay
  un ciclo.
- Va en `Layout`, adentro de `ProveedorZona`, para envolver el encabezado y las
  páginas.

### El acceso del encabezado

- Es un `NavLink` a `/lista`, a la derecha del encabezado:
  - en el celular, justo al lado de la zona;
  - en la computadora, antes de la nav.
- Lleva el ícono del changuito, la palabra "Lista" desde `sm` y un número en un
  círculo (`aria-label`: "Tu lista, 3 productos").
- Mide 40 px de alto como mínimo, y no se esconde con la lista vacía: el
  objetivo es que se descubra.
- **Ancho en el celular:** el encabezado a 414 px ya lleva el logo, "Changuito"
  y la zona truncada. El acceso ocupa unos 44 px, y la zona se trunca un poco
  más. Se verifica a 375 px con el detector de desbordes.

### La página `/lista`

`ListaPage` muestra:
- `Titular` compacto, "Tu lista";
- `TuLista` con los callbacks del contexto;
- `onVer`, que lleva a `/mismo-producto?p=<id>`.

Sin productos, muestra un estado vacío: un párrafo, el buscador (el mismo
formulario que la portada, que lleva a `/mismo-producto?q=`) y un link a Tu
canasta, de donde salen las sugerencias de "De tu canasta".

### Mismo producto

Deja su estado y usa `useLista()`. `TuLista` y `DeTuCanasta` siguen
recibiendo lo mismo por props, ahora desde el contexto. El comportamiento no
cambia.

## Risks / Trade-offs

- **Dos lugares muestran la lista,** Mismo producto y `/lista`. Es a propósito:
  en Mismo producto se arma y en `/lista` se consulta. Si con el tiempo sobra
  uno, se saca.
- **Un encabezado más cargado en el celular.** Se mide con el barrido. Si no
  entra a 375 px, la palabra "Lista" queda solo desde `sm`, que ya es el plan.
