#!/bin/bash
# DO NOT REMOVE - This script is used by GitHub Actions and manual deployments
set -e

PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

echo "🚀 [Deploy] Starting robust deployment..."

# 1. Environment Setup (The most important part for LaTeX)
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
export LC_ALL=C

echo "🔎 [Deploy] Locating TeX Live environment..."
TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
if [ -d "$TEXLIVE_BASE" ]; then
    # Dynamically find the year directory (2024, 2025, etc.)
    YEAR_DIR=$(find "$TEXLIVE_BASE" -maxdepth 1 -name "20*" -type d | sort -r | head -n 1)
    if [ -n "$YEAR_DIR" ]; then
        echo "✅ Detected TeX Live Root: $YEAR_DIR"
        export TEXMFROOT="$YEAR_DIR"
        export TEXMFDIST="$TEXMFROOT/texmf-dist"
        export TEXMFLOCAL="$TEXLIVE_BASE/texmf-local"
        export TEXMFSYSVAR="$TEXMFROOT/texmf-var"
        export TEXMFSYSCONFIG="$TEXMFROOT/texmf-config"
        
        # Build PERL5LIB dynamically
        MKTEXLSR_PL=$(find "$TEXMFDIST" -name "mktexlsr.pl" | head -n 1 || echo "")
        if [ -n "$MKTEXLSR_PL" ]; then
            PERL_SCRIPT_DIR=$(dirname "$MKTEXLSR_PL")
            TLPKG_DIR="$TEXMFROOT/tlpkg"
            export PERL5LIB="$TLPKG_DIR:$PERL_SCRIPT_DIR"
            echo "✅ Setup PERL5LIB: $PERL5LIB"
        fi
    fi
fi

# Ensure critical tools are present
if ! command -v pm2 &> /dev/null; then
    echo "📦 [Deploy] Installing PM2..."
    npm install -g pm2
fi

if ! command -v lsof &> /dev/null; then
    echo "📦 [Deploy] Installing lsof..."
    pkg install -y lsof
fi

# 2. Build and Prep
cd "$PROJECT_DIR"

echo "📥 [Deploy] Building Client..."
cd client
npm install
npm run build
cd ..

echo "🔨 [Deploy] Building Server..."
cd server
npm install --production
cd ..

echo "🔨 [Deploy] Pre-generating LaTeX format files..."
# This prevents runtime errors in the web app
fmtutil-sys --byfmt pdflatex || echo "⚠️ Warning: fmtutil-sys failed, but continuing..."

# 3. Process Management (SSH SAFETY FIRST)
echo "🔄 [Deploy] Updating PM2 processes..."

# We use a surgical approach to avoid killing SSH
# 1. We ONLY target port 3000 (Backend) and 3001 (Frontend)
# 2. We EXPLICITLY skip any process related to 'sshd'
PROTECT_SSH_AND_KILL() {
    PORT=$1
    echo "🧹 [Port $PORT] Checking for existing processes..."
    PIDS=$(lsof -t -i:$PORT 2>/dev/null || echo "")
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            # Verify process name to avoid killing sshd
            CMD=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
            if [[ "$CMD" == *"sshd"* ]]; then
                echo "⚠️ [Port $PORT] Found sshd (PID $PID), SKIPPING."
            else
                echo "🔪 [Port $PORT] Killing $CMD (PID $PID)..."
                kill -9 $PID 2>/dev/null || true
            fi
        done
    else
        echo "✅ [Port $PORT] Already free."
    fi
}

PROTECT_SSH_AND_KILL 3000
PROTECT_SSH_AND_KILL 3001

# Restart via PM2
# We delete existing entries to ensure a clean environment reload
pm2 delete latex-backend 2>/dev/null || true
pm2 delete latex-frontend 2>/dev/null || true

# Start everything fresh using the ecosystem file
pm2 start ecosystem.config.cjs --update-env
pm2 save

echo "🎉 [Deploy] SUCCESS!"
echo "--------------------------------------------------"
echo "Management commands:"
echo "  pm2 list          # Check status"
echo "  pm2 logs          # View all logs"
echo "  pm2 logs latex-backend"
echo "  pm2 logs latex-frontend"
echo "--------------------------------------------------"
pm2 list
