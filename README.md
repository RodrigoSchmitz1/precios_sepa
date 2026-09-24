# Changuito

Precios reales de supermercados argentinos, con datos oficiales del programa
SEPA (Secretaría de Comercio). Pipeline diario que ingiere ~14 millones de
precios por día, los transforma con dbt sobre BigQuery y los publica en una
aplicación web.

### 🔗 [precios-sepa-api-803135877045.us-central1.run.app](https://precios-sepa-api-803135877045.us-central1.run.app)

---

## Qué muestra

| Sección | Qué responde |
|---|---|
| **Promos vigentes** | Qué descuentos hay hoy cerca mío, sobre un mapa, con cada promo calificada según la evidencia que la respalda y filtros por rubro |
| **Canasta básica** | Cuánto cuesta la canasta alimentaria en cada localidad |
| **Tu canasta** | Describís en lenguaje natural qué consumís, una IA arma tu canasta y se cotiza con precios reales. También se puede partir de la canasta básica del INDEC para tu hogar o elegir las categorías a mano |
| **Supermercado más barato** | Qué cadena tiene el precio más bajo, comparando productos idénticos, categoría por categoría |
| **El mismo producto** | Cuánto cuesta el mismo código de barras en cada cadena, y cuánta diferencia hay, sin contar los precios que contradicen al resto del mercado |
| **Inflación** | Ranking de todas las categorías por variación de precio, con apertura por cadena |

---

## Arquitectura

```
Portal SEPA ──> Ingesta local ──> BigQuery ──> dbt ──> FastAPI + React
 (datos.gob)     (Python)          (crudo)    (27 modelos)   (Cloud Run)
                     │                             │
              Task Scheduler                GitHub Actions
                 07:00 ART                    08:37 ART*
```

\* Programado a esa hora; GitHub no garantiza el horario de los cron y hasta
septiembre de 2026 arrancaba entre 3 y 6 horas tarde. Ver el comentario en
`.github/workflows/pipeline_diario.yml`.

**La descarga corre en una máquina local y no en la nube, y no es un descuido.**
El portal `datos.produccion.gob.ar` responde 403 a los rangos de IP de
datacenter: se verificó empíricamente contra GitHub Actions y Google Colab,
mientras que una conexión doméstica recibe 200. No es un problema de
User-Agent. Todo lo demás (transformación, categorización, API) sólo habla con
BigQuery y Gemini, así que corre en la nube sin restricciones.

Se descartó montar un relay por proxy residencial para saltear el bloqueo: es
eludir deliberadamente un control que el portal puso a propósito.

---

## Las decisiones que importan

Este dato tiene trampas que no se ven hasta que uno mira el número y se pregunta
si puede ser cierto. Estas son las principales y cómo se resolvieron.

### Comparar cosas que no son comparables

El error recurrente, en siete formas distintas:

- **La canasta básica** sumaba las categorías que cada localidad tuviera, entre
  20 y 32, y comparaba esos totales entre sí. Una localidad con menos datos
  parecía más barata: la mediana era $177.419 con 20 categorías contra $388.726
  con 30. El ranking medía cuántas categorías faltaban, no precios. Hoy sólo
  entran las localidades con la canasta **completa**, y un test lo garantiza.

- **"Supermercado más barato"** dividía las victorias de cada cadena por *todos*
  los productos comparables de la categoría, no por los que esa cadena
  efectivamente vende. Una cadena que ofrece 20 de 148 no podía pasar de 13,5%
  por barata que fuera. Al corregir el denominador, el líder cambia en 22 de 58
  categorías.

- **La inflación** restaba el nivel de precios de dos fechas. Como ese nivel es
  la mediana de los productos que hubiera ese día, la resta mezclaba cambios de
  precio con cambios de surtido: "Bazar y hogar" en Disco daba +75,76% sin que
  ningún precio se hubiera movido. Se reemplazó por un **índice encadenado sobre
  muestra pareada** (ver abajo).

