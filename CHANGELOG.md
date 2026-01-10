# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-01-10

### Added
- **Web Terminal**:
    - **Interactive Shell**: Integrated a full-featured, real-time interactive terminal (via `xterm.js`) allowing administrators to execute shell commands directly from the browser.
    - **Pseudo-terminal (PTY)**: Implemented `ptyprocess` on the backend to provide a robust terminal experience with support for ANSI colors, interactive CLI tools, and proper signal handling.
    - **WebSocket Support**: Leveraged asynchronous WebSockets for low-latency bidirectional communication between the browser and the server's shell.
    - **Security Confirmation**: Introduced a mandatory risk acknowledgement workflow. The terminal is disabled by default and requires explicit user confirmation of risks before activation.
    - **Management UI**: Added a dedicated "Enable Web Terminal" toggle in the system settings and a beautifully designed terminal interface with modern aesthetics.
    - **Session-bound**: Terminal access is strictly bound to the authenticated user's session, ensuring no unauthorized access.
    - **Reconnection Mechanism**: Added a visual overlay and a dedicated "Reconnect" button that appears automatically if the terminal connection is unexpectedly dropped.

### Optimized
- **Terminal UI**: Designed a沉浸式 (immersive) terminal interface with a modern slate-blue gradient header, glassmorphism effects, and responsive layout.
- **Error Handling**: Enhanced PTY spawn logic with stringified environment variables to prevent common unhashable type errors in complex environments.

## [1.1.1] - 2026-01-09

### Fixed
- **Database Fallback**: Resolved a critical issue where the application would crash when falling back to an in-memory SQLite database (due to MySQL connection failure) by ensuring tables are initialized immediately upon fallback.

### Added
- **Database Maintenance**:
    - **Cleanup Utility**: Implemented a comprehensive database cleanup function that removes unused tables and obsolete configuration keys from the database.
    - **Management UI**: Added a "Database Maintenance" section to the settings page, allowing administrators to manually trigger database cleanup directly from the web interface.
    - **Config Whitelisting**: Introduced a whitelist-based configuration management system to ensure only relevant settings are preserved during cleanup.

## [1.1.0] - 2026-01-09

### Added
- **Redis Integration**: Added comprehensive support for Upstash/standard Redis to enable centralized logging and improved scalability.
- **Log Streaming**: Implemented `RedisLogHandler` to stream application logs directly to a Redis list (`webdl:logs`), facilitating external monitoring and analysis.
- **UI Configuration**: Added a dedicated field in the settings page to configure the Redis URL dynamically.
- **Security**: Implemented intelligent masking for sensitive configuration keys (e.g., API tokens, passwords, Redis URLs) in the settings UI to prevent accidental exposure.
- **UI Overhaul**:
    - **Modern Design**: Completely rewrote the CSS using a variable-based system with a refined slate-blue color palette.
    - **Dark Mode**: Added full support for system-level dark mode preference.
    - **Components**: Upgraded navbar with glassmorphism effects, modernized card styles with hover animations, and improved form control aesthetics.
    - **UX**: Enhanced login page design with gradient backgrounds and animated avatar presentation.

### Changed
- **Config Management**: Redis configuration prioritizes database settings with automatic client reconnection upon updates.

## [1.0.0] - 2026-01-03

### Added
- **Dual Progress Monitoring**: Implemented real-time progress tracking for Openlist uploads, showing both individual file percentage and overall task percentage in the UI.
- **Upload Progress**: Implemented real-time upload progress tracking for both rclone and Openlist, including percentage, file counts, and data size.
- **Speed Dashboard**: Added a real-time network speed monitor (Up/Down) to the job status page.
- **Log Management**: Separated download and upload logs into distinct files and UI containers for better clarity and debugging.
- **Dashboard**: Introduced a standalone static dashboard at `/page` featuring a modern UI and CORS support for flexible access.
- **Settings Expansion**: Significantly expanded the system settings page to support almost all environment and database configurations (WebDAV, S3, B2, GoFile, Openlist, Backup settings, Login Domain, etc.) directly from the UI.
- **Downloader UI**: Implemented dynamic option visibility in the downloader interface; advanced options now automatically show or hide based on the selected tool (e.g., hiding DeviantArt credentials when using `megadl`).
- **MEGA Support**: Added a user-friendly MB/s rate limit field for `megadl` with automatic real-time conversion to bytes for backend processing.

