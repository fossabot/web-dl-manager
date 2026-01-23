# Stage 1: Build
FROM python:3.13-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    binutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# 安装依赖以便 PyInstaller 扫描
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir pyinstaller

COPY . .

# 使用 spec 文件构建二进制文件
RUN pyinstaller web-dl-manager.spec

# Stage 2: Runtime
FROM python:3.13-slim

# 安装运行时系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    unzip \
    ca-certificates \
    zstd \
    git \
    cron \
    megatools \
    ffmpeg \
    && curl https://rclone.org/install.sh | bash \
    && wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i cloudflared-linux-amd64.deb \
    && rm cloudflared-linux-amd64.deb \
    && apt-get purge -y --auto-remove wget \
    && rm -rf /var/lib/apt/lists/*

# 全局安装必须的外部工具（gallery-dl, yt-dlp）
RUN pip install --no-cache-dir gallery-dl yt-dlp

# 创建非 root 用户
RUN useradd -m -u 1000 user

WORKDIR /app

# 创建必要的数据和日志目录
RUN mkdir -p /data/downloads /data/archives /data/status /app/logs

# 从构建阶段复制二进制文件及相关配置
COPY --from=builder /build/dist/web-dl-manager /app/web-dl-manager
COPY --from=builder /build/CHANGELOG.md /app/CHANGELOG.md
COPY --from=builder /build/entrypoint.sh /app/entrypoint.sh

# 设置权限
RUN chown -R 1000:1000 /app /data && chmod +x /app/web-dl-manager /app/entrypoint.sh

# 环境变量设置
ENV DEBUG_MODE=false

# 切换到非 root 用户
USER 1000

# 暴露端口
EXPOSE 5492

# 挂载持久化卷
VOLUME /data/downloads
VOLUME /data/archives
VOLUME /data/status

# 设置入口脚本
ENTRYPOINT ["/app/entrypoint.sh"]
