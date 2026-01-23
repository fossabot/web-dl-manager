import os
import json
import random
import httpx
import subprocess
import asyncio
import base64
import tempfile
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import Request

from . import openlist
from .database import db_config
from .config import STATUS_DIR, CONFIG_BACKUP_RCLONE_BASE64, CONFIG_BACKUP_REMOTE_PATH, GALLERY_DL_CONFIG_DIR

logger = logging.getLogger(__name__)

import time
import psutil

# Cache for network speed calculation
_net_io_cache = {"last_time": time.time(), "last_recv": psutil.net_io_counters().bytes_recv, "last_sent": psutil.net_io_counters().bytes_sent}

def get_net_speed():
    """Calculates real-time network receive/send speeds (bytes/s)."""
    global _net_io_cache
    current_time = time.time()
    current_io = psutil.net_io_counters()
    
    interval = current_time - _net_io_cache["last_time"]
    if interval <= 0:
        return 0, 0
    
    recv_speed = (current_io.bytes_recv - _net_io_cache["last_recv"]) / interval
    sent_speed = (current_io.bytes_sent - _net_io_cache["last_sent"]) / interval
    
    _net_io_cache.update({
        "last_time": current_time,
        "last_recv": current_io.bytes_recv,
        "last_sent": current_io.bytes_sent
    })
    
    return max(0, recv_speed), max(0, sent_speed)

def count_files_in_dir(directory: Path) -> Dict[str, Any]:
    """Counts files and total size in a directory or single file."""
    count = 0
    total_size = 0
    
    if not directory.exists():
        return {"count": 0, "size": 0}
        
    if directory.is_file():
        return {"count": 1, "size": directory.stat().st_size}
        
    for item in directory.rglob("*"):
        if item.is_file():
            count += 1
            total_size += item.stat().st_size
    return {"count": count, "size": total_size}

# --- Helper Functions ---

def get_task_status_path(task_id: str) -> Path:
    """Returns the path to the JSON status file for a given task."""
    return STATUS_DIR / f"{task_id}.json"

def update_task_status(task_id: str, updates: Dict[str, Any]):
    """Updates the JSON status file for a given task."""
    status_path = get_task_status_path(task_id)
    status_data = {}
    if status_path.exists():
        with open(status_path, "r") as f:
            try:
                status_data = json.load(f)
            except json.JSONDecodeError:
                pass  # Overwrite if file is corrupted
    
    status_data.update(updates)
    
    with open(status_path, "w") as f:
        json.dump(status_data, f, indent=4)

async def get_working_proxy(status_file: Path) -> str:
    """Fetches a list of HTTP proxies, tests them concurrently, and returns a working one."""
    proxy_list_url = "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt"
    with open(status_file, "a") as f:
        f.write("Fetching proxy list...\n")
    async with httpx.AsyncClient() as client:
        response = await client.get(proxy_list_url)
        response.raise_for_status()
        proxies = response.text.splitlines()

    async def test_proxy(proxy):
        try:
            async with httpx.AsyncClient(proxies=f"http://{proxy}", timeout=5) as client:
                response = await client.get("https://www.google.com", timeout=5)
                response.raise_for_status()
                return proxy
        except Exception:
            return None

    i = 0
    while True:
        i += 1
        shuffled_proxies = random.sample(proxies, min(len(proxies), 3000))
        with open(status_file, "a") as f:
            f.write(f"Attempt {i}: Concurrently testing {len(shuffled_proxies)} proxies...\n")

        tasks = [test_proxy(p) for p in shuffled_proxies]
        for future in asyncio.as_completed(tasks):
            result = await future
            if result:
                with open(status_file, "a") as f:
                    f.write(f"Found working proxy: {result}\n")
                return result
        
        with open(status_file, "a") as f:
            f.write(f"No working proxy found in attempt {i}. Retrying with a new batch...\n")

