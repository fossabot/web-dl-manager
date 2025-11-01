import requests
import os
import urllib.parse
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

def upload_file(base_url: str, token: str, local_file: Path, remote_dir: str, status_file: Path = None) -> str:
    """
    Uploads a file using the /api/fs/put endpoint.
    """
    filename = os.path.basename(local_file)
    full_path = f"{remote_dir.rstrip('/')}/{filename}"
    _log(status_file, f"Starting upload of '{filename}' to '{full_path}'...")
    
    url = base_url.rstrip('/') + '/api/fs/put'
    encoded_path = urllib.parse.quote(full_path)
    headers = {
        'Authorization': token,
        'File-Path': encoded_path,
        'Content-Type': 'application/octet-stream',
        'As-Task': 'false'
    }
    
    try:
        with open(local_file, 'rb') as f:
            resp = requests.put(url, data=f, headers=headers, timeout=300) # Increased timeout for upload

        resp.raise_for_status()
        resp_json = resp.json()

        if resp_json.get('code') == 200:
            _log(status_file, f"Successfully uploaded '{filename}'.")
            return full_path
        else:
            message = resp_json.get('message', 'Unknown error')
            _log(status_file, f"Upload API returned an error for '{filename}': {message}")
            raise OpenlistError(f"Upload API returned an error: {message}")
            
    except requests.RequestException as e:
        _log(status_file, f"Upload request failed for '{filename}': {e}")
        raise OpenlistError(f"Upload request failed: {e}")
    except ValueError:
        _log(status_file, f"Failed to decode JSON from upload response for '{filename}': {resp.text}")
        raise OpenlistError(f"Upload response was not valid JSON: {resp.text}")
    except IOError as e:
        _log(status_file, f"Failed to read local file '{local_file}': {e}")
        raise OpenlistError(f"Failed to read local file '{local_file}': {e}")

def verify_upload(base_url: str, token: str, remote_path: str, status_file: Path = None) -> bool:
    """
    Verifies if a file was uploaded successfully.
    """
    _log(status_file, f"Verifying remote file: {remote_path}")
    url = base_url.rstrip('/') + '/api/fs/get'
    data = {'path': remote_path}
    headers = {'Authorization': token}
    try:
        resp = requests.post(url, json=data, headers=headers, timeout=10)
        resp_json = resp.json()
        if resp_json.get('code') == 200 and resp_json.get('data') is not None:
            _log(status_file, f"Verification successful for: {resp_json['data']['name']}")
            return True
        else:
            message = resp_json.get('message', resp_json)
            _log(status_file, f"Verification failed: {message}")
            return False
    except requests.RequestException as e:
        _log(status_file, f"Verification request failed: {e}")
        raise OpenlistError(f"Verification request failed: {e}")

# --- Main execution block for testing ---
if __name__ == "__main__":
    # This block is for standalone testing and will not run when imported.
    print("Running Openlist client in standalone test mode.")
    
    # --- Configuration (replace with your details) ---
    BASE_URL = ''      # e.g., 'http://127.0.0.1:5244'
    USERNAME = ''      # Your Openlist/Alist username
    PASSWORD = ''      # Your Openlist/Alist password
    LOCAL_FILE = 'example.txt'
    REMOTE_DIR = '' # e.g., '/test_uploads'

    if not all([BASE_URL, USERNAME, PASSWORD, REMOTE_DIR]):
        print("[ERROR] Please fill in BASE_URL, USERNAME, PASSWORD, and REMOTE_DIR in the if __name__ == '__main__' block.")
        exit(1)

    # Create a dummy test file
    try:
        with open(LOCAL_FILE, 'w', encoding='utf-8') as f:
            f.write(f"This is a test file for Openlist upload.\n")
        print(f"Created local test file: '{LOCAL_FILE}'")
    except IOError as e:
        print(f"Could not create test file: {e}")
        exit(1)

    try:
        print(f"Attempting to log in to {BASE_URL}...")
        token = login(BASE_URL, USERNAME, PASSWORD)
        print(f"Successfully got token: ...{token[-6:]}")
        
        print(f"Creating remote directory: {REMOTE_DIR}")
        create_directory(BASE_URL, token, REMOTE_DIR)
        
        print(f"Uploading '{LOCAL_FILE}' to '{REMOTE_DIR}'...")
        uploaded_path = upload_file(BASE_URL, token, Path(LOCAL_FILE), REMOTE_DIR)
        print(f"Upload command finished. Theoretical path: {uploaded_path}")
        
        print("Verifying upload...")
        if verify_upload(BASE_URL, token, uploaded_path):
            print("\n[SUCCESS] File upload completed and verified!")
        else:
            print("\n[FAILURE] Upload command sent, but verification failed.")
            
    except OpenlistError as e:
        print(f"\n[ERROR] An operation failed: {e}")
    except Exception as e:
        print(f"\n[CRITICAL ERROR] An unexpected error occurred: {e}")