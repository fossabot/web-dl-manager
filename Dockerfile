# Stage 1: Build Next.js App
FROM node:22-alpine AS builder

# Install system dependencies required for build tools
RUN apk add --no-cache wget

WORKDIR /app

# Download cloudflared for Alpine (musl)
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /app/cloudflared && \
    chmod +x /app/cloudflared

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

# Install runtime system dependencies if needed
RUN apk add --no-cache git

# Copy built application from builder stage
# Standalone output includes server.js, .next directory and static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
COPY --from=builder /app/camouflage-server.mjs ./camouflage-server.mjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/cloudflared /usr/local/bin/cloudflared # Copy cloudflared to runner stage

# Ensure correct permissions
RUN chown -R nextjs:nodejs /app && chmod +x entrypoint.sh

USER nextjs

EXPOSE 5492 6275

# Command to run the application
CMD ["./entrypoint.sh"]
