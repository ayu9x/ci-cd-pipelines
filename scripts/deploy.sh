#!/bin/bash
# ============================================================
# deploy.sh — Deployment Script (runs on EC2 instance)
# ============================================================
# Called by Jenkins via SSH during the Deploy stage.
#
# Usage:
#   ./deploy.sh <DOCKER_IMAGE> <IMAGE_TAG> <CONTAINER_NAME> <APP_PORT>
#
# Example:
#   ./deploy.sh myuser/myapp 42-abc1234 cicd-demo-app 3000
# ============================================================

set -euo pipefail

# ─── Arguments ───────────────────────────────────────────────
DOCKER_IMAGE="${1:?'Error: DOCKER_IMAGE is required'}"
IMAGE_TAG="${2:?'Error: IMAGE_TAG is required'}"
CONTAINER_NAME="${3:?'Error: CONTAINER_NAME is required'}"
APP_PORT="${4:?'Error: APP_PORT is required'}"

FULL_IMAGE="${DOCKER_IMAGE}:${IMAGE_TAG}"
HEALTH_URL="http://localhost:${APP_PORT}/health"
MAX_RETRIES=10
RETRY_INTERVAL=3

# ─── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── Step 1: Pull new image ─────────────────────────────────
log "Pulling image: ${FULL_IMAGE}"
docker pull "${FULL_IMAGE}"

# ─── Step 2: Save current container ID for rollback ─────────
OLD_IMAGE=""
if docker inspect "${CONTAINER_NAME}" &>/dev/null; then
    OLD_IMAGE=$(docker inspect --format='{{.Config.Image}}' "${CONTAINER_NAME}")
    log "Current running image: ${OLD_IMAGE}"
fi

# ─── Step 3: Stop and remove old container ───────────────────
log "Stopping old container (if running)..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# ─── Step 4: Start new container ────────────────────────────
log "Starting new container: ${CONTAINER_NAME}"
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "${APP_PORT}:3000" \
    -e "BUILD_VERSION=${IMAGE_TAG}" \
    -e "NODE_ENV=production" \
    "${FULL_IMAGE}"

# ─── Step 5: Health check ───────────────────────────────────
log "Running health check (${MAX_RETRIES} attempts, ${RETRY_INTERVAL}s interval)..."

HEALTHY=false
for i in $(seq 1 ${MAX_RETRIES}); do
    sleep ${RETRY_INTERVAL}
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")

    if [ "${HTTP_STATUS}" = "200" ]; then
        HEALTHY=true
        log "✅ Health check passed! (attempt ${i}/${MAX_RETRIES})"
        break
    else
        warn "Health check attempt ${i}/${MAX_RETRIES} — HTTP ${HTTP_STATUS}"
    fi
done

# ─── Step 6: Rollback if unhealthy ──────────────────────────
if [ "${HEALTHY}" = false ]; then
    error "❌ Health check failed after ${MAX_RETRIES} attempts!"

    if [ -n "${OLD_IMAGE}" ]; then
        error "Rolling back to: ${OLD_IMAGE}"
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}" 2>/dev/null || true
        docker run -d \
            --name "${CONTAINER_NAME}" \
            --restart unless-stopped \
            -p "${APP_PORT}:3000" \
            -e "NODE_ENV=production" \
            "${OLD_IMAGE}"
        error "Rollback complete. Previous version restored."
    fi

    exit 1
fi

# ─── Step 7: Cleanup old images ─────────────────────────────
log "Cleaning up dangling Docker images..."
docker image prune -f 2>/dev/null || true

# ─── Done ────────────────────────────────────────────────────
log "═══════════════════════════════════════════════"
log "  Deployment successful!"
log "  Image:     ${FULL_IMAGE}"
log "  Container: ${CONTAINER_NAME}"
log "  URL:       http://$(hostname -I | awk '{print $1}'):${APP_PORT}"
log "═══════════════════════════════════════════════"
