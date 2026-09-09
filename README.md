# precios_sepa

Precios reales de supermercados argentinos, con datos oficiales del programa
SEPA (Secretaría de Comercio). Pipeline diario que ingiere ~14 millones de
precios por día, los transforma con dbt sobre BigQuery y los publica en una
aplicación web.

### 🔗 [precios-sepa-api-803135877045.us-central1.run.app](https://precios-sepa-api-803135877045.us-central1.run.app)

---

## Qué muestra

| Sección | Qué responde |
|---|---|
| **Promos vigentes** | Qué descuentos hay hoy cerca mío, sobre un mapa |
| **Canasta básica** | Cuánto cuesta la canasta alimentaria en cada localidad |
| **Tu canasta** | Describís en lenguaje natural qué consumís, una IA arma tu canasta y se cotiza con precios reales |
| **Supermercado más barato** | Qué cadena tiene el precio más bajo, comparando productos idénticos |
| **Inflación por categoría** | Cómo se movieron los precios, con un índice encadenado |

---

## Arquitectura

```
Portal SEPA ──> Ingesta local ──> BigQuery ──> dbt ──> FastAPI + React
 (datos.gob)     (Python)          (crudo)    (19 modelos)   (Cloud Run)
                     │                             │
              Task Scheduler                GitHub Actions
                 07:00 ART                    08:00 ART
```

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

El error recurrente, en cuatro formas distintas:

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

Los dos casos tienen ahora un test que falla si vuelven a aparecer.

### Ruido de la fuente

- **SEPA mezcla importes de cuota en la columna de promoción.** La portada
  mostraba colchones con "98,8% OFF". Los valores de promo son un diccionario
  chico de números redondos reusados entre productos de precio muy distinto, y
  para el más barato de cada grupo el valor es exactamente `lista/10`: las
  clásicas 10 cuotas sin interés. Se filtra por un techo de descuento.
- **Hay provincias enteras disfrazadas de localidad.** "BUENOS AIRES" agrupaba
  425 sucursales repartidas en 555 km. Se excluyen por dispersión geográfica y
  no por lista de nombres: una localidad real es compacta.
- **La misma ciudad venía escrita de dos formas** ("Salta" y "SALTA"), lo que la
  partía en dos y le daba la mitad de las muestras a cada una.

### Geografía

Las cadenas reportan toda CABA como "Capital Federal". El barrio real se
resuelve por **point-in-polygon** contra la geometría oficial del GCBA,
respetando el barrio cuando la cadena sí lo informa bien.

---

## Calidad

**19 modelos y 64 tests**, que corren en cada ejecución del pipeline.
Además de los genéricos, hay tests singulares para las cosas que sólo se
detectan mirando el resultado agregado: que la gama esté ordenada por precio por
unidad, que el mapeo de unidades siga cubriendo el catálogo, que la
categorización no se degrade a "Otros", y que los históricos hayan capturado la
última fecha.

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
| Procesamiento | ~505 GB/mes | 1 TB/mes |
| Almacenamiento | 7,2 GB | 10 GB |

Decisiones que salieron de ahí:

- El crudo retiene **3 días**. No es sólo costo de consulta: pesa ~1,5 GB por
  día, así que una ventana de 4 días llevaría el almacenamiento a 8,7 GB.
- Los marts recalculan **sólo las fechas que faltan** en el histórico, no las
  tres de la ventana. Bajó la corrida diaria de 15,6 a 12,25 GB.
- El índice encadenado se calculó **dentro** de un modelo existente en vez de
  agregar uno nuevo: BigQuery cobra por bytes leídos, no por agregar, así que
  costó 0 GB extra frente a los +63 GB/mes de un modelo aparte.
- La API cachea 6 horas. El mapa de promos escanea 212 MB por request y se
  dispara en cada movimiento del mapa.
- Hay una **cuota dura** a nivel proyecto: es lo único que garantiza que un bot
  no genere un cargo.

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
  con 3,4. Aun con el umbral calibrado con evidencia, el interior entra menos.
- **Algunas combinaciones cadena × categoría tienen precios sistemáticamente
  fuera de mercado** (Dia en Gaseosas, por ejemplo), replicados en cientos de
  sucursales. Parece un error del maestro de precios de esa cadena y no se puede
  verificar sin acceso a la fuente original. Se documenta en el modelo en vez de
  presentarlo como dato confiable.
- **El histórico es corto.** Empezó a acumularse hace pocos días, así que las
  variaciones todavía no representan inflación mensual real.
- La librería `google-generativeai` está discontinuada; hay que migrar a
  `google-genai`.

---

## Stack

BigQuery · dbt · Python (FastAPI) · React + TypeScript + Tailwind · Leaflet ·
Gemini · Docker · Cloud Run · GitHub Actions
