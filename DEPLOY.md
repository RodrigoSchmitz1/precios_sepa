# Despliegue

La API va a **Cloud Run** y el frontend a un hosting estático. Se eligió Cloud
Run porque vive en el mismo proyecto de GCP que BigQuery (la service account ya
existe, así que no hace falta que ande dando vueltas una clave privada), arranca
en frío en un par de segundos y no tiene límite de duración por request. Las dos
cosas importan: la portada depende de la API, y la canasta con IA llama a Gemini
y puede tardar más de diez segundos.

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
BigQuery es un vector de gasto sin techo: alcanza con que un bot recorra el mapa.

La caché de la API (6 horas) baja muchísimo el consumo, pero **no es una
garantía**. La única garantía es una cuota dura, que es gratis y se pone una vez:

1. Consola de GCP → **IAM y administración** → **Cuotas y límites del sistema**.
2. Filtrar por servicio **BigQuery API** y buscar la métrica
   **Query usage per day** (uso de consultas por día), a nivel proyecto.
3. Editar y poner **30 GiB por día**.

De dónde sale ese número:

| Concepto | Consumo |
|---|---|
| Corrida diaria de dbt | ~15,6 GB |
| Reconstrucción diaria del crudo | ~4,6 GB |
| **Subtotal del pipeline** | **~20 GB/día** |
| Margen que queda para la API | ~10 GB/día |

30 GiB/día son ~900 GB al mes, justo por debajo del 1 TB gratuito mensual. Y
deja ~10 GB diarios para la API, que con la caché puesta alcanza de sobra para
el tráfico de un portfolio.

Si algún día la cuota corta el pipeline, se nota enseguida: el workflow de
GitHub Actions falla y llega el mail. Es preferible eso a una factura.

---

## 1. API en Cloud Run

Requiere el CLI de `gcloud` instalado ([guía oficial](https://cloud.google.com/sdk/docs/install)).
No hace falta Docker local: `--source` hace que la imagen se construya en Cloud
Build.

```bash
gcloud auth login
gcloud config set project proyecto-precios-504221

# APIs necesarias (una sola vez)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

La API necesita la key de Gemini. Va a Secret Manager y no como variable suelta,
para que no quede en el historial de la terminal ni visible en la consola:

```bash
# Tomar el valor de orquestacion/.env (GEMINI_API_KEY)
printf '%s' 'LA_KEY_DE_GEMINI' | gcloud secrets create gemini-api-key --data-file=-
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member=serviceAccount:dbt-788@proyecto-precios-504221.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

Desplegar:

```bash
gcloud run deploy precios-sepa-api \
  --source api \
  --region us-central1 \
  --allow-unauthenticated \
  --service-account dbt-788@proyecto-precios-504221.iam.gserviceaccount.com \
  --set-env-vars USAR_CREDENCIALES_DEL_ENTORNO=1 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --memory 512Mi \
  --max-instances 3
```

Detalles que importan:

- `USAR_CREDENCIALES_DEL_ENTORNO=1` hace que la API use la identidad del propio
  servicio en vez de una clave. **No se sube ninguna clave privada.**
- `--max-instances 3` es un tope de seguridad: cada instancia tiene su propia
  caché en memoria, así que muchas instancias significan más consultas repetidas
  a BigQuery. Tres alcanzan y acotan el gasto.
- `--allow-unauthenticated` es necesario: es una API pública leída por el
  navegador.

El comando devuelve la URL del servicio. Guardala, hace falta en el paso 2.

---

## 2. Frontend estático

Sirve cualquier hosting estático (Cloudflare Pages, Vercel, Netlify). La única
configuración es la URL de la API, que Vite incrusta **en tiempo de build**:

| Ajuste | Valor |
|---|---|
| Directorio raíz | `frontend` |
| Comando de build | `npm run build` |
| Directorio de salida | `dist` |
| Variable de entorno | `VITE_API_URL` = la URL de Cloud Run del paso 1 |

Como se incrusta al compilar, si cambia la URL de la API hay que **volver a
compilar**, no alcanza con cambiar la variable.

---

## 3. Cerrar el CORS

Recién ahora se sabe el dominio del frontend. Sin este paso el navegador bloquea
todas las llamadas:

```bash
gcloud run services update precios-sepa-api \
  --region us-central1 \
  --update-env-vars ORIGENES_PERMITIDOS=https://EL-DOMINIO-DEL-FRONTEND
```

Se pueden poner varios separados por coma (por ejemplo el dominio de producción
y el de las preview builds).

---

## 4. Verificar

```bash
curl https://LA-URL-DE-CLOUD-RUN/health          # {"status":"ok"}
curl "https://LA-URL-DE-CLOUD-RUN/canasta?limite=3"
```

Y en el navegador: abrir el frontend y recorrer las cinco secciones. Si el mapa
carga pero las listas quedan vacías, casi siempre es el CORS del paso 3.

---

## Qué NO se despliega

La **descarga de SEPA** sigue corriendo en la máquina de Rodrigo, y no es un
descuido: el portal `datos.produccion.gob.ar` responde 403 a los rangos de IP de
datacenter, verificado sobre GitHub Actions y Google. Ver
`.github/workflows/diagnostico_sepa.yml`, que existe para volver a probarlo si
algún día se quiere mover a la nube.
