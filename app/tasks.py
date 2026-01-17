import os
import asyncio
import signal
import shutil
import random
import time
import logging
from pathlib import Path


from . import openlist
from .database import db_config
from .config import DOWNLOADS_DIR, ARCHIVES_DIR, STATUS_DIR
from .utils import (
    get_working_proxy,
    upload_to_gofile,
    create_rclone_config,
    generate_archive_name,
    update_task_status,
    convert_rate_limit_to_kbps,
    count_files_in_dir,
)

# 获取logger
logger = logging.getLogger(__name__)

# 检查是否启用DEBUG模式
debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"


async def unified_periodic_sync():
    """Periodically syncs multiple tasks (including gallery-dl) to remote storage via rclone."""
    from .utils import _run_rclone_command, GALLERY_DL_CONFIG_DIR, CONFIG_BACKUP_REMOTE_PATH
    import base64
    import tempfile
    import json
    
    # Store last run times for each task to manage intervals
    # Key: task identifier, Value: timestamp
    last_run_times = {}

    while True:
        # 1. Load Custom Tasks from JSON
        tasks_json = db_config.get_config("WDM_SYNC_TASKS_JSON", "[]")
        try:
            custom_tasks = json.loads(tasks_json)
        except Exception as e:
            logger.error(f"[Sync] Failed to parse sync tasks JSON: {e}")
            custom_tasks = []

        # 2. Add System Task (Gallery-dl Config)
        system_task = {
            "name": "System: Gallery-dl Config",
            "local_path": str(GALLERY_DL_CONFIG_DIR),
            "remote_path": CONFIG_BACKUP_REMOTE_PATH,
            "interval": 10, # Minutes
            "enabled": True,
            "is_system": True
        }
        
        # Merge all tasks
        all_tasks = [system_task] + custom_tasks
        rclone_base64 = db_config.get_config("WDM_CONFIG_BACKUP_RCLONE_BASE64")
        
        if rclone_base64:
            current_time = time.time()
            
            for task in all_tasks:
                task_name = task.get("name", "Unnamed Task")
                enabled = str(task.get("enabled", "false")).lower() == "true"
                local_path = task.get("local_path")
                remote_path = task.get("remote_path")
                interval_min = task.get("interval", 60)
                
                if not enabled or not local_path or not remote_path:
                    continue
                
                # Check interval
                interval_sec = int(interval_min) * 60
                last_run = last_run_times.get(task_name, 0)
                
                if current_time - last_run >= interval_sec:
                    if os.path.exists(local_path):
                        logger.info(f"[Sync] Running task: {task_name} ({local_path} -> {remote_path})")
                        try:
                            rclone_config_content = base64.b64decode(rclone_base64).decode('utf-8')
                            with tempfile.NamedTemporaryFile(mode='w', suffix='.conf', delete=False) as tmp_file:
                                tmp_config_path = tmp_file.name
                                tmp_file.write(rclone_config_content)
                            
                            try:
                                rclone_cmd = (f"rclone copy \"{local_path}\" \"{remote_path}\" "
                                              f"--config \"{tmp_config_path}\" "
                                              f"--log-level=INFO")
                                success = await _run_rclone_command(rclone_cmd)
                                if success:
                                    logger.info(f"[Sync] Success: {task_name}")
                                    last_run_times[task_name] = current_time
                                else:
                                    logger.error(f"[Sync] Failed: {task_name} (Rclone error)")
                            finally:
                                if os.path.exists(tmp_config_path):
                                    os.unlink(tmp_config_path)
                        except Exception as e:
                            logger.error(f"[Sync] Error in {task_name}: {e}")
                    else:
                        logger.warning(f"[Sync] Local path not found for {task_name}: {local_path}")

        # Sleep for a short while before checking again
        await asyncio.sleep(30) # Tick every 30 seconds





