FROM eclipse-temurin:21-jdk-alpine AS base

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production=false

# Copy source
COPY tsconfig.json server.ts ./

# Build TypeScript
RUN npm run build

# Production stage
FROM eclipse-temurin:21-jdk-alpine

# Install Node.js (runtime only)
RUN apk add --no-cache nodejs

# Create non-root user
RUN addgroup -g 1001 compiler && \
    adduser -u 1001 -G compiler -s /bin/sh -D compiler

WORKDIR /app

# Copy built files
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Set ownership
RUN chown -R compiler:compiler /app

USER compiler

EXPOSE 3001

CMD ["node", "dist/server.js"]
