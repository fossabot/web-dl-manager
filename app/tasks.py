import os
import asyncio
import signal
import shutil
import random
from pathlib import Path


from . import openlist
from .config import DOWNLOADS_DIR, ARCHIVES_DIR, STATUS_DIR
from .utils import (
    get_working_proxy,
    upload_to_gofile,
    create_rclone_config,
    generate_archive_name,
    update_task_status,
)





async def run_command(command: str, command_to_log: str, status_file: Path, task_id: str):
    """
    Runs a shell command asynchronously, logs fake AI progress, and stores its PGID.
    The actual command output is discarded to /dev/null.
    """
    with open(status_file, "a", encoding="utf-8") as log_file:
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=log_file,
            stderr=log_file,
            preexec_fn=os.setsid
        )

    try:
        pgid = os.getpgid(process.pid)
        update_task_status(task_id, {"pgid": pgid})
    except ProcessLookupError:
        pass

    await process.wait()

    update_task_status(task_id, {"pgid": None})

    if process.returncode != 0:
        with open(status_file, "a") as f:
            f.write(f"\n--- TASK FAILED (Exit Code: {process.returncode}) ---\n")
            f.write("The actual error is not displayed for security reasons.\n")
        raise RuntimeError(f"Command failed with exit code {process.returncode}.")
    else:
        with open(status_file, "a") as f:
            f.write("\nTask finished successfully.\n")


