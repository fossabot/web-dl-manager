# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-next] - 2026-02-06

### Added
- **Architectural Shift**: Full rewrite of the application from Python (FastAPI) to **Next.js (TypeScript)** for a more modern and scalable stack.
- **Lobe UI Integration**:
    - Adoped **Lobe UI** (@lobehub/ui) aesthetic with Ant Design for a high-tech, futuristic visual experience.
    - Implemented a persistent **SideBar** navigation and fluid dark mode layouts.
- **New Database Layer**: Switched to **Prisma ORM** for type-safe database operations, maintaining compatibility with the existing SQLite schema.
- **Enhanced Task Engine**:
    - Rewrote the background task processor using Node.js `child_process`.
    - Maintained support for **Gallery-DL**, **Kemono-DL**, and **Mega-DL**.
    - Integrated multi-service upload logic (WebDAV, S3, B2, Gofile, Openlist).
- **Advanced CI/CD & DevOps**:
    - Added **Husky** with `pre-commit` hooks for automatic Linting and Type-checking.
    - Optimized **Dockerfile** using Next.js Standalone mode for ultra-small image sizes.
    - Implemented **GitHub Actions** workflow targeting the `next` branch.
- **Camouflage System**: Refined the camouflage logic using Next.js Middleware to seamlessly serve static sites to unauthenticated users.

### Changed
- **Authentication**: Migrated from session-based auth to **JWT (jose)** while keeping existing password hashes compatible.
- **Frontend Engine**: Transitioned from Jinja2 templates to **React Server Components** and client-side interactivity.

### Fixed
- **构建系统与兼容性**:
    - **Next.js 15+ 适配**: 将 API 路由中的 `params` 更改为 `Promise` 类型，解决了异步参数导致的构建失败。
    - **Edge Runtime 兼容性**: 将 JWT 逻辑从 `lib/auth.ts` 抽离至 `lib/jwt.ts`，移除了对 Node.js `crypto` 模块的直接依赖，解决了 Middleware 在 Edge Runtime 下的运行错误。
    - **Prisma 类型匹配**: 修复了 `getCurrentUser` 中 `userId` 的类型转换问题，确保与数据库 `Int` 类型一致。
    - **Webpack 构建优化**: 解决了 Turbopack 插件兼容性问题，并配置 Webpack 忽略了 `systeminformation` 在 Linux 环境下不必要的平台特定依赖警告。
- **代码质量 (Lint)**:
    - 修复了全量转写后遗留的 30 多个 ESLint 错误，包括 `any` 类型替换、未使用变量清理以及 Catch 子句类型规范化。
    - 更新 `package.json` 中的 `lint` 脚本，确保直接调用 `eslint` 以规避 `next lint` 的路径识别问题。

### Security
- **依赖漏洞修复**: 通过 `package.json` 的 `overrides` 强制将 `lodash-es` 升级至 `4.17.23`，修复了严重的原型污染 (Prototype Pollution) 漏洞。
- **安全审计**: 确保 CI/CD 流程中的 `npm audit` 能够以 0 漏洞状态通过。

## [1.5.0] - 2026-01-17

### Added
- **Batch Download Support**: 
    - Users can now input multiple URLs (one per line) in the downloader page to create multiple tasks at once.
- **Concurrency Control**: 
    - Implemented a global task queue that limits concurrent active downloads to **2 tasks** to ensure system stability and avoid IP bans.
- **Non-Intrusive Notifications**:
    - Replaced page redirection after task creation with a modern AJAX submission and **Toast notifications**.
    - Users can now stay on the downloader page to continue creating tasks without interruption.
- **PWA & Mobile Optimization**:
    - Enhanced PWA metadata for a better "native-like" experience on mobile devices.
    - Added a **Floating Action Button (FAB)** on the mobile UI for quick access to the task list.

### Optimized
- **File Upload Logic**: 
    - Removed the redundant UUID sub-directory in remote storage for uncompressed uploads. Files are now uploaded directly to the user-specified path.

### Removed
- **Login Verification (CAPTCHA)**: 
    - Completely removed the math challenge and third-party captcha services (Cloudflare, Google, GeeTest) due to compatibility issues and to streamline the login process.

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
