# Gallery-DL Docker 网页应用

本项目是一个可自托管的 Web 应用程序。它允许您使用强大的命令行工具 `gallery-dl` 下载图库，将其压缩为 `.zst` 存档，并自动上传到您配置的存储后端。

整个应用程序使用 Docker 进行了容器化，并附带一个 GitHub Actions 工作流，用于自动构建镜像并将其发布到 GitHub Container Registry。

## 功能特性

-   **网页界面:** 提供一个简洁的 UI 来提交和监控下载任务。
-   **`gallery-dl` 驱动:** 支持数百个网站。
-   **自动压缩:** 下载内容会使用 Zstandard (`.zst`) 进行压缩，以实现高效存储。
-   **灵活上传:** 使用 `rclone` 将存档上传到 WebDAV、S3 兼容服务或 Backblaze B2。
-   **容器化:** 易于使用 Docker 进行部署和管理。
-   **CI/CD 就绪:** 包含一个 GitHub Actions 工作流，可自动构建和发布 Docker 镜像。

## 工作原理

1.  您通过网页表单提交一个图库 URL 和您的存储凭据。
2.  FastAPI 后端启动一个后台任务。
3.  `gallery-dl` 将内容下载到容器内的一个临时目录中。
4.  下载的目录被压缩成一个单独的 `.zst` 存档文件。
5.  `rclone` 将存档上传到您指定的目标（WebDAV、S3 或 B2）。
6.  您可以通过一个状态页面监控任务进度，该页面会实时显示任务日志。

## 如何开始

### 1. 先决条件

-   您的机器上已安装 Docker。
-   一个 GitHub 账户，用于 Fork 本仓库并使用 GitHub Actions。

### 2. 安装设置

1.  **Fork 本仓库** 到您自己的 GitHub 账户。
2.  **GitHub Actions** 将会自动运行，构建 Docker 镜像，并将其推送到您账户的 GitHub Container Registry (`ghcr.io`)。您可以在 Fork 后的仓库的 "Packages" 部分找到已发布的镜像。

### 3. 运行容器

要运行此应用，您需要从 `ghcr.io` 拉取镜像并使用 Docker 运行它。您必须将一个本地目录映射到容器内的 `/data` 卷，以便持久化存储任务日志、下载内容和存档文件。

```bash
# 创建一个本地目录用于存储数据
mkdir -p ./gallery-dl-data

# 拉取镜像
docker pull ghcr.io/Jyf0214/gallery-dl-web:main

# 运行容器
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  --name gallery-dl-web \
  ghcr.io/Jyf0214/gallery-dl-web:main
```

运行命令后，Web 界面将可以通过 `http://localhost:8000` 访问。

您宿主机上的 `./gallery-dl-data` 目录将包含三个子目录：
-   `downloads`: 正在进行的下载任务的暂存区。
-   `archives`: 存储压缩后的 `.zst` 文件。
-   `status`: 包含每个任务的日志文件。

## 安全注意事项

**重要提示:** 本应用设计为一个个人工具。目前的实现方式是通过在容器内创建临时配置文件来处理凭据（如 WebDAV 密码或 S3 密钥）。

-   **请勿在没有适当认证和安全加固的情况下将此应用暴露在公共互联网上。**
-   强烈建议在受信任的本地网络中运行，或将其置于带有身份验证的反向代理之后（例如，Authelia、Nginx with basic auth 等）。
-   您输入的凭据会以明文形式从表单传递到服务器，并写入临时文件。如果通过网络访问，请确保使用 HTTPS。

## 定制化

-   **前端:** HTML 模板位于 `app/templates` 目录中。您可以修改它们来改变外观和感觉。
-   **后端:** 核心逻辑位于 `app/main.py`。您可以扩展它以支持更多的 `rclone` 后端，添加更复杂的逻辑，或实现一个更健壮的任务队列（例如，Celery with Redis）。
-   **Dockerfile:** 您可以修改 `Dockerfile` 来包含额外的系统依赖或更改基础镜像。