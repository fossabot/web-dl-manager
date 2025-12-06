import os
from pathlib import Path

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = Path("/data/downloads")
ARCHIVES_DIR = Path("/data/archives")
STATUS_DIR = Path("/data/status")
PRIVATE_MODE = os.getenv("PRIVATE_MODE", "false").lower() == "true"

# --- User Authentication ---
APP_USERNAME = os.getenv("APP_USERNAME", "Jyf0214")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
AVATAR_URL = os.getenv("AVATAR_URL", "https://github.com/Jyf0214.png")

# --- Database Configuration ---
# Use a MySQL connection string, e.g., "mysql://user:password@host:port/database"
# For local development, a SQLite database can be used for simplicity.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR.parent / 'webdl-manager.db'}")

# Create directories if they don't exist
try:
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(ARCHIVES_DIR, exist_ok=True)
    os.makedirs(STATUS_DIR, exist_ok=True)
except PermissionError:
    print("Permission denied to create /data directories. Creating them locally inside the project.")
    # Redefine paths to be relative to the project root (one level up from app/)
    project_root = Path(__file__).resolve().parent.parent
    DOWNLOADS_DIR = project_root / "data" / "downloads"
    ARCHIVES_DIR = project_root / "data" / "archives"
    STATUS_DIR = project_root / "data" / "status"
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(ARCHIVES_DIR, exist_ok=True)
    os.makedirs(STATUS_DIR, exist_ok=True)