- **La gama** (económico / medio / premium) ordenaba por el precio del *envase*,
  así que donde los tamaños varían ordenaba por tamaño: la bolsa grande, que es
  la más barata por kilo, caía en "premium". En 4 de 47 categorías el
  "económico" salía **más caro por unidad** que el "premium". Como la canasta
  filtra por económico, el sesgo llegaba al número publicado.

- **Un mismo producto venía en dos unidades.** Al reconocer `EA` ("each"), el
  mismo producto pasó a llegar como "380 GR" en una cadena y como "1 EA" en
  otra: el 13,3% de los productos, que son el 50,2% de las filas. La gama
  tomaba una unidad cualquiera y dividía el precio por una mediana de
  cantidades que mezclaba gramos con conteos, así que unas milanesas quedaban
  "económicas" y entraban a la canasta como pollo a $20.566/kg. Lo publicado:
  el pollo más caro que la carne y la canasta 34% más cara de lo real (mediana
  de $371.128 contra $245.352). Ningún test fallaba, porque cada tabla era
  consistente por separado: el error estaba en cómo se unían. Hoy la gama
  tiene grano producto × unidad, y un test compara la canasta económica contra
  la gama media; contra las tablas viejas fallaba en 6 de 32 categorías. Las
  fechas ya publicadas se recalcularon con una variable de dbt, sin borrar
  filas del histórico a mano.

- **"Carne vacuna" no era carne vacuna.** La taxonomía no tenía categoría para
  el cerdo y la clasificación lo mandaba ahí, junto con achuras, cordero y
  milanesas; "Pollo" mezclaba presas con nuggets y patitas rebozadas. La canasta
  comparaba una carne abaratada contra un pollo encarecido: el pollo salía
  $11.500/kg y la carne $8.390. Se agregaron Cerdo, Otras carnes, Achuras y
  menudencias y Elaborados de carne, y se reclasificaron los 3.098 productos del
  rubro con reglas explícitas para cada confusión que apareció (una "picada" no
  es carne picada; una "milanesa de nalga" sin rebozar es un corte crudo). La
  clasificación quedó versionada: se agregan filas en vez de pisar las
  anteriores. Hoy el pollo económico cuesta $3.979/kg y la carne $9.990.

- **"Aceite medio" era aceite de oliva.** La gama corta en tercios, por precio
  por kilo, todos los productos de la categoría. Si la categoría mezcla
  productos distintos, "medio" no es una marca intermedia sino otro producto:
  Tu canasta cotizaba el aceite a $31.194/L (todo el girasol quedaba en
  "económico"), la papa a $10.493/kg (papas congeladas) y la harina con
  rebozadores y premezclas. 21 categorías tenían el "medio" a 3 veces o más del
  "económico". Se agregaron siete categorías (aceite de oliva y especiales,
  verduras y papas procesadas, edulcorantes, premezclas, rebozadores, pastas
  frescas y comidas preparadas) y se volvieron a clasificar 11.389 productos en
  dos pasadas. El aceite medio pasó a $4.914/L, la papa a $2.990/kg y la
  harina a $2.028/kg. La canasta básica, que usa la gama económica, bajó 10,6%
  sobre las mismas localidades (1,7 puntos por las carnes, ver más abajo; el
  resto porque el tercio económico tampoco estaba limpio). La serie histórica
  marca ese salto entre el 22 y el 23 de septiembre. La cobertura bajó de 88 a
  68 localidades, y volvió a 87 al subir el tope de categorías con precio
  provincial (ver "Cuando falta el dato").

### El índice de precios

Medir inflación restando promedios es incorrecto cuando el surtido cambia. El
modelo calcula, para cada día, un factor contra la fecha anterior usando **sólo
los productos presentes en ambas**, y la variación de un período se obtiene
encadenando esos factores. La API exige la cadena completa: si a una serie le
falta un eslabón no se muestra, en vez de multiplicar salteando el hueco.

El estimador es la **media geométrica de los relativos** (índice de Jevons). El
primer intento usó la mediana y estaba mal: los cambios de precio son
esporádicos —el 97,9% de los productos no cambia de un día al otro— así que la
mediana de los relativos vale 1,0 por construcción y daba 0,00% en 563 de 564
series. Con Jevons pasan a 201 series con variación real.

