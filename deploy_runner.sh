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

# 4. Restart Server with PM2
echo "🔄 [Runner] Restarting server via PM2..."

# Ensure PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    echo "� [Runner] Installing PM2..."
    npm install -g pm2
fi

# Start or Reload
# To be absolutely safe, we delete the old process and force kill the port first
pm2 delete latex-online-server 2>/dev/null || true

echo "🧹 [Runner] Ensuring port 3000 is free..."
if command -v fuser &> /dev/null; then
    fuser -k 3000/tcp 2>/dev/null || true
else
    PIDS_PORT=$(lsof -t -i:3000 2>/dev/null || echo "")
    if [ -n "$PIDS_PORT" ]; then
         kill -9 $PIDS_PORT 2>/dev/null || true
    fi
fi
sleep 2

pm2 start ecosystem.config.cjs

# Save list
pm2 save

echo "✅ [Runner] Deployment complete! Server managed by PM2."
pm2 list
