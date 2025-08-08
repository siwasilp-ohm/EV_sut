# EV Solar Charging System - Multi-stage Dockerfile
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    tzdata

# Set timezone to Bangkok
ENV TZ=Asia/Bangkok
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY admin/package*.json ./admin/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd server && npm ci --only=production && npm cache clean --force
RUN cd client && npm ci && npm cache clean --force
RUN cd admin && npm ci && npm cache clean --force

# Build stage for client
FROM base AS client-builder
WORKDIR /app/client
COPY client/ .
RUN npm run build

# Build stage for admin
FROM base AS admin-builder
WORKDIR /app/admin
COPY admin/ .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for production
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    tzdata \
    dumb-init

# Set timezone
ENV TZ=Asia/Bangkok
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S evsolar -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --only=production && npm cache clean --force
RUN cd server && npm ci --only=production && npm cache clean --force

# Copy server code
COPY server/ ./server/
COPY database/ ./database/
COPY scripts/ ./scripts/

# Copy built client and admin applications
COPY --from=client-builder /app/client/build ./client/build
COPY --from=admin-builder /app/admin/build ./admin/build

# Copy other necessary files
COPY .env.example .env
COPY README.md ./
COPY *.md ./

# Create necessary directories
RUN mkdir -p logs uploads/profiles uploads/payment-slips uploads/documents

# Set permissions
RUN chown -R evsolar:nodejs /app
RUN chmod +x scripts/*.js

# Switch to non-root user
USER evsolar

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose ports
EXPOSE 3000 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server/app.js"]
