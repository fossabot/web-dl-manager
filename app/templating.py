import sys
from pathlib import Path
from fastapi.templating import Jinja2Templates

# This logic handles getting the correct template directory path
# whether the application is running from source or as a frozen executable (e.g., PyInstaller).
if getattr(sys, 'frozen', False):
    # When running as a frozen executable, the templates are in a different location.
    base_path = Path(sys._MEIPASS)
    template_dir = base_path / "app" / "templates"
else:
    # When running from source, the path is relative to this file.
    base_path = Path(__file__).resolve().parent
    template_dir = base_path / "templates"

# Global templates object to be imported by routers
templates = Jinja2Templates(directory=str(template_dir))

# Add global functions/variables to templates context
def get_avatar_url():
    from .database import db_config
    from .config import AVATAR_URL as DEFAULT_AVATAR_URL
    return db_config.get_config("AVATAR_URL", DEFAULT_AVATAR_URL)

templates.env.globals["get_avatar_url"] = get_avatar_url

