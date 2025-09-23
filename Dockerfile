# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY sql/ ./sql/
COPY MD\ files/ ./MD\ files/
COPY test\ js/ ./test\ js/

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpserver -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/sql ./sql

# Copy any additional runtime files
COPY README.md ./
COPY metadata.json ./

# Create data directory for persistence
RUN mkdir -p /app/data && \
    chown -R mcpserver:nodejs /app

# Switch to non-root user
USER mcpserver

# Expose the application port
EXPOSE 3002

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Environment variables with defaults
ENV NODE_ENV=production
ENV PORT=3002
ENV LOG_LEVEL=info

# Start the MCP server
CMD ["npm", "start"]