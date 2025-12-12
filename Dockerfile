FROM python:3.13-slim
ARG DEBUG_MODE=false

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    unzip \
    ca-certificates \
    zstd \
    git \
    cron \
    megatools \
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

# Configure git to clone the repository
ARG REPO_URL=https://github.com/Jyf0214/web-dl-manager.git
ARG REPO_BRANCH=main
# Clear /app directory and clone directly into it
RUN find /app -mindepth 1 -delete 2>/dev/null || true && \
    git clone --depth 1 --branch ${REPO_BRANCH} ${REPO_URL} /app && \
    # Initialize version info file from git SHA
    cd /app && git rev-parse HEAD > /app/.version_info && \
    # Set permissions
    chown -R 1000:1000 /app /data

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/app/requirements.txt
RUN pip install --no-cache-dir gunicorn

# Set up cron job for the updater script
RUN echo "0 3 * * * /usr/local/bin/python3 /app/app/updater.py >> /data/status/cron_update.log 2>&1" > /etc/cron.d/updater_cron
RUN chmod 0644 /etc/cron.d/updater_cron
RUN crontab /etc/cron.d/updater_cron

# Set DEBUG_MODE environment variable
ENV DEBUG_MODE=${DEBUG_MODE}

# Switch to the non-root user
USER 1000

# Expose the application port
EXPOSE 5492

# Define volumes for persistent data
VOLUME /data/downloads
VOLUME /data/archives
VOLUME /data/status

# Set the entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
