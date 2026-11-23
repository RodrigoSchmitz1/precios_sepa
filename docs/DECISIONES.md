# Decisiones de diseño

El [README](../README.md) cuenta qué hace Changuito y cuáles son las decisiones
principales. Acá está el detalle: cada caso con lo que se midió, cómo se
resolvió y qué test lo cubre ahora.

1. [Ingesta y orquestación](#ingesta-y-orquestación)
2. [Comparar cosas que no son comparables](#comparar-cosas-que-no-son-comparables)
3. [El índice de precios](#el-índice-de-precios)
4. [Destacar sin inventar un umbral](#destacar-sin-inventar-un-umbral)
   y [cuánto conviene comparar](#cuánto-conviene-comparar)
5. [Datos que se pierden en silencio](#datos-que-se-pierden-en-silencio)
6. [Cuando falta el dato](#cuando-falta-el-dato)
7. [Ruido de la fuente](#ruido-de-la-fuente)
8. [La IA interpreta, el código cuenta](#la-ia-interpreta-el-código-cuenta)
9. [Una sección que se retiró](#una-sección-que-se-retiró)
   y [lo que se midió y no se publicó](#lo-que-se-midió-y-no-se-publicó)
10. [Geografía](#geografía) y [la zona del usuario](#la-zona-del-usuario)
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

El error recurrente, en nueve formas distintas:

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

- **Jumbo salía la canasta más barata del país.** La portada lo publicaba
  ("$160.079 en Jumbo y $213.084 en La Anónima") cuando, en productos
  idénticos, Jumbo es 13,7% más cara que Maxi y entre 6% y 7% más cara que
  Dia, Coto y Carrefour. Era un efecto de composición: la gama económica corta
  el tercio barato con un umbral de todo el mercado y cada cadena quedaba con
  la mediana de lo que tenía debajo. En carne, Jumbo tenía sólo puchero y dos
  picadas comunes ($7.165 el kilo); Maxi, muchos cortes, varios más baratos que
  esos pero también otros cerca del corte ($12.995 de mediana). Tener más
  surtido barato subía la mediana, y con 4,44 kg de carne en la canasta esa
  sola línea le daba a Jumbo $25.885 de ventaja. Hoy cada categoría vale lo
  mismo en todas las cadenas y se ajusta por el nivel de cada una en productos
  idénticos, como en Más barato. Donde no hay productos idénticos (la carne
  fresca: cada cadena codifica sus cortes) va el nivel general de la cadena, y
  la página lo dice. La más barata pasó a ser Maxi, la distancia entre la
  primera y la última bajó de 25% a 14%, y La Anónima de +33% a +13%.
  La auditoría del 28-10 midió el límite del método: el nivel de cada cadena
  sale de sus propios productos, no de los mismos que las demás, y comparadas
  de a pares contra Maxi las cadenas del medio cambian de lugar (Dia pasa de
  segunda a detrás de Market y Carrefour, por 1,7 puntos). Los extremos sí se
  sostienen. La página lo dice: entre cadenas que difieren en menos de 2%, el
  orden no es firme.

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
Sólo entran las categorías cubiertas por al menos 3 empresas (ver más abajo):
con una sola, el número no es el mercado, es un supermercado.

**El índice no medía los básicos (2026-10-27).** Al calcular cuánto aporta cada
categoría a la inflación de la canasta apareció que el 48% de las series (599
de 1.238) no tenía factor ningún día. El factor se calculaba sólo sobre la gama
económica y pedía 20 productos distintos pareados por cadena, y los básicos
tienen pocos: el tercio económico de aceite, azúcar o papa son 3 a 5 productos
por cadena. Azúcar, manteca y papa no tenían índice en ninguna cadena; leche,
arroz y pan, en 1 o 2. La página no los mostraba y ningún test lo veía, porque
cada serie que sí tenía factor estaba bien calculada: lo que faltaba eran series.

Se midió antes de cambiar nada: contando productos distintos por cadena, con
todas las gamas y un mínimo de 10 la canasta tendría índice en 32 de 32
categorías (99,8% de su peso), contra 24. La primera corrida lo confirmó: el
26-10 la canasta tiene 32 de 32 (leche y aceite, en 14 cadenas) y el sitio 67
de sus 69 categorías con al menos 3 cadenas, contra 52 el día anterior. El
costo en ruido es chico: el desvío diario del factor de una cadena es 0,73% con
~22 productos y 0,47% con ~83. Usar todas las gamas es además lo correcto: el
IPC releva todas las variedades, y como cada relativo es de un producto contra
sí mismo, mezclar gamas no mezcla niveles de precio. El cambio no lee un byte
más (dry run: 1,308 GiB antes y después).

Con el cambio, el período pasó a ser **un mes calendario**, encadenado a nivel
mercado: cada día la categoría es la media geométrica de las series que tienen
dato ese día (con al menos 3 empresas), y el mes encadena esos días. Antes cada
serie tenía que estar completa desde el 15 de septiembre, así que una cadena
que faltaba un día quedaba afuera para siempre y la cobertura empeoraba al
crecer la historia. Un mes, además, se puede comparar con el IPC. Octubre quedó
con el método anterior, porque el crudo ya había vencido; noviembre es el
primer mes entero con el nuevo. Un test (`indice_cubre_la_canasta`) falla si
menos de 30 de las 32 categorías de la canasta tienen índice.

**Tres empresas, no tres cadenas (2026-10-28).** El mínimo diario contaba
banderas. Carrefour tiene cuatro (Carrefour, Market, Express y Maxi) que fijan
precios juntas, así que "4 cadenas" podían ser 2 empresas: Verduras, la
categoría que más aportaba a la cascada, se midió así 16 de los 27 días de
octubre, con Carrefour y Coto. Era la misma trampa que ya se había evitado en
los destacados de El mismo producto, y lo encontró la auditoría. Ahora la
empresa sale de la seed `mapeo_cadenas` y se piden 3. El costo es real: en
octubre la canasta pasó de +1,80% a +0,95%, lo medido del gasto de 73,5% a
58,1%, y Verduras, Frutas, Legumbres y Vinagre salieron de la cascada (el
ranking pasó de 46 a 37 categorías). Las que quedaron no cambiaron su
variación. Se prefirió un número sobre menos gasto a uno que llama "mercado" a
dos supermercados. La pérdida es sobre todo de octubre, que se encadena con el
índice viejo (sólo la gama económica) hasta el 25: con el nuevo, desde el
26-10 la canasta tiene 31 de 32 categorías con 3 empresas (falta Pollo), y el
test `indice_cubre_la_canasta` pasó a contar empresas sin bajar su mínimo.

**Cuánto aporta cada categoría.** El ranking dice qué se movió, pero no cuánto
pesa: un +4% en sal y un +1% en carne no se pueden comparar, porque en la
canasta se gasta cientos de veces más en carne. La página abre con la
variación de la canasta básica del mes, como un índice de Laspeyres: cada
categoría pesa lo que cuesta su cantidad del INDEC al precio del cierre del mes
anterior, y su incidencia es ese peso por su variación. Las incidencias suman
exactamente la variación de la canasta, y por eso se dibujan como cascada (un
test lo verifica sobre 200 tablas al azar). Las categorías sin índice no se
inventan: quedan afuera y la página dice sobre qué parte del gasto se midió.
Cuando no es toda la canasta, el titular lo dice ("Las 17 categorías medidas
… subieron 0,95%", no "La canasta básica subió"), y las categorías sin precio
se listan aparte, porque ni siquiera entran en el denominador de la cobertura
(auditoría del 28-10).

La primera versión tomaba el índice de cada categoría sólo en la unidad en que
la canasta la pide, y la misma página mostraba Verduras +4,48% en el ranking y
+7,25% en la cascada. La unidad importa para el peso (un precio por kilo), no
para la variación, que es de cada producto contra sí mismo: las dos secciones
usan ahora el mismo índice, calculado en un solo lugar de la API.

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

## Cuánto conviene comparar

La pregunta es simple: si comparo antes de comprar, ¿cuánto ahorro? Por
producto, el ahorro es cuánto más barato es el precio más bajo que el precio
típico (la mediana entre empresas). Por categoría se publica la **mediana** de
ese ahorro, no el máximo, por la misma razón que en los destacados: lo que
titula con el extremo no resiste los errores de la fuente. Entran sólo los
productos que venden 3 o más empresas, con los extremos respaldados por 3 o más
sucursales. El 26-10 eran 9.501, con un ahorro típico de 5,6%; con la mediana
exacta (ver abajo), 6,7%.

**Muchas categorías daban exactamente 5,0%**: perfumería, yogur, cerveza,
pañales. Una mediana clavada en un número redondo en categorías tan distintas no
es dispersión de mercado, así que se investigó antes de publicar. No era un error
de la fuente sino **reglas de precio**:

| | Productos que venden las dos | Más cara | Igual | Más barata | Escalones |
|---|---|---|---|---|---|
| Maxi frente a Carrefour | 14.638 | 4,5% | 38% | 58% | 5% (21% de los productos), 10% (11%), 15% (2%) |
| SuperChangomás frente a Changomás | 25.309 | 0,4% | 37% | 63% | 5% (31%), 4% (29%) |

Son banderas de la misma empresa que cobran lo mismo que su hermana o un escalón
fijo menos. Entre las dos tienen el precio más bajo en el 64% de los productos
comparables, y sin Maxi el ahorro típico baja de 6,7% a 4,2%. La sección lo dice
con todas las letras: publicado sin esto, "conviene comparar" se leería como
dispersión del mercado cuando en buena parte es "andá a esa bandera".

**La pista era en parte un artefacto (2026-10-28).** La auditoría encontró que
el precio típico no era la mediana: `APPROX_QUANTILES(x, 2)[OFFSET(1)]` devuelve
el valor de abajo cuando hay una cantidad par, así que con 4 empresas la
referencia era la segunda más barata, y una empresa con dos banderas valía lo de
la más barata. Esa referencia caía seguido en el precio de Carrefour, con Maxi
un escalón de 5% justo debajo: de ahí tantas categorías en 5,0% exacto. Con la
mediana exacta (macro `mediana`, que promedia los dos del medio) son 2 de 51 y no
11, el ahorro típico sube de 5,6% a 6,7% (cambia la referencia de 2.365 de
10.389 productos) y los niveles de Tu canasta en cada cadena no se mueven más de
0,2%. Las reglas siguen en pie, porque se miden bandera contra hermana sin pasar
por la referencia: la pista que llevó a ellas estaba sesgada, el hallazgo no.

El resto de las medianas del proyecto se dejaron como están, a propósito. El
precio de un producto en una cadena (la mediana entre sus sucursales) y los
precios por categoría de cada sucursal o localidad son precios que se
muestran, y la mediana de abajo devuelve uno que alguna sucursal cobra de
verdad: $4.775 y no $4.887,50. Medido sobre El mismo producto, sólo el 0,6% de
los precios salen de dos sucursales con precios distintos, que es donde la
diferencia pesa. La mediana exacta va donde el número es una estadística contra
la que se compara, como el precio típico del mercado.

Las reglas no están escritas a mano: la API las detecta cada día comparando cada
cadena que suele tener el precio más bajo con sus hermanas de la misma empresa
(la seed `mapeo_cadenas`). Si mañana una bandera cambia su política, la página lo
refleja sola. Todo sale del índice de El mismo producto que la API ya tiene en
memoria: no consulta BigQuery.

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
- El ZIP que SEPA publicó para el 11 de noviembre **no traía a Cencosud**. La
  ingesta lo anotó como un comercio más que no vino y siguió, porque que falte
  uno es normal (hay un número de comercio que no viene nunca). Jumbo, Disco y
  Vea, con unos 10.000 productos cada una el día anterior, desaparecieron de El
  mismo producto, Más barato y los históricos de ese día: 11 cadenas en lugar
  de 14, sin aviso. Al revisar los históricos (66 fechas, del 7 de septiembre al
  11 de noviembre) apareció que **ya había pasado dos veces**: Cooperativa
  Obrera el 29 de septiembre y Dia el 8 de noviembre, las dos por la misma
  causa. Son 3 días de 66, dos de ellos en la misma semana. Ese 11 de
  noviembre, sin Cencosud, los productos comparables bajaron un 9% y en uno de
  cada cuatro la cadena más cara era de Cencosud, así que las brechas
  publicadas se achicaron por la cadena que faltaba y no por el mercado.

Los casos tienen ahora un test que falla si vuelven a aparecer. El de la
ingesta detenida, además, cambió la ingesta: abre la retención de particiones
antes de un backfill, la vuelve a cerrar cuando ya no hace falta, y verifica que
lo que cargó siga existiendo en vez de darlo por hecho. El de la cadena que
falta (`cadenas_del_ultimo_dia_completas`) compara el último día contra el
anterior y no contra una lista fija de cadenas: falla si una que tenía más de
1.000 productos falta o llega con menos de la mitad. En las 66 fechas ninguna
cadena perdió más de la mitad sin desaparecer del todo, así que el corte no da
falsas alarmas. Es `error` y no `warn` porque un aviso que no manda el mail no
lo ve nadie.

Ese día el sitio **usa el precio del día anterior para la cadena que falta, y
lo avisa**: qué cadenas y de qué fecha son sus precios. Se eligió sobre sólo
avisar, porque la brecha publicada seguiría achicándose por la cadena que falta
y no por el mercado. También sobre no publicar el día, que tiraría los precios
nuevos de las otras cadenas. El arrastre se sostiene en una medición: de un día
al siguiente cambia de precio el 1% de los pares producto × cadena (1,2% en
Cencosud). Tiene dos límites. Dura como máximo dos días, porque más atrás el
precio deja de ser el de hoy. Y no se escribe en los históricos, que guardan lo
que SEPA publicó y no una estimación.

Cómo quedó:
- **El arrastre vive en `mart_mismo_producto`, no en la tabla intermedia.**
  `int_precio_producto_cadena` alimenta a `mart_quien_gana` y, por él, a
  `historico_quien_gana`: completarla ahí habría escrito precios arrastrados
  en la historia. Cada fila del mart lleva `fecha_precio`. El tope es la
  variable `dias_maximos_arrastre`, que también lee el test
  `arrastre_dentro_del_tope`. Tiene que ser menor que los 3 días que retiene la
  tabla intermedia: más atrás no hay de dónde sacar el precio. Leer 3 días en
  vez de 1 suma 37 MB por corrida (de 841 a 878 MB en el dry run).
- **Más barato nacional se calcula desde el índice de Mismo producto.** Antes
  leía `mart_quien_gana`, que no tiene la cadena arrastrada, así que Más barato
  y Mismo producto habrían contado cadenas distintas el mismo día. Usa la misma
  función que la vista de la zona. En un día completo da los mismos ganadores y
  conteos que el mart en las 66 categorías. Los porcentajes difieren a lo sumo
  en una décima, porque BigQuery y Python redondean distinto los ,x5. El sitio
  hace además dos consultas menos.
- **Un producto que el último día vende sólo la cadena arrastrada toma el
  nombre de `stg_categorias`.** El mart lee los nombres del crudo de la última
  fecha, y leer tres fechas para eso triplicaría su parte más cara. Son
  productos que no llegan a la comparación: hace falta otra cadena con precio.
- Con el dato real del 11 de noviembre, el mart nuevo devuelve 30.889 precios
  arrastrados de Jumbo, Disco y Vea. En 11.098 de ellos, la cadena arrastrada es
  la más cara del producto: son brechas que el sitio había publicado achicadas.

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

## Lo que se midió y no se publicó

Dos preguntas que parecían buenas secciones y que el dato no sostiene. Se
dejan escritas porque un resultado nulo bien medido evita volver a construir
lo mismo.

**¿Una cadena cobra más donde tiene menos competencia?** No. Se comparó cada
sucursal contra la mediana nacional de su propia cadena, en las mismas
categorías y gamas, para no confundir competencia con qué cadenas hay en cada
lugar (2.451 sucursales en 431 localidades, el 26-10). Según cuántas empresas
hay en la localidad, la diferencia fue −0,26% con una, +0,22% con dos, +0,16%
con tres y +1,32% con seis o más: nada, o levemente al revés, probablemente por
costos de las ciudades grandes. Las cadenas fijan casi el mismo precio en todo
el país: entre su 5% de sucursales más baratas y su 5% más caras, Dia va de
−0,4% a +2,1% y Coto de −4,7% a +2,9%.

Lo que sí pesa es **qué cadenas hay cerca**. Con la canasta comparada en
productos idénticos, la mejor opción disponible en la localidad típica cuesta
9,3% más que la más barata del país (Maxi), y 13,5% más en la Patagonia, donde
la única cadena es La Anónima. Recalculado el 29-10 con los barrios y las
provincias corregidos, la mediana no se movió; ponderado por sucursales es
7,8%. En CABA la mejor opción a mano es casi siempre Dia, a +7,8%: Maxi tiene
una sola sucursal en la ciudad. Maxi es la más barata
disponible en sólo 33 de 382 localidades.

**¿Qué parte de los productos tiene cada cadena?** No se puede saber con SEPA.
Por catálogo daba Carrefour 82%, Coto 80%, Maxi 59% y Dia 26% de los productos
que venden 3 o más empresas, pero Changomás, SuperChangomás e HiperChangomás
informan exactamente el mismo catálogo: es la lista de la empresa, no lo que
tiene cada bandera. Por sucursal, la probabilidad de encontrar los productos
más difundidos dependía de cómo se eligieran: ordenados por sucursales, Dia
salía primera porque tiene 971 y cualquier producto suyo queda entre "los más
difundidos"; ordenados por cadenas, el grupo Changomás salía con 100% porque
informa su catálogo entero en cada sucursal. SEPA es una lista de precios
vigentes, no de stock, y un ranking de surtido premiaría a quien informa más.

---

## Geografía

Las cadenas reportan toda CABA como "Capital Federal". El barrio real se
resuelve por **point-in-polygon** contra la geometría oficial del GCBA, y desde
el 2026-10-29 manda siempre la coordenada (ver abajo).

Hasta el 2026-10-28 eso no le pasaba a Carrefour. La lista de nombres
genéricos ("CIUDAD AUTONOMA DE BUENOS AIRES") se comparaba sin normalizar
tildes, y Carrefour escribe "Autónoma": sus 360 sucursales de la ciudad (326
Express, 25 Market, 8 Carrefour y 1 Maxi) quedaban en una localidad genérica,
fuera de todos los barrios. Quien elegía Palermo en Tu canasta veía Dia, Coto,
Disco y Jumbo, pero ninguna cadena de Carrefour. Se encontró midiendo cuánta
competencia hay en cada localidad: una "localidad" de CABA tenía sólo cadenas
de una empresa. Ahora se compara sin tildes y un test
(`caba_sin_localidad_generica`) falla si una sucursal que cae dentro de un
barrio vuelve a quedar con un nombre genérico.

El mismo día apareció otro: 34 sucursales informadas con la provincia de CABA
estaban en otra parte (22 en la ciudad de Córdoba, otras en el conurbano, en
Chubut y en San Luis), y aparecían como localidades de CABA. Las coordenadas lo
delatan: no caen en ningún barrio. Ahora se les asigna la provincia de la
sucursal más cercana de otra provincia, si está a menos de 50 km, y un test
avisa (sin cortar la corrida) si queda alguna. En 3 el texto y las coordenadas
se contradicen —una "Córdoba" con coordenadas en Mendoza, "Cacheuta" con
coordenadas en Córdoba, una "Capital Federal" justo afuera del límite— y manda
la coordenada: no hay forma de saber cuál de los dos datos de la cadena es el
bueno.

**En CABA, siempre el barrio de la coordenada (2026-10-29).** Hasta ese día se
respetaba el barrio cuando la cadena informaba uno, y sólo se reemplazaban los
nombres genéricos. Al recalcular el costo de no tener opciones aparecieron 58
"barrios" en una ciudad que tiene 48: 23 sucursales en nombres que no son
barrios ("Paternal", "Once", "Pompeya", "Barrio Norte", "V Illa Lugano", "Cdad.
De Bs.As"), cada uno una localidad aparte en Tu canasta, y otras donde la cadena
dice "Almagro" y la coordenada cae en el barrio de al lado. Una lista de nombres
nunca iba a cubrir todas las variantes, así que ahora la localidad de una
sucursal de CABA es el barrio donde cae su coordenada, y el test pide eso
exactamente. Con el cambio quedan los 48 barrios oficiales.

**No sólo CABA (2026-10-29).** Un test nuevo (`localidad_no_es_otra_provincia`)
busca localidades que nombran otra provincia y encontró 12 más: seis Dia de
Jujuy cargadas con el código de San Juan, una Maxi de Jujuy como Salta, las Maxi
de Santa Rosa y Plaza Huincul como Buenos Aires, una Dia de Palermo con
"Buenos Aires" escrito en lugar del código, y la Express de Mendoza que decía
"Córdoba". La corrección por coordenadas pasó a ser general: es sospechosa una
sucursal de "CABA" fuera de todo barrio, una sin código de provincia válido o
una cuya localidad nombra otra provincia, y toma la provincia de la sucursal
limpia más cercana a menos de 50 km (prefiriendo la provincia que nombra, si
hay alguna cerca; si no, manda la coordenada). Si su localidad es un nombre de
provincia o un genérico ("Córdoba", "JUJUY", "CAPITAL FEDERAL"), toma también
la de la vecina: Carrefour usaba "Córdoba" para Jesús María, Alta Gracia o
Carlos Paz. Un nombre propio, aunque no aparezca en ningún otro lado
("Laferrere"), se conserva. Quedaron 19 sucursales corregidas y el test en 0.

## La zona del usuario

**El problema (2026-11).** El sitio pedía "tu zona" de cuatro formas que no se
hablaban: el mapa de Promos, las localidades de Tu canasta, el punto de "Dónde
comprarla", y nada en Más barato, Mismo producto e Inflación. Probado en un
celular por alguien que no lo conocía, el recorrido natural fue elegir la
localidad en el inicio y buscar un producto, y en Mismo producto la zona ya no
estaba. Fue el primer cambio hecho con OpenSpec: la propuesta, las specs, el
diseño y las tareas están en `openspec/changes/zona-compartida/`, y al
archivarse las specs pasan a `openspec/specs/`.

**Una sola zona.** Es un barrio o una localidad con sucursales, se elige una vez
(buscando o con la ubicación del teléfono, que se resuelve en el navegador y no
viaja a la API), se ve en el encabezado de todas las páginas, se recuerda en el
navegador y va en la URL (`?zona=<provincia>:<nombre>`), así cualquier link
copiado la lleva. Un link gana sobre lo guardado; uno con una zona que ya no
existe avisa. "Capital Federal" no es una zona: en CABA la zona es el barrio.

**El precio de un producto sigue siendo el de la cadena.** No hay precio por
sucursal de un código de barras, y la zona no lo inventa: dice cuáles de las
cadenas el usuario tiene cerca y cuál de ellas es la más barata. Es honesto
porque una cadena cobra casi lo mismo en todo el país (ver [lo que se midió y
no se publicó](#lo-que-se-midió-y-no-se-publicó)), y la página lo aclara con o
sin zona.

**Más barato en la zona se recalcula, no se filtra.** Filtrar las filas del
ranking nacional a las cadenas de la zona daba un número engañoso: cada
porcentaje se calculó contra todas las cadenas del país, y una cadena de Palermo
"perdía" contra Maxi aunque Maxi no esté en Palermo. La API recalcula quién gana
producto por producto entre las cadenas de la zona, desde el índice de El mismo
producto que ya tiene en memoria, con las reglas de `mart_quien_gana`. Con todas
las cadenas, el cálculo da el mismo ganador que el mart en las 66 categorías,
con los mismos porcentajes (medido el 12-11). Una cadena sin precios ese día se
ignora: el 11-11 Vea, Disco y Jumbo no tuvieron, y la zona de Palermo no podía
romperse por eso.

**Tu lista también compara en la zona (2026-11-17).** zona-compartida dejó
afuera a Tu lista, y un explore hecho por alguien sin el contexto del proyecto lo
encontró enseguida. Con "Lomas de Zamora" elegida, la lista decía "ahorrás 11%"
contra la Cooperativa Obrera, que no tiene sucursales ahí, y en la misma página
el recuadro del producto sí comparaba en la zona. Ahora la API cotiza la lista
también entre las cadenas de la zona, con el mismo criterio que Más barato: se
recalcula, no se filtra, porque "combinando cadenas" necesita la más barata de
la zona en cada producto. Las cadenas de afuera van en "Otras cadenas del país",
plegadas y sin ahorro. Un producto que no vende ninguna cadena de la zona se
nombra arriba y queda afuera de los totales. Si contara, un solo producto
regional dejaría a la zona sin ninguna cadena completa y sin titular. Change
`lista-en-tu-zona` en OpenSpec.

**El titular del producto también es de la zona (2026-11-17).** Con "Lomas de
Zamora" elegida y la Playadito de 1 kg, el titular decía "7% más caro en Coto y
2 más que en Vea", y en Lomas no hay Vea. Las tarjetas también eran nacionales,
y un recuadro verde más abajo nombraba otra cadena como la más barata de la
zona. Ahora el titular, la tira de precios y las tarjetas salen de la misma
cuenta: la de la zona, si hay zona y alguna cadena de la zona vende el producto
con precio creíble. El recuadro verde se fue, porque decía lo mismo una segunda
vez. Lo nacional queda en una línea debajo de las tarjetas y en "Otras cadenas
del país". Change `respuesta-antes-que-el-titular` en OpenSpec.

**Menos de un 5% es "casi lo mismo".** Un 3% en rosa y en letra grande
presentaba como noticia algo que no lo era. Debajo del 5% (el escalón de Maxi
frente a Carrefour, y el orden de lo que varía una cadena entre provincias), el
titular dice que cuesta casi lo mismo y cuántos pesos de diferencia hay. Tu lista
usa la misma regla desde el mismo día: con Lomas de Zamora decía "ahorrás $ 212
(2%)" en verde, y ahora dice que cuesta casi lo mismo, con la diferencia en
pesos (change `lista-casi-lo-mismo`).

**La respuesta antes que el titular.** En el celular, el titular a sangre ocupaba
media pantalla y el primer resultado de una búsqueda quedaba a 561 px, debajo
del teclado de iOS. Con una búsqueda, un producto elegido o una lista guardada,
el titular de Mismo producto pasa a la versión compacta: medido en WebKit a
414x896, la búsqueda arranca a 294 px y Tu lista a 308. Al hacerlo apareció un
error que ya estaba en producción: la banda sube 40 px y tapaba el botón "←
Todos los productos", que quedaba invisible y no se podía tocar.

**La portada también es de la zona (2026-11-17).** Con "Lomas de Zamora"
elegida, la portada seguía diciendo "Maxi" (la más barata del país) y "ahorrás
12%" entre dos cadenas que casi nadie tiene cerca a la vez. La zona cambiaba
una línea chica, no los titulares. Ahora, con zona:
- **La tarjeta principal** es "Tu súper más barato cerca", con la misma cuenta
  de Más barato en tu zona. En Lomas sigue siendo Maxi, porque Maxi tiene
  sucursales ahí, pero ahora entre las cadenas de Lomas: 62 de 64 categorías.
- **La de ahorro** cotiza la canasta en las sucursales de la zona: 10% entre
  Maxi y Express.
- **Una zona de una sola cadena,** como Rafaela, no recibe ningún ranking ni
  ningún "ahorrás". La portada dice que SEPA informa solo La Anónima y cuánto
  sale la canasta ahí.
- **Lo que más subió** sigue siendo nacional y lo dice en la misma tarjeta.

Change `portada-de-tu-zona` en OpenSpec.

**Tu lista, a mano en todo el sitio (2026-11-17).** La lista vivía al fondo de
Mismo producto, en una sección que no se llamaba "lista", y ninguna otra página
podía saber que existía. Quien tocaba "+ Lista" no veía adónde iba el producto.
Ahora es un estado compartido (`ProveedorLista`), guardado con la misma clave
de siempre, así que ninguna lista armada se perdió. El encabezado de todas las
páginas muestra el changuito con la cantidad de productos, que cambia en el
momento al agregar y también si se cambia en otra pestaña. `/lista` es su
página. La barra del celular no cambió: reemplazar "Inflación" por "Mi lista"
queda para cuando se vea si el acceso del encabezado alcanza. Change
`lista-a-mano` en OpenSpec.

---

## El buscador

**El problema (2026-11-17).** Lo encontró el explore externo y después se
midió con 20 búsquedas de la compra diaria contra el índice real:
- **"leche":** los 8 primeros resultados eran Águila, Actimel, arroz con leche,
  Kinder, Cofler y Cindor.
- **"huevos":** el primero era el huevo Kinder.
- **"azucar":** Coca Cola, Schweppes y Nido.
- **"pan":** mantecas y tapas de empanada.
- **"yerva":** nada.

El buscador buscaba pedazos de texto ("pan" está dentro de "empanada") y
ordenaba por la cantidad de cadenas. Como casi todos los productos están en 13
o 14 cadenas, el orden real era el alfabético.

**Palabras, ortografía y relevancia.**
- **Palabras:** cada palabra buscada tiene que ser el comienzo de una palabra
  del producto. Así "gall" sigue encontrando galletitas.
- **Ortografía:** se igualan b/v, s/z/c suave, y/ll y la h muda, tanto en el
  producto como en la búsqueda.
- **Orden:** lo que se buscó va primero. Primero la categoría que la búsqueda
  nombra entera, después la que nombra en parte. Después, el producto que tiene
  las palabras en el nombre que muestra la página. Recién después cuentan las
  cadenas.

Después del cambio, las 20 búsquedas devuelven su categoría arriba, "yerva"
encuentra lo mismo que "yerba", y las que ya andaban ("fideos", "cafe",
"detergente", "fernet") siguen igual. Una búsqueda tarda menos de 0,1 s: un
vocabulario ordenado por índice deja buscar el prefijo con bisect.

**La memoria (17-11, el mismo día).** Con un set de palabras por producto, el
índice pasó de 101 a 215 MiB (47.637 productos). Cloud Run tiene 512 MiB y
cortó por memoria 13 veces en las revisiones 00028 y 00029. Se me pasó porque
revisé los logs justo después del deploy, antes de que llegara tráfico. Ahora
las palabras visibles y las de la categoría se guardan como tuplas de cadenas
internadas: la misma palabra en miles de productos es un solo objeto, y la
tupla de cada categoría se comparte. El texto completo, que solo sirve para
armar el vocabulario, queda como un único texto. El índice ocupa 105 MiB más
8 de vocabulario, con los mismos resultados en las 20 búsquedas. Desde ahora,
los logs se revisan unos minutos después del deploy y no enseguida.

**Lo que no se arregló, a propósito.**
- **Pañales con "pan":** sin tilde, "pañal" empieza con "pan". Sacarlo haría
  que "panales" no encontrara pañales, así que queda en la lista, después de
  todo lo que dice "pan" entero.
- **Errores de clasificación:** son de la categoría de dbt, no del buscador.
  Actimel figura como "Leche fluida" y el "JABON PAN BLANQUEADOR" como Pan.
  Quedan anotados para revisar la clasificación.

---

## Las promos de tu lista

**El problema (2026-11-18).** Lo que se aprende en el sitio se aprende una
sola vez: "Maxi", "da casi lo mismo". Lo que cambia cada semana son las promos
de lo que uno compra, en el súper que tiene cerca, y no estaban conectadas con
la lista ni con el detalle de un producto. Fue el candidato 5 del explore
externo.

**Lo que se midió antes de hacerlo.** Con las promos del 17-11, leídas con
`list_rows` y sin cuota:
- **Volumen:** había 103.272 promos válidas. 8.963 de los 47.637 productos de
  Mismo producto tenían al menos una.
- **Productos comunes con promo cerca:** se tomaron los 400 productos que están
  en más cadenas y se contó cuántos tienen una promo a menos de 3 km del centro
  de la zona.
  - Caballito: 122.
  - La Plata: 103.
  - Palermo: 85.
  - Lomas de Zamora: 62.
  - Bahía Blanca: 59.
  - Rafaela: 12.
- **Si conviene:** en casi 9 de cada 10 de esos casos, la promo queda debajo
  del precio más bajo del producto.
- **Quién informa promos:** casi todas las de productos comparables son de
  Cooperativa Obrera, Carrefour y Día. Coto informó 37, y Disco y Jumbo,
  ninguna.

**Las reglas.**
- **Cerca:** a menos de 3 km del centro de la zona (`RADIO_PROMOS_KM` en
  `api/mapa_promos.py`). Usar las sucursales del lugar dejaba afuera a la de
  cuatro cuadras que está en el barrio vecino, y en un barrio chico quedaban una
  o dos.
- **Vigente:** la fecha de fin se lee de la leyenda ("hasta 23/11/2026", "al
  30/11/2026", "hasta el 2026-11-20"), y la trae el 98% de las promos. Las
  vencidas se descartan, porque los datos son del día anterior y una promo
  "hasta el 17/11" leída el 18 ya no sirve. Las de Día "hasta agotar stock" van
  sin fecha.
- **Qué promo se muestra:** solo la que deja el producto más barato que la
  cadena más barata de la zona. Un café de Carrefour a $ 6.383 en promo no
  sirve si Maxi lo vende a $ 5.989 sin promo. Es una sola regla
  (`promosQueConvienen`), la misma en Tu lista y en el detalle.
- **Por producto:** una promo por cadena, la más barata, y hasta 3 en el
  detalle. En Tu lista, la mejor.

**Por qué el total no las incluye.** Los totales comparan el precio de cada
cadena en todo el país. Las promos son por sucursal, y Coto, Disco y Jumbo casi
no las informan. Sumarlas al total haría ganar a la cadena que más informa, no
a la que cobra menos. Por eso van aparte, debajo de cada producto.

**Costo y memoria.** Sale del índice del mapa, que ya estaba en memoria. Sumar
`id_producto` y el índice por producto lo llevó de 18,1 a 22,1 MiB con las
filas reales. Una lista de 60 productos en Palermo se resuelve en 4 ms y no
consulta BigQuery.

---

## La historia del precio

**El problema (2026-11-18).** El sitio sabía cuánto costaba un producto hoy,
pero no cuánto costaba antes. `int_precio_producto_cadena` vence a los 3 días y
el crudo a los 4, así que no podía decir "tu yerba bajó" ni ayudar con la
sospecha de "inflan y después descuentan". Fue el candidato 6 del explore
externo, con la condición de medir antes el almacenamiento. La historia solo se
junta desde el día en que se empieza a guardar: el pasado no se puede rehacer.

**Lo que se midió.** Con la metadata de las tablas (`__TABLES__`, sin cuota) y
dos consultas chicas sobre `int_precio_producto_cadena` del 16 y 17-11, unos
100 MiB en total:
- **Espacio:** 7,1 de los 10 GiB gratuitos estaban usados.
- **Foto diaria:** 229 mil precios por producto y cadena, unos 8,5 MiB por
  día. Llenaba lo que queda en menos de un año.
- **Cuánto cambia:** de un día al otro cambiaron 2.950 precios (1,3%) y
  aparecieron 1.023 productos.
- **Ruido de la mediana:** 1.539 de esos cambios vinieron con otra cantidad de
  sucursales informando, y la mitad era de menos del 3%. Es la mediana que se
  mueve cuando entra o sale una sucursal, no la cadena que remarca. Los 1.411
  con las mismas sucursales eran casi todos del 3 al 10%.

**La decisión: un registro de cambios.** `historico_precio_producto` guarda una
fila por producto y cadena solo cuando el precio cambia (o la primera vez). La
primera corrida guardó 204.719 filas en 10,2 MiB. La segunda (datos del 18-11)
sumó 6.962 filas en 0,34 MiB, más que los 4 mil estimados: 5.814 precios que
cambiaron (3.948 de ellos en 3% o más) y 1.148 productos nuevos, casi todos de
Día. Son unos 125 MiB por año. Una foto semanal ocupaba unos 440 MiB por año y
perdía el día del cambio.
- **La fuente es `mart_mismo_producto`:** el mismo precio creíble que muestra
  la página. Los saltos de más del 50%, que son errores de carga, no entran, y
  el "antes $ X" coincide con lo que la página mostró ese día.
- **Una cadena que no vino o viene arrastrada** no suma filas: no está en el
  mart, o trae el mismo precio.
- **Es data irrecuperable,** como los otros históricos: nunca `--full-refresh`.

**Qué se cuenta.** `mart_cambio_precio` se queda con el último cambio de cada
producto y cadena si pasó en los últimos 30 días, fue de 3% o más y es el
precio de hoy (`cambio_precio_dias` y `cambio_precio_minimo_pct` en
`dbt_project.yml`). La API lo pega a cada precio del índice de Mismo producto.
El detalle dice "Bajó 10% el 25/11 (antes $ 4.000)" y Tu lista dice "Bajó 6%
en Día el 25/11", solo si cambió en la cadena más barata de tu zona. Sin cambio
no se dice nada, nunca "sin cambios": antes de empezar a guardar no se sabe.

**Costo.** Las dos tablas nuevas leen unos 30 MiB por corrida, contra un tope
de 32 GiB por día. La API las lee con la Storage Read API, sin cuota. Queda para
cuando haya un mes de historia: si una promo es real o si el precio subió antes.

---

## Compartir por WhatsApp

**El problema (2026-11-18).** En la Argentina, un sitio de precios se difunde
por WhatsApp, en el grupo del barrio o el de la familia. Le pedí un producto a
producción con el user agent de WhatsApp y llegó el `index.html` genérico, sin
`og:title`, `og:description` ni `og:image`. WhatsApp no ejecuta JavaScript,
así que los links llegaban sin tarjeta, solo con una URL de Cloud Run que
parece un virus. Tampoco había botón para compartir, ni `apple-touch-icon`, ni
manifest. Y el favicon era el logo por defecto de Vite. Fue el candidato 7 del
explore externo.

**La tarjeta la arma la API.** `servir_frontend` completa el `<head>` del
`index.html` compilado según la página (`api/compartir.py`):
- **Qué cambia:** la descripción, `og:title`, `og:description`, `og:url` y el
  host de la imagen.
- **El host** sale del pedido, con https detrás del proxy de Cloud Run. Si un
  día hay dominio propio, sigue andando sin tocar nada.
- **Todo texto se escapa:** el código del producto llega por la URL y la
  descripción viene de SEPA.
- **El `<title>` de la pestaña no se toca:** la app no lo actualiza al navegar,
  y entrar por el link de una yerba dejaría su nombre en la pestaña aunque
  después se pase a Inflación.
- **Alternativas descartadas:** prerenderizar no sirve para 47 mil productos,
  y detectar crawlers por user agent es frágil.

**Un producto dice su rango, no la cadena más barata.** "Playadito yerba mate
suave 500g · de $ 2.490 a $ 2.850 en 14 cadenas", y debajo "Mirá dónde conviene
en tu zona". La cadena que conviene depende de la zona y esa regla vive en el
frontend. Repetirla en el servidor sería tenerla en dos lugares, y un link de
Palermo abierto en Rosario nombraría una cadena que ahí no está.

**Sin esperar.** Si el índice de Mismo producto no está en memoria, va la
tarjeta general y el índice se carga en segundo plano. En una instancia fría
la carga tarda unos 4 segundos, y el crawler corta antes.

**El botón Compartir.** Está en el detalle del producto:
- En el celular abre el menú nativo (`navigator.share`). En la computadora
  copia el link.
- El texto es el nombre del producto y el titular que muestra la página,
  tomado de la pantalla. Así dice exactamente lo mismo, sin una segunda regla.
- "En tu zona" pasa a ser la zona de quien comparte ("En Palermo, CABA cuesta
  casi lo mismo..."): para quien lo recibe, "tu zona" no es la suya.

**Íconos.** El favicon es ahora el chango de la marca. `apple-touch-icon`, los
íconos del manifest y la imagen de 1200x630 se generan una vez con
`frontend/scripts/generar_iconos.py` (Playwright) y quedan commiteados. No
van en el build porque casi nunca cambian.

**Queda afuera:**
- **Dominio propio:** cuesta plata y es decisión de Rodrigo.
- **Una imagen por producto.**
- **Compartir Tu lista entera:** primero hay que decidir si reemplaza o suma a
  la lista de quien la recibe.
- **Pedidos HEAD:** el sitio responde 405, igual que antes. WhatsApp pide con
  GET.

---

## Tu canasta confiable

**El problema (2026-11-18).** El diferencial de Tu canasta es que los números
se puedan creer, y tenía tres fallas que decían "no está terminado". Fue el
candidato 8 del explore externo. Las reproduje en producción, en WebKit a
414 px, con la canasta del INDEC para 2 adultos y 2 chicos en Lomas de Zamora.
- **El "+" no se veía en el celular.** La caja del control medía 77 px y el
  contenido 106 px, y el "+" caía en x=117, fuera del `overflow-hidden`. En
  Pan desaparecía el "−". La regla que lleva los campos a 16 px, para que iOS
  no haga zoom, agrandaba el número, y el control se encogía dentro de la fila.
  El campo, además, era `type=number` y mostraba "20.86" con punto.
- **El mapa del paso 4 abría en el Obelisco** con la zona en Lomas. Si se
  tocaba el centro del mapa, recomendaba sucursales de San Telmo y daba "en
  una sucursal $ 738.063".
- **Dos totales que parecían la misma cuenta.** El paso 3 decía "En Maxi te
  sale unos $ 514.122". Aun con el punto en Lomas, el paso 4 daba Carrefour
  $ 676.951 (31 categorías), y el paso 3 tenía a Carrefour en $ 556.269. La
  diferencia: el paso 3 suma solo las 25 de 32 categorías que venden todas las
  cadenas, para comparar parejo. Quedan afuera azúcar, papa, verduras, frutas,
  pollo, pescado y huevos, y eso se decía en letra chica.

**Lo que se cambió.**
- **El control de cantidades:**
  - No se encoge. En el celular comparte la fila con la gama, que baja de línea
    si no entra; en la computadora queda la grilla de siempre (`sm:contents`).
  - El campo es de texto con teclado decimal. Muestra "20,86", acepta coma o
    punto y aplica el valor al salir del campo, para no pelear con lo que se
    está escribiendo.
  - Medido en WebKit: 32 de 32 filas enteras a 375 y a 414 px.
- **El paso 4 arranca en el centro de la zona** y calcula sin tocar nada. Tocar
  el mapa lo mueve; cambiar la zona lo lleva a la nueva. En Lomas, las
  sucursales quedaron a menos de 1,5 km.
- **El paso 3 dice qué suma.** Su titular empieza "En las 25 categorías que
  venden todas, …". Debajo, una línea visible dice que verduras, frutas, pollo,
  huevos y 3 más no entran ahí y que el paso 4 sí las suma. El total de la
  canasta entera es uno solo, el del paso 4.

**Lo que no se hizo:** completar el paso 3 con las 7 categorías que faltan al
precio de la zona, igual en todas las cadenas. Los números se habrían parecido,
pero diría "en Maxi te sale $ X" contando verdura que Maxi no informa.

**Un caso que queda así a propósito:** una canasta guardada con otra localidad
(Córdoba con la zona en Rosario) compara cadenas en Córdoba y busca sucursales
en Rosario. El paso 4 es "cerca tuyo", y tu zona es dónde estás.

---

## Las cadenas cerca de tu zona

**El problema (2026-11-18).** Para el sitio, "las cadenas de tu zona" eran las
que tienen sucursal dentro del barrio o de la localidad. Medido en `/zonas`,
331 de las 559 zonas (59%) tenían una sola cadena. En 147 de ellas había otra
empresa a menos de 3 km del centro, entre ellas las 10 de CABA. En Villa
Soldati la portada decía "Tu única cadena cerca: Día — SEPA informa una sola
cadena en tu zona", con cuatro empresas o más a unas cuadras. Más barato decía
que no había con qué comparar. El barrio es un límite administrativo, y la
gente compra cerca, cruce o no el límite. Fue el candidato 9 del explore
externo, que pedía "decirle la verdad al que no tiene opciones". Medirlo mostró
que primero había que dejar de decir que no tenía opciones a quien sí las
tiene.

**La regla.** Las cadenas de una zona son las que tienen sucursal en el lugar
más las que tienen una sucursal a menos de 3 km de su centro
(`RADIO_CERCA_KM` en `api/mapa_promos.py`). Es el mismo radio de las promos
cercanas: una sola definición de "cerca". El cambio está en `/zonas`, así que lo
toman juntos la portada, Más barato, Mismo producto y Tu lista. Con 5 km
quedaban 176 zonas de una sola cadena, casi lo mismo que con 3. Con 3 se suman
menos cadenas lejanas en el conurbano denso.
- **Antes:** 331 zonas con una cadena, 90 con dos y 138 con tres o más.
- **Después:** 186, 85 y 288. Ninguna de CABA queda con una sola.
- **Villa Soldati:** pasa a tener Coto, Día, Express y Jumbo, y Más barato dice
  "En tu zona, Coto es la más barata en 34 de las 47 categorías".
- **Costo:** armar `/zonas` pasó de 25 a 267 ms, y por eso se arma una vez por
  carga del índice del mapa. Antes se armaba en cada pedido.

**Lo que cuesta no tener opciones.** Las 186 zonas que siguen con una sola
cadena son 90 de Día, 40 de La Anónima, 34 de la Cooperativa Obrera y 12 de
Vea, y la otra cadena más cercana está a una mediana de 50 km.
- **La portada dice a cuánto está:** en Rafaela, "La otra cadena más cercana,
  Cooperativa Obrera, está a unos 35 km"; en Esquel, a 195 km.
- **Y cuánto saldría la misma canasta** en la cadena más barata del país:
  "En Maxi (Carrefour), la más barata del país, sale 12% menos".
- **Se presenta como un costo, no como un "ahorrás":** la más barata del país
  no está a mano. Es el dato de "lo que sí pesa es qué cadenas hay cerca", que
  estaba medido desde octubre y no se había publicado. Con el ranking del
  18-11, Día está +8% sobre Maxi y La Anónima +14%.
- **Sin total nacional, sin cifra:** la Cooperativa Obrera y Vea no venden el
  80% de la canasta y no tienen total nacional. Ahí la portada dice solo la
  distancia.

**Queda como estaba:**
- **Tu canasta** sigue cotizando por localidad, como dice su spec. En Villa
  Soldati el paso 3 puede comparar el país, rotulado como tal.
- **El ahorro de la portada,** cuando la localidad no alcanza para cotizar,
  sigue siendo el del país, y lo dice.

---

## Formatos de una cadena

**El problema (2026-11-18).** Mismo producto mostraba Changomás,
SuperChangomás e HiperChangomás en tres filas, y Carrefour, Market y Express
en otras tres. El titular decía "3% más caro en Coto que en Changomás y 1 más",
que no se entiende. El explore externo propuso juntarlos: "Changomás (3
formatos)", "Carrefour (Market, Express, Hiper)" y Maxi aparte. Fue el
candidato 10.

**Lo que se midió antes.** Sobre los 47.740 productos de Mismo producto, las
banderas de una empresa no cobran lo mismo:

| Par | Productos | Mismo precio | Diferencia |
|---|---|---|---|
| Carrefour y Market | 18.425 | 89% | — |
| Carrefour y Express | 5.599 | 44% | p90 de 8% |
| Changomás y SuperChangomás | 27.696 | 36% | SuperChangomás 4% más barata de mediana |
| Changomás e HiperChangomás | 27.725 | 38% | — |
| Vea y Disco | 9.320 | 9% | Vea 4% más cara |

Juntar cada empresa en una fila habría escondido diferencias reales.
SuperChangomás es una de las dos cadenas que explican el ahorro por comparar
(ver "Dispersión y reglas de precio").

**La decisión: agrupar solo lo que cobra exactamente lo mismo.** En el detalle,
los formatos de una cadena con el mismo precio, la misma marca de creíble y la
misma fecha van en una fila: "Changomás · HiperChangomás", con las sucursales
sumadas (`utils/formatosDeCadena.ts`).
- **Los que cobran distinto siguen separados.** En el aceite Cocinero, Carrefour
  y Market ($ 6.925) van juntos, y los tres Changomás ($ 6.649, $ 6.929 y
  $ 7.069) y Express ($ 7.129) quedan en sus filas.
- **Quedan afuera:** Maxi, porque tiene otra lógica de precio (−5% de mediana
  contra Carrefour), y Vea, Disco y Jumbo, porque para la gente son súper
  distintos.
- **Las filas por producto** bajan de 4,29 a 3,48, y de 14 a 12,4 en los 400
  productos más comunes.
- **Los titulares y extremos** nombran las cadenas: hasta tres con "y", y "y N
  más" solo con más de tres. Los formatos al mismo precio se nombran juntos. En
  10.501 productos, el precio más bajo lo comparten formatos de una misma
  empresa, y de ahí venía el "y 1 más".

**Qué no cambia:** ningún precio, total ni porcentaje. Tu lista, Más barato y
Tu canasta siguen por bandera, porque sus totales sí difieren. Las cadenas de
una zona también siguen por bandera: una zona puede tener un Express y no un
Carrefour.

---

## Arreglos del segundo explore

**El problema (2026-11-19).** Un segundo explore externo, con un agente sin
contexto que usó el sitio en el celular antes de leer el código, encontró ocho
errores concretos. Los verifiqué contra la API y el código, y se confirmaron
todos.

**Los arreglos.**
- **Unidades escritas en el buscador.** "leche la serenisima 1 litro" daba 0
  resultados, porque los tamaños se indexan como "1l" y "1lt", y "litro" no es
  el comienzo de ninguna palabra. `normalizar` lee "litro(s)", "kilo(s)",
  "gramo(s)" y "mililitro(s)" después de un número como su abreviatura. El
  índice no cambia.
- **Buscar zona por palabras.** "lomas zamora" no encontraba Lomas de Zamora,
  porque se buscaba el texto entero dentro del nombre. Ahora cada palabra tiene
  que ser el comienzo de una palabra del nombre o de un alias, sin contar "de",
  "la", etc.
- **Un mismo lugar con nombres parecidos es una zona.** Laferrere aparecía tres
  veces ("Laferrere", "Gregorio de Laferrere" y "Gregorio Laferrere"). Se
  juntan los lugares de la misma provincia a menos de 2 km cuando las palabras
  de un nombre están contenidas en las del otro. Medido con los datos del día:
  las zonas pasan de 559 a 531, y 26 quedan con alias (Villa Lugano con Lugano,
  José C. Paz con y sin punto, Paternal y La Paternal, Bariloche, Escobar,
  Derqui...). Alguno es un barrio y su ciudad (Nueva Córdoba en Córdoba). Con
  las cadenas a 3 km dice casi lo mismo, y "nueva cordoba" sigue encontrando
  la zona. Un link viejo con un alias abre la zona.
- **El ejemplo de la portada, con zona.** La Coca Cola comparaba todas las
  cadenas del país sin decirlo. Con zona compara las cadenas cerca, si al menos
  dos venden el producto. En Palermo pasa de +26% (Maxi a La Anónima) a +7%,
  entre Vea y Market. Si no alcanzan, dice "en todo el país".
- **"N sucursales en el país"** en la sección "En tu zona" del detalle: el
  conteo es de toda la cadena.
- **"Ninguna cadena cerca informa precio de"** en vez de "No se consigue en tu
  zona", en Tu lista y en el titular del detalle. SEPA es una lista de precios,
  no de existencias.
- **El paso 4 de Tu canasta compara lo comparable.** El "Mejor total" es el que
  cubre más categorías y, a igual cobertura, el más barato, igual que el orden
  de la API. "Contra una sola" solo resta si cubren lo mismo, y cada opción
  incompleta dice qué le falta ("sin Papa y tubérculos").
- **El paso 4 arranca en 3 km,** el radio de "cerca" de la zona y las promos.
  Con 2 km, el Maxi de Lomas, a 2,5 km, estaba en la zona y no en este paso.
  Ahora entra en la opción de 3 sucursales.

**Lo que queda para otro change:** un total "con las promos de tu súper
cerca". En Tres Arroyos, la Playadito de 1 kg sale $ 4.890 en Vea frente a
$ 5.199 en la Coope (precio de lista), pero la Coope de calle Colón la tiene en
promo a $ 4.080. El titular recomienda Vea con la promo más barata a la vista.

---

## El total con las promos cerca

**El problema (2026-11-19).** Tu lista y el titular de un producto comparan el
precio de lista de cada cadena. Las promos se muestran debajo, pero no entran en
ninguna cuenta. El segundo explore externo mostró que así la recomendación puede
salir al revés: en Tres Arroyos, el titular dice que la Playadito de 1 kg
conviene en Vea a $ 4.890, y más abajo, en la misma pantalla, la Cooperativa
Obrera de Colón 33 la tiene en promo a $ 4.080.

**Lo que se midió.** Con los índices en memoria, sin cuota:
- **Canasta de 20 productos genéricos:** las promos no cambian el ganador en
  ninguna de 63 zonas. Esos productos casi no tienen promos.
- **Listas realistas** (200 listas de 12 productos al azar entre los 400 más
  comunes, en 60 zonas), con promos vigentes sin compra múltiple y de una sola
  sucursal por cadena a menos de 3 km:
  - la cadena más barata cambia en la mitad de las listas (mediana 52,5%, p75
    64%);
  - en 45 de las 60 zonas cambia en el 20% o más;
  - cuando cambia, la lista sale un 4% menos de mediana (13% en Lanús).
- **Quién pasa a ganar:** casi siempre Día. Sus promos son precios
  promocionales de la sucursal, sin club ni tarjeta. Los "2do al 50%" están
  marcados como compra múltiple y no cuentan.
- **Promos por sucursal que informa cada cadena:** Día 960, Carrefour 956,
  Cooperativa Obrera 707, Market 224, La Anónima 214, Express 69, Coto 33, Maxi
  26. Los tres Changomás, Vea, Disco y Jumbo no informan ninguna.

**La decisión.** El total de siempre sigue a precio de lista: meter las promos
haría ganar a la que más informa (ver "Las promos de tu lista"). La otra cuenta
va aparte:
- **En Tu lista, debajo del total de siempre:** "Con las promos de esta semana
  conviene Cooperativa Obrera (Colón 33 · Tres Arroyos): te sale $ 34.471, 12 de
  tus productos en promo, hasta el 30/11".
  - Se calcula en una sola sucursal real por cadena, la que deja la lista más
    barata (`promos_de_lista`, `POST /api/promos/lista`). Responde en 17 a 52 ms
    desde memoria.
  - Solo aparece si cambia el ganador o baja el total un 1% o más.
- **Las cadenas que casi no informan se nombran** (menos de 50 promos por
  sucursal, `POCAS_PROMOS_POR_SUCURSAL`): "Vea casi no informa promos en SEPA:
  si tiene, no están en esta cuenta".
- **En el detalle, debajo del titular:** "Con promo: $ 4.080 en Cooperativa
  Obrera (Colón 33 · Tres Arroyos), hasta el 30/11". El titular de precio de
  lista no cambia.

---

## La lista en el centro

**El problema (2026-11-19).** Tu lista es la tarea con más valor del sitio:
armar lo que compro siempre y ver dónde me conviene, ahora también con las
promos cerca. Pero en el celular se llegaba solo por un changuito sin texto. La
barra de abajo tenía Inflación, la sección más analítica, y la portada no
arrancaba por la lista. Lo marcaron los dos explores externos.

**La barra.** Rodrigo decidió que "Mi lista" ocupe el lugar de Inflación en la
barra del celular, con el número de productos. Inflación sigue en el menú de la
computadora, en "¿Qué querés saber?" de la portada y en `/inflacion`.

**El armado rápido.** Son 40 básicos en seis grupos (almacén, desayuno,
lácteos, bebidas, limpieza, higiene), y cada uno se suma o se saca con un toque.
- **De dónde salen:** de una lista fija de búsquedas (`BASICOS` en
  `api/mismo_producto.py`) que la API resuelve con el buscador del sitio, una
  vez por día.
- **Por qué búsquedas y no categorías:** el producto "más común" de cada
  categoría de la canasta del INDEC daba una polenta para Harina, un
  endulzante para Azúcar, una crema para Quesos y un postre para Yogur. Con el
  texto que tipea la gente salen Playadito 1 kg, Natura 1,5 L, Ala o Favorita,
  casi siempre en 13 o 14 cadenas.
- **Un detalle que apareció al probarlo:** con la lista vacía, el primer toque
  la convertía en "lista con productos" y el armado se plegaba, justo cuando se
  estaba armando. Ahora, si se entró con la lista vacía, el armado queda arriba
  y abierto toda la visita, y la comparación aparece debajo. Con productos al
  entrar, queda plegado en "Sumar básicos".

**La portada.** Con productos guardados, debajo del buscador aparece "Tu lista
· 3 productos: en Vea te sale $ 13.465", con el mismo pedido y la misma vista
que Tu lista. Con zona compara las cadenas cerca. Sin lista, la portada queda
como antes.

---

## Todos los supermercados de SEPA y Farmacity

**Lo que se midió (2026-11-19).** Se bajaron a la PC los 7 ZIP diarios de SEPA
minoristas del 13 al 19 de noviembre, sin tocar BigQuery. El portal no acepta
descargas parciales, así que se bajaron enteros, unos 330 MB cada uno.
- **SEPA trae 17 o 18 comercios por día, no decenas.** Los 8 que se cargaban
  eran el 96% de las filas: 14,4 millones de precios por día.
- **Lo que faltaba** son unas 540.000 filas por día (4%) y 506 sucursales:
  - seis supermercados regionales: Toledo (Mar del Plata, 28), Comodín y Maxi
    Comodín (Jujuy, 26), Mariano Max (Córdoba, 11), California (Misiones, 7),
    La Agrícola Regional (Crespo, 4) y Unicoop (Patagones y Viedma, 3);
  - Farmacity y Simplicity: 335 sucursales en 17 provincias, unos 1.950
    códigos de barras;
  - tres tiendas de estaciones de servicio (Axion, Deheza, Estación Lima), con
    unos cientos de productos.
- **Casi no abren territorio nuevo:** muy pocas de esas sucursales quedan a más
  de 3 km de una que ya estaba. Suman una cadena más en ciudades grandes fuera
  de CABA, que es lo que Rodrigo prioriza. Para crecer de verdad en cobertura
  haría falta otra fuente: SEPA solo obliga a las cadenas grandes.
- **Libertad (comercio 16)** estaba en la lista y no vino ningún día de esa
  semana. Queda por si vuelve.
- **Costo:** +4% de filas, dentro del plan gratuito. Eran 7,2 GiB guardados y
  unos 405 GiB por mes de consultas en noviembre.

**Qué entra y cómo.**
- **Los seis regionales entran como cadenas plenas.**
- **Las estaciones de servicio quedan afuera.**
- **Farmacity entra como farmacia**, por decisión de Rodrigo. Compara sus
  productos en El mismo producto, con "farmacia" junto al nombre, y compite en
  Más barato solo en Higiene y Bebés. No cuenta como cadena cerca, no arma
  zonas y no entra en los totales de Tu lista ni en Tu canasta.
- **La regla vive en un solo lugar.** El formato y si el comercio informa
  todos los días están en `seeds/mapeo_cadenas.csv`. Los rubros de la farmacia
  están en la variable `rubros_farmacia` y en la macro `compite_en_rubro`. El
  test `farmacia_solo_en_sus_rubros` lo vigila desde afuera.

**Comercios que no informan todos los días.** En la semana medida, Farmacity
faltó 1 día y La Agrícola 2. El control `cadenas_del_ultimo_dia_completas`
habría puesto el pipeline en rojo cada vez, así que esos dos están marcados con
`informe_diario = false` y el control no los cuenta. Esos días El mismo
producto usa su último precio dentro del tope de arrastre, como con cualquier
cadena que falta. El control sigue igual para el resto.

**Inflación no salta.** Las series se encadenan por cadena y categoría, y solo
cuentan las que tienen el mes completo. Una cadena nueva entra al mes de
llegar, y una intermitente no entra.

**Un bug viejo que apareció de paso.** `deteccion_cambios_comercio` marcaba los
21 comercios como "modificación" todos los días, porque comparaba la fila
entera y `stg_comercio` suma columnas propias que la foto anterior no tiene.
Ahora compara solo lo que viene de SEPA (CUIT, razón social y bandera).
`deteccion_cambios_sucursales` marca 1.122 de 2.510 sucursales con las mismas
columnas a los dos lados, así que ahí la causa es otra. Queda para revisar
aparte.

**Cómo se probó sin tocar producción.**
- Los modelos se construyeron vacíos (`--empty`, 0 bytes procesados) en un
  dataset aparte, `dbt_prueba_comercios`.
- Los tests unitarios corrieron ahí, incluido uno nuevo con una farmacia que
  gana Perfumería y no aparece en Golosinas.
- Que `dbt seed` sin `--full-refresh` acepta las columnas nuevas del seed se
  verificó cargando primero la versión vieja.
- La memoria del índice de El mismo producto se estimó con los ZIP: unas 13.400
  filas de precio más sobre unas 205.000, un 6,5%.

---

## Compartir y pegar la lista

**El problema (2026-11-19).** En una familia la compra se arma entre varios,
pero Tu lista vivía solo en el navegador de quien la armó. Una lista que
llegaba escrita por WhatsApp había que cargarla producto por producto. Lo marcó
el segundo explore externo como oportunidad 3.

**Compartir.** "Compartir lista" abre el menú nativo del celular con un texto
que se entiende sin abrir el link: los productos con sus cantidades y dónde
sale menos, en la zona de quien comparte. Donde no hay menú nativo, copia el
texto y el link juntos.
- **El link lleva la lista entera** (`/lista?l=<id>x<cant>-…`, unos 800
  caracteres con 50 productos) y no se guarda nada en el servidor.
- **Separadores:** `x` y `-`, porque WhatsApp y los navegadores no los
  escapan, y la coma sí.

**Abrir una lista recibida.** Se muestra cotizada en la zona de quien la abre y
no toca la lista guardada hasta que la persona elija, por decisión de Rodrigo.
- **Sin lista propia:** se guarda directo.
- **Con lista propia:** se elige entre sumar (en un producto repetido queda la
  cantidad mayor) y reemplazar.
- **Al resolverla,** el parámetro sale de la URL: recargar no repite la
  pregunta.

**Pegar una lista escrita, sin IA.** Rodrigo eligió el buscador del sitio en
vez de Gemini: es gratis, instantáneo y no hay nada que abusar. Cada renglón
pierde las viñetas, los emojis y las palabras de relleno, y separa la cantidad
del principio o del final. "1 kg" se reconoce como tamaño y no como cantidad.
Si el renglón nombra solo un básico ("yerba", "leches"), va primero el producto
de los básicos. La persona ve lo elegido y lo puede cambiar o sacar antes de
sumar.

**Medido sobre 30 renglones típicos de una lista.**
- **Antes**, con el buscador solo:
  - "2 leches" buscaba el 2% de grasa;
  - "1 docena de huevos" no traía nada;
  - "yerba" daba primero "Amanda P4 N Trad".
- **Ahora**, en un solo pedido de 0,13 s, los 30 renglones traen candidatos y
  en 27 el primero es razonable. Los otros tres se arreglan con un toque:
  - "galletitas" trae primero unas Saladix de jamón;
  - "leche la serenisima" trae la Protein;
  - "atún" ofrece una lata de Whiskas como tercera opción.

**Un detalle del E2E.** WebKit sin interfaz no resuelve el portapapeles, así
que la prueba usa un portapapeles de prueba y verifica el texto exacto que se
copia.

---

## Mis gastos y la barra nueva

Openspec `mis-gastos-y-barra-nueva` (2026-11-22). Mis gastos registra lo que
cada persona gasta en el súper a partir de la foto del ticket o de un monto
anotado a mano. Todo queda en el teléfono, sin cuentas.

**La barra del celular cambió.** Pasó a ser Promos | Buscar | Mi lista |
Mis gastos | Más. "Buscar" es Mismo producto, adonde lleva el buscador de la
portada, y es lo que más usa la gente de afuera (unas 25 IP distintas en los
registros del mes, contra 59 en total). Más barato y Tu canasta pasaron a la
hoja "Más", junto con Inflación y Cómo se calcula. Más barato repite lo que ya
dice la tarjeta principal de la portada. A Tu canasta la abrieron unas 9 IP,
pero solo 3 la usaron con la IA, y se va a unir con Mi lista en otro change.
En la computadora el menú conserva todo y suma Mis gastos.

**Qué imprime cada cadena** (fotos públicas de prensa, 2026-11-22):
Carrefour y Jumbo imprimen el código de barras de 13 dígitos debajo de cada
producto. Coto imprime código interno + código de barras con un cero adelante,
y las promos como línea propia con importe negativo. Día imprime solo texto
abreviado ("GASEOSA COCA SIN AZU"). Los pesables traen un código que empieza
con 2 con el precio adentro. Varios imprimen DNI y tarjeta parcial. De ahí
salen los dos caminos del cruce: por código, directo contra el índice de
Mismo producto, y sin código, por candidatos de la misma cadena con precio
parecido (±15 %), elegidos por Gemini o descartados.

**La foto no se guarda y la respuesta es una lista blanca.** La API arma la
respuesta solo con los campos previstos (cadena, CUIT del comercio, sucursal,
fecha, comprobante, total, líneas y descuentos), así que un DNI que el modelo
transcriba igual nunca sale. El modelo devuelve las líneas de cada foto por
separado y la API saca el tramo repetido donde dos fotos se superponen. Dos
líneas iguales dentro de una misma foto se quedan: son dos compras.

**"Hubieras pagado" compara precio de lista con precio de lista.** Se toman
las líneas vinculadas tal como figuran en el ticket, antes de los descuentos,
y se comparan con la cadena de la zona más barata que tiene todos esos
productos. Para comparar, lo vinculado tiene que cubrir al menos el 60 % del
ticket. Comparar lo pagado con promos contra precios de lista haría parecer
cara una compra hecha con descuento. El umbral vive en `api/tickets.py` y la
página lo recibe en cada lectura.

**Gemini con facturación.** En el plan gratis, Google puede usar lo que se le
manda para mejorar sus productos, y eso contradice el aviso de que la foto no
se guarda. Antes del deploy se activa la facturación del proyecto de la clave.
Con Flash-Lite cuesta del orden de USD 0,001 por ticket. Topes en memoria: 20
tickets por hora por IP y 2.000 por día, por instancia.

**Medido con Gemini real** (`gemini-flash-lite-latest`, 2026-11-22, las
cuatro fotos públicas, sin guardarlas en el repo):

| Ticket | Líneas leídas | Vinculadas | Cómo |
|---|---|---|---|
| Carrefour | 3 de 3 | 3 | por código |
| Coto (dos recortes) | 4 de 4 visibles + 1 promo | 2 | por código; el pesable y el repasador (código interno) no |
| Jumbo | 1 de 1 | 1 | por código |
| Día | 1 de 1 | 0 | sin código; el candidato no entró por precio |

- Las 7 líneas con código de barras se vincularon, y la categoría salió bien
  en todas. Se tarda entre 3 y 6 segundos por ticket.
- El código del vino de Coto lo leyó mejor el modelo (`07790805012027`) que
  la transcripción a mano de los fixtures.
- La promo de Coto salió como descuento.
- En ninguna respuesta apareció el DNI ni la tarjeta, que la foto de Jumbo
  muestra.
- En Día la Coca sin azúcar no tuvo candidato: el ticket es de enero de 2025
  y el precio de hoy en SEPA está fuera del ±15 %. Con tickets del mes no
  debería pasar. Para tickets viejos queda la categoría (Gaseosas).
- Dos ajustes salieron de esta prueba:
  - Con el nombre "Carrefour", gana Carrefour y no Maxi (Carrefour).
  - "04712 - 00116390" se guarda como "04712-00116390", así el control de
    duplicados no falla.

**Excel y no CSV.** Excel en es-AR espera `;` y coma decimal, y un CSV mal
abierto rompe los montos. SheetJS se baja del CDN oficial (la versión de npm
está abandonada) y se carga con `import()` al tocar el botón: 492 KB en un
chunk aparte que no pesa en la carga de la página.

## Mi compra: Mi lista y Tu canasta en una sola sección

Openspec `mi-compra` (2026-11-22). Mi lista y Tu canasta respondían lo mismo,
"¿dónde me sale más barata la compra?", con dos niveles de detalle: productos
exactos y categorías. En los registros del último mes Tu canasta la abrieron
unas 9 IP y solo 3 la completaron con la IA. Se unieron en **Mi compra**
(`/lista`), con la lista de productos exactos como base: el precio es el de
ese producto y no una mediana de categoría, y es la que se conecta con Mis
gastos.

**De Tu canasta se conservó:**
- La IA que interpreta el hogar.
- La canasta básica del INDEC.
- Repartir la compra entre súper cercanos.

Las dos primeras terminan en el mismo selector de marcas que ya existía
(`DeTuCanasta`): la persona elige la marca de cada categoría y entra a la
lista con las unidades que cubren el mes. Se perdió comparar varias
localidades a la vez. La zona se cambia desde el encabezado.

**Dónde comprarla cerca usa el precio de la cadena.** SEPA da el precio de un
producto exacto por cadena para todo el país, no por sucursal. A cada sucursal
cercana se le asigna el precio de su cadena y `optimizar_compra` (el mismo de
Tu canasta) se queda con la más cercana de cada una. En la práctica elige
entre 1, 2 y 3 cadenas, y la pantalla lo dice. Las sucursales salen del índice
del mapa, que ya está en memoria, sin consultas a BigQuery.

`/canasta-personalizada` redirige a `/lista` con su zona. Una canasta guardada
en el navegador se ofrece para pasarla a la lista y después se borra. Los
endpoints de categorías de la API quedan hasta otro change.

## Promos como vidriera, avisos de oferta y el mes en Mis gastos

Openspec `promos-navegables-y-mes-en-gastos` (2026-11-23). La portada abría
con el mapa y miles de promos sueltas: se miraba una vez y no invitaba a
volver. Lo que la gente haga en Changuito (qué categorías recorre, qué
productos pide que le avisen) es lo que después diferencia a Changuito
Empresas, así que Promos pasó a ser algo que se recorre.

**La vidriera la arma la API.** `GET /promos/vidriera` devuelve las promos
fuertes, las filas por rubro y por cadena y las cadenas que casi no informan,
todo desde el índice del mapa en memoria. Armarla en el navegador obligaba a
bajar las 5.000 promos de `/promos/mapa`, unos 400 KB, para mostrar unas 40.
La respuesta de Palermo pesa 56 KB y tarda 30–100 ms en local. La de todo el
país tarda 0,34 s la primera vez y queda guardada por índice y por día.

**Qué es una promo fuerte** (constantes en `mapa_promos.py`):
- vigente y sin compra múltiple;
- con respaldo (`leyenda` o `mercado`, nunca `sin_verificar`);
- primero las que están en 2 o más sucursales cerca: una crema al 70% en un
  solo local no es la promo del día;
- un producto una sola vez y hasta 3 por cadena, para que Carrefour no ocupe
  toda la vidriera.

Las filas usan el orden de la página: en más sucursales primero, y el
descuento como desempate.

**La página de una categoría cuenta como la vidriera.** `/promos/:rubro` usa
`/promos/mapa` con `rubro`, `latitud` y `longitud`: un círculo de
`RADIO_CERCA_KM` y solo promos vigentes. Con un recuadro y sin sacar las
vencidas, en Palermo la fila decía "Limpieza · 185" y la página mostraba 203.

**El mapa, a pedido.** Se abre con `?mapa=1`, que el link conserva para
compartirlo. El componente se carga aparte (46 KB). Leaflet sigue en el
paquete principal porque lo usan el mapa de la zona y Mi compra: lo que se
ahorra la portada es montar el mapa y pedir las 5.000 promos.

**Avisos en el teléfono.** "Avisame cuando esté de oferta" guarda hasta 50
productos en localStorage, sin cuenta. Al volver a Promos, la vidriera los
busca con `/promos/productos`, la misma búsqueda del detalle, y muestra la
promo más barata de cada uno. No la filtra contra el precio más bajo de la
zona, como sí hace el detalle: quien pidió el aviso quiere saber que está en
promo. No hay notificaciones con la app cerrada, porque necesitan guardar
suscripciones en un servidor. El botón vive en un solo componente
(`BotonAvisame`), el lugar a instrumentar cuando se enciendan las señales
anónimas para Empresas.

**El mes en Mis gastos.** Junta los productos vinculados de los tickets del
mes, sin los gastos a mano, y los cotiza con `/mismo-producto/lista/donde-comprar`,
la misma cuenta de Mi compra:
- La opción de una sucursal da "la más barata".
- La de dos da "mezclando dos". Se muestra solo si son dos cadenas distintas,
  cubren los mismos productos y baja el total.

Se compara contra lo que figura en los tickets antes de descuentos, igual que
cada ticket, y con el mismo mínimo de productos reconocidos. Al servidor viaja
la lista de productos y cantidades, nunca los tickets.

## Señales anónimas para Changuito Empresas

Openspec `senales-anonimas` (2026-11-23). Lo que diferencia a Changuito
Empresas es lo que la gente hace en Changuito, no los datos de SEPA. Se mide
poco y a propósito: qué categoría de promos se abre, qué producto se pide (o se
quita) en un aviso de oferta, y qué categoría se busca. La API traduce la
búsqueda a la categoría del primer resultado y descarta el texto.

**Prendidas, con aviso, y anónimas de verdad.** Rodrigo eligió este modelo:
con un "Sí / No" casi nadie suma, y esconder el "no" o meterlo en condiciones
sería engañoso y contrario a la Ley 25.326, que pide un consentimiento expreso
y destacado. La salida honesta fue que los datos no sean personales:
- el identificador al azar cambia cada día, así que no se pueden unir los
  eventos de una persona de un día con los de otro;
- no se guarda la IP (solo vive en memoria para el tope), ni la ubicación
  exacta, ni el texto buscado;
- la zona es la elegida, a nivel de localidad.

La primera vez se muestra un aviso de una línea ("Entendido" / "Más info"), y
el menú Más tiene un interruptor que las apaga en un toque. El precio de no
tener perfil es contar personas por día y no por semana.

**Escribir no cuesta consultas.** Los eventos viajan en tandas con
`sendBeacon`. La API los junta en memoria y los sube cada 5 minutos, o al
llegar a 500, con un load job a `sepa_senales.eventos`, que está particionada
por día y expira a los 400 días. Se descartó `insert_rows_json`, que se cobra.
Si una instancia muere sin apagarse, se pierden a lo sumo esos minutos.

**Agregados con umbral.** `mart_senales_rubros`, `mart_senales_busquedas` y
`mart_senales_avisos` cuentan, por semana y provincia, personas por día. Un
grupo con menos de `umbral_personas_senales` (10) no aparece. Están
deshabilitados con `senales_activas: false` hasta encender, para no gastar una
consulta diaria sobre una tabla vacía.

**Apagado hasta el lanzamiento.** `SENALES_ACTIVAS=1` en el servicio prende
todo; sin la variable, la app no muestra nada y la API responde 503. Antes de
prenderla hay que revisar el texto y confirmar que los datos anónimos no
requieren registro ante la AAIP (ver DEPLOY.md). Las líneas de ticket quedan
afuera: son compras de una persona y van a necesitar un consentimiento
explícito cuando se prendan las fotos.

## Tests

Además de los genéricos, hay tests singulares de dbt para lo que sólo se
detecta mirando el resultado agregado: que Carne vacuna y Pollo no mezclen otras
carnes, que la canasta económica no salga más cara que la gama media, que la
gama esté ordenada por precio por unidad, que el mapeo de unidades siga
cubriendo el catálogo, que la categorización no se degrade a "Otros", que los
históricos hayan capturado la última fecha, que ninguna cadena grande falte en
el último día, y que el crudo no se haya quedado atrás respecto del calendario.

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
