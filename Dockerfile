# Production Dockerfile for Textile Store Management System
FROM node:20-alpine AS base

# Install build dependencies for native modules (sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Initialize/seed database if needed on build
RUN node db/initDb.js

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["npm", "start"]
