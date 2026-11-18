# Design

## Context

- **Las filas del detalle:** `MismoProductoPage.tsx` pinta una fila por bandera con `FilasDePrecios`, que recibe `PrecioEnCadena[]`. Con zona, `ListaDePrecios` separa dos grupos: las de la zona y "Otras cadenas del país".
- **Los nombres:** `nombrarCadenas(lista)` y `nombrarLista(nombres)` arman "X" o "X y N más". Se usan en el titular (`TextoTitular`), en los extremos de `FilaDeCifras`, en "En todo el país, de $ X en … a $ Y en …" y en los ejemplos de la portada de la sección.
- **Qué banderas son de qué empresa:** la API lo sabe por `mapeo_cadenas`, pero el detalle no trae la empresa por fila. Igual, cuáles banderas la gente percibe como formatos de una misma cadena es una decisión de producto, no un dato: Maxi es de Carrefour y no se agrupa.

## Goals / Non-Goals

**Goals:**
- Menos filas repetidas sin esconder ninguna diferencia de precio.
- Titulares que nombren las cadenas.

**Non-Goals:**
- Agrupar en rankings y totales (Tu lista, Más barato, Tu canasta).
- Cambiar qué cadenas tiene una zona.

## Decisions

### 1. Un mapa explícito de formatos en un solo lugar
`utils/formatosDeCadena.ts`:
- **`FORMATO_DE`:** dice de qué cadena es cada formato. "Carrefour", "Market (Carrefour)" y "Express (Carrefour)" son de "Carrefour", y "Changomas", "SuperChangomas" e "HiperChangomas" son de "Changomas". Usa los nombres crudos de la API y los visibles que devuelve `nombreCadena`, porque el detalle trae los visibles.
- **Maxi, Vea, Disco y Jumbo no están,** a propósito y con un comentario que dice por qué, con los números medidos.

### 2. Se agrupa por cadena, precio exacto y si es creíble
`agruparFormatos(precios)` devuelve filas con estos datos:
- `cadenas`: los nombres, en el orden en que llegan
- `precio_mediano`, `precio_minimo`, `precio_maximo`, `precio_creible` y `fecha_precio` del grupo
- `sucursales`: la suma de sus sucursales

**La clave** es formato, precio redondeado a centavos, si es creíble y `fecha_precio`. Un precio arrastrado de otro día no se agrupa con uno del día.

**El rango** de mínimo y máximo es el de todo el grupo: el menor mínimo y el mayor máximo.

**El cambio de precio** (historia-de-precio) va solo si es el mismo en todas las banderas del grupo. Si difiere, la fila no lo muestra: no hay una frase honesta para "bajó en una de las dos".

`FilasDePrecios` pinta una fila por grupo, con el nombre "Changomás · HiperChangomás". La `key` es la unión de los nombres.

### 3. Nombrar: hasta tres, y los formatos juntos
`nombrarCadenas(nombres)`:
1. Junta en un nombre los formatos de una misma cadena que vienen en la lista: "Changomás · HiperChangomás".
2. Con hasta tres nombres, los lista con `listarConY`.
3. Con más de tres, nombra tres y agrega "y N más".

Reemplaza a las dos funciones locales de la página.

**En el titular**, las listas ya llegan con las cadenas de un precio, así que el agrupado se aplica sobre esa lista.

## Risks / Trade-offs

- **Titulares más largos** ("Coto, Día y Vea"). Mitigación: el titular compacto ya parte en líneas; se mide en el E2E a 375 px.
- **El nombre de dos formatos con " · "** se parece al separador de la segunda línea. Aceptado: en el nombre de la fila no hay otro " · ".
- **Si la API cambia un nombre de bandera,** el mapa deja de agrupar. Falla hacia "una fila por bandera", que es lo de hoy. Un test fija los nombres actuales.
