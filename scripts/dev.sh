#!/usr/bin/env bash
# Levanta todo el entorno de desarrollo de MYL:
#   1. MongoDB local en Docker (contenedor myl-mongo, puerto 27018)
#   2. Backend NestJS (server/, puerto 3210, modo watch)
#   3. Frontend Vite (puerto 5173/5175)
#
# Uso:  ./scripts/dev.sh          # todo en una terminal (Ctrl+C detiene todo)
#       ./scripts/dev.sh --host   # expone el front en la red local (móvil)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT/server"
MONGO_CONTAINER="myl-mongo"
MONGO_PORT=27018
API_PORT=3210

log()  { printf "\033[1;33m[myl]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[myl]\033[0m %s\n" "$*" >&2; exit 1; }

# ── 1. Dependencias básicas ────────────────────────────────────────────────
command -v docker >/dev/null || fail "Docker no está instalado o no está en el PATH"
command -v pnpm   >/dev/null || fail "pnpm no está instalado"
docker info >/dev/null 2>&1  || fail "Docker no está corriendo (abre Docker Desktop)"

# ── 2. MongoDB en Docker ───────────────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
  log "MongoDB ya está corriendo (${MONGO_CONTAINER})"
elif docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
  log "Iniciando contenedor MongoDB existente…"
  docker start "$MONGO_CONTAINER" >/dev/null
else
  log "Creando contenedor MongoDB (${MONGO_CONTAINER} → localhost:${MONGO_PORT})…"
  docker run -d --name "$MONGO_CONTAINER" -p "${MONGO_PORT}:27017" mongo:7 >/dev/null
fi

# ── 3. Archivos .env ───────────────────────────────────────────────────────
if [ ! -f "$SERVER_DIR/.env" ]; then
  log "server/.env no existe: creando uno de desarrollo…"
  cat > "$SERVER_DIR/.env" <<EOF
MONGODB_URI=mongodb://localhost:${MONGO_PORT}/myl
JWT_SECRET=dev-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=admin1234
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
PORT=${API_PORT}
EOF
fi
if [ ! -f "$ROOT/.env.local" ]; then
  log ".env.local no existe: creando…"
  echo "VITE_API_URL=http://localhost:${API_PORT}" > "$ROOT/.env.local"
fi

# ── 4. node_modules ────────────────────────────────────────────────────────
[ -d "$ROOT/node_modules" ]       || (log "Instalando deps del frontend…" && pnpm --dir "$ROOT" install)
[ -d "$SERVER_DIR/node_modules" ] || (log "Instalando deps del backend…"  && pnpm --dir "$SERVER_DIR" install)

# ── 5. Backend (watch) ─────────────────────────────────────────────────────
# Mata cualquier instancia previa del backend para evitar EADDRINUSE
pkill -f "node .*server/dist/main.js" 2>/dev/null || true
lsof -ti tcp:${API_PORT} | xargs kill 2>/dev/null || true

# En modo --host, extiende CORS con el origen de la red local automáticamente
HOST_MODE="${1:-}"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")

log "Levantando backend NestJS en :${API_PORT} (watch)…"
if [ "$HOST_MODE" = "--host" ] && [ -n "$IP" ]; then
  BASE_CORS=$(grep '^CORS_ORIGIN=' "$SERVER_DIR/.env" | cut -d= -f2-)
  # La variable de entorno pisa el valor de server/.env solo en esta sesión
  (cd "$SERVER_DIR" && CORS_ORIGIN="${BASE_CORS},http://${IP}:5173,http://${IP}:5174" pnpm start:dev) &
else
  (cd "$SERVER_DIR" && pnpm start:dev) &
fi
BACK_PID=$!

cleanup() {
  log "Deteniendo backend…"
  kill "$BACK_PID" 2>/dev/null || true
  # El contenedor de Mongo se deja corriendo (datos persistentes);
  # detenlo a mano con: docker stop ${MONGO_CONTAINER}
}
trap cleanup EXIT INT TERM

# Espera a que /health responda
log "Esperando al backend…"
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    log "Backend OK → http://localhost:${API_PORT}/health"
    break
  fi
  [ "$i" -eq 30 ] && fail "El backend no respondió en 30s (revisa la salida de arriba)"
  sleep 1
done

# ── 6. Frontend (primer plano; Ctrl+C corta todo) ──────────────────────────
log "Levantando frontend Vite… (Ctrl+C detiene todo)"
if [ "$HOST_MODE" = "--host" ]; then
  log "Modo red local: en el móvil abre http://${IP:-TU-IP-LOCAL}:5173"
  log "API y CORS configurados automáticamente para la red local"
  # VITE_API_URL por env pisa el valor de .env.local solo en esta sesión
  (cd "$ROOT" && VITE_API_URL="http://${IP}:${API_PORT}" pnpm exec vite --host)
else
  (cd "$ROOT" && pnpm exec vite)
fi
