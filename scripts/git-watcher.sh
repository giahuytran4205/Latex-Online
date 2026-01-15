#!/bin/bash

# --- CONFIGURATION ---
PROJECT_DIR="/data/data/com.termux/files/home/latex-online"
BRANCH="main"
CHECK_INTERVAL=10 # Giây

echo "👀 Git Watcher started for branch $BRANCH..."
cd "$PROJECT_DIR"

while true; do
    # 1. Lấy thông tin mới nhất từ remote
    git fetch origin $BRANCH &> /dev/null
    
    # 2. So sánh bản local và remote
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/$BRANCH)

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "✨ New changes detected! Starting deployment..."
        
        # 3. Kéo code mới
        git pull origin $BRANCH
        
        # 4. Thực thi script deploy đã có
        if [ -f "scripts/deploy.sh" ]; then
            chmod +x scripts/deploy.sh
            bash scripts/deploy.sh
        else
            echo "❌ Error: scripts/deploy.sh not found!"
        fi
        
        echo "✅ Deployment finished. Waiting for next changes..."
    fi

    sleep $CHECK_INTERVAL
done
