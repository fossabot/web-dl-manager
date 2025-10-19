import os
import uuid
import asyncio
import httpx
import random
import shutil
import json
import signal
from pathlib import Path
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from typing import Optional, Dict, Any

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

# Create directories if they don't exist
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(ARCHIVES_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)

from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

# --- Translations ---
LANGUAGES = {
    "en": {
        "app_title": "Gallery-DL & Kemono-DL Web",
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
        "proxy_text": "Use a proxy to bypass IP blocks (e.g., from CloudFront).",
        "proxy_label": "Proxy URL",
        "proxy_placeholder": "e.g., http://user:pass@host:port",
        "auto_proxy_label": "Auto-select proxy from public list",
        "disclaimer_title": "Disclaimer:",
        "disclaimer_text": "This feature uses publicly available proxies from a third-party source. The use of public proxies comes with inherent security and privacy risks. Your traffic may be monitored, and your data may be intercepted by the proxy operator. Use this feature at your own risk. We are not responsible for any damages or data loss that may occur from using this feature.",
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
    },
    "zh": {
        "app_title": "Gallery-DL & Kemono-DL 网页版",
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
    }
}

def get_lang(request: Request):
    lang_code = request.cookies.get("lang", "en")
    if lang_code not in LANGUAGES:
        lang_code = "en"
    return LANGUAGES[lang_code]

# --- FastAPI App Initialization ---
app = FastAPI(title="Gallery-DL Web UI")
app.add_middleware(SessionMiddleware, secret_key="some-random-string")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# --- Global State ---
active_tasks = 0
task_lock = asyncio.Lock()

# --- Helper Functions ---
async def cleanup_directories():
    """Clears the contents of the download and archive directories."""
    for directory in [DOWNLOADS_DIR, ARCHIVES_DIR]:
        for item in directory.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

async def get_working_proxy(status_file: Path) -> str:
    """Fetches a list of HTTP proxies, tests them concurrently, and returns a working one."""
    proxy_list_url = "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt"
    with open(status_file, "a") as f:
        f.write("Fetching proxy list...\n")
    async with httpx.AsyncClient() as client:
        response = await client.get(proxy_list_url)
        response.raise_for_status()
        proxies = response.text.splitlines()

    async def test_proxy(proxy):
        try:
            async with httpx.AsyncClient(proxies=f"http://{proxy}", timeout=5) as client:
                response = await client.get("https://www.google.com", timeout=5)
                response.raise_for_status()
                return proxy
        except Exception:
            return None

    i = 0
    while True:
        i += 1
        shuffled_proxies = random.sample(proxies, min(len(proxies), 3000))
        with open(status_file, "a") as f:
            f.write(f"Attempt {i}: Concurrently testing {len(shuffled_proxies)} proxies...\n")

        tasks = [test_proxy(p) for p in shuffled_proxies]
        for future in asyncio.as_completed(tasks):
            result = await future
            if result:
                with open(status_file, "a") as f:
                    f.write(f"Found working proxy: {result}\n")
                return result
        
        with open(status_file, "a") as f:
            f.write(f"No working proxy found in attempt {i}. Retrying with a new batch...\n")

async def run_command(command: str, command_to_log: str, status_file: Path, task_id: str):
    """Runs a shell command asynchronously, logs its progress, and stores its PGID."""
    with open(status_file, "a") as f:
        f.write(f"Executing command: {command_to_log}\n")

    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        preexec_fn=os.setsid  # Create a new process group
    )

    try:
        pgid = os.getpgid(process.pid)
        update_task_status(task_id, {"pgid": pgid})
    except ProcessLookupError:
        # Process might have finished very quickly
        pass

    async def log_stream(stream, log_prefix):
        while True:
            line = await stream.readline()
            if not line:
                break
            with open(status_file, "a") as f:
                f.write(f"{log_prefix}: {line.decode()}")

    await asyncio.gather(
        log_stream(process.stdout, "STDOUT"),
        log_stream(process.stderr, "STDERR")
    )
    await process.wait()

    # Clear the pgid when the command is finished
    update_task_status(task_id, {"pgid": None})

    if process.returncode != 0:
        with open(status_file, "a") as f:
            f.write(f"\n--- COMMAND FAILED (Exit Code: {process.returncode}) ---\n")
        raise RuntimeError(f"Command failed with exit code {process.returncode}. See status file for details: {status_file.name}")
    else:
        with open(status_file, "a") as f:
            f.write("\nCommand finished successfully.\n")

