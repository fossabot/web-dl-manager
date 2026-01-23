import os
import json
import time
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from .. import status
from ..auth import get_current_user, verify_password
from ..database import User, db_config
from ..i18n import get_lang
from ..templating import templates
from ..config import AVATAR_URL
from .. import redis_client
from ..logging_handler import update_log_handlers

# --- Constants & Helpers ---
SECRET_KEYS = [
    "GITHUB_TOKEN", "WDM_GOFILE_TOKEN", "WDM_OPENLIST_PASS", 
    "WDM_WEBDAV_PASS", "WDM_S3_SECRET_ACCESS_KEY", "WDM_B2_APPLICATION_KEY", 
    "REDIS_URL", "WDM_CONFIG_BACKUP_RCLONE_BASE64", "TUNNEL_TOKEN"
]

def mask_secret(value: str) -> str:
    if not value:
        return ""
    n = len(value)
    if n >= 6:
        return f"{value[:3]}...{value[-3:]}"
    elif n >= 4:
        return f"{value[:2]}...{value[-2:]}"
    return value

router = APIRouter(
    tags=["main_ui"],
)

@router.get("/", response_class=RedirectResponse, dependencies=None)
async def index_redirect(request: Request):
    if request.session.get("user"):
        return RedirectResponse(url="/downloader", status_code=303)
    return RedirectResponse(url="/login", status_code=303)

@router.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    
    # Check which upload services are configured to give hints to the UI
    services_configured = {
        "webdav_configured": bool(db_config.get_config("WDM_WEBDAV_URL") and db_config.get_config("WDM_WEBDAV_USER")),
        "s3_configured": bool(db_config.get_config("WDM_S3_ACCESS_KEY_ID") and db_config.get_config("WDM_S3_SECRET_ACCESS_KEY")),
        "b2_configured": bool(db_config.get_config("WDM_B2_ACCOUNT_ID") and db_config.get_config("WDM_B2_APPLICATION_KEY")),
        "gofile_configured": bool(db_config.get_config("WDM_GOFILE_TOKEN")),
        "openlist_configured": bool(db_config.get_config("WDM_OPENLIST_URL") and db_config.get_config("WDM_OPENLIST_USER")),
    }
    
    upload_configs = {
        "webdav": {"url_configured": bool(db_config.get_config("WDM_WEBDAV_URL")), "user_configured": bool(db_config.get_config("WDM_WEBDAV_USER")), "pass_configured": bool(db_config.get_config("WDM_WEBDAV_PASS"))},
        "s3": {"provider_configured": bool(db_config.get_config("WDM_S3_PROVIDER")), "access_key_id_configured": bool(db_config.get_config("WDM_S3_ACCESS_KEY_ID")), "secret_access_key_configured": bool(db_config.get_config("WDM_S3_SECRET_ACCESS_KEY")), "region_configured": bool(db_config.get_config("WDM_S3_REGION")), "endpoint_configured": bool(db_config.get_config("WDM_S3_ENDPOINT"))},
        "b2": {"account_id_configured": bool(db_config.get_config("WDM_B2_ACCOUNT_ID")), "application_key_configured": bool(db_config.get_config("WDM_B2_APPLICATION_KEY"))},
        "gofile": {"token_configured": bool(db_config.get_config("WDM_GOFILE_TOKEN")), "folder_id_configured": bool(db_config.get_config("WDM_GOFILE_FOLDER_ID"))},
        "openlist": {"url_configured": bool(db_config.get_config("WDM_OPENLIST_URL")), "user_configured": bool(db_config.get_config("WDM_OPENLIST_USER")), "pass_configured": bool(db_config.get_config("WDM_OPENLIST_PASS"))}
    }
    
    return templates.TemplateResponse("downloader.html", {
        "request": request, 
        "lang": lang, 
        "user": current_user.username, 
        "avatar_url": db_config.get_config("AVATAR_URL", AVATAR_URL),
        "services_configured": services_configured,
        "upload_configs": upload_configs
    })



