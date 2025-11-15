#!/usr/bin/env python3
"""
Build script to package the gallery-dl-web application into a binary executable
"""
import os
import sys
import subprocess
from pathlib import Path


def install_pyinstaller():
    """Install PyInstaller if not already installed"""
    try:
        import PyInstaller
        print("PyInstaller is already installed.")
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])


def create_build():
    """Create the binary build of the application"""
    print("Starting build process...")
    
    # Install PyInstaller
    install_pyinstaller()
    
    # Define the main file path
    main_file = "app/main.py"
    
    if not Path(main_file).exists():
        print(f"Error: {main_file} not found!")
        return False
    
    # Create spec file for PyInstaller with custom configuration
    spec_content = """# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['app/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        # Include templates directory
        ('app/templates', 'app/templates'),
    ],
    hiddenimports=[
        'fastapi',
        'uvicorn',
        'jinja2',
        'python_multipart',
        'gallery_dl',
        'aiohttp',
        'aiofiles',
        'itsdangerous',
        'httpx',
        'starlette',
        'gofilepy_api',
        'psutil',
        'app.updater',
        'app.status',
        'app.tasks',
        'app.utils',
        'app.config',
        'app.openlist',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='gallery-dl-web',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    uac_admin=False,
    uac_uiaccess=False,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)
"""
    
    # Write the spec file
    spec_file = "gallery-dl-web.spec"
    with open(spec_file, "w", encoding="utf-8") as f:
        f.write(spec_content)
    
    print(f"Spec file created: {spec_file}")
    
    # Run PyInstaller with the spec file
    try:
        cmd = ["pyinstaller", "--clean", spec_file]
        print(f"Running: {' '.join(cmd)}")
        subprocess.check_call(cmd)
        print("Build completed successfully!")
        print("Binary is located in the 'dist' directory.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        return False


def main():
    """Main function to run the build process"""
    if not create_build():
        print("Build process failed!")
        sys.exit(1)
    
    print("Build process completed successfully!")


if __name__ == "__main__":
    main()