import os
import sys
import signal
import subprocess
import json
from pathlib import Path
from datetime import datetime
import httpx

# --- Configuration ---
OWNER = "Jyf0214"
REPO = "gallery-dl-web"
BRANCH = "main"
BASE_DIR = Path(__file__).resolve().parent.parent
VERSION_INFO_FILE = BASE_DIR / ".version_info"
CHANGELOG_FILE = BASE_DIR / "CHANGELOG.md"
REQUIREMENTS_FILE = BASE_DIR / "app" / "requirements.txt"

# --- Helper Functions ---
def log(message: str):
    """Prints a message to stdout."""
    print(f"[Updater] {message}", flush=True)

def get_api_headers():
    """Returns headers for GitHub API requests, using a token if available."""
    headers = {"Accept": "application/vnd.github.v3+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    return headers

def get_latest_commit_sha() -> str:
    """Fetches the SHA of the latest commit from the specified branch."""
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/commits/{BRANCH}"
    with httpx.Client() as client:
        response = client.get(url, headers=get_api_headers())
        response.raise_for_status()
        return response.json()["sha"]

def get_local_commit_sha() -> str | None:
    """Reads the currently installed commit SHA from the version info file."""
    if not VERSION_INFO_FILE.exists():
        return None
    return VERSION_INFO_FILE.read_text().strip()

def store_commit_sha(sha: str):
    """Stores the given commit SHA in the version info file."""
    VERSION_INFO_FILE.write_text(sha)

def get_file_tree(commit_sha: str) -> list:
    """Gets the recursive file tree for a given commit SHA."""
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/git/trees/{commit_sha}?recursive=1"
    with httpx.Client() as client:
        response = client.get(url, headers=get_api_headers())
        response.raise_for_status()
        return response.json()["tree"]

def update_changelog(old_sha: str, new_sha: str):
    """Fetches commits between two SHAs and updates the changelog."""
    if not old_sha:
        log("No previous version found, skipping changelog generation.")
        return

    url = f"https://api.github.com/repos/{OWNER}/{REPO}/compare/{old_sha}...{new_sha}"
    with httpx.Client() as client:
        response = client.get(url, headers=get_api_headers())
        if response.status_code != 200:
            log(f"Could not fetch commit comparison, skipping changelog. Status: {response.status_code}")
            return
        
        data = response.json()
        commits = data.get("commits", [])
        if not commits:
            log("No new commits found for changelog.")
            return

    log_entries = [f"- {c['commit']['message'].splitlines()[0]} ({c['sha'][:7]})") for c in commits]
    logs = "\n".join(log_entries)
    
    today = datetime.now().strftime("%Y-%m-%d")
    # We don't have a version number here, so we use the commit SHA
    new_entry = f"## [{new_sha[:7]}] - {today}\n\n### Changed\n{logs}\n\n"
    
    if not CHANGELOG_FILE.exists():
        CHANGELOG_FILE.write_text(f"# Changelog\n\n{new_entry}")
    else:
        original_content = CHANGELOG_FILE.read_text()
        insert_position = original_content.find('\n\n') + 2
        updated_content = original_content[:insert_position] + new_entry + original_content[insert_position:]
        CHANGELOG_FILE.write_text(updated_content)
    
    log("CHANGELOG.md updated.")

def restart_application():
    """Restarts the application by sending a SIGHUP signal."""
    log("Sending SIGHUP to PID 1 to restart the application...")
    try:
        os.kill(1, signal.SIGHUP)
    except Exception as e:
        log(f"Could not send SIGHUP to PID 1: {e}. The container might need a manual restart.")
        # As a fallback, try to kill the current process. Docker's restart policy might take over.
        log("Attempting to exit current process as a fallback...")
        sys.exit(1)

def run_update():
    """Main function to run the update process."""
    log("Starting update process via raw file download...")
    try:
        log("Fetching latest version information from GitHub...")
        new_sha = get_latest_commit_sha()
        old_sha = get_local_commit_sha()

        log(f"Local version: {old_sha or 'N/A'}")
        log(f"Remote version: {new_sha}")

        if new_sha == old_sha:
            log("Application is already up to date.")
            return {"status": "success", "message": "Already up to date."}

        log("New version available. Fetching file tree...")
        file_tree = get_file_tree(new_sha)

        ignore_list = {".git", ".github", ".gitignore", "Dockerfile", "entrypoint.sh"}
        
        with httpx.Client(timeout=60) as client:
            for item in file_tree:
                if item["type"] == "blob": # It's a file
                    path_str = item["path"]
                    
                    # Skip files we don't want to overwrite
                    if any(part in ignore_list for part in path_str.split('/')):
                        log(f"Skipping ignored file: {path_str}")
                        continue

                    local_path = BASE_DIR / path_str
                    local_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    download_url = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{new_sha}/{path_str}"
                    log(f"Downloading: {path_str}")
                    
                    response = client.get(download_url)
                    response.raise_for_status()
                    local_path.write_bytes(response.content)

        log("File download complete.")
        
        log("Updating dependencies...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE)], check=True)
        log("Dependencies updated.")

        log("Updating changelog...")
        update_changelog(old_sha, new_sha)

        store_commit_sha(new_sha)
        log(f"Successfully updated to version {new_sha[:7]}.")

        return {"status": "success", "message": f"Update to version {new_sha[:7]} successful. Restarting..."}

    except httpx.HTTPStatusError as e:
        log(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        return {"status": "error", "message": f"Failed to communicate with GitHub API: {e.response.status_code}"}
    except Exception as e:
        log(f"An unexpected error occurred: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    run_update()
