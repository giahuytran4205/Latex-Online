#!/bin/bash
set -e

# --- CONFIGURATION ---
PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
NGINX_CONF_DIR="/data/data/com.termux/files/usr/etc/nginx/conf.d"
NGINX_LOG_DIR="/data/data/com.termux/files/usr/var/log/nginx"

echo "💎 Starting Fast Deployment System (Fix Bug Mode)..."

# 1. PREPARE ENVIRONMENT
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$NGINX_CONF_DIR"
mkdir -p "$NGINX_LOG_DIR"

# Skip LaTeX check if it's already there
if ! command -v pdflatex &> /dev/null; then
    echo "⚠️  pdflatex not found, skipping check..."
fi

# 2. INSTALL SYSTEM DEPENDENCIES (SKIP UPDATES FOR SPEED)
# pkg update is EXTREMELY slow, only run if node/nginx is missing
if ! command -v nginx &> /dev/null || ! command -v node &> /dev/null; then
    echo "📦 Initializing system packages (one-time setup)..."
    pkg update -y || true
    pkg install -y nginx nodejs lsof
fi

if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# 3. BUILD APPLICATION
cd "$PROJECT_DIR"

echo "📦 Building Frontend..."
cd client

# Sync Firebase config
if [ -n "$VITE_FIREBASE_API_KEY" ]; then
    cat > .env.local <<EOF
VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
EOF
fi

# Use --prefer-offline to speed up npm
npm install --prefer-offline --no-audit --no-fund
npm run build
cd ..

echo "🔧 Setting up Backend..."
cd server
npm install --production --prefer-offline --no-audit --no-fund
cd ..

# 4. CONFIGURE NGINX (Skip if already configured)
if [ ! -f "$NGINX_CONF_DIR/latex-online.conf" ]; then
    echo "⚙️  Configuring Nginx..."
    cp "$PROJECT_DIR/nginx/latex-online.conf" "$NGINX_CONF_DIR/latex-online.conf"
    nginx -s reload 2>/dev/null || nginx &
fi

# 5. RESTART SERVICES (Targeted reload, not kill)
echo "🚀 Reloading Backend via PM2..."

# SAFETY: Clear port 3005 only if it's dead/hung
if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Port 3005 is alive"
else
    echo "🔪 Clearing hung ports..."
    fuser -k 3005/tcp || true
fi

# Use reload for zero-downtime and speed
if pm2 show latex-api > /dev/null 2>&1; then
    pm2 reload latex-api --update-env
else
    pm2 start ecosystem.config.js --update-env
fi

pm2 save
echo "✨ Fast Deployment Complete!"
pm2 list
