#!/bin/bash
# DO NOT REMOVE - This script is used by GitHub Actions and manual deployments
set -e

PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

echo "🚀 [Deploy] Starting robust deployment..."

# 1. Environment Setup
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
export LC_ALL=C

echo "🔎 [Deploy] Setting up TeX environment..."
# Detect year dynamically but efficiently
TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
TL_YEAR=$(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r | head -n 1 || echo "2025.0")

export TEXMFROOT="$TEXLIVE_BASE/$TL_YEAR"
export TEXMFDIST="$TEXMFROOT/texmf-dist"
export PERL5LIB="$TEXMFROOT/tlpkg:$TEXMFDIST/scripts/texlive"

echo "✅ Environment: TEXMFROOT=$TEXMFROOT"

# Ensure PM2 is present
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 2. Build and Prep
cd "$PROJECT_DIR"

echo "📥 [Deploy] Building Client..."
cd client
npm install --no-audit --no-fund --quiet
npm run build
cd ..

echo "🔨 [Deploy] Building Server..."
cd server
npm install --production --no-audit --no-fund --quiet
cd ..

echo "🔨 [Deploy] Pre-generating LaTeX format..."
fmtutil-sys --byfmt pdflatex || true

# 3. Process Management (SAFE RESTART)
echo "🔄 [Deploy] Restarting via PM2..."

# SAFETY: Instead of killing ports (which hits SSH), we use PM2 exclusively.
# If there's a zombie process, the user should kill it once manually.
# From now on, PM2 will manage everything.
pm2 delete latex-backend 2>/dev/null || true
pm2 delete latex-frontend 2>/dev/null || true

# Start fresh
pm2 start ecosystem.config.cjs --update-env
pm2 save

echo "🎉 [Deploy] SUCCESS! Web app running on port 3001."
pm2 list
