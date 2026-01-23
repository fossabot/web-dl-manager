import sys
from pathlib import Path

# Add project root to sys.path to allow running as a script
# and make relative imports work.
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import os
import asyncio
import logging
import secrets
import threading
import uvicorn
import time
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from .database import init_db, User, db_config
from . import redis_client  # Initialize Redis client
from .logging_handler import MySQLLogHandler, cleanup_old_logs, update_log_handlers
from .utils import restore_gallery_dl_config, backup_gallery_dl_config
from .config import BASE_DIR, APP_USERNAME, APP_PASSWORD, PROJECT_ROOT
from .auth import get_password_hash
from .templating import templates
from .i18n import get_lang
from .tasks import unified_periodic_sync

# Import routers
from .routers import camouflage, main_ui, api, terminal

# --- App Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    init_db()
    
    # Restore gallery-dl config from rclone remote on startup
    await restore_gallery_dl_config()
    
    # Create changelog if it doesn't exist
    changelog_file = PROJECT_ROOT / "CHANGELOG.md"
    if not changelog_file.exists():
        changelog_file.write_text("# Changelog\n\nNo changelog information available yet.", encoding="utf-8")
        
    # Configure logging
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    is_hf_space = os.getenv("SPACE_ID") is not None
    if is_hf_space:
        log_level = logging.CRITICAL
    else:
        log_level = logging.DEBUG if debug_enabled else logging.INFO
    logging.getLogger().setLevel(log_level)
    
    # Ensure logs directory exists
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # Add file handler for startup logs, regardless of DEBUG_MODE
    file_handler = logging.FileHandler(logs_dir / "app.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    logging.getLogger().addHandler(file_handler)
    logging.info("File logging configured for startup logs.")
    
    # Configure Redis logging if available
    update_log_handlers()

    # Auto-create admin user from environment variables if no users exist
    if APP_USERNAME and APP_PASSWORD and User.count_users() == 0:
        logging.info(f"Creating admin user '{APP_USERNAME}' from environment variables.")
        hashed_password = get_password_hash(APP_PASSWORD)
        if User.create_user(username=APP_USERNAME, hashed_password=hashed_password, is_admin=True):
            logging.info(f"Admin user '{APP_USERNAME}' created successfully.")
        else:
            logging.error(f"Failed to create admin user '{APP_USERNAME}'.")
    
    # Start periodic background tasks
    cleanup_task = asyncio.create_task(periodic_log_cleanup())
    sync_task = asyncio.create_task(unified_periodic_sync())
    
    yield
    
    # Shutdown logic
    logging.info("Shutting down: performing final gallery-dl config backup...")
    await backup_gallery_dl_config()
    
    cleanup_task.cancel()
    sync_task.cancel()

async def periodic_log_cleanup():
    while True:
        await asyncio.sleep(3600)  # Run every hour
        cleanup_old_logs()

# --- Dependencies for Setup Checks ---
async def check_setup_needed_camouflage(request: Request):
    if User.count_users() == 0 and request.url.path not in ["/setup", "/static", "/", "/docs", "/openapi.json"]:
        redirect_url = str(request.base_url.replace(path="/setup"))
        raise HTTPException(status_code=307, detail="Setup required", headers={"Location": redirect_url})

async def check_setup_needed_main(request: Request):
    if User.count_users() == 0:
        return templates.TemplateResponse("service_unavailable.html", {"request": request, "lang": get_lang(request)}, status_code=503)

# --- App Definitions ---
camouflage_app = FastAPI(
    title="Web-DL-Manager - Camouflage", 
)
main_app = FastAPI(
    title="Web-DL-Manager - Main", 
    lifespan=lifespan
)

# Enable CORS for the main API app
main_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static Files Mounting ---
main_app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
camouflage_app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
static_site_dir = Path("/app/static_site")
if static_site_dir.is_dir():
    camouflage_app.mount("/", StaticFiles(directory=static_site_dir, html=True), name="static_site")

# --- Session Middleware ---
# Generate a random secret key on startup to ensure sessions are invalidated on server restart
session_secret_key = secrets.token_hex(32)
# max_age=None ensures the cookie is a "session cookie" that expires when the browser is closed
camouflage_app.add_middleware(SessionMiddleware, secret_key=session_secret_key, max_age=None)
main_app.add_middleware(SessionMiddleware, secret_key=session_secret_key, max_age=None)

# --- Router Inclusion ---
camouflage_app.include_router(camouflage.router, dependencies=[Depends(check_setup_needed_camouflage)])
main_app.include_router(main_ui.router)
main_app.include_router(terminal.router)
main_app.include_router(api.router, prefix="/api")


# --- Main Execution Block ---
def run_camouflage_app():
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    is_hf_space = os.getenv("SPACE_ID") is not None
    
    # 确保logs目录存在
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # 创建日志配置，始终写入文件，控制台日志级别根据DEBUG_MODE变化
    log_config = {
        "version": 1,
        "disable_existing_loggers": is_hf_space,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            },
        },
        "handlers": {
            "file": {
                "class": "logging.FileHandler",
                "formatter": "default",
                "level": "DEBUG",
                "filename": str(logs_dir / "camouflage.log"),
                "mode": "a",
                "encoding": "utf-8",
            }
        },
        "root": {
            "level": "DEBUG",
            "handlers": ["file"]
        }
    }
    
    # 仅在DEBUG模式下添加控制台日志
    if debug_enabled and not is_hf_space:
        log_config["handlers"]["console"] = {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "level": "DEBUG",
            "stream": "ext://sys.stdout",
        }
        log_config["root"]["handlers"].append("console")
    
    log_level = "critical" if is_hf_space else "debug"
    uvicorn.run(camouflage_app, host="0.0.0.0", port=5492, log_config=log_config, log_level=log_level)