async def upload_to_gofile(file_path: Path, status_file: Path, api_token: Optional[str] = None, folder_id: Optional[str] = None) -> str:
    """Uploads a file to gofile.io, using the correct endpoint for auth vs public."""

    async def _attempt_upload(use_token: bool):
        upload_type = "authenticated" if use_token and api_token else "public"
        with open(status_file, "a") as f:
            f.write(f"Attempting {upload_type} upload...\n")

        async with httpx.AsyncClient(timeout=300) as client:
            if use_token and api_token:
                # For authenticated uploads, use the generic endpoint.
                upload_url = "https://upload.gofile.io/uploadFile"
                with open(status_file, "a") as f:
                    f.write(f"Using generic authenticated endpoint: {upload_url}\n")
                
                try:
                    form_data = {'token': api_token}
                    if folder_id:
                        form_data['folderId'] = folder_id

                    with open(file_path, "rb") as f_upload:
                        files = {'file': (file_path.name, f_upload, "application/octet-stream")}
                        response = await client.post(upload_url, data=form_data, files=files)
                    
                    response.raise_for_status()
                    upload_result = response.json()

                    if upload_result["status"] == "ok":
                        download_link = upload_result["data"]["downloadPage"]
                        with open(status_file, "a") as f:
                            f.write(f"Gofile.io authenticated upload successful! Link: {download_link}\n")
                        return download_link
                    else:
                        with open(status_file, "a") as f:
                            f.write(f"Gofile API returned an error on authenticated upload: {upload_result}\n")
                        return None
                except Exception as e:
                    with open(status_file, "a") as f:
                        f.write(f"An exception occurred during authenticated upload: {e}\n")
                    return None
            else:
                # For public uploads, use the server-switching logic.
                try:
                    with open(status_file, "a") as f:
                        f.write("Fetching Gofile server list for public upload...\n")
                    servers_res = await client.get("https://api.gofile.io/servers")
                    servers_res.raise_for_status()
                    servers = servers_res.json()["data"]["servers"]
                    random.shuffle(servers)
                except Exception as e:
                    with open(status_file, "a") as f:
                        f.write(f"FATAL: Could not fetch Gofile server list: {e}\n")
                    return None

                for server in servers:
                    server_name = server["name"]
                    upload_url = f"https://{server_name}.gofile.io/uploadFile"
                    with open(status_file, "a") as f:
                        f.write(f"Trying public upload via server: {server_name}...\n")
                    try:
                        with open(file_path, "rb") as f_upload:
                            files = {"file": (file_path.name, f_upload, "application/octet-stream")}
                            response = await client.post(upload_url, files=files)
                        response.raise_for_status()
                        upload_result = response.json()

                        if upload_result["status"] == "ok":
                            download_link = upload_result["data"]["downloadPage"]
                            with open(status_file, "a") as f:
                                f.write(f"Gofile.io public upload successful on server {server_name}! Link: {download_link}\n")
                            return download_link
                    except Exception as e:
                        with open(status_file, "a") as f:
                            f.write(f"An exception occurred during public upload to {server_name}: {e}. Trying next server...\n")
                        continue
                
                with open(status_file, "a") as f:
                    f.write("All Gofile servers failed for public upload.\n")
                return None

    # --- Main logic ---
    download_link = None
    if api_token:
        download_link = await _attempt_upload(use_token=True)

    if not download_link:
        if api_token:
            with open(status_file, "a") as f:
                f.write("Authenticated upload failed. Falling back to public upload.\n")
        download_link = await _attempt_upload(use_token=False)

    if not download_link:
        raise Exception("Gofile.io upload failed completely after trying all servers and fallback options.")

    return download_link

