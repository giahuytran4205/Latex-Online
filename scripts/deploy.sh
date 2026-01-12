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

# Dynamic TeX Live Detection & Setup
setup_latex_env() {
    echo "🔧 Setting up LaTeX environment..."
    
    # 1. Try to find kpsewhich (Standard tool for paths)
    if command -v kpsewhich &> /dev/null; then
        export TEXMFROOT=$(kpsewhich -var-value=TEXMFROOT)
        export TEXMFDIST=$(kpsewhich -var-value=TEXMFDIST)
    else
        # Fallback: Heuristic Search
        TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
        if [ -d "$TEXLIVE_BASE" ]; then
            # Find the latest year directory that actually contains texmf-dist
            for YEAR_DIR in $(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r); do
                if [ -d "$TEXLIVE_BASE/$YEAR_DIR/texmf-dist" ]; then
                    TL_YEAR="$YEAR_DIR"
                    break
                fi
            done
            
            if [ -n "$TL_YEAR" ]; then
                export TEXMFROOT="$TEXLIVE_BASE/$TL_YEAR"
                export TEXMFDIST="$TEXMFROOT/texmf-dist"
            fi
        fi
    fi

    # 2. Fix Perl Include Paths (The main cause of "Can't locate mktexlsr.pl")
    if [ -n "$TEXMFROOT" ]; then
        # Find where mktexlsr.pl actually is
        MKTEXLSR_PATH=$(find "$TEXMFROOT" "$TEXMFDIST" -name "mktexlsr.pl" 2>/dev/null | head -n 1)
        
        if [ -n "$MKTEXLSR_PATH" ]; then
            MKTEXLSR_DIR=$(dirname "$MKTEXLSR_PATH")
            # Usually it needs tlpkg and the scripts dir
            export PERL5LIB="$TEXMFROOT/tlpkg:$MKTEXLSR_DIR"
            echo "✅  Found mktexlsr.pl at $MKTEXLSR_PATH"
            echo "    Set PERL5LIB=$PERL5LIB"
        else
            echo "⚠️  Could not find mktexlsr.pl"
        fi
    fi
}

setup_latex_env

# 2. INSTALL SYSTEM DEPENDENCIES
echo "📦 Updating system packages..."
pkg update -y || true
echo "📦 Installing nginx, nodejs, lsof..."
echo "📦 Installing nginx, nodejs, lsof..."
pkg install -y nginx nodejs lsof

echo "📦 Checking TeX Live..."
if ! command -v pdflatex &> /dev/null; then
    echo "📦 Installing TeX Live..."
    echo "📦 Installing TeX Live..."
    # 1. Try generic 'texlive'
    if pkg install -y texlive 2>/dev/null; then
        echo "✅ 'texlive' package installed."
    # 2. Try 'texlive-bin' (Common in newer Termux repos)
    elif pkg install -y texlive-bin 2>/dev/null; then
        echo "✅ 'texlive-bin' installed."
    # 3. Fallback to installer script
    else
        echo "⚠️  Packages failed. Trying installer..."
        pkg install -y texlive-installer || true
        termux-install-tl || true
    fi
fi

# PM2 is installed via npm, not pkg
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# Ensure LaTeX formats are built (Fixes "I can't find the format file `pdflatex.fmt'!")
if command -v fmtutil-sys &> /dev/null; then
    echo "⚙️  Verifying LaTeX formats..."
    if ! kpsewhich pdflatex.fmt &> /dev/null; then
        echo "⚠️  pdflatex.fmt missing. Rebuilding formats..."
        fmtutil-sys --all > /dev/null 2>&1 || fmtutil --all
    fi
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

# 💣 Aggressive cleanup
pm2 kill || true

# SAFETY: Clear port 3005 if it's not held by SSH
PORT=3005
PIDS=$(lsof -t -i:$PORT 2>/dev/null || echo "")
if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
        CMD=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        if [[ "$CMD" == *"sshd"* ]]; then
            echo "⚠️  Port $PORT held by sshd. Skipping kill."
        else
            echo "🔪 Killing process $CMD (PID $PID) on port $PORT..."
            kill -9 $PID 2>/dev/null || true
        fi
    done
fi

# Clean PM2 state (redundant but safe after kill)
pm2 delete latex-api 2>/dev/null || true

# Start with dynamically found TeX paths
pm2 start ecosystem.config.js --update-env
pm2 save

echo "✨ Deployment Complete!"
echo "------------------------------------------------"
echo "URL: http://localhost:8080 (Managed by Nginx)"
echo "Backend: Port 3000 (Managed by PM2)"
echo "------------------------------------------------"
pm2 list
