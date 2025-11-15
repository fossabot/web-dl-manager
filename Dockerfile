# Stage 1: Build the application binary
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends git binutils

WORKDIR /app

# Copy the entire application source
COPY . .

# Install Python dependencies required for the build
RUN pip install --no-cache-dir -r app/requirements.txt
RUN pip install --no-cache-dir pyinstaller

# Run the build script to create the binary
RUN python build_new.py




# Stage 2: Final production image
FROM python:3.11-slim

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    unzip \
    ca-certificates \
    zstd \
    git \
    cron \
    && curl https://rclone.org/install.sh | bash \
    && wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i cloudflared-linux-amd64.deb \
    && rm cloudflared-linux-amd64.deb \
    && apt-get purge -y --auto-remove curl wget \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN useradd -m -u 1000 user

WORKDIR /app

# Create necessary directories and set permissions
RUN mkdir -p /app/app /data/downloads /data/archives /data/status && chown -R 1000:1000 /app /data

# Copy the pre-built binary from the builder stage
COPY --chown=1000:1000 --from=builder /app/dist/gallery-dl-web /app/gallery-dl-web

# Copy the entrypoint and updater scripts
COPY --chown=1000:1000 ./entrypoint.sh /entrypoint.sh
COPY --chown=1000:1000 ./app/updater.py /app/app/updater.py
RUN chmod +x /entrypoint.sh

# Install Python dependencies needed for the cron job (updater.py)
COPY ./app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Set up cron job for the updater script
RUN echo "0 3 * * * /usr/local/bin/python3 /app/app/updater.py >> /data/status/cron_update.log 2>&1" > /etc/cron.d/updater_cron
RUN chmod 0644 /etc/cron.d/updater_cron
RUN crontab /etc/cron.d/updater_cron

# Switch to the non-root user
USER 1000

# Expose the application port
EXPOSE 8000

# Define volumes for persistent data
VOLUME /data/downloads
VOLUME /data/archives
VOLUME /data/status

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]
