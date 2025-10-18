FROM python:3.10-slim

# 1. Install system dependencies: zstd, rclone, and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ca-certificates \
    zstd \
    git \
    && curl https://rclone.org/install.sh | bash \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Set up the working directory
WORKDIR /app

# 3. Install Python dependencies
COPY ./app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy the application code and entrypoint script
COPY ./app /app
COPY ./entrypoint.sh /entrypoint.sh

# 5. Expose the port the app runs on
EXPOSE 8000

# 6. Define data directories for downloads, archives, and status
VOLUME /data/downloads
VOLUME /data/archives
VOLUME /data/status

# 7. Run the application using the entrypoint script
ENTRYPOINT ["/entrypoint.sh"]