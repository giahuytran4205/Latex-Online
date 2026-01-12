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
# This handles both first-time start and zero-downtime reloads
pm2 startOrReload ecosystem.config.cjs

# Save list
pm2 save

echo "✅ [Runner] Deployment complete! Server managed by PM2."
pm2 list
