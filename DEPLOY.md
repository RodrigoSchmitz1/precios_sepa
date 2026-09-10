# Despliegue

Todo el sitio (frontend y API) va en **un solo servicio de Cloud Run**. Se
eligió Cloud Run porque vive en el mismo proyecto de GCP que BigQuery, así que la
service account ya existe y no hace falta que ande dando vueltas una clave
privada; arranca en frío en un par de segundos, y no tiene límite de duración por
request. Las dos últimas cosas importan: la portada depende de la API, y la
canasta con IA llama a Gemini y puede tardar más de diez segundos, que es el
límite de las funciones serverless de los planes gratuitos.

Datos del proyecto:

- Proyecto GCP: `proyecto-precios-504221`
- Service account: `dbt-788@proyecto-precios-504221.iam.gserviceaccount.com`
- BigQuery está en la multirregión `US`, así que conviene desplegar la API en
  `us-central1`: cada request hace varias consultas y la latencia contra
  BigQuery pesa más que los ~150 ms extra hasta Argentina.

---

## 0. Antes que nada: la cuota de BigQuery

**Este paso va primero, no último.** El proyecto tiene facturación habilitada, o
sea que pasarse del tier gratuito cobra dinero real. Una API pública que consulta
BigQuery es un vector de gasto sin techo: alcanza con que un bot recorra el mapa,
donde cada movimiento escanea ~212 MB.

La caché de la API (6 horas) baja muchísimo el consumo, pero **no es una
garantía**. La única garantía es una cuota dura, que es gratis.

No está dentro de BigQuery: vive en *IAM y administración → Cuotas*, que es una
sección aparte. Pero conviene hacerlo por línea de comandos:

```bash
gcloud quotas preferences create --service=bigquery.googleapis.com --project=proyecto-precios-504221 --quota-id=QueryUsagePerDay --preferred-value=102400 --preference-id=limite-diario-consultas --allow-high-percentage-quota-decrease --allow-quota-decrease-below-usage
```

El valor está en **MiB por día**: 102400 son 100 GiB.

Los dos flags del final no son opcionales y cuestan tiempo si no se saben:

- `--allow-high-percentage-quota-decrease`: pasar de "ilimitado" a un número es
  una reducción grande y Google pide confirmarla.
- `--allow-quota-decrease-below-usage`: el guardrail compara contra el **pico de
  consumo reciente**, no contra el de hoy. Si hubo un día de desarrollo pesado,
  rechaza cualquier valor por debajo de ese pico aunque hoy se esté usando mucho
  menos. El mensaje de error dice cuál es ese número.

**Antes de bajar la cuota, mirar el consumo de HOY**, no el del pico: si el techo
queda por debajo de lo ya consumido en el día, BigQuery empieza a rechazar
consultas y el sitio deja de funcionar hasta que el contador se reinicie.

```sql
SELECT ROUND(SUM(total_bytes_billed)/POW(1024,3),1) AS gib_hoy
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE DATE(creation_time) = CURRENT_DATE() AND job_type = "QUERY"
```

Y para ver el mes completo, que es contra lo que corre el tier gratuito de 1 TiB:

```sql
SELECT DATE(creation_time) AS dia,
       ROUND(SUM(total_bytes_billed)/POW(1024,3), 1) AS gib
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))
  AND job_type = "QUERY"
GROUP BY dia ORDER BY dia
```

### Qué valor corresponde

| Concepto | Consumo |
|---|---|
| Corrida diaria en GitHub Actions (categorización, dbt, tests) | ~14 GiB |
| Carga diaria del crudo (load job directo, sin consultas) | ~0 GiB |
| **Un día tranquilo, sólo pipeline** | **~14 GiB** |
| Un día de desarrollo | 60 a 155 GiB |

Los valores del pipeline salen de sumar lo medido paso por paso el 2026-09-10,
después de las optimizaciones de ese día.

**El valor no se elige mirando un día típico sino el presupuesto que queda: lo
que falta del TiB gratuito dividido por los días que quedan del mes.** Una cuota
de 25 GiB por día parece holgada, pero el 10 de septiembre ya se habían usado
606 GiB y quedaban 20 GiB por día: con 25, el mes podía terminar pagando aunque
ningún día individual se pasara.

