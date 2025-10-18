FROM python:3.10-slim

# 1. Install system dependencies: zstd for compression and rclone for uploads
# Install rclone from its official script
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ca-certificates \
    zstd \
    && curl https://rclone.org/install.sh | bash \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Set up the working directory
WORKDIR /app

# 3. Install Python dependencies
COPY ./app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy the application code
COPY ./app /app

# 5. Expose the port the app runs on
EXPOSE 8000

# 6. Define data directories for downloads and archives
VOLUME /data/downloads
VOLUME /data/archives

# 7. Run the application
# Use uvicorn to run the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
