#!/bin/bash
set -e

# Load .env if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# --- Static Site Cloning (Camouflage) ---
STATIC_SITE_GIT_URL=${STATIC_SITE_GIT_URL:-"https://github.com/Jyf0214/upgraded-doodle.git"}
STATIC_SITE_GIT_BRANCH=${STATIC_SITE_GIT_BRANCH:-"gh-pages"}
STATIC_SITE_DIR="/app/public/camouflage"

if [ -n "$STATIC_SITE_GIT_URL" ]; then
    echo "Cloning static site from $STATIC_SITE_GIT_URL (branch: $STATIC_SITE_GIT_BRANCH)..."
    rm -rf $STATIC_SITE_DIR
    mkdir -p $STATIC_SITE_DIR
    git clone --quiet --depth 1 --branch "$STATIC_SITE_GIT_BRANCH" "$STATIC_SITE_GIT_URL" "$STATIC_SITE_DIR"
    if [ $? -eq 0 ]; then
        echo "Static site cloning successful."
    else
        echo "Static site cloning failed."
    fi
fi

# --- Prisma Setup ---
if [ -n "$DATABASE_URL" ]; then
    echo "Detecting database provider from DATABASE_URL..."
    if [[ "$DATABASE_URL" == "mysql://"* ]]; then
        PROVIDER="mysql"
    elif [[ "$DATABASE_URL" == "postgres://"* ]] || [[ "$DATABASE_URL" == "postgresql://"* ]]; then
        PROVIDER="postgresql"
    elif [[ "$DATABASE_URL" == "file:"* ]] || [[ "$DATABASE_URL" == *"sqlite"* ]]; then
        PROVIDER="sqlite"
        # Ensure SQLite URL starts with file:
        if [[ "$DATABASE_URL" != "file:"* ]]; then
            export DATABASE_URL="file:$DATABASE_URL"
        fi
    else
        PROVIDER="sqlite" # Default
    fi
    
    echo "Setting Prisma provider to $PROVIDER"
    # Only replace provider inside the datasource block
    sed -i "/datasource db {/,/}/ s/provider = \"[^\"]*\"/provider = \"$PROVIDER\"/" prisma/schema.prisma
    
    # Use local prisma binary or fallback to specific version 6.4.1
    PRISMA_CMD="./node_modules/.bin/prisma"
    
    if [ ! -f "$PRISMA_CMD" ]; then
        echo "Local prisma binary not found, falling back to npx -y prisma@6.4.1"
        PRISMA_CMD="npx -y prisma@6.4.1"
    fi
    
    echo "Generating Prisma Client..."
    $PRISMA_CMD generate
    
    echo "Syncing database schema..."
    $PRISMA_CMD db push --skip-generate
fi

# Start Camouflage Server in background
echo "Starting Camouflage server on port 5492..."
node camouflage-server.mjs &

# Start Next.js (Main App)
echo "Starting Next.js application on port 6275..."
export PORT=6275
# If running in standalone mode (server.js exists)
if [ -f "server.js" ]; then
    exec node server.js
else
    exec npm start
fi
