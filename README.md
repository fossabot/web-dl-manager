# Web-DL-Manager 🚀

[![Docker Build](https://github.com/Jyf0214/web-dl-manager/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/Jyf0214/web-dl-manager/actions/workflows/docker-publish.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Jyf0214/web-dl-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FJyf0214%2Fweb-dl-manager.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FJyf0214%2Fweb-dl-manager?ref=badge_shield)

**Web-DL-Manager** 是一款专为私有化部署设计的自动化下载与云端分发管理系统。它不仅为 `gallery-dl` 和 `megadl` 提供了现代化的 Web 界面，更集成了一套从**高效抓取**、**极速压缩**到**多云端自动上传**的完整工作流。

---

## ✨ 核心特性

### 1. 🛡️ 安全隔离架构 (Camouflage Mode)
- **双应用设计**：系统同时运行两个 FastAPI 实例：
  - **伪装层 (Port 5492)**：对外公开。未登录用户访问时展现为普通静态站点（由 `STATIC_SITE_GIT_URL` 指定），有效隐藏工具属性。
  - **核心层 (Port 6275)**：对内管理。处理下载、归档及上传等高权限操作。
- **反探测**：隐藏所有敏感 API 响应，仅在身份验证后暴露管理入口。

### 2. 🏗️ 现代化数据库支持 (SQLAlchemy)
- **多后端适配**：支持默认的 **SQLite**（轻量化）或生产级的 **MySQL**。
- **动态配置持久化**：系统参数（如 API Token、上传地址等）支持在 Web UI 设置页面动态修改并持久化到数据库，无需频繁重启容器。

### 3. 📥 强大的下载能力
- **Gallery-dl 集成**：原生支持数百个图片/视频站点的深度抓取（如 DeviantArt, Pixiv, Twitter 等）。
- **Mega.nz 支持**：通过 `megadl` 协议直接抓取公共链接内容。

### 4. 📦 工业级归档逻辑
- **Zstd 极速压缩**：采用 Facebook 开源的 Zstandard 算法，在保持高压缩比的同时提供极快的处理速度。
- **智能分卷压缩**：自动根据目标存储限制进行分卷打包，完美适配对单文件大小有限制的云端服务。

---

## 🚀 快速开始

### 方式一：Docker (推荐)

默认使用 SQLite：
```bash
docker run -d \
  --name web-dl-manager \
  -p 5492:5492 \
  -v ./data:/data \
  -e APP_USERNAME="admin" \
  -e APP_PASSWORD="your_password" \
  ghcr.io/jyf0214/web-dl-manager:main
```

### 方式二：使用 MySQL (Docker Compose)

```yaml
services:
  web-dl:
    image: ghcr.io/jyf0214/web-dl-manager:main
    ports:
      - "5492:5492"
    environment:
      - DATABASE_URL=mysql://user:pass@host:3306/dbname
      - APP_USERNAME=admin
      - APP_PASSWORD=secure_pass
    restart: always
```

> **注意**：首次启动后，访问 `http://ip:5492`。如果尚未配置，系统将引导至初始设置页面。

---

## 环境变量配置

| 变量 | 描述 | 默认值 |
| :--- | :--- | :--- |
| `DATABASE_URL` | 数据库连接字符串 (支持 `mysql://` 或 `sqlite:///`) | `sqlite:////data/manager.db` |
| `APP_USERNAME` | 初始管理员用户名 | `Jyf0214` |
| `APP_PASSWORD` | 初始管理员密码 | (空) |
| `STATIC_SITE_GIT_URL` | 伪装站点 Git 仓库 (用于 gh-pages 部署) | - |
| `TUNNEL_TOKEN` | Cloudflare Tunnel 令牌 | - |

---

## 技术栈

- **Backend**: FastAPI (Python)
- **Frontend**: Bootstrap 5 + Jinja2
- **Database**: SQLite / MySQL (via SQLAlchemy)
- **Process Management**: PM2 / Ecosystem.js
- **Tools**: rclone, gallery-dl, megadl, zstd

---

## 免责声明

本工具仅供学习与研究使用。用户在使用本程序下载互联网资源时，需严格遵守当地法律法规以及目标网站的《服务条款》。开发者不对用户因使用本工具而产生的任何版权纠纷或法律后果承担责任。

---

## 贡献与反馈

欢迎提交 PR 或 Issue。如果觉得好用，请给个 ⭐！


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FJyf0214%2Fweb-dl-manager.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FJyf0214%2Fweb-dl-manager?ref=badge_large)