#!/bin/bash
# deploy.sh - Manual deployment script for Termux
# Run this on your local machine to deploy

set -e

SERVER="100.91.248.50"
PORT="8022"
USER="${1:-u0_a315}"  # Default user, can be overridden

echo "🚀 Starting deployment to Termux server..."

# Build client
echo "📦 Building client..."
cd client
npm install
npm run build
cd ..

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deploy
cp -r client/dist deploy/client-dist
cp -r server deploy/server
tar -czvf latex-online.tar.gz deploy
rm -rf deploy

# Copy to server
echo "📤 Copying to server..."
scp -P $PORT latex-online.tar.gz $USER@$SERVER:~/

# Deploy on server
echo "🔧 Deploying on server..."
ssh -p $PORT $USER@$SERVER << 'ENDSSH'
    cd ~
    
    # Stop existing server
    pkill -f "node index.js" || true
    sleep 2
    
    # Extract package
    mkdir -p latex-online
    cd latex-online
    rm -rf client server
    tar -xzvf ~/latex-online.tar.gz
    mv deploy/client-dist client/dist
    mv deploy/server .
    rm -rf deploy ~/latex-online.tar.gz
    
    # Install dependencies
    cd server
    npm install --production
    
    # Start server
    nohup node index.js > ../server.log 2>&1 &
    
    sleep 2
    echo "✅ Server started!"
    curl -s http://localhost:3000/api/health || echo "Note: Server might still be starting..."
ENDSSH

rm -f latex-online.tar.gz
echo "✅ Deployment complete! Access at http://$SERVER:3000"
