import sys
from cx_Freeze import setup, Executable
import os

build_exe_options = {
    "packages": ["app"],
    "includes": ["app.config", "app.main", "app.openlist", "app.status", "app.tasks", "app.updater", "app.utils", "jinja2"],
    "include_files": [
        ("app/templates", "templates"),
        ("cloudflared", "cloudflared")
    ],
    "excludes": ["tkinter"]
}

base = None
if sys.platform == "win32":
    base = "Win32GUI"

setup(
    name="gallery-dl-web",
    version="1.0.0",
    description="gallery-dl-web application",
    options={"build_exe": build_exe_options},
    executables=[Executable("app/main.py", base=base)]
)