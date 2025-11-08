import psutil
import shutil
import subprocess
import platform
import sys
from datetime import datetime, timedelta

from .config import STATUS_DIR

START_TIME = datetime.utcnow()

def get_server_uptime():
    """Returns the server uptime in a human-readable format."""
    uptime = datetime.utcnow() - START_TIME
    days = uptime.days
    hours, remainder = divmod(uptime.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{days}d {hours}h {minutes}m {seconds}s"

def get_cpu_usage():
    """Returns the current CPU usage percentage."""
    return psutil.cpu_percent(interval=1)

def get_memory_usage():
    """Returns a dictionary with memory usage statistics."""
    mem = psutil.virtual_memory()
    return {
        "total": mem.total,
        "used": mem.used,
        "free": mem.free,
        "percent": mem.percent,
    }

def get_disk_usage():
    """Returns a dictionary with disk usage statistics for the /data volume."""
    total, used, free = shutil.disk_usage("/data")
    return {
        "total": total,
        "used": used,
        "free": free,
        "percent": (used / total) * 100 if total > 0 else 0,
    }

def get_active_tasks():
    """Returns the number of currently active (running or paused) tasks."""
    count = 0
    for status_file in STATUS_DIR.glob("*.json"):
        try:
            with open(status_file, "r") as f:
                task_data = f.read()
                if '"status": "running"' in task_data or '"status": "paused"' in task_data:
                    count += 1
        except (IOError, ValueError):
            continue
    return count

def get_dependency_versions():
    """Returns a dictionary with versions of key dependencies."""
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
    except FileNotFoundError:
        pass
        
    try:
        # Get rclone version
        result = subprocess.run(["rclone", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            versions["rclone"] = result.stdout.strip().splitlines()[0]
    except FileNotFoundError:
        pass
        
    return versions

def get_all_status():
    """Aggregates all status information into a single dictionary."""
    return {
        "system": {
            "uptime": get_server_uptime(),
            "cpu_usage": get_cpu_usage(),
            "memory": get_memory_usage(),
            "disk": get_disk_usage(),
        },
        "application": {
            "active_tasks": get_active_tasks(),
            "versions": get_dependency_versions(),
        }
    }
