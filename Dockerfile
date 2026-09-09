# Imagen unica: compila el frontend y lo sirve junto con la API.
#
# Un solo servicio de Cloud Run en vez de separar frontend y API en dos
# plataformas. Al quedar en el mismo origen no hay CORS que configurar, que es
# la causa mas comun de que un SPA desplegado no ande, y hay una sola URL.
#
# Esta en la raiz del repo y no dentro de api/ porque necesita ver las dos
# carpetas: el contexto de build de un Dockerfile no puede subir con "..".

# --- Etapa 1: compilar el frontend ---
FROM node:22-slim AS frontend

WORKDIR /frontend
# Primero las dependencias, para que Docker reutilice la capa cuando cambia el
# codigo pero no el package.json, que es casi siempre.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Vite incrusta esta variable en el bundle al compilar. Al ir todo en el mismo
# origen alcanza con la ruta relativa: no hay que saber el dominio de antemano,
# asi que la imagen sirve igual en cualquier URL donde se despliegue.
ENV VITE_API_URL=/api
RUN npm run build


# --- Etapa 2: la API, que ademas sirve el frontend ya compilado ---
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./
# El frontend compilado. main.py lo sirve desde aca, con fallback a index.html
# para que las rutas del SPA funcionen al entrar directo o al recargar.
COPY --from=frontend /frontend/dist ./static

# Cloud Run inyecta el puerto en $PORT y espera que el proceso escuche en
# 0.0.0.0. Fijarlo a 127.0.0.1 haria que el contenedor arranque bien y falle
# igual el health check.
ENV PORT=8080
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
