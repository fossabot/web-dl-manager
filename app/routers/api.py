import os
import re
import uuid
import json
import signal
import asyncio
import subprocess
import httpx
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Request, Depends, Form, HTTPException, BackgroundTasks, Response
from fastapi.responses import JSONResponse, RedirectResponse

from .. import updater, status
from ..auth import get_current_user
from ..database import User
from ..config import BASE_DIR, STATUS_DIR, PROJECT_ROOT
from ..tasks import process_download_job
from ..utils import get_task_status_path, update_task_status


router = APIRouter(
    dependencies=[Depends(get_current_user)],
    tags=["api"],
)

# --- App Management ---
@router.post("/update")
async def update_app(background_tasks: BackgroundTasks):
    result = updater.run_update()
    if result.get("status") == "success" and result.get("updated"):
        background_tasks.add_task(updater.restart_application)
    return JSONResponse(content=result)

@router.get("/version")
async def get_version():
    sha = updater.get_local_commit_sha()
    version = sha[:7] if sha else "N/A"
    return {"version": version}

@router.get("/changelog")
async def get_changelog():
    # Try fetching from GitHub first
    # Using the standard raw URL format for the main branch
    remote_url = "https://raw.githubusercontent.com/Jyf0214/web-dl-manager/main/CHANGELOG.md"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(remote_url)
            if response.status_code == 200:
                return Response(content=response.text, media_type="text/plain")
    except Exception:
        # If remote fetch fails, silently fall back to local file
        pass

    # Fallback to local file
    changelog_file = PROJECT_ROOT / "CHANGELOG.md"
    content = "Changelog not found."
    if changelog_file.exists():
        try:
            content = changelog_file.read_text(encoding="utf-8")
        except Exception as e:
            content = f"Error reading changelog: {str(e)}"
    return Response(content=content, media_type="text/plain")

@router.get("/updates/check")
async def check_updates():
    result = updater.check_for_updates()
    return JSONResponse(content=result)

@router.get("/updates/info")
async def get_update_info():
    result = updater.get_update_info()
    return JSONResponse(content=result)

@router.post("/updates/dependencies")
async def update_dependencies_api():
    result = updater.update_dependencies()
    return JSONResponse(content=result)

@router.post("/updates/pages")
async def update_page_library_api():
    result = updater.update_page_library()
    return JSONResponse(content=result)





# --- Downloads & Tasks ---
@router.post("/download", response_class=RedirectResponse)
async def create_download_job(
    request: Request,
    current_user: User = Depends(get_current_user),
    url: str = Form(...),
    downloader: str = Form('gallery-dl'),
    upload_service: str = Form(...),
    upload_path: str = Form(None),
    enable_compression: Optional[str] = Form(None),
    split_compression: bool = Form(False),
    split_size: int = Form(1000)
):
    task_id = str(uuid.uuid4())
    params = await request.form()
    if not url or not upload_service:
        raise HTTPException(status_code=400, detail="URL and Upload Service are required.")
    if upload_service != "gofile" and not upload_path:
        raise HTTPException(status_code=400, detail="Upload Path is required for this service.")

    update_task_status(task_id, {"id": task_id, "status": "queued", "original_params": dict(params), "created_by": current_user.username})
    
    asyncio.create_task(process_download_job(
        task_id=task_id, url=url, downloader=downloader, service=upload_service, upload_path=upload_path,
        params=params, enable_compression=(enable_compression == "true") ,
        split_compression=split_compression, split_size=split_size
    ))
    return RedirectResponse("/tasks", status_code=303)

@router.post("/retry/{task_id}", response_class=RedirectResponse)
async def retry_task(task_id: str, current_user: User = Depends(get_current_user)):
    status_path = get_task_status_path(task_id)
    if not status_path.exists():
        raise HTTPException(status_code=404, detail="Task to retry not found.")
    with open(status_path, "r") as f:
        task_data = json.load(f)
    
    original_params = task_data.get("original_params")
    if not original_params:
        raise HTTPException(status_code=400, detail="Cannot retry task: original parameters not found.")

    new_task_id = str(uuid.uuid4())
    update_task_status(new_task_id, {"id": new_task_id, "status": "queued", "original_params": original_params, "retry_of": task_id, "created_by": current_user.username})
    
    asyncio.create_task(process_download_job(
        task_id=new_task_id, url=original_params.get("url"), downloader=original_params.get("downloader"),
        service=original_params.get("upload_service"), upload_path=original_params.get("upload_path"),
        params=original_params, enable_compression=original_params.get("enable_compression") == "true"
    ))
    return RedirectResponse("/tasks", status_code=303)

