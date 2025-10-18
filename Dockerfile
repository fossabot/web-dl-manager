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

# 2. Create a non-root user with UID 1000
RUN useradd -m -u 1000 user

# 3. Set up the working directory and data directories
WORKDIR /app
RUN mkdir -p /data/downloads /data/archives /data/status && chown -R 1000:1000 /app /data

# 4. Install Python dependencies
COPY --chown=1000:1000 ./app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir git+https://github.com/AlphaSlayer1964/kemono-dl.git
RUN pip install --no-cache-dir git+https://github.com/AlphaSlayer1964/kemono-dl.git
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the application code and entrypoint script
COPY --chown=1000:1000 ./app /app
COPY --chown=1000:1000 ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 6. Switch to the non-root user
USER 1000

# 7. Expose the port the app runs on
EXPOSE 8000

# 8. Define data directories for downloads, archives, and status
VOLUME /data/downloads
VOLUME /data/archives
VOLUME /data/status

# 9. Run the application using the entrypoint script
ENTRYPOINT ["/entrypoint.sh"]