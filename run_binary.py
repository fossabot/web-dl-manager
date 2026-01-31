#!/usr/bin/env python3
"""
Script to run the gallery-dl-web application from the binary
"""
import os
import sys
import subprocess
import argparse
from pathlib import Path


def run_binary(port=8000, host="0.0.0.0", debug=False):  # nosec B104
    """
    Run the gallery-dl-web binary with specified parameters
    """
    binary_path = Path("dist/gallery-dl-web/gallery-dl-web")
    
    if not binary_path.exists():
        # Try alternative location (different OS)
        binary_path = Path("dist/gallery-dl-web/gallery-dl-web.exe")  # Windows
        
        if not binary_path.exists():
            print("Error: Binary not found in dist/ directory")
            print("Please run the build script first: python build.py")
            return False
    
    cmd = [str(binary_path)]
    
    # Add any command-line arguments based on parameters
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["HOST"] = host
    
    print(f"Starting gallery-dl-web on {host}:{port}")
    print(f"Running binary: {' '.join(cmd)}")
    
    try:
        # Set up environment for the binary
        result = subprocess.run(cmd, env=env, cwd=binary_path.parent)
        return result.returncode == 0
    except KeyboardInterrupt:
        print("\nApplication stopped by user")
        return True
    except Exception as e:
        print(f"Error running binary: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run gallery-dl-web from binary")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on (default: 8000)")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")  # nosec B104
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    
    args = parser.parse_args()
    
    if not run_binary(port=args.port, host=args.host, debug=args.debug):
        sys.exit(1)


if __name__ == "__main__":
    main()