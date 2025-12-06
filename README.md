# Web-DL-Manager

这是一个可自托管的 Web 应用程序，它为两个强大的命令行下载器 `gallery-dl` 和 `kemono-dl` 提供了一个用户友好的界面。它允许您下载图片画廊和创作者作品，将其压缩为 `.tar.zst` 存档，并自动上传到您配置的存储后端。

整个应用程序使用 Docker 进行容器化，并附带一个 GitHub Actions 工作流，用于自动构建和发布镜像。

## 功能

-   **双下载器支持：** 在以下两者之间无缝切换：
    -   **`gallery-dl`：** 用于从数百个图片画廊网站下载。
    -   **`kemono-dl`：** 用于从 `kemono.party` 和 `coomer.party` 下载。
-   **用户认证与数据库集成：**
    -   **MySQL/SQLite 支持：** 通过标准的 `DATABASE_URL` 连接字符串配置您的数据库，支持 MySQL 和 SQLite。
    -   **首次运行设置：** 如果数据库中没有管理员用户，首次访问时应用会引导您创建管理员账户。
    -   **多用户支持：** 数据库驱动的认证系统。
    -   **配置持久化：** 应用配置和任务日志存储在数据库中，确保跨重启保持一致。
-   **伪装站点：**
    -   可以在 `5492` 端口上运行一个独立的静态网站作为伪装，而主应用在 `6275` 本地端口上运行，以增强隐私性。
-   **现代化的 Web 界面：** 使用 Bootstrap 5 构建的简洁、响应式的用户界面。
-   **高级下载选项：**
    -   **DeviantArt 凭证：** 提供您自己的 API 密钥以避免速率限制。
    -   **代理支持：** 支持手动指定 HTTP 代理。
-   **高效的归档：** 下载内容被打包成 `.tar.zst` 存档，以便高效存储和传输。
-   **灵活的上传：** 利用 `rclone` 将存档上传到各种云存储提供商（WebDAV、S3、B2）或 `gofile.io`。
-   **实时日志：** 重新设计的状态页面可实时显示作业日志，无需刷新页面，并包含一键复制功能。
-   **容器化与 CI/CD 就绪：** 使用 Docker 轻松部署，并包含用于自动构建的 GitHub Actions 工作流。

## 工作原理

1.  您通过 Web 表单选择一个下载器（`gallery-dl` 或 `kemono-dl`）并提交一个 URL。
2.  您可以指定高级选项，如 DeviantArt 凭证或代理设置。
3.  FastAPI 后端启动一个后台作业。
4.  所选的下载器将内容抓取到临时目录中。
5.  下载的文件被打包成 `.tar` 归档，然后使用 Zstandard（`.tar.zst`）进行压缩。归档文件根据 URL 命名以便于识别。
6.  归档文件被上传到您选择的目的地（`gofile.io` 或 `rclone` 后端）。
7.  整个过程可以在一个实时状态页面上进行监控。
8.  所有并发作业完成后，服务器会自动清理临时下载和归档文件。

## 开始使用

### 先决条件

-   您的机器上已安装 Docker。
-   一个 GitHub 账户，用于 Fork 仓库和使用 GitHub Actions。

### 安装

1.  **Fork 此仓库** 到您自己的 GitHub 账户。
2.  **GitHub Actions** 将自动运行，构建 Docker 镜像，并将其推送到您账户的 GitHub Container Registry (`ghcr.io`)。您可以在 Fork 后的仓库的 "Packages" 部分找到已发布的镜像。

### 运行容器

要运行应用程序，请从 `ghcr.io` 拉取镜像并使用 Docker 运行。您必须将本地目录映射到容器中的 `/data` 卷以持久化任务日志和文件。

```bash
# 创建一个本地数据目录
mkdir -p ./gallery-dl-data

# 拉取镜像 (将 'your-github-username' 替换为您的 GitHub 用户名)
docker pull ghcr.io/your-github-username/web-dl-manager:main

# 运行容器
docker run -d \
  -p 5492:5492 \
  -p 127.0.0.1:6275:6275 \
  -v ./gallery-dl-data:/data \
  -e DATABASE_URL="mysql://user:password@host:port/database" \
  -e STATIC_SITE_GIT_URL="https://github.com/user/blog.git" \
  -e STATIC_SITE_GIT_BRANCH="main" \
  --name web-dl-manager \
  ghcr.io/your-github-username/web-dl-manager:main
```

伪装站点将可以通过 `http://localhost:5492` 访问。主应用的功能需要通过内网穿透工具从 `127.0.0.1:6275` 暴露出来。

## 免责声明

-   **一般免责声明：** 本工具按“原样”提供，不作任何保证。用户对使用本应用程序下载的任何内容负全部责任。请尊重您所下载网站的服务条款以及内容创作者的知识产权。
-   **内容警告：** 使用 `kemono-dl` 下载器时，请注意目标网站上的内容主要面向成人。请确保您在您所在司法管辖区已达到法定年龄，并且访问或下载此内容不违反任何当地法律。
-   **安全性：** 本应用程序旨在作为个人工具使用。请勿在没有适当安全措施（例如，将其置于认证反向代理之后）的情况下将其暴露于公共互联网。