@router.post("/pause/{task_id}", response_class=RedirectResponse)
async def pause_task(task_id: str):
    status_path = get_task_status_path(task_id)
    if not status_path.exists(): raise HTTPException(status_code=404, detail="Task not found.")
    with open(status_path, "r") as f: task_data = json.load(f)
    
    pgid = task_data.get("pgid")
    if not pgid: raise HTTPException(status_code=400, detail="Task is not running or cannot be paused.")
    
    try:
        os.killpg(pgid, signal.SIGSTOP)
        update_task_status(task_id, {"status": "paused", "previous_status": task_data.get("status", "running")})
    except ProcessLookupError:
        update_task_status(task_id, {"pgid": None})
        raise HTTPException(status_code=404, detail="Process not found, cannot pause.")
    
    return RedirectResponse("/tasks", status_code=303)

@router.post("/resume/{task_id}", response_class=RedirectResponse)
async def resume_task(task_id: str):
    status_path = get_task_status_path(task_id)
    if not status_path.exists(): raise HTTPException(status_code=404, detail="Task not found.")
    with open(status_path, "r") as f: task_data = json.load(f)

    pgid = task_data.get("pgid")
    if not pgid: raise HTTPException(status_code=400, detail="Task is not paused or cannot be resumed.")

    try:
        os.killpg(pgid, signal.SIGCONT)
        update_task_status(task_id, {"status": task_data.get("previous_status", "running"), "previous_status": None})
    except ProcessLookupError:
        update_task_status(task_id, {"pgid": None})
        raise HTTPException(status_code=404, detail="Process not found, cannot resume.")
        
    return RedirectResponse("/tasks", status_code=303)

@router.post("/delete/{task_id}", response_class=RedirectResponse)
async def delete_task(task_id: str):
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    oauth_log_path = STATUS_DIR / f"oauth_{task_id}.log"

    deleted = False
    if status_path.exists():
        status_path.unlink()
        deleted = True
    if log_path.exists():
        log_path.unlink()
        deleted = True
    if oauth_log_path.exists(): # Also clean up potential oauth logs
        oauth_log_path.unlink()
        deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    return RedirectResponse("/tasks", status_code=303)

# --- Status & Logs ---
@router.get("/status/{task_id}/json")
async def get_status_json(task_id: str):
    status_path = get_task_status_path(task_id)
    log_path = STATUS_DIR / f"{task_id}.log"
    status_data = {}
    if status_path.exists():
        with open(status_path, "r") as f:
            try:
                status_data = json.load(f)
            except json.JSONDecodeError:
                status_data = {"status": "error", "error": "Invalid status file"}
    
    log_content = ""
    if log_path.exists():
        with open(log_path, "r") as f:
            log_content = f.read()
            
    return JSONResponse({"status": status_data, "log": log_content})

@router.get("/status/{task_id}/raw")
async def get_status_raw(task_id: str):
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job log not found.")
    with open(status_file, "r") as f:
        content = f.read()
    return Response(content=content, media_type="text/plain")

@router.post("/cleanup-logs")
async def cleanup_logs_api():
    from ..logging_handler import cleanup_old_logs
    try:
        cleanup_old_logs()
        return JSONResponse(content={"status": "success", "message": "Log cleanup completed."})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# --- Server Info ---
def get_dependency_versions():
    versions = {"python": __import__("sys").version.split(" ")[0], "gallery-dl": "N/A", "rclone": "N/A"}
    try:
        result = subprocess.run(['gallery-dl', '--version'], capture_output=True, text=True)
        if result.returncode == 0: versions['gallery-dl'] = result.stdout.strip().split(" ")[-1]
    except Exception: pass
    try:
        result = subprocess.run(['rclone', 'version'], capture_output=True, text=True)
        if result.returncode == 0: versions['rclone'] = result.stdout.strip().split("\n")[0].split(" ")[-1]
    except Exception: pass
    return versions

def get_system_uptime():
    import psutil
    delta = __import__("datetime").datetime.now() - __import__("datetime").datetime.fromtimestamp(psutil.boot_time())
    days, remainder = divmod(delta.seconds, 3600)
    hours, minutes = divmod(remainder, 60)
    return f"{delta.days}d {days}h {minutes}m"

