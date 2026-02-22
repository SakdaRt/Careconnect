#!/bin/bash
set -euo pipefail

# CareConnect Production Deployment Script
# Usage: ./deploy.sh [--skip-pull] [--skip-build]
# Requires: .env file with production secrets (see docker-compose.prod.yml)

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_DIR="${PROJECT_DIR:-/home/careconnect}"
SKIP_PULL=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-pull) SKIP_PULL=true ;;
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo "=== CareConnect Production Deploy ==="
echo "Compose: $COMPOSE_FILE"
echo "Directory: $PROJECT_DIR"

cd "$PROJECT_DIR"

# 1. Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in production values."
  exit 1
fi

# 2. Pull latest code
if [ "$SKIP_PULL" = false ]; then
  echo "[1/6] Pulling latest code..."
  git pull origin main
else
  echo "[1/6] Skipping git pull"
fi

# 3. Stop existing containers
echo "[2/6] Stopping existing containers..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

# 4. Build and start
if [ "$SKIP_BUILD" = false ]; then
  echo "[3/6] Building images..."
  docker compose -f "$COMPOSE_FILE" build --no-cache
else
  echo "[3/6] Skipping build"
fi

echo "[4/6] Starting containers..."
docker compose -f "$COMPOSE_FILE" up -d

# 5. Run migrations
echo "[5/6] Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm migrate || echo "WARNING: Migration failed or no pending migrations"

# 6. Health check
echo "[6/6] Waiting for backend health check..."
RETRIES=15
for i in $(seq 1 $RETRIES); do
  if docker compose -f "$COMPOSE_FILE" exec -T backend wget -qO- http://localhost:3000/health > /dev/null 2>&1; then
    echo "Backend is healthy!"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "WARNING: Backend health check failed after ${RETRIES} attempts"
    echo "Check logs: docker compose -f $COMPOSE_FILE logs backend"
  fi
  sleep 2
done

# Status
echo ""
echo "=== Container Status ==="
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "=== Deploy Complete ==="
echo "Frontend: http://$(hostname -I | awk '{print $1}'):${HTTP_PORT:-80}"
echo "Backend:  http://$(hostname -I | awk '{print $1}'):3000 (internal)"
echo "Logs:     docker compose -f $COMPOSE_FILE logs -f"
