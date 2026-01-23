#!/bin/bash
set -e

# Start the cron daemon in the background for scheduled tasks
# Redirect errors to /dev/null to avoid permission denied spam in non-root environments
if command -v cron &> /dev/null; then
    echo "Attempting to start cron daemon..."
    # Run in background and suppress all output to avoid permission errors noise
    cron -f > /dev/null 2>&1 &
else
    echo "Warning: 'cron' command not found. Scheduled updates will be skipped."
fi

# --- Static Site Cloning ---
STATIC_SITE_GIT_URL=${STATIC_SITE_GIT_URL:-"https://github.com/Jyf0214/upgraded-doodle.git"}
STATIC_SITE_GIT_BRANCH=${STATIC_SITE_GIT_BRANCH:-"gh-pages"}
STATIC_SITE_DIR="/app/static_site"

if [ -n "$STATIC_SITE_GIT_URL" ]; then
    echo "Cloning static site from $STATIC_SITE_GIT_URL (branch: $STATIC_SITE_GIT_BRANCH)..."
    # Remove existing directory to ensure a fresh clone
    rm -rf $STATIC_SITE_DIR
    git clone --quiet --depth 1 --branch "$STATIC_SITE_GIT_BRANCH" "$STATIC_SITE_GIT_URL" "$STATIC_SITE_DIR"
    if [ $? -eq 0 ]; then
        echo "Static site cloning successful."
    else
        echo "Static site cloning failed. Creating an empty directory."
        mkdir -p $STATIC_SITE_DIR
    fi
else
    echo "STATIC_SITE_GIT_URL not set. Skipping clone."
    mkdir -p $STATIC_SITE_DIR
fi

# --- Cloudflare Tunnel ---
# Handled by the application binary
# if [ -n "$TUNNEL_TOKEN" ]; then
#     cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" > /dev/null 2>&1 &
# fi

# --- Application Code Update ---
# Disabled for binary distribution
# if [ -d "/app/.git" ]; then
#    ...
# fi

# --- Start the main application ---
echo "Starting application binary..."
exec /app/web-dl-manager