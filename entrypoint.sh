#!/bin/bash
set -e

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

# Run Prisma migrations if using SQLite
if [[ "$DATABASE_URL" == *"file:"* ]]; then
    echo "Running Prisma db push..."
    npx prisma db push
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