async def upload_to_gofile(file_path: Path, status_file: Path, api_token: Optional[str] = None, folder_id: Optional[str] = None) -> str:
    """
    Uploads a file to gofile.io, using the correct server-specific endpoint for both authenticated and public uploads.
    """

    async def _attempt_upload(use_token: bool, servers: List[Dict]):
        """Internal helper to attempt an upload by iterating through available servers."""
        upload_type = "authenticated" if use_token and api_token else "public"
        with open(status_file, "a", encoding="utf-8") as f:
            f.write(f"Attempting {upload_type} upload...\n")

        for server in servers:
            server_name = server["name"]
            upload_url = f"https://{server_name}.gofile.io/uploadFile"
            
            with open(status_file, "a", encoding="utf-8") as f:
                f.write(f"Trying {upload_type} upload via server: {server_name}...\n")

            try:
                async with httpx.AsyncClient(timeout=300) as client:
                    form_data = {}
                    if use_token and api_token:
                        form_data['token'] = api_token
                        if folder_id:
                            form_data['folderId'] = folder_id
                    
                    with open(file_path, "rb") as f_upload:
                        files = {'file': (file_path.name, f_upload, "application/octet-stream")}
                        response = await client.post(upload_url, data=form_data or None, files=files)
                    
                    response.raise_for_status()
                    upload_result = response.json()

                    if upload_result.get("status") == "ok":
                        download_link = upload_result["data"]["downloadPage"]
                        with open(status_file, "a", encoding="utf-8") as f:
                            f.write(f"Gofile.io {upload_type} upload successful on server {server_name}! Link: {download_link}\n")
                        return download_link
                    else:
                        with open(status_file, "a", encoding="utf-8") as f:
                            f.write(f"Gofile API returned an error on {upload_type} upload to {server_name}: {upload_result}. Trying next server...\n")
                        continue
            except Exception as e:
                with open(status_file, "a", encoding="utf-8") as f:
                    f.write(f"An exception occurred during {upload_type} upload to {server_name}: {e}. Trying next server...\n")
                continue
        
        with open(status_file, "a", encoding="utf-8") as f:
            f.write(f"All Gofile servers failed for {upload_type} upload.\n")
        return None

    servers = []
    try:
        with open(status_file, "a", encoding="utf-8") as f:
            f.write("Fetching Gofile server list...\n")
        async with httpx.AsyncClient(timeout=60) as client:
            servers_res = await client.get("https://api.gofile.io/servers")
            servers_res.raise_for_status()
            servers_data = servers_res.json()
            if servers_data.get("status") != "ok":
                 raise Exception(f"Gofile API did not return 'ok' for server list: {servers_data}")
            servers = servers_data["data"]["servers"]
            random.shuffle(servers)
    except Exception as e:
        error_message = f"FATAL: Could not fetch Gofile server list: {e}"
        with open(status_file, "a", encoding="utf-8") as f:
            f.write(f"{error_message}\n")
        raise Exception(error_message)

    download_link = None
    if api_token:
        download_link = await _attempt_upload(use_token=True, servers=servers)

    if not download_link:
        if api_token:
            with open(status_file, "a", encoding="utf-8") as f:
                f.write("Authenticated upload failed. Falling back to public upload.\n")
        download_link = await _attempt_upload(use_token=False, servers=servers)

    if not download_link:
        raise Exception("Gofile.io upload failed completely after trying all available servers and fallback options.")

    return download_link


