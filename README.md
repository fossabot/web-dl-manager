# Web-DL-Manager (Next.js 版)

基于 Next.js 开发的高级下载管理器，支持多引擎下载与自动化云端备份，并具备双端口伪装架构。

## 核心特性

- **双端口架构**：
  - **伪装层 (Port 5492)**：对外公开。未登录用户访问时展现为普通静态站点（如博客），有效隐藏工具属性。
  - **核心层 (Port 6275)**：对内管理。处理下载、归档及上传等高权限操作。
- **多引擎支持**：集成 `gallery-dl`, `kemono-dl`, `megadl` 等。
- **自动化流**：下载 -> 压缩 (可选分卷) -> 自动上传至云存储 (WebDAV, S3, Gofile, Openlist 等)。
- **响应式 UI**：基于 Ant Design 5.0 和 Tailwind CSS 4.0 构建，提供极佳的交互体验。

## 快速启动

### 使用 Docker (推荐)

```bash
docker run -d \
  --name web-dl-manager \
  -p 5492:5492 \
  -p 6275:6275 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e STATIC_SITE_GIT_URL="https://github.com/your-username/your-blog.git" \
  jyf0214/web-dl-manager:next
```

### 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

3. 启动伪装服务器：
   ```bash
   node camouflage-server.mjs
   ```

## 访问说明

- 访问 `http://localhost:5492` 查看伪装站点。
- 访问 `http://localhost:6275` 进入管理后台。
- 首次使用请前往 `/setup` 进行初始化配置。

## 技术栈

- **Frontend/Backend**: Next.js 15 (App Router)
- **UI Framework**: Ant Design + Antd Style
- **Database**: Prisma + SQLite/PostgreSQL
- **Process Manager**: PM2
- **Styling**: Tailwind CSS