def create_rclone_config(task_id: str, service: str, params: dict) -> Path:
    """Creates a temporary rclone config file."""
    if service == "gofile":
        return None

    config_dir = Path("/tmp/rclone_configs")
    os.makedirs(config_dir, exist_ok=True)
    config_path = config_dir / f"{task_id}.conf"
    
    config_content = f"[remote]\ntype = {service}\n"
    
    # Basic parameter mapping
    if service == "webdav":
        config_content += f"url = {params['webdav_url']}\n"
        config_content += f"vendor = other\n"
        config_content += f"user = {params['webdav_user']}\n"
        config_content += f"pass = {params['webdav_pass']}\n" # In a real app, use rclone obscure
    elif service == "s3":
        config_content += f"provider = {params.get('s3_provider', 'AWS')}\n"
        config_content += f"access_key_id = {params['s3_access_key_id']}\n"
        config_content += f"secret_access_key = {params['s3_secret_access_key']}\n"
        config_content += f"region = {params['s3_region']}\n"
        config_content += f"endpoint = {params.get('s3_endpoint', '')}\n"
    elif service == "b2":
        config_content += f"account = {params['b2_account_id']}\n"
        config_content += f"key = {params['b2_application_key']}\n"

    with open(config_path, "w") as f:
        f.write(config_content)
        
    return config_path

def generate_archive_name(url: str) -> str:
    """Generates a descriptive archive name from a URL."""
    try:
        path_parts = [part for part in url.split("/") if part]
        if len(path_parts) > 2:
            return "_".join(path_parts[-3:])
        else:
            return "_".join(path_parts)
    except Exception:
        return "archive"

def get_task_status_path(task_id: str) -> Path:
    """Returns the path to the JSON status file for a given task."""
    return STATUS_DIR / f"{task_id}.json"

def update_task_status(task_id: str, updates: Dict[str, Any]):
    """Updates the JSON status file for a given task."""
    status_path = get_task_status_path(task_id)
    status_data = {}
    if status_path.exists():
        with open(status_path, "r") as f:
            try:
                status_data = json.load(f)
            except json.JSONDecodeError:
                pass  # Overwrite if file is corrupted
    
    status_data.update(updates)
    
    with open(status_path, "w") as f:
        json.dump(status_data, f, indent=4)