def create_rclone_config(task_id: str, service: str, params: dict) -> Path:
    """Creates a temporary rclone config file."""
    if service == "gofile" or service == "openlist":
        return None

    config_dir = Path("/tmp/rclone_configs")
    os.makedirs(config_dir, exist_ok=True)
    config_path = config_dir / f"{task_id}.conf"
    
    config_content = f"[remote]\ntype = {service}\n"
    
    if service == "webdav":
        webdav_url = params.get('webdav_url') or db_config.get_config("WDM_WEBDAV_URL")
        webdav_user = params.get('webdav_user') or db_config.get_config("WDM_WEBDAV_USER")
        webdav_pass = params.get('webdav_pass') or db_config.get_config("WDM_WEBDAV_PASS")
        
        if not all([webdav_url, webdav_user, webdav_pass]):
            logger.error(f"WebDAV configuration missing for task {task_id}")
            # We can't proceed without these
            return None

        config_content += f"url = {webdav_url}\n"
        config_content += f"vendor = other\n"
        config_content += f"user = {webdav_user}\n"
        obscured_pass_process = subprocess.run(
            ["rclone", "obscure", webdav_pass],
            capture_output=True,
            text=True
        )
        obscured_pass = obscured_pass_process.stdout.strip()
        config_content += f"pass = {obscured_pass}\n"
        
    elif service == "s3":
        s3_provider = params.get('s3_provider') or db_config.get_config("WDM_S3_PROVIDER", "AWS")
        s3_access_key_id = params.get('s3_access_key_id') or db_config.get_config("WDM_S3_ACCESS_KEY_ID")
        s3_secret_access_key = params.get('s3_secret_access_key') or db_config.get_config("WDM_S3_SECRET_ACCESS_KEY")
        s3_region = params.get('s3_region') or db_config.get_config("WDM_S3_REGION")
        s3_endpoint = params.get('s3_endpoint') or db_config.get_config("WDM_S3_ENDPOINT", "")

        if not all([s3_access_key_id, s3_secret_access_key, s3_region]):
            logger.error(f"S3 configuration missing for task {task_id}")
            return None

        config_content += f"provider = {s3_provider}\n"
        config_content += f"access_key_id = {s3_access_key_id}\n"
        config_content += f"secret_access_key = {s3_secret_access_key}\n"
        config_content += f"region = {s3_region}\n"
        config_content += f"endpoint = {s3_endpoint}\n"
    elif service == "b2":
        b2_account_id = params.get('b2_account_id') or db_config.get_config("WDM_B2_ACCOUNT_ID")
        b2_application_key = params.get('b2_application_key') or db_config.get_config("WDM_B2_APPLICATION_KEY")
        
        if not all([b2_account_id, b2_application_key]):
            logger.error(f"B2 configuration missing for task {task_id}")
            return None
            
        config_content += f"account = {b2_account_id}\n"
        config_content += f"key = {b2_application_key}\n"
    

    with open(config_path, "w") as f:
        f.write(config_content)
        
    return config_path

def generate_archive_name(url: str) -> str:
    """Generates a descriptive archive name from a URL."""
    try:
        path_parts = [part for part in url.split("/") if part]
        if len(path_parts) > 2:
            return "_".join(path_parts[-3:])
        else:
            return "_".join(path_parts)
    except Exception:
        return "archive"

def convert_rate_limit_to_kbps(rate_limit_str: str) -> int:
    """Converts rate limit string (e.g., '2M', '500K') to integer KB/s for megadl command.
    
    Args:
        rate_limit_str: Speed limit string like '2M', '500K', '1G', or plain number.
        
    Returns:
        Integer value in KB/s.
    """
    if not rate_limit_str:
        return 0
    
    rate_limit_str = rate_limit_str.strip().upper()
    
    if rate_limit_str.isdigit():
        return int(rate_limit_str)
    
    import re
    match = re.match(r'^(\d+(?:\.\d+)?)\s*([KMG])?$', rate_limit_str)
    if not match:
        numbers = re.findall(r'\d+', rate_limit_str)
        if numbers:
            return int(numbers[0])
        return 0
    
    number = float(match.group(1))
    unit = match.group(2)
    
    if unit == 'G':
        return int(number * 1000 * 1000)
    elif unit == 'M':
        return int(number * 1000)
    elif unit == 'K':
        return int(number)
    else:
        return int(number)

