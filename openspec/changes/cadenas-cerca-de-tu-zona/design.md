# Design

## Context

- **De dónde salen las zonas:** `/zonas` sale de `mapa_promos.lugares(indice, con_cadenas=True)`.
  - Agrupa las sucursales del índice del mapa (unas 2.500) por barrio o localidad.
  - El centro de cada lugar es la mediana de sus sucursales.
  - Sus cadenas son las de esas sucursales.
  - Se recalcula en cada pedido a `/zonas`.
- **Quién usa `zona.cadenas` en el frontend:**
  - Más barato: `obtenerQuienGanaZona(zona.cadenas)`, y "una sola cadena" si hay menos de 2.
  - La portada, en `cifrasPortada` y `Presentacion`.
  - Mismo producto y Tu lista, con `cadenasVisibles` y el bloque `zona` de la lista.
  - El selector de zona, que muestra cuántas.
- **Cambiar la lista en `/zonas` cambia todas a la vez.** Esa es la idea: una regla en un solo lugar.
- **Las promos cercanas** ya usan `RADIO_PROMOS_KM = 3` desde el centro de la zona (`promos_de_productos`).
- **El ranking nacional de la canasta** (`/canasta-personalizada/por-cadena` sin localidades) ya lo pide la portada. Trae el total de cada cadena que vende al menos el 80% de la canasta. La Cooperativa Obrera y Vea quedan afuera.

## Goals / Non-Goals

**Goals:**
- Que "una sola cadena" solo se diga donde es cierto.
- Que quien de verdad no tiene opciones vea lo que eso le cuesta, con un dato medido y sin prometerle un ahorro que no tiene a mano.
- Que el radio sea el mismo para las promos y para las cadenas de la zona.

**Non-Goals:**
- Que Tu canasta cotice por radio en vez de por localidad.
- Que la portada calcule el ahorro de la zona restringiendo el ranking nacional a las cadenas cercanas.

## Decisions

### 1. Una constante de radio para lo cercano
`RADIO_PROMOS_KM` pasa a llamarse `RADIO_CERCA_KM = 3` y lo usan las promos y las zonas. Se deja el nombre viejo como alias para no romper importaciones, y con un comentario.

**Por qué 3 km:**
- Es lo que ya usan las promos, así que la misma zona dice "cerca" en un solo sentido.
- Con 5 km, las zonas de una cadena quedaban en 176, casi igual que con 3 (186). Con 3 se agregan menos cadenas lejanas en el conurbano denso.

### 2. Las cadenas cercanas se calculan con un filtro por latitud
Para cada lugar se suman las cadenas de las sucursales a menos de 3 km de su centro.
- **El costo directo** sería 559 × 2.500 distancias en cada pedido.
- **Cómo se evita:**
  - Las sucursales se ordenan por latitud, y por lugar se miran solo las que están en una franja de ±0,03° (unos 3,3 km).
  - El resultado se guarda junto con el índice del mapa (`functools.lru_cache` por identidad del índice, o un atributo calculado una vez), así `/zonas` no lo recalcula en cada pedido.
- **Se mide** el tiempo de armar `/zonas` antes y después.

### 3. `otra_cadena_cerca` solo en las zonas de una cadena
Si después del radio la zona tiene una sola cadena, `/zonas` le agrega `otra_cadena_cerca: {cadena, km}`, con la sucursal más cercana de otra cadena y el km redondeado a entero. Las demás zonas no llevan el campo, para no agrandar la respuesta.

**Se cuentan cadenas (banderas), no empresas,** igual que hoy "cadenas" en todo el sitio: Express y Carrefour son formatos con precios distintos.

### 4. La tarjeta de la portada
`cifrasDePortada` recibe la zona entera, o `otraCadenaCerca` además de las cadenas.

**Con una sola cadena:**
- **Tarjeta 1:** "Tu única cadena cerca", con la cadena, y el detalle "la otra más cercana está a 50 km", o "SEPA no informa otra cadena cerca" si no hay dato.
- **Tarjeta 3:** sigue "La canasta básica en La Anónima: $ X".
  - Si el ranking nacional tiene a esa cadena y a una más barata, el detalle suma "en Maxi (Carrefour), la más barata del país, sale 14% menos".
  - El porcentaje se calcula con `porcentajeEntero` sobre el mismo ranking nacional que la portada ya tiene en memoria.
  - Se presenta como un costo y no como un "ahorrás": no hay una Maxi a mano.
  - Sin total nacional para esa cadena, no hay comparación.

**El texto vive en `cifrasPortada.ts`, con tests.**

### 5. Textos que nombran la cantidad
- **El selector:** "N cadenas cerca", o "1 cadena cerca".
- **Más barato con una sola cadena:** "Cerca de tu zona (Rafaela, Santa Fe) hay una sola cadena, La Anónima: …".

## Risks / Trade-offs

- **Comparaciones nuevas en las zonas con más cadenas:** van a mostrar cadenas que la persona puede no usar. Una Coto a 2,8 km del otro lado de la autopista cuenta.
  - Aceptado: es el mismo criterio que las promos, y lo que dice el sitio pasa a ser "cerca", no "en tu barrio".
- **Cambian los números en producción,** que los usuarios ya vieron: el líder de Más barato de la zona, el titular de Mismo producto con zona, Tu lista. Se documenta en DECISIONES con ejemplos antes y después.
- **Tu canasta sigue por localidad.** En Villa Soldati, el paso 3 puede seguir comparando el país, rotulado como tal, mientras el resto del sitio compara las cadenas cercanas. Queda anotado como siguiente paso posible.
- **El centro de la zona es la mediana de sus sucursales.** En una localidad extensa, 3 km desde el centro puede no cubrir los bordes. Es el mismo criterio que las promos.
