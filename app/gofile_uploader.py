import httpx
import random
from pathlib import Path
from typing import Optional

async def upload_to_gofile(file_path: Path, status_file: Path, api_token: Optional[str] = None, folder_id: Optional[str] = None) -> str:
    """Uploads a file to gofile.io, using the correct endpoint for auth vs public."""

    async def _attempt_upload(use_token: bool):
        upload_type = "authenticated" if use_token and api_token else "public"
        with open(status_file, "a") as f:
            f.write(f"Attempting {upload_type} upload...\n")

        async with httpx.AsyncClient(timeout=300) as client:
            if use_token and api_token:
                # For authenticated uploads, use the generic endpoint.
                upload_url = "https://upload.gofile.io/uploadFile"
                with open(status_file, "a") as f:
                    f.write(f"Using generic authenticated endpoint: {upload_url}\n")
                
                try:
                    form_data = {'token': api_token}
                    if folder_id:
                        form_data['folderId'] = folder_id

                    with open(file_path, "rb") as f_upload:
                        files = {'file': (file_path.name, f_upload, "application/octet-stream")}
                        response = await client.post(upload_url, data=form_data, files=files)
                    
                    response.raise_for_status()
                    upload_result = response.json()

                    if upload_result["status"] == "ok":
                        download_link = upload_result["data"]["downloadPage"]
                        with open(status_file, "a") as f:
                            f.write(f"Gofile.io authenticated upload successful! Link: {download_link}\n")
                        return download_link
                    else:
                        with open(status_file, "a") as f:
                            f.write(f"Gofile API returned an error on authenticated upload: {upload_result}\n")
                        return None
                except Exception as e:
                    with open(status_file, "a") as f:
                        f.write(f"An exception occurred during authenticated upload: {e}\n")
                    return None
            else:
                # For public uploads, use the server-switching logic.
                try:
                    with open(status_file, "a") as f:
                        f.write("Fetching Gofile server list for public upload...\n")
                    servers_res = await client.get("https://api.gofile.io/servers")
                    servers_res.raise_for_status()
                    servers = servers_res.json()["data"]["servers"]
                    random.shuffle(servers)
                except Exception as e:
                    with open(status_file, "a") as f:
                        f.write(f"FATAL: Could not fetch Gofile server list: {e}\n")
                    return None

                for server in servers:
                    server_name = server["name"]
                    upload_url = f"https://{server_name}.gofile.io/uploadFile"
                    with open(status_file, "a") as f:
                        f.write(f"Trying public upload via server: {server_name}...\n")
                    try:
                        with open(file_path, "rb") as f_upload:
                            files = {"file": (file_path.name, f_upload, "application/octet-stream")}
                            response = await client.post(upload_url, files=files)
                        response.raise_for_status()
                        upload_result = response.json()

                        if upload_result["status"] == "ok":
                            download_link = upload_result["data"]["downloadPage"]
                            with open(status_file, "a") as f:
                                f.write(f"Gofile.io public upload successful on server {server_name}! Link: {download_link}\n")
                            return download_link
                    except Exception as e:
                        with open(status_file, "a") as f:
                            f.write(f"An exception occurred during public upload to {server_name}: {e}. Trying next server...\n")
                        continue
                
                with open(status_file, "a") as f:
                    f.write("All Gofile servers failed for public upload.\n")
                return None

    # --- Main logic ---
    download_link = None
    if api_token:
        download_link = await _attempt_upload(use_token=True)

    if not download_link:
        if api_token:
            with open(status_file, "a") as f:
                f.write("Authenticated upload failed. Falling back to public upload.\n")
        download_link = await _attempt_upload(use_token=False)

    if not download_link:
        raise Exception("Gofile.io upload failed completely after trying all servers and fallback options.")

    return download_link
