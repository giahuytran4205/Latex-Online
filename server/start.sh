#!/data/data/com.termux/files/usr/bin/bash
# start.sh - Server startup script for Termux

cd "$(dirname "$0")"

# Kill existing server on port 3000
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start server in background
nohup node index.js > ../server.log 2>&1 &
SERVER_PID=$!

# Save PID for later
echo $SERVER_PID > ../server.pid

sleep 2

# Check if server started
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server started successfully (PID: $SERVER_PID)"
    exit 0
else
    echo "Server may still be starting... Check server.log"
    exit 0
fi
