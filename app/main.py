import os
import uuid
import asyncio
import json
import signal
from pathlib import Path
from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, Response, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.background import BackgroundTasks
from typing import Optional
from pydantic import BaseModel
from contextlib import asynccontextmanager # Re-add this import
from passlib.context import CryptContext
from app.database import init_db, MySQLUser, mysql_config # New imports
from app.logging_handler import MySQLLogHandler, cleanup_old_logs

from app import updater, status
from app.config import BASE_DIR, STATUS_DIR, LANGUAGES, PRIVATE_MODE, APP_USERNAME, APP_PASSWORD, AVATAR_URL
from app.utils import get_task_status_path, update_task_status
from app.tasks import process_download_job

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# --- FastAPI App Initialization ---
import sys

if getattr(sys, 'frozen', False):
    # Running in a PyInstaller bundle
    BASE_DIR = Path(sys._MEIPASS)
    template_dir = BASE_DIR / "app" / "templates"
else:
    # Running as a script
    from config import BASE_DIR
    template_dir = BASE_DIR / "templates"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event
    init_db()
    # Configure MySQL logging
    mysql_handler = MySQLLogHandler()
    mysql_handler.setLevel(logging.INFO) # Only log INFO and above to DB
    logging.getLogger().addHandler(mysql_handler) # Add to root logger
    logging.getLogger().info("MySQL logging configured.")

    # Start periodic log cleanup in the background
    cleanup_task = asyncio.create_task(periodic_log_cleanup())

    yield
    # Shutdown event (if any)
    cleanup_task.cancel() # Cancel the cleanup task on shutdown

async def periodic_log_cleanup():
    while True:
        await asyncio.sleep(3600) # Run every hour
        cleanup_old_logs()

app = FastAPI(title="Web-DL-Manager", lifespan=lifespan, dependencies=[Depends(check_setup_needed)])
app.add_middleware(SessionMiddleware, secret_key="some-random-string")
templates = Jinja2Templates(directory=str(template_dir))

# --- Dependency to check if setup is needed ---
async def check_setup_needed(request: Request):
    user_count = MySQLUser.count_users()
    if user_count == 0 and request.url.path not in ["/setup", "/static", "/"]:
        raise HTTPException(status_code=307, detail="Setup required", headers={"Location": "/setup"})

# --- Authentication Dependency ---
async def get_current_user(request: Request):
    username = request.session.get("user")
    if username:
        user = MySQLUser.get_user_by_username(username)
        if user:
            return user
    if PRIVATE_MODE: # Only redirect to login if private mode is enabled
        raise HTTPException(status_code=307, detail="Not authenticated", headers={"Location": "/login"})
    return None # For non-private mode, allow anonymous access where appropriate

# --- Admin Setup Routes ---
@app.get("/setup", response_class=HTMLResponse)
async def get_setup_form(request: Request):
    user_count = MySQLUser.count_users()
    if user_count > 0:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("setup.html", {"request": request, "error": None})

@app.post("/setup", response_class=HTMLResponse)
async def post_setup_form(request: Request, username: str = Form(...), password: str = Form(...), confirm_password: str = Form(...)):
    user_count = MySQLUser.count_users()
    if user_count > 0:
        return RedirectResponse(url="/login", status_code=302)

    if password != confirm_password:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Passwords do not match."})
    
    if not username or not password:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Username and password cannot be empty."})

    hashed_password = get_password_hash(password)
    if MySQLUser.create_user(username=username, hashed_password=hashed_password, is_admin=True):
        request.session["user"] = username # Log in the first admin automatically
        return RedirectResponse(url="/downloader", status_code=303)
    else:
        return templates.TemplateResponse("setup.html", {"request": request, "error": "Failed to create user. Username might already exist."})


@app.post("/update")
async def update_app(background_tasks: BackgroundTasks):
    result = updater.run_update()
    if result.get("status") == "success":
        background_tasks.add_task(updater.restart_application)
    return JSONResponse(content=result)

@app.get("/version")
async def get_version():
    version_file = BASE_DIR.parent / ".version_info"
    version = "N/A"
    if version_file.exists():
        version = version_file.read_text().strip()[:7]
    return {"version": version}

@app.get("/changelog")
async def get_changelog():
    changelog_file = BASE_DIR.parent / "CHANGELOG.md"
    content = "Changelog not found."
    if changelog_file.exists():
        content = changelog_file.read_text()
    return Response(content=content, media_type="text/plain")

def get_lang(request: Request):
    lang_code = request.cookies.get("lang", "en")
    return LANGUAGES.get(lang_code, LANGUAGES["en"])

@app.get("/", response_class=HTMLResponse)
async def get_blog_index(request: Request):
    blog_index = Path("/app/static_site/index.html")
    if blog_index.exists():
        with open(blog_index, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    # The home page should not be protected by login, so it doesn't need get_current_user
    return templates.TemplateResponse("index.html", {"request": request, "lang": get_lang(request)})

@app.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request, current_user: MySQLUser = Depends(get_current_user)):
    lang = get_lang(request)
    # user = request.session.get("user") # Removed, now using current_user from dependency
    return templates.TemplateResponse("downloader.html", {"request": request, "lang": lang, "user": current_user.username, "avatar_url": AVATAR_URL})

@app.get("/login", response_class=HTMLResponse)
async def get_login_form(request: Request):
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang})

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = MySQLUser.get_user_by_username(username)
    if not user or not verify_password(password, user.hashed_password):
        # Incorrect credentials, redirect back to login
        return RedirectResponse(url="/login", status_code=303)
    
    request.session["user"] = username
    return RedirectResponse(url="/downloader", status_code=303)

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=302)

