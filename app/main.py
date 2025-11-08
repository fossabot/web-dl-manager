import os
import uuid
import asyncio
import json
import signal
from pathlib import Path
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, Response, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.background import BackgroundTasks
from typing import Optional
from pydantic import BaseModel

from . import updater
from .config import BASE_DIR, STATUS_DIR, LANGUAGES, PRIVATE_MODE, APP_USERNAME, APP_PASSWORD, AVATAR_URL
from .utils import get_task_status_path, update_task_status
from .tasks import process_download_job

# --- FastAPI App Initialization ---
app = FastAPI(title="Gallery-DL Web UI")
app.add_middleware(SessionMiddleware, secret_key="some-random-string")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# --- Cloudflared Tunnel Management ---
tunnel_process: Optional[asyncio.subprocess.Process] = None
tunnel_log = ""
tunnel_lock = asyncio.Lock()

class TunnelRequest(BaseModel):
    token: str

def get_lang(request: Request):
    lang_code = request.cookies.get("lang", "en")
    if lang_code not in LANGUAGES:
        lang_code = "en"
    return LANGUAGES[lang_code]

async def read_tunnel_stream(stream, log_prefix):
    global tunnel_log
    while True:
        line = await stream.readline()
        if not line:
            break
        decoded_line = line.decode()
        if "uvicorn.access" not in decoded_line:
            async with tunnel_lock:
                tunnel_log += f"{log_prefix}: {decoded_line}"

async def launch_tunnel(token: str):
    global tunnel_process, tunnel_log
    async with tunnel_lock:
        if tunnel_process and tunnel_process.returncode is None:
            return {"message": "Tunnel is already running."}

        if not token:
            tunnel_log += "Token is empty. Cannot start tunnel.\n"
            return {"message": "Token is empty."}

        tunnel_log = "Starting tunnel...\n"
        command = f"cloudflared tunnel --no-autoupdate run --token {token}"

        try:
            tunnel_process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                preexec_fn=os.setsid
            )
            asyncio.create_task(read_tunnel_stream(tunnel_process.stdout, "STDOUT"))
            asyncio.create_task(read_tunnel_stream(tunnel_process.stderr, "STDERR"))
            tunnel_log += "Tunnel process started.\n"
            return {"message": "Tunnel started successfully."}
        except Exception as e:
            tunnel_log += f"Failed to start tunnel: {e}\n"
            return {"message": f"Failed to start tunnel: {e}"}

# --- API Endpoints ---
@app.on_event("startup")
async def startup_event():
    cloudflared_token = os.getenv("CLOUDFLARED_TOKEN")
    if cloudflared_token:
        await launch_tunnel(cloudflared_token)

@app.post("/tunnel/start")
async def start_tunnel(request: TunnelRequest):
    return await launch_tunnel(request.token)

@app.post("/tunnel/stop")
async def stop_tunnel():
    global tunnel_process, tunnel_log
    async with tunnel_lock:
        if not tunnel_process or tunnel_process.returncode is not None:
            return {"message": "Tunnel is not running."}

        tunnel_log += "Stopping tunnel...\n"
        try:
            os.killpg(os.getpgid(tunnel_process.pid), signal.SIGTERM)
            await tunnel_process.wait()
            tunnel_log += "Tunnel stopped.\n"
            return {"message": "Tunnel stopped successfully."}
        except Exception as e:
            tunnel_log += f"Failed to stop tunnel: {e}\n"
            return {"message": f"Failed to stop tunnel: {e}"}

@app.get("/tunnel/status")
async def tunnel_status():
    global tunnel_process, tunnel_log
    async with tunnel_lock:
        running = tunnel_process and tunnel_process.returncode is None
        return {"running": running, "log": tunnel_log}

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

@app.get("/", response_class=HTMLResponse)
async def get_blog_index(request: Request):
    blog_index = Path("/app/static_site/index.html")
    if blog_index.exists():
        with open(blog_index, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    return templates.TemplateResponse("index.html", {"request": request, "lang": get_lang(request)})

@app.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request):
    lang = get_lang(request)
    user = request.session.get("user")
    if PRIVATE_MODE and not user:
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
):
    task_id = str(uuid.uuid4())
    params = await request.form()

    update_task_status(task_id, {
        "id": task_id,
        "status": "queued",
        "original_params": dict(params)
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
async def get_tasks(request: Request):
    lang = get_lang(request)
    user = request.session.get("user")
    if PRIVATE_MODE and not user:
        return RedirectResponse(url="/login", status_code=302)

    tasks = []
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
async def retry_task(task_id: str):
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
        "retry_of": task_id
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
async def pause_task(task_id: str):
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
async def resume_task(task_id: str):
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
async def delete_task(task_id: str):
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    if not status_path.exists() and not log_path.exists():
        raise HTTPException(status_code=404, detail="Task not found.")
    if status_path.exists(): status_path.unlink()
    if log_path.exists(): log_path.unlink()
    return RedirectResponse("/tasks", status_code=303)

@app.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str):
    lang = get_lang(request)
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
    with open(status_file, "r") as f: content = f.read()
    return templates.TemplateResponse("status.html", {"request": request, "task_id": task_id, "log_content": content, "lang": lang})

@app.get("/status/{task_id}/json")
async def get_status_json(task_id: str):
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
async def get_status_raw(task_id: str):
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    with open(status_file, "r") as f: content = f.read()
    return Response(content=content, media_type="text/plain")

# --- Static Files Mounting ---
static_site_dir = Path("/app/static_site")
if static_site_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_site_dir, html=True), name="static_site")