async def run_command(command: str, command_to_log: str, status_file: Path, task_id: str):
    """
    Runs a shell command asynchronously with auto-retry and improved error logging.
    The actual command output is captured and logged for debugging.
    """
    max_retries = 3
    retry_delays = [5, 10, 15]  # seconds
    
    last_exception = None
    
    # Prepare environment with unbuffered output for Python scripts
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    
    for attempt in range(max_retries):
        try:
            with open(status_file, "a", encoding="utf-8") as log_file:
                log_file.write(f"\n[Attempt {attempt + 1}/{max_retries}] Executing command: {command_to_log}\n")
                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=log_file,
                    stderr=log_file,
                    preexec_fn=os.setsid,
                    env=env
                )

            try:
                pgid = os.getpgid(process.pid)
                update_task_status(task_id, {"pgid": pgid})
            except ProcessLookupError:
                pass

            await process.wait()
            update_task_status(task_id, {"pgid": None})

            if process.returncode == 0:
                with open(status_file, "a") as f:
                    f.write(f"\n[Attempt {attempt + 1}] Task finished successfully.\n")
                return
            else:
                # Log detailed error information
                with open(status_file, "a") as f:
                    f.write(f"\n--- TASK FAILED (Attempt {attempt + 1}/{max_retries}, Exit Code: {process.returncode}) ---\n")
                    if debug_enabled:
                        f.write(f"Debug mode enabled - error details are in the log above.\n")
                    else:
                        f.write(f"Error details are available in the log above.\n")
                
                # Store the exception for final raise
                last_exception = RuntimeError(f"Command failed with exit code {process.returncode}.")
                
                # If this was the last attempt, break and raise
                if attempt == max_retries - 1:
                    break
                    
                # Wait before retry
                retry_delay = retry_delays[attempt]
                with open(status_file, "a") as f:
                    f.write(f"Waiting {retry_delay} seconds before retry...\n")
                await asyncio.sleep(retry_delay)
                
                with open(status_file, "a") as f:
                    f.write(f"Retrying command...\n")
                    
        except Exception as e:
            with open(status_file, "a") as f:
                f.write(f"\n--- EXCEPTION DURING COMMAND EXECUTION (Attempt {attempt + 1}/{max_retries}) ---\n")
                f.write(f"Exception: {str(e)}\n")
                if debug_enabled:
                    import traceback
                    f.write(f"Traceback:\n{traceback.format_exc()}\n")
            
            last_exception = e
            
            # If this was the last attempt, break and raise
            if attempt == max_retries - 1:
                break
                
            # Wait before retry
            retry_delay = retry_delays[attempt]
            await asyncio.sleep(retry_delay)
    
    # If we get here, all retries failed
    if last_exception:
        with open(status_file, "a") as f:
            f.write(f"\n--- ALL RETRY ATTEMPTS FAILED ---\n")
            f.write(f"Final error: {str(last_exception)}\n")
        raise last_exception


