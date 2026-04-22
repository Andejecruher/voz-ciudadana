# ── Etapa 1: dependencias ──────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Instalar dependencias del sistema necesarias para asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar solo requirements primero para aprovechar caché de capas
COPY requirements.txt .

# Instalar en directorio aislado para copiarlo luego
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Etapa 2: imagen final ──────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copiar dependencias instaladas desde la etapa builder
COPY --from=builder /install /usr/local

# Copiar código fuente
COPY . .

# Exponer puerto de la API
EXPOSE 8000

# Comando por defecto — uvicorn en modo recarga en desarrollo
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
