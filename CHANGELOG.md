# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-31

### Added
- **Fullstack Vite Architecture**: Complete rewrite of the application using a modern Vite-based TypeScript stack.
- **Frontend Overhaul**: Rebuilt the entire user interface using **React 19** and **TypeScript** for better performance and developer experience.
- **Backend Migration**: Replaced FastAPI with **Hono**, a lightweight and fast web framework for Node.js.
- **Database Integration**: Integrated **Prisma ORM** with SQLite for robust type-safe database operations.
- **Modern UI Components**: Utilized **Lucide React** for consistent and beautiful iconography.
- **Improved Dockerization**: Optimized Dockerfile using multi-stage builds for a smaller footprint and faster deployment, running directly via Node.js.

### Optimized
- **Development Workflow**: Unified frontend and backend development through Vite's proxy and concurrent execution.
- **Build Process**: Streamlined building of both frontend assets and backend server into a single `dist/` directory.

### Changed
- **Project Structure**: Reorganized source code into `src/frontend` and `src/backend` for better separation of concerns.
- **Language**: Fully migrated from Python to TypeScript across the entire codebase.

## [1.6.0] - 2026-01-23

### Added
- **Complete Web UI Overhaul**:
    - **Modern Aesthetics**: Rebuilt the entire interface using **Bootstrap 5** and a custom "Modern Slate" theme.
    - **Native Dark Mode**: Implemented automatic dark mode support.
- **Improved Navigation**:
    - **Sticky Top Navbar**: Replaced sliding sidebar with a modern fixed-top navigation bar.

## [1.0.0] - 2025-12-01
### Added
- Initial stable release of Web-DL Manager (Python/FastAPI version).
- Support for basic gallery-dl and yt-dlp downloading.
- Simple dashboard and task management.

... (older history preserved)