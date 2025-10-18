import os
import uuid
import asyncio
from pathlib import Path
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from gofile import Gofile

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = Path("/data/downloads")
ARCHIVES_DIR = Path("/data/archives")
STATUS_DIR = Path("/data/status")
PRIVATE_MODE = os.getenv("PRIVATE_MODE", "false").lower() == "true"

# Create directories if they don't exist
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(ARCHIVES_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)

# --- FastAPI App Initialization ---
app = FastAPI(title="Gallery-DL Web UI")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# --- Helper Functions ---
async def run_command(command: str, status_file: Path):
    """Runs a shell command asynchronously and logs its progress."""
    with open(status_file, "a") as f:
        f.write(f"Executing command: {command}\n")
    
    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await process.communicate()
    
    with open(status_file, "a") as f:
        if process.returncode == 0:
            f.write(f"Command finished successfully.\n")
            f.write(f"STDOUT:\n{stdout.decode()}\n")
        else:
            f.write(f"Command failed with exit code {process.returncode}.\n")
            f.write(f"STDERR:\n{stderr.decode()}\n")
    
    if process.returncode != 0:
        raise RuntimeError(f"Command failed: {command}. See status file for details: {status_file.name}")

def create_rclone_config(task_id: str, service: str, params: dict) -> Path:
    """Creates a temporary rclone config file."""
    if service == "gofile":
        return None

    config_dir = Path("/tmp/rclone_configs")
    os.makedirs(config_dir, exist_ok=True)
    config_path = config_dir / f"{task_id}.conf"
    
    config_content = f"[remote]\ntype = {service}\n"
    
    # Basic parameter mapping
    if service == "webdav":
        config_content += f"url = {params['webdav_url']}\n"
        config_content += f"vendor = other\n"
        config_content += f"user = {params['webdav_user']}\n"
        config_content += f"pass = {params['webdav_pass']}\n" # In a real app, use rclone obscure
    elif service == "s3":
        config_content += f"provider = {params.get('s3_provider', 'AWS')}\n"
        config_content += f"access_key_id = {params['s3_access_key_id']}\n"
        config_content += f"secret_access_key = {params['s3_secret_access_key']}\n"
        config_content += f"region = {params['s3_region']}\n"
        config_content += f"endpoint = {params.get('s3_endpoint', '')}\n"
    elif service == "b2":
        config_content += f"account = {params['b2_account_id']}\n"
        config_content += f"key = {params['b2_application_key']}\n"

    with open(config_path, "w") as f:
        f.write(config_content)
        
    return config_path

async def process_download_job(task_id: str, url: str, service: str, upload_path: str, params: dict):
    """The main background task for a download job."""
    task_download_dir = DOWNLOADS_DIR / task_id
    task_archive_path = ARCHIVES_DIR / f"{task_id}.zst"
    status_file = STATUS_DIR / f"{task_id}.log"

    try:
        # 1. Download using gallery-dl
        with open(status_file, "w") as f:
            f.write(f"Starting job {task_id} for URL: {url}\n")
        
        gallery_dl_cmd = f"gallery-dl -D \"{task_download_dir}\" \"{url}\""
        await run_command(gallery_dl_cmd, status_file)

        # 2. Compress the downloaded folder
        downloaded_folders = [d for d in task_download_dir.iterdir() if d.is_dir()]
        if not downloaded_folders:
            raise FileNotFoundError("No sub-directory found in download folder. gallery-dl might have failed.")
        
        source_folder_to_compress = downloaded_folders[0]
        compress_cmd = f"zstd -r \"{source_folder_to_compress}\" -o \"{task_archive_path}\""
        await run_command(compress_cmd, status_file)

        # 3. Upload
        if service == "gofile":
            with open(status_file, "a") as f:
                f.write("Uploading to gofile.io...\n")
            
            gofile_client = Gofile(token=params.get("gofile_token"))
            upload_result = gofile_client.upload_file(task_archive_path)
            
            with open(status_file, "a") as f:
                f.write(f"Gofile.io upload successful!\n")
                f.write(f"Download link: {upload_result['downloadPage']}\n")
        else:
            rclone_config_path = create_rclone_config(task_id, service, params)
            remote_full_path = f"remote:{upload_path}"
            upload_cmd = (
                f"rclone copyto --config \"{rclone_config_path}\" \"{task_archive_path}\" \"{remote_full_path}/{task_id}.zst\" "
                f"-P --log-file=\"{status_file}\" --log-level=INFO"
            )
            await run_command(upload_cmd, status_file)
        
        with open(status_file, "a") as f:
            f.write("\nJob completed successfully!\n")

    except Exception as e:
        with open(status_file, "a") as f:
            f.write(f"\n--- JOB FAILED ---\n")
            f.write(f"An error occurred: {str(e)}\n")
    finally:
        # Clean up temporary rclone config
        if service != "gofile":
            rclone_config_path = Path(f"/tmp/rclone_configs/{task_id}.conf")
            if rclone_config_path.exists():
                rclone_config_path.unlink()


# --- API Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    """Serves the main HTML page."""
    if PRIVATE_MODE:
        return HTMLResponse(status_code=503, content="<h1>Service Unavailable</h1><p>Please access through your designated login page.</p>")
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def get_login(request: Request):
    """Serves the main HTML page."""
    return templates.TemplateResponse("index.html", {"request": request})
    
@app.post("/download")
async def create_download_job(
    request: Request,
    url: str = Form(...),
    upload_service: str = Form(...),
    upload_path: str = Form(None),
    # WebDAV
    webdav_url: str = Form(None),
    webdav_user: str = Form(None),
    webdav_pass: str = Form(None),
    # S3
    s3_provider: str = Form(None),
    s3_access_key_id: str = Form(None),
    s3_secret_access_key: str = Form(None),
    s3_region: str = Form(None),
    s3_endpoint: str = Form(None),
    # B2
    b2_account_id: str = Form(None),
    b2_application_key: str = Form(None),
    # Gofile
    gofile_token: str = Form(None),
):
    """
    Accepts a download job, validates input, and starts it in the background.
    """
    task_id = str(uuid.uuid4())
    
    params = await request.form()
    
    # Simple validation
    if not url or not upload_service:
        raise HTTPException(status_code=400, detail="URL and Upload Service are required.")
    if upload_service != "gofile" and not upload_path:
        raise HTTPException(status_code=400, detail="Upload Path is required for this service.")

    # Run the job in the background
    asyncio.create_task(process_download_job(task_id, url, upload_service, upload_path, params))
    
    return RedirectResponse(f"/status/{task_id}", status_code=303)


@app.get("/status/{task_id}", response_class=HTMLResponse)
async def get_status(request: Request, task_id: str):
    """Displays the status log for a given task."""
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    
    with open(status_file, "r") as f:
        content = f.read()
        
    return templates.TemplateResponse(
        "status.html", 
        {"request": request, "task_id": task_id, "log_content": content}
    )

@app.get("/status/{task_id}/raw")
async def get_status_raw(task_id: str):
    """Returns the raw log file content."""
    status_file = STATUS_DIR / f"{task_id}.log"
    if not status_file.exists():
        raise HTTPException(status_code=404, detail="Job not found.")
    
    with open(status_file, "r") as f:
        content = f.read()
    return HTMLResponse(content=f"<pre>{content}</pre>")