async def upload_uncompressed(task_id: str, service: str, upload_path: str, params: dict, status_file: Path):
    """Uploads the uncompressed files to the remote storage with progress tracking."""
    if service == "gofile":
        with open(status_file, "a") as f:
            f.write("\nUncompressed upload is not supported for gofile.io.\n")
        return
    
    task_download_dir = DOWNLOADS_DIR / task_id
    stats = count_files_in_dir(task_download_dir)
    update_task_status(task_id, {
        "upload_stats": {
            "total_files": stats["count"],
            "total_size": stats["size"],
            "uploaded_files": 0,
            "uploaded_size": 0,
            "percent": 0
        }
    })

    if service == "openlist":
            try:
                openlist_url = params.get("openlist_url") or db_config.get_config("WDM_OPENLIST_URL")
                openlist_user = params.get("openlist_user") or db_config.get_config("WDM_OPENLIST_USER")
                openlist_pass = params.get("openlist_pass") or db_config.get_config("WDM_OPENLIST_PASS")
    
                if not all([openlist_url, openlist_user, openlist_pass, upload_path]):
                    raise openlist.OpenlistError(f"Openlist configuration missing.")
    
                with open(status_file, "a") as f:
                    f.write(f"\n--- Starting Openlist Upload (Uncompressed) ---\n")
                
                token = await asyncio.to_thread(openlist.login, openlist_url, openlist_user, openlist_pass, status_file)
                
                remote_task_dir = upload_path
                await asyncio.to_thread(openlist.create_directory, openlist_url, token, remote_task_dir, status_file)
                
                uploaded_count = 0
                total_uploaded_size = 0
                last_update_time = 0
                
                def format_size(size):
                    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                        if size < 1024.0:
                            return f"{size:.2f} {unit}"
                        size /= 1024.0
                    return f"{size:.2f} PB"

                async def upload_dir_contents(local_dir: Path, remote_dir: str):
                    nonlocal uploaded_count, total_uploaded_size, last_update_time
                    for item in local_dir.iterdir():
                        if item.is_dir():
                            remote_item_path = f"{remote_dir}/{item.name}"
                            await asyncio.to_thread(openlist.create_directory, openlist_url, token, remote_item_path, status_file)
                            await upload_dir_contents(item, remote_item_path)
                        else:
                            file_size = item.stat().st_size
                            def progress_handler(current, total):
                                nonlocal last_update_time
                                now = time.time()
                                if now - last_update_time < 0.5 and current < total:
                                    return
                                last_update_time = now
                                
                                # Total progress calculation
                                current_total_uploaded = total_uploaded_size + current
                                total_percent = int((current_total_uploaded / stats["size"]) * 100) if stats["size"] > 0 else 0
                                file_percent = int((current / total) * 100) if total > 0 else 0
                                
                                update_task_status(task_id, {
                                    "upload_stats": {
                                        "total_files": stats["count"],
                                        "total_size": stats["size"],
                                        "uploaded_files": uploaded_count,
                                        "percent": total_percent,
                                        "file_percent": file_percent,
                                        "current_file": item.name,
                                        "transferred": format_size(current_total_uploaded),
                                        "total": format_size(stats["size"])
                                    }
                                })

                            await asyncio.to_thread(openlist.upload_file, openlist_url, token, item, remote_dir, status_file, progress_handler)
                            
                            uploaded_count += 1
                            total_uploaded_size += file_size
                            
                            # Final update for this file
                            percent = int((uploaded_count / stats["count"]) * 100) if stats["count"] > 0 else 100
                            # Also update total size based percent for consistency
                            total_percent_size = int((total_uploaded_size / stats["size"]) * 100) if stats["size"] > 0 else 100
                            
                            update_task_status(task_id, {
                                "upload_stats": {
                                    "total_files": stats["count"],
                                    "total_size": stats["size"],
                                    "uploaded_files": uploaded_count,
                                    "percent": total_percent_size,
                                    "file_percent": 100,
                                    "current_file": item.name,
                                    "transferred": format_size(total_uploaded_size),
                                    "total": format_size(stats["size"])
                                }
                            })
    
                await upload_dir_contents(task_download_dir, remote_task_dir)
    
                update_task_status(task_id, {"status": "completed"})
                with open(status_file, "a") as f:
                    f.write("\nOpenlist upload completed successfully.\n")
    
            except openlist.OpenlistError as e:
                error_message = f"Openlist upload failed: {e}"
                with open(status_file, "a") as f:
                    f.write(f"\n--- UPLOAD FAILED ---\n{error_message}\n")
                update_task_status(task_id, {"status": "failed", "error": error_message})
            return
    
    rclone_config_path = create_rclone_config(task_id, service, params)
    if not rclone_config_path:
        error_message = f"Failed to create rclone configuration for {service}."
        with open(status_file, "a") as f:
            f.write(f"\n--- UPLOAD FAILED ---\n{error_message}\n")
        update_task_status(task_id, {"status": "failed", "error": error_message})
        return

    remote_full_path = f"remote:{upload_path}"
        
    upload_cmd = (
        f"rclone copy --config \"{rclone_config_path}\" \"{task_download_dir}\" \"{remote_full_path}\" "
        f"-P --stats 1s --log-level=INFO --retries 5"
    )
    if params.get("upload_rate_limit"):
        upload_cmd += f" --bwlimit {params['upload_rate_limit']}"
    await run_command(upload_cmd, upload_cmd, status_file, task_id)


