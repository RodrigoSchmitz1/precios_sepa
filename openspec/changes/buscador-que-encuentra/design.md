# Design

## Context

- `armar_indice` arma el texto `_texto` de cada producto: descripción, marca,
  tamaños buscables y `textos_busqueda`. `textos_busqueda` junta los nombres que
  le da cada cadena, hasta 1500 caracteres.
- `normalizar` pasa a minúsculas, saca las tildes y pega el tamaño ("1 kg" queda
  "1kg").
- `buscar` exige que cada palabra buscada esté contenida en `_texto` y ordena
  por `(-cadenas, descripcion)`. Devuelve hasta `limite` resúmenes (20 por
  defecto, como mucho 50).
- La categoría la asigna dbt (53 o más categorías: "Leche fluida", "Huevos",
  "Pan", "Azucar"…) y ya viaja en el índice.

## Goals / Non-Goals

**Goals:**
- Que las 5 búsquedas fallidas del Why devuelvan primero lo que se buscó.
- Que las búsquedas que ya andaban sigan devolviendo lo mismo arriba.
- Mantener el costo en cero y la forma de la respuesta.

**Non-Goals:**
- Corregir errores de tipeo arbitrarios con distancia de edición. Agrega
  falsos positivos y es más lento. Se cubren solo los errores fonéticos del
  castellano.
- Sinónimos ("gaseosa" por "coca"), o buscar por categoría sin palabra.
- La pantalla de resultados: el hero que los tapa y las filas que no dicen
  dónde está más barato. Eso es otro change del explore.
- Cambiar las categorías de dbt. Que Actimel esté en "Leche fluida" es un tema
  de clasificación, aparte de este.

## Decisions

### Palabras con prefijo

**Decisión:** se parte el texto en palabras con
`re.findall(r"[a-z0-9]+(?:[.,][0-9]+)?[a-z]*", texto)`. Así "1.5l" y "1,5l"
quedan como una sola palabra. Cada palabra buscada tiene que ser el comienzo de
alguna palabra del producto.

**Por qué:**
- El prefijo deja que "gall", "yerb" o "desc" sigan encontrando lo que buscaban
  mientras se tipea.
- Exigir el comienzo de la palabra saca "empanada" de "pan".

**Alternativa descartada:** pedir la palabra entera. Rompe "gall" y "desc", que
la gente sí tipea.

**Plural:** si la palabra buscada tiene más de 3 letras y termina en "s", se
prueba también sin la "s" ("huevos" encuentra "huevo"). Si termina en "es", se
prueba también sin "es" ("panes" encuentra "pan").

### Normalización fonética

**Decisión:** una función `fonetizar` se aplica después de `normalizar`, al
texto del producto y a la búsqueda por igual:
- v → b
- z → s
- c antes de e o i → s
- ll → y
- h → se borra, salvo en ch

**Por qué:** cubre los errores más comunes del castellano rioplatense ("yerva",
"aseite", "harina"/"arina") sin distancia de edición. Como se aplica de los dos
lados, una búsqueda escrita bien encuentra lo mismo que antes.

**Riesgo:** puede juntar palabras distintas, como "casa" y "caza" o "vaso" y
"bazo". En un catálogo de supermercado esos choques son raros, y el orden por
categoría los manda abajo.

### Orden por relevancia

**Decisión:** la clave de orden es
`(no_coincide_categoria, no_esta_en_la_descripcion_visible, no_las_tiene_enteras, -cadenas, len(descripcion), descripcion)`.

Corregido al implementar: la categoría coincide por palabra **entera**, no por
prefijo, y se suma el nivel de palabras enteras. Con prefijo, "pan" coincidía
con la categoría Panales: "pañal" sin tilde empieza con "pan". Sacar el pañal
del todo haría que "panales" dejara de encontrar pañales, así que queda en la
lista, pero después de todo lo que dice "pan" entero.

- **Coincide la categoría:** alguna palabra buscada es una palabra entera de la
  categoría, con su plural de cualquiera de los dos lados, y con la misma
  fonética.
  "leche" coincide con "Leche fluida" y "Leche en polvo". "huevos" coincide con
  "Huevos".
- **Está en la descripción visible:** todas las palabras buscadas están en la
  descripción y la marca que muestra la página, no solo en el nombre que le da
  otra cadena. Así Actimel, que en "Leche fluida" coincide por la categoría y
  por el nombre de otra cadena, queda después de las leches que dicen "LECHE".
- **Descripción más corta:** a igualdad, "LECHE ENTERA 1L" va antes que una
  descripción larga con muchas variantes.

**Alternativa descartada:** un puntaje con pesos, tipo TF-IDF. Es más difícil
de explicar y de testear. El orden por niveles se puede predecir y escribir
como spec.

### Precálculo en el índice

En `armar_indice` se guardan, por producto:
- `_palabras`: el conjunto de palabras fonetizadas del texto completo.
- `_palabras_visibles`: el conjunto de palabras de la descripción y la marca.
- `_palabras_categoria`: el conjunto de palabras de la categoría.

`buscar` recorre los productos igual que hoy, pero compara prefijos contra
conjuntos ya armados. El índice se arma una vez por instancia, así que el costo
extra es de memoria: unos pocos MB.

Se mantiene `_texto`, porque otras funciones lo pueden usar. Si nadie lo usa,
se quita.

## Risks / Trade-offs

- **Velocidad:** recorrer cada palabra de cada producto por cada búsqueda sería
  lento con el índice real. Por eso se arma un vocabulario ordenado por índice
  (palabra → productos) y el prefijo se busca con bisect. El orden solo mira los
  candidatos. Se mide con el índice real en la tarea 2.2.
- **Búsquedas que ya andaban:** el test con las 20 búsquedas fija que fideos,
  café, detergente, fernet, pañales y coca sigan devolviendo su categoría
  arriba.
- **Una sola letra o un número suelto ("1", "5")** puede coincidir con muchas
  palabras. Ya pasa hoy. La API exige al menos 2 caracteres.