@router.get("/tasks", response_class=HTMLResponse)
async def get_tasks(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    tasks_list = status.get_all_tasks()
    return templates.TemplateResponse("tasks.html", {"request": request, "tasks": tasks_list, "lang": lang, "user": current_user.username})

@router.get("/updates", response_class=HTMLResponse)
async def updates_page(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    return templates.TemplateResponse("updates.html", {"request": request, "lang": lang})

@router.get("/change_password", response_class=HTMLResponse)
async def change_password_page(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    return templates.TemplateResponse("change_password.html", {
        "request": request,
        "user": current_user.username,
        "lang": lang
    })

@router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    
    # Fetch current configuration from database
    config_keys = [
        "TUNNEL_TOKEN", 
        "WDM_GOFILE_TOKEN", "WDM_GOFILE_FOLDER_ID",
        "WDM_OPENLIST_URL", "WDM_OPENLIST_USER", "WDM_OPENLIST_PASS",
        "WDM_WEBDAV_URL", "WDM_WEBDAV_USER", "WDM_WEBDAV_PASS",
        "WDM_S3_PROVIDER", "WDM_S3_ACCESS_KEY_ID", "WDM_S3_SECRET_ACCESS_KEY", "WDM_S3_REGION", "WDM_S3_ENDPOINT",
        "WDM_B2_ACCOUNT_ID", "WDM_B2_APPLICATION_KEY",
        "WDM_CONFIG_BACKUP_RCLONE_BASE64", "WDM_CONFIG_BACKUP_REMOTE_PATH",
        "AVATAR_URL", "login_domain", "PRIVATE_MODE", "DEBUG_MODE", "GITHUB_TOKEN",
        "REDIS_URL", "TERMINAL_ENABLED"
    ]
    
    current_config = {}
    for key in config_keys:
        val = db_config.get_config(key, "")
        if key in SECRET_KEYS and val:
            current_config[key] = mask_secret(val)
        else:
            current_config[key] = val
    
    return templates.TemplateResponse("settings.html", {
        "request": request,
        "user": current_user.username,
        "lang": lang,
        "config": current_config
    })

@router.post("/settings", response_class=HTMLResponse)
async def save_settings(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    lang = get_lang(request)
    form_data = await request.form()
    
    config_keys = [
        "TUNNEL_TOKEN", 
        "WDM_GOFILE_TOKEN", "WDM_GOFILE_FOLDER_ID",
        "WDM_OPENLIST_URL", "WDM_OPENLIST_USER", "WDM_OPENLIST_PASS",
        "WDM_WEBDAV_URL", "WDM_WEBDAV_USER", "WDM_WEBDAV_PASS",
        "WDM_S3_PROVIDER", "WDM_S3_ACCESS_KEY_ID", "WDM_S3_SECRET_ACCESS_KEY", "WDM_S3_REGION", "WDM_S3_ENDPOINT",
        "WDM_B2_ACCOUNT_ID", "WDM_B2_APPLICATION_KEY",
        "WDM_CONFIG_BACKUP_RCLONE_BASE64", "WDM_CONFIG_BACKUP_REMOTE_PATH",
        "AVATAR_URL", "login_domain", "PRIVATE_MODE", "DEBUG_MODE", "GITHUB_TOKEN",
        "REDIS_URL", "TERMINAL_ENABLED"
    ]
    
    try:
        # Save all configs that are present in the form
        for key in config_keys:
            # Handle AVATAR_URL separately because the input name is AVATAR_URL_INPUT in the template
            form_key = "AVATAR_URL_INPUT" if key == "AVATAR_URL" else key
            if form_key in form_data:
                new_value = str(form_data[form_key]).strip()
                
                # If it's a secret key, check if user actually changed it
                if key in SECRET_KEYS:
                    old_value = db_config.get_config(key, "")
                    # If submitted value matches the masked version of the old value, user didn't change it
                    if old_value and new_value == mask_secret(old_value):
                        continue
                
                db_config.set_config(key, new_value)
        
        # Clear cache to ensure new settings are picked up
        db_config.clear_cache()
        
        # Reload Redis connection and log handlers
        redis_client.init_redis()
        update_log_handlers()
        
        # Fetch updated config for rendering
        current_config = {key: db_config.get_config(key, "") for key in config_keys}
        
        return templates.TemplateResponse("settings.html", {
            "request": request,
            "user": current_user.username,
            "lang": lang,
            "config": current_config,
            "success": lang["settings_saved_success"],
            "avatar_url": db_config.get_config("AVATAR_URL", AVATAR_URL)
        })
    except Exception as e:
        # Re-fetch for rendering on error
        current_config = {key: db_config.get_config(key, "") for key in config_keys}
        return templates.TemplateResponse("settings.html", {
            "request": request,
            "user": current_user.username,
            "lang": lang,
            "config": current_config,
            "error": f"{lang['settings_update_failed']}: {str(e)}",
            "avatar_url": db_config.get_config("AVATAR_URL", AVATAR_URL)
        })

@router.post("/change_password", response_class=HTMLResponse)
async def change_password(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    user: User = Depends(get_current_user)
):
    lang = get_lang(request)
    
    if not verify_password(current_password, user.hashed_password):
        return templates.TemplateResponse("change_password.html", {"request": request, "user": user.username, "lang": lang, "error": lang["current_password_incorrect"]})
    
    if new_password != confirm_password:
        return templates.TemplateResponse("change_password.html", {"request": request, "user": user.username, "lang": lang, "error": lang["passwords_not_match"]})
    
    if not new_password:
        return templates.TemplateResponse("change_password.html", {"request": request, "user": user.username, "lang": lang, "error": lang["password_empty"]})
    
    from ..auth import get_password_hash
    new_hashed_password = get_password_hash(new_password)
    if User.update_password(user.username, new_hashed_password):
        return templates.TemplateResponse("change_password.html", {"request": request, "user": user.username, "lang": lang, "success": lang["password_changed_success"]})
    else:
        return templates.TemplateResponse("change_password.html", {"request": request, "user": user.username, "lang": lang, "error": lang["password_update_failed"]})

@router.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    status_file = status.STATUS_DIR / f"{task_id}.log"
    upload_log_file = status.STATUS_DIR / f"{task_id}_upload.log"
    
    if not status_file.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
        
    with open(status_file, "r") as f: content = f.read()
    
    upload_content = ""
    if upload_log_file.exists():
        with open(upload_log_file, "r") as f:
            upload_content = f.read()
            
    return templates.TemplateResponse("status.html", {
        "request": request, 
        "task_id": task_id, 
        "log_content": content, 
        "upload_log_content": upload_content,
        "lang": lang, 
        "user": current_user.username
    })

@router.get("/setup", response_class=HTMLResponse)
async def get_setup_form_main(request: Request):
    if User.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    lang = get_lang(request)
    return templates.TemplateResponse("setup.html", {"request": request, "lang": lang, "error": None})

@router.post("/setup", response_class=HTMLResponse)
async def post_setup_form_main(
    request: Request, 
    username: str = Form(...), 
    password: str = Form(...), 
    confirm_password: str = Form(...),
    TUNNEL_TOKEN: str = Form(None),
    WDM_GOFILE_TOKEN: str = Form(None),
    WDM_GOFILE_FOLDER_ID: str = Form(None),
    WDM_OPENLIST_URL: str = Form(None),
    WDM_OPENLIST_USER: str = Form(None),
    WDM_OPENLIST_PASS: str = Form(None)
):
    lang = get_lang(request)
    if User.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    if password != confirm_password:
        return templates.TemplateResponse("setup.html", {"request": request, "lang": lang, "error": "Passwords do not match."})
    if not username or not password:
        return templates.TemplateResponse("setup.html", {"request": request, "lang": lang, "error": "Username and password cannot be empty."})
    
    from ..auth import get_password_hash
    hashed_password = get_password_hash(password)
    if User.create_user(username=username, hashed_password=hashed_password, is_admin=True):
        # Save Configuration
        if TUNNEL_TOKEN: db_config.set_config("TUNNEL_TOKEN", TUNNEL_TOKEN)
        if WDM_GOFILE_TOKEN: db_config.set_config("WDM_GOFILE_TOKEN", WDM_GOFILE_TOKEN)
        if WDM_GOFILE_FOLDER_ID: db_config.set_config("WDM_GOFILE_FOLDER_ID", WDM_GOFILE_FOLDER_ID)
        if WDM_OPENLIST_URL: db_config.set_config("WDM_OPENLIST_URL", WDM_OPENLIST_URL)
        if WDM_OPENLIST_USER: db_config.set_config("WDM_OPENLIST_USER", WDM_OPENLIST_USER)
        if WDM_OPENLIST_PASS: db_config.set_config("WDM_OPENLIST_PASS", WDM_OPENLIST_PASS)
        
        request.session["user"] = username
        request.session["last_activity"] = time.time()
        return RedirectResponse(url="/downloader", status_code=303)
    else:
        return templates.TemplateResponse("setup.html", {"request": request, "lang": lang, "error": "Failed to create user."})

# The main app also has a login form, but it's only used for re-authentication if the session expires.
# It does not perform setup or first-time login.
@router.get("/login", response_class=HTMLResponse, dependencies=None) # No auth dependency for the login page itself
async def get_login_form_main(request: Request):
    if request.session.get("user"):
        return RedirectResponse(url="/downloader", status_code=303)
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang, "error": None})

@router.post("/login", response_class=RedirectResponse, dependencies=None) # No auth dependency for the login page itself
async def login_main(request: Request, username: str = Form(...), password: str = Form(default="")):
    lang = get_lang(request)
    
    # Check DEBUG mode
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    # Quick login for dev
    if username == "Jyf0214" and not password:
        request.session["user"] = username
        request.session["last_activity"] = time.time()
        return RedirectResponse(url="/downloader", status_code=303)
    
    # In DEBUG mode, accept any username without password verification
    if debug_enabled:
        request.session["user"] = username
        request.session["last_activity"] = time.time()
        return RedirectResponse(url="/downloader", status_code=303)
    
    user = User.get_user_by_username(username)
    
    if not user or not verify_password(password, user.hashed_password):
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": lang.get("login_error", "Invalid username or password")
        }, status_code=401)
    
    request.session["user"] = username
    request.session["last_activity"] = time.time()
    return RedirectResponse(url="/downloader", status_code=303)
