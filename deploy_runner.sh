#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
LOG_FILE="$PROJECT_DIR/server.log"

echo "🚀 [Runner] Starting deployment runner..."

# 1. Environment
echo "🔎 [Runner] Debugging and fixing TeX Live environment..."

# 1. Find the true location of mktexlsr.pl and TLUtils.pm to build PERL5LIB
TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
MKTEXLSR_PATH=$(find "$TEXLIVE_BASE" -name "mktexlsr.pl" 2>/dev/null | head -n 1)
TLUTILS_PATH=$(find "$TEXLIVE_BASE" -name "TLUtils.pm" 2>/dev/null | head -n 1)

if [ -n "$MKTEXLSR_PATH" ] && [ -n "$TLUTILS_PATH" ]; then
    echo "✅ Found mktexlsr.pl at: $MKTEXLSR_PATH"
    
    # Extract directories
    SCRIPT_DIR=$(dirname "$MKTEXLSR_PATH")
    TLPKG_DIR=$(dirname "$(dirname "$TLUTILS_PATH")") # TLUtils is usually in tlpkg/TeXLive/TLUtils.pm
    
    # Export PERL5LIB
    export PERL5LIB="$TLPKG_DIR:$SCRIPT_DIR"
    echo "🔗 Set PERL5LIB to: $PERL5LIB"
    
    # Also update other vars based on this root if possible, but standard paths are usually okay.
    # We insist on running fmtutil-sys with this PERL5LIB
    echo "🔨 [Runner] Generating pdflatex format..."
    fmtutil-sys --byfmt pdflatex || echo "❌ Format generation failed."
else
    echo "❌ [Runner] Could not find mktexlsr.pl or TLUtils.pm. TeX Live installation might be broken."
    echo "Attempting to install 'texlive-bin' again..."
    pkg install -y texlive-bin || true
fi

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