async def process_download_job(task_id: str, url: str, downloader: str, service: str, upload_path: str, params: dict):
    """The main background task for a download job."""
    task_download_dir = DOWNLOADS_DIR / task_id
    archive_name = generate_archive_name(url)
    task_archive_path = ARCHIVES_DIR / f"{archive_name}.tar.zst"
    status_file = STATUS_DIR / f"{task_id}.log"

    command_log = "" # Define command_log here to ensure it's always available

    try:
        # 1. Initial status update
        update_task_status(task_id, {"status": "running", "url": url, "downloader": downloader})
        
        with open(status_file, "w") as f:
            f.write(f"Starting job {task_id} for URL: {url}\n")

        proxy = params.get("proxy")
        if params.get("auto_proxy"):
            proxy = await get_working_proxy(status_file)
        
        downloader = params.get("downloader", "gallery-dl")

        if downloader == "kemono-dl":
            command = f"kemono-dl {url} --path {task_download_dir}"
            command_log = command
        else: # Default to gallery-dl
            command = f"gallery-dl --verbose -D {task_download_dir}"
            if params.get("deviantart_client_id") and params.get("deviantart_client_secret"):
                command += f" -o extractor.deviantart.client-id={params['deviantart_client_id']} -o extractor.deviantart.client-secret={params['deviantart_client_secret']}"
            if proxy:
                command += f" --proxy {proxy}"
            command += f" {url}"

            command_log = f"gallery-dl --verbose -D {task_download_dir}"
            if params.get("deviantart_client_id") and params.get("deviantart_client_secret"):
                command_log += " -o extractor.deviantart.client-id=**** -o extractor.deviantart.client-secret=****"
            if proxy:
                command_log += f" --proxy {proxy}"
            command_log += f" {url}"
        
        update_task_status(task_id, {"command": command_log})
        await run_command(command, command_log, status_file, task_id)

        # 2. Compress
        update_task_status(task_id, {"status": "compressing"})
        downloaded_folders = [d for d in task_download_dir.iterdir() if d.is_dir()]
        if downloaded_folders:
            source_to_compress = downloaded_folders[0]
        elif any(task_download_dir.iterdir()):
            source_to_compress = task_download_dir
        else:
            raise FileNotFoundError("No files found to compress.")
        
        compress_cmd = f"tar -cf - -C \"{source_to_compress}\" . | zstd -o \"{task_archive_path}\""
        await run_command(compress_cmd, compress_cmd, status_file, task_id)

        # 3. Upload
        update_task_status(task_id, {"status": "uploading"})
        if service == "gofile":
            gofile_token = params.get("gofile_token")
            gofile_folder_id = params.get("gofile_folder_id")

            # If a token is provided but a folder ID is NOT, use the default folder ID.
            if gofile_token and not gofile_folder_id:
                gofile_folder_id = "ad957716-3899-498a-bebc-716f616f9b16"

            download_link = await upload_to_gofile(
                task_archive_path,
                status_file,
                api_token=gofile_token,
                folder_id=gofile_folder_id
            )
            update_task_status(task_id, {"status": "completed", "gofile_link": download_link})
        else:
            rclone_config_path = create_rclone_config(task_id, service, params)
            remote_full_path = f"remote:{upload_path}"
            upload_cmd = (
                f"rclone copyto --config \"{rclone_config_path}\" \"{task_archive_path}\" \"{remote_full_path}/{task_id}.zst\" "
                f"-P --log-file=\"{status_file}\" --log-level=INFO"
            )
            await run_command(upload_cmd, upload_cmd, status_file, task_id)
            update_task_status(task_id, {"status": "completed"})
        
        with open(status_file, "a") as f:
            f.write("\nJob completed successfully!\n")

    except Exception as e:
        error_message = f"An error occurred: {str(e)}"
        with open(status_file, "a") as f:
            f.write(f"\n--- JOB FAILED ---\n{error_message}\n")
        update_task_status(task_id, {"status": "failed", "error": error_message})
    finally:
        # Decrement active tasks counter and cleanup if it's the last task
        async with task_lock:
            global active_tasks
            active_tasks -= 1
            if active_tasks == 0:
                await cleanup_directories()

        # Clean up temporary rclone config
        if service != "gofile":
            rclone_config_path = Path(f"/tmp/rclone_configs/{task_id}.conf")
            if rclone_config_path.exists():
                rclone_config_path.unlink()


app.mount("/assets", StaticFiles(directory="/app/static_site/assets"), name="assets")

# --- API Endpoints ---


@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt():
    return "User-agent: *\nDisallow: /"


@app.get("/", response_class=HTMLResponse)
async def get_blog_index(request: Request):
    blog_index = Path("/app/static_site/index.html")
    if blog_index.exists():
        with open(blog_index, "r") as f:
            content = f.read()
        # Inject modal login prompt (web format instead of browser popup)
        content = content.replace("</body>", """
        <!-- Login Prompt Modal -->
        <div class="modal fade" id="loginPromptModal" tabindex="-1" aria-labelledby="loginPromptModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="loginPromptModalLabel">登录提示</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <p>登录后即可使用下载功能和参与博客评论。</p>
                    </div>
                    <div class="modal-footer d-flex justify-content-center">
                        <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">关闭</button>
                        <a href="/login" class="btn btn-primary">登录</a>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            document.addEventListener("DOMContentLoaded", function() {
                setTimeout(function() {
                    // Check if user is not logged in (no session)
                    if (!document.cookie.includes("user=")) {
                        // Show the modal
                        const modalElement = document.getElementById('loginPromptModal');
                        const modal = new bootstrap.Modal(modalElement);
                        modal.show();
                    }
                }, 3000);
            });
        </script>
        </body>""")
        return HTMLResponse(content=content)
    return templates.TemplateResponse("index.html", {"request": request, "lang": get_lang(request)})

