import os
from pathlib import Path

import sys
from pathlib import Path

# --- Configuration ---
if getattr(sys, 'frozen', False):
    # Running in a PyInstaller bundle
    # sys._MEIPASS is the temporary directory where the bundle is extracted
    BASE_DIR = Path(sys._MEIPASS) / "app"
    # sys.executable is the path to the binary
    PROJECT_ROOT = Path(sys.executable).parent
else:
    # Running as a normal Python script
    BASE_DIR = Path(__file__).resolve().parent
    PROJECT_ROOT = BASE_DIR.parent

DOWNLOADS_DIR = Path("/data/downloads")
ARCHIVES_DIR = Path("/data/archives")
STATUS_DIR = Path("/data/status")
PRIVATE_MODE = os.getenv("PRIVATE_MODE", "false").lower() == "true"

# --- User Authentication ---
APP_USERNAME = os.getenv("APP_USERNAME", "Jyf0214")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
AVATAR_URL = os.getenv("AVATAR_URL", "https://github.com/Jyf0214.png")

# --- Database Configuration ---
# Use a MySQL connection string, e.g., "mysql://user:password@host:port/database"
# For local development, a SQLite database can be used for simplicity.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{PROJECT_ROOT / 'webdl-manager.db'}")

# --- Redis Configuration ---
# Upstash Redis Connection String, e.g., "rediss://:password@endpoint:port"
REDIS_URL = os.getenv("REDIS_URL")

# --- Config Backup Configuration ---
CONFIG_BACKUP_RCLONE_BASE64 = os.getenv("WDM_CONFIG_BACKUP_RCLONE_BASE64")
CONFIG_BACKUP_REMOTE_PATH = os.getenv("WDM_CONFIG_BACKUP_REMOTE_PATH", "remote:config-backup/gallery-dl")
GALLERY_DL_CONFIG_DIR = Path.home() / ".config" / "gallery-dl"

# Create directories if they don't exist
try:
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(ARCHIVES_DIR, exist_ok=True)
    os.makedirs(STATUS_DIR, exist_ok=True)
except PermissionError:
    print("Permission denied to create /data directories. Creating them locally inside the project.")
    # Redefine paths to be relative to the project root
    DOWNLOADS_DIR = PROJECT_ROOT / "data" / "downloads"
    ARCHIVES_DIR = PROJECT_ROOT / "data" / "archives"
    STATUS_DIR = PROJECT_ROOT / "data" / "status"
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(ARCHIVES_DIR, exist_ok=True)
    os.makedirs(STATUS_DIR, exist_ok=True)
