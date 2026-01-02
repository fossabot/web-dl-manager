# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