# --- Translations ---
LANGUAGES = {
    "en": {
        "app_title": "Web-DL-Manager",
        "intro_text": "This is a self-hostable web application that provides a user-friendly interface for two powerful command-line downloaders: `gallery-dl` and `kemono-dl`. It allows you to download image galleries and artist creations, compress them into `.tar.zst` archives, and automatically upload them to your configured storage backend.",
        "url_label": "URL",
        "url_placeholder": "e.g., https://www.deviantart.com/username/gallery/all or https://kemono.cr/patreon/user/47335841/post/141289985",
        "downloader_label": "Downloader",
        "downloader_gallery_dl": "gallery-dl (Default)",
        "downloader_kemono_dl": "kemono-dl (kemono.party, coomer.party)",
        "kemono_warning_title": "Warning:",
        "kemono_warning_text": "The content on kemono.party and coomer.party is primarily adult-oriented. Please ensure you are of legal age and are not violating any local laws by accessing this content.",
        "advanced_options_title": "Advanced Options",
        "deviantart_credentials_title": "DeviantArt Credentials (Optional)",
        "deviantart_credentials_text": "Provide your own DeviantArt API credentials to avoid rate limits.",
        "how_to_get_them": "How to get them?",
        "client_id_label": "Client ID",
        "client_secret_label": "Client Secret",
        "rate_limit_title": "Rate Limit",
        "rate_limit_text": "Limit download and upload speed (e.g., 500K, 2M).",
        "upload_rate_limit_text": "Limit upload speed (e.g., 500K, 2M).",
        "rate_limit_label": "Rate Limit",
        "proxy_text": "Use a proxy to bypass IP blocks (e.g., from CloudFront).",
        "proxy_label": "Proxy URL",
        "proxy_placeholder": "e.g., http://user:pass@host:port",
        "upload_config_title": "Upload Configuration",
        "upload_service_label": "Upload Service",
        "select_service_option": "-- Select a Service --",
        "webdav_option": "WebDAV",
        "s3_option": "S3 Compatible",
        "b2_option": "Backblaze B2",
        "gofile_option": "gofile.io",
        "remote_upload_path_label": "Remote Upload Path/Bucket",
        "remote_upload_path_placeholder": "e.g., my-bucket/archives",
        "webdav_settings_title": "WebDAV Settings",
        "webdav_url_label": "WebDAV URL",
        "webdav_url_placeholder": "e.g., https://your-server.com/remote.php/dav/files/username",
        "webdav_username_label": "WebDAV Username",
        "webdav_password_label": "WebDAV Password",
        "s3_settings_title": "S3 Settings",
        "s3_provider_label": "S3 Provider",
        "s3_provider_placeholder": "AWS",
        "access_key_id_label": "Access Key ID",
        "secret_access_key_label": "Secret Access Key",
        "region_label": "Region",
        "region_placeholder": "us-east-1",
        "endpoint_url_label": "Endpoint URL (optional)",
        "endpoint_url_placeholder": "e.g., https://s3.custom.com",
        "b2_settings_title": "Backblaze B2 Settings",
        "account_id_label": "Account ID or Application Key ID",
        "application_key_label": "Application Key",
        "gofile_settings_title": "gofile.io Settings",
        "api_token_label": "API Token (optional)",
        "gofile_folder_id_label": "Folder ID (optional)",
        "start_download_button": "Start Download",
        "powered_by": "Powered by gallery-dl, FastAPI, rclone, and zstd.",
        "job_status_title": "Job Status",
        "task_id_label": "Task ID:",
        "auto_refresh_label": "Auto-refresh",
        "copy_button": "Copy",
        "copied_button": "Copied!",
        "start_new_job_button": "Start New Job",
        "service_unavailable_title": "Service Unavailable",
        "service_unavailable_message": "Please access through your designated login page.",
        "url_and_service_required": "URL and Upload Service are required.",
        "upload_path_required": "Upload Path is required for this service.",
        "job_not_found": "Job not found.",
        "cloudflare_tunnel_title": "Cloudflare Tunnel",
        "cloudflared_token_label": "Cloudflared Token",
        "start_tunnel_button": "Start Tunnel",
        "stop_tunnel_button": "Stop Tunnel",
        "tunnel_status_title": "Tunnel Status",
        "enable_compression_label": "Enable Compression",
        "split_compression_label": "Split Compression",
        "split_size_label": "Split Size (MB)",
        "all_tasks_title": "All Tasks",
        "no_tasks_found": "No tasks found.",
        "task_url_label": "URL:",
        "task_command_label": "Command:",
        "task_error_label": "Error:",
        "task_gofile_link_label": "Gofile Link:",
        "pause_button": "Pause",
        "resume_button": "Resume",
        "retry_button": "Retry",
        "view_log_button": "View Log",
        "delete_button": "Delete",
        "delete_task_confirm": "Are you sure you want to delete this task?",
    },
    "zh": {
        "app_title": "Web-DL-Manager",
        "intro_text": "这是一个可自托管的 Web 应用程序，它为两个强大的命令行下载器：`gallery-dl` 和 `kemono-dl` 提供了一个用户友好的界面。它允许您下载图片画廊和创作者作品，将其压缩为 `.tar.zst` 存档，并自动上传到您配置的存储后端。",
        "url_label": "网址",
        "url_placeholder": "例如：https://www.deviantart.com/username/gallery/all 或 https://kemono.cr/patreon/user/47335841/post/141289985",
        "downloader_label": "下载器",
        "downloader_gallery_dl": "gallery-dl (默认)",
        "downloader_kemono_dl": "kemono-dl (kemono.party, coomer.party)",
        "kemono_warning_title": "警告:",
        "kemono_warning_text": "kemono.party 和 coomer.party 上的内容主要面向成人。请确保您已达到法定年龄，并且访问此内容不违反任何当地法律。",
        "advanced_options_title": "高级选项",
        "deviantart_credentials_title": "DeviantArt 凭证 (可选)",
        "deviantart_credentials_text": "提供您自己的 DeviantArt API 凭证以避免速率限制。",
        "how_to_get_them": "如何获取？",
        "client_id_label": "客户端 ID",
        "client_secret_label": "客户端密钥",
        "rate_limit_title": "速度限制",
        "rate_limit_text": "限制下载和上传速度 (例如, 500K, 2M).",
        "upload_rate_limit_text": "限制上传速度 (例如, 500K, 2M).",
        "rate_limit_label": "速度限制",
        "proxy_text": "使用代理绕过 IP 封锁（例如来自 CloudFront）。",
        "proxy_label": "代理 URL",
        "proxy_placeholder": "例如：http://user:pass@host:port",
        "auto_proxy_label": "从公共列表自动选择代理",
        "disclaimer_title": "免责声明:",
        "disclaimer_text": "此功能使用来自第三方的公共代理。使用公共代理存在固有的安全和隐私风险。您的流量可能被监控，您的数据可能被代理运营商拦截。使用此功能风险自负。我们不对可能发生的任何损害或数据丢失负责。",
        "upload_config_title": "上传配置",
        "upload_service_label": "上传服务",
        "select_service_option": "-- 选择一个服务 --",
        "webdav_option": "WebDAV",
        "s3_option": "S3 兼容",
        "b2_option": "Backblaze B2",
        "gofile_option": "gofile.io",
        "remote_upload_path_label": "远程上传路径/存储桶",
        "remote_upload_path_placeholder": "例如：my-bucket/archives",
        "webdav_settings_title": "WebDAV 设置",
        "webdav_url_label": "WebDAV URL",
        "webdav_url_placeholder": "例如：https://your-server.com/remote.php/dav/files/username",
        "webdav_username_label": "WebDAV 用户名",
        "webdav_password_label": "WebDAV 密码",
        "s3_settings_title": "S3 设置",
        "s3_provider_label": "S3 提供商",
        "s3_provider_placeholder": "AWS",
        "access_key_id_label": "访问密钥 ID",
        "secret_access_key_label": "秘密访问密钥",
        "region_label": "区域",
        "region_placeholder": "us-east-1",
        "endpoint_url_label": "端点 URL (可选)",
        "endpoint_url_placeholder": "例如：https://s3.custom.com",
        "b2_settings_title": "Backblaze B2 设置",
        "account_id_label": "账户 ID 或应用程序密钥 ID",
        "application_key_label": "应用程序密钥",
        "gofile_settings_title": "gofile.io 设置",
        "api_token_label": "API 令牌 (可选)",
        "gofile_folder_id_label": "文件夹 ID (可选)",
        "start_download_button": "开始下载",
        "powered_by": "由 gallery-dl, FastAPI, rclone 和 zstd 提供支持。",
        "job_status_title": "任务状态",
        "task_id_label": "任务 ID:",
        "auto_refresh_label": "自动刷新",
        "copy_button": "复制",
        "copied_button": "已复制!",
        "start_new_job_button": "开始新任务",
        "service_unavailable_title": "服务不可用",
        "service_unavailable_message": "请通过您指定的登录页面访问。",
        "url_and_service_required": "网址和上传服务是必需的。",
        "upload_path_required": "此服务需要上传路径。",
        "job_not_found": "任务未找到。",
        "cloudflare_tunnel_title": "Cloudflare 隧道",
        "cloudflared_token_label": "Cloudflared 令牌",
        "start_tunnel_button": "启动隧道",
        "stop_tunnel_button": "停止隧道",
        "tunnel_status_title": "隧道状态",
        "enable_compression_label": "启用压缩",
        "split_compression_label": "分卷压缩",
        "split_size_label": "分卷大小 (MB)",
        "all_tasks_title": "所有任务",
        "no_tasks_found": "未找到任何任务。",
        "task_url_label": "网址:",
        "task_command_label": "命令:",
        "task_error_label": "错误:",
        "task_gofile_link_label": "Gofile 链接:",
        "pause_button": "暂停",
        "resume_button": "继续",
        "retry_button": "重试",
        "view_log_button": "查看日志",
        "delete_button": "删除",
        "delete_task_confirm": "您确定要删除此任务吗？",
    }
}
