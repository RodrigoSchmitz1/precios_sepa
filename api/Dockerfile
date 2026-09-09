# Imagen de la API para Cloud Run.
#
# Se elige Cloud Run porque vive en el mismo proyecto de GCP que BigQuery (la
# service account ya existe), arranca en frio en un par de segundos y no tiene
# limite de duracion por request: la home depende de la API y la canasta con IA
# llama a Gemini, que puede tardar mas de diez segundos.

FROM python:3.12-slim

# PYTHONUNBUFFERED hace que los logs salgan al instante y no por buffer, que es
# lo que uno quiere cuando algo falla en un contenedor remoto.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Las dependencias van antes que el codigo para que Docker reutilice la capa
# cuando cambia el codigo pero no las dependencias, que es casi siempre.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run inyecta el puerto en $PORT y espera que el proceso escuche en
# 0.0.0.0. Fijarlo a 8000 o a 127.0.0.1 haria que el contenedor arranque bien y
# igual falle el health check.
ENV PORT=8080
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
