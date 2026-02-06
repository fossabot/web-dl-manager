# Stage 1: Build Next.js App
FROM node:22-alpine AS builder

# Install system dependencies required for build tools
RUN apk add --no-cache wget curl

WORKDIR /app

# Download cloudflared for Alpine (musl compatible)
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Set env vars for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN npm run build

# Stage 2: Create a minimal runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create system user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install runtime system dependencies
RUN apk add --no-cache git bash

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone /app/
COPY --from=builder --chown=nextjs:nodejs /app/.next/static /app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public /app/public
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh /app/entrypoint.sh
COPY --from=builder --chown=nextjs:nodejs /app/camouflage-server.mjs /app/camouflage-server.mjs
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma /app/prisma
COPY --from=builder /usr/local/bin/cloudflared /usr/local/bin/cloudflared

# Ensure correct permissions
RUN chmod +x /app/entrypoint.sh

USER nextjs

EXPOSE 5492 6275

# Command to run the application
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]