@app.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request):
    lang = get_lang(request)
    user = request.session.get("user")
    # Always require authentication regardless of PRIVATE_MODE
    # This ensures that even with wrong login records, users cannot access hidden info
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("downloader.html", {"request": request, "lang": lang, "user": user, "avatar_url": AVATAR_URL})

@app.get("/login", response_class=HTMLResponse)
async def get_login_form(request: Request):
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang})

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == APP_USERNAME and (not APP_PASSWORD or password == APP_PASSWORD):
        request.session["user"] = username
        return RedirectResponse(url="/downloader", status_code=303)
    return RedirectResponse(url="/login", status_code=303)

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=302)

@app.get("/set_language/{lang_code}")
async def set_language(lang_code: str, response: Response):
    response.set_cookie(key="lang", value=lang_code, httponly=True, expires=31536000) # 1 year
    return RedirectResponse(url="/", status_code=302)
    
@app.post("/download")
async def create_download_job(
    request: Request,
    url: str = Form(...),
    downloader: str = Form('gallery-dl'),
    upload_service: str = Form(...),
    upload_path: str = Form(None),
    # WebDAV
    webdav_url: str = Form(None),
    webdav_user: str = Form(None),
    webdav_pass: str = Form(None),
    # S3
    s3_provider: str = Form(None),
    s3_access_key_id: str = Form(None),
    s3_secret_access_key: str = Form(None),
    s3_region: str = Form(None),
    s3_endpoint: str = Form(None),
    # B2
    b2_account_id: str = Form(None),
    b2_application_key: str = Form(None),
    # Gofile
    gofile_token: str = Form(None),
    gofile_folder_id: str = Form(None),
    # DeviantArt
    deviantart_client_id: str = Form(None),
    deviantart_client_secret: str = Form(None),
    proxy: str = Form(None),
    auto_proxy: bool = Form(False),
):
    # Require authentication for download endpoint
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    """
    Accepts a download job, validates input, and starts it in the background.
    """
    task_id = str(uuid.uuid4())
    params = await request.form()

    # Store all initial parameters for potential retry
    update_task_status(task_id, {
        "id": task_id,
        "status": "queued",
        "original_params": dict(params)
    })

    # Increment active tasks counter
    async with task_lock:
        global active_tasks
        active_tasks += 1

    # Simple validation
    if not url or not upload_service:
        raise HTTPException(status_code=400, detail="URL and Upload Service are required.")
    if upload_service != "gofile" and not upload_path:
        raise HTTPException(status_code=400, detail="Upload Path is required for this service.")

    # Run the job in the background
    asyncio.create_task(process_download_job(
        task_id=task_id,
        url=url,
        downloader=downloader,
        service=upload_service,
        upload_path=upload_path,
        params=params
    ))
    
    return RedirectResponse("/tasks", status_code=303)


@app.get("/tasks", response_class=HTMLResponse)
async def get_tasks(request: Request):
    lang = get_lang(request)
    user = request.session.get("user")
    # Always require authentication regardless of PRIVATE_MODE
    # This ensures that even with wrong login records, users cannot access hidden info
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    tasks = []
    # Sort by modification time, newest first
    for status_file in sorted(STATUS_DIR.glob("*.json"), key=os.path.getmtime, reverse=True):
        task_id = status_file.stem
        try:
            with open(status_file, "r") as f:
                task_data = json.load(f)
                task_data["id"] = task_id
                tasks.append(task_data)
        except (json.JSONDecodeError, IOError):
            tasks.append({"id": task_id, "status": "unknown", "url": "N/A"})

    return templates.TemplateResponse("tasks.html", {"request": request, "lang": lang, "tasks": tasks})

