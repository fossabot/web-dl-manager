# Gallery-DL & Kemono-DL Web

This is a self-hostable web application that provides a user-friendly interface for two powerful command-line downloaders: `gallery-dl` and `kemono-dl`. It allows you to download image galleries and artist creations, compress them into `.tar.zst` archives, and automatically upload them to your configured storage backend.

The entire application is containerized using Docker and comes with a GitHub Actions workflow for automated image building and publishing.

## Features

-   **Dual Downloader Support:** Seamlessly switch between:
    -   **`gallery-dl`:** For downloading from hundreds of image gallery sites.
    -   **`kemono-dl`:** For downloading from `kemono.party` and `coomer.party`.
-   **User Authentication & Blog:**
    -   **Private Mode:** Run the application in a private mode with a login page.
    -   **Customizable User:** Set the username, password (optional), and avatar via environment variables (`APP_USERNAME`, `APP_PASSWORD`, `AVATAR_URL`).
    -   **Blog Index:** Display a static blog from a Git repository at the root URL.
    -   **Task Viewer:** In private mode, logged-in users can view all tasks on the `/tasks` page.
-   **Modern Web Interface:** A clean, responsive UI built with Bootstrap 5.
-   **Advanced Download Options:**
    -   **DeviantArt Credentials:** Provide your own API keys to avoid rate-limiting.
    -   **Proxy Support:**
        -   Manually specify an HTTP proxy.
        -   **Auto-Proxy:** Automatically fetch and concurrently test proxies from a public list to find a working one, with a retry mechanism.
-   **Efficient Archiving:** Downloads are packaged into `.tar.zst` archives for efficient storage and transfer.
-   **Flexible Uploads:** Utilizes `rclone` to upload archives to various cloud storage providers (WebDAV, S3, B2) or `gofile.io`. **For `openlist` service, both compressed and uncompressed uploads are handled directly by `openlist.py` for seamless integration. When uploading to a directory containing "terabox", an additional `task_id` subdirectory will not be created.**
-   **Real-time Logging:** A redesigned status page shows job logs in real-time without page reloads, and includes a copy-to-clipboard feature.
-   **Containerized & CI/CD Ready:** Easy to deploy with Docker and includes a GitHub Actions workflow for automated builds.

## How It Works

1.  You select a downloader (`gallery-dl` or `kemono-dl`) and submit a URL through the web form.
2.  You can specify advanced options like DeviantArt credentials or proxy settings.
3.  The FastAPI backend starts a background job.
4.  The chosen downloader fetches the content into a temporary directory.
5.  The downloaded files are packed into a `.tar` archive and then compressed with Zstandard (`.tar.zst`). The archive is named based on the URL for easy identification.
6.  The archive is uploaded to your selected destination (`gofile.io` or an `rclone` backend).
7.  The entire process can be monitored on a real-time status page.
8.  Once all concurrent jobs are finished, the server automatically cleans up the temporary download and archive files.

## Getting Started

### Prerequisites

-   Docker installed on your machine.
-   A GitHub account to fork the repository and use GitHub Actions.

### Installation

1.  **Fork this repository** to your own GitHub account.
2.  **GitHub Actions** will automatically run, build the Docker image, and push it to your account's GitHub Container Registry (`ghcr.io`). You can find the published image in the "Packages" section of your forked repository.

### Running the Container

To run the application, pull the image from `ghcr.io` and run it with Docker. You must map a local directory to the `/data` volume in the container to persist task logs and files.

```bash
# Create a local directory for data
mkdir -p ./gallery-dl-data

# Pull the image (replace with your GitHub username)
docker pull ghcr.io/literal:Jyf0214/literal:gallery-dl-web:main

# Run the container
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  --name gallery-dl-web \
  ghcr.io/literal:Jyf0214/literal:gallery-dl-web:main
```

The web interface will be accessible at `http://localhost:8000`.

#### Private Mode

To run the application in private mode (which returns a 503 error on the root path), set the `PRIVATE_MODE` environment variable to `true`:

```bash
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  -e PRIVATE_MODE=true \
  -e APP_USERNAME=your_username \
  -e APP_PASSWORD=your_password \
  -e AVATAR_URL=https://your-avatar.com/avatar.png \
  -e STATIC_SITE_GIT_URL=https://github.com/user/blog.git \
  -e STATIC_SITE_GIT_BRANCH=main \
  --name gallery-dl-web \
  ghcr.io/literal:Jyf0214/literal:gallery-dl-web:main
```

In private mode, you should access the application via a specific path like `/login`.

## Disclaimers

-   **General Disclaimer:** This tool is provided as-is, without any warranty. The user is solely responsible for any content downloaded using this application. Please respect the terms of service of the websites you are downloading from and the intellectual property rights of the content creators.
-   **Content Warning:** When using the `kemono-dl` downloader, be aware that the content on the target sites is primarily adult-oriented. Please ensure you are of legal age in your jurisdiction and are not violating any local laws by accessing or downloading this content.
-   **Public Proxies:** The auto-proxy feature uses publicly available proxies. These proxies come with inherent security and privacy risks. Your traffic may be monitored, and your data could be intercepted. Use this feature at your own risk. We are not responsible for any damages or data loss that may occur.
-   **Security:** This application is intended as a personal tool. Do not expose it to the public internet without proper security measures, such as placing it behind an authenticating reverse proxy.
