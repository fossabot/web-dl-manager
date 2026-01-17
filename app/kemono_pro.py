import os
import asyncio
import shutil
import logging
from pathlib import Path
from typing import Optional

from .database import db_config
from .config import DOWNLOADS_DIR, STATUS_DIR
from .utils import (
    update_task_status, 
    sanitize_filename, 
    download_file, 
    API_BASE_URL
)

# 获取logger
logger = logging.getLogger(__name__)

async def fetch_kemono_posts(service: str, user_id: str, session):
    """Asynchronously fetch all post metadata for a creator using cloudscraper."""
    all_posts, offset = [], 0
    api_url = f"{API_BASE_URL}/{service}/user/{user_id}/posts"
    
    while True:
        success = False
        for attempt in range(5):
            try:
                request_url = f"{api_url}?o={offset}"
                response = await asyncio.to_thread(session.get, request_url, timeout=30)
                response.raise_for_status()
                data = response.json()
                posts_chunk = data if isinstance(data, list) else data.get('results', [])
                if not isinstance(posts_chunk, list) or not posts_chunk:
                    return all_posts
                all_posts.extend(posts_chunk)
                offset += len(posts_chunk)
                success = True
                if len(posts_chunk) < 50:
                    return all_posts
                break
            except Exception as e:
                logger.error(f"[KemonoPro] Attempt {attempt+1} failed for offset {offset}: {e}")
                if attempt < 4:
                    await asyncio.sleep(5 * (attempt + 1))
                else:
                    return all_posts
        if not success:
            break
    return all_posts

async def process_kemono_pro_job(task_id: str, service: str, creator_id: str, upload_service: str, upload_path: str, params: dict, cookies: Optional[str] = None, kemono_username: Optional[str] = None, kemono_password: Optional[str] = None):
    """Main background task for Kemono DL Pro."""
    import cloudscraper
    # Avoid circular imports by importing tasks here
    from .tasks import task_semaphore, upload_uncompressed
    
    async with task_semaphore:
        task_download_dir = DOWNLOADS_DIR / task_id
        task_download_dir.mkdir(parents=True, exist_ok=True)
        status_file = STATUS_DIR / f"{task_id}.log"
        upload_log_file = STATUS_DIR / f"{task_id}_upload.log"
        
        update_task_status(task_id, {"status": "running", "url": f"{service}/{creator_id} (Pro)"})
        
        try:
            # Use a more realistic browser emulation
            scraper = cloudscraper.create_scraper(
                browser={
                    'browser': 'chrome',
                    'platform': 'windows',
                    'desktop': True
                }
            )
            # Add standard browser headers
            scraper.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                'Referer': 'https://kemono.cr/artists',
                'Accept': 'application/json, text/plain, */*'
            })

            if cookies:
                try:
                    cookie_dict = {}
                    for cookie in cookies.split(';'):
                        if '=' in cookie:
                            name, value = cookie.strip().split('=', 1)
                            cookie_dict[name] = value
                    scraper.cookies.update(cookie_dict)
                    with open(status_file, "a") as f: f.write(f"Injected {len(cookie_dict)} cookies from form.\n")
                except Exception as e:
                    logger.error(f"[KemonoPro] Failed to parse cookies: {e}")

            # 2. Perform Login if credentials provided and session not yet valid
            if kemono_username and kemono_password and not scraper.cookies.get('session'):
                try:
                    with open(status_file, "a") as f: f.write(f"Attempting automatic login for user: {kemono_username}...\n")
                    login_url = f"{API_BASE_URL}/authentication/login"
                    login_data = {"username": kemono_username, "password": kemono_password}
                    
                    response = await asyncio.to_thread(scraper.post, login_url, json=login_data, timeout=30)
                    response.raise_for_status()
                    
                    if scraper.cookies.get('session'):
                        session_cookie = scraper.cookies.get('session')
                        with open(status_file, "a") as f: f.write(f"Automatic login successful! Session cookie obtained.\n")
                    else:
                        with open(status_file, "a") as f: f.write("Login request sent, but no 'session' cookie received.\n")
                except Exception as e:
                    with open(status_file, "a") as f: f.write(f"Automatic login failed: {str(e)}\n")
            
            posts = await fetch_kemono_posts(service, creator_id, scraper)
            
            with open(status_file, "w") as f:
                f.write(f"Kemono Pro: Found {len(posts)} posts for {service}/{creator_id}\n")
            
            tasks_to_download = []
            
            for post in posts:
                post_title = sanitize_filename(post.get('title', 'untitled'))
                post_date = (post.get('published') or '0000-00-00').split('T')[0]
                
                for attachment in post.get('attachments', []):
                    filename = sanitize_filename(attachment.get('name'))
                    filepath = attachment.get('path')
                    if filename and filepath:
                        # Target structure: [Date] [Title]--Filename
                        # Limit title length to avoid path length issues
                        truncated_title = post_title[:50]
                        final_name = f"[{post_date}] [{truncated_title}]--{filename}"
                        
                        # Try coomer.su first, then kemono.cr for downloads
                        tasks_to_download.append({
                            "url": "https://coomer.su" + filepath,
                            "fallback_url": "https://kemono.cr" + filepath,
                            "dest": task_download_dir / final_name
                        })
            
            total_files = len(tasks_to_download)
            update_task_status(task_id, {"total_files": total_files})
            
            completed_count = 0
            for dl_task in tasks_to_download:
                success = await asyncio.to_thread(download_file, dl_task["url"], dl_task["dest"], scraper)
                if not success:
                    # Try fallback
                    success = await asyncio.to_thread(download_file, dl_task["fallback_url"], dl_task["dest"], scraper)
                
                completed_count += 1
                update_task_status(task_id, {"progress_count": f"{completed_count}/{total_files}"})
                with open(status_file, "a") as f:
                    status_msg = "Success" if success else "Failed"
                    f.write(f"[{completed_count}/{total_files}] Download {dl_task['dest'].name}: {status_msg}\n")

            # Upload
            update_task_status(task_id, {"status": "uploading"})
            await upload_uncompressed(task_id, upload_service, upload_path, params, upload_log_file)
            update_task_status(task_id, {"status": "completed"})
            
        except Exception as e:
            error_msg = f"Kemono Pro failed: {str(e)}"
            logger.error(error_msg)
            update_task_status(task_id, {"status": "failed", "error": error_msg})
            with open(status_file, "a") as f:
                f.write(f"\n[ERROR] {error_msg}\n")
        finally:
            if os.path.exists(task_download_dir):
                shutil.rmtree(task_download_dir)