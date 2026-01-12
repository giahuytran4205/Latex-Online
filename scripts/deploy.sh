#!/bin/bash
set -e

# --- CONFIGURATION ---
PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
NGINX_CONF_DIR="/data/data/com.termux/files/usr/etc/nginx/conf.d"
NGINX_LOG_DIR="/data/data/com.termux/files/usr/var/log/nginx"

echo "💎 Starting Premium Deployment System..."

# 1. PREPARE ENVIRONMENT
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$NGINX_CONF_DIR"
mkdir -p "$NGINX_LOG_DIR"

export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
export LC_ALL=C

# Dynamic TeX Live Detection
TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
TL_YEAR=$(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r | head -n 1 || echo "2025.0")
export TEXMFROOT="$TEXLIVE_BASE/$TL_YEAR"
export TEXMFDIST="$TEXMFROOT/texmf-dist"
export PERL5LIB="$TEXMFROOT/tlpkg:$TEXMFDIST/scripts/texlive"

# 2. INSTALL SYSTEM DEPENDENCIES
echo "📦 Updating system packages..."
pkg update -y || true
echo "📦 Installing nginx, nodejs, lsof..."
pkg install -y nginx nodejs lsof

# PM2 is installed via npm, not pkg
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# 3. BUILD APPLICATION
cd "$PROJECT_DIR"

echo "📦 Building Frontend..."
cd client
npm install
npm run build
cd ..

echo "🔧 Setting up Backend..."
cd server
npm install --production
cd ..

# 4. CONFIGURE NGINX
echo "⚙️  Configuring Nginx Reverse Proxy..."
MAIN_NGINX_CONF="/data/data/com.termux/files/usr/etc/nginx/nginx.conf"

# Create a default nginx.conf if it doesn't exist
if [ ! -f "$MAIN_NGINX_CONF" ]; then
    echo "⚠️  nginx.conf missing, creating default..."
    mkdir -p "$(dirname "$MAIN_NGINX_CONF")"
    cat > "$MAIN_NGINX_CONF" <<EOF
worker_processes  1;
events {
    worker_connections  1024;
}
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    include $NGINX_CONF_DIR/*.conf;
}
EOF
fi

cp "$PROJECT_DIR/nginx/latex-online.conf" "$NGINX_CONF_DIR/latex-online.conf"

# Ensure nginx main config includes our conf.d
if ! grep -q "include $NGINX_CONF_DIR/*.conf;" "$MAIN_NGINX_CONF"; then
    echo "🔗 Linking conf.d to main nginx.conf..."
    sed -i '/http {/a \    include '"$NGINX_CONF_DIR"'/*.conf;' "$MAIN_NGINX_CONF"
fi

# 5. RESTART SERVICES
echo "🔄 Reloading Nginx..."
nginx -s reload 2>/dev/null || nginx &

echo "🚀 Restarting Backend via PM2..."
# We use --update-env to pass our dynamically found TeX paths to the backend
pm2 start ecosystem.config.js --update-env
pm2 save

echo "✨ Deployment Complete!"
echo "------------------------------------------------"
echo "URL: http://localhost:8080 (Termux Default)"
echo "Backend: Port 3000 (Managed by PM2)"
echo "------------------------------------------------"
pm2 list