async def compress_in_chunks(task_id: str, source_dir: Path, archive_name_base: str, max_size: int, status_file: Path) -> list[Path]:
    """Compresses files in chunks of a given size in a memory-efficient way."""
    archive_paths = []
    files_to_compress = []
    current_size = 0
    chunk_number = 1
    temp_file_list_path = None

    async def _compress_chunk(chunk_num, file_list_path):
        archive_path = ARCHIVES_DIR / f"{archive_name_base}_{chunk_num}.tar.zst"
        with open(status_file, "a") as f:
            f.write(f"\nCompressing chunk {chunk_num} to {archive_path.name}...\n")
        
        compress_cmd = f"tar -cf - -C \"{source_dir}\" --files-from=\"{file_list_path}\" | zstd -o \"{archive_path}\""
        await run_command(compress_cmd, compress_cmd, status_file, task_id)
        archive_paths.append(archive_path)
        if os.path.exists(file_list_path):
            os.remove(file_list_path)

    try:
        for item in source_dir.rglob("*"):
            if item.is_file():
                file_size = item.stat().st_size
                
                if current_size + file_size > max_size and files_to_compress:
                    temp_file_list_path = STATUS_DIR / f"{task_id}_chunk_{chunk_number}.txt"
                    with open(temp_file_list_path, 'w', encoding='utf-8') as f:
                        for file_path in files_to_compress:
                            f.write(f"{file_path.relative_to(source_dir)}\n")
                    
                    await _compress_chunk(chunk_number, temp_file_list_path)
                    
                    files_to_compress = []
                    current_size = 0
                    chunk_number += 1
                
                files_to_compress.append(item)
                current_size += file_size

        if files_to_compress:
            temp_file_list_path = STATUS_DIR / f"{task_id}_chunk_{chunk_number}.txt"
            with open(temp_file_list_path, 'w', encoding='utf-8') as f:
                for file_path in files_to_compress:
                    f.write(f"{file_path.relative_to(source_dir)}\n")
            
            await _compress_chunk(chunk_number, temp_file_list_path)

    finally:
        if temp_file_list_path and os.path.exists(temp_file_list_path):
            os.remove(temp_file_list_path)

    return archive_paths


