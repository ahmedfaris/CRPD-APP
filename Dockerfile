# =============================================================================
# Production Dockerfile for Local Server & Standalone Deployments
# Multi-stage build for optimal performance and minimal image size
# =============================================================================

# Stage 1: Build Frontend and Server Bundle
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build Vite frontend and bundled Node.js server (dist/server.cjs)
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-slim AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled frontend and server bundle from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/server/db ./src/server/db
COPY --from=builder /app/init-db.sql ./init-db.sql

# Expose standard application port
EXPOSE 3000

# Health check to ensure API is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the Node.js server
CMD ["node", "dist/server.cjs"]
