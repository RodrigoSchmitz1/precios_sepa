# Design

## Context

- `Titular` es una banda a sangre (`fondo-marca`) con antetítulo, h1 de 4xl a
  3.5rem y bajada. Lo usan 7 páginas.
- En Mismo producto aparece en dos lugares: en la portada de la sección (sin
  producto elegido) y en `VistaProducto` (con producto elegido).
- Con zona, `VistaProducto` muestra:
  - el titular nacional;
  - `ResumenDeZona`, un recuadro verde que usa `resumirZona`;
  - `FilaDeCifras` con los extremos nacionales;
  - `ListaDePrecios`, que ya separa la zona del resto del país.
- `resumirZona` (`utils/precioEnZona.ts`) devuelve `ninguna`, `una` o `varias`
  (baratas, caras, precio, precioCaro, ahorroPct). Solo usa precios creíbles.

## Goals / Non-Goals

**Goals:**
- Que en el celular el primer resultado de una búsqueda, el detalle y la lista
  queden arriba de los 320 px.
- Que el detalle con zona diga lo mismo en el titular, las tarjetas y la lista.
- Que una diferencia chica no se presente como noticia.

**Non-Goals:**
- La portada del sitio con zona. Va en otro change.
- Los titulares de las otras secciones (Más barato, Tu canasta, Inflación,
  Promos). Ahí el titular ya es la respuesta.
- Cambiar la API.

## Decisions

### `Titular` con `compacto`

- **Decisión:** se agrega la prop `compacto?: boolean` a `Titular`. En la
  versión compacta:
  - el padding es `pt-5 pb-6` en lugar de `pt-10 pb-12`;
  - el h1 va de `text-2xl` a `sm:text-3xl`;
  - no hay bajada;
  - los círculos decorativos se mantienen.
  
  Las demás páginas no pasan la prop y no cambian.
- **Alternativa descartada:** sacar el titular cuando hay resultados. Se pierde
  el lugar de la sección y la marca, y saltaría el diseño al empezar a tipear.

### Cuándo se achica

- **Portada de la sección:** se achica con `consulta.length >= 2` o con
  `lista.length > 0`. Una lista guardada es lo que la persona vino a ver al
  volver.
- **Detalle:** siempre compacto, porque el producto elegido es el resultado. La
  información de la bajada (código de barras, fecha, aviso de precio poco
  respaldado) baja a una línea chica debajo de las tarjetas, sin perderse.
- **El titular sigue diciendo lo mismo, más chico.** En la portada, "El mismo
  producto puede costar 154% más…". En el detalle, el titular del producto.

### El titular del producto sale de una función pura

`titularDelProducto(p, cadenasZona | null)` en `utils/titularProducto.ts`
devuelve un objeto con:
- `alcance`: `zona` o `pais`;
- `tipo`: `igual`, `casi_igual`, `diferencia`, `sin_respaldo`, `una_cadena`,
  `no_en_zona` o `sin_creible_en_zona`;
- las cadenas y los precios que hagan falta;
- las cifras de las tarjetas.

La página solo traduce eso a JSX. Así cada caso se puede testear sin montar la
página.

| Caso | Titular |
|---|---|
| Zona, varias con diferencia ≥ 5% | "En tu zona, {barata} lo tiene a $A: un X% menos que {cara}" |
| Zona, diferencia < 5% | "En tu zona cuesta casi lo mismo: de $A en {barata} a $B en {cara}" |
| Zona, todas igual | "En tu zona sale $A en todas las cadenas" |
| Zona, una cadena | "En tu zona solo lo vende {cadena}, a $A" |
| Zona, ninguna lo vende | "{nombre}: en tu zona no se consigue" (tarjetas del país) |
| Zona, solo precios no creíbles | "{nombre}: en tu zona el precio puede estar mal cargado" (tarjetas del país) |
| País, diferencia ≥ 5% y respaldada | como hoy: "{nombre}: X% más caro en {caras} que en {baratas}" |
| País, diferencia < 5% | "{nombre}: cuesta casi lo mismo en las N cadenas ($D de diferencia)" |
| País, sin respaldo | como hoy: "de $A a $B según la cadena" |
| País, todas igual | como hoy |

El nombre del producto siempre va en el titular o en el antetítulo, para que
no se pierda de qué producto se habla.

### Umbral del 5%

- **Decisión:** "casi lo mismo" es una diferencia menor al 5% entre la más
  barata y la más cara.
- **Por qué:** coincide con el escalón de las reglas de precios medidas el
  27-10 (Maxi 5% debajo de Carrefour). También con la variación de una cadena
  entre provincias (±2-4%): debajo de eso, la diferencia está en el ruido de la
  mediana.
- **Dónde queda:** como una constante con nombre en `titularProducto.ts`,
  documentada en DECISIONES.

### Corregido al implementar

- **La tira también es de la zona.** La tira de puntos nombraba los extremos del
  país (Vea, La Anónima) justo debajo del titular de zona, y era la misma
  contradicción en otro formato. Con zona, solo dibuja las cadenas de la zona.
- **El rango del país va abajo, no en la bajada.** El detalle es siempre
  compacto y no tiene bajada, así que va en la línea chica de debajo de las
  tarjetas.
- **"← Todos los productos" estaba tapado.** La banda sube 40 px (`-mt-10`) y
  quedaba encima del botón: en producción, en el centro del botón había un
  círculo decorativo de la banda. Ahora el botón va debajo de la banda.

### El recuadro verde se va

`ResumenDeZona` desaparece y su contenido pasa al titular. La lista sigue
diciendo "En tu zona · {nombre}" arriba de las cadenas de la zona, y el
encabezado ya muestra la zona elegida.

## Risks / Trade-offs

- **El titular compacto pierde impacto visual** en la portada de la sección
  cuando hay una lista. Es a propósito: quien vuelve viene a la lista.
- **Tarjetas de zona con una sola cadena:** "Más caro" no tiene sentido. Con
  una sola cadena, las tarjetas muestran solo el precio y la cantidad de
  cadenas del país.
- **Altura real en iPhone:** se verifica en WebKit, que no es un iPhone. El
  límite de 320 px deja margen para el teclado.
