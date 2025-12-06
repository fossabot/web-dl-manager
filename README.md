# Web-DL-Manager

这是一个可自托管的 Web 应用程序，它为强大的命令行下载器 `gallery-dl` 和 `megadl` 提供了一个用户友好的界面。它允许您下载图片画廊和创作者作品，将其压缩为 `.tar.zst` 存档，并自动上传到您配置的存储后端。

整个应用程序使用 Docker 进行容器化，并附带一个 GitHub Actions 工作流，用于自动构建和发布镜像。

## 功能

-   **双下载器支持：** 在以下两者之间无缝切换：
    -   **`gallery-dl`：** 用于从数百个图片画廊网站下载。
    -   **`megadl`：** 用于从 MEGA.nz 公共链接下载文件（无需登录）。
-   **多上传服务支持：**
    -   **WebDAV：** 支持任何 WebDAV 兼容的存储
    -   **S3 兼容：** 支持 AWS S3 和其他 S3 兼容服务
    -   **Backblaze B2：** 云存储服务
    -   **gofile.io：** 免费文件托管服务
    -   **MEGA：** 云存储服务（需要账户）
    -   **Openlist/Alist：** 自托管网盘
-   **用户认证与数据库集成：**
    -   **MySQL/SQLite 支持：** 通过标准的 `DATABASE_URL` 连接字符串配置您的数据库，支持 MySQL 和 SQLite。
    -   **首次运行设置：** 如果数据库中没有管理员用户，首次访问时应用会引导您创建管理员账户。
    -   **多用户支持：** 数据库驱动的认证系统。
    -   **密码修改功能：** 用户可以在登录后修改自己的密码。
    -   **配置持久化：** 应用配置和任务日志存储在数据库中，确保跨重启保持一致。
-   **伪装站点：**
    -   可以在 `5492` 端口上运行一个独立的静态网站作为伪装，而主应用在 `6275` 本地端口上运行，以增强隐私性。
-   **现代化的 Web 界面：** 使用 Bootstrap 5 构建的简洁、响应式的用户界面，支持中英文切换。
-   **高级下载选项：**
    -   **DeviantArt 凭证：** 提供您自己的 API 密钥以避免速率限制。
    -   **代理支持：** 支持手动指定 HTTP 代理或自动从公共代理列表选择。
    -   **速率限制：** 可设置下载和上传速度限制。
-   **高效的归档：** 下载内容被打包成 `.tar.zst` 存档，以便高效存储和传输。
-   **分卷压缩：** 支持大文件分卷压缩，可自定义分卷大小。
-   **实时日志：** 重新设计的状态页面可实时显示作业日志，无需刷新页面，并包含一键复制功能。
-   **容器化与 CI/CD 就绪：** 使用 Docker 轻松部署，并包含用于自动构建的 GitHub Actions 工作流。

## 工作原理

1.  您通过 Web 表单选择一个下载器（`gallery-dl` 或 `megadl`）并提交一个 URL。
2.  选择上传服务并配置相应参数。
3.  您可以指定高级选项，如 DeviantArt 凭证、代理设置或速率限制。
4.  FastAPI 后端启动一个后台作业。
5.  所选的下载器将内容抓取到临时目录中。
6.  下载的文件被打包成 `.tar` 归档，然后使用 Zstandard（`.tar.zst`）进行压缩。归档文件根据 URL 命名以便于识别。
7.  归档文件被上传到您选择的目的地（支持多种云存储服务）。
8.  整个过程可以在一个实时状态页面上进行监控。
9.  所有并发作业完成后，服务器会自动清理临时下载和归档文件。

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

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite:///webdl-manager.db` |
| `SESSION_SECRET_KEY` | 会话密钥 | `web-dl-manager-shared-secret-key-2024` |
| `STATIC_SITE_GIT_URL` | 伪装站点 Git 仓库 URL | - |
| `STATIC_SITE_GIT_BRANCH` | 伪装站点 Git 分支 | `main` |
| `PRIVATE_MODE` | 私有模式 | `false` |

## 支持的下载器

### gallery-dl
- 支持数百个图片画廊网站
- 需要时可配置 DeviantArt API 凭证
- 支持代理和速率限制

### megadl (来自 megatools 套件)
- 从 MEGA.nz 公共链接下载文件
- 无需登录即可下载公开分享的文件
- 支持速率限制 (`--limit-speed` 参数)

## 支持的上传服务

### WebDAV
- 支持任何 WebDAV 兼容的存储
- 需要 URL、用户名和密码

### S3 兼容
- 支持 AWS S3 和其他 S3 兼容服务
- 需要访问密钥、密钥、区域和端点

### Backblaze B2
- 云存储服务
- 需要账户 ID 和应用密钥

### gofile.io
- 免费文件托管服务
- 需要 API 令牌（可选文件夹 ID）

### MEGA
- 云存储服务
- 需要邮箱和密码
- 支持两步验证码（可选）

### Openlist/Alist
- 自托管网盘
- 需要 URL、用户名和密码

## 安全注意事项

- **会话密钥：** 建议通过 `SESSION_SECRET_KEY` 环境变量设置自定义会话密钥
- **数据库连接：** 使用安全的数据库连接字符串，避免硬编码密码
- **公开访问：** 主应用默认只监听 `127.0.0.1`，需要通过反向代理或内网穿透工具暴露
- **文件清理：** 任务完成后自动清理临时文件，避免磁盘空间泄漏

## 免责声明

-   **一般免责声明：** 本工具按"原样"提供，不作任何保证。用户对使用本应用程序下载的任何内容负全部责任。请尊重您所下载网站的服务条款以及内容创作者的知识产权。
-   **安全性：** 本应用程序旨在作为个人工具使用。请勿在没有适当安全措施（例如，将其置于认证反向代理之后）的情况下将其暴露于公共互联网。