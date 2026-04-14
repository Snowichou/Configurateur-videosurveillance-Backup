# ============================================================
# Dockerfile - Configurateur Comelit
# ============================================================
# Build: docker build -t comelit-configurateur .
# Run:   docker run -p 8000:8000 --env-file .env comelit-configurateur
# ============================================================

# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copier les fichiers package
COPY frontend/package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source frontend
COPY frontend/ ./

# Build production
RUN npm run build

# --- Stage 2: Python Backend ---
FROM python:3.11-slim

WORKDIR /app

# Variables d'environnement Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Variables Azure AD (à surcharger via --env-file .env ou Railway variables)
ENV CONFIG_ADMIN_PASSWORD=""
ENV AZURE_CLIENT_ID=""
ENV AZURE_CLIENT_SECRET=""
ENV AZURE_TENANT_ID=""
ENV AZURE_REDIRECT_URI=""
ENV APP_SECRET_KEY=""
ENV APP_BASE_URL=""
ENV ALLOWED_EMAIL_DOMAINS="comelit.fr"

# Installer les dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les dépendances Python
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier le backend
COPY backend/ ./backend/

# Copier les données (CSV)
COPY data/ ./data/

# Copier le frontend buildé depuis le stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Créer le dossier pour la base SQLite
RUN mkdir -p /app/backend && chmod 777 /app/backend

# Port exposé
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Commande de démarrage
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
