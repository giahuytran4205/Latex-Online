#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
LOG_FILE="$PROJECT_DIR/server.log"

echo "🚀 [Runner] Starting deployment runner..."

# 1. Environment
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
export LC_ALL=C
# Critical TeX Live Environment Variables
export TEXMFROOT='/data/data/com.termux/files/usr/share/texlive/2025.0'
export TEXMFDIST="$TEXMFROOT/texmf-dist"
export TEXMFLOCAL='/data/data/com.termux/files/usr/share/texlive/texmf-local'
export TEXMFSYSVAR="$TEXMFROOT/texmf-var"
export TEXMFSYSCONFIG="$TEXMFROOT/texmf-config"
export PERL5LIB="$TEXMFROOT/tlpkg:$TEXMFDIST/scripts/texlive"

echo "🔎 [Runner] Debugging TeX Live environment..."
if [ ! -f "$TEXMFDIST/scripts/texlive/mktexlsr.pl" ]; then
    echo "⚠️ [Runner] mktexlsr.pl NOT found at expected path!"
    echo "Searching for mktexlsr.pl..."
    find /data/data/com.termux/files/usr/share/texlive -name "mktexlsr.pl" 2>/dev/null || echo "Not found."
else
    echo "✅ [Runner] mktexlsr.pl found."
fi

echo "🔨 [Runner] Pre-generating pdflatex format..."
fmtutil-sys --byfmt pdflatex || echo "⚠️ [Runner] Format generation failed (non-fatal, will try at runtime)"

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

# Find process holding port 3000
# We use lsof to get PID and Command name to avoid killing sshd (if user is using reverse forward)
if command -v lsof &> /dev/null; then
    # Output format: PID COMMAND
    lsof -i:3000 -F pc | while read -r line; do
        # Simple parser for lsof -F output
        if [[ $line =~ ^p([0-9]+) ]]; then
            PID=${BASH_REMATCH[1]}
        elif [[ $line =~ ^c(.+) ]]; then
            CMD=${BASH_REMATCH[1]}
            
            # Logic: If we have both PID and CMD
            if [ -n "$PID" ] && [ -n "$CMD" ]; then
                if [[ "$CMD" == *"sshd"* ]]; then
                    echo "⚠️ [Runner] Port 3000 is held by sshd (likely your connection). SKIPPING kill."
                else
                    echo "🔪 [Runner] Killing $CMD (PID $PID) on port 3000..."
                    kill -9 $PID 2>/dev/null || true
                fi
                # Reset for next entry
                PID=""
                CMD=""
            fi
        fi
    done
else
    # Fallback if lsof fails/missing (though strictly we prefer lsof now)
    fuser -k 3000/tcp 2>/dev/null || true
fi

# Wait loop for port to be actually free
echo "⏳ [Runner] Waiting for port 3000 to clear..."
for i in {1..10}; do
    if ! lsof -i:3000 >/dev/null 2>&1; then
        echo "✅ [Runner] Port 3000 is free."
        break
    fi
    sleep 1
done

pm2 start ecosystem.config.cjs

# Save list
pm2 save

echo "✅ [Runner] Deployment complete! Server managed by PM2."
pm2 list
