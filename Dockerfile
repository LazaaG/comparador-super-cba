FROM python:3.13-slim

# libcurl4 para curl_cffi (TLS impersonation Carrefour).
# ca-certificates para HTTPS outbound de scrapers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer cache: deps primero, código después
COPY pyproject.toml ./
# README.md placeholder vacío para que hatchling no falle si lo lista como readme
RUN touch README.md
COPY core/ ./core/
COPY scrapers/ ./scrapers/
COPY storage/ ./storage/
COPY api/ ./api/
COPY scripts/ ./scripts/

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# DB vive en volumen montado /data. Sin DB inicial → API responde 503 hasta seed.
ENV SUPER_DB_PATH=/data/precios.sqlite \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
