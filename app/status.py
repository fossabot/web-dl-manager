import psutil
import subprocess
import platform
import time
import json
import os
from datetime import datetime

from .config import STATUS_DIR

START_TIME = datetime.utcnow()

# In-memory cache for status data
_status_cache = {
    "tasks": None,
    "tasks_time": 0,
    "active_count": None,
    "active_count_time": 0,
    "versions": None,
    "versions_time": 0
}
CACHE_TTL = 30  # 30 seconds for general status
VERSIONS_TTL = 3600  # 1 hour for versions

def clear_status_cache():
    """Clears the status cache."""
    global _status_cache
    _status_cache = {
        "tasks": None,
        "tasks_time": 0,
        "active_count": None,
        "active_count_time": 0,
        "versions": None,
        "versions_time": 0
    }

def get_server_uptime():
    """Returns the system uptime as a formatted string."""
    delta = datetime.now() - datetime.fromtimestamp(psutil.boot_time())
    days, remainder = divmod(delta.seconds, 3600)
    hours, minutes = divmod(remainder, 60)
    return f"{delta.days}d {days}h {minutes}m"

def get_cpu_usage():
    """Returns the current CPU usage percentage."""
    return psutil.cpu_percent(interval=1)

def get_memory_usage():
    """Returns memory usage information."""
    mem = psutil.virtual_memory()
    return {"total": mem.total, "used": mem.used, "percent": mem.percent}

def get_disk_usage():
    """Returns disk usage information for the main data directory or root."""
    disk_path = '/data' if os.path.exists('/data') else '/'
    try:
        disk = psutil.disk_usage(disk_path)
        return {"total": disk.total, "used": disk.used, "free": disk.free, "percent": disk.percent}
    except FileNotFoundError:
        return {"total": 0, "used": 0, "free": 0, "percent": 0}

def get_active_tasks_count():
    """Returns the number of currently active (running or paused) tasks."""
    now = time.time()
    if _status_cache["active_count"] is not None and (now - _status_cache["active_count_time"] < CACHE_TTL):
        return _status_cache["active_count"]

    count = 0
    for status_file in STATUS_DIR.glob("*.json"):
        try:
            with open(status_file, "r") as f:
                task_data = f.read()
                if '"status": "running"' in task_data or '"status": "paused"' in task_data:
                    count += 1
        except (IOError, ValueError):
            continue
    
    _status_cache["active_count"] = count
    _status_cache["active_count_time"] = now
    return count

def get_dependency_versions():
    """Returns a dictionary with versions of key dependencies."""
    now = time.time()
    if _status_cache["versions"] is not None and (now - _status_cache["versions_time"] < VERSIONS_TTL):
        return _status_cache["versions"]

    versions = {
        "python": platform.python_version(),
        "gallery-dl": "Not Found",
        "rclone": "Not Found",
    }
    try:
        # Get gallery-dl version
        result = subprocess.run(["gallery-dl", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            versions["gallery-dl"] = result.stdout.strip().splitlines()[0]
    except Exception:
        pass
        
    try:
        # Get rclone version
        result = subprocess.run(["rclone", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            versions["rclone"] = result.stdout.strip().splitlines()[0]
    except Exception:
        pass
    
    _status_cache["versions"] = versions
    _status_cache["versions_time"] = now
    return versions

def get_all_tasks():
    """Scans the status directory and returns a list of all tasks, sorted by modification time."""
    now = time.time()
    if _status_cache["tasks"] is not None and (now - _status_cache["tasks_time"] < CACHE_TTL):
        return _status_cache["tasks"]

    tasks = []
    status_files = list(STATUS_DIR.glob("*.json"))
    
    # Sort files by modification time (newest first)
    status_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)

    for status_file in status_files:
        try:
            with open(status_file, "r") as f:
                task_data = json.load(f)
                tasks.append(task_data)
        except (IOError, json.JSONDecodeError):
            # In case of read error or malformed JSON, skip the file
            continue
    
    _status_cache["tasks"] = tasks
    _status_cache["tasks_time"] = now
    return tasks

def get_all_status():
    """Aggregates all status information into a single dictionary."""
    return {
        "system": {
            "uptime": get_server_uptime(),
            "cpu_usage": get_cpu_usage(),
            "memory": get_memory_usage(),
            "disk": get_disk_usage(),
            "platform": f"{platform.system()} {platform.release()}"
        },
        "application": {
            "active_tasks": get_active_tasks_count(),
            "versions": get_dependency_versions(),
        }
    }