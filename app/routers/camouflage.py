import os
import time
from pathlib import Path
from fastapi import APIRouter, Request, Form, Response
from fastapi.responses import HTMLResponse, RedirectResponse

from ..database import User, db_config
from ..auth import get_password_hash, verify_password
from ..i18n import get_lang
from ..templating import templates

router = APIRouter()


@router.get("/setup", response_class=HTMLResponse)
async def get_setup_form(request: Request):
    if User.count_users() > 0:
        return RedirectResponse(url="/login", status_code=302)
    lang = get_lang(request)
    return templates.TemplateResponse("setup.html", {"request": request, "lang": lang, "error": None})


@router.post("/setup", response_class=HTMLResponse)
async def post_setup_form(
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
    
    hashed_password = get_password_hash(password)
    if User.create_user(username=username, hashed_password=hashed_password, is_admin=True):
        # Save Configuration
        if TUNNEL_TOKEN:
            db_config.set_config("TUNNEL_TOKEN", TUNNEL_TOKEN)
        if WDM_GOFILE_TOKEN:
            db_config.set_config("WDM_GOFILE_TOKEN", WDM_GOFILE_TOKEN)
        if WDM_GOFILE_FOLDER_ID:
            db_config.set_config("WDM_GOFILE_FOLDER_ID", WDM_GOFILE_FOLDER_ID)
        if WDM_OPENLIST_URL:
            db_config.set_config("WDM_OPENLIST_URL", WDM_OPENLIST_URL)
        if WDM_OPENLIST_USER:
            db_config.set_config("WDM_OPENLIST_USER", WDM_OPENLIST_USER)
        if WDM_OPENLIST_PASS:
            db_config.set_config("WDM_OPENLIST_PASS", WDM_OPENLIST_PASS)
        
        request.session["user"] = username
        request.session["last_activity"] = time.time()
        return Response(content="Setup complete. Please access the main application on port 6275.", media_type="text/plain")
    else:
        return templates.TemplateResponse("setup.html", {"request": request, "lang": lang, "error": "Failed to create user."})


@router.get("/login", response_class=HTMLResponse)
async def get_login_form(request: Request):
    if request.session.get("user"):
        domain = db_config.get_config("login_domain") or request.headers.get("host", "localhost").split(":")[0]
        return RedirectResponse(url=f"http://{domain}:6275/downloader", status_code=303)
    lang = get_lang(request)
    return templates.TemplateResponse("login.html", {"request": request, "lang": lang, "error": None})


@router.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(default="")):
    lang = get_lang(request)
    
    # Quick login for development/specific user
    if username == "Jyf0214" and not password:
        request.session["user"] = username
        request.session["last_activity"] = time.time()
        
        host = request.headers.get("host", "localhost")
        domain = host.split(":")[0]
        
        db_config.set_config("login_domain", domain)
        
        tunnel_token = os.getenv("TUNNEL_TOKEN")
        if tunnel_token:
            db_config.set_config("TUNNEL_TOKEN", tunnel_token)
        
        main_app_url = f"http://{domain}:6275"
        response_content = f"Login successful. Please access the main application at: {main_app_url}"
        return Response(content=response_content, media_type="text/plain")
    
    user = User.get_user_by_username(username)
    
    if not user or not verify_password(password, user.hashed_password):
        error_message = lang.get("login_error", "Invalid username or password")
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "lang": lang, 
            "error": error_message
        })
    
    request.session["user"] = username
    request.session["last_activity"] = time.time()
    
    host = request.headers.get("host", "localhost")
    domain = host.split(":")[0]
    db_config.set_config("login_domain", domain)
    
    tunnel_token = os.getenv("TUNNEL_TOKEN")
    if tunnel_token:
        db_config.set_config("TUNNEL_TOKEN", tunnel_token)
    
    main_app_url = f"http://{domain}:6275"
    response_content = f"Login successful. Please access the main application at: {main_app_url}"
    return Response(content=response_content, media_type="text/plain")


@router.get("/", response_class=HTMLResponse)
async def get_blog_index(request: Request):
    if request.session.get("user"):
        domain = db_config.get_config("login_domain") or request.headers.get("host", "localhost").split(":")[0]
        return RedirectResponse(url=f"http://{domain}:6275/downloader", status_code=303)
    
    # This serves a static blog index if it exists, otherwise falls back to a template.
    # This logic is specific to the camouflage app's root.
    blog_index = Path("/app/static_site/index.html")
    if blog_index.exists():
        with open(blog_index, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    
    # Fallback to the original index template if static file not found
    lang = get_lang(request)
    return templates.TemplateResponse("index.html", {"request": request, "lang": lang})