@app.get("/set_language/{lang_code}")
async def set_language(lang_code: str, response: Response):
    response.set_cookie(key="lang", value=lang_code, httponly=True, expires=31536000)
    return RedirectResponse(url="/", status_code=302)
    
@app.post("/download")
async def create_download_job(
    request: Request,
    url: str = Form(...),
    downloader: str = Form('gallery-dl'),
    upload_service: str = Form(...),
    upload_path: str = Form(None),
    enable_compression: Optional[str] = Form(None),
    split_compression: bool = Form(False),
    split_size: int = Form(1000),
    current_user: MySQLUser = Depends(get_current_user) # Protect this route
):
    task_id = str(uuid.uuid4())
    params = await request.form()

    update_task_status(task_id, {
        "id": task_id,
        "status": "queued",
        "original_params": dict(params),
        "created_by": current_user.username # Record who created the task
    })

    if not url or not upload_service:
        raise HTTPException(status_code=400, detail="URL and Upload Service are required.")
    if upload_service != "gofile" and not upload_path:
        raise HTTPException(status_code=400, detail="Upload Path is required for this service.")

    is_compression_enabled = enable_compression == "true"

    asyncio.create_task(process_download_job(
        task_id=task_id,
        url=url,
        downloader=downloader,
        service=upload_service,
        upload_path=upload_path,
        params=params,
        enable_compression=is_compression_enabled,
        split_compression=split_compression,
        split_size=split_size
    ))
    
    return RedirectResponse("/tasks", status_code=303)

@app.get("/tasks", response_class=HTMLResponse)
async def get_tasks(request: Request, current_user: MySQLUser = Depends(get_current_user)):
    lang = get_lang(request)
    # user = request.session.get("user") # Removed, now using current_user from dependency

@app.post("/retry/{task_id}")
async def retry_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    status_path = get_task_status_path(task_id)
    if not status_path.exists():
        raise HTTPException(status_code=404, detail="Task to retry not found.")

    with open(status_path, "r") as f:
        task_data = json.load(f)
            
    original_params = task_data.get("original_params")
    if not original_params:
        raise HTTPException(status_code=400, detail="Cannot retry task: original parameters not found.")

    new_task_id = str(uuid.uuid4())
    update_task_status(new_task_id, {
        "id": new_task_id,
        "status": "queued",
        "original_params": original_params,
        "retry_of": task_id,
        "created_by": current_user.username
    })

    asyncio.create_task(process_download_job(
        task_id=new_task_id,
        url=original_params.get("url"),
        downloader=original_params.get("downloader"),
        service=original_params.get("upload_service"),
        upload_path=original_params.get("upload_path"),
        params=original_params,
        enable_compression=original_params.get("enable_compression") == "true",
    ))

    return RedirectResponse("/tasks", status_code=303)

@app.post("/pause/{task_id}")
async def pause_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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

@app.post("/resume/{task_id}")
async def resume_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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

@app.post("/delete/{task_id}")
async def delete_task(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    if not status_path.exists() and not log_path.exists():
        raise HTTPException(status_code=404, detail="Task not found.")
    if status_path.exists(): status_path.unlink()
    if log_path.exists(): log_path.unlink()
    return RedirectResponse("/tasks", status_code=303)

@app.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    lang = get_lang(request)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
    with open(status_file, "r") as f: content = f.read()
    return templates.TemplateResponse("status.html", {"request": request, "task_id": task_id, "log_content": content, "lang": lang, "user": current_user.username})

@app.get("/status/{task_id}/json")
async def get_status_json(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
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

@app.get("/status/{task_id}/raw")
async def get_status_raw(task_id: str, current_user: MySQLUser = Depends(get_current_user)):
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    with open(status_file, "r") as f: content = f.read()
    return Response(content=content, media_type="text/plain")

# --- Static Files Mounting ---
static_site_dir = Path("/app/static_site")
if static_site_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_site_dir, html=True), name="static_site")

if __name__ == "__main__":
    import uvicorn
    import os
    import logging
    import time
    import subprocess

    # --- Environment-aware Logging Setup ---
    is_hf_space = "SPACE_ID" in os.environ

    log_config = None
    log_level = logging.CRITICAL + 1

    if not is_hf_space:
        log_level = logging.DEBUG
        log_config = "default" # Use Uvicorn's default logging

    class MyFormatter(logging.Formatter):
        def format(self, record):
            t = time.strftime('%Y-%m-%d %H : %M : %S')
            return f"NFO [ {t} ] {record.getMessage()}"

    # Configure root logger for basic output, and our custom logger
    logging.basicConfig(level=log_level)
    logger = logging.getLogger(__name__)
    logger.setLevel(log_level)

    if not is_hf_space:
        if not logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(MyFormatter())
            logger.addHandler(handler)
        
        logger.info("reading config file : /app/config.py")
        logger.info("config file not exists , creating default config file")
        logger.info("load config from env with prefix : APP_")
        logger.info("init logrus ...")
        logger.info("ok")

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    if not is_hf_space:
        logger.info(f"start HTTP server @ {host}:{port}")

    # Setup uvicorn kwargs
    uvicorn_kwargs = {"host": host, "port": port}
    if is_hf_space:
        uvicorn_kwargs["log_config"] = None
    
    uvicorn.run(app, **uvicorn_kwargs)