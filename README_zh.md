# Gallery-DL & Kemono-DL Web (中文版)

这是一个可自托管的 Web 应用程序，它为两个强大的命令行下载器：`gallery-dl` 和 `kemono-dl` 提供了一个用户友好的界面。它允许您下载图片画廊和创作者作品，将其压缩为 `.tar.zst` 存档，并自动上传到您配置的存储后端。

整个应用程序使用 Docker 进行了容器化，并附带一个 GitHub Actions 工作流，用于自动构建镜像并将其发布到 GitHub Container Registry。

[English Version](README.md)

## 功能特性

-   **双下载器支持:** 无缝切换:
    -   **`gallery-dl`:** 用于下载数百个图片画廊网站的内容。
    -   **`kemono-dl`:** 用于下载 `kemono.party` 和 `coomer.party` 的内容。
-   **现代化网页界面:** 使用 Bootstrap 5 构建的简洁、响应式 UI。
-   **高级下载选项:**
    -   **DeviantArt 凭证:** 提供您自己的 API 密钥以避免速率限制。
    -   **代理支持:**
        -   手动指定 HTTP 代理。
        -   **自动代理:** 自动从公共代理列表中获取并并发测试代理，以找到一个可用的代理，并带有重试机制。
-   **高效归档:** 下载内容被打包成 `.tar.zst` 存档，以实现高效存储和传输。
-   **灵活上传:** 利用 `rclone` 将存档上传到各种云存储提供商 (WebDAV, S3, B2) 或 `gofile.io`。
-   **私有与公共部署:** 可以运行在公共模式或私有模式（通过环境变量激活）下，供个人使用。
-   **自动清理:** 仅在所有活动任务完成后，智能地清理下载和归档目录。
-   **实时日志:** 重新设计的状态页面实时显示任务日志，无需页面刷新，并包含复制到剪贴板的功能。
-   **容器化与 CI/CD 就绪:** 易于使用 Docker 部署，并包含一个 GitHub Actions 工作流，可自动构建。

## 工作原理

1.  您通过网页表单选择一个下载器 (`gallery-dl` 或 `kemono-dl`) 并提交一个 URL。
2.  您可以指定高级选项，如 DeviantArt 凭证或代理设置。
3.  FastAPI 后端启动一个后台任务。
4.  所选的下载器将内容下载到容器内的一个临时目录中。
5.  下载的文件被打包成一个 `.tar` 存档，然后使用 Zstandard (`.tar.zst`) 进行压缩。存档根据 URL 命名，便于识别。
6.  存档被上传到您选择的目标 (`gofile.io` 或 `rclone` 后端)。
7.  整个过程可以在实时状态页面上监控。
8.  一旦所有并发任务完成，服务器会自动清理临时下载和归档文件。

## 如何开始

### 先决条件

-   您的机器上已安装 Docker。
-   一个 GitHub 账户，用于 Fork 本仓库并使用 GitHub Actions。

### 安装设置

1.  **Fork 本仓库** 到您自己的 GitHub 账户。
2.  **GitHub Actions** 将会自动运行，构建 Docker 镜像，并将其推送到您账户的 GitHub Container Registry (`ghcr.io`)。您可以在 Fork 后的仓库的 "Packages" 部分找到已发布的镜像。

### 运行容器

要运行此应用，请从 `ghcr.io` 拉取镜像并使用 Docker 运行它。您必须将一个本地目录映射到容器内的 `/data` 卷，以便持久化存储任务日志、下载内容和存档文件。

```bash
# 创建一个本地目录用于存储数据
mkdir -p ./gallery-dl-data

# 拉取镜像 (替换为您的 GitHub 用户名)
docker pull ghcr.io/literal:Jyf0214/literal:gallery-dl-web:main

# 运行容器
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  --name gallery-dl-web \
  ghcr.io/literal:Jyf0214/literal:gallery-dl-web:main
```

运行命令后，Web 界面将可以通过 `http://localhost:8000` 访问。

#### 私有模式

要在私有模式下运行应用程序（根路径返回 503 错误），请将 `PRIVATE_MODE` 环境变量设置为 `true`：

```bash
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  -e PRIVATE_MODE=true \
  --name gallery-dl-web \
  ghcr.io/literal:Jyf0214/literal:gallery-dl-web:main
```

在私有模式下，您应该通过 `/login` 等特定路径访问应用程序。

## 免责声明

-   **内容警告:** 当使用 `kemono-dl` 下载器时，请注意目标网站上的内容主要面向成人。请确保您已达到您所在司法管辖区的法定年龄，并且访问或下载此内容没有违反任何当地法律。
-   **公共代理:** 自动代理功能使用公共可用的代理。这些代理存在固有的安全和隐私风险。您的流量可能被监控，您的数据可能被代理运营商拦截。使用此功能风险自负。我们不对可能发生的任何损害或数据丢失负责。
-   **安全性:** 本应用程序旨在作为个人工具。在没有适当的安全措施（例如将其置于带有身份验证的反向代理之后）的情况下，请勿将其暴露在公共互联网上。
