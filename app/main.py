import os
import uuid
import asyncio
import json
import signal
import threading
import uvicorn
import logging
import time
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
from passlib.context import CryptContext
from .database import init_db, MySQLUser, mysql_config
from .logging_handler import MySQLLogHandler, cleanup_old_logs

from . import updater, status
from .config import BASE_DIR, STATUS_DIR, LANGUAGES, PRIVATE_MODE, APP_USERNAME, APP_PASSWORD, AVATAR_URL
from .utils import get_task_status_path, update_task_status
from .tasks import process_download_job

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

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
    mysql_handler.setLevel(logging.INFO)
    logging.getLogger().addHandler(mysql_handler)
    logging.getLogger().info("MySQL logging configured.")
    cleanup_task = asyncio.create_task(periodic_log_cleanup())
    yield
    cleanup_task.cancel()

async def periodic_log_cleanup():
    while True:
        await asyncio.sleep(3600)
        cleanup_old_logs()

# --- Dependencies ---
async def check_setup_needed_camouflage(request: Request):
    user_count = MySQLUser.count_users()
    if user_count == 0 and request.url.path not in ["/setup", "/static", "/"]:
        # For camouflage app, we redirect to its own setup page
        base_url = request.base_url
        redirect_url = str(base_url.replace(path="/setup"))
        raise HTTPException(status_code=307, detail="Setup required", headers={"Location": redirect_url})

async def check_setup_needed_main(request: Request):
    user_count = MySQLUser.count_users()
    if user_count == 0:
        # The main app should be inaccessible and show a service unavailable page
        # as setup must be done via the camouflage app.
        lang = get_lang(request)
        return templates.TemplateResponse("service_unavailable.html", {"request": request, "lang": lang}, status_code=503)

async def get_current_user(request: Request):
    username = request.session.get("user")
    if username:
        user = MySQLUser.get_user_by_username(username)
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
session_cookie_settings = {
    "session_cookie": session_cookie_name,
    "same_site": "lax",
    "https_only": False,  # Allow HTTP for local development
    "max_age": 86400,  # 24 hours
}

camouflage_app.add_middleware(SessionMiddleware, secret_key=shared_secret_key, **session_cookie_settings)
main_app.add_middleware(SessionMiddleware, secret_key=shared_secret_key, **session_cookie_settings)

templates = Jinja2Templates(directory=str(template_dir))

# --- Camouflage App (Public Facing) ---

@camouflage_app.get("/setup", response_class=HTMLResponse)
async def get_setup_form(request: Request):
    if MySQLUser.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("setup.html", {"request": request, "error": None})

@camouflage_app.post("/setup", response_class=HTMLResponse)
async def post_setup_form(request: Request, username: str = Form(...), password: str = Form(...), confirm_password: str = Form(...)):
    if MySQLUser.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    if password != confirm_password:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Passwords do not match."})
    if not username or not password:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Username and password cannot be empty."})
    
    hashed_password = get_password_hash(password)
    if MySQLUser.create_user(username=username, hashed_password=hashed_password, is_admin=True):
        request.session["user"] = username
        # Redirect to the main app's downloader page
        return Response(content="Setup complete. Please access the main application on port 6275.", media_type="text/plain")
    else:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Failed to create user."})

@camouflage_app.get("/login", response_class=HTMLResponse)
async def get_login_form(request: Request):
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang})

@camouflage_app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = MySQLUser.get_user_by_username(username)
    if not user or not verify_password(password, user.hashed_password):
        return RedirectResponse(url="/login", status_code=303)
    
    request.session["user"] = username
    # Instead of redirecting, show a success message. User must go to the main app manually.
    response = Response(content="Login successful. Please access the main application on port 6275.", media_type="text/plain")
    # Ensure session is saved
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
async def update_app(background_tasks: BackgroundTasks, user: MySQLUser = Depends(get_current_user)):
    result = updater.run_update()
    if result.get("status") == "success":
        background_tasks.add_task(updater.restart_application)
    return JSONResponse(content=result)

