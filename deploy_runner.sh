#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
LOG_FILE="$PROJECT_DIR/server.log"

echo "🚀 [Runner] Starting deployment runner..."

# 1. Environment
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
export LC_ALL=C

cd "$PROJECT_DIR"

# 2. Build Client
echo "📦 [Runner] Building client..."
cd client
npm install
npm run build
cd ..

# 3. Server Deps
echo "🔧 [Runner] Installing server dependencies..."
cd server
npm install --production
cd ..

# 4. Restart Server
echo "🔄 [Runner] Restarting server..."

# Find PIDs to kill (excluding self and other irrelevant processes)
# We use pgrep to find the node process.
# We explicitly exclude the current script's PID to be safe.
CURRENT_PID=$$
PIDS=$(pgrep -f "node server/index.js" | grep -v grep | grep -v "$CURRENT_PID" || echo "")

if [ -n "$PIDS" ]; then
    PIDS_CLEAN=$(echo "$PIDS" | tr '\n' ' ')
    echo "🛑 [Runner] Stopping existing server (PIDs: $PIDS_CLEAN)..."
    for PID in $PIDS_CLEAN; do
        # Verify it's not our parent or us
        if [ "$PID" != "$CURRENT_PID" ] && [ "$PID" != "$PPID" ]; then
             kill "$PID" 2>/dev/null || true
        fi
    done
    sleep 3
fi

# Launch
echo "▶️  [Runner] Launching new server process..."
nohup node server/index.js > "$LOG_FILE" 2>&1 &
NEW_PID=$!

echo "✅ [Runner] Server launched with PID $NEW_PID"
sleep 2

# Verify
if ps -p "$NEW_PID" > /dev/null; then
   echo "✅ [Runner] Process is running."
   exit 0
else
   echo "❌ [Runner] Process died immediately. Check logs."
   cat "$LOG_FILE"
   exit 1
fi
