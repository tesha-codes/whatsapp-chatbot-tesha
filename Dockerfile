# Stage 1: Build and dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production-only dependencies
RUN npm ci --only=production

# Stage 2: Final image
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Copy production dependencies from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application files
COPY --chown=appuser:appgroup . .

# Install curl for health checks
RUN apk add --no-cache curl

# Health check configuration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:9000/health || exit 1

# Environment variables
ENV NODE_ENV production
ENV PORT 9000

# Expose port
EXPOSE 9000

# Switch to non-root user
USER appuser

# Start command
CMD ["node", "index.js"]