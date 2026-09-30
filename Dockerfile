# Life Dashboard: one container serving the API and the built dashboard.
#
# Runs on any Docker host (Railway, Fly.io, Render, a VPS…). Mount a persistent
# volume at /data: it holds the database and your Garmin login. See DEPLOY.md.

# ---- 1. build the dashboard ---------------------------------------------------
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. the app ---------------------------------------------------------------
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DB_PATH=/data/lifedashboard.sqlite3 \
    GARMIN_TOKENSTORE=/data/garmin \
    HOSTED=true \
    TZ=UTC
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist
RUN mkdir -p /data
WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK --interval=60s --timeout=5s CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health')"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
