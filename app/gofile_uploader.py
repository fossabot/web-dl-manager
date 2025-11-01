import httpx
import random
from pathlib import Path
from typing import Optional, List, Dict

async def upload_to_gofile(file_path: Path, status_file: Path, api_token: Optional[str] = None, folder_id: Optional[str] = None) -> str:
    """
    Uploads a file to gofile.io, using the correct server-specific endpoint for both authenticated and public uploads.
    """

    async def _attempt_upload(use_token: bool, servers: List[Dict]):
        """Internal helper to attempt an upload by iterating through available servers."""
        upload_type = "authenticated" if use_token and api_token else "public"
        with open(status_file, "a") as f:
            f.write(f"Attempting {upload_type} upload...\n")

        # Both authenticated and public uploads must iterate through available servers.
        for server in servers:
            server_name = server["name"]
            upload_url = f"https://{server_name}.gofile.io/uploadFile"
            
            with open(status_file, "a") as f:
                f.write(f"Trying {upload_type} upload via server: {server_name}...\n")

            try:
                async with httpx.AsyncClient(timeout=300) as client:
                    form_data = {}
                    if use_token and api_token:
                        form_data['token'] = api_token
                        if folder_id:
                            form_data['folderId'] = folder_id
                    
                    # Re-open the file for each attempt, as the file handle might be consumed on a failed post.
                    with open(file_path, "rb") as f_upload:
                        files = {'file': (file_path.name, f_upload, "application/octet-stream")}
                        # Pass form_data only if it's populated.
                        response = await client.post(upload_url, data=form_data or None, files=files)
                    
                    response.raise_for_status()
                    upload_result = response.json()

                    if upload_result.get("status") == "ok":
                        download_link = upload_result["data"]["downloadPage"]
                        with open(status_file, "a") as f:
                            f.write(f"Gofile.io {upload_type} upload successful on server {server_name}! Link: {download_link}\n")
                        return download_link
                    else:
                        with open(status_file, "a") as f:
                            f.write(f"Gofile API returned an error on {upload_type} upload to {server_name}: {upload_result}. Trying next server...\n")
                        continue
            except Exception as e:
                with open(status_file, "a") as f:
                    f.write(f"An exception occurred during {upload_type} upload to {server_name}: {e}. Trying next server...\n")
                continue
        
        # If the loop finishes without returning, all servers failed for this upload type.
        with open(status_file, "a") as f:
            f.write(f"All Gofile servers failed for {upload_type} upload.\n")
        return None

    # --- Main logic ---

    # 1. Fetch the server list first, as it's required for ALL upload types.
    servers = []
    try:
        with open(status_file, "a") as f:
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
        with open(status_file, "a") as f:
            f.write(f"{error_message}\n")
        raise Exception(error_message)

    # 2. Attempt authenticated upload if a token is provided.
    download_link = None
    if api_token:
        download_link = await _attempt_upload(use_token=True, servers=servers)

    # 3. If authenticated upload failed or was skipped, attempt public upload as a fallback.
    if not download_link:
        if api_token:
            with open(status_file, "a") as f:
                f.write("Authenticated upload failed. Falling back to public upload.\n")
        download_link = await _attempt_upload(use_token=False, servers=servers)

    # 4. If all attempts have failed, raise a final exception.
    if not download_link:
        raise Exception("Gofile.io upload failed completely after trying all available servers and fallback options.")

    return download_link