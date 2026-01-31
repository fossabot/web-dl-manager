import requests
import os
import urllib.parse
import time
from pathlib import Path

class OpenlistError(Exception):
    """Custom exception for Openlist operations."""
    pass

def _log(status_file: Path, message: str):
    """Appends a message to the status log file if provided."""
    if status_file:
        with open(status_file, "a", encoding="utf-8") as f:
            f.write(message + "\n")

def login(base_url: str, username: str, password: str, status_file: Path = None) -> str:
    """
    Logs in to get a token.
    """
    _log(status_file, "Attempting to log in to Openlist...")
    url = base_url.rstrip('/') + '/api/auth/login'
    data = {'username': username, 'password': password}
    try:
        resp = requests.post(url, json=data, timeout=10)
        resp.raise_for_status()
        resp_json = resp.json()
        if resp_json.get('code') == 200:
            token = resp_json.get('data', {}).get('token')
            if not token:
                _log(status_file, "Openlist login successful, but no token found in response.")
                raise OpenlistError("Login successful, but token not found in response.")
            _log(status_file, "Successfully logged in to Openlist.")
            return token
        else:
            message = resp_json.get('message', 'Unknown error')
            _log(status_file, f"Openlist login failed (API error): {message}")
            raise OpenlistError(f"Login API returned an error: {message}")
    except requests.RequestException as e:
        _log(status_file, f"Openlist login request failed: {e}")
        raise OpenlistError(f"Login request failed: {e}")
    except ValueError:
        _log(status_file, f"Failed to decode JSON from Openlist login response: {resp.text}")
        raise OpenlistError(f"Login response was not valid JSON: {resp.text}")

def create_directory(base_url: str, token: str, remote_dir: str, status_file: Path = None):
    """
    Creates a remote directory. Ignores 400 if it already exists.
    """
    _log(status_file, f"Attempting to create remote directory: {remote_dir}")
    url = base_url.rstrip('/') + '/api/fs/mkdir'
    headers = {'Authorization': token, 'Content-Type': 'application/json'}
    data = {'path': remote_dir.rstrip('/')}
    try:
        resp = requests.post(url, json=data, headers=headers, timeout=10)
        resp_json = resp.json()
        if resp.status_code == 200 and resp_json.get('code') == 200:
            _log(status_file, "Remote directory created successfully.")
        elif resp.status_code == 400 and "exist" in resp_json.get('message', ''):
            _log(status_file, "Remote directory already exists, ignoring.")
        else:
            message = resp_json.get('message', resp.text)
            _log(status_file, f"Failed to create remote directory: {message}")
            raise OpenlistError(f"Failed to create directory: {message}")
    except requests.RequestException as e:
        _log(status_file, f"Request to create remote directory failed: {e}")
        raise OpenlistError(f"Directory creation request failed: {e}")

def list_files(base_url: str, token: str, remote_dir: str, status_file: Path = None) -> list:
    """
    Lists files in a remote directory.
    """
    _log(status_file, f"Listing files in remote directory: {remote_dir}")
    url = base_url.rstrip('/') + '/api/fs/list'
    headers = {'Authorization': token, 'Content-Type': 'application/json'}
    data = {'path': remote_dir, 'per_page': 0} # per_page=0 to get all items
    try:
        resp = requests.post(url, json=data, headers=headers, timeout=30)
        resp.raise_for_status()
        resp_json = resp.json()
        if resp_json.get('code') == 200:
            content = resp_json.get('data', {}).get('content', [])
            return [item['name'] for item in content] if content else []
        else:
            message = resp_json.get('message', 'Unknown error')
            _log(status_file, f"Failed to list files: {message}")
            raise OpenlistError(f"Failed to list files: {message}")
    except requests.RequestException as e:
        _log(status_file, f"Request to list files failed: {e}")
        raise OpenlistError(f"File listing request failed: {e}")

class ProgressFileReader:
    def __init__(self, filename, callback=None):
        self._f = open(filename, 'rb')
        self._callback = callback
        self._total_size = os.path.getsize(filename)
        self._read_so_far = 0

    def read(self, size=-1):
        data = self._f.read(size)
        if data:
            self._read_so_far += len(data)
            if self._callback:
                self._callback(self._read_so_far, self._total_size)
        return data

    def __getattr__(self, name):
        return getattr(self._f, name)
    
    def __len__(self):
        return self._total_size

    def close(self):
        if self._f:
            self._f.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

def upload_file(base_url: str, token: str, local_file: Path, remote_dir: str, status_file: Path = None, progress_callback=None) -> str:
    """
    Uploads a file using the /api/fs/put endpoint with retries.
    """
    filename = os.path.basename(local_file)
    full_path = f"{remote_dir.rstrip('/')}/{filename}"

    # Check if file exists
    try:
        remote_files = list_files(base_url, token, remote_dir, status_file)
        if filename in remote_files:
            _log(status_file, f"File '{filename}' already exists in '{remote_dir}', skipping upload.")
            if progress_callback:
                file_size = os.path.getsize(local_file)
                progress_callback(file_size, file_size) # Mark as 100%
            return full_path
    except OpenlistError as e:
        _log(status_file, f"Could not verify file existence, proceeding with upload anyway: {e}")

    _log(status_file, f"Starting upload of '{filename}' to '{full_path}'...")

    url = base_url.rstrip('/') + '/api/fs/put'
    encoded_path = urllib.parse.quote(full_path)
    headers = {
        'Authorization': token,
        'File-Path': encoded_path,
        'Content-Type': 'application/octet-stream',
        'As-Task': 'false'
    }

    last_exception = None
    for attempt in range(50):
        try:
            with ProgressFileReader(local_file, progress_callback) as f:
                resp = requests.put(url, data=f, headers=headers, timeout=300)

            resp.raise_for_status()
            resp_json = resp.json()

            if resp_json.get('code') == 200:
                _log(status_file, f"Successfully uploaded '{filename}' on attempt {attempt + 1}.")
                return full_path
            else:
                message = resp_json.get('message', 'Unknown error')
                _log(status_file, f"Upload attempt {attempt + 1}/50 failed for '{filename}': {message}")
                last_exception = OpenlistError(f"Upload API returned an error: {message}")

        except requests.RequestException as e:
            _log(status_file, f"Upload attempt {attempt + 1}/50 failed for '{filename}': {e}")
            last_exception = OpenlistError(f"Upload request failed: {e}")
        except ValueError:
            _log(status_file, f"Upload attempt {attempt + 1}/50 failed for '{filename}' (invalid JSON response): {resp.text}")
            last_exception = OpenlistError(f"Upload response was not valid JSON: {resp.text}")
        except IOError as e:
            _log(status_file, f"Failed to read local file '{local_file}': {e}")
            raise OpenlistError(f"Failed to read local file '{local_file}': {e}") # Do not retry on file read errors

        # Wait before retrying
        time.sleep(5)

    _log(status_file, f"All 50 upload attempts failed for '{filename}'.")
    # Return the path even if upload failed after 50 attempts, so that other files can continue uploading
    return full_path