@app.post("/retry/{task_id}")
async def retry_task(task_id: str, request: Request):
    """Retries a failed task by starting a new job with the original parameters."""
    # Require authentication for retry endpoint
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    status_path = get_task_status_path(task_id)
    if not status_path.exists():
        raise HTTPException(status_code=404, detail="Task to retry not found.")

    with open(status_path, "r") as f:
        try:
            task_data = json.load(f)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Could not read original task data.")
            
    original_params = task_data.get("original_params")
    if not original_params:
        raise HTTPException(status_code=400, detail="Cannot retry task: original parameters not found.")

    # Create a new task ID for the retry
    new_task_id = str(uuid.uuid4())

    # Update status for the new task
    update_task_status(new_task_id, {
        "id": new_task_id,
        "status": "queued",
        "original_params": original_params,
        "retry_of": task_id
    })

    # Increment active tasks counter
    async with task_lock:
        global active_tasks
        active_tasks += 1

    # Start the job with the original parameters
    asyncio.create_task(process_download_job(
        task_id=new_task_id,
        url=original_params.get("url"),
        downloader=original_params.get("downloader"),
        service=original_params.get("upload_service"),
        upload_path=original_params.get("upload_path"),
        params=original_params
    ))

    return RedirectResponse("/tasks", status_code=303)


@app.post("/pause/{task_id}")
async def pause_task(task_id: str, request: Request):
    """Pauses a running task by sending SIGSTOP."""
    # Require authentication for pause endpoint
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    status_path = get_task_status_path(task_id)
    if not status_path.exists():
        raise HTTPException(status_code=404, detail="Task not found.")

    with open(status_path, "r") as f:
        task_data = json.load(f)

    pgid = task_data.get("pgid")
    if not pgid:
        raise HTTPException(status_code=400, detail="Task is not running or cannot be paused.")

    try:
        os.killpg(pgid, signal.SIGSTOP)
        previous_status = task_data.get("status", "running")
        update_task_status(task_id, {"status": "paused", "previous_status": previous_status})
    except ProcessLookupError:
        update_task_status(task_id, {"pgid": None}) # Clean up pgid
        raise HTTPException(status_code=404, detail="Process not found. It may have already finished.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause task: {e}")

    return RedirectResponse("/tasks", status_code=303)


@app.post("/resume/{task_id}")
async def resume_task(task_id: str, request: Request):
    """Resumes a paused task by sending SIGCONT."""
    # Require authentication for resume endpoint
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    status_path = get_task_status_path(task_id)
    if not status_path.exists():
        raise HTTPException(status_code=404, detail="Task not found.")

    with open(status_path, "r") as f:
        task_data = json.load(f)

    pgid = task_data.get("pgid")
    if not pgid:
        raise HTTPException(status_code=400, detail="Task is not paused or cannot be resumed.")

    try:
        os.killpg(pgid, signal.SIGCONT)
        previous_status = task_data.get("previous_status", "running")
        update_task_status(task_id, {"status": previous_status, "previous_status": None})
    except ProcessLookupError:
        update_task_status(task_id, {"pgid": None})
        raise HTTPException(status_code=404, detail="Process not found. It may have already finished.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume task: {e}")

    return RedirectResponse("/tasks", status_code=303)


@app.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str):
    # Require authentication for status endpoint
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    lang = get_lang(request)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
    
    with open(status_file, "r") as f:
        content = f.read()
        
    return templates.TemplateResponse(
        "status.html", 
        {"request": request, "task_id": task_id, "log_content": content, "lang": lang}
    )

@app.get("/status/{task_id}/raw")
async def get_status_raw(request: Request, task_id: str):
    """Returns the raw log file content."""
    # Require authentication for raw status endpoint
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    
    with open(status_file, "r") as f:
        content = f.read()
    return Response(content=content, media_type="text/plain")