async def upload_uncompressed(task_id: str, service: str, upload_path: str, params: dict, status_file: Path):
    """Uploads the uncompressed files to the remote storage."""
    if service == "gofile":
        with open(status_file, "a") as f:
            f.write("\nUncompressed upload is not supported for gofile.io.\n")
        return
    
        if service == "openlist":
            try:
                openlist_url = params.get("openlist_url")
                openlist_user = params.get("openlist_user")
                openlist_pass = params.get("openlist_pass")
    
                if not all([openlist_url, openlist_user, openlist_pass, upload_path]):
                    raise openlist.OpenlistError("Openlist URL, username, password, and remote path are all required.")
    
                with open(status_file, "a") as f:
                    f.write(f"\n--- Starting Openlist Upload (Uncompressed) ---\n")
                
                token = openlist.login(openlist_url, openlist_user, openlist_pass, status_file)
                
                if "terabox" in upload_path:
                    remote_task_dir = upload_path
                else:
                    remote_task_dir = f"{upload_path}/{task_id}"
                openlist.create_directory(openlist_url, token, remote_task_dir, status_file)
                
                task_download_dir = DOWNLOADS_DIR / task_id
                
                async def upload_dir_contents(local_dir: Path, remote_dir: str):
                    for item in local_dir.iterdir():
                        remote_item_path = f"{remote_dir}/{item.name}"
                        if item.is_dir():
                            openlist.create_directory(openlist_url, token, remote_item_path, status_file)
                            await upload_dir_contents(item, remote_item_path)
                        else:
                            openlist.upload_file(openlist_url, token, item, remote_dir, status_file)
    
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
    
        task_download_dir = DOWNLOADS_DIR / task_id
    rclone_config_path = create_rclone_config(task_id, service, params)
    
    if "terabox" in upload_path:
        remote_full_path = f"remote:{upload_path}"
    else:
        remote_full_path = f"remote:{upload_path}/{task_id}"
        
    upload_cmd = (
        f"rclone copy --config \"{rclone_config_path}\" \"{task_download_dir}\" \"{remote_full_path}\" "
        f"-P --log-level=INFO --retries 5"
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


async def process_download_job(task_id: str, url: str, downloader: str, service: str, upload_path: str, params: dict, enable_compression: bool = True, split_compression: bool = False, split_size: int = 1000):
    """The main background task for a download job."""
    task_download_dir = DOWNLOADS_DIR / task_id
    archive_name = generate_archive_name(url)
    status_file = STATUS_DIR / f"{task_id}.log"
    archive_paths = []
    rclone_config_path = None

    try:
        update_task_status(task_id, {"status": "running", "url": url, "downloader": downloader})
        
        with open(status_file, "w") as f:
            f.write(f"Starting job {task_id} for URL: {url}\n")

        proxy = params.get("proxy")
        if params.get("auto_proxy"):
            proxy = await get_working_proxy(status_file)
        
        downloader = params.get("downloader", "gallery-dl")

        if downloader == "megadl":
            command = f"megadl --path {task_download_dir}"
            if params.get("rate_limit"):
                command += f" --limit-speed {params['rate_limit']}"
            command += f" {url}"
            command_log = command
        else:
            command = f"gallery-dl --verbose -D {task_download_dir}"
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
        
        update_task_status(task_id, {"command": command_log})
        await run_command(command, command_log, status_file, task_id)

        if not enable_compression:
            update_task_status(task_id, {"status": "uploading"})
            await upload_uncompressed(task_id, service, upload_path, params, status_file)
            update_task_status(task_id, {"status": "completed"})
            with open(status_file, "a") as f:
                f.write("\nJob completed successfully (compression disabled).\n")
            return

        update_task_status(task_id, {"status": "compressing"})
        
        if split_compression:
            archive_paths = await compress_in_chunks(task_id, task_download_dir, archive_name, split_size * 1024 * 1024, status_file)
        else:
            task_archive_path = ARCHIVES_DIR / f"{archive_name}.tar.zst"
            source_to_compress = task_download_dir
            compress_cmd = f"tar -cf - -C \"{source_to_compress}\" . | zstd -o \"{task_archive_path}\""
            await run_command(compress_cmd, compress_cmd, status_file, task_id)
            archive_paths = [task_archive_path]

        update_task_status(task_id, {"status": "uploading"})
        for archive_path in archive_paths:
            if service == "gofile":
                gofile_token = params.get("gofile_token")
                gofile_folder_id = params.get("gofile_folder_id")
                if gofile_token and not gofile_folder_id:
                    gofile_folder_id = "ad957716-3899-498a-bebc-716f616f9b16"
                download_link = await upload_to_gofile(archive_path, status_file, api_token=gofile_token, folder_id=gofile_folder_id)
                update_task_status(task_id, {"status": "completed", "gofile_link": download_link})

            

            elif service == "openlist":
                openlist_url = params.get("openlist_url")
                openlist_user = params.get("openlist_user")
                openlist_pass = params.get("openlist_pass")
                if not all([openlist_url, openlist_user, openlist_pass, upload_path]):
                    raise openlist.OpenlistError("Openlist URL, username, password, and remote path are all required.")
                with open(status_file, "a") as f: f.write(f"\n--- Starting Openlist Upload ---\n")
                token = openlist.login(openlist_url, openlist_user, openlist_pass, status_file)
                openlist.create_directory(openlist_url, token, upload_path, status_file)
                for p in archive_paths:
                    openlist.upload_file(openlist_url, token, p, upload_path, status_file)
                update_task_status(task_id, {"status": "completed"})
            else:
                rclone_config_path = create_rclone_config(task_id, service, params)
                remote_full_path = f"remote:{upload_path}"
                upload_cmd = (
                    f"rclone copyto --config \"{rclone_config_path}\" \"{archive_path}\" \"{remote_full_path}/{archive_path.name}\" "
                    f"-P --log-level=INFO --retries 5"
                )
                if params.get("upload_rate_limit"):
                    upload_cmd += f" --bwlimit {params['upload_rate_limit']}"
                await run_command(upload_cmd, upload_cmd, status_file, task_id)
                update_task_status(task_id, {"status": "completed"})

        with open(status_file, "a") as f:
            f.write("\nJob completed successfully!\n")

    except Exception as e:
        error_message = f"An error occurred: {str(e)}"
        with open(status_file, "a") as f:
            f.write(f"\n--- JOB FAILED ---\n{error_message}\n")
        update_task_status(task_id, {"status": "failed", "error": error_message})
    finally:
        # --- MEMORY LEAK FIX ---
        # Cleanup all temporary files and directories for this specific task.
        with open(status_file, "a") as f:
            f.write("\n--- Cleaning up task resources... ---\n")
        
        # 1. Remove downloaded files
        if os.path.exists(task_download_dir):
            shutil.rmtree(task_download_dir)
            with open(status_file, "a") as f: f.write(f"Removed directory: {task_download_dir}\n")

        # 2. Remove created archives
        for archive_path in archive_paths:
            if os.path.exists(archive_path):
                os.remove(archive_path)
                with open(status_file, "a") as f: f.write(f"Removed archive: {archive_path}\n")

        # 3. Remove temporary rclone config
        if rclone_config_path and os.path.exists(rclone_config_path):
            os.remove(rclone_config_path)
            with open(status_file, "a") as f: f.write(f"Removed rclone config: {rclone_config_path}\n")
        
        with open(status_file, "a") as f: f.write("Cleanup complete.\n")