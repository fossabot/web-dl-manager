import os
import json
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from .. import status
from ..auth import get_current_user, verify_password
from ..database import User
from ..i18n import get_lang
from ..templating import templates
from ..config import AVATAR_URL

router = APIRouter(
    dependencies=[Depends(get_current_user)],
    tags=["main_ui"],
)

@router.get("/downloader", response_class=HTMLResponse)
async def get_downloader(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    
    # Check which upload services are configured to give hints to the UI
    services_configured = {
        "webdav_configured": bool(os.getenv("WDM_WEBDAV_URL") and os.getenv("WDM_WEBDAV_USER")),
        "s3_configured": bool(os.getenv("WDM_S3_ACCESS_KEY_ID") and os.getenv("WDM_S3_SECRET_ACCESS_KEY")),
        "b2_configured": bool(os.getenv("WDM_B2_ACCOUNT_ID") and os.getenv("WDM_B2_APPLICATION_KEY")),
        "gofile_configured": bool(os.getenv("WDM_GOFILE_TOKEN")),
        "openlist_configured": bool(os.getenv("WDM_OPENLIST_URL") and os.getenv("WDM_OPENLIST_USER")),
    }
    
    upload_configs = {
        "webdav": {"url_configured": bool(os.getenv("WDM_WEBDAV_URL")), "user_configured": bool(os.getenv("WDM_WEBDAV_USER")), "pass_configured": bool(os.getenv("WDM_WEBDAV_PASS"))},
        "s3": {"provider_configured": bool(os.getenv("WDM_S3_PROVIDER")), "access_key_id_configured": bool(os.getenv("WDM_S3_ACCESS_KEY_ID")), "secret_access_key_configured": bool(os.getenv("WDM_S3_SECRET_ACCESS_KEY")), "region_configured": bool(os.getenv("WDM_S3_REGION")), "endpoint_configured": bool(os.getenv("WDM_S3_ENDPOINT"))},
        "b2": {"account_id_configured": bool(os.getenv("WDM_B2_ACCOUNT_ID")), "application_key_configured": bool(os.getenv("WDM_B2_APPLICATION_KEY"))},
        "gofile": {"token_configured": bool(os.getenv("WDM_GOFILE_TOKEN")), "folder_id_configured": bool(os.getenv("WDM_GOFILE_FOLDER_ID"))},
        "openlist": {"url_configured": bool(os.getenv("WDM_OPENLIST_URL")), "user_configured": bool(os.getenv("WDM_OPENLIST_USER")), "pass_configured": bool(os.getenv("WDM_OPENLIST_PASS"))}
    }
    
    return templates.TemplateResponse("downloader.html", {
        "request": request, 
        "lang": lang, 
        "user": current_user.username, 
        "avatar_url": AVATAR_URL,
        "services_configured": services_configured,
        "upload_configs": upload_configs
    })

@router.get("/terminal", response_class=HTMLResponse)
async def get_terminal(request: Request, current_user: User = Depends(get_current_user)):
    lang = get_lang(request)
    return templates.TemplateResponse("terminal.html", {
        "request": request,
        "lang": lang,
        "user": current_user.username,
        "avatar_url": AVATAR_URL
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
    if not status_file.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=lang["job_not_found"])
    with open(status_file, "r") as f: content = f.read()
    return templates.TemplateResponse("status.html", {"request": request, "task_id": task_id, "log_content": content, "lang": lang, "user": current_user.username})

# The main app also has a login form, but it's only used for re-authentication if the session expires.
# It does not perform setup or first-time login.
@router.get("/login", response_class=HTMLResponse, dependencies=None) # No auth dependency for the login page itself
async def get_login_form_main(request: Request):
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
        return RedirectResponse(url="/downloader", status_code=303)
    
    # In DEBUG mode, accept any username without password verification
    if debug_enabled:
        request.session["user"] = username
        return RedirectResponse(url="/downloader", status_code=303)
    
    user = User.get_user_by_username(username)
    
    if not user or not verify_password(password, user.hashed_password):
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": lang.get("login_error", "Invalid username or password")
        }, status_code=401)
    
    request.session["user"] = username
    return RedirectResponse(url="/downloader", status_code=303)
