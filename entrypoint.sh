#!/bin/bash
set -e

# Start the cron daemon in the background for scheduled tasks
echo "Starting cron daemon..."
cron -f &

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


# --- Camouflage Site Server ---
CAMOUFLAGE_PORT=5492
if [ -d "$STATIC_SITE_DIR" ] && [ "$(ls -A $STATIC_SITE_DIR)" ]; then
    echo "Starting camouflage static server on port $CAMOUFLAGE_PORT..."
    python3 -m http.server $CAMOUFLAGE_PORT --directory "$STATIC_SITE_DIR" &
else
    echo "Static site directory is empty or not found. Camouflage server not started."
fi


# --- Process Management ---
PID_FILE="/tmp/web-dl-manager.pid"

# Function to start the Python application
start_python_app() {
    echo "Starting server with gunicorn on 127.0.0.1:6275..."
    gunicorn -w 4 -b 127.0.0.1:6275 app.main:app &
    echo $! > "$PID_FILE"
}

# Function for graceful shutdown
handle_signal() {
    echo "Signal received, attempting graceful shutdown..."
    if [ -f "$PID_FILE" ]; then
        kill -TERM "$(cat "$PID_FILE")" &> /dev/null || true
        rm -f "$PID_FILE"
    fi
    # Also kill the camouflage server
    pkill -f "python3 -m http.server $CAMOUFLAGE_PORT" || true
    exit 0
}

# Trap signals for graceful shutdown
trap 'handle_signal' SIGTERM SIGHUP

# --- Main Loop (Watchdog) ---
# This loop ensures the application restarts if it crashes

start_python_app

while true; do
    sleep 60
    if [ -f "$PID_FILE" ]; then
        # Check if the process is still running
        if ! kill -0 "$(cat "$PID_FILE")" &> /dev/null; then
            echo "Process seems to have died. Restarting..."
            start_python_app
        fi
    else
        echo "PID file not found. Assuming process is dead. Restarting..."
        start_python_app
    fi
done