def run_main_app():
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    is_hf_space = os.getenv("SPACE_ID") is not None
    
    # 确保logs目录存在
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # 创建日志配置，始终写入文件，控制台日志仅在DEBUG模式下启用
    log_config = {
        "version": 1,
        "disable_existing_loggers": is_hf_space,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            },
        },
        "handlers": {
            "file": {
                "class": "logging.FileHandler",
                "formatter": "default",
                "level": "DEBUG",
                "filename": str(logs_dir / "main.log"),
                "mode": "a",
                "encoding": "utf-8",
            }
        },
        "root": {
            "level": "DEBUG",
            "handlers": ["file"]
        }
    }
    
    # 仅在DEBUG模式下添加控制台日志
    if debug_enabled and not is_hf_space:
        log_config["handlers"]["console"] = {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "level": "DEBUG",
            "stream": "ext://sys.stdout",
        }
        log_config["root"]["handlers"].append("console")
    
    uvicorn.run(main_app, host="127.0.0.1", port=6275, log_config=log_config, log_level="critical" if is_hf_space else "debug")

def start_tunnel_if_env():
    if tunnel_token := os.getenv("TUNNEL_TOKEN"):
        try:
            subprocess.Popen(
                ['cloudflared', 'tunnel', '--no-autoupdate', 'run', '--token', tunnel_token],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
        except Exception:
            pass

def start_log_endpoint():
    """启动独立的日志端点进程，运行在8901端口，用于查看调试日志"""
    try:
        if getattr(sys, 'frozen', False):
            # If frozen, run the same executable with a flag
            process = subprocess.Popen(
                [sys.executable, "--log-endpoint"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
        else:
            # Development mode: run as module
            process = subprocess.Popen(
                [sys.executable, "-m", "app.log_endpoint"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(Path(__file__).resolve().parent.parent)
            )

        print(f"Log endpoint started on http://0.0.0.0:8901")
        print("Access logs with header: X-Log-Access-Key: web-dl-manager-debug-key-2024")
        return process

    except Exception as e:
        print(f"Failed to start log endpoint: {e}")
        return None

def main():
    from multiprocessing import freeze_support
    freeze_support()
    
    # Check for log endpoint flag
    if "--log-endpoint" in sys.argv:
        from .log_endpoint import run_log_endpoint
        run_log_endpoint()
        sys.exit(0)

    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    is_hf_space = os.getenv("SPACE_ID") is not None

    if debug_enabled and not is_hf_space:
        print("--- RUNNING IN FOREGROUND DEBUG MODE ---")
        # Run both apps even in debug mode to test API endpoints
        init_db()
        
        if tunnel_token := db_config.get_config("TUNNEL_TOKEN"):
            os.environ.setdefault("TUNNEL_TOKEN", tunnel_token)
        
        start_tunnel_if_env()
        
        print("Starting services...")

        camouflage_thread = threading.Thread(target=run_camouflage_app, daemon=True)
        main_thread = threading.Thread(target=run_main_app, daemon=True)

        camouflage_thread.start()
        main_thread.start()

        print("Page service started on http://0.0.0.0:5492")
        print("Main API service started on http://127.0.0.1:6275")

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down services...")
            sys.exit(0)
    else:
        init_db()
    
        if tunnel_token := db_config.get_config("TUNNEL_TOKEN"):
            os.environ.setdefault("TUNNEL_TOKEN", tunnel_token)
    
        start_tunnel_if_env()
        
        if not is_hf_space:
            print("Starting services...")

        camouflage_thread = threading.Thread(target=run_camouflage_app, daemon=True)
        main_thread = threading.Thread(target=run_main_app, daemon=True)

        camouflage_thread.start()
        main_thread.start()

        if is_hf_space:
            sys.stdout.write("Application running on port 5492\n")
            sys.stdout.flush()
        else:
            print("Page service started on http://0.0.0.0:5492")

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            if not is_hf_space:
                print("\nShutting down services...")
            sys.exit(0)

if __name__ == "__main__":
    main()