Ese mismo 97,9% define cómo se presenta. La primera versión de la página abría
con un selector de categoría y mostraba sus 14 cadenas: como casi nada se mueve
de un día al otro, cualquier categoría que uno eligiera daba una pantalla de
ceros y encontrar la que sí se había movido era recorrer más de 50 a mano. La página
ahora abre con **el ranking completo del mercado** —una categoría es la media
geométrica de los factores de todas sus series— y la apertura por cadena es el
segundo click. Sólo entran las categorías cubiertas por al menos 3 cadenas: con
una sola, el número no es el mercado, es un supermercado.

### Destacar sin inventar un umbral

Mostrar "la mayor diferencia del día" es una invitación a publicar un error de
carga. El primer intento, con las promos, fue un tope arbitrario: descartar todo
descuento mayor al 70%. Funcionaba, pero no había forma de defender el número.

El criterio que lo reemplazó es pedir **respaldo**, no fijar un techo:

- El precio de una cadena es la **mediana entre sus sucursales**, y una
  diferencia sólo se destaca si los dos extremos vienen de **3 sucursales o
  más**. Con tres, una sucursal con el precio mal cargado no puede mover la
  mediana; con dos, sí. Las demás se muestran igual, pero sin destacarse y
  diciendo sobre cuántas sucursales se calcularon.
- Se piden **3 empresas distintas**, no 3 cadenas. Carrefour tiene cuatro
  banderas (Hiper, Market, Express y Maxi) y Cencosud otras tantas: contar
  banderas hacía pasar por "está en todo el mercado" a un producto que vende una
  sola empresa, y podía titular comparando Maxi contra Express.
- En el mapa de categorías × cadenas, la celda vacía significa **"no llega a 20
  productos comparables"**, que no es lo mismo que ganar 0%. Pintarlas igual
  sería afirmar algo que el dato no dice.

### Datos que se pierden en silencio

Lo más peligroso no es el dato que rompe la corrida, sino el que desaparece sin
avisar:

- El mapeo de unidades de la fuente no contemplaba `EA` (el código GS1 de
  "each"), que cubre el **16,4% del catálogo**. Como todo lo que necesita
  cantidad descarta las filas sin unidad, ese 18% quedaba fuera de la gama, la
  canasta y el índice **sin que nada fallara**.
- La composición de la canasta declaraba `Leche fluida` en gramos, siendo un
  líquido que se normaliza a `cc`: el join por unidad nunca matcheaba y **la
  leche no entraba en la canasta**, siendo uno de los ítems de mayor peso.

- La ingesta local dejó de correr cinco días y **nada avisó**. Había un test
  escrito para eso, pero comparaba los históricos contra la última fecha de los
  marts: cuando la ingesta se detiene los marts tampoco avanzan, así que la
  referencia envejecía junto con ellos y la comparación seguía dando bien.
  Encima el backfill cargaba las fechas viejas e imprimía `Cargadas`, mientras
  BigQuery las expiraba en menos de un minuto por la retención de 3 días. Se
  perdieron tres días de historia **con el pipeline en verde y reportando
  éxito**.

Los tres casos tienen ahora un test que falla si vuelven a aparecer. El último,
además, cambió la ingesta: ahora abre la retención de particiones antes de un
backfill, la vuelve a cerrar cuando ya no hace falta, y verifica que lo que
cargó siga existiendo en vez de darlo por hecho.

### Cuando falta el dato

Al depurar las carnes quedaron pocos productos económicos de pollo y pescado, y
esos frescos se venden en pocas sucursales: con precio estrictamente local sólo
16 localidades completaban la canasta, una de CABA. Se midieron tres salidas
sobre los datos del 2026-09-09:

- Ampliar a gama económica + media: 92 localidades, pero la canasta pasa a
  $374.172 porque deja de ser la económica.
- Tomar el tercio más barato de cada localidad: 72, pero el recorte de extremos
  saca los pollos enteros y el pollo vuelve a salir más caro que la carne.