@main_app.get("/version")
async def get_version(user: MySQLUser = Depends(get_current_user)):
    version_file = BASE_DIR.parent / ".version_info"
    version = "N/A"
    if version_file.exists():
        version = version_file.read_text().strip()[:7]
    return {"version": version}

@main_app.get("/changelog")
async def get_changelog(user: MySQLUser = Depends(get_current_user)):
    changelog_file = BASE_DIR.parent / "CHANGELOG.md"
    content = "Changelog not found."
    if changelog_file.exists():
        content = changelog_file.read_text()
    return Response(content=content, media_type="text/plain")

def get_lang(request: Request):
    lang_code = request.cookies.get("lang", "en")
    return LANGUAGES.get(lang_code, LANGUAGES["en"])

@main_app.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request, current_user: MySQLUser = Depends(get_current_user)):
    lang = get_lang(request)
    return templates.TemplateResponse("downloader.html", {"request": request, "lang": lang, "user": current_user.username, "avatar_url": AVATAR_URL})

@main_app.get("/login", response_class=HTMLResponse)
async def get_login_form_main(request: Request):
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang})

@main_app.post("/login")
async def login_main(request: Request, username: str = Form(...), password: str = Form(...)):
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"登录尝试: username={username}")
    
    user = MySQLUser.get_user_by_username(username)
    logger.info(f"用户查询结果: {user}")
    
    if not user:
        logger.warning(f"用户不存在: {username}")
        return RedirectResponse(url="/login", status_code=303)
    
    password_ok = verify_password(password, user.hashed_password)
    logger.info(f"密码验证结果: {password_ok}")
    
    if not password_ok:
        logger.warning(f"密码错误: {username}")
        return RedirectResponse(url="/login", status_code=303)
    
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
async def set_language(lang_code: str, response: Response, user: MySQLUser = Depends(get_current_user)):
    response.set_cookie(key="lang", value=lang_code, httponly=True, expires=31536000)
    return RedirectResponse(url="/downloader", status_code=302)

@main_app.get("/change_password")
async def change_password_page(request: Request, user: MySQLUser = Depends(get_current_user)):
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
    user: MySQLUser = Depends(get_current_user)
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
    if MySQLUser.update_password(user.username, new_hashed_password):
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
    current_user: MySQLUser = Depends(get_current_user)
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
async def get_tasks(request: Request, current_user: MySQLUser = Depends(get_current_user)):
    lang = get_lang(request)
    # The original function was incomplete, fleshing out to render template
    tasks_list = status.get_all_tasks()
    return templates.TemplateResponse("tasks.html", {"request": request, "tasks": tasks_list, "lang": lang, "user": current_user.username})

@main_app.post("/retry/{task_id}")
async def retry_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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
async def pause_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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
async def resume_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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
async def delete_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    if not status_path.exists() and not log_path.exists():
        raise HTTPException(status_code=404, detail="Task not found.")
    if status_path.exists(): status_path.unlink()
    if log_path.exists(): log_path.unlink()
    return RedirectResponse("/tasks", status_code=303)

@main_app.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    lang = get_lang(request)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
    with open(status_file, "r") as f: content = f.read()
    return templates.TemplateResponse("status.html", {"request": request, "task_id": task_id, "log_content": content, "lang": lang, "user": current_user.username})

@main_app.get("/status/{task_id}/json")
async def get_status_json(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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
async def get_status_raw(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    # ... (rest of the function remains the same, just attached to main_app)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    with open(status_file, "r") as f: content = f.read()
    return Response(content=content, media_type="text/plain")

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

if __name__ == "__main__" or __name__ == "app.main":
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    logger.info("Starting services...")

    camouflage_thread = threading.Thread(target=run_camouflage_app, daemon=True)
    main_thread = threading.Thread(target=run_main_app, daemon=True)

    camouflage_thread.start()
    logger.info("Camouflage service started on http://0.0.0.0:5492")
    
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
