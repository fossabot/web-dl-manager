import os
import shutil
from pathlib import Path

import sys

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

# Set local tmp and data root inside the app directory
TMP_DIR = BASE_DIR / "tmp"
DATA_ROOT = TMP_DIR / "data"

# Auto cleanup the tmp directory on startup to ensure "read and burn" for downloads
if TMP_DIR.exists():
    shutil.rmtree(TMP_DIR, ignore_errors=True)

DOWNLOADS_DIR = DATA_ROOT / "downloads"
ARCHIVES_DIR = DATA_ROOT / "archives"
STATUS_DIR = DATA_ROOT / "status"

# Create directories
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(ARCHIVES_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)

PRIVATE_MODE = os.getenv("PRIVATE_MODE", "false").lower() == "true"

# --- User Authentication ---
APP_USERNAME = os.getenv("APP_USERNAME", "Jyf0214")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
AVATAR_URL = os.getenv("AVATAR_URL", "https://github.com/Jyf0214.png")

# --- Database Configuration ---
# Database is placed at the same level as TMP_DIR (inside BASE_DIR) so it is NOT cleared
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'webdl-manager.db'}")

# --- Redis Configuration ---
# Upstash Redis Connection String, e.g., "rediss://:password@endpoint:port"
REDIS_URL = os.getenv("REDIS_URL")

# --- Config Backup Configuration ---
CONFIG_BACKUP_RCLONE_BASE64 = os.getenv("WDM_CONFIG_BACKUP_RCLONE_BASE64")
CONFIG_BACKUP_REMOTE_PATH = os.getenv("WDM_CONFIG_BACKUP_REMOTE_PATH", "remote:config-backup/gallery-dl")
GALLERY_DL_CONFIG_DIR = Path.home() / ".config" / "gallery-dl"
