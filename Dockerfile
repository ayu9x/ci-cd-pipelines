# ============================================================
# Multi-stage Dockerfile for CI/CD Pipeline Demo
# ============================================================

# ─── Stage 1: Install dependencies ──────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files first (leverages Docker layer caching)
COPY app/package.json app/package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# ─── Stage 2: Production image ──────────────────────────────
FROM node:20-alpine AS production

# Accept build version as a build argument
ARG BUILD_VERSION=unknown
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NODE_ENV=production
ENV PORT=3000

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /build/node_modules ./node_modules

# Copy application code
COPY app/server.js ./server.js
COPY app/package.json ./package.json
COPY app/public ./public

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health check — Docker will monitor container health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