async def process_download_job(task_id: str, url: str, downloader: str, service: str, upload_path: str, params: dict, enable_compression: bool = True, split_compression: bool = False, split_size: int = 1000, **kwargs):
    """The main background task for a download job."""
    task_download_dir = DOWNLOADS_DIR / task_id
    archive_name = generate_archive_name(url)
    status_file = STATUS_DIR / f"{task_id}.log"
    upload_log_file = STATUS_DIR / f"{task_id}_upload.log"
    archive_paths = []
    rclone_config_path = None
    
    # Extract site specific options from kwargs or params
    kemono_posts = kwargs.get("kemono_posts") or params.get("kemono_posts")
    kemono_revisions = kwargs.get("kemono_revisions") if "kemono_revisions" in kwargs else (params.get("kemono_revisions") == "true")
    kemono_path_template = kwargs.get("kemono_path_template") if "kemono_path_template" in kwargs else (params.get("kemono_path_template") == "true")
    pixiv_ugoira = kwargs.get("pixiv_ugoira") if "pixiv_ugoira" in kwargs else (params.get("pixiv_ugoira") != "false")
    twitter_retweets = kwargs.get("twitter_retweets") if "twitter_retweets" in kwargs else (params.get("twitter_retweets") == "true")
    twitter_replies = kwargs.get("twitter_replies") if "twitter_replies" in kwargs else (params.get("twitter_replies") == "true")

    try:
        if debug_enabled:
            logger.debug(f"[WORKFLOW] 开始处理任务 {task_id}")
            logger.debug(f"[WORKFLOW] URL: {url}")
            logger.debug(f"[WORKFLOW] 下载器: {downloader}")
            logger.debug(f"[WORKFLOW] 上传服务: {service}")
            logger.debug(f"[WORKFLOW] 上传路径: {upload_path}")
            logger.debug(f"[WORKFLOW] 启用压缩: {enable_compression}")
            logger.debug(f"[WORKFLOW] 分卷压缩: {split_compression}")
            logger.debug(f"[WORKFLOW] 分卷大小: {split_size}MB")
        
        update_task_status(task_id, {"status": "running", "url": url, "downloader": downloader})
        
        with open(status_file, "w") as f:
            f.write(f"Starting job {task_id} for URL: {url}\n")

        proxy = params.get("proxy")
        if params.get("auto_proxy"):
            if debug_enabled:
                logger.debug(f"[WORKFLOW] 启用自动代理选择")
            proxy = await get_working_proxy(status_file)
        
        downloader = params.get("downloader", "gallery-dl")

        # Ensure task_download_dir exists
        task_download_dir.mkdir(parents=True, exist_ok=True)

        if debug_enabled:
            logger.debug(f"[WORKFLOW] 配置下载器: {downloader}")
            logger.debug(f"[WORKFLOW] 代理设置: {proxy if proxy else '无'}")
            logger.debug(f"[WORKFLOW] 速度限制: {params.get('rate_limit', '无')}")

        if downloader == "megadl":
            command = f"megadl --path {task_download_dir}"
            if params.get("rate_limit"):
                # Convert rate limit string to integer for megadl
                rate_limit = params['rate_limit'].strip().upper()
                try:
                    if rate_limit.endswith('K'):
                        bytes_per_second = int(float(rate_limit[:-1]) * 1000)
                    elif rate_limit.endswith('M'):
                        bytes_per_second = int(float(rate_limit[:-1]) * 1000000)
                    elif rate_limit.endswith('G'):
                        bytes_per_second = int(float(rate_limit[:-1]) * 1000000000)
                    else:
                        bytes_per_second = int(float(rate_limit))
                    command += f" --limit-speed {bytes_per_second}"
                except ValueError:
                    # If conversion fails, use original value (will likely fail but preserve error)
                    command += f" --limit-speed {params['rate_limit']}"
            command += f" {url}"
            command_log = command
        else:
            command = f"gallery-dl --verbose -D {task_download_dir}"
            
            # Site Specific Options
            if kemono_posts:
                command += f" -o extractor.kemono.posts={kemono_posts}"
            if kemono_revisions:
                command += " -o extractor.kemono.revisions=true"
            if kemono_path_template:
                command += " -o extractor.kemono.directory=['{username}', '{title}']"
            if pixiv_ugoira is False:
                command += " -o extractor.pixiv.ugoira=false"
            if twitter_retweets:
                command += " -o extractor.twitter.retweets=true"
            if twitter_replies:
                command += " -o extractor.twitter.replies=true"

            # Add custom arguments from database
            extra_args = db_config.get_config("WDM_GALLERY_DL_ARGS", "")
            if extra_args:
                command += f" {extra_args}"
                
            if params.get("deviantart_client_id") and params.get("deviantart_client_secret"):
                command += f" -o extractor.deviantart.client-id={params['deviantart_client_id']} -o extractor.deviantart.client-secret={params['deviantart_client_secret']}"
            if proxy:
                command += f" --proxy {proxy}"
                if params.get("rate_limit"):
                    command += f" --limit-rate {params['rate_limit']}"
            command += f" {url}"

            command_log = f"gallery-dl --verbose -D {task_download_dir}"
            if proxy:
                command_log += f" --proxy {proxy}"
            command_log += f" {url}"
        
        if debug_enabled:
            logger.debug(f"[WORKFLOW] 执行下载命令: {command_log}")
        
        update_task_status(task_id, {"command": command_log})
        await run_command(command, command_log, status_file, task_id)

        if not enable_compression:
            if debug_enabled:
                logger.debug(f"[WORKFLOW] 跳过压缩，直接上传")
            update_task_status(task_id, {"status": "uploading"})
            with open(upload_log_file, "w") as f:
                f.write(f"Starting uncompressed upload for job {task_id}\n")
            await upload_uncompressed(task_id, service, upload_path, params, upload_log_file)
            update_task_status(task_id, {"status": "completed"})
            with open(status_file, "a") as f:
                f.write("\nJob completed successfully (compression disabled).\n")
            with open(upload_log_file, "a") as f:
                f.write("\nUpload completed successfully.\n")
            return

        update_task_status(task_id, {"status": "compressing"})
        
        if debug_enabled:
            logger.debug(f"[WORKFLOW] 开始压缩文件")
            logger.debug(f"[WORKFLOW] 分卷压缩: {split_compression}")
            if split_compression:
                logger.debug(f"[WORKFLOW] 分卷大小: {split_size}MB")
        
        if split_compression:
            archive_paths = await compress_in_chunks(task_id, task_download_dir, archive_name, split_size * 1024 * 1024, status_file)
        else:
            task_archive_path = ARCHIVES_DIR / f"{archive_name}.tar.zst"
            source_to_compress = task_download_dir
            compress_cmd = f"tar -cf - -C \"{source_to_compress}\" . | zstd -o \"{task_archive_path}\""
            await run_command(compress_cmd, compress_cmd, status_file, task_id)
            archive_paths = [task_archive_path]

        if debug_enabled:
            logger.debug(f"[WORKFLOW] 压缩完成，生成 {len(archive_paths)} 个文件")
            for archive_path in archive_paths:
                logger.debug(f"[WORKFLOW] 压缩文件: {archive_path}")

        update_task_status(task_id, {"status": "uploading"})
        if debug_enabled:
            logger.debug(f"[WORKFLOW] 开始上传到 {service}")
        
        with open(upload_log_file, "w") as f:
            f.write(f"Starting upload for job {task_id} to {service}\n")

        # Initialize upload stats
        total_upload_files = len(archive_paths)
        update_task_status(task_id, {
            "upload_stats": {
                "total_files": total_upload_files,
                "uploaded_files": 0,
                "percent": 0
            }
        })

        uploaded_count = 0
        for archive_path in archive_paths:
            if service == "gofile":
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] 使用 gofile.io 上传: {archive_path}")
                gofile_token = params.get("gofile_token") or db_config.get_config("WDM_GOFILE_TOKEN")
                gofile_folder_id = params.get("gofile_folder_id") or db_config.get_config("WDM_GOFILE_FOLDER_ID")
                if gofile_token and not gofile_folder_id:
                    gofile_folder_id = "ad957716-3899-498a-bebc-716f616f9b16"
                download_link = await upload_to_gofile(archive_path, upload_log_file, api_token=gofile_token, folder_id=gofile_folder_id)
                
                uploaded_count += 1
                percent = int((uploaded_count / total_upload_files) * 100)
                update_task_status(task_id, {
                    "status": "completed" if uploaded_count == total_upload_files else "uploading",
                    "gofile_link": download_link,
                    "upload_stats": {
                        "total_files": total_upload_files,
                        "uploaded_files": uploaded_count,
                        "percent": percent
                    }
                })
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] gofile.io 上传完成，链接: {download_link}")

            

            elif service == "openlist":
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] 使用 Openlist 上传: {archive_path}")
                openlist_url = params.get("openlist_url") or db_config.get_config("WDM_OPENLIST_URL")
                openlist_user = params.get("openlist_user") or db_config.get_config("WDM_OPENLIST_USER")
                openlist_pass = params.get("openlist_pass") or db_config.get_config("WDM_OPENLIST_PASS")
                if not all([openlist_url, openlist_user, openlist_pass, upload_path]):
                    raise openlist.OpenlistError("Openlist URL, username, password, and remote path are all required.")
                with open(upload_log_file, "a") as f: f.write(f"\n--- Starting Openlist Upload ---\n")
                token = await asyncio.to_thread(openlist.login, openlist_url, openlist_user, openlist_pass, upload_log_file)
                await asyncio.to_thread(openlist.create_directory, openlist_url, token, upload_path, upload_log_file)
                
                # Initialize tracking variables for archives
                total_archives_size = sum(p.stat().st_size for p in archive_paths)
                total_uploaded_archives_size = 0
                last_update_time = 0
                
                def format_size(size):
                    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                        if size < 1024.0:
                            return f"{size:.2f} {unit}"
                        size /= 1024.0
                    return f"{size:.2f} PB"

                # Single archive upload in openlist (could be multiple if split)
                current_archive_size = archive_path.stat().st_size
                
                def progress_handler(current, total):
                    nonlocal last_update_time
                    now = time.time()
                    if now - last_update_time < 0.5 and current < total:
                        return
                    last_update_time = now
                    
                    # Total progress (considering previously uploaded archives in the loop)
                    # Note: uploaded_count is updated AFTER the file is done in the loop
                    # So current_total includes size of already uploaded files + current progress
                    
                    # We need to calculate size of *previous* archives in this loop
                    # The loop iterates 'archive_paths'. We can use 'uploaded_count' as index if we are careful,
                    # but simpler to just track accumulated size.
                    
                    # Actually, 'uploaded_count' is incremented at the end of loop.
                    # So 'total_uploaded_archives_size' tracks completed files.
                    
                    current_total_uploaded = total_uploaded_archives_size + current
                    total_percent = int((current_total_uploaded / total_archives_size) * 100) if total_archives_size > 0 else 0
                    file_percent = int((current / total) * 100) if total > 0 else 0
                    
                    update_task_status(task_id, {
                        "upload_stats": {
                            "total_files": total_upload_files,
                            "uploaded_files": uploaded_count,
                            "percent": total_percent,
                            "file_percent": file_percent,
                            "current_file": archive_path.name,
                            "transferred": format_size(current_total_uploaded),
                            "total": format_size(total_archives_size)
                        }
                    })

                await asyncio.to_thread(openlist.upload_file, openlist_url, token, archive_path, upload_path, upload_log_file, progress_handler)
                
                total_uploaded_archives_size += current_archive_size
                
                uploaded_count += 1
                percent = int((uploaded_count / total_upload_files) * 100)
                update_task_status(task_id, {
                    "upload_stats": {
                        "total_files": total_upload_files,
                        "uploaded_files": uploaded_count,
                        "percent": percent
                    }
                })
                
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] Openlist 上传完成")
            else:
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] 使用 rclone 上传到 {service}: {archive_path}")
                rclone_config_path = create_rclone_config(task_id, service, params)
                if not rclone_config_path:
                    raise RuntimeError(f"Failed to create rclone configuration for {service}. Please check your settings in the Settings page.")
                
                remote_full_path = f"remote:{upload_path}"
                upload_cmd = (
                    f"rclone copyto --config \"{rclone_config_path}\" \"{archive_path}\" \"{remote_full_path}/{archive_path.name}\" "
                    f"-P --stats 1s --log-level=INFO --retries 5"
                )
                if params.get("upload_rate_limit"):
                    upload_cmd += f" --bwlimit {params['upload_rate_limit']}"
                await run_command(upload_cmd, upload_cmd, upload_log_file, task_id)
                
                uploaded_count += 1
                percent = int((uploaded_count / total_upload_files) * 100)
                update_task_status(task_id, {
                    "upload_stats": {
                        "total_files": total_upload_files,
                        "uploaded_files": uploaded_count,
                        "percent": percent
                    }
                })
                
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] rclone 上传完成")


        with open(status_file, "a") as f:
            f.write("\nJob completed successfully!\n")
        with open(upload_log_file, "a") as f:
            f.write("\nUpload completed successfully!\n")

    except Exception as e:
        error_message = f"An error occurred: {str(e)}"
        with open(status_file, "a") as f:
            f.write(f"\n--- JOB FAILED ---\n{error_message}\n")
        # Also write to upload log if it fails during upload
        if os.path.exists(upload_log_file):
             with open(upload_log_file, "a") as f:
                f.write(f"\n--- UPLOAD FAILED ---\n{error_message}\n")
        update_task_status(task_id, {"status": "failed", "error": error_message})
    finally:
        # --- MEMORY LEAK FIX ---
        # Cleanup all temporary files and directories for this specific task.
        if debug_enabled:
            logger.debug(f"[WORKFLOW] 开始清理任务资源")
        
        with open(status_file, "a") as f:
            f.write("\n--- Cleaning up task resources... ---\n")
        
        # 1. Remove downloaded files
        if os.path.exists(task_download_dir):
            if debug_enabled:
                logger.debug(f"[WORKFLOW] 删除下载目录: {task_download_dir}")
            shutil.rmtree(task_download_dir)
            with open(status_file, "a") as f: f.write(f"Removed directory: {task_download_dir}\n")

        # 2. Remove created archives
        for archive_path in archive_paths:
            if os.path.exists(archive_path):
                if debug_enabled:
                    logger.debug(f"[WORKFLOW] 删除压缩文件: {archive_path}")
                os.remove(archive_path)
                with open(status_file, "a") as f: f.write(f"Removed archive: {archive_path}\n")

        # 3. Remove temporary rclone config
        if rclone_config_path and os.path.exists(rclone_config_path):
            if debug_enabled:
                logger.debug(f"[WORKFLOW] 删除 rclone 配置: {rclone_config_path}")
            os.remove(rclone_config_path)
            with open(status_file, "a") as f: f.write(f"Removed rclone config: {rclone_config_path}\n")
        
        with open(status_file, "a") as f: f.write("Cleanup complete.\n")
        
        if debug_enabled:
            logger.debug(f"[WORKFLOW] 任务 {task_id} 清理完成")