Con 20 GiB por día el pipeline entra. Y como corre temprano en el día de la
cuota, que se reinicia a la medianoche del Pacífico (las 4 de la mañana en
Argentina), si algo se pasa es el tráfico del sitio el que recibe el rechazo, no
la ingesta.

**Bajarla sólo después de que termine la corrida del día.** Si el consumo de hoy
ya supera el valor nuevo, BigQuery rechaza todo hasta la medianoche del
Pacífico, incluida la corrida de dbt que falte.

```bash
gcloud quotas preferences update --service=bigquery.googleapis.com --project=proyecto-precios-504221 --quota-id=QueryUsagePerDay --preferred-value=20480 --preference-id=limite-diario-consultas --allow-high-percentage-quota-decrease --allow-quota-decrease-below-usage
```

Si algún día la cuota corta el pipeline se nota enseguida: falla el workflow de
GitHub Actions y llega el mail. Es preferible eso a una factura.

---

## 1. Desplegar

Todo va en **un solo servicio de Cloud Run**: la misma imagen compila el
frontend y lo sirve junto con la API, que queda bajo `/api`. Un solo servicio
significa una sola URL y, sobre todo, **ningún CORS que configurar**, que es la
causa más común de que un SPA desplegado no funcione.

Por eso la API vive bajo `/api` y no en la raíz: las rutas se pisaban. `/canasta`,
`/quien-gana` e `/inflacion` eran endpoint *y* pantalla al mismo tiempo.

Requiere el CLI de `gcloud` ([instalador](https://cloud.google.com/sdk/docs/install)).
No hace falta Docker local: `--source` construye la imagen en Cloud Build.

```bash
gcloud auth login
gcloud config set project proyecto-precios-504221

# APIs necesarias (una sola vez)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

La key de Gemini va a Secret Manager, no como variable suelta, para que no quede
en el historial de la terminal ni visible en la consola:

```bash
printf '%s' 'LA_KEY_DE_GEMINI' | gcloud secrets create gemini-api-key --replication-policy=automatic --data-file=-
gcloud secrets add-iam-policy-binding gemini-api-key --member=serviceAccount:dbt-788@proyecto-precios-504221.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
```

Desplegar, desde la raíz del repo:

```bash
gcloud run deploy precios-sepa-api --source . --region us-central1 --allow-unauthenticated --service-account dbt-788@proyecto-precios-504221.iam.gserviceaccount.com --set-env-vars USAR_CREDENCIALES_DEL_ENTORNO=1 --set-secrets GEMINI_API_KEY=gemini-api-key:latest --memory 512Mi --max-instances 3
```

Detalles que importan:

- `USAR_CREDENCIALES_DEL_ENTORNO=1` hace que la API use la identidad del propio
  servicio en vez de una clave. **No se sube ninguna clave privada**, y el
  `.dockerignore` excluye `credenciales.json` y `.env` explícitamente por si acaso.
- `--max-instances 3` acota el gasto: la caché es por proceso, así que más
  instancias significan más consultas repetidas a BigQuery.
- `--allow-unauthenticated` es necesario: es un sitio público.
- `VITE_API_URL` no se configura en ningún lado. El Dockerfile la fija en `/api`
  al compilar, así que la imagen funciona en cualquier URL donde se despliegue.

Para actualizar el sitio después de un cambio, se repite sólo el `gcloud run
deploy`.

---

## 2. Verificar

```bash
curl https://LA-URL/api/health          # {"status":"ok"}
curl "https://LA-URL/api/canasta?limite=3"
```

Y en el navegador: abrir la URL raíz y recorrer las cinco secciones, incluyendo
recargar la página estando en una sección que no sea la portada (eso ejercita el
fallback a `index.html` que necesita el router del frontend).

---

## Desarrollo local

Nada cambió: el frontend con `npm run dev` y la API con uvicorn. La única
diferencia es que la API ahora vive bajo `/api` también en local, y el cliente
del frontend ya apunta ahí por defecto.

```bash
cd api && ./venv/Scripts/uvicorn.exe main:app --port 8000
cd frontend && npm run dev
```

---

## Qué NO se despliega

La **descarga de SEPA** sigue corriendo en la máquina de Rodrigo, y no es un
descuido: el portal `datos.produccion.gob.ar` responde 403 a los rangos de IP de
datacenter, verificado sobre GitHub Actions y Google. Ver
`.github/workflows/diagnostico_sepa.yml`, que existe para volver a probarlo si
algún día se quiere mover a la nube.