- **Mantener la gama económica y usar la mediana provincial en hasta 2 de las
  32 categorías: 96 localidades, mitad CABA y mitad interior, con una mediana
  de $238.866.**

Se eligió la última, como hacen los índices oficiales con los precios
faltantes, con un tope de 2: se temía que con más precios provinciales la
canasta dejara de describir a su localidad. Cada categoría imputada va marcada
en el desglose del sitio.

Ese temor se midió el 2026-09-24, cuando las categorías nuevas bajaron la
cobertura de 88 a 68 localidades. En las localidades que sí tienen precio
local, se lo reemplazó por el provincial: imputar una categoría mueve la
canasta 0,0% en la mediana y como mucho 1,9% (la papa fuera de CABA), y aceite,
azúcar, pollo y leche juntos, 0,7%. Las mismas cadenas cobran lo mismo en toda
la provincia. El tope pasó a 4: 87 localidades, con la mediana igual ($216.780
con 2, $216.942 con 4).

La misma escasez decidió qué hacer con las menudencias. El INDEC incluye 270 g
de hígado, y al contrastar la composición contra su tabla por región (el
2026-09-24) apareció otro error: las carnes estaban repartidas en tercios
iguales, 2.090 g de vacuna, pollo y pescado, cuando el INDEC da 4.440, 1.650 y
180. Se corrigió el reparto, pero el hígado quedó afuera: se compra sobre todo
en carnicerías, que SEPA no cubre, y en los supermercados es un producto
puntual (23 de 88 localidades no tenían precio local). Es el 0,2% del costo.

### Ruido de la fuente

- **SEPA mezcla importes de cuota en la columna de promoción.** La portada
  mostraba colchones con "98,8% OFF". Los valores de promo son un diccionario
  chico de números redondos reusados entre productos de precio muy distinto, y
  para el más barato de cada grupo el valor es exactamente `lista/10`: las
  clásicas 10 cuotas sin interés. Un techo fijo de descuento las frenaba, pero
  dejaba la lista llena de promos clavadas en ese techo: de 200, 79 tenían
  exactamente 70% y 186 no eran alimentos. Ahora cada promo entra según la
  evidencia que la respalda —que la cadena declare el porcentaje, que el precio
  se sostenga contra otras empresas, o un techo más bajo si no hay ninguna de
  las dos— y la página dice cuál de las tres es.
- **Hay provincias enteras disfrazadas de localidad.** "BUENOS AIRES" agrupaba
  425 sucursales repartidas en 555 km. Se excluyen por dispersión geográfica y
  no por lista de nombres: una localidad real es compacta.
- **La misma ciudad venía escrita de dos formas** ("Salta" y "SALTA"), lo que la
  partía en dos y le daba la mitad de las muestras a cada una.
- **Una cadena entera puede informar mal un precio.** FANTA Zero 1,75 L figuraba
  a $309 en HiperChangomás (31 sucursales) y $369 en Changomás (53), mientras
  SuperChangomás —la misma empresa— y las otras diez cadenas la informaban entre
  $4.939 y $5.190. "El mismo producto" lo publicaba como 1.579% de diferencia, y
  revisados los 12 destacados de ese día, **los 12 eran errores de la fuente**.
  Las guardas que había miraban la coherencia de cada cadena consigo misma, que
  es justo lo que este error no rompe: los $309 salían de 31 sucursales. Ahora
  cada precio se contrasta contra la mediana **entre empresas** y el que se
  aparta no entra en la brecha, pero se muestra tachado en vez de desaparecer.
- **La marca puede venir en otro campo.** Dia manda "REPELENT NARANJ AERO" con la
  marca "BONTE" aparte: en una zona de CABA, sus 40 promos tenían marca y
  ninguna la repetía en la descripción. La página la usaba solo para poner
  mayúsculas y la descartaba, así que "vino tinto" no decía de qué bodega.
  Ahora se agrega cuando la descripción no la trae.
