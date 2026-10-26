# Decisiones de diseño

El [README](../README.md) cuenta qué hace Changuito y cuáles son las decisiones
principales. Acá está el detalle: cada caso con lo que se midió, cómo se
resolvió y qué test lo cubre ahora.

1. [Ingesta y orquestación](#ingesta-y-orquestación)
2. [Comparar cosas que no son comparables](#comparar-cosas-que-no-son-comparables)
3. [El índice de precios](#el-índice-de-precios)
4. [Destacar sin inventar un umbral](#destacar-sin-inventar-un-umbral)
5. [Datos que se pierden en silencio](#datos-que-se-pierden-en-silencio)
6. [Cuando falta el dato](#cuando-falta-el-dato)
7. [Ruido de la fuente](#ruido-de-la-fuente)
8. [La IA interpreta, el código cuenta](#la-ia-interpreta-el-código-cuenta)
9. [Una sección que se retiró](#una-sección-que-se-retiró)
10. [Geografía](#geografía)
11. [Tests](#tests)
12. [Costo](#costo)

---

## Ingesta y orquestación

**La descarga corre en una máquina de casa y no en la nube, y no es un
descuido.** El portal `datos.produccion.gob.ar` responde 403 a los rangos de IP
de datacenter: se verificó contra GitHub Actions y Google Colab, mientras que
una conexión doméstica recibe 200. No es un problema de User-Agent. Todo lo
demás (transformación, categorización, API) sólo habla con BigQuery y Gemini,
así que corre en la nube sin restricciones.

Se descartó montar un relay por proxy residencial para saltear el bloqueo: es
eludir deliberadamente un control que el portal puso a propósito.

La ingesta corre en una notebook a las 07:00 y reintenta cada 2 horas hasta el
mediodía; más tarde, la carga pesada caería en horario de uso. Las fechas que
faltan se leen de la lista de particiones, que no consume cuota, así que un
reintento sin nada que hacer cuesta cero y termina en segundos. Como SEPA
publica los últimos 7 días, la notebook tendría que estar apagada una semana
para perder datos. `orquestacion/scripts/instalar_ingesta.ps1` deja una PC
lista con un comando.

Cuando la ingesta carga algo, dispara el pipeline de GitHub Actions en ese
momento (`disparar_pipeline.py`). El cron diario queda de respaldo: GitHub no
garantiza el horario de los cron, y hasta septiembre de 2026 arrancaba entre 3 y
6 horas tarde. El pipeline no corre si no hay nada nuevo, porque un día sin
datos rearmaba los mismos marts por ~12 GiB: decide con metadata de las tablas
(`hay_que_transformar.py`) y corre igual si cambió el código de dbt. Si el dato
no llega en 3 días, falla y GitHub avisa por mail.

---

## Comparar cosas que no son comparables

El error recurrente, en ocho formas distintas:

- **La canasta básica** (una sección que ya se
  [retiró](#una-sección-que-se-retiró)) sumaba las categorías que cada
  localidad tuviera, entre 20 y 32, y comparaba esos totales entre sí. Una
  localidad con menos datos parecía más barata: la mediana era $177.419 con 20
  categorías contra $388.726 con 30. El ranking medía cuántas categorías
  faltaban, no precios. Pasaron a entrar sólo las localidades con la canasta
  **completa**, con un test que lo garantiza.

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
  anteriores. El pollo económico pasó a $3.979/kg y la carne a $9.990.

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
  harina a $2.028/kg. La serie histórica marca ese salto entre el 22 y el 23 de
  septiembre.

- **Un maple de huevos contaba como un huevo.** En las categorías que se
  cotizan por pieza, muchas cadenas informan el paquete entero como "1 UN":
  "HUEVO BLANCO CARREFOUR CARTON X 30 UNI" llega con cantidad 1. Pasaba en 65
  de 221 huevos y 150 de 354 pañales, y el huevo premium costaba $2.250. Peor
  en Higiene bebé: Tu canasta pide 100 unidades pensando en toallitas, pero la
  mediana mezclaba chupetes y mamaderas, así que la toallita económica salía
  $2.520 y esa línea sumaba unos $250.000. Hoy, en esas categorías, la
  cantidad se lee de la descripción ("X 30 UNI", "48U", "MAPLE") y sólo
  cuentan envases de 3 a 200 piezas: lo que no dice cuántas trae no tiene
  precio por pieza, y no se inventa. La lectura se revisó sobre los 1.519
  productos de las cuatro categorías para que no tome medidas como "25X25 CM"
  o "45 X 55". La toallita económica pasó a $62 y el huevo premium a $450.

---

## El índice de precios

Medir inflación restando promedios es incorrecto cuando el surtido cambia. El
modelo calcula, para cada día, un factor contra la fecha anterior usando **sólo
los productos presentes en ambas**, y la variación de un período se obtiene
encadenando esos factores. La API exige la cadena completa: si a una serie le
falta un eslabón no se muestra, en vez de multiplicar salteando el hueco.

El estimador es la **media geométrica de los relativos** (índice de Jevons). El
primer intento usó la mediana y estaba mal: los cambios de precio son
esporádicos (el 97,9% de los productos no cambia de un día al otro), así que la
mediana de los relativos vale 1,0 por construcción y daba 0,00% en 563 de 564
series. Con Jevons pasan a 201 series con variación real.

Ese mismo 97,9% define cómo se presenta. La primera versión de la página abría
con un selector de categoría y mostraba sus 14 cadenas: como casi nada se mueve
de un día al otro, cualquier categoría daba una pantalla de ceros, y encontrar
la que sí se había movido era recorrer más de 50 a mano. La página ahora abre
con **el ranking completo del mercado** (una categoría es la media geométrica de
los factores de todas sus series) y la apertura por cadena es el segundo click.
Sólo entran las categorías cubiertas por al menos 3 cadenas: con una sola, el
número no es el mercado, es un supermercado.

---

## Destacar sin inventar un umbral

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

---

## Datos que se pierden en silencio

Lo más peligroso no es el dato que rompe la corrida, sino el que desaparece sin
avisar:

- El mapeo de unidades de la fuente no contemplaba `EA` (el código GS1 de
  "each"), que cubre el **16,4% del catálogo**. Como todo lo que necesita
  cantidad descarta las filas sin unidad, esos productos quedaban fuera de la
  gama, la canasta y el índice **sin que nada fallara**.
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
- El portal de SEPA estuvo caído del 26 al 27 de septiembre. El 25 llegó tarde
  y la ingesta abrió la retención del crudo para que no se perdiera, pero no la
  de `stg_productos`, su copia en dbt, donde el 24 ya había vencido. El índice
  compara cada día contra el anterior disponible, así que el 25 y el 28 quedaron
  sin factor y la página de inflación cortó su período en el 24, sin ningún
  error. Ahora la ingesta abre y cierra la retención del crudo y de sus copias
  juntas; las fechas afectadas se recalcularon con la misma variable de dbt que
  las correcciones de método.

Los tres casos tienen ahora un test que falla si vuelven a aparecer. El último,
además, cambió la ingesta: abre la retención de particiones antes de un
backfill, la vuelve a cerrar cuando ya no hace falta, y verifica que lo que
cargó siga existiendo en vez de darlo por hecho.

---

## Cuando falta el dato

Al depurar las carnes quedaron pocos productos económicos de pollo y pescado, y
esos frescos se venden en pocas sucursales: con precio estrictamente local sólo
16 localidades completaban la canasta, una de CABA. Se midieron tres salidas
sobre los datos del 2026-09-09:

- Ampliar a gama económica + media: 92 localidades, pero la canasta deja de ser
  la económica.
- Tomar el tercio más barato de cada localidad: 72, pero el recorte de extremos
  saca los pollos enteros y el pollo vuelve a salir más caro que la carne.
- **Mantener la gama económica y usar la mediana provincial en las categorías
  que no tienen precio local, con un tope por canasta.**

Se eligió la última, como hacen los índices oficiales con los precios
faltantes. Cada categoría imputada va marcada en el desglose del sitio.

El tope empezó en 2, por temor a que con más precios provinciales la canasta
dejara de describir a su localidad. Ese temor se midió el 2026-09-24: en las
localidades que sí tienen precio local, se lo reemplazó por el provincial.
Imputar una categoría mueve la canasta 0,0% en la mediana y como mucho 1,9% (la
papa fuera de CABA), y aceite, azúcar, pollo y leche juntos, 0,7%. Las mismas
cadenas cobran lo mismo en toda la provincia. El tope pasó a 4, sin cambio en
la mediana.

La misma escasez decidió qué hacer con las menudencias. El INDEC incluye 270 g
de hígado, y al contrastar la composición contra su tabla por región apareció
otro error: las carnes estaban repartidas en tercios iguales, 2.090 g de vacuna,
pollo y pescado, cuando el INDEC da 4.440, 1.650 y 180. Se corrigió el reparto,
pero el hígado quedó afuera: se compra sobre todo en carnicerías, que SEPA no
cubre, y en los supermercados es un producto puntual. Es el 0,2% del costo.

---

## Ruido de la fuente

- **SEPA mezcla importes de cuota en la columna de promoción.** La portada
  mostraba colchones con "98,8% OFF". Los valores de promo son un diccionario
  chico de números redondos reusados entre productos de precio muy distinto, y
  para el más barato de cada grupo el valor es exactamente `lista/10`: las
  clásicas 10 cuotas sin interés. Un techo fijo de descuento las frenaba, pero
  dejaba la lista llena de promos clavadas en ese techo: de 200, 79 tenían
  exactamente 70% y 186 no eran alimentos. Ahora cada promo entra según la
  evidencia que la respalda (que la cadena declare el porcentaje, que el precio
  se sostenga contra otras empresas, o un techo más bajo si no hay ninguna de
  las dos) y la página dice cuál de las tres es.
- **Hay provincias enteras disfrazadas de localidad.** "BUENOS AIRES" agrupaba
  425 sucursales repartidas en 555 km. Se excluyen por dispersión geográfica y
  no por lista de nombres: una localidad real es compacta.
- **La misma ciudad venía escrita de dos formas** ("Salta" y "SALTA"), lo que la
  partía en dos y le daba la mitad de las muestras a cada una.
- **Una cadena entera puede informar mal un precio.** FANTA Zero 1,75 L figuraba
  a $309 en HiperChangomás (31 sucursales) y $369 en Changomás (53), mientras
  SuperChangomás (la misma empresa) y las otras diez cadenas la informaban entre
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
  FANTA 1,75 L: 1750 cc para unas, "1,7 cc" para Cencosud (litros cargados como
  centímetros cúbicos) y "1 unidad" para Carrefour, que es lo que se carga
  cuando no se informa el peso. Se vota un tamaño por producto, **por empresas y
  no por banderas**: contando banderas, el error de Cencosud valía tres votos.

Auditando ese hallazgo apareció un patrón que vale más que el caso: **lo que
agrega resiste, lo que titula con el extremo no**. Con el mismo filtro aplicado
a "Más barato", sólo 56 de 48.152 victorias cambian de dueño y **ninguna de las
63 categorías cambia de líder**, porque cada categoría promedia miles de
comparaciones. El índice de inflación ya recortaba los relativos fuera de
`[0,5, 2]`. La sección vulnerable era la única que publica un extremo
individual como titular.

---

## La IA interpreta, el código cuenta

Tu canasta le pasaba a Gemini las cantidades del INDEC y le pedía que armara la
canasta ajustándolas. Armaba sólo lo que el usuario nombraba: "vivo solo, como
mucha carne y muchos huevos, y tomo mate" salía con carne, huevos y yerba, y
nada más. Reforzar la regla en el prompt lo arreglaba en una corrida y fallaba
en la siguiente. Y cuando sí ajustaba, erraba la cuenta: "tomamos mucha leche"
salía con menos leche que la base de ese hogar.

Ahora el modelo devuelve sólo lo que depende del texto (cuántos adultos
equivalentes son, qué no consumen y qué sube o baja, como un factor) y la
canasta la arma el código: la base del INDEC multiplicada por el hogar, con un
test que la compara contra la tabla del INDEC de la seed `composicion_canasta`.
Los seis ejemplos de la página dan la misma canasta en corridas sucesivas.

---

## Una sección que se retiró

Hubo una sexta sección, **Canasta básica**: el costo de la canasta alimentaria
del INDEC en cada localidad. Buena parte de las decisiones de arriba salieron de
ella, y aun así se sacó el 2026-10-08. Medido ese día, 75 de las 89 localidades
eran de CABA o de la provincia de Buenos Aires, no había ninguna del norte, y
Chubut salía más barato que CABA, cuando la Patagonia es la región más cara de
la canasta oficial. No era un error de cálculo sino un límite de la fuente: SEPA
informa cadenas grandes, que fijan precios casi iguales en todo el país, y lo
que encarece una región (el almacén, la verdulería, la carnicería del barrio)
no está en SEPA. La pregunta que prometía la sección, cuánto cuesta comer en
cada lugar, el dato no la puede responder, y un número que no convence le resta
credibilidad al resto. La canasta del INDEC sigue como punto de partida de Tu
canasta, donde sí sirve.

---

## Geografía

Las cadenas reportan toda CABA como "Capital Federal". El barrio real se
resuelve por **point-in-polygon** contra la geometría oficial del GCBA,
respetando el barrio cuando la cadena sí lo informa bien.

---

## Tests

Además de los genéricos, hay tests singulares de dbt para lo que sólo se
detecta mirando el resultado agregado: que Carne vacuna y Pollo no mezclen otras
carnes, que la canasta económica no salga más cara que la gama media, que la
gama esté ordenada por precio por unidad, que el mapeo de unidades siga
cubriendo el catálogo, que la categorización no se degrade a "Otros", que los
históricos hayan capturado la última fecha, y que el crudo no se haya quedado
atrás respecto del calendario.

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

En el frontend, la regla de quién lidera Más barato se compara contra un oráculo
escrito aparte sobre 200 tablas generadas con semilla fija, con empates
forzados, que es donde una cuenta así se equivoca. Y los tests se validaron al
revés: se metieron 20 errores a propósito en el código y cada uno hizo fallar
al menos un test.

---

## Costo

Cada ahorro se midió con dry run o contra `INFORMATION_SCHEMA.JOBS`, no se
estimó.

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
  2,23 → 0,86 GiB y ~2,1 → ~1,1 GiB. Leer una partición no cuesta un tercio de
  la tabla: `id_producto` de una fecha cuesta 0,30 GiB y de las tres, 0,60.
- El índice encadenado se calculó **dentro** de un modelo existente en vez de
  agregar uno nuevo: BigQuery cobra por bytes leídos, no por agregar, así que
  costó 0 GB extra frente a los +63 GB/mes de un modelo aparte.
- Cuando dos marts necesitan el mismo cálculo, se hace **una vez** en un modelo
  intermedio. El precio de cada producto en cada cadena lo usan "Supermercado
  más barato" y "El mismo producto": leerlo dos veces costaría dos veces los
  1,5 GiB que pesa escanear los precios por sucursal.
- **Buscar no consulta la base.** Cada texto tipeado en un buscador era una
  consulta nueva, porque cada búsqueda distinta es una entrada distinta de la
  caché. Las páginas que caben en memoria (las localidades, ~800 filas de quién
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
- **La primera visita no espera un minuto.** Cloud Run apaga la instancia sin
  tráfico, y la siguiente visita a El mismo producto esperaba ~55 s mientras
  se leían 200 mil filas por `list_rows`. Ahora los marts se leen con la
  Storage Read API, en columnas (Arrow) y en paralelo: 3,6 s y menos memoria.
  Tampoco usa la cuota de consultas: se factura aparte, con 300 TiB gratis
  por mes, y cada carga lee unas decenas de MB. Si falla al arrancar, vuelve
  a `list_rows`.