### Optimized
- **Log UI**: Redesigned the status page with a dedicated progress panel and dual dark-mode log containers with independent folding and scrolling.
- **Log UI (Visibility)**: Upload logs are now hidden by default to keep the interface clean, automatically expanding only on errors.
- **File Handling**: Enhanced `count_files_in_dir` to gracefully handle single files and non-existent paths, improving workflow resilience.
- **Caching**: Implemented a comprehensive memory caching layer for users and tasks, including manual cache refresh capabilities to ensure data consistency and performance.
- **UI & UX**:
    - Fixed an issue where avatars failed to load (`about:blank#blocked`) on several pages by implementing a CSS variable-based loading strategy and a global template context function.
    - Added avatar previews to the login and setup pages for a more personalized experience.
- **Consistency**: Standardized configuration keys (e.g., `TUNNEL_TOKEN`) to uppercase across the entire codebase to prevent case-sensitivity issues between database and environment variables.
- **Repository**: Updated `.gitignore` to properly exclude build artifacts (`.next/`, `node_modules/`) and application log files.

### Fixed
- **Openlist Timeout**: Resolved a critical issue where Openlist file uploads would block the main application thread, causing Cloudflare 524 timeouts. The upload process is now fully asynchronous.
- **NameError**: Resolved an issue where `count_files_in_dir` was used in `tasks.py` without being imported, causing job failures after download.
- **MEGA Downloads**: Fixed a `Not a directory` error during `megadl` jobs by ensuring the target download directory exists before starting the download.

## [0.1.5] - 2026-01-02

### Fixed
- **Logging**: Fixed real-time log updates on the status page by disabling Python output buffering (`PYTHONUNBUFFERED=1`) and preventing browser caching of status API responses.

### Optimized
- **Database Performance**: Added SQLAlchemy connection pooling and an in-memory configuration cache to significantly reduce database query latency, especially for remote MySQL backends.
- **UI Performance**: Implemented server-side caching for the changelog fetch logic to eliminate delays caused by frequent GitHub API requests.

## [0.1.4] - 2026-01-02

### Changed
- **Updater**: Refined update detection logic to prevent false positives when local and remote semantic versions are identical.

## [0.1.3] - 2026-01-02

### Fixed
- **Authentication**: Resolved infinite redirect loop on `/login` by removing global authentication dependency from the main UI router.
- **Setup**: Exposed `/setup` route on the main application port (6275) to prevent 404 errors during direct initialization.

## [0.1.2] - 2026-01-02

### Fixed
- **Critical**: Resolved `ImportError` in logging system by refactoring `logging_handler` to use SQLAlchemy `engine` directly, fixing application startup crash.

## [0.1.1] - 2026-01-02

### Added
- **Database & Architecture**: Migrated to SQLAlchemy with full MySQL support.
- **Dynamic Configuration**: Enhanced setup page allowing persistence of system parameters (tokens, URLs) in the database.
- **Session Security**:
    - Implemented server-side idle timeout (30 minutes).
    - Dynamic startup session keys (invalidates all sessions on server restart).
    - Session-only cookies (expires on browser close).
- **Navigation**: Automatic redirection for authenticated users visiting login or index pages.

### Changed
- **Config Precedence**: Database settings now take strict priority over environment variables in MySQL mode.
- **Changelog Logic**: Added remote fetch fallback from GitHub for the web UI.

### Fixed
- Fixed UTF-8 encoding issues and path resolution for changelog reading.
- Cleaned up redundant source files from the project root.

## [0.1.0] - 2026-01-02

### Added
- **Initial Release**: Core functionality for `gallery-dl` and `megadl` integration.
- **Security**: Implemented dual-app architecture with a camouflage system on port 5492.
- **Archiving**: Added Zstd compression with multi-part chunking support for large files.
- **Storage**: Integrated `rclone` supporting WebDAV, S3, B2, and MEGA.
- **Uploaders**: Native API support for `gofile.io` and custom `openlist` logic.
- **UI**: Responsive Bootstrap 5 interface with real-time job logging and multi-language support (i18n).
- **Automation**: GitHub Actions workflow for automatic Docker image builds and publishing.
- **Deployment**: Added Cloudflare Tunnel integration for easy public access.

### Changed
- Refactored logging system to minimize console noise in production.
- Optimized database schema for better task history tracking.

### Fixed
- Fixed rate-limiting issues with DeviantArt by allowing custom API credentials.
- Resolved temporary file cleanup issues during concurrent jobs.