- **Cada cadena declara un tamaño distinto para el mismo código de barras.**
  FANTA 1,75 L: 1750 cc para unas, "1,7 cc" para Cencosud —litros cargados como
  centímetros cúbicos— y "1 unidad" para Carrefour, que es lo que se carga
  cuando no se informa el peso. Se vota un tamaño por producto, **por empresas y
  no por banderas**: contando banderas, el error de Cencosud valía tres votos.

Auditando ese hallazgo apareció un patrón que vale más que el caso: **lo que
agrega resiste, lo que titula con el extremo no**. Con el mismo filtro aplicado
a "Más barato", sólo 56 de 48.152 victorias cambian de dueño y **ninguna de las
63 categorías cambia de líder**, porque cada categoría promedia miles de
comparaciones. El índice de inflación ya recortaba los relativos fuera de
`[0,5, 2]`, y la canasta más barata está a 0,86 de la mediana entre localidades:
sana. La sección vulnerable era la única que publica un extremo individual como
titular.

### Geografía

Las cadenas reportan toda CABA como "Capital Federal". El barrio real se
resuelve por **point-in-polygon** contra la geometría oficial del GCBA,
respetando el barrio cuando la cadena sí lo informa bien.

---

## Calidad

**27 modelos y 110 tests de dbt**, que corren en cada ejecución del pipeline,
más 74 tests unitarios en Python sobre la API y la ingesta que no necesitan
BigQuery.
Además de los genéricos, hay tests singulares para las cosas que sólo se
detectan mirando el resultado agregado: que Carne vacuna y Pollo no mezclen
otras carnes, que la canasta económica no salga más cara que la gama media, que la gama esté ordenada por precio por unidad, que el
mapeo de unidades siga cubriendo el catálogo, que la categorización no se
degrade a "Otros", que los históricos hayan capturado la última fecha, y que el
crudo no se haya quedado atrás respecto del calendario.

Ese último se compara contra `CURRENT_DATE` y no contra otra tabla, a propósito:
un pipeline no puede notar su propio atraso midiéndose contra sí mismo.

Los tests sobre `stg_productos` miran sólo la última fecha: la transformación es
la misma para todas, así que cada fecha se validó el día en que fue la última.
No se resolvió con `where` en el YAML porque esa config se renderiza al parsear,
cuando la macro de fecha todavía no consultó nada: el test pasaría siempre sin
mirar un dato.

Los tests corren **después** de `dbt run` y no como `dbt build`, a propósito: si
un test falla a mitad del DAG, `build` saltea los modelos de abajo y ese día no
entra a los históricos. Como el crudo retiene 3 días, esa fecha se volvería
irrecuperable. Se prefiere capturar el dato y que la falla avise.

---

## Costo

Todo corre dentro del nivel gratuito de BigQuery, y eso condicionó el diseño más
de una vez.

| | Uso | Límite gratuito |
|---|---|---|
| Procesamiento | ~11 GiB/día (~340 GiB/mes) | 1 TiB/mes |
| Almacenamiento | 6,9 GB | 10 GB |

Decisiones que salieron de ahí:

- El crudo retiene **3 días** en régimen. No es sólo costo de consulta: pesa
  ~1,5 GB por día, así que una ventana de 4 días llevaría el almacenamiento a
  8,7 GB. La ingesta la abre sola cuando hay una fecha recuperada esperando a
  que dbt la capture, y la vuelve a cerrar en cuanto los históricos se ponen al
  día: una recuperación puntual no sube el piso.
- Los marts recalculan **sólo las fechas que faltan** en el histórico, no las
  tres de la ventana. Bajó la corrida diaria de 15,6 a 12,25 GB.
- El crudo se carga con un **load job directo a la partición del día**, que no
  consume cuota, en vez de reconstruir la tabla entera con `CREATE OR REPLACE`
  para sumar un día: 4,07 → 0 GiB. Antes de activarlo se cargó la misma fecha
  por los dos caminos y se comparó comercio por comercio: mismas filas y misma
  huella de todas las columnas.
- `stg_productos` es **incremental** y reemplaza particiones con copy jobs, que
  no consumen cuota: 2,14 → 0,85 GiB por corrida.
