#!/bin/bash
# Simple script to start the local development/production environment via PM2

SCRIPT_DIR=$(dirname "$0")
cd "$SCRIPT_DIR/.."

echo "🚀 Starting Latex Online via PM2..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Please install it with: npm install -g pm2"
    exit 1
fi

# Ensure paths are set for the shell environment (especially on Termux)
# (This part is handled robustly by the ecosystem config checking environment)

pm2 start ecosystem.config.cjs --update-env

echo "✅ App started in PM2."
echo "Use 'pm2 list' to see status and 'pm2 logs' to see logs."
pm2 list
