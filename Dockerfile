# Stage 1: Build Next.js
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime
FROM python:3.13-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    unzip \
    ca-certificates \
    zstd \
    git \
    megatools \
    ffmpeg \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && curl https://rclone.org/install.sh | bash \
    && wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i cloudflared-linux-amd64.deb \
    && rm cloudflared-linux-amd64.deb \
    && apt-get purge -y --auto-remove wget \
    && rm -rf /var/lib/apt/lists/*

# Install python tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir gallery-dl yt-dlp git+https://github.com/AlphaSlayer1964/kemono-dl.git

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.env ./.env
COPY --from=builder /app/next.config.ts ./next.config.ts

# Create data directories
RUN mkdir -p /app/data/downloads /app/data/archives /app/data/status /app/logs

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]