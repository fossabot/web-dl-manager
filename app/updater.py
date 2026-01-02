import os
import sys
import signal
import subprocess
import json
import time
from pathlib import Path
from datetime import datetime
import httpx
from .config import PROJECT_ROOT

# --- Configuration ---
OWNER = "Jyf0214"
REPO = "web-dl-manager"
BRANCH = "main"
VERSION_INFO_FILE = PROJECT_ROOT / ".version_info"
CHANGELOG_FILE = PROJECT_ROOT / "CHANGELOG.md"
REQUIREMENTS_FILE = PROJECT_ROOT / "app" / "requirements.txt"

# --- Helper Functions ---
def log(message: str):
    """Prints a message to stdout."""
    print(f"[Updater] {message}", flush=True)

def is_frozen():
    return getattr(sys, 'frozen', False)

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
    # First try to get from git
    try:
        import subprocess
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
            cwd=PROJECT_ROOT
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    
    # Fall back to version info file
    if not VERSION_INFO_FILE.exists():
        return None
    return VERSION_INFO_FILE.read_text(encoding="utf-8").strip()

def store_commit_sha(sha: str):
    """Stores the given commit SHA in the version info file."""
    VERSION_INFO_FILE.write_text(sha, encoding="utf-8")

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

        log_entries = [f"- {c['commit']['message'].splitlines()[0]} ({c['sha'][:7]})" for c in commits]
    logs = "\n".join(log_entries)
    
    today = datetime.now().strftime("%Y-%m-%d")
    # We don't have a version number here, so we use the commit SHA
    new_entry = f"## [{new_sha[:7]}] - {today}\n\n### Changed\n{logs}\n\n"
    
    if not CHANGELOG_FILE.exists():
        CHANGELOG_FILE.write_text(f"# Changelog\n\n{new_entry}", encoding="utf-8")
    else:
        original_content = CHANGELOG_FILE.read_text(encoding="utf-8")
        insert_position = original_content.find('\n\n') + 2
        updated_content = original_content[:insert_position] + new_entry + original_content[insert_position:]
        CHANGELOG_FILE.write_text(updated_content, encoding="utf-8")
    
    log("CHANGELOG.md updated.")

def check_for_updates() -> dict:
    """Checks if updates are available without performing the update."""
    try:
        log("Checking for updates...")
        new_sha = get_latest_commit_sha()
        old_sha = get_local_commit_sha()
        
        update_available = new_sha != old_sha if old_sha else True
        commits_behind = 0
        
        if update_available and old_sha:
            # Get commit count between old and new SHA
            url = f"https://api.github.com/repos/{OWNER}/{REPO}/compare/{old_sha}...{new_sha}"
            with httpx.Client() as client:
                response = client.get(url, headers=get_api_headers())
                if response.status_code == 200:
                    data = response.json()
                    commits_behind = len(data.get("commits", []))
        
        return {
            "status": "success",
            "update_available": update_available,
            "current_version": old_sha[:7] if old_sha else "N/A",
            "latest_version": new_sha[:7],
            "commits_behind": commits_behind,
            "current_full_sha": old_sha,
            "latest_full_sha": new_sha
        }
    except Exception as e:
        log(f"Error checking for updates: {e}")
        return {
            "status": "error",
            "message": str(e),
            "update_available": False,
            "current_version": "N/A",
            "latest_version": "N/A",
            "commits_behind": 0
        }

