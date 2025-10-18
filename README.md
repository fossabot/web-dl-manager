# Gallery-DL Docker Web

This repository contains a self-hosted web application that allows you to download image galleries using the powerful `gallery-dl` command-line tool, compress them into `.zst` archives, and automatically upload them to a configured storage backend.

The entire application is containerized with Docker and comes with a GitHub Actions workflow for automated builds and publishing to the GitHub Container Registry.

## Features

-   **Web Interface:** A simple, clean UI to submit and monitor download jobs.
-   **Powered by `gallery-dl`:** Supports hundreds of websites.
-   **Automatic Compression:** Downloads are compressed using Zstandard (`.zst`) for efficient storage.
-   **Flexible Uploads:** Upload archives to WebDAV, S3-compatible services, or Backblaze B2 using `rclone`.
-   **Containerized:** Easy to deploy and manage with Docker.
-   **CI/CD Ready:** Includes a GitHub Actions workflow to automatically build and publish the Docker image.

## How It Works

1.  You submit a gallery URL and your storage credentials through the web form.
2.  The FastAPI backend starts a background job.
3.  `gallery-dl` downloads the content into a temporary directory inside the container.
4.  The downloaded directory is compressed into a single `.zst` archive.
5.  `rclone` uploads the archive to your specified destination (WebDAV, S3, or B2).
6.  You can monitor the progress through a status page that shows the live logs of the job.

## Getting Started

### 1. Prerequisites

-   Docker installed on your machine.
-   A GitHub account to fork the repository and use GitHub Actions.

### 2. Setup

1.  **Fork this repository** to your own GitHub account.
2.  **GitHub Actions** will automatically run, build the Docker image, and push it to your account's GitHub Container Registry (`ghcr.io`). You can find the published image under the "Packages" section of your forked repository.

### 3. Running the Container

To run the application, you need to pull the image from `ghcr.io` and run it with Docker. You must map a local directory to the `/data` volume inside the container to persist job logs, downloads, and archives.

```bash
# Create a local directory to store data
mkdir -p ./gallery-dl-data

# Pull the image (replace <YOUR_GITHUB_USERNAME> and <REPOSITORY_NAME>)
docker pull ghcr.io/Jyf0214/gallery-dl-web:main

# Run the container
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  --name gallery-dl-web \
  ghcr.io/Jyf0214/gallery-dl-web:main
```

After running the command, the web interface will be accessible at `http://localhost:8000`.

The `./gallery-dl-data` directory on your host machine will contain three subdirectories:
-   `downloads`: Staging area for active downloads.
-   `archives`: Stores the compressed `.zst` files.
-   `status`: Contains the log files for each job.

## Security Considerations

**IMPORTANT:** This application is designed as a personal tool. The current implementation handles credentials (like WebDAV passwords or S3 keys) by creating temporary configuration files inside the container.

-   **Do not expose this application to the public internet without proper authentication and security hardening.**
-   It is highly recommended to run this on a trusted local network or behind a reverse proxy with authentication (e.g., Authelia, Nginx with basic auth, etc.).
-   The credentials you enter are passed in plain text from the form to the server and written to temporary files. Ensure you are using HTTPS if accessing it over a network.

## Customization

-   **Frontend:** The HTML templates are located in `app/templates`. You can modify them to change the look and feel.
-   **Backend:** The core logic is in `app/main.py`. You can extend it to support more `rclone` backends, add more complex logic, or implement a more robust job queue (e.g., Celery with Redis).
-   **Dockerfile:** The `Dockerfile` can be modified to include additional system dependencies or change the base image.