async def _run_rclone_command(command: str, log_file: Optional[Path] = None):
    """Helper to run an rclone command and log its output."""
    log_message = f"Executing rclone command: {command}\n"
    if log_file:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_message)
    else:
        logger.info(log_message)

    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()

    output = stdout.decode('utf-8', errors='ignore')
    error = stderr.decode('utf-8', errors='ignore')

    if process.returncode == 0:
        log_message = f"Rclone command finished successfully.\nOutput: {output}\n"
        if log_file:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(log_message)
        else:
            logger.info(log_message)
    else:
        # Note: rclone can exit with non-zero codes for non-critical errors (e.g., file not found on remote),
        # so we log this as INFO, not ERROR, for the restore case.
        log_message = f"Rclone command finished with exit code {process.returncode}.\nError: {error}\n"
        if log_file:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(log_message)
        else:
            logger.info(log_message)
    
    return process.returncode == 0




def generate_math_challenge(request: Request):
    """Generates a simple math challenge and stores the result in session."""
    return ""

async def restore_gallery_dl_config():




    """Restore gallery-dl configuration files at startup."""




    if not CONFIG_BACKUP_RCLONE_BASE64 or not CONFIG_BACKUP_REMOTE_PATH:




        logger.info("Configuration restore not configured. Skipping.")




        return









    logger.info("Attempting to restore gallery-dl config from rclone remote...")




    GALLERY_DL_CONFIG_DIR.mkdir(exist_ok=True, parents=True)









    try:




        rclone_config_content = base64.b64decode(CONFIG_BACKUP_RCLONE_BASE64).decode('utf-8')




    except Exception as e:




        logger.error(f"Failed to decode base64 rclone config for restore: {str(e)}")




        return









    with tempfile.NamedTemporaryFile(mode='w', suffix='.conf', delete=False) as tmp_file:




        tmp_config_path = tmp_file.name




        tmp_file.write(rclone_config_content)









    try:




        # Use copy instead of sync to avoid deleting local files if remote is empty




        rclone_cmd = (f"rclone copy \"{CONFIG_BACKUP_REMOTE_PATH}\" \"{GALLERY_DL_CONFIG_DIR}\" "




                      f"--config \"{tmp_config_path}\" "




                      f"-P --log-level=INFO")




        await _run_rclone_command(rclone_cmd)




        logger.info("Finished attempt to restore gallery-dl config.")




    finally:




        if os.path.exists(tmp_config_path):




            os.unlink(tmp_config_path)









async def backup_gallery_dl_config():




    """Backup gallery-dl configuration files to rclone remote."""




    if not CONFIG_BACKUP_RCLONE_BASE64 or not CONFIG_BACKUP_REMOTE_PATH:




        return









    if not GALLERY_DL_CONFIG_DIR.exists():




        return









    logger.info("Backing up gallery-dl config to rclone remote...")




    try:




        rclone_config_content = base64.b64decode(CONFIG_BACKUP_RCLONE_BASE64).decode('utf-8')




    except Exception as e:




        logger.error(f"Failed to decode base64 rclone config for backup: {str(e)}")




        return









    with tempfile.NamedTemporaryFile(mode='w', suffix='.conf', delete=False) as tmp_file:




        tmp_config_path = tmp_file.name




        tmp_file.write(rclone_config_content)









    try:




        # Use copy to ensure new tokens/configs are pushed to remote




        rclone_cmd = (f"rclone copy \"{GALLERY_DL_CONFIG_DIR}\" \"{CONFIG_BACKUP_REMOTE_PATH}\" "




                      f"--config \"{tmp_config_path}\" "




                      f"--log-level=INFO")




        await _run_rclone_command(rclone_cmd)




        logger.info("Gallery-dl config backup successful.")




    finally:




        if os.path.exists(tmp_config_path):




            os.unlink(tmp_config_path)