def update_dependencies() -> dict:
    """Updates Python dependencies from requirements.txt."""
    if is_frozen():
        return {"status": "error", "message": "Dependency update is not supported in binary mode."}
    try:
        log("Updating dependencies from requirements.txt...")
        
        if not REQUIREMENTS_FILE.exists():
            return {
                "status": "error",
                "message": f"Requirements file not found: {REQUIREMENTS_FILE}"
            }
        
        # Update pip first
        log("Upgrading pip...")
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"], 
                      check=False, capture_output=True, text=True)
        
        # Install/upgrade dependencies
        log("Installing/upgrading dependencies...")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE)],
            check=False, capture_output=True, text=True
        )
        
        if result.returncode == 0:
            log("Dependencies updated successfully.")
            return {
                "status": "success",
                "message": "Dependencies updated successfully.",
                "output": result.stdout
            }
        else:
            log(f"Failed to update dependencies: {result.stderr}")
            return {
                "status": "error",
                "message": f"Failed to update dependencies: {result.stderr}",
                "output": result.stdout,
                "error": result.stderr
            }
    except Exception as e:
        log(f"Error updating dependencies: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

def get_update_info() -> dict:
    """Returns comprehensive update information."""
    try:
        old_sha = get_local_commit_sha()
        check_result = check_for_updates()
        
        # Get last update time if available
        last_update_time = None
        if VERSION_INFO_FILE.exists():
            mtime = VERSION_INFO_FILE.stat().st_mtime
            last_update_time = datetime.fromtimestamp(mtime).isoformat()
        
        # Get dependency count
        dependency_count = 0
        if REQUIREMENTS_FILE.exists():
            content = REQUIREMENTS_FILE.read_text(encoding="utf-8")
            # Count non-empty, non-comment lines
            lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('#')]
            dependency_count = len(lines)
        
        return {
            "status": "success",
            "current_version": old_sha[:7] if old_sha else "N/A",
            "current_full_sha": old_sha,
            "update_available": check_result.get("update_available", False),
            "latest_version": check_result.get("latest_version", "N/A"),
            "latest_full_sha": check_result.get("latest_full_sha"),
            "commits_behind": check_result.get("commits_behind", 0),
            "last_update_time": last_update_time,
            "dependencies_count": dependency_count,
            "requirements_file": str(REQUIREMENTS_FILE.relative_to(PROJECT_ROOT)),
            "changelog_exists": CHANGELOG_FILE.exists()
        }
    except Exception as e:
        log(f"Error getting update info: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

def update_page_library() -> dict:
    """Updates page library (templates and static resources) from GitHub."""
    if is_frozen():
        return {"status": "error", "message": "Page library update is not supported in binary mode."}
    try:
        log("Updating page library (templates and static resources)...")
        
        # Get latest commit SHA
        new_sha = get_latest_commit_sha()
        
        # Get file tree for the latest commit
        file_tree = get_file_tree(new_sha)
        
        # Define page library directories to update
        page_lib_dirs = ["app/templates", "app/static"]
        updated_files = []
        skipped_files = []
        
        with httpx.Client(timeout=60) as client:
            for item in file_tree:
                if item["type"] == "blob":  # It's a file
                    path_str = item["path"]
                    
                    # Check if file belongs to page library directories
                    should_update = any(path_str.startswith(dir_prefix) for dir_prefix in page_lib_dirs)
                    if not should_update:
                        continue
                    
                    local_path = PROJECT_ROOT / path_str
                    local_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    download_url = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{new_sha}/{path_str}"
                    log(f"Downloading page library file: {path_str}")
                    
                    response = client.get(download_url)
                    response.raise_for_status()
                    local_path.write_bytes(response.content)
                    updated_files.append(path_str)
        
        if not updated_files:
            log("No page library files needed updating.")
            return {
                "status": "success",
                "message": "Page library is already up to date.",
                "updated_files": [],
                "skipped_files": skipped_files
            }
        
        log(f"Page library updated successfully. Updated {len(updated_files)} files.")
        return {
            "status": "success",
            "message": f"Page library updated successfully. Updated {len(updated_files)} files.",
            "updated_files": updated_files,
            "skipped_files": skipped_files
        }
        
    except httpx.HTTPStatusError as e:
        log(f"HTTP error occurred while updating page library: {e.response.status_code} - {e.response.text}")
        return {
            "status": "error",
            "message": f"Failed to communicate with GitHub API: {e.response.status_code}"
        }
    except Exception as e:
        log(f"An unexpected error occurred while updating page library: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

def restart_application():
    """
    Restarts the application after update.
    Sends SIGHUP to PID 1 to allow the entrypoint script to handle the restart.
    If SIGHUP fails, attempts alternative restart methods.
    """
    log("Preparing to restart application...")
    
    # Optionally check for active tasks but don't block restart
    try:
        with httpx.Client(timeout=5) as client:
            response = client.get("http://127.0.0.1:6275/server-status/json")
            if response.status_code == 200:
                data = response.json()
                active_tasks = data.get("application", {}).get("active_tasks", 0)
                if active_tasks > 0:
                    log(f"Warning: {active_tasks} active tasks will be interrupted by restart.")
    except Exception as e:
        log(f"Could not check active tasks: {e}. Proceeding with restart.")
    
    # Method 1: Send SIGHUP to PID 1 (works if entrypoint handles it)
    try:
        os.kill(1, signal.SIGHUP)
        log("SIGHUP signal sent to PID 1. Application should restart shortly.")
        return {"status": "success", "message": "Restart signal sent."}
    except Exception as e:
        log(f"SIGHUP failed: {e}. Trying alternative method...")
    
    # Method 2: Start a new process and exit current one
    try:
        log("Starting new application process...")
        # Start the application in background using subprocess
        subprocess.Popen(
            [sys.executable, "-m", "app.main"],
            cwd=PROJECT_ROOT,
            start_new_session=True
        )
        log("New application process started. Current process will exit.")
        # Give time for new process to start
        time.sleep(2)
        # Exit current process
        os._exit(0)
    except Exception as e:
        log(f"Alternative restart failed: {e}")
        return {"status": "error", "message": f"Failed to restart: {e}"}


def run_update():
    """Main function to run the update process."""
    if is_frozen():
        return {"status": "error", "message": "Self-update is not supported in binary mode. Please update the container/binary manually."}
    log("Starting update process...")
    try:
        # Get current and latest version info
        old_sha = get_local_commit_sha()
        log(f"Current local version: {old_sha or 'N/A'}")
        
        # Check if we're in a git repository
        git_repo_path = PROJECT_ROOT / ".git"
        if git_repo_path.exists():
            log("Git repository detected, using git pull for update...")
            try:
                # Get remote latest SHA first
                new_sha = get_latest_commit_sha()
                log(f"Latest remote version: {new_sha[:7]}")
                
                if new_sha == old_sha:
                    log("Application is already up to date.")
                    return {"status": "success", "message": "Already up to date.", "updated": False}
                
                # Perform git pull
                result = subprocess.run(
                    ["git", "pull", "origin", BRANCH],
                    capture_output=True,
                    text=True,
                    cwd=PROJECT_ROOT,
                    timeout=300
                )
                
                if result.returncode != 0:
                    log(f"Git pull failed: {result.stderr}")
                    raise Exception(f"Git pull failed: {result.stderr}")
                
                log("Git pull successful.")
                
                # Verify new SHA after pull
                new_local_sha = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    capture_output=True,
                    text=True,
                    cwd=PROJECT_ROOT,
                    check=True
                ).stdout.strip()
                
                log(f"Updated to version: {new_local_sha[:7]}")
                
                # Update version info file
                store_commit_sha(new_local_sha)
                
                # Update dependencies
                log("Updating dependencies...")
                subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS_FILE)], check=True)
                log("Dependencies updated.")
                
                # Update changelog
                log("Updating changelog...")
                update_changelog(old_sha, new_local_sha)
                
                log(f"Successfully updated to version {new_local_sha[:7]} via git pull.")
                return {"status": "success", "message": f"Update to version {new_local_sha[:7]} successful. Restarting...", "updated": True}
                
            except subprocess.TimeoutExpired:
                log("Git pull timed out.")
                raise Exception("Git pull timed out after 5 minutes.")
            except Exception as git_error:
                log(f"Git pull failed, falling back to raw file download: {git_error}")
                # Fall through to raw file download
                pass
        
        # Fallback to raw file download method
        log("Using raw file download method for update...")
        new_sha = get_latest_commit_sha()
        log(f"Latest remote version: {new_sha[:7]}")
        
        if new_sha == old_sha:
            log("Application is already up to date.")
            return {"status": "success", "message": "Already up to date.", "updated": False}
        
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

                    local_path = PROJECT_ROOT / path_str
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

        return {"status": "success", "message": f"Update to version {new_sha[:7]} successful. Restarting...", "updated": True}

    except httpx.HTTPStatusError as e:
        log(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        return {"status": "error", "message": f"Failed to communicate with GitHub API: {e.response.status_code}"}
    except Exception as e:
        log(f"An unexpected error occurred: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    run_update()
