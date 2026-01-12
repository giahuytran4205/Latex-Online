#!/data/data/com.termux/files/usr/bin/bash
# start.sh - Server startup script for Termux

cd "$(dirname "$0")"

# Kill existing server on port 3000
echo "Stopping existing server..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start server in background with nohup and proper detachment
echo "Starting server..."
nohup node index.js > ../server.log 2>&1 &
SERVER_PID=$!

# Disown the process to prevent SIGHUP when shell exits
disown $SERVER_PID

# Save PID for later
echo $SERVER_PID > ../server.pid
echo "Server started with PID: $SERVER_PID"

sleep 3

# Check if server started
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server check: OK"
    exit 0
else
    echo "Server check: Failed (might still be starting)"
    # Don't exit with error, just warn, as it might take longer on slow devices
    exit 0
fi