- La categorización y los tests de staging leen **sólo la última fecha**:
  2,23 → 0,86 GiB y ~2,1 → ~1,1 GiB.
- Cada ahorro se midió con dry run o contra `INFORMATION_SCHEMA.JOBS`, no se
  estimó. Leer una partición no cuesta un tercio de la tabla: `id_producto` de
  una fecha cuesta 0,30 GiB y de las tres, 0,60.
- El índice encadenado se calculó **dentro** de un modelo existente en vez de
  agregar uno nuevo: BigQuery cobra por bytes leídos, no por agregar, así que
  costó 0 GB extra frente a los +63 GB/mes de un modelo aparte.
- Cuando dos marts necesitan el mismo cálculo, se hace **una vez** en un modelo
  intermedio. El precio de cada producto en cada cadena lo usan "Supermercado
  más barato" y "El mismo producto": leerlo dos veces por separado costaría dos
  veces los 1,5 GiB que pesa escanear los precios por sucursal.
- **Buscar no consulta la base.** Cada texto tipeado en un buscador era una
  consulta nueva, porque cada búsqueda distinta es una entrada distinta de la
  caché. Las páginas que caben en memoria (94 localidades, ~800 filas de quién
  gana, el catálogo de productos comparables) se traen una vez y filtran en el
  navegador.
- La API cachea 6 horas. El mapa de promos escanea 212 MB por request y se
  dispara en cada movimiento del mapa.
- Hay una **cuota dura** a nivel proyecto: es lo único que garantiza que un bot
  no genere un cargo. Se calcula como lo que queda del TiB gratuito dividido
  por los días que faltan del mes, y no mirando un día típico: todos los días
  pueden quedar bajo un techo razonable y el mes igual terminar pagando.
- La API corre en **512 MiB** en vez de 1 GiB. Con los dos índices en memoria
  el proceso llegaba a 726 MB, y no por los índices, que retienen 143 MB, sino
  por el pico al leerlos: `list_rows` sin `page_size` trae páginas enormes. Con
  páginas de 5.000 filas el pico al leer 200 mil baja de 508 a 57 MB, y el
  proceso completo queda en 347 MB.

---

## Correrlo

Ver [DEPLOY.md](DEPLOY.md) para el despliegue. Para desarrollo:

```bash
# API
cd api && ./venv/Scripts/uvicorn.exe main:app --port 8000

# Frontend
cd frontend && npm run dev

# Transformaciones
dbt build
```

---

## Limitaciones conocidas

- **La cobertura fuera de CABA es más fina.** El point-in-polygon divide CABA en
  71 barrios con 13,2 sucursales promedio; el resto del país son 459 localidades
  con 3,4. Con precio estrictamente local sólo 16 localidades completan la
  canasta; con la imputación provincial (ver arriba) son ~96.
- **La clasificación la hace un modelo de lenguaje** y falla donde hace falta
  conocer la marca: "Bondiola LÁBRATTO PZA", una bondiola curada, cae en Cerdo en
  vez de Fiambres. Un test vigila que Carne vacuna y Pollo no tengan más de 2% de
  productos con marcadores ajenos.
- **Los históricos arrancan el 2026-09-07.** La fecha anterior se había calculado
  con la taxonomía vieja y ya no estaba en el crudo para recalcularla con las
  carnes depuradas, así que se borró en vez de dejar una serie que mezcla dos
  definiciones de "Carne vacuna".
- **Algunas combinaciones cadena × categoría tienen precios sistemáticamente
  fuera de mercado** (Dia en Gaseosas, por ejemplo), replicados en cientos de
  sucursales. Parece un error del maestro de precios de esa cadena y no se puede
  verificar sin acceso a la fuente original. Se documenta en el modelo en vez de
  presentarlo como dato confiable.
- **El histórico es corto.** Empezó a acumularse hace pocos días, así que las
  variaciones todavía no representan inflación mensual real.

---

## Stack

BigQuery · dbt · Python (FastAPI) · React + TypeScript + Tailwind · Leaflet ·
Gemini · Docker · Cloud Run · GitHub Actions
