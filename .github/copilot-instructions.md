# Copilot Instructions for Web-DL-Manager

## Project Overview

Web-DL-Manager is a advanced download manager built with **Next.js 16** featuring a **dual-port architecture** with camouflage capabilities. The system uses **Prisma** for database management, **Express/http-proxy** for reverse proxying, and **PM2** for process management.

### Architecture

The application runs as two separate services:

1. **Core Service (Port 6275)**: Next.js app serving authenticated admin dashboard with download management, task scheduling, and cloud storage integration
2. **Camouflage Service (Port 5492)**: Static site masquerading layer for unauthenticated users (hides the tool's true purpose)

The middleware routes unauthenticated `/` requests to the camouflage layer (`/camouflage/index.html`) while authenticated users see the full admin interface.

### Key Dependencies

- **Next.js 16.1.6** with App Router
- **Prisma 6.4.1** (MySQL/PostgreSQL compatible, currently schema for MySQL)
- **Ant Design 6.2** + Tailwind CSS 4.0 for UI
- **http-proxy** for reverse proxying
- **ioredis/Upstash Redis** for caching
- **PM2** for production process management
- **systeminformation** for system monitoring

## Build, Test & Lint Commands

```bash
# Development
npm run dev                 # Start Next.js dev server (port 3000)
node camouflage-server.mjs # Start camouflage layer (separate terminal, port 5492)

# Production Build
npm run build              # Builds Next.js with Prisma setup (resolves merge conflicts in build step)

# Type Checking & Linting
npm run type-check         # TypeScript validation (no emit)
npm run lint               # ESLint with Next.js config + SonarJS + Promise rules
npm run audit              # Security audit (moderate level)

# Database
npx prisma generate       # Generate Prisma client
npx prisma migrate dev    # Run migrations
npx prisma db push       # Push schema to database
```

**Running a single test**: This project doesn't have a traditional test runner configured. Tests are primarily through linting and type-checking.

## Project Structure

```
app/
├── api/              # Route handlers (authentication, tasks, config, etc.)
├── page.tsx          # Dashboard home
├── layout.tsx        # Root layout (Ant Design registry, providers)
├── login/            # Login page
├── settings/         # Settings UI
├── status/           # System status monitoring
└── tasks/            # Task management UI

lib/
├── auth.ts           # Session & password hashing (SHA256 + salt)
├── config.ts         # ConfigManager - cache + DB + environment fallback
├── prisma.ts         # Prisma client singleton
├── jwt.ts            # Token encryption/decryption (jose library)
├── redis.ts          # Redis connection management
├── background.ts     # Background job execution
├── tasks.ts          # Task scheduling & queue management
├── rclone.ts         # rclone integration for cloud storage
├── logger.ts         # Logging utility
└── setup-prisma.mjs  # Pre-build Prisma setup for containerized builds

middleware.ts        # Request routing (auth, camouflage layer logic)
proxy.ts             # Reverse proxy configuration
instrumentation.ts   # Instrumentation hooks
camouflage-server.mjs # Standalone Express server for camouflage layer
```

## Key Conventions

### Authentication & Sessions

- Sessions stored in httpOnly cookies (30-min timeout)
- Password hashing: SHA256 with random salt, stored as `salt:hash`
- JWT tokens use `jose` library for encryption/decryption
- Middleware validates session on all protected routes (except `/login` and APIs)

### Configuration Management

ConfigManager in `lib/config.ts` follows a 3-tier lookup:
1. **In-memory cache** (Map)
2. **Database** (Prisma - key/value pairs in `config` table)
3. **Environment variables** (fallback only for SQLite mode)

Use `await configManager.getConfig(key, defaultValue)` throughout the app.

### API Routes Structure

All API routes follow Next.js App Router pattern:
- Route handlers in `app/api/[resource]/route.ts`
- Dynamic routes use `[param]` syntax: `app/api/tasks/[taskId]/route.ts`
- Session validation typically done with `getSession()` from `lib/auth.ts`
- JSON responses use `NextResponse.json()`

### Task Scheduling

Tasks are managed via `lib/tasks.ts`:
- Task lifecycle: **pending → running → completed/failed**
- Background worker polls task queue at intervals
- Supports multi-step workflows (download → compress → upload)
- Cloud storage backends: WebDAV, S3, Gofile, Openlist via rclone

### Environment Variables

**Database & Caching (unified via DATABASE_URL)**

The project now supports **MySQL**, **PostgreSQL**, **SQLite**, and **Redis** through a single `DATABASE_URL` variable. The system auto-detects the database type based on the URL scheme.

**Supported DATABASE_URL formats:**
- **MySQL**: `mysql://user:password@host:port/database`
- **PostgreSQL**: `postgresql://user:password@host:port/database`
- **SQLite**: `file:./webdl-manager.db` or `file:path/to/database.db`
- **Redis**: `redis://[:password]@host:port[/db]` or `rediss://` (TLS)

**Legacy support:**
- `REDIS_URL`: Environment variable or database config key (deprecated - use `DATABASE_URL` instead)
- Old Upstash-specific variables removed (use standard Redis protocol instead)

**Other key variables:**
- `STATIC_SITE_GIT_URL`: Git repo for camouflage content (optional)
- `NODE_ENV`: `development` or `production`
- `PORT`: Service ports (6275 for core, 5492 for camouflage)

### Styling

- **Tailwind CSS 4.0** for utility-first styling
- **Ant Design 6.2** for component library (form, table, modal, etc.)
- **antd-style** for theming and CSS-in-JS
- No global CSS file; leverage Tailwind + Ant Design components

### TypeScript Paths

Path alias configured in `tsconfig.json`:
```json
"@/*": ["./*"]  // @/lib/auth.ts resolves to ./lib/auth.ts
```

### Merge Conflict in package.json

The `build` and `lint-staged` scripts have merge conflicts (visible as `<<<<< HEAD / ===== / >>>>>` markers). Resolution strategy:
- `build`: Use the branch with Prisma setup: `node lib/setup-prisma.mjs && prisma generate && next build --webpack`
- `lint-staged`: Extend file patterns to include `.mjs` files

### PM2 Configuration

Defined in `ecosystem.config.js`:
- **web-dl-manager**: Next.js app on port 6275 (1G memory limit)
- **camouflage-server**: Static camouflage Express server on port 5492 (200M memory limit)

Both configured to auto-restart and log to `logs/` directory.

## Linting & Code Quality

- **ESLint config**: Next.js core + TypeScript + SonarJS + Promise rules
- **SonarJS rules**: Cognitive complexity cap at 60, duplicate strings ignored
- **Pre-commit hooks**: via Husky (lint-staged runs on staged files)

Disabled/warning rules:
- `sonarjs/no-duplicate-string`: off (common in large projects)
- `sonarjs/no-nested-template-literals`: warn
- `promise/always-return`, `promise/catch-or-return`: warn (not strict)

## Database

**Prisma Schema** (MySQL-configured):

- **User**: id, username (unique), hashedPassword, isAdmin flag, createdAt
- **Config**: id, keyName (unique), keyValue, timestamps
- **Log**: id, timestamp, level, loggerName, message, pathname, lineno

Schema file location: `prisma/schema.prisma`

**Data sources**: Currently configured for MySQL; can be changed to PostgreSQL by updating `datasource db` in schema.

## Development Workflow

1. Run `npm install` to install dependencies
2. Set up `.env` with `DATABASE_URL` (local MySQL or SQLite file path)
3. Run `npx prisma db push` to sync schema
4. Start dev server: `npm run dev`
5. In another terminal, start camouflage layer: `node camouflage-server.mjs`
6. Navigate to `http://localhost:3000` (dev) or `http://localhost:6275` (production-like)
7. First login at `/setup` to initialize
8. Make changes; TypeScript and ESLint will catch issues

## Production Deployment

1. Build: `npm run build` (includes Prisma setup)
2. Use PM2: `pm2 start ecosystem.config.js`
3. Monitor logs: `pm2 logs` or check `logs/` directory
4. Docker: See `Dockerfile` and `entrypoint.sh` for container setup

## Notes for Copilot

- **When modifying API routes**: Remember the session timeout (30 min) and always validate auth before sensitive operations
- **When adding configs**: Use ConfigManager for database-backed settings; avoid hardcoding config values
- **When updating dependencies**: Run `npm audit` and watch for breaking changes in Ant Design or Next.js versions
- **Prisma schema changes**: Always run migrations in dev before pushing to production
- **Camouflage layer**: Keep static assets in sync; the Express server serves from `public/camouflage/` directory
