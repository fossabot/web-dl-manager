# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-01-16

### Added
- **UI/UX Overhaul**:
    - **Modern Sidebar**: Replaced the top navbar with a sleek, sliding sidebar featuring real-time GitHub repository stats (Stars, Forks) and system status indicators.
    - **PWA Support**: Added Progressive Web App capabilities, including manifest and icons, allowing the manager to be installed on mobile and desktop devices.
- **Enhanced Sync System**:
    - **Multi-Group Tasks**: Upgraded the scheduled sync system to support multiple, parallel sync groups for better organization and efficiency.
- **Downloader Improvements**:
    - **Kemono Organization**: Implemented automatic directory structuring for Kemono downloads by `username/title` to keep files organized.

### Optimized
- **Internationalization**: Fixed and improved i18n support across the UI, ensuring consistent language application.
- **Terminal UI**: Enhanced the dark-themed terminal interface for better readability and accessibility.
- **Dashboard Logic**: Refined the system dashboard refresh logic to reduce unnecessary server load and improve responsiveness.

### Fixed
- **UI Alignment**: Resolved alignment issues in rate limit input fields and restored missing UI descriptions.
- **Menu Visibility**: Fixed visibility bugs in the terminal menu and other navigation elements.

## [1.3.0] - 2026-01-10

### Added
- **Login Verification (CAPTCHA)**:
    - **Multi-Platform Support**: Integrated Local Math challenge, Cloudflare Turnstile, Google reCAPTCHA v2, and GeeTest (V3 & V4).
    - **GeeTest Demo Mode**: Added support for zero-config GeeTest V3 using official demo endpoints, including Slide, Click, and Fullpage types.
    - **Auto-Fallback & Fail-safe**: Implemented demo keys for Turnstile/reCAPTCHA and automatic bypass on verification service failures to prevent lockouts.
    - **Security**: Mandatory verification before login with automatic reset on failed authentication attempts.
- **Scheduled Sync Tasks**:
    - **Custom Sync**: Added a new background task system to periodically sync any local directory to remote storage via Rclone.
    - **UI Management**: New section in settings to configure sync paths, status, and intervals (minutes) with database persistence.
- **Enhanced Downloader Options**:
    - **Site-Specific Presets**: Added one-click configurations for Kemono (post limit, revisions), Pixiv (ugoira conversion), and X/Twitter (include retweets/replies).
    - **Custom Path Templates**: Added a global setting for gallery-dl extra arguments, allowing users to customize directory structures (e.g., `-o "directory=['{title}']"`).
- **Interactive Feedback**:
    - **Spinner Buttons**: Added visual loading indicators (spinners) and "Processing..." states to all submission buttons across the site (Login, Settings, Downloader, Setup, Password Change).

### Optimized
- **Settings UI**: Reorganized the settings page into a clean, categorized Accordion layout (General, Storage, Rclone, Sync, Verification) to improve usability on long configuration lists.
- **Data Lifecycle**: Implemented a "Read and Burn" policy where download data is stored in `app/tmp/data` and automatically wiped on every application startup.
- **Rclone Integration**: Improved configuration handling with a "Paste Raw Config" helper that auto-converts `rclone.conf` to Base64 in real-time.
- **Persistence**: SQLite database moved to `app/` level to ensure it survives the startup cleanup of the `tmp` directory.

### Fixed
- **Authentication**: Fixed a 404 error on the `/logout` endpoint and optimized it to redirect users back to the login page.
- **Containerization**: Fixed a Bash syntax error in `entrypoint.sh` and resolved permission issues when starting `cron` in non-root Docker environments.
- **Core Stability**: Fixed a `NameError` in `utils.py` by properly importing the `Request` object and cleaned up redundant empty lines in source files.

## [1.2.0] - 2026-01-10

### Added
- **Web Terminal**:
    - **Interactive Shell**: Integrated a full-featured, real-time interactive terminal (via `xterm.js`) allowing administrators to execute shell commands directly from the browser.
...