@router.get("/server-status/json")
async def get_server_status():
    import psutil, platform
    
    disk_path = '/data' if os.path.exists('/data') else '/'
    try:
        disk = psutil.disk_usage(disk_path)
        disk_info = {"total": disk.total, "used": disk.used, "free": disk.free, "percent": disk.percent}
    except FileNotFoundError:
        disk_info = {"total": 0, "used": 0, "free": 0, "percent": 0}

    return JSONResponse(content={
        "system": {"uptime": get_system_uptime(), "platform": f"{platform.system()} {platform.release()}", "cpu_usage": psutil.cpu_percent(interval=1)},
        "memory": {"total": (mem := psutil.virtual_memory()).total, "used": mem.used, "percent": mem.percent},
        "disk": disk_info,
        "application": {"active_tasks": status.get_active_tasks_count(), "versions": get_dependency_versions()}
    })

# --- Session Management ---
@router.get("/logout", response_class=Response)
async def logout(request: Request):
    request.session.clear()
    response = Response(content="You have been logged out.", media_type="text/plain")
    response.delete_cookie("session")
    return response

@router.get("/set_language/{lang_code}")
async def set_language(lang_code: str):
    response = RedirectResponse(url="/downloader", status_code=302)
    response.set_cookie(key="lang", value=lang_code, httponly=True, expires=31536000) # 1 year
    return response


# --- Log Viewing ---
LOG_ACCESS_KEY = "web-dl-manager-debug-key-2024"  # 默认访问密钥
LOG_FILES = [
    "logs/camouflage.log",
    "logs/main.log",
    "logs/log_endpoint.log",
    "logs/app.log",
    "logs/debug_startup.log",
    "logs/debug_startup2.log",
    "logs/debug_startup3.log",
    "logs/combined_start.log",
    "logs/startup.log",
    "logs/startup2.log",
]

def get_log_content(log_file: str) -> str:
    """读取日志文件内容"""
    try:
        # 使用项目根目录路径
        project_root = Path(__file__).resolve().parent.parent.parent
        log_path = project_root / log_file
        if log_path.exists():
            return log_path.read_text(encoding='utf-8', errors='ignore')
        else:
            return f"Log file not found: {log_file}"
    except Exception as e:
        return f"Error reading log file {log_file}: {str(e)}"

def get_all_logs() -> str:
    """获取所有日志文件的内容"""
    result = []
    for log_file in LOG_FILES:
        content = get_log_content(log_file)
        result.append(f"=== {log_file} ===")
        result.append(content)
        result.append("\n")
    return "\n".join(result)

@router.get("/logs/health")
async def log_health_check():
    """日志健康检查端点"""
    return {"status": "healthy", "service": "log_viewer"}

@router.get("/logs/info")
async def log_info():
    """日志端点信息"""
    return {
        "service": "Web-DL-Manager Log Viewer",
        "available_logs": LOG_FILES,
        "endpoints": {
            "/api/logs/health": "Health check",
            "/api/logs/info": "This info",
            "/api/logs/all": "Get all logs (requires X-Log-Access-Key header)",
            "/api/logs/{filename}": "Get specific log file (requires X-Log-Access-Key header)"
        }
    }

@router.get("/logs/all")
async def get_all_logs_api(request: Request, access_key: str = None):
    """获取所有日志内容，需要认证"""
    # 优先从URL参数获取密钥，如果没有则从请求头获取
    if access_key is None:
        access_key = request.headers.get("X-Log-Access-Key")
    
    if access_key != LOG_ACCESS_KEY:
        raise HTTPException(status_code=403, detail="Invalid access key")
    
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content=get_all_logs())

@router.get("/logs/{filename}")
async def get_log_file_api(filename: str, request: Request, access_key: str = None):
    """获取特定日志文件内容，需要认证"""
    # 优先从URL参数获取密钥，如果没有则从请求头获取
    if access_key is None:
        access_key = request.headers.get("X-Log-Access-Key")
    
    if access_key != LOG_ACCESS_KEY:
        raise HTTPException(status_code=403, detail="Invalid access key")
    
    # 安全验证：只允许访问预定义的日志文件
    if filename not in LOG_FILES:
        raise HTTPException(status_code=404, detail="Log file not found")
    
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content=get_log_content(filename))
